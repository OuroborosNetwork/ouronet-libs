/**
 * CUTTING A FED SLICE — and the three ways a hand-rolled splitter goes quietly wrong.
 *
 * IMPORTED THROUGH `../src/index.js`, not `../src/fedslice.js`: v0.1.0 shipped a function in
 * `dist/` and omitted it from the index, unreachable to every consumer while every test that
 * imported the module directly stayed green. The entry point is the surface.
 *
 * The `groupBy` cases are the reason this function exists. That field was carried correctly by
 * the registry and absent from `PartitionMeta`, so a consumer reading the judgement through the
 * type could not see the one constraint that makes a vacate split sound.
 */
import { describe, expect, it } from "vitest";
import { sliceFedArgs, partitionOf, type PartitionMeta } from "../src/index.js";

const LIST: PartitionMeta = {
  kind: "list", shape: "partition",
  axis: "owner-ids", lockstep: ["beneficiary-ids", "amounts"],
  reason: "test",
};
const GROUPED: PartitionMeta = { ...LIST, groupBy: "beneficiary-ids" };

/** Four legs over two beneficiaries, DELIBERATELY INTERLEAVED. */
const ARGS = {
  patron: "P", "pool-id": "POOL", "dptf-id": "OURO",
  "owner-ids": ["o1", "o2", "o3", "o4"],
  "beneficiary-ids": ["b1", "b2", "b1", "b2"],
  amounts: [1, 2, 3, 4],
};

const ok = (r: ReturnType<typeof sliceFedArgs>) => {
  if (!r.ok) throw new Error(`expected a split, got refusal: ${r.reason}`);
  return r;
};

describe("an ungrouped fed slice", () => {
  it("cuts the axis and every lockstep parameter together", () => {
    const r = ok(sliceFedArgs(LIST, ARGS, 2));
    expect(r.slices).toHaveLength(2);
    expect(r.slices[0].args["owner-ids"]).toEqual(["o1", "o2"]);
    expect(r.slices[0].args["beneficiary-ids"]).toEqual(["b1", "b2"]);
    expect(r.slices[0].args.amounts).toEqual([1, 2]);
    expect(r.slices[1].args["owner-ids"]).toEqual(["o3", "o4"]);
    expect(r.slices[1].args.amounts).toEqual([3, 4]);
  });

  /** Everything that is not the axis or a lockstep member rides along unchanged. */
  it("copies the non-positional arguments into every slice", () => {
    const r = ok(sliceFedArgs(LIST, ARGS, 2));
    for (const s of r.slices) {
      expect(s.args.patron).toBe("P");
      expect(s.args["pool-id"]).toBe("POOL");
      expect(s.args["dptf-id"]).toBe("OURO");
    }
  });

  it("reports the leg count per slice and the unit total", () => {
    const r = ok(sliceFedArgs(LIST, ARGS, 3));
    expect(r.slices.map(s => s.legCount)).toEqual([2, 1, 1]);
    expect(r.units).toBe(4);
    expect(r.clamped).toBe(false);
  });

  it("clamps to the number of units and says so", () => {
    const r = ok(sliceFedArgs(LIST, ARGS, 99));
    expect(r.slices).toHaveLength(4);
    expect(r.clamped).toBe(true);
  });

  it("loses and duplicates nothing", () => {
    const r = ok(sliceFedArgs(LIST, ARGS, 3));
    const flat = r.slices.flatMap(s => s.args["owner-ids"] as string[]);
    expect(flat.sort()).toEqual(["o1", "o2", "o3", "o4"]);
  });
});

