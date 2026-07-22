/**
 * v4.2.0 Phase 4 — F-API-002 catch-and-return-null contract regression-lock.
 *
 * Verifies that the 10 swap-calc and dashboard-read functions whose
 * declared return type is `Promise<T | null>` honor that contract at
 * runtime: on RPC failure (failure-status response OR thrown reader),
 * the function returns `null` and routes the catch via
 * `getLogger().error("Error in <fnName>:", error)` BEFORE returning.
 *
 * Pre-Phase-4 behavior: each catch block ended with
 *   `throw error instanceof Error ? error : new Error("Unknown error occurred");`
 * which caused the runtime to propagate the in-try guard throw — making the
 * declared `| null` a lie. Phase 4 replaces that line with
 *   `getLogger().error("Error in <fn>:", error); return null;`
 * making the runtime honor the static type.
 *
 * Strategies covered (per Phase-4 TASKS.md acceptance):
 *   A   — null-on-failure-status (10 it-blocks, one per function)
 *   A'  — null-on-thrown-read    (10 it-blocks, one per function)
 *   B   — logger-call preservation (4 representative it-blocks: 2 calc, 2 dashboard)
 *   C   — consumer truthy-check compatibility (1 demo it-block)
 *   D   — compile-time signature parity via expectTypeOf (10 it-blocks)
 *
 * Pattern follows tests/v3-3-5-smoke.test.ts: `setPactReader(stub)` +
 * `setLogger(spy)` + `afterEach` that restores defaults via
 * `setPactReader(rawCalibratedDirtyRead)` + `setLogger(defaultLogger)`.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  expectTypeOf,
} from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import {
  getLogger,
  setLogger,
  type Logger,
} from "@stoachain/stoa-core/observability";

import {
  calculateDirectSwap,
  calculateInverseSwap,
  calculateDirectSwapB,
  calculateInverseSwapB,
  getCappedInverseAmount,
  getUserAccountSupplies,
} from "../src/interactions/dexSwapPairCalcFunctions";
import {
  getSWPairDashboardInfo,
  getPoolPreviewData,
  getSWPairMultiDashboardInfo,
  getSwpairInternalDashboard,
} from "../src/interactions/dexSwapPairDashboardFunctions";
import type {
  SwapCalculationResult,
  InverseSwapResult,
  CappedInverseResult,
  UserAccountSupplies,
  SwapPoolData,
  PoolPreviewData,
  SwpairInternalDashboard,
} from "../src/interactions/dexTypes";

// ─── Stub builders (local to this file; mirrors v3-3-5-smoke.test.ts:99-108) ──
const failureStatusReader: PactReader = () =>
  Promise.resolve({ result: { status: "failure" } } as any);

const throwingReader: PactReader = () =>
  Promise.reject(new Error("simulated pactRead failure"));

let defaultLogger: Logger;

beforeEach(() => {
  defaultLogger = getLogger();
});

afterEach(() => {
  setLogger(defaultLogger);
  setPactReader(rawCalibratedDirtyRead);
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// Strategy A — null-on-failure-status (10 it-blocks)
// ════════════════════════════════════════════════════════════════════════════
describe("Strategy A — null on failure-status response", () => {
  it("calculateDirectSwap returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await calculateDirectSwap("k:patron", "swpair", ["t1"], ["1.0"], "t2");
    expect(out).toBeNull();
  });

  it("calculateInverseSwap returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await calculateInverseSwap("k:patron", "swpair", "t2", 1, "t1");
    expect(out).toBeNull();
  });

  it("calculateDirectSwapB returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await calculateDirectSwapB("k:patron", "swpair", ["t1"], ["1.0"], "t2");
    expect(out).toBeNull();
  });

  it("calculateInverseSwapB returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await calculateInverseSwapB("k:patron", "swpair", "t2", 1, "t1");
    expect(out).toBeNull();
  });

  it("getCappedInverseAmount returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getCappedInverseAmount("swpair", "t1");
    expect(out).toBeNull();
  });

  it("getUserAccountSupplies returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getUserAccountSupplies("k:patron", "swpair");
    expect(out).toBeNull();
  });

  it("getSWPairDashboardInfo returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getSWPairDashboardInfo("swpair");
    expect(out).toBeNull();
  });

  it("getPoolPreviewData returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getPoolPreviewData("swpair");
    expect(out).toBeNull();
  });

  it("getSWPairMultiDashboardInfo returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getSWPairMultiDashboardInfo(["swpair-1"]);
    expect(out).toBeNull();
  });

  it("getSwpairInternalDashboard returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getSwpairInternalDashboard("swpair");
    expect(out).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Strategy A' — null-on-thrown-read (10 it-blocks)
// ════════════════════════════════════════════════════════════════════════════
describe("Strategy A' — null on thrown reader (catch-and-return-null contract)", () => {
  it("calculateDirectSwap returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await calculateDirectSwap("k:patron", "swpair", ["t1"], ["1.0"], "t2");
    expect(out).toBeNull();
  });

  it("calculateInverseSwap returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await calculateInverseSwap("k:patron", "swpair", "t2", 1, "t1");
    expect(out).toBeNull();
  });

  it("calculateDirectSwapB returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await calculateDirectSwapB("k:patron", "swpair", ["t1"], ["1.0"], "t2");
    expect(out).toBeNull();
  });

  it("calculateInverseSwapB returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await calculateInverseSwapB("k:patron", "swpair", "t2", 1, "t1");
    expect(out).toBeNull();
  });

  it("getCappedInverseAmount returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await getCappedInverseAmount("swpair", "t1");
    expect(out).toBeNull();
  });

  it("getUserAccountSupplies returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await getUserAccountSupplies("k:patron", "swpair");
    expect(out).toBeNull();
  });

  it("getSWPairDashboardInfo returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await getSWPairDashboardInfo("swpair");
    expect(out).toBeNull();
  });

  it("getPoolPreviewData returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await getPoolPreviewData("swpair");
    expect(out).toBeNull();
  });

  it("getSWPairMultiDashboardInfo returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await getSWPairMultiDashboardInfo(["swpair-1"]);
    expect(out).toBeNull();
  });

  it("getSwpairInternalDashboard returns null on thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    const out = await getSwpairInternalDashboard("swpair");
    expect(out).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Strategy B — logger-call preservation (4 representative it-blocks)
// ════════════════════════════════════════════════════════════════════════════
describe("Strategy B — logger.error called once before null return (4 reps: 2 calc, 2 dashboard)", () => {
  it("calculateDirectSwap routes catch via getLogger().error before returning null", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await calculateDirectSwap("k:patron", "swpair", ["t1"], ["1.0"], "t2");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in calculateDirectSwap:",
      expect.any(Error),
    );
  });

  it("getCappedInverseAmount routes catch via getLogger().error before returning null", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getCappedInverseAmount("swpair", "t1");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getCappedInverseAmount:",
      expect.any(Error),
    );
  });

  it("getSWPairDashboardInfo routes catch via getLogger().error before returning null", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getSWPairDashboardInfo("swpair");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getSWPairDashboardInfo:",
      expect.any(Error),
    );
  });

  it("getSwpairInternalDashboard routes catch via getLogger().error before returning null", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getSwpairInternalDashboard("swpair");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getSwpairInternalDashboard:",
      expect.any(Error),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Strategy C — consumer truthy-check compatibility (1 demo it-block)
// ════════════════════════════════════════════════════════════════════════════
describe("Strategy C — consumer truthy-check pattern works", () => {
  it("if (result === null) branch executes when read fails (representative: getSWPairDashboardInfo)", async () => {
    setPactReader(failureStatusReader);
    const result = await getSWPairDashboardInfo("swpair");

    let branch: "null-branch" | "data-branch";
    if (result === null) {
      branch = "null-branch";
    } else {
      branch = "data-branch";
    }

    expect(branch).toBe("null-branch");
    expect(result).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Strategy D — compile-time signature parity (10 it-blocks)
// Locks LC-6: public API non-widening — Promise<T | null> preserved verbatim.
// ════════════════════════════════════════════════════════════════════════════
describe("Strategy D — compile-time return-type signatures preserved (Promise<T | null>)", () => {
  it("calculateDirectSwap returns Promise<SwapCalculationResult | null>", () => {
    expectTypeOf(calculateDirectSwap)
      .returns.toEqualTypeOf<Promise<SwapCalculationResult | null>>();
  });

  it("calculateInverseSwap returns Promise<InverseSwapResult | null>", () => {
    expectTypeOf(calculateInverseSwap)
      .returns.toEqualTypeOf<Promise<InverseSwapResult | null>>();
  });

  it("calculateDirectSwapB returns Promise<{ decimal: string } | number | null>", () => {
    expectTypeOf(calculateDirectSwapB)
      .returns.toEqualTypeOf<Promise<{ decimal: string } | number | null>>();
  });

  it("calculateInverseSwapB returns Promise<{ decimal: string } | number | null>", () => {
    expectTypeOf(calculateInverseSwapB)
      .returns.toEqualTypeOf<Promise<{ decimal: string } | number | null>>();
  });

  it("getCappedInverseAmount returns Promise<CappedInverseResult | null>", () => {
    expectTypeOf(getCappedInverseAmount)
      .returns.toEqualTypeOf<Promise<CappedInverseResult | null>>();
  });

  it("getUserAccountSupplies returns Promise<UserAccountSupplies | null>", () => {
    expectTypeOf(getUserAccountSupplies)
      .returns.toEqualTypeOf<Promise<UserAccountSupplies | null>>();
  });

  it("getSWPairDashboardInfo returns Promise<SwapPoolData | null>", () => {
    expectTypeOf(getSWPairDashboardInfo)
      .returns.toEqualTypeOf<Promise<SwapPoolData | null>>();
  });

  it("getPoolPreviewData returns Promise<PoolPreviewData | null>", () => {
    expectTypeOf(getPoolPreviewData)
      .returns.toEqualTypeOf<Promise<PoolPreviewData | null>>();
  });

  it("getSWPairMultiDashboardInfo returns Promise<SwapPoolData[] | null>", () => {
    expectTypeOf(getSWPairMultiDashboardInfo)
      .returns.toEqualTypeOf<Promise<SwapPoolData[] | null>>();
  });

  it("getSwpairInternalDashboard returns Promise<SwpairInternalDashboard | null>", () => {
    expectTypeOf(getSwpairInternalDashboard)
      .returns.toEqualTypeOf<Promise<SwpairInternalDashboard | null>>();
  });
});
