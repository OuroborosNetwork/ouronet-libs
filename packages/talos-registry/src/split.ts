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
  /**
   * WHICH KIND OF SPLIT, or null when UNCLASSIFIED. Read this before anything else: only `list`
   * can be cut client-side. `cursor` means driving a pager until it reports done; `architectural`
   * means running a defpact's ordered steps. Treating either of the latter as a list split would
   * slice an argument that does not exist, or cap an unbounded workload at a fixed step count.
   */
  kind: Partition["kind"] | null;
  /** `list` only */
  shape: Partition["shape"] | null;
  /** `cursor` / `architectural` -- the entrypoint that carries the split */
  via: string | null;
  /** `cursor` -- the reads that report progress; drive the pager until they say done */
  progress: string[];
  /**
   * `list` -- a parameter whose value must not be split across batches. Elements sharing a value
   * here stay in one transaction. Null when any cut position is allowed.
   */
  groupBy: string | null;
  /** `architectural` -- the twin's step count */
  steps: number | null;
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
  /**
   * TRUE ONLY FOR `kind: "list"` -- i.e. only when a client may cut an argument itself. A
   * `cursor` or `architectural` route is a real split and is NOT this: it is performed by
   * calling `via`, not by slicing. `splitCall` refuses anything but a list for that reason.
   */
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
      key, kind: null, shape: null, via: null, progress: [], steps: null, groupBy: null,
      axis: null, lockstep: [], inner: null, leaves: null,
      splittable: false, parallel: false, rounds: null, reason: null,
      warnings: [
        "UNCLASSIFIED. No split judgement is recorded for this entrypoint, so it must be sent " +
          "as ONE transaction. Absence is not permission: a wrong split turns an atomic " +
          "operation into a partially-applied one, and nothing downstream can detect that.",
      ],
    };
  }
  const warnings: string[] = [];

  // A CURSOR ROUTE IS NOT CUTTABLE. The entrypoint takes no list; the set it traverses lives in
  // chain state, so there is nothing here for a client to slice.
  if (p.kind === "cursor") {
    return {
      key, kind: "cursor", shape: null, via: p.via ?? null, progress: p.progress ?? [],
      steps: null, groupBy: null, axis: null, lockstep: [], inner: null, leaves: null,
      splittable: false, parallel: false, rounds: null, reason: p.reason,
      warnings: [
        `CURSOR ROUTE. This call takes no list -- the work it traverses lives in chain state, so ` +
          `there is nothing to cut. Drive '${p.via}' instead: it takes a chunk SIZE and advances ` +
          `stored progress, so the calls are STRICTLY ORDERED and firing two concurrently races ` +
          `the cursor. Repeat until ${(p.progress ?? []).join(" / ")} reports done.`,
      ],
    };
  }

  // AN ARCHITECTURAL ROUTE IS NOT CUTTABLE EITHER, and for a different reason: the decomposition
  // is into ordered phases intrinsic to the operation, carried by continuation state.
  if (p.kind === "architectural") {
    return {
      key, kind: "architectural", shape: null, via: p.via ?? null, progress: [],
      steps: p.steps ?? null, groupBy: null, axis: null, lockstep: [], inner: null, leaves: null,
      splittable: false, parallel: false, rounds: null, reason: p.reason,
      warnings: [
        `ARCHITECTURAL ROUTE. The split is into ${p.steps ?? "?"} ORDERED PHASES intrinsic to ` +
          `this operation, not into pieces of a list -- so it is a defpact, '${p.via}', and its ` +
          `steps advance by \`cont\` against the pact id step 0 returns. Use it ONLY when the ` +
          `single transaction is measured over the limit; it is the fallback, not the route.`,
      ],
    };
  }

  if (p.shape === "reduction") {
    warnings.push(
      "REDUCTION, not a partition. Each batch produces a NEW intermediate that must be fed back " +
        "in, so one pass does NOT complete the operation. Parallel WITHIN a round, strictly " +
        "sequential BETWEEN rounds, and the next round's arguments do not exist until this one " +
        "lands on chain -- they cannot be armed in advance.",
    );
  }
  if (p.groupBy) {
    warnings.push(
      `GROUP BOUNDARY on '${p.groupBy}'. Elements sharing a value there must stay in ONE ` +
        "transaction -- a cut inside a group is unsound, not merely suboptimal. " +
        "`splitCallByCapacity` honours it; a hand-rolled cut will not.",
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
  const axis = p.axis!;
  return {
    key, kind: "list", shape: p.shape ?? null, via: null, progress: [], steps: null,
    groupBy: p.groupBy ?? null, axis, lockstep: p.lockstep ?? [], inner,
    leaves: (vals) => countLeaves(axis, inner?.axis ?? null, vals),
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
 * WHY THIS CALL CANNOT BE CUT — distinct messages, because the three reasons need three actions.
 * Telling someone to "record a partition block" for a cursor route sends them to author metadata
 * for an argument that does not exist.
 */
function refusal(key: string, plan: SplitPlan): string {
  if (plan.kind === "cursor") {
    return `${key} is a CURSOR route and takes no list to cut. Drive '${plan.via}' until ` +
      `${plan.progress.join(" / ")} reports done -- strictly one at a time, since two race the ` +
      `stored cursor.`;
  }
  if (plan.kind === "architectural") {
    return `${key} is an ARCHITECTURAL route: its split is ${plan.steps} ordered phases, not ` +
      `pieces of a list. Run the defpact '${plan.via}' instead, advancing its steps by \`cont\` ` +
      `against the pact id step 0 returns.`;
  }
  return `${key} carries no split judgement, so it cannot be cut. Send it as one transaction, ` +
    `or record a partition block in OURONET-REGISTRY.authored.json after reading the operation.`;
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
    throw new RegistryError(refusal(key, plan));
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
    throw new RegistryError(refusal(key, plan));
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
    if (!plan.groupBy) return splitCall(key, values, Math.ceil(outer.length / capacity));
    // A GROUP BOUNDARY overrides the even split: a balanced cut would happily fall inside a
    // group, which for the vacate slices is the one position that is unsound rather than merely
    // suboptimal. So pack by group, and let a batch run over capacity only when a SINGLE group
    // exceeds it -- splitting that group would be worse than one oversized transaction, and the
    // caller's own probe will refuse it loudly.
    return packByGroup(values, plan, outer.length, capacity, g => g.length);
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

  if (plan.groupBy) {
    // Same rule in two dimensions: never cut inside a group, and size groups by LEAF count.
    return packByGroup(values, plan, outer.length, capacity,
                       (g) => g.reduce((a, i) => a + (nested[i] as unknown[]).length, 0));
  }

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

/**
 * PACK WHOLE GROUPS, NEVER CUTTING INSIDE ONE.
 *
 * `groupBy` names a key whose elements must share a transaction. Contiguity is NOT assumed -- the
 * same value may appear at non-adjacent indices, and a preflight is under no obligation to sort --
 * so groups are collected by value and emitted as index sets. That means a batch's indices need
 * not be a contiguous range, which is why this builds each call from an explicit index list
 * rather than a `[from, to)` slice.
 *
 * ORDER WITHIN A GROUP IS PRESERVED, and groups are emitted in order of first appearance, so the
 * result is still readable back against the input even though it is no longer a straight
 * partition of ranges.
 *
 * A SINGLE GROUP OVER CAPACITY IS EMITTED ALONE AND OVERSIZED, deliberately -- and it falls out
 * of the ordinary rule rather than needing a branch. Splitting it is the one thing the
 * declaration forbids, and an over-capacity transaction fails loudly at simulation while a cut
 * inside a group fails silently and wrongly.
 */
function packByGroup(
  values: Readonly<Record<string, unknown>>, plan: SplitPlan, n: number, capacity: number,
  weigh: (indices: number[]) => number,
): Record<string, unknown>[] {
  const keyArr = values[plan.groupBy!];
  if (!Array.isArray(keyArr) || keyArr.length !== n) {
    throw new RegistryError(
      `${plan.key}: groupBy '${plan.groupBy}' must be an array of length ${n}, got ` +
        `${Array.isArray(keyArr) ? keyArr.length : typeof keyArr}`);
  }
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const g = JSON.stringify(keyArr[i]);
    const at = groups.get(g);
    if (at) at.push(i); else groups.set(g, [i]);
  }
  const out: Record<string, unknown>[] = [];
  let bucket: number[] = [];
  let running = 0;
  for (const idx of groups.values()) {
    const w = weigh(idx);
    // NO SPECIAL CASE FOR AN OVERSIZED GROUP, and the absence is deliberate. One was written
    // here -- flush, then emit the group alone -- and mutation testing showed deleting it
    // changed no outcome, because the ordinary rule already produces exactly that: a group
    // heavier than `capacity` overflows whatever is accumulating, flushes it, then overflows
    // again on the next group and is emitted on its own. A branch that cannot change a result
    // is not a guard, it is something a later reader has to verify and will believe.
    if (running + w > capacity && bucket.length) {
      out.push(pickIndices(values, plan, bucket)); bucket = []; running = 0;
    }
    bucket = bucket.concat(idx);
    running += w;
  }
  if (bucket.length) out.push(pickIndices(values, plan, bucket));
  return out.length ? out : [{ ...values }];
}

/** One call carrying exactly the outer elements at `indices`, axis and companions together. */
function pickIndices(
  values: Readonly<Record<string, unknown>>, plan: SplitPlan, indices: readonly number[],
): Record<string, unknown> {
  const pick = (arr: unknown[]) => indices.map(i => arr[i]);
  const out: Record<string, unknown> = {
    ...values, [plan.axis!]: pick(values[plan.axis!] as unknown[]),
  };
  for (const comp of plan.lockstep) {
    const v = values[comp];
    if (Array.isArray(v)) out[comp] = pick(v);
  }
  return out;
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
