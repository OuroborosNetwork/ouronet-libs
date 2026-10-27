import { getEntrypoint } from "./registry.js";
import { RegistryError } from "./registry.js";
import type { Entrypoint, Partition } from "./types.js";

/**
 * MAY THIS CALL BE SPLIT, AND ALONG WHAT? -- the registry's answer, with absence treated as "no".
 *
 * Two questions are deliberately kept apart. Whether a split is NEEDED is answered by SIMULATION
 * (gas is state-dependent and changes between blocks); whether a split is ALLOWED is answered
 * here (a property of the operation, fixed by its contract). Neither can answer the other's
 * question: a simulation cannot tell you that halving a liquidity deposit prices it differently,
 * and this field cannot tell you that today's 420 nonces bust the budget.
 */
export interface SplitPlan {
  key: string;
  /** null when the operation is UNCLASSIFIED -- no judgement has been recorded, so do not split */
  shape: Partition["shape"] | null;
  /** the list parameter that gets cut */
  axis: string | null;
  /** parameters positional against `axis`, cut with it */
  lockstep: string[];
  /**
   * The SECOND level, when the axis's companions are nested lists. `axis` here names an outer
   * parameter whose PER-ELEMENT array may be cut as well -- so a 100-token manifest with 1,000
   * recipients per token is 100,000 legs that can be cut to any transaction size, rather than
   * 100 indivisible lumps.
   */
  inner: { axis: string; lockstep: string[]; note: string } | null;
  /** total LEAF legs in a given argument set -- the unit gas is actually spent on */
  leaves: ((values: Readonly<Record<string, unknown>>) => number) | null;
  /** true only when a recorded judgement permits cutting */
  splittable: boolean;
  /** true when the pieces may be submitted TOGETHER. False for a reduction's rounds. */
  parallel: boolean;
  /** how the next round is formed. Reductions only. */
  rounds: string | null;
  /** the recorded human reading. Null when unclassified. */
  reason: string | null;
  warnings: string[];
}

/** The registry's split judgement for one entrypoint. Unclassified is a first-class answer. */
export function splitPlan(key: string): SplitPlan {
  const ep: Entrypoint = getEntrypoint(key);
  const p = ep.execution.partition;
  if (!p) {
    return {
      key, shape: null, axis: null, lockstep: [], inner: null, leaves: null,
      splittable: false, parallel: false, rounds: null, reason: null,
      warnings: [
        "UNCLASSIFIED. No split judgement is recorded for this entrypoint, so it must be sent " +
          "as ONE transaction. Absence is not permission: a wrong split turns an atomic " +
          "operation into a partially-applied one, and nothing downstream can detect that.",
      ],
    };
  }
  const warnings: string[] = [];
  if (p.shape === "reduction") {
    warnings.push(
      "REDUCTION, not a partition. Each batch produces a NEW intermediate that must be fed back " +
        "in, so one pass does NOT complete the operation. Parallel WITHIN a round, strictly " +
        "sequential BETWEEN rounds, and the next round's arguments do not exist until this one " +
        "lands on chain -- they cannot be armed in advance.",
    );
  }
  if (p.lockstep?.length) {
    warnings.push(
      `POSITIONAL COMPANIONS: ${p.lockstep.join(", ")}. These must be cut WITH '${p.axis}' and ` +
        "never sliced independently. Two arrays that line up by LENGTH and are misaligned move " +
        "the wrong amount to the wrong place, and the contract cannot object. Use splitCall().",
    );
  }
  const inner = p.inner
    ? { axis: p.inner.axis, lockstep: p.inner.lockstep ?? [], note: p.inner.note }
    : null;
  if (inner) {
    warnings.push(
      `TWO LEVELS. '${p.axis}' cuts the outer dimension; '${inner.axis}' cuts within one outer ` +
        "element. A manifest large in BOTH dimensions needs both, and splitting only the outer " +
        "one leaves a single oversized element that still will not fit. Use splitCallByCapacity.",
    );
  }
  return {
    key, shape: p.shape, axis: p.axis, lockstep: p.lockstep ?? [], inner,
    leaves: (vals) => countLeaves(p.axis, inner?.axis ?? null, vals),
    splittable: true, parallel: p.shape === "partition",
    rounds: p.rounds ?? null, reason: p.reason, warnings,
  };
}

