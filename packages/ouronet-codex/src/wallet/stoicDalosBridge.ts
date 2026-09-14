/**
 * TEMPORARY bridge for `@stoachain/stoa-core`'s not-yet-published
 * `KadenaWalletBuilder.createWalletPairFromDalosBitString(bitString, index)`.
 *
 * Status (as of this writing): this method is REAL and AGREED — it already
 * exists, built, tested, and verified against a frozen Go↔TypeScript
 * test-vector corpus in the sibling `stoa-js` repo's
 * `packages/stoa-core/src/wallet/KadenaWalletBuilder.ts` — but it has NOT
 * been published to npm. `ouronet-codex`'s `package.json` still resolves
 * `@stoachain/stoa-core` at `>=4.3.0` (currently 4.4.0 installed), and
 * NEITHER version's `KadenaWalletBuilder` class, nor its `IKadenaKeypair`
 * (`@stoachain/stoa-core/signing`) `seedType` union, know about `"stoic"`
 * or this method. Do NOT bump the dependency pin to "fix" this — the
 * containing version doesn't exist on the registry yet.
 *
 * This file is the SINGLE place that bridges both gaps with narrow,
 * clearly-scoped casts, so the rest of the codebase (CreateKadenaSeedModal,
 * InternalCodexResolver) can call the method / tag the keypair through a
 * real, typed signature instead of sprinkling `as any` around the codebase.
 *
 * DELETE THIS FILE once `@stoachain/stoa-core` publishes a version
 * containing `createWalletPairFromDalosBitString` (with `"stoic"` added to
 * `IKadenaKeypair.seedType`), this repo's `package.json` dependency range
 * is bumped to include it, and call sites are switched back to importing
 * `KadenaWalletBuilder` / `IKadenaKeypair` directly.
 */

import { KadenaWalletBuilder } from "@stoachain/stoa-core/wallet";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";

/**
 * Return shape of the not-yet-published method, per the agreed contract:
 *   - `publicKey` / `secretKey` are lowercase hex.
 *   - `secretKey` is a PLAIN (unencrypted) 32-byte Ed25519 seed —
 *     nacl-signable directly, structurally like koala's decrypted key, NOT
 *     the `@kadena/hd-wallet`-encrypted blob `createWalletPairFromMnemonic`
 *     returns.
 *   - `address` is `"k:" + secretKey's matching publicKey hex` — a real
 *     Chainweb account.
 * Pure + synchronous, no password/encryption at that layer (matches this
 * class's other derivation methods' internal shape, even though its outer
 * `createWalletPairFromMnemonic` sibling is async and password-scrambled).
 */
export interface DalosBitStringWalletPair {
  readonly publicKey: string;
  readonly secretKey: string;
  readonly address: string;
}

type BridgedKadenaWalletBuilder = typeof KadenaWalletBuilder & {
  createWalletPairFromDalosBitString(
    bitString: string,
    index: number,
  ): DalosBitStringWalletPair;
};

/**
 * Derive a Chainweb keypair from a DALOS 1600-bit seed bitstring at `index`.
 * Thin, fully-typed wrapper around the bridged static method — see the
 * file-level "TEMPORARY" note above for why the cast is needed.
 */
export function createWalletPairFromDalosBitString(
  bitString: string,
  index: number,
): DalosBitStringWalletPair {
  return (
    KadenaWalletBuilder as BridgedKadenaWalletBuilder
  ).createWalletPairFromDalosBitString(bitString, index);
}

/**
 * `IKadenaKeypair` widened to allow `seedType: "stoic"`.
 *
 * TEMPORARY, same root cause as above: `@stoachain/stoa-core/signing`'s
 * published `IKadenaKeypair.seedType` union
 * (`"koala" | "chainweaver" | "eckowallet" | "foreign"`) doesn't include
 * `"stoic"` yet. `InternalCodexResolver` uses this widened type to
 * honestly tag stoic-derived keypairs instead of misrepresenting them as
 * `"koala"` or silently omitting `seedType`. A single cast back to
 * `IKadenaKeypair` at the resolver's return statement is the only place
 * this widening leaks into code that talks to `KeyResolver`'s real
 * contract. Delete alongside the rest of this file (see file header).
 */
export type StoicKadenaKeypair = Omit<IKadenaKeypair, "seedType"> & {
  readonly seedType?: IKadenaKeypair["seedType"] | "stoic";
};
