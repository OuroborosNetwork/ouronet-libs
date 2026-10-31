/**
 * THE MANIFEST CASE. Owner, 2026-10-27: "if i add a manifest for 100 tokens, each with 1000+
 * recipients, the UI should be able to create as many individual txes as needed to accommodate
 * whatever big the list is."
 *
 * That is 100,000 legs and it is NOT reachable by cutting one dimension: splitting the token axis
 * alone gives 100 single-token calls of 1,000 legs each, every one still far too large. So the
 * unit has to be the LEAF, and both levels have to be cut.
 */
import { describe, it, expect } from "vitest";
import { splitPlan, splitCallByCapacity, buildCall, RegistryError } from "../src/index.js";

const MB   = "TS01-C1.DPTF|C_MultiBulkTransfer";
const DPNF = "TS02-C2.DPNF|C_BulkTransfer";
const STAKE = "TS02-C3.AQP-POOL|CC_StakeNonFungibleCollectable";

/** A manifest of `tokens` tokens, each paying `per` recipients. */
function manifest(tokens: number, per: number) {
  return {
    patron: "P", executor: "E",
    "id-lst": Array.from({ length: tokens }, (_, t) => `TOK${t}`),
    "executee-array": Array.from({ length: tokens }, (_, t) =>
      Array.from({ length: per }, (_, r) => `acct-${t}-${r}`)),
    "transfer-amount-array": Array.from({ length: tokens }, (_, t) =>
      Array.from({ length: per }, (_, r) => (t + 1) * 1000 + r)),
  };
}
const legsOf = (v: Record<string, unknown>) =>
  (v["executee-array"] as string[][]).reduce((a, x) => a + x.length, 0);

describe("the 100 x 1000 manifest", () => {
  const big = manifest(100, 1000);

  it("counts 100,000 LEAVES, not 100 items", () => {
    expect(splitPlan(MB).leaves!(big)).toBe(100_000);
  });

  it("produces as many transactions as the capacity requires", () => {
    const calls = splitCallByCapacity(MB, big, 300);
    expect(calls.length).toBeGreaterThanOrEqual(Math.ceil(100_000 / 300));
    for (const c of calls) expect(legsOf(c)).toBeLessThanOrEqual(300);
  });

  it("loses nothing and reorders nothing — every leg survives in order", () => {
    const calls = splitCallByCapacity(MB, big, 437);
    const flatIn: string[] = (big["executee-array"] as string[][]).flat();
    const flatOut = calls.flatMap(c => (c["executee-array"] as string[][]).flat());
    expect(flatOut).toEqual(flatIn);
    // and the amounts travel with their own recipient, never re-paired
    const amtIn = (big["transfer-amount-array"] as number[][]).flat();
    const amtOut = calls.flatMap(c => (c["transfer-amount-array"] as number[][]).flat());
    expect(amtOut).toEqual(amtIn);
  });

  it("keeps each token's recipients paired with that token, in every emitted call", () => {
    for (const c of splitCallByCapacity(MB, big, 650)) {
      const ids = c["id-lst"] as string[];
      const recs = c["executee-array"] as string[][];
      expect(recs).toHaveLength(ids.length);
      ids.forEach((id, i) => {
        const t = id.replace("TOK", "");
        for (const r of recs[i]!) expect(r.startsWith(`acct-${t}-`)).toBe(true);
      });
    }
  });

  it("every emitted call still builds as real Pact code", () => {
    const calls = splitCallByCapacity(MB, manifest(4, 5), 7);
    for (const c of calls) {
      const code = buildCall(MB, c);
      expect(code).toContain("C_MultiBulkTransfer");
    }
  });
});

