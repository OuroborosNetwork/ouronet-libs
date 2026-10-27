/**
 * THE SPLIT JUDGEMENT, AND THE CUT THAT USES IT.
 *
 * Two properties matter more than the rest and are tested first: an UNCLASSIFIED entrypoint must
 * refuse to be cut (absence is not permission), and a lockstep companion whose length disagrees
 * with the axis must refuse rather than be repaired. Padding or truncating would produce two
 * arrays that line up by length and are MISALIGNED -- moving a real quantity to the wrong place
 * with no error from the contract.
 */
import { describe, it, expect } from "vitest";
import { splitPlan, splitCall, registry, entrypointKeys, RegistryError } from "../src/index.js";

const UNSTAKE = "TS02-C3.AQP-POOL|CC_UnstakeNonFungibleCollectable";
const BULK    = "TS02-C2.DPNF|C_BulkTransfer";
const MERGE   = "TS01-C2.VST|C_Merge";
const TRANSFER = "TS01-C1.DPTF|C_Transfer";   // no list parameter -> unclassified

describe("absence means do not split", () => {
  it("reports an unclassified entrypoint as not splittable, with a reason", () => {
    const p = splitPlan(TRANSFER);
    expect(p.shape).toBeNull();
    expect(p.splittable).toBe(false);
    expect(p.parallel).toBe(false);
    expect(p.warnings.join(" ")).toMatch(/UNCLASSIFIED/);
  });

  it("REFUSES to cut an unclassified entrypoint rather than defaulting to allow", () => {
    expect(() => splitCall(TRANSFER, { amount: 1 }, 2)).toThrow(RegistryError);
    expect(() => splitCall(TRANSFER, { amount: 1 }, 2)).toThrow(/no split judgement/);
  });

  it("the vast majority of the surface is unclassified, which is the safe default", () => {
    const classified = entrypointKeys().filter(k => splitPlan(k).splittable);
    expect(classified.length).toBe(20);
    expect(classified.length).toBeLessThan(entrypointKeys().length / 10);
  });
});

describe("lockstep companions", () => {
  it("cuts companions on exactly the axis boundaries", () => {
    const parts = splitCall(UNSTAKE, {
      patron: "P", executor: "E", executee: "B", "pool-id": "POOL", "collectable-id": "C",
      nonces: [1, 2, 3, 4, 5], "nonce-amounts": [10, 20, 30, 40, 50],
    }, 2);
    expect(parts).toHaveLength(2);
    expect(parts[0]!.nonces).toEqual([1, 2, 3]);
    expect(parts[0]!["nonce-amounts"]).toEqual([10, 20, 30]);
    expect(parts[1]!.nonces).toEqual([4, 5]);
    expect(parts[1]!["nonce-amounts"]).toEqual([40, 50]);
    // non-axis parameters pass through unchanged
    expect(parts[1]!["pool-id"]).toBe("POOL");
  });

  it("REFUSES a length mismatch instead of padding or truncating", () => {
    const bad = () => splitCall(UNSTAKE, {
      nonces: [1, 2, 3], "nonce-amounts": [10, 20],
    }, 2);
    expect(bad).toThrow(RegistryError);
    expect(bad).toThrow(/POSITIONAL/);
    expect(bad).toThrow(/misaligned/);
  });

  it("refuses when a companion is not an array at all", () => {
    expect(() => splitCall(UNSTAKE, { nonces: [1, 2], "nonce-amounts": 5 }, 2))
      .toThrow(/must be an array/);
  });

  it("refuses when the axis is not an array", () => {
    expect(() => splitCall(UNSTAKE, { nonces: 7, "nonce-amounts": [1] }, 2))
      .toThrow(/axis 'nonces' must be an array/);
  });

  it("warns about every companion by name", () => {
    const p = splitPlan(BULK);
    expect(p.lockstep).toEqual(["nonces-array", "amounts-array"]);
    expect(p.warnings.join(" ")).toContain("nonces-array, amounts-array");
  });
});

