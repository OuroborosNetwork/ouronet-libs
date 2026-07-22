/**
 * InternalCodexResolver — bridges the internal Zustand codex store to
 * `@stoachain/stoa-core/signing`'s `KeyResolver` contract.
 *
 * Replaces OuronetUI's `ReduxCodexResolver` (which pulled from a Redux
 * walletsSlice). Same three-method surface, same semantics, same crypto
 * primitives — only the source of state changes from Redux to the
 * package's per-provider Zustand store.
 *
 * Three methods (per KeyResolver interface):
 *   1. listCodexPubs() — every pubkey the store can produce a private
 *      key for. Cheap (no decryption, no password needed). Used by
 *      analyzeGuard to partition codex-vs-foreign signers.
 *   2. getKeyPairByPublicKey(pub) — resolve one pubkey to a signing-
 *      ready IKadenaKeypair. Auth-gated (throws CodexLockedError if
 *      the password cache is empty/expired). Throws
 *      CodexKeyMissingError if the pubkey isn't in the codex.
 *   3. requestForeignKey(pub) — optional. Default implementation
 *      throws CodexKeyMissingError so transactions fail-fast rather
 *      than silently hang. Consumers wire a modal-driven callback
 *      via the constructor `options.requestForeignKey` (the Phase 6
 *      <ForeignKeySignModal> + Phase 7 provider will do this).
 *
 * Why these are class methods (not functions) — the resolver holds
 * a reference to the Zustand store. Classes give us a tidy place to
 * hang that reference + read it fresh on every call (so action-driven
 * store updates between modal mount and execute() submit are reflected
 * without resolver re-creation).
 *
 * Cryptography is delegated entirely to @stoachain/stoa-core/{crypto,wallet}
 * + @stoachain/kadena-stoic-legacy/hd-wallet. This file owns ONLY the
 * codex-state-to-keypair plumbing — no key derivation logic of its own.
 */