describe("both levels are used, and only as needed", () => {
  it("packs WHOLE tokens together when they fit", () => {
    // 10 tokens x 10 recipients = 100 legs, capacity 100 -> one transaction
    expect(splitCallByCapacity(MB, manifest(10, 10), 100)).toHaveLength(1);
  });

  it("cuts a single oversized token internally, keeping the outer shape", () => {
    // one token, 1,000 recipients, capacity 300 -> 4 calls, each a ONE-token call
    const calls = splitCallByCapacity(MB, manifest(1, 1000), 300);
    expect(calls).toHaveLength(4);
    for (const c of calls) {
      expect((c["id-lst"] as string[])).toHaveLength(1);
      expect((c["executee-array"] as string[][])).toHaveLength(1);
      expect(legsOf(c)).toBeLessThanOrEqual(300);
    }
  });

  it("mixes both: small tokens grouped, a giant one split alone", () => {
    const v = {
      patron: "P", executor: "E",
      "id-lst": ["A", "B", "HUGE", "C"],
      "executee-array": [["a1", "a2"], ["b1"], Array.from({ length: 50 }, (_, i) => `h${i}`), ["c1"]],
      "transfer-amount-array": [[1, 2], [3], Array.from({ length: 50 }, (_, i) => i), [9]],
    };
    const calls = splitCallByCapacity(MB, v, 10);
    for (const c of calls) expect(legsOf(c)).toBeLessThanOrEqual(10);
    // the giant token appears alone in its calls, never grouped with a neighbour
    for (const c of calls) {
      const ids = c["id-lst"] as string[];
      if (ids.includes("HUGE")) expect(ids).toEqual(["HUGE"]);
    }
    expect(calls.flatMap(c => (c["executee-array"] as string[][]).flat()))
      .toEqual((v["executee-array"] as string[][]).flat());
  });

  it("FLUSHES a running group when the next whole token would overflow it", () => {
    // Found by mutation testing: every other fixture here has tokens that individually exceed
    // capacity, so they all take the oversized-element branch and the greedy FLUSH is never
    // exercised. Deleting the flush left all tests green. Here each token is small (5 legs,
    // under the capacity of 12) but ten of them are not, so only the flush can keep the calls
    // inside the budget.
    const v = manifest(10, 5);                       // 10 tokens x 5 = 50 legs
    const calls = splitCallByCapacity(MB, v, 12);
    expect(calls.length).toBeGreaterThan(1);
    for (const c of calls) {
      expect(legsOf(c)).toBeLessThanOrEqual(12);
      // no token was cut internally -- whole tokens were grouped, which is the cheaper plan
      for (const recs of c["executee-array"] as string[][]) expect(recs).toHaveLength(5);
    }
    expect(calls.flatMap(c => (c["id-lst"] as string[]))).toEqual(v["id-lst"]);
  });

  it("a flat axis needs no second level and still respects capacity", () => {
    const nonces = Array.from({ length: 97 }, (_, i) => i + 1);
    const calls = splitCallByCapacity(STAKE, { nonces }, 20);
    for (const c of calls) expect((c.nonces as number[]).length).toBeLessThanOrEqual(20);
    expect(calls.flatMap(c => c.nonces as number[])).toEqual(nonces);
  });
});

describe("it refuses rather than mispairs", () => {
  it("refuses an unclassified entrypoint", () => {
    expect(() => splitCallByCapacity("TS01-C1.DPTF|C_Transfer", { amount: 1 }, 10))
      .toThrow(/no split judgement/);
  });

  it("refuses an inner companion of the wrong per-element length", () => {
    const bad = {
      patron: "P", executor: "E", "id-lst": ["A"],
      "executee-array": [["a1", "a2", "a3"]],
      "transfer-amount-array": [[1, 2]],              // one short
    };
    expect(() => splitCallByCapacity(MB, bad, 2)).toThrow(RegistryError);
    expect(() => splitCallByCapacity(MB, bad, 2)).toThrow(/POSITIONAL/);
  });

  it("refuses when the nested array length disagrees with the outer axis", () => {
    const bad = {
      "id-lst": ["A", "B"], "executee-array": [["a"]], "transfer-amount-array": [[1]],
    };
    expect(() => splitCallByCapacity(MB, bad, 5)).toThrow(/same length/);
  });

  it("refuses a nonsensical capacity", () => {
    expect(() => splitCallByCapacity(MB, manifest(1, 1), 0)).toThrow(/positive/);
  });

  it("handles an empty manifest without emitting nothing", () => {
    const empty = { patron: "P", "id-lst": [], "executee-array": [], "transfer-amount-array": [] };
    expect(splitCallByCapacity(MB, empty, 10)).toHaveLength(1);
  });
});

