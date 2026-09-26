import data from "./data/registry.json" with { type: "json" };
import type { Entrypoint, Preview, RegistryDoc } from "./types.js";

/** The bundled snapshot. Pinned at build time; never fetched at runtime. */
export const registry = data as unknown as RegistryDoc;

/** Identifies exactly which surface this build was compiled against. */
export const surfaceHash: string = registry.surfaceHash;
export const namespace: string = registry.namespace;

/** Thrown for every refusal in this package, so a consumer can catch one class. */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

/**
 * Look up an entrypoint by its FULL `MODULE.function` key.
 *
 * Throws on an unknown key rather than returning undefined, and the message lists near
 * matches -- because the failure this package exists to prevent is a name that no longer
 * resolves, and on chain that surfaces as a RESOLUTION error which `try` cannot catch and
 * consumers render as missing data.
 */
export function getEntrypoint(key: string): Entrypoint {
  const hit = registry.entrypoints[key];
  if (hit) return hit;
  const [, fn = key] = key.split(/\.(.*)/s);
  const near = Object.keys(registry.entrypoints).filter(k => k.endsWith("." + fn));
  throw new RegistryError(
    near.length
      ? `Unknown entrypoint "${key}". The same function exists on: ${near.join(", ")}. ` +
        `Entrypoints are addressed MODULE.function.`
      : `Unknown entrypoint "${key}". It is not in surface ${surfaceHash}; either the name is ` +
        `stale or the module is not deployed.`,
  );
}

export function tryGetEntrypoint(key: string): Entrypoint | undefined {
  return registry.entrypoints[key];
}

export function getPreview(key: string): Preview | undefined {
  return registry.previews[key];
}

export function entrypointKeys(): string[] {
  return Object.keys(registry.entrypoints);
}

export function modules(): string[] {
  return [...new Set(entrypointKeys().map(k => k.split(".", 1)[0]!))].sort();
}

export function entrypointsOfModule(module: string): string[] {
  return entrypointKeys().filter(k => k.startsWith(module + "."));
}

/**
 * Resolve a BARE function name to its full key.
 *
 * Refuses when the name is ambiguous instead of picking one. Four SWP liquidity names resolve
 * to two modules with IDENTICAL signatures and DIFFERENT execution modes -- one single
 * transaction, one defpact -- so guessing is silent in both directions: address the defpact
 * believing it direct and the operation sits half-finished; address the direct one believing
 * it a defpact and there is no pact for the continuation to continue.
 */
export function resolveByName(fn: string): string {
  const hits = entrypointKeys().filter(k => k.split(/\.(.*)/s)[1] === fn);
  if (hits.length === 1) return hits[0]!;
  if (hits.length === 0) throw new RegistryError(`No entrypoint named "${fn}".`);
  const detail = hits
    .map(k => `${k} (${registry.entrypoints[k]!.execution.mode})`)
    .join(", ");
  throw new RegistryError(
    `"${fn}" is ambiguous -- it resolves to ${hits.length} modules: ${detail}. ` +
      `Address it as MODULE.function.`,
  );
}
