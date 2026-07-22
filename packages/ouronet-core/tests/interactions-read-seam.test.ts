/**
 * Behavioural regression guard for the pactRead injection seam — closes audit
 * finding F-CORE-006 ("silent drift back to a direct Kadena client call").
 *
 * Every pure on-chain read inside `src/interactions/*` was migrated in Phase 2
 * of the arch-layering-and-seams spec to route through the configured
 * pactRead seam. This test installs a counting stub via `setPactReader` and
 * asserts each migrated function actually invokes the seam, with the locked
 * tier value the phase Goal block fixed for that site. The test fails if any
 * call site silently regresses to a direct `createClient(...).dirtyRead(...)`
 * call (the stub would never fire) or drifts to a different tier (the cache
 * layer downstream consumers install on top of the seam keys off the tier).
 *
 * Original sixteen migration sites — file:line of the pre-state read body:
 *   1.  src/interactions/kadenaFunctions.ts:16            → T1 getBalance
 *   2.  src/interactions/kadenaFunctions.ts:36            → T5 accountDescription
 *   3.  src/interactions/wrapFunctions.ts:48              → T2 getWrapStoaInfo
 *   4.  src/interactions/wrapFunctions.ts:72              → T5 getWrapperPaymentKey
 *   5.  src/interactions/wrapFunctions.ts:96              → T1 getPaymentKeyBalance
 *   6.  src/interactions/wrapFunctions.ts:244             → T2 getWrapUrStoaInfo
 *   7.  src/interactions/addLiquidityFunctions.ts:102     → T2 generateLiquidityData
 *   8.  src/interactions/addLiquidityFunctions.ts:138     → T2 validateLiquidityDeviation
 *   9.  src/interactions/addLiquidityFunctions.ts:208     → T2 calculateBalancedLiquidity
 *   10. src/interactions/addLiquidityFunctions.ts:253     → T7 getLPTypeInfo (UR_IzFrozenLP)
 *   11. src/interactions/addLiquidityFunctions.ts:271     → T7 getLPTypeInfo (UR_IzSleepingLP)
 *   12. src/interactions/addLiquidityFunctions.ts:853     → T2 getBalancedLiquidity
 *   13. src/interactions/addLiquidityFunctions.ts:878     → T2 getSortLiquidity
 *   14. src/interactions/addLiquidityFunctions.ts:902     → T2 getLiquidityData
 *   15. src/interactions/addLiquidityFunctions.ts:928     → T2 validateLiquidity
 *   16. src/interactions/crossChainFunctions.ts:398       → T2 simulateTransaction
 *
 * Sites 10 and 11 belong to the same exported function (`getLPTypeInfo`) — its
 * `Promise.all` fires both reads in a single call, so the test asserts a single
 * function invocation produces exactly two stub calls (15 it-blocks total).
 *
 * Tier values are hardcoded from the Phase Goal block (NOT read from Wave-1
 * task notes), per locked decision — the Goal block is the authoritative source
 * of truth and reading from notes risks propagating an implementer mistake.
 *
 * SCOPE: this guard pins (a) every site routes through the seam, and (b) the
 * tier value passed at each site. It does NOT exhaustively pin the response
 * unwrap shapes — the per-function stub catalog uses the simplest data branch
 * compatible with each unwrap path (e.g. plain string for `coin.get-balance`).
 * The production-realistic `{ decimal: ... }` envelope and the `{ int: ... }`
 * envelope branches are NOT exercised through this guard. Coverage of those
 * branches lives in each function's domain-specific test file (or is owed to a
 * future broader behavioural-test surface). This narrower scope is deliberate:
 * the guard's value is catching seam regressions, not response-shape drift.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getBalance, accountDescription } from "../src/interactions/kadenaFunctions";
import {
  getWrapStoaInfo,
  getWrapperPaymentKey,
  getPaymentKeyBalance,
  getWrapUrStoaInfo,
} from "../src/interactions/wrapFunctions";
import {
  generateLiquidityData,
  validateLiquidityDeviation,
  calculateBalancedLiquidity,
  getLPTypeInfo,
  getBalancedLiquidity,
  getSortLiquidity,
  getLiquidityData,
  validateLiquidity,
} from "../src/interactions/addLiquidityFunctions";
import { simulateTransaction } from "../src/interactions/crossChainFunctions";
import { getPactUrl } from "../src/constants";

type Call = { pactCode: string; options?: Parameters<PactReader>[1] };

let calls: Call[] = [];

/**
 * Counting stub — records every (pactCode, options) pair and returns a
 * response shape compatible with each migrated function's unwrap path. The
 * shape is dispatched off a substring of `pactCode` so a single stub serves
 * all 15 functions without per-test reconfiguration.
 */
