/**
 * CUTTING A FED SLICE — the registry's split judgement APPLIED, not merely available.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A FUNCTION AND NOT A FEW LINES AT EACH CALL SITE
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * A `kind: "list"` partition says which parameter is the slice (`axis`), which parameters are
 * POSITIONAL against it (`lockstep`), and — on three entrypoints — a boundary the cut may not
 * fall inside (`groupBy`). All three have to be honoured together, and each one failed alone is
 * a DIFFERENT silent defect:
 *
 *   axis alone        a wrong parameter is cut and the call sends the whole list N times
 *   lockstep missed   two arrays of equal length, misaligned — the wrong amount moves to the
 *                     wrong nonce, with no error anywhere
 *   groupBy ignored   the cut falls mid-group and an UNGATED per-group write runs once per
 *                     SLICE instead of once per group
 *
 * None of those three fails loudly. That is why the judgement does not get re-derived per
 * consumer: a splitter is four lines and all four lines are easy to get subtly wrong.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * REFUSAL IS A RESULT, NOT AN EXCEPTION
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * The registry's default is **absence means DO NOT SPLIT**, so every reason a split cannot
 * happen is returned with a sentence rather than thrown or silently coerced into one slice. A
 * caller that gets `ok: false` has something to show a user; a caller that gets a single slice
 * back from an unclassified operation has been told it may fan out when it may not.
 */
import type { PartitionMeta } from "./partition.js";
import { evenSplit } from "./batch.js";

/** One transaction's worth of arguments, plus how many axis entries it carries. */
export interface FedSlice {
  args: Record<string, unknown>;
  /** Axis entries in this slice — what a per-leg cost estimate multiplies. */
  legCount: number;
}

export type SliceOutcome =
  | {
      ok: true;
      slices: FedSlice[];
      /**
       * The number of indivisible UNITS the cut was made over: axis entries normally, or
       * `groupBy` groups when one is declared. It bounds `slices.length`, and a caller that asked
       * for more than this got fewer — which is a fact worth rendering, not a rounding detail.
       */
      units: number;
      /** `true` when `slices.length < requested`, because `units` ran out. */
      clamped: boolean;
    }
  | { ok: false; reason: string };

/**
 * Cut `args` into at most `requested` slices, honouring the whole partition block.
 *
 * `args` is the FULL argument map for one call — the same map `buildCall` would receive. Every
 * parameter that is not the axis or a lockstep member is COPIED UNCHANGED into every slice,
 * which is what makes `patron`, `pool-id` and the asset id ride along without being named here.
 */
export function sliceFedArgs(
  meta: PartitionMeta | null | undefined,
  args: Record<string, unknown>,
  requested: number,
): SliceOutcome {
  if (!meta)
    return { ok: false, reason:
      "This operation carries no split judgement, and absence means DO NOT SPLIT — send one " +
      "transaction or refuse. An unclassified operation is not an unsplittable one; the " +
      "difference is recorded by saying nothing rather than by claiming either." };

  if (meta.kind !== "list")
    return { ok: false, reason:
      meta.kind === "cursor"
        ? `This split is a CURSOR PAGER, not a fed slice: the list lives in chain state and this ` +
          `entrypoint takes none. Drive \`${meta.via ?? "its pager"}\` repeatedly, STRICTLY in ` +
          `sequence, until its progress read says done — firing those at once races the stored ` +
          `cursor.`
        : `This split is ARCHITECTURAL: the decomposition is a fixed number of ORDERED PHASES, ` +
          `each depending on what the last left behind, and it is performed by calling ` +
          `\`${meta.via ?? "its defpact twin"}\` rather than by cutting an argument.` };

  if (meta.shape === "reduction")
    return { ok: false, reason:
      "This split is a REDUCTION, not a partition: each piece produces a NEW intermediate that " +
      "must be fed back in, so the next round's arguments do not exist until this one lands on " +
      "chain. Parallel WITHIN a round, strictly sequential BETWEEN rounds — a one-shot fan-out " +
      "would send the second round's calls against values that are not there yet." };

  const axis = meta.axis;
  if (!axis)
    return { ok: false, reason:
      "The partition is list-shaped but names no `axis`, so there is nothing to say WHICH " +
      "parameter is the slice. Cutting a guessed one sends the whole list N times." };

  const axisVal = args[axis];
  if (!Array.isArray(axisVal))
    return { ok: false, reason: `The axis \`${axis}\` is not a list in these arguments ` +
      `(${describe(axisVal)}). Nothing can be cut.` };

  const n = axisVal.length;
  if (n === 0)
    return { ok: false, reason: `The axis \`${axis}\` is empty — there is no work to slice, and ` +
      `a transaction that moves nothing is still billed.` };

  // LOCKSTEP LENGTHS ARE CHECKED BEFORE ANYTHING IS CUT. Two arrays that line up by length and
  // are misaligned move the wrong value to the wrong place with no error, so a mismatch has to
  // be a refusal here rather than a slice that happens to look well-formed.
  const lock = meta.lockstep ?? [];
  for (const name of lock) {
    const v = args[name];
    if (!Array.isArray(v))
      return { ok: false, reason: `\`${name}\` is declared POSITIONAL against \`${axis}\` but is ` +
        `not a list here (${describe(v)}).` };
    if (v.length !== n)
      return { ok: false, reason: `\`${name}\` has ${v.length} entr${v.length === 1 ? "y" : "ies"} ` +
        `against \`${axis}\`'s ${n}. They are positional, so a cut would pair the wrong values — ` +
        `and nothing downstream could detect it.` };
  }

  // THE GROUPS. With no `groupBy` each axis entry is its own unit, which is the ordinary case and
  // is why this is not two code paths.
  let units: number[][];
  if (meta.groupBy) {
    const gv = args[meta.groupBy];
    if (!Array.isArray(gv))
      return { ok: false, reason: `\`${meta.groupBy}\` is the boundary a cut may not fall inside, ` +
        `but it is not a list here (${describe(gv)}).` };
    if (gv.length !== n)
      return { ok: false, reason: `\`${meta.groupBy}\` has ${gv.length} entries against ` +
        `\`${axis}\`'s ${n}; it must be positional to group by.` };
    // GROUPED BY VALUE, NOT BY ADJACENCY. A preflight is free to interleave two beneficiaries'
    // legs, and grouping contiguous runs would then split one of them across slices while
    // looking like it had grouped.
    const by = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
      const k = String(gv[i]);
      const bucket = by.get(k);
      if (bucket) bucket.push(i); else by.set(k, [i]);
    }
    units = [...by.values()];
  } else {
    units = Array.from({ length: n }, (_, i) => [i]);
  }

  const want = Math.max(1, Math.floor(requested) || 1);
  const packed = evenSplit(units, want).filter(g => g.length > 0);
  const slices: FedSlice[] = packed.map(group => {
    // ASCENDING WITHIN A SLICE, for determinism rather than correctness: the arrays are
    // positional, so any permutation applied to ALL of them is equally valid, and a stable order
    // makes two runs over the same plan byte-identical.
    const idx = group.flat().sort((a, b) => a - b);
    const out: Record<string, unknown> = { ...args };
    out[axis] = idx.map(i => axisVal[i]);
    for (const name of lock) out[name] = idx.map(i => (args[name] as unknown[])[i]);
    return { args: out, legCount: idx.length };
  });

  return { ok: true, slices, units: units.length, clamped: slices.length < want };
}

function describe(v: unknown): string {
  if (v === undefined) return "absent";
  if (v === null) return "null";
  return `a ${typeof v}`;
}
