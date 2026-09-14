/**
 * InternalCodexResolver — Stoic seed-type tests.
 *
 * Companion to `resolver-internal.test.ts`, split into its own file because
 * this path needs a mock: `KadenaWalletBuilder.createWalletPairFromDalosBitString`
 * is a real, agreed `@stoachain/stoa-core` method that hasn't been
 * published to npm yet (see `src/wallet/stoicDalosBridge.ts`'s
 * "TEMPORARY" doc). `resolver-internal.test.ts` deliberately uses REAL
 * crypto throughout ("Why not mock smartDecrypt + KadenaWalletBuilder");
 * that's not possible here because the method doesn't exist at runtime to
 * be real about — it's monkeypatched directly onto the class instead.
 *
 * Covers the point-4 investigation finding: `getKeyPairByPublicKey`'s
 * "Derived-account lookup" loop previously assumed every kadena seed's
 * `secret` decrypts to a mnemonic; a stoic seed's `secret` is a DALOS
 * bitstring instead, so it needs (and now has) its own branch. Also
 * proves the resulting keypair actually signs through
 * `universalSignTransaction`'s nacl path (same path koala uses) with ZERO
 * changes to that stoa-core file.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCodexStore } from "@ouronet/ouronet-codex/state";
import { MemoryCodexAdapter } from "@ouronet/ouronet-codex/adapters";
import { InternalCodexResolver } from "@ouronet/ouronet-codex/resolver";
import type { IKadenaSeed } from "@ouronet/ouronet-codex/types";

import { smartEncrypt } from "@stoachain/stoa-core/crypto";
import { KadenaWalletBuilder } from "@stoachain/stoa-core/wallet";
import { universalSignTransaction } from "@stoachain/stoa-core/signing";
import { ed25519 } from "@noble/curves/ed25519";

const PASSWORD = "hunter2-stoic-resolver-test";
const FIXTURE_BITSTRING = "01".repeat(800); // 1600 bits

// A REAL Ed25519 keypair, used as the derivation-bridge's stub return value
// so the signing test can independently verify the produced signature —
// same "real crypto downstream of the mocked derivation" shape as
// resolver-internal.test.ts's Chainweaver pure-keypair fixtures.
const REAL_SECRET = ed25519.utils.randomPrivateKey();
const REAL_PUBLIC = ed25519.getPublicKey(REAL_SECRET);
const FIXTURE_PUBKEY = Buffer.from(REAL_PUBLIC).toString("hex");
const FIXTURE_SECKEY = Buffer.from(REAL_SECRET).toString("hex");

function makeUnsignedCommandFor(pubKey: string, hashBytes: Uint8Array) {
  const cmd = JSON.stringify({ signers: [{ pubKey }] });
  const hash = Buffer.from(hashBytes).toString("base64url");
  return { cmd, hash, sigs: [undefined] } as any;
}

async function makeStoicSeed(): Promise<{ seed: IKadenaSeed; derivedPub: string }> {
  const encryptedBitString = await smartEncrypt(FIXTURE_BITSTRING, PASSWORD, "2");
  return {
    seed: {
      id: "seed-stoic-1",
      name: "Stoic Seed",
      seedType: "stoic",
      version: "1.0",
      index: 0,
      secret: encryptedBitString,
      main: `k:${FIXTURE_PUBKEY}`,
      createdAt: "2026-06-01T00:00:00.000Z",
      accounts: [{ index: 0, publicKey: FIXTURE_PUBKEY, derivationPath: "m'/44'/626'/0'" }],
    },
    derivedPub: FIXTURE_PUBKEY,
  };
}

describe("InternalCodexResolver — Stoic seedType", () => {
  let store: ReturnType<typeof createCodexStore>;
  let resolver: InternalCodexResolver;
  let bridgeMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const adapter = new MemoryCodexAdapter("dev");
    store = createCodexStore();
    await store.getState().actions.init(adapter, "dev");
    resolver = new InternalCodexResolver(store);

    bridgeMock = vi.fn((_bitString: string, _index: number) => ({
      publicKey: FIXTURE_PUBKEY,
      secretKey: FIXTURE_SECKEY,
      address: `k:${FIXTURE_PUBKEY}`,
    }));
    (KadenaWalletBuilder as unknown as Record<string, unknown>).createWalletPairFromDalosBitString = bridgeMock;
  });

  afterEach(() => {
    delete (KadenaWalletBuilder as unknown as Record<string, unknown>).createWalletPairFromDalosBitString;
  });

  it("returns a plain nacl-signable keypair for a stoic-seed-derived account (decrypts the bitstring, not a mnemonic)", async () => {
    const { seed, derivedPub } = await makeStoicSeed();
    await store.getState().actions.addKadenaSeed(seed);
    store.getState().actions.authenticate(PASSWORD, 60);

    const result = await resolver.getKeyPairByPublicKey(derivedPub);

    expect(result.publicKey).toBe(FIXTURE_PUBKEY);
    expect(result.privateKey).toBe(FIXTURE_SECKEY);
    expect(result.privateKey).toHaveLength(64);
    expect(result.seedType).toBe("stoic");
    // Must NOT carry chainweaver/eckowallet's WASM markers.
    expect(result.encryptedSecretKey).toBeUndefined();
    expect(result.password).toBeUndefined();
    // Bridge called with the DECRYPTED bitstring + the account's index.
    expect(bridgeMock).toHaveBeenCalledWith(FIXTURE_BITSTRING, 0);
  });

  it("signs successfully through universalSignTransaction's nacl path — zero stoa-core changes needed", async () => {
    const { seed, derivedPub } = await makeStoicSeed();
    await store.getState().actions.addKadenaSeed(seed);
    store.getState().actions.authenticate(PASSWORD, 60);

    const keypair = await resolver.getKeyPairByPublicKey(derivedPub);
    expect(keypair.seedType).toBe("stoic");

    const hashBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) hashBytes[i] = (i * 17 + 5) & 0xff;
    const tx = makeUnsignedCommandFor(keypair.publicKey, hashBytes);

    const signed: any = await universalSignTransaction(tx, [
      {
        publicKey: keypair.publicKey,
        secretKey: keypair.privateKey,
        seedType: keypair.seedType as any,
        encryptedSecretKey: keypair.encryptedSecretKey,
        password: keypair.password,
      },
    ]);

    const sigHex: string = signed.sigs?.[0]?.sig;
    expect(sigHex, "a signature should be attached").toBeTruthy();
    const ok = ed25519.verify(
      Uint8Array.from(Buffer.from(sigHex, "hex")),
      hashBytes,
      Uint8Array.from(Buffer.from(keypair.publicKey, "hex")),
    );
    expect(ok, "signature must verify against the stoic-derived key's pubkey").toBe(true);
  });
});
