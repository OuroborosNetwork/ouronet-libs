/**
 * Phase 2 fabricated-fallback removal — balance/cluster widenings (REQ-05..REQ-09).
 *
 * Pins that all twelve Phase-2 widened functions return their documented null
 * (or null-bearing) shape — NOT the prior fabricated sentinels — when the chain
 * read throws or returns a non-success status, AND that each catch path routes
 * via getLogger().error("<exact prefix>", error) — never bare console.error.
 *
 * Distribution (≥12 it-blocks per NFR-04 + cascade-fix CI-003):
 *   - 4 it-blocks for the string-balance cluster (T2.1)
 *   - 1 it-block for getLPTypeInfo mixed-state per-flag granularity (T2.2)
 *   - 4 it-blocks for the urStoa trio + 3-state preservation guard (T2.3 + P-001)
 *   - 1 it-block for validateLiquidity catch vs validation-rejection (T2.4)
 *   - 1 it-block for getMaxBuyMovieBooster legacy-prefix (T2.5)
 *   - 3 it-blocks for the SWP magic-string functions + inline-coalesce (T2.6 + F-004)
 *
 * Strategy mirrors tests/phase5-catch-routing.test.ts and tests/interactions-pricing.test.ts:
 * install a throwing / failure-status / counting-stub PactReader via setPactReader,
 * install a spy logger via setLogger, exercise each SUT, and assert (a) returned
 * null (or expected null-bearing shape), (b) spyLogger.error called with the
 * exact prefix, (c) console.error never called.
 *
 * Both seams (PactReader + Logger) are restored in afterEach per NFR-05.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";
import {
  getIgnisBalance,
  getAccountTokenSupply,
  getOuroDispoCapacity,
  getVirtualOuro,
  getMaxBuyMovieBooster,
} from "../src/interactions/ouroFunctions";
import {
  getLPTypeInfo,
  validateLiquidity,
} from "../src/interactions/addLiquidityFunctions";
import {
  getUrStoaBalance,
  getUrStoaGuard,
  checkCoinAccountExists,
} from "../src/interactions/urStoaFunctions";
import {
  getSWPSpawnLimit,
  getSWPInactiveLimit,
} from "../src/interactions/dexFunctions";

const throwingReader: PactReader = () =>
  Promise.reject(new Error("simulated pactRead failure"));

let defaultLogger: Logger;

beforeEach(() => {
  defaultLogger = getLogger();
  setPactReader(throwingReader);
});

afterEach(() => {
  setLogger(defaultLogger);
  setPactReader(rawCalibratedDirtyRead);
  vi.restoreAllMocks();
});

describe("Phase 2 fabricated-fallback removal — balance/cluster widenings (REQ-05..REQ-09)", () => {
  // ── T2.1: string-balance cluster ──────────────────────────────────────────
  it("getIgnisBalance returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getIgnisBalance("k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getIgnisBalance:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getAccountTokenSupply returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getAccountTokenSupply("token-id", "k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getAccountTokenSupply:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getOuroDispoCapacity returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getOuroDispoCapacity("k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getOuroDispoCapacity:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getVirtualOuro returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getVirtualOuro("k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getVirtualOuro:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // ── T2.2: getLPTypeInfo per-flag granularity (mixed state) ────────────────
  it("getLPTypeInfo preserves per-flag granularity: Frozen LP succeeds (false) while Sleeping LP throws (null)", async () => {
    // Mixed-state stub: UR_IzFrozenLP returns success-false, UR_IzSleepingLP throws.
    // This exercises the locked Approach A per-flag granularity contract: each
    // inner IIFE has its own catch returning `null` for that flag only — a
    // sibling-flag failure must NOT collapse the successful flag back to false.
    const mixedReader: PactReader = (pactCode) => {
      if (pactCode.includes("UR_IzFrozenLP")) {
        return Promise.resolve({ result: { status: "success", data: false } } as any);
      }
      if (pactCode.includes("UR_IzSleepingLP")) {
        return Promise.reject(new Error("sleeping LP probe failed"));
      }
      return Promise.reject(new Error("unexpected pactCode"));
    };
    setPactReader(mixedReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getLPTypeInfo("swpair");

    expect(out.hasFrozenLP).toBe(false);
    expect(out.hasSleepingLP).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error checking Sleeping LP:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // ── T2.3: urStoa trio ──────────────────────────────────────────────────────
  it("getUrStoaBalance returns null on thrown read and routes catch via getLogger().error (legacy prefix)", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getUrStoaBalance("k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error fetching UrStoa balance:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getUrStoaGuard returns null on thrown read and routes catch via getLogger().error (legacy prefix)", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getUrStoaGuard("k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error fetching UrStoa guard:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // P-001 cascade-fix: 3-state preservation. The chain says "no guard yet" via
  // the (try false …) wrapper resolving to data === false. That MUST resolve to
  // a structured "exists: false" value — distinct from the throwing-reader case
  // above which MUST resolve to null. Collapsing both branches to null would
  // erase the contract distinction between "account exists with no guard" and
  // "RPC failed / unknown".
  it("getUrStoaGuard preserves 3-state contract: chain-says-no-guard (data:false) resolves to {exists:false}, NOT null", async () => {
    const noGuardReader: PactReader = () =>
      Promise.resolve({ result: { status: "success", data: false } } as any);
    setPactReader(noGuardReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const out = await getUrStoaGuard("k:abc");

    expect(out).not.toBeNull();
    expect(out).toEqual({ exists: false, isKeyset: false, keys: [], pred: "" });
    expect(spyLogger.error).not.toHaveBeenCalled();
  });

  it("checkCoinAccountExists returns null on thrown read and routes catch via getLogger().error with (urStoa) suffix", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await checkCoinAccountExists("k:abc");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in checkCoinAccountExists (urStoa):",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // ── T2.4: validateLiquidity catch vs validation-rejection distinguishability
  it("validateLiquidity populates `error` on thrown read but omits `error` on validation-rejection (distinguishable shapes)", async () => {
    // Catch path — throwing reader populates error field via the `error instanceof Error` branch.
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const catchOut = await validateLiquidity("swpair", ["1", "2"]);

    expect(catchOut.valid).toBe(false);
    expect(catchOut.error).toBe("simulated pactRead failure");
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in validateLiquidity:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // Validation-rejection path — chain returns failure-status (or the (try …)
    // catch yielded [false, false]). The function returns { valid: false }
    // WITHOUT the `error` key. Reset the spy logger to confirm THIS path does
    // not log an error.
    const rejectionReader: PactReader = () =>
      Promise.resolve({ result: { status: "failure" } } as any);
    setPactReader(rejectionReader);
    const spyLogger2: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger2);

    const rejectionOut = await validateLiquidity("swpair", ["1", "2"]);

    expect(rejectionOut.valid).toBe(false);
    expect(rejectionOut.error).toBeUndefined();
    expect(spyLogger2.error).not.toHaveBeenCalled();
  });

  // ── T2.5: getMaxBuyMovieBooster legacy-prefix ──────────────────────────────
  it("getMaxBuyMovieBooster returns null on thrown read and routes catch via getLogger().error with legacy prefix", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getMaxBuyMovieBooster("k:abc", true);

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error getting max buy for movie booster:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // ── T2.6: SWP magic-string functions ───────────────────────────────────────
  it("getSWPSpawnLimit returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getSWPSpawnLimit();

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getSWPSpawnLimit:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getSWPInactiveLimit returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getSWPInactiveLimit();

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getSWPInactiveLimit:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  // F-004 cascade-fix: inline-coalesce site coverage. Counting-stub returns
  // a success envelope with data === null. The inline ternary
  // `(d != null ? String(d) : null)` MUST resolve to literal null — NOT the
  // string "null" (the post-fix `String(d ?? null)` foot-gun) and NOT the
  // magic-string "N/A" (the original pre-fix sentinel). Asserting on both SWP
  // functions in one it-block keeps the it-block count tight while pinning
  // the shared inline-coalesce branch.
  it("getSWPSpawnLimit + getSWPInactiveLimit inline-coalesce: success-with-null-data resolves to null (NOT \"null\" string, NOT \"N/A\")", async () => {
    const nullDataReader: PactReader = () =>
      Promise.resolve({ result: { status: "success", data: null } } as any);
    setPactReader(nullDataReader);

    const spawn = await getSWPSpawnLimit();
    const inactive = await getSWPInactiveLimit();

    expect(spawn).toBeNull();
    expect(inactive).toBeNull();
    // Defensive: explicitly reject the two regression sentinels.
    expect(spawn).not.toBe("null");
    expect(spawn).not.toBe("N/A");
    expect(inactive).not.toBe("null");
    expect(inactive).not.toBe("N/A");
  });
});
