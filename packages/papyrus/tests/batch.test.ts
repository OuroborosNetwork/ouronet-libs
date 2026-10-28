/**
 * MOVED HERE FROM OuronetUI, 2026-10-28, WITH THE CODE IT TESTS.
 *
 * The planner moved into this package and its unit tests stayed behind in the app for exactly
 * one version — long enough to see what that costs. A package whose tests live in a consumer is
 * a package whose CI is green while its code is broken, and the consumer's suite only runs
 * against whatever version it happens to have installed. Tests belong with the code they pin.
 *
 * IMPORTED THROUGH `../src/index.js`, NOT `../src/batch.js`, and that is the second half of the
 * lesson. v0.1.0 shipped `planBatchesVerified` in `dist/batch.js` and omitted it from the index,
 * which — since `exports` admits `"."` alone — made it unreachable to every consumer while every
 * test that imported the module directly stayed green. Importing the entry point is what makes
 * these tests measure the surface a consumer actually gets.
 */
/**
 * THE REGRESSION TEST FOR THE WHOLE ARC OF THIS FEATURE'S GAS-CEILING BUGS:
 *
 *   1. "Gas limit '500000' exceeded: 500008" (owner, 2026-10-21) — a colleague's 162-NFT
 *      stake failing because `CodexSigningStrategy.execute` always probed a candidate
 *      transaction at a hardcoded 500,000 gas limit before calibrating the real one, so any
 *      operation whose real cost exceeded 500,000 failed at the SIMULATION step, regardless
 *      of the real, much higher per-transaction ceiling every node actually allows.
 *   2-4. Several attempts to WORK AROUND that 500,000 wall from the client side (an elevated
 *      measurement probe tied to the active node's reported ceiling, then a fixed-size
 *      sample) — all real, local fixes to real, local bugs, but all still splitting well
 *      below the chain's actual per-transaction ceiling, because the wall itself was still
 *      there.
 *   5. THE ACTUAL FIX: `useCFMStrategy.ts`'s `wrapBuildPastProbeCeiling` raises the 500,000
 *      PROBE itself to the live node ceiling, for every CFM modal, not just staking (owner,
 *      2026-10-24: "any zbom has to construct transactions that can be executed up to the
 *      allowed gas limit... a zbom canceling a transaction of 700k is plain wrong"). With
 *      that fixed, `safeBatchGasCeiling()` can legitimately track the REAL per-transaction
 *      ceiling (`getActiveGasLimit() - 100,000` — "batch... only when simulation gets above
 *      1.9 mil (100k buffer or so)", owner) instead of a number derived from the old 500,000
 *      wall.
 *   6. THE SAMPLE-EXTRAPOLATION BUG: a version of the MEASUREMENT (not the ceiling policy)
 *      sampled 20 nonces and extrapolated a per-nonce rate -- which badly underestimated a
 *      real case. Explorer-confirmed, 2026-10-24: 187 nonces predicted at ~577,170 gas total
 *      (~3,086/nonce) actually used 1,099,069 gas and calibrated to a 1,173,849 limit
 *      (~6,277/nonce calibrated) -- per-nonce cost is not uniform enough for a small sample
 *      to extrapolate safely. Fixed by probing the FULL selection (via `liveProbeCeiling()`,
 *      `@/lib/signing/useCFMStrategy` -- the SAME ceiling the real signing path's own probe
 *      uses) and running the result through `calculateAutoGasLimit` (`@stoachain/stoa-core
 *      /gas` -- the SAME calibration the real submission already trusts), in
 *      `BatchedCollectableStakeFlow.tsx`. `planStakeBatches` decides how many smaller,
 *      gas-safe transactions one large nonce selection should become against THAT ceiling.
 */
import { describe, it, expect, afterEach } from "vitest";
import { setNodeConfig, resetNodeFailover } from "@stoachain/stoa-core/network";
import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";
import {
  evenSplit, planStakeBatches, safeBatchGasCeiling, isGasLimitExceededMessage,
  planFromExceededProbe, WORST_KNOWN_CALIBRATED_PER_NONCE, QUICK_PREFILTER_NONCE_COUNT,
} from "../src/index.js";

afterEach(() => {
  resetNodeFailover(); // restore the default (node2, 2,000,000) between tests
});

