/**
 * COLLECTABLE STAKE BATCH PLANNER — pure math, no chain/React dependency.
 *
 * WHY THIS EXISTS. Reported live: staking 162 BloodshedMinter NFTs in one `CC_
 * StakeNonFungibleCollectable` call failed with `Gas limit "500000" exceeded: 500008`.
 * `CodexSigningStrategy.execute` (the signing pipeline EVERY CFM modal in this app goes
 * through, including the "ZBOM" staking modal) always SIMULATED the candidate transaction
 * with a HARDCODED 500,000 gas-limit probe before calibrating the real one — even though
 * every node this chain runs actually allows up to `GAS_LIMIT_MAX` (2,000,000,
 * `@stoachain/stoa-core/gas`), and the CALIBRATION step itself was already correctly
 * node-aware (`calculateAutoGasLimit` clamps to `getActiveGasLimit()`). Only the PROBE was
 * pinned low.
 *
 * THE ROOT CAUSE IS NOW ACTUALLY FIXED, not routed around. Owner, 2026-10-24: "any zbom has
 * to construct transactions that can be executed up to the allowed gas limit... a zbom
 * canceling a transaction of 700k is plain wrong and needs fixing." `500000` is not
 * configurable from `CodexSigningStrategy.execute`'s own surface (no constructor option, no
 * per-call parameter, no config field — confirmed by reading the whole method), but the
 * `build` closure that turns a `{gasLimit, ...}` ctx into a transaction is supplied BY THE
 * CALLER, and the strategy never validates that `build` actually used the suggested
 * `gasLimit`. So `useCFMStrategy.ts` (the ONE hook all ~44 CFM modals share to reach
 * `CodexSigningStrategy`) now intercepts exactly the probe-shaped call (`gasLimit ===
 * 500_000`) and raises it to the live node ceiling — see that file's own doc,
 * `wrapBuildPastProbeCeiling`, for the fix itself. This file no longer routes around a wall
 * that is still there; the wall moved.
 *
 * TWO WRONG TURNS ON THE WAY HERE, both worth recording so they don't repeat.
 *
 * Wrong turn #1: reimplementing `CodexSigningStrategy.execute`'s whole job by hand (build,
 * simulate, calibrate, resolve keys, sign, submit) to target the real 2,000,000 ceiling.
 * Passed the full gate, broke on first live use ("Keyset failure (keys-all): ...") because
 * the hand-rolled signer construction did not reproduce the real guard-analysis logic.
 * Lesson, confirmed again by the actual fix above: the right place to raise a ceiling is
 * never "stop using the trusted pipeline" — it's "find where THAT pipeline already lets a
 * caller influence the number," which here turned out to be `build`.
 *
 * Wrong turn #2: believing the 500,000 probe could only be WORKED AROUND via client-side
 * batching (splitting below ~420,000, a safety margin under 500,000), because the probe
 * looked like an unconfigurable constant with "no override" at every call site that USES
 * `CodexSigningStrategy`. It genuinely has no override at the CALL site — the override had
 * to be made at the one place between every caller and the strategy: the shared hook.
 *
 * WHAT THIS FILE STILL DOES, now that the real wall is gone up to ~2,000,000: splitting is
 * no longer the common case, but a SELECTION LARGE ENOUGH TO GENUINELY EXCEED THE CHAIN'S
 * OWN PER-TRANSACTION CEILING still needs it — `safeBatchGasCeiling()` tracks the SAME live
 * `getActiveGasLimit()` the real signing path now uses (with the same 100,000 buffer owner
 * specified: "batch the transaction only when simulation gets above 1.9 mil (100k buffer or
 * so)"), and `planStakeBatches` splits only when the REAL, measured cost exceeds it.
 *
 * THE SPLIT POINT IS MEASURED THE SAME WAY THE REAL SUBMISSION MEASURES IT — full selection,
 * not a sample, and the comparison is against the CALIBRATED ceiling (`calculateAutoGasLimit`
 * applied to the raw simulated gas), not the raw number. A sample-based version of this file
 * extrapolated a per-nonce rate from a small, fixed-size slice and badly underestimated a
 * real case: 187 nonces sampled at ~3,086/nonce predicted ~577,170 total; the REAL transaction
 * (explorer-confirmed, 2026-10-24) used 1,099,069 gas and calibrated to a 1,173,849 limit — per-
 * nonce cost is NOT uniform enough across a selection for a small sample to extrapolate safely.
 * Owner: "We gotta use the same simulation we have for pact code, which simulates, use the
 * algorithm to compute the ceiling etc. if that ceiling... is above 1.9 mil, THEN parallelise."
 * So `BatchedCollectableStakeFlow.tsx` now probes the FULL selection at `liveProbeCeiling()`
 * (`@/lib/signing/useCFMStrategy`, the SAME function the real signing path's own probe uses —
 * one source of truth, not two formulas that could drift), then runs the result through
 * `calculateAutoGasLimit` (`@stoachain/stoa-core/gas`, the SAME calibration function the real
 * submission already trusts) before comparing to `safeBatchGasCeiling()` here.
 */