import type { UseBoundStore, StoreApi } from "zustand";
import type { KeyResolver, IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { toHexString } from "@stoachain/stoa-core/signing";
import { buildCodexPubSet } from "@stoachain/stoa-core/guard";
import { smartDecrypt } from "@stoachain/stoa-core/crypto";
import { KadenaWalletBuilder } from "@stoachain/stoa-core/wallet";
import { kadenaDecrypt, kadenaEncrypt } from "@stoachain/kadena-stoic-legacy/hd-wallet";
import { legacyKadenaChangePassword } from "@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver";
import { hexToBin } from "@stoachain/kadena-stoic-legacy/cryptography-utils";

import type { CodexStoreState } from "../state/store.js";
import { CodexKeyMissingError, CodexLockedError } from "../errors/types.js";

type CodexStore = UseBoundStore<StoreApi<CodexStoreState>>;

/** Non-empty transient password used to re-scramble a reconstructed extended
 *  key before handing it to the WASM signer. The value is arbitrary — it only
 *  has to be (a) non-empty, because `universalSignTransaction` gates the
 *  Chainweaver path on a truthy `password`, and (b) identical between the
 *  re-scramble and the eventual `kadenaSign` call (it is, because we return it
 *  as the keypair's `password`). It never persists and never affects the key. */
const EXTENDED_FOREIGN_SCRAMBLE_PW = "codex-extended-foreign";

/**
 * Repackage a bare 128-hex BIP32-Ed25519 extended private key (`kL‖kR`, the
 * Chainweaver / kadenakeys.io export format) into the encrypted-blob + password
 * shape the WASM extended-key signer consumes — WITHOUT rolling any custom
 * BIP32 math (the hd-wallet library owns the extended-key format).
 *
 * The library's signer takes a 128-byte buffer `[kL‖kR | pubKey | chainCode]`
 * whose first 64 bytes are XOR-scrambled against a wallet password, plus that
 * same password. So we:
 *   1. Lay out a plaintext buffer `[kL‖kR | pubKey | 0…0]`. The chainCode is
 *      unused for signing (it only matters for *child* derivation) → zero-fill.
 *      Plaintext == "scrambled against the empty password".
 *   2. Re-scramble bytes 0‥64 from the empty password to a non-empty one via
 *      `kadenaChangePassword` (the library's own re-key primitive).
 *   3. AES-wrap the result with the same non-empty password.
 * `universalSignTransaction` then decrypts with that password and the WASM
 * un-scrambles the scalar back to plaintext before signing — producing a
 * signature byte-identical to the genuine seed-derived path.
 */
async function buildExtendedForeignSigningKey(
  extendedPrivHex: string,
  publicKeyHex: string,
): Promise<{ encryptedSecretKey: string; password: string }> {
  const xprv = new Uint8Array(128);
  xprv.set(hexToBin(extendedPrivHex), 0); // kL‖kR (64 bytes, plaintext)
  xprv.set(hexToBin(publicKeyHex), 64); //    pubKey (32 bytes)
  // bytes 96‥128 (chainCode) intentionally left zero — unused for signing.
  const scrambled = new Uint8Array(
    await legacyKadenaChangePassword(xprv, "", EXTENDED_FOREIGN_SCRAMBLE_PW),
  );
  const encryptedSecretKey = await kadenaEncrypt(
    EXTENDED_FOREIGN_SCRAMBLE_PW,
    scrambled,
  );
  return { encryptedSecretKey, password: EXTENDED_FOREIGN_SCRAMBLE_PW };
}

export interface InternalCodexResolverOptions {
  /**
   * Optional callback invoked when a transaction needs a key whose
   * pubkey isn't in the codex. The default (when omitted) is to throw
   * `CodexKeyMissingError` immediately — the fail-fast path documented
   * in `KeyResolver.requestForeignKey`'s contract.
   *
   * <CodexProvider> wires this to the package's <ForeignKeySignModal>
   * once both ship (Phase 6 / Phase 7). Standalone resolver usage
   * (advanced consumers building their own signing pipeline) can pass
   * any async (pub) => privateKey-hex function here.
   */
  requestForeignKey?: (publicKey: string) => Promise<string>;
}

export class InternalCodexResolver implements KeyResolver {
  constructor(
    private readonly store: CodexStore,
    private readonly options: InternalCodexResolverOptions = {}
  ) {}

  listCodexPubs(): Set<string> {
    const s = this.store.getState();
    // Pass [] for the legacy flat `kadenaAccounts` arg — the codex package
    // models accounts only as nested `seeds[].accounts[]` (no flat mirror).
    // buildCodexPubSet handles undefined/empty fine.
    return buildCodexPubSet(s.kadenaSeeds, [], s.pureKeypairs);
  }

  async getKeyPairByPublicKey(publicKey: string): Promise<IKadenaKeypair> {
    const state = this.store.getState();

    // Auth gate — every key resolution path needs the cached password.
    const cache = state.passwordCache;
    if (!cache || cache.expiresAt <= Date.now()) {
      throw new CodexLockedError("getKeyPairByPublicKey");
    }
    const password = cache.value;

    // 1. Pure-keypair lookup (foreign keys imported directly into codex).
    const purePair = state.pureKeypairs.find((k) => k.publicKey === publicKey);
    if (purePair) {
      const privateKey = await smartDecrypt(
        purePair.encryptedPrivateKey,
        password
      );
      // 128-hex = BIP32-Ed25519 extended key (Chainweaver / kadenakeys.io
      // format). nacl cannot sign these (different scheme), so route them
      // through the WASM extended-key signer — the same path seed-derived
      // chainweaver accounts use — by repackaging into its expected shape.
      if (privateKey.length === 128) {
        const { encryptedSecretKey, password: walletPw } =
          await buildExtendedForeignSigningKey(privateKey, publicKey);
        return {
          publicKey,
          privateKey,
          seedType: "chainweaver" as const,
          encryptedSecretKey,
          password: walletPw,
        };
      }
      return {
        publicKey,
        privateKey,
        seedType: "foreign" as const,
      };
    }

    // 2. Derived-account lookup across all kadena seeds.
    for (const seed of state.kadenaSeeds) {
      const account = seed.accounts.find((a) => a.publicKey === publicKey);
      if (!account) continue;

      // Decrypt the seed's mnemonic, then re-derive the keypair at the
      // recorded index. Same dance as OuronetUI's wallet-context.getKadenaKeyPairs
      // — preserved verbatim so signing behavior is bit-identical.
      const mnemonic = await smartDecrypt(seed.secret, password);
      const { publicKey: pub, secretKey: encryptedSecretKey } =
        await KadenaWalletBuilder.createWalletPairFromMnemonic(
          password,
          mnemonic,
          account.index,
          seed.seedType
        );

      // Decrypt the @kadena/hd-wallet-encrypted inner secret to a raw
      // Uint8Array, then hex-stringify. For koala this gives the 32-byte
      // (64-hex) Ed25519 secretKey that nacl signs with. For
      // chainweaver/eckowallet the extended key is 96 bytes (192 hex);
      // we truncate to 64 as fallback only — actual chainweaver/ecko
      // signing routes through universalSignTransaction's WASM path
      // using `encryptedSecretKey` + `password` instead.
      const decryptedPk = await kadenaDecrypt(password, encryptedSecretKey);
      let hexKey = toHexString(decryptedPk);
      if (hexKey.length > 64) hexKey = hexKey.slice(0, 64);

      return {
        publicKey: pub,
        privateKey: hexKey,
        seedType: seed.seedType,
        encryptedSecretKey,
        password,
      };
    }

    // 3. Not found — emit the structured self-diagnostic error. Same
    //    wording OuronetUI v1.0.9 added; lives here so every consumer
    //    sees the same diagnostic.
    const derivedCount = state.kadenaSeeds.reduce(
      (sum, s) => sum + s.accounts.length,
      0
    );
    throw new CodexKeyMissingError(
      publicKey,
      state.pureKeypairs.length,
      derivedCount
    );
  }

  async requestForeignKey(publicKey: string): Promise<string> {
    if (!this.options.requestForeignKey) {
      // Fail-fast path. Per the KeyResolver JSDoc, "When the method is
      // omitted AND a transaction reaches CodexSigningStrategy.execute
      // with a foreign-key signer, the strategy fails fast on first
      // foreign-key need with a precise pre-flight error before any I/O".
      // The class shape here forces us to implement the method (TS
      // can't represent "interface method conditionally absent on this
      // instance"), so we keep the implementation but make it throw
      // — same observable outcome.
      const s = this.store.getState();
      const derivedCount = s.kadenaSeeds.reduce(
        (sum, x) => sum + x.accounts.length,
        0
      );
      throw new CodexKeyMissingError(
        publicKey,
        s.pureKeypairs.length,
        derivedCount
      );
    }
    return this.options.requestForeignKey(publicKey);
  }
}