describe("evenSplit", () => {
  it("splits into BALANCED chunks, not (count-1) full chunks plus a small remainder", () => {
    const items = Array.from({ length: 162 }, (_, i) => i);
    const batches = evenSplit(items, 2);
    expect(batches.map(b => b.length)).toEqual([81, 81]);
  });

  it("gives the remainder to the FIRST batches, never the last, for a non-even split", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const batches = evenSplit(items, 3);
    expect(batches.map(b => b.length)).toEqual([4, 3, 3]);
  });

  it("reproduces the original selection exactly when concatenated, in order", () => {
    const items = Array.from({ length: 47 }, (_, i) => i * 7);
    const batches = evenSplit(items, 5);
    expect(batches.flat()).toEqual(items);
  });

  it("clamps the batch count to the item count — never an empty batch", () => {
    const items = [1, 2, 3];
    const batches = evenSplit(items, 10);
    expect(batches).toHaveLength(3);
    expect(batches.every(b => b.length === 1)).toBe(true);
  });

  it("handles an empty list without throwing", () => {
    expect(evenSplit([], 3)).toEqual([[]]);
  });
});

describe("safeBatchGasCeiling", () => {
  it("is the live active-node gas ceiling minus a 100,000 buffer -- 1,900,000 by default", () => {
    expect(safeBatchGasCeiling()).toBe(2_000_000 - 100_000);
  });

  it("tracks the live active-node ceiling, not a frozen constant", () => {
    setNodeConfig("custom", "https://example.com", 1_600_000);
    expect(safeBatchGasCeiling()).toBe(1_600_000 - 100_000);
  });
});

// `WORST_KNOWN_CALIBRATED_PER_NONCE` (imported above, from `stakeBatchPlanner.ts`): the
// real, explorer-confirmed measurement on record (2026-10-24) -- 187 BloodshedMinter nonces,
// 1,099,069 gas used, calibrated to a 1,173,849 gas limit, ~6,277/nonce CALIBRATED, nearly
// double the old sample-based estimate of ~3,086/nonce. Every "is this still safe" check
// below uses it.

describe("planStakeBatches", () => {
  it("THE 162-NFT CASE (500,008 gas, the ORIGINAL bug report) fits in ONE transaction -- the " +
     "real ceiling is ~1.9M, now that the ZBOM's own probe is no longer capped at 500,000", () => {
    const nonces = Array.from({ length: 162 }, (_, i) => i + 1);
    const plan = planStakeBatches(nonces, 500_008);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0]).toEqual(nonces);
  });

  it("THE 187-NONCE CASE (REAL, explorer-confirmed: calibrated to 1,173,849) fits in ONE " +
     "transaction -- true now that the real binding wall is ~1.9M, not 500k", () => {
    const nonces = Array.from({ length: 187 }, (_, i) => i + 1);
    const plan = planStakeBatches(nonces, 1_173_849);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0]).toEqual(nonces);
    expect(plan.perNonceGas).toBeCloseTo(1_173_849 / 187, 6);
  });

  it("does NOT split when the measured total already fits under the safe ceiling", () => {
    const nonces = Array.from({ length: 20 }, (_, i) => i);
    const plan = planStakeBatches(nonces, 60_000);
    expect(plan.batches).toEqual([nonces]);
  });

  it("splits into enough batches that NONE exceeds the safe ceiling, for a genuinely huge " +
     "selection -- using the REAL worst-known calibrated per-nonce rate, not the old, since-" +
     "disproven sample-based guess", () => {
    const nonces = Array.from({ length: 500 }, (_, i) => i);
    const worstBatchGas = 500 * WORST_KNOWN_CALIBRATED_PER_NONCE;
    const plan = planStakeBatches(nonces, worstBatchGas);
    expect(plan.batches.length).toBeGreaterThan(1);
    const perNonceGas = worstBatchGas / nonces.length;
    for (const b of plan.batches) {
      expect(b.length * perNonceGas).toBeLessThanOrEqual(safeBatchGasCeiling());
    }
    // And the plan doesn't over-split: one fewer batch would already be unsafe.
    const withOneFewer = evenSplit(nonces, plan.batches.length - 1 || 1);
    const worstOfOneFewer = Math.max(...withOneFewer.map(b => b.length)) * perNonceGas;
    expect(worstOfOneFewer).toBeGreaterThan(safeBatchGasCeiling());
  });

  it("treats a zero-length selection as a single empty batch rather than dividing by zero", () => {
    const plan = planStakeBatches([], 0);
    expect(plan.batches).toEqual([[]]);
    expect(plan.perNonceGas).toBe(0);
  });

  it("QUICK_PREFILTER_NONCE_COUNT is conservative against the REAL worst-known calibrated " +
     "rate -- the \"don't even bother probing below this count\" shortcut must still land " +
     "under the safe ceiling, or it could itself ship an unsafe single-transaction plan", () => {
    expect(QUICK_PREFILTER_NONCE_COUNT * WORST_KNOWN_CALIBRATED_PER_NONCE)
      .toBeLessThan(safeBatchGasCeiling());
  });
});