import { getActiveGasLimit } from "@stoachain/stoa-core/network";
import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";

/**
 * THE PER-BATCH TARGET — the live, active-node gas ceiling (`getActiveGasLimit()`, the SAME
 * source `calculateAutoGasLimit` and `useCFMStrategy.ts`'s probe-ceiling fix both already
 * trust; 2,000,000 for the two known hosts), minus a safety buffer. Owner, with the exact
 * number: "would batch the transaction only when simulation gets above 1.9 mil (100k buffer
 * or so)." A function, not a constant, because the ceiling itself can change live (node
 * failover) and this must always compare against whatever that current value actually is —
 * the real submission path (via `useCFMStrategy.ts`'s probe-ceiling fix) tracks the exact
 * same number, so a selection this planner calls "safe for one transaction" really is.
 */
/**
 * WHAT A PROBE SHOULD DECLARE — the node's own maximum, not the split threshold.
 *
 * These were the same number, and that cost real information. A probe declaring exactly the
 * threshold it is testing against REFUSES for anything over it, and a refusal reports only the
 * gas at which execution stopped: the declared limit itself. So `floor / ceiling` is always about
 * 1, carries no magnitude, and a batch costing between the threshold and the node maximum came
 * back as a useless bound instead of an exact reading.
 *
 * Declaring higher costs nothing — a `/local` probe signs nothing and sends nothing — and turns
 * those refusals into measurements, which are the best-conditioned points a cost model can have.
 * Pinned by a test: on a 420-item case it is the difference between an optimal 3-transaction plan
 * and a 105-transaction one, for the same three probes.
 */
export function nodeProbeCeiling(): number {
  return getActiveGasLimit();
}

export function safeBatchGasCeiling(): number {
  return getActiveGasLimit() - 100_000;
}

/**
 * BELOW THIS, DON'T EVEN BOTHER PROBING. A cheap, conservative pre-filter using the WORST
 * real measurement on record (162 NFTs ≈ 500,008 gas ⇒ ~3,088 gas/nonce) — any selection at
 * or under this count is near-certain to fit in one transaction even for an unusually
 * expensive collection, so the common case (a handful of NFTs) pays no extra round-trip at
 * all and goes straight through the existing single-transaction flow.
 */
export const QUICK_PREFILTER_NONCE_COUNT = 100;

/**
 * GENERIC OVER `T` -- CANONIZED, not nonce-specific, even though the name and the
 * `perNonceGas` field predate the second use case. Owner, 2026-10-23, on why this needed to
 * wait for a second real operation rather than being speculatively generalized up front:
 * "we'll know when we implement those other operations." That operation is now
 * `CC_UnstaleMyScores` (an `fvt-ids:[string]` list, not a nonce list) — see
 * `BatchedUnstaleFlow.tsx`. `T` defaults to `number` so every EXISTING call site (which never
 * wrote `StakeBatchPlan<number>` explicitly) keeps resolving to exactly the same type it
 * always did; nothing about the staking path changed. `perNonceGas` keeps its name rather
 * than being renamed to something item-neutral, specifically to avoid touching every existing
 * call site and test for a cosmetic rename with no behavioural difference — read it as
 * "per-item" wherever `T` is not a nonce.
 */