const stub: PactReader = (pactCode, options) => {
  calls.push({ pactCode, options });

  // coin.get-balance — getBalance + getPaymentKeyBalance. String "0" exercises
  // the non-decimal-object branch of both unwrap paths.
  if (pactCode.includes("coin.get-balance")) {
    return Promise.resolve({ result: { status: "success", data: "0" } });
  }

  // coin.details — accountDescription. Object envelope mirrors the real Kadena
  // response shape (balance + account + guard).
  if (pactCode.includes("coin.details")) {
    return Promise.resolve({
      result: {
        status: "success",
        data: { balance: "0", account: "k:abc", guard: { keys: ["pub"], pred: "keys-all" } },
      },
    });
  }

  // UR_AccountKadena — getWrapperPaymentKey returns String(data); a plain
  // string suffices.
  if (pactCode.includes("UR_AccountKadena")) {
    return Promise.resolve({ result: { status: "success", data: "k:abc" } });
  }

  // INFO_WrapStoa / INFO_WrapUrStoa — getWrapStoaInfo / getWrapUrStoaInfo
  // forward `(response.result as any).data` to the caller; an object suffices.
  if (pactCode.includes("INFO_WrapStoa") || pactCode.includes("INFO_WrapUrStoa")) {
    return Promise.resolve({
      result: { status: "success", data: { ignis: "0.0", kadena: "0.0" } },
    });
  }

  // UR_IzFrozenLP / UR_IzSleepingLP — getLPTypeInfo's two parallel reads;
  // returns a boolean. Each IIFE in the Promise.all wraps its body in
  // try/catch — exact `data === true` comparison is the unwrap.
  if (pactCode.includes("UR_IzFrozenLP") || pactCode.includes("UR_IzSleepingLP")) {
    return Promise.resolve({ result: { status: "success", data: false } });
  }

  // URC_BalancedLiquidity — calculateBalancedLiquidity + getBalancedLiquidity
  // expect an array of decimal-stringable values.
  if (pactCode.includes("URC_BalancedLiquidity")) {
    return Promise.resolve({ result: { status: "success", data: ["1.0", "2.0"] } });
  }

  // URC_SortLiquidity — getSortLiquidity destructures data.balanced /
  // data.asymmetric.
  if (pactCode.includes("URC_SortLiquidity")) {
    return Promise.resolve({
      result: { status: "success", data: { balanced: ["1.0"], asymmetric: ["0.5"] } },
    });
  }

  // UEV_Liquidity — validateLiquidityDeviation + validateLiquidity expect
  // [computed_deviation, max_deviation] string array.
  if (pactCode.includes("UEV_Liquidity")) {
    return Promise.resolve({ result: { status: "success", data: ["0.01", "0.05"] } });
  }

  // URC_LD — generateLiquidityData + getLiquidityData forward result.data as
  // an arbitrary LiquidityData object.
  if (pactCode.includes("URC_LD")) {
    return Promise.resolve({ result: { status: "success", data: { foo: "bar" } } });
  }

  // simulateTransaction — caller passes an arbitrary pactCodeString; the
  // function reads result.result.status AND result.gas. The two-level envelope
  // already covers status; gas is added at the outer level.
  return Promise.resolve({
    result: { status: "success", data: { simulated: true } },
    gas: 100,
  });
};

beforeEach(() => {
  calls = [];
  setPactReader(stub);
});

afterEach(() => {
  setPactReader(rawCalibratedDirtyRead);
});