describe("the nonce-bearing bulk transfers cut on both levels too", () => {
  it("splits recipients, then one recipient's nonce list", () => {
    const v = {
      patron: "P", executor: "E", id: "DHN", method: false,
      "executee-lst": ["r1", "r2"],
      "nonces-array": [[1, 2, 3], Array.from({ length: 40 }, (_, i) => 100 + i)],
      "amounts-array": [[1, 1, 1], Array.from({ length: 40 }, () => 1)],
    };
    const calls = splitCallByCapacity(DPNF, v, 10);
    for (const c of calls) {
      const legs = (c["nonces-array"] as number[][]).reduce((a, x) => a + x.length, 0);
      expect(legs).toBeLessThanOrEqual(10);
      // amounts stay element-for-element with nonces in every call
      (c["nonces-array"] as number[][]).forEach((ns, i) =>
        expect((c["amounts-array"] as number[][])[i]).toHaveLength(ns.length));
    }
    expect(calls.flatMap(c => (c["nonces-array"] as number[][]).flat()))
      .toEqual((v["nonces-array"] as number[][]).flat());
  });
});

describe("a GROUP BOUNDARY is never cut through", () => {
  const VAC = "TS02-C3.AQP-POOL|CCp_BatchVacateTrueFungible";
  /**
   * THE CONTRAST PARTNER CHANGED, and it had to: `CCp_BatchDrainTrueFungible` was this test's
   * no-boundary half until V18 renamed the drain trio to `AQP-POOL|AAp_BatchDrain*`. This
   * registry indexes the CLIENT bands only, so `getEntrypoint` on the old key now THROWS and
   * both assertions died at resolution rather than on their claim.
   *
   * `AQP-EVCT|CCp_EvictMultiRewards` is the better partner anyway: it is live, it is the same
   * shape (parallel leg arrays each tagged with a beneficiary), and its authored block states
   * the asymmetry as a decision rather than as an omission — a vacate settles per beneficiary
   * on the RESULTING `UR_AQP|UserUnn`, so splitting one beneficiary's legs settles early;
   * eviction touches no scores and each leg runs a self-collect's own phases against its own
   * lane, so one beneficiary's legs may land in different transactions.
   */
  const EVC = "TS02-C3.AQP-EVCT|CCp_EvictMultiRewards";

  /** `owners` legs, each tagged with a beneficiary. */
  const legs = (benefs: string[]) => ({
    patron: "P", executor: "E", "pool-id": "POOL", "dptf-id": "TOK",
    "owner-ids": benefs.map((b, i) => `owner-${b}-${i}`),
    "beneficiary-ids": [...benefs],
    amounts: benefs.map((_, i) => i + 1),
  });
  const benefsOf = (c: Record<string, unknown>) => c["beneficiary-ids"] as string[];

  it("declares the boundary on the vacate trio and NOT on the eviction slice", () => {
    expect(splitPlan(VAC).groupBy).toBe("beneficiary-ids");
    expect(splitPlan(EVC).groupBy).toBeNull();
    expect(splitPlan(VAC).warnings.join(" ")).toMatch(/GROUP BOUNDARY on 'beneficiary-ids'/);
    // BOTH ARE CLASSIFIED. `groupBy: null` means "cut anywhere"; an UNCLASSIFIED entrypoint
    // also reports null and means "do not cut at all". Without this line the assertion above
    // would pass just as well on an entrypoint that lost its partition block entirely.
    expect(splitPlan(EVC).kind).toBe("list");
    expect(splitPlan(EVC).axis).toBe("beneficiaries");
    expect(splitPlan(EVC).warnings.join(" ")).not.toMatch(/GROUP BOUNDARY/);
  });

  it("keeps every beneficiary's legs in ONE transaction", () => {
    // B appears 4 times, A twice, C once. Capacity 3 forces a split somewhere.
    const v = legs(["A", "B", "B", "A", "B", "C", "B"]);
    const calls = splitCallByCapacity(VAC, v, 3);
    const seen = new Map<string, number>();
    calls.forEach((c, ci) => {
      for (const b of new Set(benefsOf(c))) {
        expect(seen.has(b), `${b} appears in more than one transaction`).toBe(false);
        seen.set(b, ci);
      }
    });
    expect([...seen.keys()].sort()).toEqual(["A", "B", "C"]);
  });

  it("handles NON-CONTIGUOUS groups — a preflight need not sort", () => {
    const v = legs(["A", "B", "A", "B", "A"]);
    const calls = splitCallByCapacity(VAC, v, 3);
    for (const c of calls) {
      const u = new Set(benefsOf(c));
      // whichever call holds A must hold ALL three A legs
      if (u.has("A")) expect(benefsOf(c).filter(b => b === "A")).toHaveLength(3);
      if (u.has("B")) expect(benefsOf(c).filter(b => b === "B")).toHaveLength(2);
    }
    // nothing lost
    expect(calls.flatMap(benefsOf).sort()).toEqual(["A", "A", "A", "B", "B"]);
  });

  it("the companion arrays travel with their own leg, not by position", () => {
    const v = legs(["A", "B", "A"]);
    const calls = splitCallByCapacity(VAC, v, 2);
    for (const c of calls) {
      const owners = c["owner-ids"] as string[];
      const bens = benefsOf(c);
      const amts = c.amounts as number[];
      expect(owners).toHaveLength(bens.length);
      expect(amts).toHaveLength(bens.length);
      // owner-<benef>-<originalIndex> encodes its own pairing, so a mispair is detectable
      owners.forEach((o, i) => expect(o.startsWith(`owner-${bens[i]}-`)).toBe(true));
      owners.forEach((o, i) => expect(Number(o.split("-")[2]) + 1).toBe(amts[i]));
    }
  });

  it("emits a single over-capacity group ALONE rather than cutting it", () => {
    // B alone is 5 legs against a capacity of 3. Splitting B is the one forbidden cut.
    const v = legs(["A", "B", "B", "B", "B", "B"]);
    const calls = splitCallByCapacity(VAC, v, 3);
    const bCall = calls.find(c => benefsOf(c).includes("B"))!;
    expect(benefsOf(bCall)).toEqual(["B", "B", "B", "B", "B"]);   // intact, and oversized
    expect(benefsOf(bCall)).not.toContain("A");                    // and alone
  });

  it("the EVICTION slice has no boundary and cuts freely — the asymmetry is real", () => {
    // Same data, no groupBy: one beneficiary's legs MAY span transactions, because eviction
    // settles nothing per beneficiary — each leg is an independent collect on its own lane.
    const v = {
      patron: "P", executor: "E", "fvt-id": "FVT",
      beneficiaries: ["A", "A", "A", "A"],
      "score-entity-types": [1, 1, 1, 1],
      "score-entity-ids": ["s0", "s1", "s2", "s3"],
      "reward-dptf-ids": ["R", "R", "R", "R"],
    };
    const calls = splitCallByCapacity(EVC, v, 2);
    expect(calls).toHaveLength(2);
    expect(calls.every(c => (c.beneficiaries as string[]).every(b => b === "A"))).toBe(true);
    // the lockstep arrays travel with their own leg, so nothing is lost or re-paired
    expect(calls.flatMap(c => c["score-entity-ids"] as string[]))
      .toEqual(["s0", "s1", "s2", "s3"]);
  });

  it("refuses a groupBy array of the wrong length rather than mispairing", () => {
    const v = { ...legs(["A", "B"]), "beneficiary-ids": ["A"] };
    expect(() => splitCallByCapacity(VAC, v, 2)).toThrow(/must be an array of length 2/);
  });
});

