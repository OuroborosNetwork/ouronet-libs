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
 * THE SPLIT MUST BE MEASURED, NOT DIVIDED.
 *
 * `planStakeBatches` models gas as `c x N` -- a line through the origin -- and returns
 * `ceil(total / ceiling)` batches. That is wrong whenever a transaction carries a FIXED cost,
 * which every op here does (settle bundle, anchor legs, score delta, checkpoint all run once per
 * CALL). Splitting k ways costs k x F, so dividing the total UNDER-splits, and the failure is
 * loud but late: both halves of a 2-way split get refused by the chain.
 *
 * The first test below is the demonstration of that bug with real magnitudes. The rest pin
 * `fitGasModel` / `solveBatchCount` / `planBatchesVerified`, which fix it by measuring.
 */
import { describe, it, expect } from "vitest";
import {
  planStakeBatches, fitGasModel, solveBatchCount, planBatchesVerified,
  type GasModel, type ProbeOutcome,
} from "../src/index.js";

/** A synthetic op with a fixed cost -- `gas(N) = fixed + perItem x N`. */
const curve = (fixed: number, perItem: number) => (n: number) => fixed + perItem * n;

/** A probe over a `gas(n)` curve that refuses above `declared`, reporting the limit as the floor. */
function probeFor(gas: (n: number) => number, declared: number) {
  const calls: number[] = [];
  const probe = async (batch: readonly unknown[]): Promise<ProbeOutcome> => {
    calls.push(batch.length);
    const g = gas(batch.length);
    return g <= declared ? { ok: true, gas: g } : { ok: false, floor: declared };
  };
  return { probe, calls };
}

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("the defect: dividing a total under-splits when a fixed cost exists", () => {
  it("planStakeBatches returns 2 batches that BOTH exceed the ceiling", () => {
    // F = 400k, c = 7,619 -> gas(420) = 3.6M. Ceiling 1.9M.
    const gas = curve(400_000, 7_619);
    const ceiling = 1_900_000;
    const total = gas(420);
    expect(Math.round(total)).toBe(3_599_980);

    const plan = planStakeBatches(items(420), total, ceiling);
    expect(plan.batches).toHaveLength(2);           // ceil(3.6M / 1.9M)

    // And each of those batches really costs more than the ceiling allows.
    for (const b of plan.batches) {
      expect(gas(b.length)).toBeGreaterThan(ceiling);
    }
  });

  it("the verified planner splits the SAME case into enough batches, each measured under", async () => {
    const gas = curve(400_000, 7_619);
    const ceiling = 1_900_000;
    const { probe } = probeFor(gas, 1_900_000);

    const plan = await planBatchesVerified(items(420), probe, ceiling);
    expect(plan.verified).toBe(true);
    expect(plan.batches.length).toBeGreaterThan(2);           // strictly more than the naive 2
    for (const b of plan.batches) expect(gas(b.length)).toBeLessThanOrEqual(ceiling);
    // concatenation reproduces the selection exactly, in order
    expect(plan.batches.flat()).toEqual(items(420));
  });
});