/**
 * HOW MANY LEAF LEGS an argument set carries -- the unit gas is actually spent on.
 *
 * For a flat axis that is the axis length. For a nested one it is the sum of the per-element
 * array lengths, because a 2-token call whose tokens have 900 and 100 recipients is a
 * 1,000-leg transaction, not a 2-leg one. Sizing by the OUTER length is the mistake that makes
 * "split it in two" produce one transaction that still does not fit.
 */
function countLeaves(
  axis: string, innerAxis: string | null, values: Readonly<Record<string, unknown>>,
): number {
  const outer = values[axis];
  if (!Array.isArray(outer)) return 0;
  if (!innerAxis) return outer.length;
  const nested = values[innerAxis];
  if (!Array.isArray(nested)) return outer.length;
  return nested.reduce<number>(
    (a, v) => a + (Array.isArray(v) ? v.length : 1), 0);
}

/**
 * Split `items` into `parts` roughly-EQUAL slices -- `[1..10]` into 3 is `[4,3,3]`, never
 * `[4,4,2]` and never `[9,1]`. A near-empty final slice is a whole extra transaction, and its
 * fixed cost, for almost no work.
 */
function evenSlices<T>(items: readonly T[], parts: number): T[][] {
  const n = items.length;
  const k = Math.max(1, Math.min(parts, n || 1));
  if (n === 0) return [[]];
  const base = Math.floor(n / k);
  const extra = n % k;
  const out: T[][] = [];
  let i = 0;
  for (let b = 0; b < k; b++) {
    const size = base + (b < extra ? 1 : 0);
    out.push(items.slice(i, i + size) as T[]);
    i += size;
  }
  return out;
}

/**
 * CUT ONE CALL INTO `parts` ARGUMENT SETS, using the axis the registry declares.
 *
 * This exists because the alternative is what the consuming app actually did: four separate
 * components each hand-rolling the same cut with the parameter names written as string literals,
 * and a fifth call site (unstake) that had no cut at all because nobody noticed it was missing.
 * A splitter that reads the axis from the registry cannot name the wrong parameter, and cannot be
 * forgotten at a call site that never got one.
 *
 * IT REFUSES RATHER THAN GUESSES, in three cases:
 *   - the entrypoint is UNCLASSIFIED (no recorded judgement);
 *   - the axis value is not an array;
 *   - a lockstep companion's length does not equal the axis's.
 *
 * That third refusal is the one worth having. Mismatched lengths are a bug upstream, and the
 * tempting repair -- pad, or truncate to the shorter -- produces two arrays that line up by
 * length and are MISALIGNED, which moves a real quantity to the wrong place with no error at
 * all. Refusing is loud; repairing is silent and wrong.
 *
 * Every parameter that is not the axis or a companion is copied UNCHANGED into each slice.
 */