export interface StakeBatchPlan<T = number> {
  /** Non-overlapping, in-selection-order slices of the original selection — concatenating
   *  them reproduces the original selection exactly. */
  batches: T[][];
  /**
   * The MEASURED gas of the LARGEST BATCH in `batches` — not a total, and not an extrapolation.
   *
   * RENAMED 2026-10-27, from `probedTotalGas`, because the name outlived its meaning and a
   * reader believed it. It originally held the calibrated ceiling for the WHOLE selection in one
   * call; when the flows migrated to `planBatchesVerified` they began setting it from
   * `VerifiedBatchPlan.worstBatchGas`, and the old name went on claiming "total". The visible
   * result was a Z-bom line reading "the calibrated gas ceiling for all 420 nonces (~1,243,562)
   * exceeds the 1,900,000-gas safety margin" — a 210-nonce figure attributed to 420, in a
   * sentence whose arithmetic reads as false to anyone who checks. A number with a wrong label
   * is worse than no number, because it gets quoted.
   */
  worstBatchGas: number;
  /** `worstBatchGas / items.length` — the measured, operation-specific marginal cost. */
  perNonceGas: number;
}

/**
 * Split `items` into `count` roughly-EQUAL chunks (not `count - 1` full-size chunks plus
 * one small remainder) — `evenSplit([1..162], 2)` is `[81, 81]`, never `[136, 26]`. A
 * near-empty last batch is a worse user experience (one more signature for almost nothing)
 * than two balanced ones for the same total transaction count.
 */
export function evenSplit<T>(items: readonly T[], count: number): T[][] {
  const n = items.length;
  const batches = Math.max(1, Math.min(count, n || 1));
  if (n === 0) return [[]];
  const base = Math.floor(n / batches);
  const extra = n % batches; // the first `extra` batches absorb one extra item each
  const out: T[][] = [];
  let i = 0;
  for (let b = 0; b < batches; b++) {
    const size = base + (b < extra ? 1 : 0);
    out.push(items.slice(i, i + size) as T[]);
    i += size;
  }
  return out;
}

/**
 * Plan how to split `nonces` into gas-safe batches, given the REAL, calibrated gas ceiling
 * for staking all of them in one call (`worstBatchGas` -- see `StakeBatchPlan`'s own doc;
 * this is `calculateAutoGasLimit(simulatedGas)`, not the raw simulated number -- computed by
 * `BatchedCollectableStakeFlow.tsx` the SAME way the real submission would).
 *
 * Linear in nonce count: splits only when the calibrated ceiling exceeds `safeBatchGasCeiling()`,
 * and otherwise returns the WHOLE selection as a single batch — now the overwhelming common
 * case, since the real per-transaction ceiling this compares against is ~1.9M, not ~420k.
 */
export function planStakeBatches<T>(
  nonces: readonly T[],
  worstBatchGas: number,
  safeCeiling: number = safeBatchGasCeiling(),
): StakeBatchPlan<T> {
  const n = nonces.length;
  if (n === 0) return { batches: [[]], worstBatchGas, perNonceGas: 0 };
  const perNonceGas = worstBatchGas / n;
  if (worstBatchGas <= safeCeiling || perNonceGas <= 0) {
    return { batches: [[...nonces]], worstBatchGas, perNonceGas };
  }
  // CORRECTED 2026-10-27. This comment used to claim "at least this many batches are needed for
  // EVERY batch's own measured cost to fit under the ceiling". THAT IS FALSE whenever a
  // transaction carries a FIXED cost, which every op here does: each call re-runs its settle
  // bundle, its anchor legs, its score delta and its checkpoint regardless of how many items it
  // carries. The real curve is `gas = F + c x N`, so splitting k ways costs k x F, and dividing
  // the TOTAL by the ceiling systematically UNDER-splits.
  //
  // Worked, with real magnitudes: probe says 3.6M for 420 items, ceiling 1.9M, so this returns 2
  // batches of 210. If F = 0.4M then c = 7,619 and each half really costs 0.4M + 1.6M = 2.0M --
  // BOTH HALVES FAIL. The break-even is F > 200k for that shape, and an AQP inject was measured
  // on chain at 257k, so this is a reachable case and not a theoretical one.
  //
  // It is kept, with its math unchanged, as the SYNCHRONOUS ESTIMATOR -- four call sites and
  // their tests depend on it and it is still the right first guess. What it is not is a
  // guarantee. `planBatchesVerified` below is the one that can promise every batch fits,
  // because it MEASURES each one instead of dividing.
  const minBatches = Math.ceil(worstBatchGas / safeCeiling);
  return { batches: evenSplit(nonces, minBatches), worstBatchGas, perNonceGas };
}

