import { formatForType } from "./format.js";
import { getEntrypoint, namespace, RegistryError, registry } from "./registry.js";
import { isOffRegistryKey } from "./tooltip.js";
import type { Entrypoint } from "./types.js";

export interface BuildOptions {
  /**
   * Build even when `execution.supported` is false. The ten `defpact` entrypoints each have a
   * single-transaction twin with an identical parameter list, and the owner's 2026-09-15 ruling
   * is that the defpact paths are historical. Pass this only when exercising one deliberately.
   */
  allowUnsupported?: boolean;
  /** Override the namespace. Defaults to the registry's own (`ouronet-ns`). */
  namespace?: string;
}

/**
 * Build the Pact code for a call, CHECKED against the deployed signature.
 *
 * This is the whole point of the package. Every consumer bug this registry was built after was
 * a hand-written template that drifted from the contract:
 *
 *   * five builders passed three arguments to entrypoints that take four, after the
 *     patron/executor sweep added `executor` -- the UI stopped compiling and nobody noticed
 *     because the repo's typecheck ran against a config that checked zero files;
 *   * a launchpad read passed four arguments to a five-parameter reader. Pact does not raise
 *     "wrong arity" for that: it PARTIALLY APPLIES and yields a closure, so the caller saw
 *     "Evaluation did not reduce to a value" and the buy silently could not be funded.
 *
 * Arguments are supplied BY NAME and rendered in the contract's declared order, so an argument
 * cannot be transposed either -- `C_ChangeOwnership` moved its pool id to last while keeping
 * the same arity, which no count check would catch.
 */
export function buildCall(
  key: string,
  args: Record<string, unknown>,
  opts: BuildOptions = {},
): string {
  /**
   * A NATIVE KEY IS A DIFFERENT MISTAKE FROM A STALE ONE, so it gets a different sentence.
   * `coin.C_URV|Stake` is real, callable and simply not on Ouronet's surface -- it is
   * StoaChain's own root-namespace contract. Left to `getEntrypoint` it reports "the name is
   * stale or the module is not deployed", which sends the reader to look for a deploy that was
   * never going to exist. The prefix stays "Unknown entrypoint" because that is what it is.
   */
  if (isOffRegistryKey(key))
    throw new RegistryError(
      `Unknown entrypoint "${key}" -- it is a CHAIN-NATIVE call, not an Ouronet one, so no ` +
        `namespace is prefixed and the generated registry does not describe it. ` +
        `Use buildNativeCall.`,
    );

  const ep = getEntrypoint(key);

  if (ep.source === "repo-only") {
    throw new RegistryError(
      `"${key}" is not callable: no live code is deployed for it. ${ep.note ?? ""}`.trim(),
    );
  }
  if (ep.execution.supported === false && !opts.allowUnsupported) {
    throw new RegistryError(
      `"${key}" is not the supported route. ${ep.execution.supportedNote ?? ""} ` +
        `Pass { allowUnsupported: true } to build it anyway.`,
    );
  }

  const declared = ep.params.map(p => p.name);
  const given = Object.keys(args);
  const missing = declared.filter(n => !(n in args));
  const extra = given.filter(n => !declared.includes(n));

  if (missing.length || extra.length) {
    const lines = [`Arguments do not match ${key}.`];
    if (missing.length) lines.push(`  missing: ${missing.join(", ")}`);
    if (extra.length) lines.push(`  unexpected: ${extra.join(", ")}`);
    lines.push(`  declared: (${ep.params.map(p => `${p.name}:${p.type}`).join(" ")})`);
    // Say it plainly: a short call does not error on chain, it partially applies.
    if (missing.length)
      lines.push(
        `  A short call is NOT rejected by Pact -- it partially applies and yields a closure, ` +
          `so the transaction "succeeds" having done nothing.`,
      );
    throw new RegistryError(lines.join("\n"));
  }

  // A preflight-fed parameter must carry the READ's output. The registry marks these because a
  // client cannot construct them; passing null here would build a call that cannot work.
  for (const fed of ep.execution.fedParams ?? []) {
    if (args[fed.param] === null || args[fed.param] === undefined) {
      throw new RegistryError(
        `"${fed.param}" is the output of a preflight read and must be supplied.\n` +
          `  run: ${fed.producedBy.join(" or ")}\n` +
          `  ${ep.execution.note}`,
      );
    }
  }

  const ns = opts.namespace ?? namespace;
  const rendered = ep.params.map(p => formatForType(args[p.name], p.type));
  return `(${ns}.${key} ${rendered.join(" ")})`;
}

/**
 * Build the cost-preview (`INFO_`) call for an entrypoint.
 *
 * The preview lives on a DIFFERENT module by design, and assuming otherwise is how a consumer
 * ended up calling INFO-ZERO for previews that had moved to INFO-ONE. The pairing is recorded,
 * not guessed.
 */
export function buildPreviewCall(
  key: string,
  args: Record<string, unknown>,
  opts: BuildOptions = {},
): string {
  const ep = getEntrypoint(key);
  if (!ep.preview) {
    throw new RegistryError(
      `"${key}" has no cost preview. ${ep.previewMissing ?? ""}`.trim(),
    );
  }
  const pv = registry.previews[ep.preview]!;
  const declared = pv.params.map(p => p.name);
  const missing = declared.filter(n => !(n in args));
  if (missing.length) {
    throw new RegistryError(
      `Preview ${ep.preview} is missing: ${missing.join(", ")}\n` +
        `  declared: (${pv.params.map(p => `${p.name}:${p.type}`).join(" ")})\n` +
        `  note: a preview's parameters are NOT always the entrypoint's -- it may omit a ` +
        `ceiling the user chooses, or name the same slot differently.`,
    );
  }
  const ns = opts.namespace ?? namespace;
  const rendered = pv.params.map(p => formatForType(args[p.name], p.type));
  return `(${ns}.${ep.preview} ${rendered.join(" ")})`;
}

/** Build the example call from the registry's ghost values. Illustrative, never submittable. */
export function buildGhostCall(key: string): { code: string; warning: string } {
  const ep: Entrypoint = getEntrypoint(key);
  const fed = new Set((ep.execution.fedParams ?? []).map(f => f.param));
  const args: Record<string, unknown> = {};
  for (const p of ep.params) {
    args[p.name] = fed.has(p.name)
      ? `<from ${(ep.execution.preflight ?? ["preflight"]).join(" / ")}>`
      : ep.ghost.args[p.name];
  }
  return {
    code: `(${namespace}.${key} ${ep.params
      .map(p => (fed.has(p.name) ? String(args[p.name]) : formatForType(args[p.name], p.type)))
      .join(" ")})`,
    warning: ep.ghost.warning,
  };
}
