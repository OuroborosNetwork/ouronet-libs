/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE REGISTRY'S SPLIT JUDGEMENT — `execution.partition`, read defensively
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * LIFTED from `OuronetUI/src/lib/signing/useGasLockIn.ts` in v0.2.0. It is engine vocabulary —
 * *"how do this operation's pieces relate"* — and three modules in this package now read it, so
 * leaving the type in a host hook would have meant either importing a host from the package or
 * declaring the shape twice. The host re-exports these names so its own call sites are unchanged;
 * a re-export is one definition under two names, which is not what this package exists to end.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHY IT IS READ THROUGH A WIDENED TYPE
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * `execution.partition` ships in `@ouronet/talos-registry` 2.5.0. On an older snapshot every
 * entrypoint reads as unclassified — which is already the correct and SAFE reading, so this code
 * is inert-but-right against an old pin and switches on when the pin moves, with no code change.
 */
import { getEntrypoint, registry } from "@ouronet/talos-registry";

export interface PartitionMeta {
  /**
   * WHICH KIND OF SPLIT. Only `list` can be cut client-side; the other two are performed by
   * calling `via`. Owner ruling 2026-10-27, and the reason the kinds are not interchangeable:
   * a defpact's step count is FIXED by its definition while a list has no fixed length, so a
   * defpact can only carry a decomposition whose piece-count is intrinsic to the operation.
   * Routing a list workload through one caps it at the step count forever.
   */
  kind: "list" | "cursor" | "architectural";
  shape?: "partition" | "reduction";
  axis?: string;
  lockstep?: string[];
  inner?: { axis: string; lockstep?: string[]; note: string };
  rounds?: string;
  /** `cursor` / `architectural` — the entrypoint that carries the split */
  via?: string;
  /** `cursor` — the reads that report progress; drive the pager until they say done */
  progress?: string[];
  /** `architectural` — the twin's step count */
  steps?: number;
  reason: string;
}

/**
 * DOES THIS REGISTRY BUILD CARRY SPLIT JUDGEMENTS AT ALL?
 *
 * The two states must not be reported with the same words: *"no judgement exists for this
 * operation"* is a statement about the operation, while *"this build has no judgements"* is a
 * statement about the BUILD. Calling the second one a contract-level gap would send someone to
 * write a defpact twin for an op that is already classified upstream.
 *
 * NOT MEMOISED, deliberately. A module-level cache here would make one of the two branches
 * unreachable from a test depending on import order — the exact shape of an untestable guard. The
 * scan only happens on the REFUSAL path, over a few hundred entries, so there is nothing to save.
 */
export function registryCarriesPartitionData(): boolean {
  try {
    const eps = (registry as unknown as
      { entrypoints: Record<string, { execution?: { partition?: unknown } }> }).entrypoints;
    return Object.values(eps).some(e => !!e.execution?.partition);
  } catch {
    return false;
  }
}

/** The partition block for an entrypoint, or `null` — including for a key that does not exist. */
export function partitionOf(entrypoint: string): PartitionMeta | null {
  try {
    const ex = getEntrypoint(entrypoint).execution as unknown as
      { partition?: PartitionMeta };
    return ex.partition ?? null;
  } catch {
    return null;
  }
}

/** How many LEAF legs an argument set carries — the unit gas is actually spent on. */
export function leafCount(part: PartitionMeta, values: Record<string, unknown>): number {
  if (part.kind !== "list" || !part.axis) return 0;
  const outer = values[part.axis];
  if (!Array.isArray(outer)) return 0;
  if (!part.inner) return outer.length;
  const nested = values[part.inner.axis];
  if (!Array.isArray(nested)) return outer.length;
  // A 2-token call whose tokens hold 900 and 100 recipients is a 1,000-leg transaction, not a
  // 2-leg one. Sizing by the OUTER length is what makes "split it in two" produce a transaction
  // that still does not fit.
  return (nested as unknown[]).reduce<number>((a, v) => a + (Array.isArray(v) ? v.length : 1), 0);
}