/**
 * THE WORST REAL CALIBRATED RATE ON RECORD -- 187 BloodshedMinter nonces, explorer-confirmed
 * 2026-10-24: calibrated to a 1,173,849 gas limit, ~6,277/nonce. Used ONLY as a conservative
 * fallback basis (see `planFromExceededProbe`) when a probe fails with "gas limit exceeded"
 * but the reported floor would understate the true cost for a selection far past the ceiling
 * -- deliberately generous (erring toward MORE splitting, never less), since the alternative
 * (not splitting a selection already PROVEN too large for one transaction) is the exact bug
 * this exists to prevent.
 */
export const WORST_KNOWN_CALIBRATED_PER_NONCE = 1_173_849 / 187;

/** True for exactly the failure shape `CodexSigningStrategy`'s own probe produces when a
 *  transaction needs more gas than it declared -- mirrors `@stoachain/stoa-core/dist/errors
 *  /transactionErrors.js`'s own `createSimulationError` detection exactly, so this agrees
 *  with the vendored package's own classification of the same message. */
export function isGasLimitExceededMessage(message: string): boolean {
  return message.includes("Gas limit") && message.includes("exceeded");
}

/**
 * Interpret a "gas limit exceeded" PROBE failure (see `isGasLimitExceededMessage`) as PROOF a
 * split is needed, and compute the plan from it -- rather than the old behaviour of treating
 * every probe failure the same way ("proceed with one transaction"), which is backwards for
 * this specific failure: the refusal IS the evidence, not an unknown. Reported live,
 * 2026-10-25: staking 420 Nosferatu nonces hit exactly this failure every time (the real cost
 * is well over what `liveProbeCeiling()` -- `@/lib/signing/useCFMStrategy` -- itself declares
 * for the measurement), and the old code silently proceeded with all 420 as one transaction.
 *
 * `message`'s own reported number (`"...exceeded: N"`, parsed the same way
 * `@stoachain/stoa-core`'s own `createSimulationError` does) is a FLOOR, not a total --
 * execution stopped the instant it hit the probe's declared ceiling, so for a selection whose
 * true cost is far beyond that ceiling, the reported number understates it. Taking the MAX
 * against `WORST_KNOWN_CALIBRATED_PER_NONCE × nonces.length` (which scales with selection
 * size, uncapped) keeps the plan safe either way.
 */
export function planFromExceededProbe<T>(
  nonces: readonly T[], message: string,
): StakeBatchPlan<T> {
  const gasMatch = message.match(/exceeded:\s*(\d+)/);
  const reportedGas = gasMatch ? Number(gasMatch[1]) : NaN;
  const fromReport = Number.isFinite(reportedGas) && reportedGas > 0
    ? calculateAutoGasLimit(reportedGas) : 0;
  const fromRate = nonces.length * WORST_KNOWN_CALIBRATED_PER_NONCE;
  return planStakeBatches(nonces, Math.max(fromReport, fromRate));
}