describe("isGasLimitExceededMessage", () => {
  it("recognizes the exact shape the ORIGINAL bug report had", () => {
    expect(isGasLimitExceededMessage("Gas limit '500000' exceeded: 500008")).toBe(true);
  });

  it("recognizes the shape `liveProbeCeiling()` would produce for a genuinely oversized probe", () => {
    expect(isGasLimitExceededMessage("Gas limit '1900000' exceeded: 1900231")).toBe(true);
  });

  it("does not false-positive on an unrelated failure message", () => {
    expect(isGasLimitExceededMessage("row not found: account does not exist")).toBe(false);
    expect(isGasLimitExceededMessage("insufficient funds")).toBe(false);
  });
});

describe("planFromExceededProbe", () => {
  it("THE 420-NONCE CASE (owner, 2026-10-25): a probe failure at the live ceiling splits " +
     "into enough SAFE batches, instead of the old behaviour of silently proceeding with " +
     "all 420 as one transaction", () => {
    const nonces = Array.from({ length: 420 }, (_, i) => i + 1);
    const plan = planFromExceededProbe(nonces, "Gas limit '1900000' exceeded: 1900231");
    expect(plan.batches.length).toBeGreaterThan(1);
    for (const b of plan.batches) {
      expect(b.length * plan.perNonceGas).toBeLessThanOrEqual(safeBatchGasCeiling());
    }
    // Every nonce still accounted for, in order.
    expect(plan.batches.flat()).toEqual(nonces);
  });

  it("uses the reported floor when it implies MORE gas than the worst-known-rate guess", () => {
    const nonces = Array.from({ length: 300 }, (_, i) => i);
    // A reported floor whose calibrated ceiling clamps above the rate-based guess for 300.
    const plan = planFromExceededProbe(nonces, "Gas limit '1900000' exceeded: 1900500");
    expect(plan.worstBatchGas).toBeGreaterThanOrEqual(calculateAutoGasLimit(1_900_500));
  });

  it("falls back to the worst-known-rate guess when the message carries no parseable number " +
     "-- never silently treats an unparseable exceeded-message as \"fits in one transaction\"", () => {
    const nonces = Array.from({ length: 1000 }, (_, i) => i);
    const plan = planFromExceededProbe(nonces, "Gas limit exceeded (no number given)");
    expect(plan.worstBatchGas).toBeCloseTo(1000 * WORST_KNOWN_CALIBRATED_PER_NONCE, 6);
    expect(plan.batches.length).toBeGreaterThan(1);
  });

  it("the rate-based estimate alone is enough to force a split for a selection far past the " +
     "ceiling, even though the reported floor would understate it on its own", () => {
    // A selection large enough that the worst-known rate implies vastly more gas than the
    // reported floor (which is capped at roughly the probe's own declared ceiling).
    const nonces = Array.from({ length: 5000 }, (_, i) => i);
    const plan = planFromExceededProbe(nonces, "Gas limit '1900000' exceeded: 1900100");
    const rateImplied = 5000 * WORST_KNOWN_CALIBRATED_PER_NONCE;
    expect(plan.worstBatchGas).toBeGreaterThanOrEqual(rateImplied);
    for (const b of plan.batches) {
      expect(b.length * plan.perNonceGas).toBeLessThanOrEqual(safeBatchGasCeiling());
    }
  });
});
