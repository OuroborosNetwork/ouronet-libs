/**
 * FACILITY #4 — BUILDING A CALL TO A CHAIN-NATIVE CONTRACT.
 *
 * `buildCall` names `ouronet-ns.<key>` and reads the generated registry, so it can only describe
 * the Ouronet surface. Three operations in OuronetUI are not on that surface at all — UrStoa
 * stake, unstake and collect execute `coin.C_URV|Stake` / `|Unstake` / `|Collect`, **StoaChain's
 * own root-namespace contract**, with no `ouronet-ns` entrypoint anywhere. Those three were the
 * last carriers in the migration whose blocker was not a feature of the form but the simple fact
 * that *nothing could describe the call*.
 *
 * WHAT THIS IS NOT. It is not a second registry and not a generator. The signatures have been
 * published here, typed, the whole time (`STOA_SIGNATURES`, `KADENA_SIGNATURES` — nine and five
 * entrypoints with names AND types), and `formatForType` already renders every type they use,
 * guards included. The facility was mis-sized as "a generator plus a table" after a search of a
 * *different* artefact — OuronetUI's local `pactSignatures.generated.ts`, which is generated from
 * the OURONET sources and so is correctly Ouronet-only. This file is what was actually missing:
 * the three lines between a table and a string.
 *
 * WHY IT BELONGS HERE AND NOT IN THE APP. A hand-assembled Pact template in a consumer is the
 * one thing this package exists to end — the defect ledger behind `buildCall` is a list of them.
 * `@ouronet/ouronet-core` currently ships `buildStakeUrStoaPactCode` and friends as exactly such
 * templates, one per operation, each repeating the quoting and decimal rules; they are correct
 * today and are correct by inspection only.
 */
import { formatForType } from "./format.js";
import { RegistryError, tryGetEntrypoint } from "./registry.js";
import { chainOf, KADENA_SIGNATURES, STOA_SIGNATURES } from "./tooltip.js";

/** The declared parameters of a native key, or `undefined` if this is not a native key. */
export function nativeSignature(key: string): ReadonlyArray<[string, string]> | undefined {
  // `chainOf` THROWS on a key declared for both chains rather than picking one, and that refusal
  // is load-bearing here: both chains call their contract `coin`, and building a call against
  // the wrong chain's signature is the kind of wrong that looks right.
  const chain = chainOf(key);
  if (chain === "stoa") return STOA_SIGNATURES[key];
  if (chain === "kadena") return KADENA_SIGNATURES[key];
  return undefined;
}

/**
 * Build the Pact code for a call to a chain-NATIVE contract, checked against its signature.
 *
 * ```ts
 * buildNativeCall("coin.C_URV|Stake", { account: "k:aa…", "urstoa-amount": 1.5 })
 * // => (coin.C_URV|Stake "k:aa…" 1.5)
 * ```
 *
 * **NO NAMESPACE IS PREFIXED, and that is the difference from `buildCall`.** StoaChain's `coin`
 * lives in the root namespace; emitting `ouronet-ns.coin.C_URV|Stake` would name a module that
 * does not exist, and the failure arrives as a resolution error on chain rather than here.
 *
 * Arguments are supplied BY NAME and rendered in the contract's declared order — the same
 * contract `buildCall` keeps, for the same reason: `coin.C_TransferAnew` takes its guard THIRD
 * and its amount FOURTH, and a positional caller that swapped them would be building a transfer
 * of a guard.
 */
export function buildNativeCall(key: string, args: Record<string, unknown>): string {
  const params = nativeSignature(key);

  if (params === undefined) {
    // Say which of the two mistakes this is, because they have opposite fixes.
    if (tryGetEntrypoint(key))
      throw new RegistryError(
        `"${key}" is an Ouronet entrypoint, not a chain-native one. Use buildCall, which ` +
          `prefixes the namespace and reads the generated registry.`,
      );
    throw new RegistryError(
      `"${key}" is not a chain-native entrypoint this package describes. Known native keys: ` +
        `${[...Object.keys(STOA_SIGNATURES), ...Object.keys(KADENA_SIGNATURES)].join(", ")}.`,
    );
  }

  const declared = params.map(([name]) => name);
  const missing = declared.filter(n => !(n in args));
  const extra = Object.keys(args).filter(n => !declared.includes(n));

  if (missing.length || extra.length) {
    const lines = [`Arguments do not match ${key}.`];
    if (missing.length) lines.push(`  missing: ${missing.join(", ")}`);
    if (extra.length) lines.push(`  unexpected: ${extra.join(", ")}`);
    lines.push(`  declared: (${params.map(([n, t]) => `${n}:${t}`).join(" ")})`);
    if (missing.length)
      lines.push(
        `  A short call is NOT rejected by Pact -- it partially applies and yields a closure, ` +
          `so the transaction "succeeds" having done nothing.`,
      );
    throw new RegistryError(lines.join("\n"));
  }

  const rendered = params.map(([name, type]) => formatForType(args[name], type));
  return `(${key} ${rendered.join(" ")})`;
}

/**
 * Build a composite body: several calls, one per line, in the order given.
 *
 * **FACILITY #2's MECHANISM, and it is this small.** `coin.C_URV|Collect` needs the payment
 * key's coin account to exist; when it does not, the operation is two calls in one transaction —
 * `(coin.C_CreateAccount …)` then `(coin.C_URV|Collect …)`. A Pact transaction body is a
 * sequence of forms, so a composite is a JOIN and nothing more. It is written down because the
 * hand-rolled versions in the consumers each re-derived it, and one of them has to be read twice
 * to see whether the create comes first.
 *
 * The caller remains responsible for the transaction DATA a composite may need — a
 * `(read-keyset "ks")` rendered by `formatForType` reads a key this function cannot put there.
 */
export function composeCalls(calls: readonly string[]): string {
  if (calls.length === 0)
    throw new RegistryError("A composite needs at least one call.");
  return calls.join("\n");
}