/**
 * A PARALLEL, PER-NONCE ARGUMENT, RE-DERIVED FOR ONE BATCH.
 *
 * WHY THIS IS A FUNCTION AND NOT A `slice`. `nonce-amounts` is POSITIONAL against `nonces`:
 * `nonces[i]` is withdrawn in the quantity `nonce-amounts[i]`. When a selection is split, a batch
 * that carries the FULL amounts array is wrong, and the frightening failure is not the length
 * mismatch the contract would reject — it is the case where the two arrays happen to line up by
 * length and are silently MISALIGNED, withdrawing the wrong quantity from the wrong nonce. No
 * error, no refusal, just the wrong NFTs leaving the pool.
 *
 * So the batch's array is rebuilt FROM THAT BATCH'S OWN NONCES through a nonce-keyed map, never
 * sliced by index. That makes it immune to the batcher reordering or de-duplicating anything,
 * which `planStakeBatches` does not do today and would not have to announce if it ever did.
 *
 * A NONCE WITH NO ENTRY IS LEFT OUT rather than defaulted. A missing amount is a bug upstream,
 * and a zero would be a quantity nobody asked for; omitting it makes the arrays disagree in
 * length, which the contract refuses — a loud failure instead of a silent withdrawal.
 */
export function perBatchPerNonce<T>(
  batchNonces: readonly number[], byNonce: Readonly<Record<number, T>>,
): T[] {
  /**
   * `flatMap` RATHER THAN `filter().map()`, and not for style: under
   * `noUncheckedIndexedAccess` the two-pass form cannot be proven — TypeScript has no way to
   * know the `filter` guarantees the `map`'s lookup. `flatMap` narrows inside one pass, so the
   * returned array is `T[]` by construction rather than by assertion. Surfaced by moving this
   * file into the package, whose tsconfig is stricter than the app's.
   */
  return batchNonces.flatMap(n => {
    const v = byNonce[n];
    return v === undefined ? [] : [v];
  });
}


/* ===========================================================================================
 * THE GAS MODEL, AND WHY A SLOPE THROUGH THE ORIGIN IS THE WRONG ONE
 * ===========================================================================================
 *
 * Every splittable op on this chain has the shape `gas(N) = F + c x N`:
 *
 *   F   a FIXED per-transaction cost, paid again by every batch -- the settle bundle, the
 *       anchor legs, the score delta, the book and the checkpoint all run once per CALL,
 *       not once per item.
 *   c   the marginal cost of one more item.
 *
 * `planStakeBatches` models `gas = c x N` (it divides the probed total by the item count), which
 * is the same line forced through the origin. That over-states `c`, under-states the cost of an
 * extra transaction, and therefore UNDER-SPLITS -- see its own corrected comment.
 *
 * Measured confirmation that `F > 0` is not hypothetical: the IGNIS analogue of this exact curve
 * was fitted against mainnet on 2026-10-27 for `AQP-POOL|CC_UnstakeNonFungibleCollectable`, eight
 * nonce counts from 1 to 420, and came out as `58 + 9 x N` with ZERO residual on all eight
 * points. Six of that op's nine cumulator legs do not scale with the nonce list. The same legs
 * execute on chain, so the gas curve has a flat part for the same reason.
 */
export interface GasModel {
  /** fixed cost per transaction, in gas -- clamped at 0, since a negative intercept is noise */
  fixed: number;
  /** marginal gas per item */
  perItem: number;
}

/** One measurement: `gas` observed for a batch of `n` items. */
export interface GasSample { n: number; gas: number; }

/**
 * Fit `gas = fixed + perItem x n` through the samples -- ordinary least squares for 3+, the exact
 * line for 2, and a through-the-origin slope for 1 (the only honest reading of a single point).
 *
 * `fixed` is clamped to >= 0 and `perItem` to > 0. A fit can legitimately come out with a slightly
 * negative intercept from measurement noise, and a negative FIXED cost would make `solveBatchCount`
 * believe an extra transaction is FREE -- the exact error this whole model exists to remove.
 */
export function fitGasModel(samples: readonly GasSample[]): GasModel | null {
  const pts = samples.filter(s => Number.isFinite(s.n) && Number.isFinite(s.gas) && s.n > 0);
  if (pts.length === 0) return null;
  if (pts.length === 1) {
    // Bound once rather than indexed twice: `pts.length === 1` already proves it is there, but
    // proving it to the compiler is what keeps the guarantee local to the line.
    const only = pts[0]!;
    return { fixed: 0, perItem: Math.max(only.gas / only.n, Number.MIN_VALUE) };
  }
  const k = pts.length;
  const sx = pts.reduce((a, p) => a + p.n, 0);
  const sy = pts.reduce((a, p) => a + p.gas, 0);
  const sxx = pts.reduce((a, p) => a + p.n * p.n, 0);
  const sxy = pts.reduce((a, p) => a + p.n * p.gas, 0);
  const denom = k * sxx - sx * sx;
  // Every sample shares one `n` (e.g. two probes of the same size): no slope is determined, so
  // fall back to the single-point reading rather than dividing by zero.
  if (denom === 0) return { fixed: 0, perItem: Math.max(sy / sx, Number.MIN_VALUE) };
  const perItem = (k * sxy - sx * sy) / denom;
  const fixed = (sy - perItem * sx) / k;
  return { fixed: Math.max(0, fixed), perItem: Math.max(perItem, Number.MIN_VALUE) };
}