describe("fitGasModel", () => {
  it("recovers a known fixed cost and slope exactly from two points", () => {
    const m = fitGasModel([{ n: 1, gas: 67 }, { n: 420, gas: 3838 }])!;
    expect(m.fixed).toBeCloseTo(58, 6);
    expect(m.perItem).toBeCloseTo(9, 6);
  });

  it("matches the mainnet-measured IGNIS curve on all eight sampled points", () => {
    // Fitted live 2026-10-27 against AQP-POOL|CC_UnstakeNonFungibleCollectable: 58 + 9N.
    const observed: Array<[number, number]> = [
      [1, 67], [2, 76], [3, 85], [10, 148], [50, 508], [105, 1003], [210, 1948], [420, 3838],
    ];
    const m = fitGasModel(observed.map(([n, gas]) => ({ n, gas })))!;
    for (const [n, gas] of observed) {
      expect(m.fixed + m.perItem * n).toBeCloseTo(gas, 6);
    }
  });

  it("never reports a NEGATIVE fixed cost, which would make an extra transaction free", () => {
    // Noisy samples whose least-squares intercept is below zero.
    const m = fitGasModel([{ n: 10, gas: 90 }, { n: 20, gas: 220 }, { n: 30, gas: 330 }])!;
    expect(m.fixed).toBeGreaterThanOrEqual(0);
    expect(m.perItem).toBeGreaterThan(0);
  });

  it("falls back to a through-origin slope for one point, and for samples sharing one n", () => {
    expect(fitGasModel([{ n: 4, gas: 400 }])).toEqual({ fixed: 0, perItem: 100 });
    const same = fitGasModel([{ n: 5, gas: 500 }, { n: 5, gas: 700 }])!;
    expect(same.fixed).toBe(0);
    expect(Number.isFinite(same.perItem)).toBe(true);
  });

  it("returns null when there is nothing usable to fit", () => {
    expect(fitGasModel([])).toBeNull();
    expect(fitGasModel([{ n: 0, gas: 5 }, { n: -2, gas: 7 }])).toBeNull();
  });
});

describe("solveBatchCount", () => {
  const m: GasModel = { fixed: 400_000, perItem: 7_619 };

  it("accounts for the fixed cost being re-paid by every batch", () => {
    // Naive ceil(total/ceiling) would say 2. Capacity is floor((1.9M-400k)/7619) = 196 items.
    expect(solveBatchCount(420, 1_900_000, m)).toBe(Math.ceil(420 / 196));
  });

  it("guarantees the chosen k makes every batch fit", () => {
    for (const n of [1, 7, 196, 197, 420, 5000]) {
      const k = solveBatchCount(n, 1_900_000, m);
      expect(k).not.toBeNull();
      expect(m.fixed + m.perItem * Math.ceil(n / k!)).toBeLessThanOrEqual(1_900_000);
    }
  });

  it("returns 1 when the whole selection already fits", () => {
    expect(solveBatchCount(50, 1_900_000, m)).toBe(1);
  });

  it("returns null when the FIXED cost alone busts the ceiling — a contract-level gap", () => {
    expect(solveBatchCount(100, 300_000, m)).toBeNull();
  });

  it("returns null when one item does not fit, however many batches are used", () => {
    expect(solveBatchCount(100, 1_900_000, { fixed: 1_800_000, perItem: 150_000 })).toBeNull();
  });
});