describe("shapes", () => {
  it("a partition is parallel and carries no rounds note", () => {
    const p = splitPlan(UNSTAKE);
    expect(p.shape).toBe("partition");
    expect(p.parallel).toBe(true);
    expect(p.rounds).toBeNull();
  });

  it("a reduction is NOT parallel and says how the next round is formed", () => {
    const p = splitPlan(MERGE);
    expect(p.shape).toBe("reduction");
    expect(p.parallel).toBe(false);
    expect(p.rounds).toMatch(/until one nonce remains/);
    expect(p.warnings.join(" ")).toMatch(/does NOT complete the operation/);
  });

  it("all four VST merge/slumber entrypoints are reductions", () => {
    for (const k of ["TS01-C2.VST|C_Merge", "TS01-C2.VST|C_Slumber",
                     "TS01-C2.VST|C_RepurposeMerge", "TS01-C2.VST|C_RepurposeSlumber"]) {
      expect(splitPlan(k).shape).toBe("reduction");
    }
  });

  it("every nonce-bearing bulk transfer is a partition on the recipient list", () => {
    for (const k of ["TS02-C2.DPNF|C_BulkTransfer", "TS02-C1.DPSF|C_BulkTransfer",
                     "TS02-C1.DPDC|C_BulkTransfer", "TS01-C1.DPOF|C_BulkTransfer"]) {
      const p = splitPlan(k);
      expect(p.shape).toBe("partition");
      expect(p.axis).toBe("executee-lst");
    }
  });
});

describe("the cut is lossless and balanced", () => {
  it("concatenating the slices reproduces the axis exactly, in order", () => {
    const nonces = Array.from({ length: 97 }, (_, i) => i + 1);
    const parts = splitCall(UNSTAKE, { nonces, "nonce-amounts": nonces.map(n => n * 2) }, 7);
    expect(parts.flatMap(p => p.nonces as number[])).toEqual(nonces);
    expect(parts.flatMap(p => p["nonce-amounts"] as number[])).toEqual(nonces.map(n => n * 2));
  });

  it("balances rather than leaving a near-empty final slice", () => {
    const nonces = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sizes = splitCall(UNSTAKE, { nonces, "nonce-amounts": nonces }, 3)
      .map(p => (p.nonces as number[]).length);
    expect(sizes).toEqual([4, 3, 3]);
  });

  it("never returns more slices than there are items", () => {
    const parts = splitCall(UNSTAKE, { nonces: [1, 2], "nonce-amounts": [1, 2] }, 9);
    expect(parts).toHaveLength(2);
  });

  it("rejects a nonsensical part count", () => {
    expect(() => splitCall(UNSTAKE, { nonces: [1], "nonce-amounts": [1] }, 0)).toThrow(/positive/);
    expect(() => splitCall(UNSTAKE, { nonces: [1], "nonce-amounts": [1] }, 1.5)).toThrow(/integer/);
  });
});

describe("every authored claim holds against the signature", () => {
  it("each axis and companion is a declared, list-typed parameter", () => {
    for (const key of entrypointKeys()) {
      const p = registry.entrypoints[key]!.execution.partition;
      if (!p) continue;
      const types = new Map(registry.entrypoints[key]!.params.map(q => [q.name, q.type]));
      expect(types.get(p.axis), `${key} axis ${p.axis}`).toBeDefined();
      expect(types.get(p.axis)!.startsWith("["), `${key} axis is a list`).toBe(true);
      for (const c of p.lockstep ?? []) {
        expect(types.get(c), `${key} lockstep ${c}`).toBeDefined();
        expect(types.get(c)!.startsWith("["), `${key} ${c} is a list`).toBe(true);
      }
      expect(p.reason.length, `${key} has a reason`).toBeGreaterThan(40);
      if (p.shape === "reduction") expect(p.rounds, `${key} rounds`).toBeTruthy();
      else expect(p.rounds, `${key} must not claim rounds`).toBeUndefined();
    }
  });

  it("the liquidity and pool-issue ops are deliberately NOT classified", () => {
    // Their legs are priced against pool state an earlier batch has moved, and the deviation
    // ceiling is evaluated per call -- so a split is a different operation, not a finer one.
    // They have 3-step defpact twins for exactly this. If one ever gains a partition block,
    // this test is the place that should have objected.
    for (const k of entrypointKeys()) {
      if (/C_Add\w*Liquidity|C_Issue\w*(Pool|Stable|Standard|Weighted)/.test(k)) {
        expect(splitPlan(k).splittable, `${k} must stay unclassified`).toBe(false);
      }
    }
  });
});