/**
 * The SMALLEST batch count `k` such that a batch of `ceil(n / k)` items fits under `ceiling`
 * according to `model` -- or `null` when NO split fits, which means a single item already costs
 * more than the ceiling allows.
 *
 * `null` is not a failure of this function; it is the answer that the operation needs a
 * multi-step (defpact) twin, because partitioning cannot rescue it. Owner ruling 2026-10-27:
 * over-limit, non-partitionable and no twin "shouldn't exist" -- so a `null` here is a
 * CONTRACT-LEVEL GAP to report, not a UI state to design around.
 */
export function solveBatchCount(n: number, ceiling: number, model: GasModel): number | null {
  if (n <= 0) return 1;
  const room = ceiling - model.fixed;
  if (room <= 0) return null;                       // the fixed cost alone busts the ceiling
  const perBatch = Math.floor(room / model.perItem); // items one transaction can carry
  if (perBatch < 1) return null;                    // not even one item fits
  if (perBatch >= n) return 1;
  return Math.ceil(n / perBatch);
}

/** What a probe of one candidate batch came back with. A refusal still carries information. */
export type ProbeOutcome =
  | { ok: true; gas: number }
  /** refused; `floor` is the gas the chain reported before stopping, which UNDER-states the true
   *  cost (execution halted at the declared limit), so it is a lower bound and never a total. */
  | { ok: false; floor: number | null };

export interface VerifiedBatchPlan<T> {
  batches: T[][];
  /** measured gas of the LARGEST batch in `batches` -- null when nothing could be measured */
  worstBatchGas: number | null;
  /** the model the search converged on, for display and for the tooltip */
  model: GasModel | null;
  /** how many `/local` probes were spent getting here */
  probes: number;
  /** TRUE only when the returned plan's largest batch was MEASURED under the ceiling. */
  verified: boolean;
  /** set when no partition can fit -- the op needs a defpact twin or a Pact-level fix */
  infeasible?: { singleItemGas: number; ceiling: number };
}