describe("planBatchesVerified", () => {
  it("spends exactly ONE probe when the whole selection fits", async () => {
    const { probe, calls } = probeFor(curve(50_000, 1_000), 1_900_000);
    const plan = await planBatchesVerified(items(100), probe, 1_900_000);
    expect(plan.verified).toBe(true);
    expect(plan.batches).toHaveLength(1);
    expect(plan.probes).toBe(1);
    expect(calls).toEqual([100]);
  });

  it("works when the FULL selection can never be probed — only a floor comes back", async () => {
    // 5,000 targets at 2,100 gas each: ~10.5M, far past any declared limit.
    const gas = curve(120_000, 2_100);
    const { probe } = probeFor(gas, 1_900_000);
    const plan = await planBatchesVerified(items(5000), probe, 1_900_000);
    expect(plan.verified).toBe(true);
    for (const b of plan.batches) expect(gas(b.length)).toBeLessThanOrEqual(1_900_000);
    expect(plan.batches.flat()).toEqual(items(5000));
  });

  it("reports INFEASIBLE when a single item exceeds the ceiling, instead of splitting forever",
    async () => {
      const { probe } = probeFor(curve(0, 2_500_000), 3_000_000);
      const plan = await planBatchesVerified(items(10), probe, 1_900_000);
      expect(plan.verified).toBe(false);
      expect(plan.infeasible).toBeDefined();
      expect(plan.infeasible!.singleItemGas).toBeGreaterThan(1_900_000);
    });

  it("reports INFEASIBLE when even one item cannot be measured under the probe ceiling",
    async () => {
      const { probe } = probeFor(curve(0, 5_000_000), 1_900_000);
      const plan = await planBatchesVerified(items(10), probe, 1_900_000);
      expect(plan.verified).toBe(false);
      expect(plan.infeasible).toBeDefined();
    });

  it("never returns verified:true with a batch it did not measure under the ceiling", async () => {
    // Deliberately hostile: cost jumps non-linearly, so the model's guess is always optimistic.
    const gas = (n: number) => 100_000 + 900 * n * Math.log2(n + 1);
    const { probe } = probeFor(gas, 1_900_000);
    const plan = await planBatchesVerified(items(900), probe, 1_900_000, { maxProbes: 20 });
    if (plan.verified) {
      const largest = Math.max(...plan.batches.map(b => b.length));
      expect(gas(largest)).toBeLessThanOrEqual(1_900_000);
    }
    expect(plan.batches.flat()).toEqual(items(900));
  });

  it("degrades to SMALLER batches when the probe budget runs out, never to an unverified plan",
    async () => {
      // Written first as "gives up with verified:false", which was wrong about the design and is
      // worth recording: `lo` only ever holds a size a probe CONFIRMED fits, so a budget that
      // runs out early leaves `lo` small rather than leaving the plan unproven. The degradation
      // is in EFFICIENCY (more transactions than necessary), never in safety.
      const gas = curve(100_000, 3_000);
      const tight = await planBatchesVerified(items(5000), probeFor(gas, 1_900_000).probe,
                                              1_900_000, { maxProbes: 3 });
      const full = await planBatchesVerified(items(5000), probeFor(gas, 1_900_000).probe,
                                             1_900_000, { maxProbes: 12 });

      expect(tight.verified).toBe(true);
      expect(full.verified).toBe(true);
      // Every batch of the starved plan still really fits ...
      for (const b of tight.batches) expect(gas(b.length)).toBeLessThanOrEqual(1_900_000);
      // ... it just needs more of them than the plan that was allowed to converge.
      expect(tight.batches.length).toBeGreaterThan(full.batches.length);
      expect(tight.batches.flat()).toEqual(items(5000));
    });

  it("reports verified:false when it cannot confirm the batch it is actually returning",
    async () => {
      // The one genuinely-unverified path that is not infeasibility. Traced: the search probes
      // 10 (refused), 1 (ok), 5 (ok), 7 (refused), 6 (ok) and closes on lo = 6, so the even
      // split is 2 batches of 5 -- SMALLER than the size measured. Monotonicity says 5 fits, but
      // nothing measured it, and at maxProbes 5 the budget is gone before the CONFIRMING probe
      // can run. One more probe and this same case reports verified:true with worst = 600,000,
      // which is the design: the confirming probe is what grants the claim.
      const { probe } = probeFor(
        (n: number) => (n <= 6 ? 100_000 + 100_000 * n : 9_000_000), 1_900_000);
      const plan = await planBatchesVerified(items(10), probe, 1_900_000, { maxProbes: 5 });
      expect(plan.batches.map(b => b.length)).toEqual([5, 5]);
      expect(plan.verified).toBe(false);
      expect(plan.batches.flat()).toEqual(items(10));
    });

  it("converges geometrically — a 9-batch case does not cost 9 rounds", async () => {
    const { probe } = probeFor(curve(100_000, 1_000), 1_900_000);
    const plan = await planBatchesVerified(items(15_000), probe, 1_900_000);
    expect(plan.verified).toBe(true);
    expect(plan.batches.length).toBeGreaterThanOrEqual(9);
    expect(plan.probes).toBeLessThanOrEqual(6);
  });

  it("handles the empty selection without probing", async () => {
    const { probe, calls } = probeFor(curve(1, 1), 1_900_000);
    const plan = await planBatchesVerified([], probe, 1_900_000);
    expect(plan.verified).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe("declaring the probe ABOVE the ceiling turns refusals into measurements", () => {
  /**
   * Found by mutation testing. `liveProbeCeiling()` and `safeBatchGasCeiling()` are both
   * `getActiveGasLimit() - 100_000`, so today a probe REFUSES at exactly the number the plan
   * compares against -- which means a batch costing between the ceiling and the node max comes
   * back as a useless FLOOR instead of an exact reading. Declaring the probe at the node max and
   * comparing against the safe ceiling costs nothing and yields real data at large n, which is
   * the best-conditioned point the fit can have.
   */
  it("reaches the OPTIMAL batch count, because the over-ceiling reading pins the curve", async () => {
    // Asserted on probe count first, which was vacuous: both variants spend 3. The damage of
    // throwing the over-ceiling sample away is in the PLAN -- without it the only point is the
    // single item, the fit is a through-origin line charging the fixed cost to every item, and
    // capacity comes out at 4 items instead of 196. Same 3 probes, 105 transactions instead of 3.
    const gas = curve(400_000, 7_619);
    const plan = await planBatchesVerified(
      items(420), probeFor(gas, 4_000_000).probe, 1_900_000);     // declared 4M > ceiling 1.9M

    expect(plan.verified).toBe(true);
    // capacity = floor((1.9M - 400k) / 7,619) = 196 items, so 420 needs exactly 3 transactions
    expect(solveBatchCount(420, 1_900_000, { fixed: 400_000, perItem: 7_619 })).toBe(3);
    expect(plan.batches).toHaveLength(3);
    expect(plan.model!.fixed).toBeCloseTo(400_000, 0);
    expect(plan.model!.perItem).toBeCloseTo(7_619, 0);
  });

  it("fits the TRUE curve even when loop probes are refused along the way", async () => {
    // Convex, so the linear model keeps over-estimating capacity and the loop really does get
    // refusals -- the branch where a floor could be mistaken for a measurement.
    const gas = (n: number) => 100_000 + 50 * n * n;
    const plan = await planBatchesVerified(
      items(1000), probeFor(gas, 1_900_000).probe, 1_900_000, { maxProbes: 20 });

    expect(plan.verified).toBe(true);
    for (const b of plan.batches) expect(gas(b.length)).toBeLessThanOrEqual(1_900_000);
    // THE REPORTED MODEL MUST NOT UNDER-STATE THE PLAN IT CHOSE. This is the number that feeds
    // the user-facing gas figure, so a model predicting less than the batch really costs tells
    // the user a transaction is cheaper than it is. Measured on this fixture: recording refusal
    // floors as data pulls the fit to {fixed 879,299, perItem 3,009} -> predicts 1,381,846
    // against a real 1,494,450 (0.93x). Not recording them gives {0, 9,478} -> 1,582,818
    // (1.06x). A floor claims "this many items cost exactly the ceiling", which is the one
    // statement guaranteed to flatten the slope.
    const largest = Math.max(...plan.batches.map(b => b.length));
    const predicted = plan.model!.fixed + plan.model!.perItem * largest;
    expect(predicted).toBeGreaterThanOrEqual(gas(largest));
  });

  it("the confirming probe is what GRANTS verification", async () => {
    // Companion to the verified:false case above: identical curve and selection, one more probe
    // of budget. Traced: 10 refused, 1 ok, 5 ok, 7 refused, 6 ok, then 5 CONFIRMED at 600,000.
    const gas = (n: number) => (n <= 6 ? 100_000 + 100_000 * n : 9_000_000);
    const plan = await planBatchesVerified(
      items(10), probeFor(gas, 1_900_000).probe, 1_900_000, { maxProbes: 6 });
    expect(plan.batches.map(b => b.length)).toEqual([5, 5]);
    expect(plan.verified).toBe(true);
    expect(plan.worstBatchGas).toBe(gas(5));
    expect(plan.probes).toBe(6);
  });
});