describe("group boundaries in TWO dimensions, and overflow without an oversized group", () => {
  const VACN = "TS02-C3.AQP-POOL|CCp_BatchVacateCollectables";   // has an `inner` level
  const VAC  = "TS02-C3.AQP-POOL|CCp_BatchVacateTrueFungible";   // flat

  /** nested vacate legs: each owner-leg carries its own nonce list, tagged by beneficiary */
  const nlegs = (spec: Array<[string, number]>) => ({
    patron: "P", executor: "E", "pool-id": "POOL", "collectable-id": "C", son: false,
    "owner-ids": spec.map(([b], i) => `owner-${b}-${i}`),
    "beneficiary-ids": spec.map(([b]) => b),
    "nonces-array": spec.map(([, n], i) => Array.from({ length: n }, (_, j) => i * 100 + j)),
    "amounts-array": spec.map(([, n]) => Array.from({ length: n }, () => 1)),
  });
  const bens = (c: Record<string, unknown>) => c["beneficiary-ids"] as string[];
  const nonceLegs = (c: Record<string, unknown>) =>
    (c["nonces-array"] as number[][]).reduce((a, x) => a + x.length, 0);

  it("the NESTED vacate honours the boundary and sizes groups by LEAF count", () => {
    // Found by mutation testing: every earlier group test used the FLAT variant, so the nested
    // path's boundary check was never exercised and deleting it changed nothing.
    const v = nlegs([["A", 3], ["B", 2], ["A", 2], ["C", 4]]);
    const calls = splitCallByCapacity(VACN, v, 6);
    const seen = new Set<string>();
    for (const c of calls) {
      for (const b of new Set(bens(c))) {
        expect(seen.has(b), `${b} spans two transactions`).toBe(false);
        seen.add(b);
      }
    }
    // A is 3 + 2 = 5 LEAVES across two non-adjacent legs; both must land together
    const aCall = calls.find(c => bens(c).includes("A"))!;
    expect(bens(aCall).filter(b => b === "A")).toHaveLength(2);
    expect(calls.flatMap(c => (c["nonces-array"] as number[][]).flat()).length)
      .toBe(3 + 2 + 2 + 4);
    // and amounts stay element-for-element with nonces in every call
    for (const c of calls) {
      (c["nonces-array"] as number[][]).forEach((ns, i) =>
        expect((c["amounts-array"] as number[][])[i]).toHaveLength(ns.length));
    }
    expect(Math.max(...calls.map(nonceLegs))).toBeLessThanOrEqual(6);
  });

  it("FLUSHES when accumulated groups overflow, with no oversized group involved", () => {
    // Also found by mutation testing: in every earlier fixture the overflow coincided with an
    // oversized group, which is handled by a different branch -- so the ordinary flush never
    // ran and removing it left the tests green. Three 2-leg groups against a capacity of 3
    // can only be split by the flush.
    const v = nlegs([["A", 2], ["B", 2], ["C", 2]]);
    const calls = splitCallByCapacity(VACN, v, 3);
    expect(calls.length).toBeGreaterThan(1);
    for (const c of calls) expect(nonceLegs(c)).toBeLessThanOrEqual(3);
    expect(calls.flatMap(bens).sort()).toEqual(["A", "B", "C"]);
  });

  it("flushes on the FLAT path too, for the same reason", () => {
    const v = {
      patron: "P", "pool-id": "POOL", "dptf-id": "TOK",
      "owner-ids": ["o1", "o2", "o3"],
      "beneficiary-ids": ["A", "B", "C"],
      amounts: [1, 2, 3],
    };
    const calls = splitCallByCapacity(VAC, v, 2);
    expect(calls.length).toBeGreaterThan(1);
    for (const c of calls) {
      expect((c["beneficiary-ids"] as string[]).length).toBeLessThanOrEqual(2);
    }
    expect(calls.flatMap(c => c["beneficiary-ids"] as string[]).sort())
      .toEqual(["A", "B", "C"]);
  });
});