export function splitCall(
  key: string, values: Readonly<Record<string, unknown>>, parts: number,
): Record<string, unknown>[] {
  const plan = splitPlan(key);
  if (!plan.splittable || !plan.axis) {
    throw new RegistryError(
      `${key} carries no split judgement, so it cannot be cut. Send it as one transaction, or ` +
        `record a partition block in OURONET-REGISTRY.authored.json after reading the operation.`,
    );
  }
  const axisVal = values[plan.axis];
  if (!Array.isArray(axisVal)) {
    throw new RegistryError(
      `${key}: axis '${plan.axis}' must be an array to split on, got ` +
        `${JSON.stringify(axisVal)}`,
    );
  }
  for (const comp of plan.lockstep) {
    const v = values[comp];
    if (!Array.isArray(v)) {
      throw new RegistryError(
        `${key}: lockstep companion '${comp}' must be an array, got ${JSON.stringify(v)}`,
      );
    }
    if (v.length !== axisVal.length) {
      throw new RegistryError(
        `${key}: '${comp}' has ${v.length} entries against ${axisVal.length} in '${plan.axis}'. ` +
          `These are POSITIONAL; a mismatch is a bug upstream and must not be padded or ` +
          `truncated, because the result would line up by length and be misaligned.`,
      );
    }
  }
  if (!Number.isInteger(parts) || parts < 1) {
    throw new RegistryError(`${key}: parts must be a positive integer, got ${parts}`);
  }

  const axisSlices = evenSlices(axisVal, parts);
  // Companions are cut by the SAME slice boundaries, derived once, so they cannot drift from the
  // axis even by one element.
  const bounds: Array<[number, number]> = [];
  let at = 0;
  for (const sl of axisSlices) { bounds.push([at, at + sl.length]); at += sl.length; }

  return axisSlices.map((slice, i) => {
    const from = bounds[i]![0];
    const to = bounds[i]![1];
    const out: Record<string, unknown> = { ...values, [plan.axis!]: slice };
    for (const comp of plan.lockstep) {
      out[comp] = (values[comp] as unknown[]).slice(from, to);
    }
    return out;
  });
}

/**
 * CUT ONE CALL INTO AS MANY TRANSACTIONS AS IT TAKES, given how many LEAF LEGS one transaction
 * can carry. This is the function a manifest needs.
 *
 * Owner, 2026-10-27: "if i add a manifest for 100 tokens, each with 1000+ recipients, the UI
 * should be able to create as many individual txes as needed to accommodate whatever big the list
 * is." That is 100,000 legs, and it is not reachable by cutting one dimension: `splitCall` on the
 * token axis produces 100 single-token calls of 1,000 legs each, every one of which is still far
 * too large. Both levels are required, and the unit has to be the LEAF -- a 2-token call whose
 * tokens hold 900 and 100 recipients is a 1,000-leg transaction, not a 2-leg one.
 *
 * THE PACK IS GREEDY AND IN ORDER, which is the right trade here rather than a lazy one:
 *   - whole outer elements accumulate while the running leaf total fits;
 *   - an element that does not fit on its own is emitted ALONE, with its inner arrays cut into
 *     `ceil(legs / capacity)` even pieces.
 * Order is preserved throughout, so the concatenation of every emitted call reproduces the
 * original manifest exactly -- which is the property that makes the result auditable against what
 * the user actually submitted. An optimal bin-pack would shave the occasional transaction and
 * would reorder legs to do it; for a transfer manifest, being able to read the plan back against
 * the input is worth more than one fewer transaction.
 *
 * `capacity` comes from MEASUREMENT, never from here. It is whatever a probe established a
 * transaction of this operation can carry, which is state-dependent and not a property of the
 * registry. This function only honours it.
 */