describe("groupBy — the boundary a cut may not fall inside", () => {
  /**
   * THE HEADLINE. Ungrouped, asking for two slices over four legs splits b1 and b2 across both.
   * Grouped, each beneficiary lands whole — which is what keeps the vacate's UNGATED
   * per-beneficiary unwind firing once per beneficiary instead of once per slice.
   */
  it("keeps every entry sharing a value in ONE slice", () => {
    const r = ok(sliceFedArgs(GROUPED, ARGS, 2));
    expect(r.slices).toHaveLength(2);
    for (const s of r.slices) {
      const bens = new Set(s.args["beneficiary-ids"] as string[]);
      expect(bens.size, "a slice carries exactly one beneficiary here").toBe(1);
    }
    expect(r.units, "two beneficiaries, so two indivisible units").toBe(2);
  });

  /**
   * GROUPED BY VALUE, NOT BY ADJACENCY, and this is the case that distinguishes them. The legs
   * are interleaved b1,b2,b1,b2 — a splitter grouping contiguous RUNS would see four runs of one
   * and split b1 across slices while appearing to have grouped.
   */
  it("groups interleaved entries, not contiguous runs", () => {
    const r = ok(sliceFedArgs(GROUPED, ARGS, 2));
    const byBen = r.slices.map(s => ({
      ben: (s.args["beneficiary-ids"] as string[])[0],
      owners: (s.args["owner-ids"] as string[]).slice().sort(),
      amounts: (s.args.amounts as number[]).slice().sort((a, b) => a - b),
    }));
    expect(byBen.find(x => x.ben === "b1")!.owners).toEqual(["o1", "o3"]);
    expect(byBen.find(x => x.ben === "b1")!.amounts).toEqual([1, 3]);
    expect(byBen.find(x => x.ben === "b2")!.owners).toEqual(["o2", "o4"]);
  });

  /** And the lockstep arrays follow the same permutation, which is the whole safety property. */
  it("keeps amounts paired with their owners after grouping", () => {
    const pair = (o: string) => ({ o1: 1, o2: 2, o3: 3, o4: 4 } as Record<string, number>)[o];
    const r = ok(sliceFedArgs(GROUPED, ARGS, 2));
    for (const s of r.slices) {
      const owners = s.args["owner-ids"] as string[];
      const amts = s.args.amounts as number[];
      owners.forEach((o, i) => expect(amts[i]).toBe(pair(o)));
    }
  });

  it("cannot make more slices than there are groups", () => {
    const r = ok(sliceFedArgs(GROUPED, ARGS, 10));
    expect(r.slices).toHaveLength(2);
    expect(r.clamped).toBe(true);
  });

  it("refuses when the grouping parameter is not positional", () => {
    const r = sliceFedArgs({ ...GROUPED, groupBy: "beneficiary-ids" },
      { ...ARGS, "beneficiary-ids": ["b1"] }, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/positional/i);
  });
});