/**
 * PLAN BY MEASUREMENT, NOT BY DIVISION.
 *
 * Owner, 2026-10-27, stating the requirement exactly: "it should split in that many amounts such
 * that each remains AFTER ITS SIMULATION under 1.9 million". That word is the whole difference.
 * `planStakeBatches` divides a total and trusts the quotient; this searches for the largest batch
 * size a probe CONFIRMS fits, and only reports `verified` when it has that confirmation.
 *
 * THE SEARCH IS A BRACKET ON BATCH SIZE, guided by the fitted model.
 *
 *   lo  the largest size MEASURED to fit (anchored at 1 by the single-item probe)
 *   hi  the smallest size MEASURED not to fit (anchored at n by the full-selection probe)
 *
 * Each round probes a candidate strictly inside `(lo, hi)`, so the bracket shrinks every time and
 * termination is structural rather than a probe budget running out. The candidate comes from
 * `solveBatchCount`\'s capacity when the model has real data to stand on, and from the midpoint
 * when it does not -- so a good model converges in three or four probes and a badly non-linear
 * curve degrades to a binary search instead of diverging.
 *
 * REFUSAL FLOORS NEVER ENTER THE FIT, and that single decision is what makes this fast. A refused
 * probe reports the gas at which execution STOPPED -- the declared limit itself -- so
 * `floor / ceiling` is always about 1 and carries no magnitude. An earlier version fed those
 * floors into the model and into a geometric shrink; the shrink degenerated to +1 per round and a
 * 15,000-item selection needed 10 probes instead of 4. A refusal is a BOUND, not a measurement,
 * and is used only to move `hi`. It is enforced by NOT RECORDING them -- every `samples.push`
 * below is guarded by `ok` -- rather than by filtering afterwards.
 *
 * CORRECTED 2026-10-27, by mutation testing. This previously fitted `samples.filter(gas <= ceiling)`
 * and the comment claimed that filter was what kept refusal floors out. It was not: floors are
 * never recorded, so the filter's only effect was to DISCARD real measurements that came back
 * ABOVE the ceiling -- which are the best-conditioned points available, being exact readings at
 * large n. Deleting the filter was mutation-tested and no test failed, which is how the mistake
 * surfaced: a guard with no effect on any covered behaviour is indistinguishable from an absent
 * one, and this one was worse than absent.
 *
 * MONOTONICITY IS ASSUMED, AND THEN CHECKED. Gas is taken to be non-decreasing in item count,
 * which is what lets a batch smaller than `lo` inherit `lo`\'s confirmation. Rather than rely on
 * that, the plan actually returned gets one final confirming probe on its own largest batch
 * whenever that batch is smaller than `lo` and budget remains -- so `worstBatchGas` describes the
 * plan being handed back, not a different batch that happened to be measured on the way.
 *
 * THE FULL SELECTION DOES NOT HAVE TO BE PROBEABLE. The existing flows all begin by probing the
 * whole selection, which for a 5,000-target bulk transfer can never succeed; a refusal there
 * yields only a floor, which is exactly what `hi` wants.
 */