describe("interactions read-seam regression guard (F-CORE-006)", () => {
  // ── kadenaFunctions ─────────────────────────────────────────────────────
  it("getBalance routes through pactRead at tier T1", async () => {
    // Stub returns { result: { status: "success", data: "0" } } — getBalance's
    // unwrap collapses to balance: "0".
    const out = await getBalance("k:abc");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T1");
    expect(calls[0].pactCode).toContain("coin.get-balance");
    expect(out).toEqual({ account: "k:abc", balance: "0" });
  });

  it("accountDescription routes through pactRead at tier T5", async () => {
    // Stub returns object data with balance/account/guard — exercises the
    // success branch (isNewAccount: false).
    const out = await accountDescription("k:abc");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T5");
    expect(calls[0].pactCode).toContain("coin.details");
    expect(out.isNewAccount).toBe(false);
    expect(out.balance).toBe("0");
  });

  // ── wrapFunctions ───────────────────────────────────────────────────────
  it("getWrapStoaInfo routes through pactRead at tier T2", async () => {
    // Stub returns INFO_WrapStoa shape — function forwards result.data as-is.
    const out = await getWrapStoaInfo("patron", "wrapper", "1.0");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("INFO_WrapStoa");
    expect(out).toEqual({ ignis: "0.0", kadena: "0.0" });
  });

  it("getWrapperPaymentKey routes through pactRead at tier T5", async () => {
    // Stub returns string "k:abc" — function wraps in String(...) and returns.
    const out = await getWrapperPaymentKey("wrapper");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T5");
    expect(calls[0].pactCode).toContain("UR_AccountKadena");
    expect(out).toBe("k:abc");
  });

  it("getPaymentKeyBalance routes through pactRead at tier T1", async () => {
    // Stub returns "0" — function's String→parseFloat fallback yields 0.
    const out = await getPaymentKeyBalance("k:payment");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T1");
    expect(calls[0].pactCode).toContain("coin.get-balance");
    expect(out).toBe(0);
  });

  it("getWrapUrStoaInfo routes through pactRead at tier T2", async () => {
    // Stub returns INFO_WrapUrStoa shape — function forwards result.data as-is.
    const out = await getWrapUrStoaInfo("patron", "wrapper", "1.0");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("INFO_WrapUrStoa");
    expect(out).toEqual({ ignis: "0.0", kadena: "0.0" });
  });

  // ── addLiquidityFunctions ───────────────────────────────────────────────
  it("generateLiquidityData routes through pactRead at tier T2", async () => {
    // Stub returns URC_LD shape — function casts result.data to LiquidityData.
    const out = await generateLiquidityData("swpair", "tokenA", [1, 2]);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("URC_LD");
    expect(out).toEqual({ foo: "bar" });
  });

  it("validateLiquidityDeviation routes through pactRead at tier T2", async () => {
    // Stub returns UEV_Liquidity success array ["0.01", "0.05"] — function
    // returns { deviation: 0.01, maxDeviation: 0.05, isValid: true }.
    const out = await validateLiquidityDeviation("swpair", { foo: "bar" });
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("UEV_Liquidity");
    expect(out?.isValid).toBe(true);
  });

  it("calculateBalancedLiquidity routes through pactRead at tier T2", async () => {
    // Stub returns URC_BalancedLiquidity ["1.0","2.0"] — function returns the
    // mapped string array.
    const out = await calculateBalancedLiquidity("swpair", "tokenA", "1");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("URC_BalancedLiquidity");
    expect(out).toEqual(["1.0", "2.0"]);
  });

  it("getLPTypeInfo invokes pactRead exactly twice at tier T7 (UR_IzFrozenLP + UR_IzSleepingLP)", async () => {
    // The two IIFEs inside getLPTypeInfo's Promise.all each wrap their body in
    // try { ... } catch { return false; }. A `>= 2` assertion would mask one
    // IIFE throwing before reaching pactRead and silently being caught — the
    // exact `toBe(2)` assertion catches that regression.
    const out = await getLPTypeInfo("swpair");
    expect(calls.length).toBe(2);
    expect(calls[0].options?.tier).toBe("T7");
    expect(calls[1].options?.tier).toBe("T7");
    const codes = calls.map((c) => c.pactCode).join(" | ");
    expect(codes).toContain("UR_IzFrozenLP");
    expect(codes).toContain("UR_IzSleepingLP");
    expect(out).toEqual({ hasFrozenLP: false, hasSleepingLP: false });
  });

  it("getBalancedLiquidity routes through pactRead at tier T2", async () => {
    // Stub returns URC_BalancedLiquidity ["1.0","2.0"].
    const out = await getBalancedLiquidity("swpair", "tokenA", "1");
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("URC_BalancedLiquidity");
    expect(out).toEqual(["1.0", "2.0"]);
  });

  it("getSortLiquidity routes through pactRead at tier T2", async () => {
    // Stub returns URC_SortLiquidity { balanced, asymmetric } object.
    const out = await getSortLiquidity("swpair", ["1", "2"]);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("URC_SortLiquidity");
    expect(out).toEqual({ balanced: ["1.0"], asymmetric: ["0.5"] });
  });

  it("getLiquidityData routes through pactRead at tier T2", async () => {
    // Stub returns URC_LD shape — function returns result.data as-is.
    const out = await getLiquidityData("swpair", ["1", "2"]);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("URC_LD");
    expect(out).toEqual({ foo: "bar" });
  });

  it("validateLiquidity routes through pactRead at tier T2", async () => {
    // Stub returns UEV_Liquidity ["0.01","0.05"] — function returns
    // { valid: true, computed: "0.01", max: "0.05" }.
    const out = await validateLiquidity("swpair", ["1", "2"]);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].pactCode).toContain("UEV_Liquidity");
    expect(out.valid).toBe(true);
  });

  // ── crossChainFunctions ────────────────────────────────────────────────
  it("simulateTransaction routes through pactRead at tier T2 with dynamic chainId + pactUrl", async () => {
    // Unlike all other migrated reads, simulateTransaction threads the
    // caller-supplied chainId through to options.chainId AND options.pactUrl —
    // assert both alongside the tier.
    const chainId = "3";
    // Use a generic pactCode that doesn't collide with any other stub branch —
    // simulateTransaction's success path reads result.gas at the OUTER envelope
    // level (not inside result.result), so the fallback branch supplying
    // top-level gas is the one we want exercising here.
    const out = await simulateTransaction(`(my.module.fn "arg")`, chainId);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].options?.tier).toBe("T2");
    expect(calls[0].options?.chainId).toBe(chainId);
    expect(calls[0].options?.pactUrl).toBe(getPactUrl(chainId));
    expect(out.success).toBe(true);
    expect(out.gas).toBe(100);
  });
});