describe("refusals are results, with a sentence", () => {
  it("refuses an unclassified operation rather than returning one slice", () => {
    const r = sliceFedArgs(null, ARGS, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/absence means DO NOT SPLIT/);
  });

  it("names the pager, and its sequencing, for a cursor split", () => {
    const r = sliceFedArgs(
      { kind: "cursor", via: "AQP-FVT|CCp_SweepRecomputeChunk", reason: "x" }, ARGS, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("CCp_SweepRecomputeChunk");
      expect(r.reason).toMatch(/sequence/i);
    }
  });

  it("names the twin for an architectural split", () => {
    const r = sliceFedArgs(
      { kind: "architectural", via: "MTX-SWP|C_AddLiquidity", steps: 3, reason: "x" }, ARGS, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("MTX-SWP|C_AddLiquidity");
  });

  /** A reduction is parallel WITHIN a round and sequential BETWEEN — not a one-shot fan-out. */
  it("refuses a reduction", () => {
    const r = sliceFedArgs({ ...LIST, shape: "reduction" }, ARGS, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/fed back in/);
  });

  it("refuses a list partition with no axis", () => {
    const r = sliceFedArgs({ kind: "list", shape: "partition", reason: "x" }, ARGS, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no `axis`/);
  });

  it("refuses when the axis is absent or not a list", () => {
    expect(sliceFedArgs(LIST, { ...ARGS, "owner-ids": undefined }, 2).ok).toBe(false);
    const r = sliceFedArgs(LIST, { ...ARGS, "owner-ids": "o1" }, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not a list/);
  });

  it("refuses an empty axis — a transaction that moves nothing is still billed", () => {
    const r = sliceFedArgs(LIST, { ...ARGS, "owner-ids": [], "beneficiary-ids": [], amounts: [] }, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no work/i);
  });

  /**
   * THE MISALIGNMENT CASE, refused BEFORE anything is cut. Equal-length-but-wrong is the one that
   * cannot be caught downstream; unequal-length is caught here and named, with both counts, so
   * the caller knows which array is short.
   */
  it("refuses mismatched lockstep lengths, naming both counts", () => {
    const r = sliceFedArgs(LIST, { ...ARGS, amounts: [1, 2, 3] }, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("amounts");
      expect(r.reason).toContain("3");
      expect(r.reason).toContain("4");
    }
  });

  it("refuses a lockstep parameter that is not a list", () => {
    const r = sliceFedArgs(LIST, { ...ARGS, amounts: 1 }, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not a list/);
  });
});

/**
 * AND AGAINST THE REAL REGISTRY, because the gap this function closes was a TYPE that had drifted
 * from the DATA. `groupBy` was published on three entrypoints, validated by the Pact repo's own
 * `_registry.py --check`, and absent from `PartitionMeta` — so every TypeScript consumer read the
 * judgement with the one safety constraint missing. Fixtures alone would not have noticed, and
 * will not notice if it happens again.
 */
describe("the bundled registry's own vacate and drain judgements", () => {
  const VACATE = [
    "TS02-C3.AQP-POOL|CCp_BatchVacateTrueFungible",
    "TS02-C3.AQP-POOL|CCp_BatchVacateOrtoFungible",
    "TS02-C3.AQP-POOL|CCp_BatchVacateCollectables",
  ];
  const DRAIN = [
    "TS02-C3.AQP-POOL|CCp_BatchDrainTrueFungible",
    "TS02-C3.AQP-POOL|CCp_BatchDrainOrtoFungible",
    "TS02-C3.AQP-POOL|CCp_BatchDrainCollectable",
  ];

  it("reads groupBy off all three vacate blocks, THROUGH the type", () => {
    for (const key of VACATE) {
      const meta = partitionOf(key);
      expect(meta, `${key} carries no partition block`).toBeTruthy();
      // The assertion is on `meta.groupBy` as a DECLARED field, not on a cast: if it leaves the
      // interface again, this stops compiling rather than silently reading undefined.
      expect(meta!.groupBy, `${key} must declare the beneficiary boundary`).toBe("beneficiary-ids");
    }
  });

  /**
   * AND THE DRAIN FAMILY MUST NOT CARRY IT. The asymmetry is the evidence for both halves: drain
   * gates its settle triple behind `UR_AQP|UserUnn == 0` so it fires once however the legs are
   * cut, and vacate does not. A `groupBy` appearing here would mean someone had made the two
   * families look alike, and the cut that is sound for one is unsound for the other.
   */
  it("leaves the drain family ungrouped, which is what makes it cuttable anywhere", () => {
    for (const key of DRAIN) {
      const meta = partitionOf(key);
      expect(meta, `${key} carries no partition block`).toBeTruthy();
      expect(meta!.groupBy, `${key} gained a groupBy — the two families are not the same case`)
        .toBeUndefined();
    }
  });

  /** End to end: a real block, real arguments, grouped where the registry says to group. */
  it("cuts a real vacate block on its declared boundary", () => {
    const meta = partitionOf(VACATE[0]);
    const r = sliceFedArgs(meta, {
      patron: "P", "pool-id": "POOL", "dptf-id": "OURO",
      "owner-ids": ["o1", "o2", "o3", "o4"],
      "beneficiary-ids": ["b1", "b2", "b1", "b2"],
      amounts: [1, 2, 3, 4],
    }, 4);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.units, "four legs, two beneficiaries").toBe(2);
      expect(r.slices).toHaveLength(2);
      for (const s of r.slices)
        expect(new Set(s.args["beneficiary-ids"] as string[]).size).toBe(1);
    }
  });
});
