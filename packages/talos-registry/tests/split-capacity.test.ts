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