export async function planBatchesVerified<T>(
  items: readonly T[],
  probe: (batch: readonly T[]) => Promise<ProbeOutcome>,
  ceiling: number = safeBatchGasCeiling(),
  opts: { maxProbes?: number } = {},
): Promise<VerifiedBatchPlan<T>> {
  const maxProbes = Math.max(3, opts.maxProbes ?? 12);
  const n = items.length;
  if (n === 0) {
    return { batches: [[]], worstBatchGas: null, model: null, probes: 0, verified: true };
  }

  let probes = 0;
  /** ONLY successful measurements -- every push below is `ok`-guarded. A measurement ABOVE the
   *  ceiling still belongs here: it is exact, and it is the point that pins the slope. */
  const samples: GasSample[] = [];
  const fits = (m: number) => ({ batches: evenSplit(items, Math.ceil(n / m)) });

  // 1] The whole selection. The common case by far: it fits, and one probe is the whole job.
  const full = await probe(items); probes++;
  if (full.ok) {
    samples.push({ n, gas: full.gas });
    if (full.gas <= ceiling) {
      return { batches: [[...items]], worstBatchGas: full.gas, model: null, probes,
               verified: true };
    }
  }
  if (n === 1) {
    // One item, and it does not fit. No partition exists; this needs a defpact twin.
    const g = full.ok ? full.gas : (full.floor ?? ceiling + 1);
    return { batches: [[...items]], worstBatchGas: full.ok ? g : null, model: fitGasModel(samples),
             probes, verified: false, infeasible: { singleItemGas: g, ceiling } };
  }

  // 2] A single item anchors the fixed cost. Without this point the only available line passes
  //    through the origin, which is the assumption being corrected here.
  const one = await probe(items.slice(0, 1)); probes++;
  if (!one.ok || one.gas > ceiling) {
    const g = one.ok ? one.gas : (one.floor ?? ceiling + 1);
    return { batches: [[...items]], worstBatchGas: one.ok ? g : null, model: fitGasModel(samples),
             probes, verified: false, infeasible: { singleItemGas: g, ceiling } };
  }
  samples.push({ n: 1, gas: one.gas });

  // 3] Bracket and close it. `lo` always fits (proven), `hi` never does (proven).
  let lo = 1;
  let hi = n;
  let bestGas = one.gas;

  while (lo + 1 < hi && probes < maxProbes) {
    // SNAPSHOT THE COUNT BEFORE PROBING. `samples` is pushed to inside this same iteration, so
    // reading `.length` after the push answers a different question than the one the break
    // condition asks ("was the model trustworthy when the guess was made?"). Holding a bare
    // alias to `samples` here instead of a copy made the break fire on iteration 1 and returned
    // 278 batches for a 9-batch selection. The earlier `.filter()` happened to return a copy,
    // which hid the dependency entirely.
    const trustworthy = samples.length >= 2;
    // ONE real point is enough to guide the first jump, and guiding it matters a lot. With a
    // single sample `fitGasModel` returns a THROUGH-ORIGIN slope, which over-states the marginal
    // cost (it charges the fixed cost to every item) and therefore UNDER-states capacity -- so
    // the guess is conservative and essentially always succeeds, which is exactly what is wanted:
    // it buys the second real point immediately and the fit becomes exact. Requiring two points
    // before guiding at all forced blind midpoint halving until one turned up, and a 15,000-item
    // selection cost 7 probes instead of 4.
    const model = samples.length >= 1 ? fitGasModel(samples) : null;
    const solved = model ? solveBatchCount(n, ceiling, model) : null;
    //  `solveBatchCount` answers in BATCHES; convert back to a capacity in items.
    const guess = solved != null && solved > 0 ? Math.ceil(n / solved) : null;
    let m = guess != null && guess > lo && guess < hi
      ? guess
      : Math.floor((lo + hi) / 2);
    if (m <= lo) m = lo + 1;
    if (m >= hi) m = hi - 1;

    const r = await probe(items.slice(0, m)); probes++;
    if (r.ok && r.gas <= ceiling) {
      samples.push({ n: m, gas: r.gas });
      lo = m;
      bestGas = r.gas;
      // The model's own optimum has been reached -- closing the bracket further buys nothing.
      // GATED ON A TRUSTWORTHY MODEL (two real samples), and that gate is load-bearing: the
      // one-point model is a through-origin line that badly under-states capacity, and its
      // "optimum" is reached by the very first conservative guess. Breaking there returned 278
      // batches for a selection that fits in 9 -- a verified plan, and 30x more transactions
      // than necessary. Two real points pin `fixed` and the estimate becomes exact.
      if (guess != null && guess <= m && trustworthy) break;
    } else {
      if (r.ok) samples.push({ n: m, gas: r.gas });   // measured, just over -- still real data
      hi = m;
    }
  }

  const batches = fits(lo).batches;
  /**
   * AN EMPTY PLAN IS NOT A PLAN, so it is refused rather than reduced over. `fits(lo)` returns
   * at least one batch for any `lo >= 1` — but the seed `batches[0]` is only `T[]` if something
   * says so, and under `noUncheckedIndexedAccess` nothing did. Making the emptiness explicit is
   * both the proof and the honest guard: a zero-batch plan would otherwise reach `largest.length`
   * as `undefined.length`.
   */
  const first = batches[0];
  if (first === undefined) {
    return { batches: [], worstBatchGas: null, model: null, probes, verified: false };
  }
  const largest = batches.reduce((a, b) => (b.length > a.length ? b : a), first);

  // 4] Confirm the plan ACTUALLY being returned, not a nearby batch measured on the way.
  let worst = largest.length === lo ? bestGas : null;
  if (worst == null && probes < maxProbes) {
    const r = await probe(largest); probes++;
    if (r.ok) worst = r.gas;
  }
  const verified = worst != null && worst <= ceiling;
  const out: VerifiedBatchPlan<T> = {
    batches, worstBatchGas: worst, model: fitGasModel(samples),
    probes, verified,
  };
  // REMOVED 2026-10-27: a trailing `if (!verified && lo <= 1) out.infeasible = ...` lived here and
  // was UNREACHABLE. `lo` only ever holds a size a probe confirmed, so `lo === 1` means the
  // single-item measurement stood -- and a plan of n one-item batches has `largest.length === lo`,
  // which takes `worst` from that same confirmed measurement and makes `verified` true. So the
  // condition could not hold. Mutation testing found it: disabling the line changed no test,
  // because nothing could reach it. Infeasibility is reported at the two early returns above,
  // where it is actually decidable. An unreachable branch is a written excuse, not a guard.
  return out;
}