export function splitCallByCapacity(
  key: string, values: Readonly<Record<string, unknown>>, capacity: number,
): Record<string, unknown>[] {
  const plan = splitPlan(key);
  if (!plan.splittable || !plan.axis) {
    throw new RegistryError(
      `${key} carries no split judgement, so it cannot be cut. Send it as one transaction, or ` +
        `record a partition block in OURONET-REGISTRY.authored.json after reading the operation.`,
    );
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RegistryError(`${key}: capacity must be a positive integer, got ${capacity}`);
  }
  const outer = values[plan.axis];
  if (!Array.isArray(outer)) {
    throw new RegistryError(
      `${key}: axis '${plan.axis}' must be an array to split on, got ${JSON.stringify(outer)}`);
  }

  // Flat axis: one leaf per element, so this is the one-dimensional case and `splitCall` already
  // holds the companion-length checks. `ceil(n / capacity)` parts give slices of at most
  // `capacity` each, because evenSlices balances rather than filling.
  if (!plan.inner) {
    if (outer.length === 0) return [{ ...values }];
    return splitCall(key, values, Math.ceil(outer.length / capacity));
  }

  const innerAxis = plan.inner.axis;
  const innerCos = plan.inner.lockstep;
  const nested = values[innerAxis];
  if (!Array.isArray(nested) || nested.length !== outer.length) {
    throw new RegistryError(
      `${key}: inner axis '${innerAxis}' must be an array of the same length as '${plan.axis}' ` +
        `(${outer.length}), got ${Array.isArray(nested) ? nested.length : typeof nested}`);
  }
  // Every inner companion must agree element-for-element with the inner axis, or a cut would
  // misalign a quantity against the nonce or recipient it belongs to -- silently.
  for (const comp of innerCos) {
    const c = values[comp];
    if (!Array.isArray(c) || c.length !== outer.length) {
      throw new RegistryError(
        `${key}: inner companion '${comp}' must be an array of length ${outer.length}`);
    }
    for (let i = 0; i < outer.length; i++) {
      const a = nested[i], b = c[i];
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        throw new RegistryError(
          `${key}: '${comp}'[${i}] has ${Array.isArray(b) ? b.length : typeof b} entries ` +
            `against ${Array.isArray(a) ? a.length : typeof a} in '${innerAxis}'[${i}]. These ` +
            `are POSITIONAL; a mismatch must not be padded or truncated, because the result ` +
            `would line up by length and be misaligned.`);
      }
    }
  }

  /** One call carrying the outer elements `[from, to)`, unchanged. */
  const groupOf = (from: number, to: number) => splitSlice(values, plan, from, to);

  const out: Record<string, unknown>[] = [];
  let start = 0;
  let running = 0;
  for (let i = 0; i < outer.length; i++) {
    const legs = (nested[i] as unknown[]).length;
    if (legs > capacity) {
      // This element alone is too big. Flush whatever was accumulating, then cut it internally.
      if (i > start) out.push(groupOf(start, i));
      const parts = Math.ceil(legs / capacity);
      const single = groupOf(i, i + 1);
      for (const piece of cutInner(single, innerAxis, innerCos, parts)) out.push(piece);
      start = i + 1;
      running = 0;
      continue;
    }
    if (running + legs > capacity && i > start) {
      out.push(groupOf(start, i));
      start = i;
      running = 0;
    }
    running += legs;
  }
  if (start < outer.length) out.push(groupOf(start, outer.length));
  return out.length ? out : [{ ...values }];
}

/** Outer slice `[from, to)` of `values`, cutting the axis and every outer companion together. */
function splitSlice(
  values: Readonly<Record<string, unknown>>, plan: SplitPlan, from: number, to: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...values, [plan.axis!]: (values[plan.axis!] as unknown[]).slice(from, to),
  };
  for (const comp of plan.lockstep) {
    const v = values[comp];
    if (Array.isArray(v)) out[comp] = v.slice(from, to);
  }
  return out;
}

/**
 * Cut a SINGLE-outer-element call's inner arrays into `parts`, keeping the outer shape intact --
 * each piece is still a one-element outer call, which is what the contract's signature requires.
 */
function cutInner(
  single: Record<string, unknown>, innerAxis: string, innerCos: readonly string[], parts: number,
): Record<string, unknown>[] {
  const leaf = (single[innerAxis] as unknown[][])[0] ?? [];
  const slices = evenSlices(leaf, parts);
  const bounds: Array<[number, number]> = [];
  let at = 0;
  for (const sl of slices) { bounds.push([at, at + sl.length]); at += sl.length; }
  return slices.map((sl, i) => {
    const from = bounds[i]![0];
    const to = bounds[i]![1];
    const piece: Record<string, unknown> = { ...single, [innerAxis]: [sl] };
    for (const comp of innerCos) {
      const arr = (single[comp] as unknown[][])[0] ?? [];
      piece[comp] = [arr.slice(from, to)];
    }
    return piece;
  });
}
