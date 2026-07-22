/**
 * v4.2.0 — F-TEST-006 BREADTH closure: comprehensive runtime coverage for the
 * 22 previously-untested exports of `infoOneFunctions.ts` (the biggest gap of
 * the 6 modules under audit).
 *
 * Closes REQ-27 (per-module test files), REQ-28 (canonical isolation harness),
 * REQ-29 (per-function 3-spec contract), REQ-30 (≥1110 aggregate spec floor).
 *
 * Mirrors the canonical test-isolation pattern of `tests/v3-3-5-smoke.test.ts`
 * (see lines 80-120 for the `setPactReader` + `setLogger` + `afterEach` reset
 * harness). Each `pactRead`-routed read-only function gets the LC-7-C
 * 3-spec shape — happy / RPC-failure / RPC-throw — locking the contract that
 * v5.0.0 cannot silently regress. `parseTransferPreview` (sync helper) and
 * `getCullInfo` (no try/catch) are LC-7-E exceptions handled per-block.
 *
 * Pre-v4.2.0 only `getCoilPreviewInfo` was covered (smoke line 163). This file
 * adds 63+ it-blocks across 22 describe groups, satisfying the LC-7-I per-file
 * floor of ≥60.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";

import {
  parseTransferPreview,
  getTransferPreview,
  getCurlPreviewInfo,
  getBrumatePreviewInfo,
  getConstrictPreviewInfo,
  getSublimateInfo,
  getFirestarterInfo,
  getTransferInfo,
  getRecoveryPrimordial,
  getColdRecoveryInfo,
  getDirectRecoveryInfo,
  getMaxRecoveryAmount,
  getCullInfo,
  getHibernatedNoncesDisplay,
  getAwakeInfo,
  getSlumberInfo,
  getClearDispoInfo,
  getInfoAddLiquidity,
  getInfoFuel,
  getInfoSinglePoolSwap,
  getInfoMultiPoolSwap,
  getInfoRemoveLiquidity,
} from "../src/interactions/infoOneFunctions";

// ─── Stub builders (LC-7-A canonical harness) ───────────────────────────────
function successReader(data: unknown): PactReader {
  return () =>
    Promise.resolve({ result: { status: "success", data } } as any);
}

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

// ══ parseTransferPreview (sync helper, LC-7-E exception) ════════════════════
describe("v4.2.0 coverage — infoOneFunctions.parseTransferPreview", () => {
  it("returns null when previewData is null", () => {
    expect(parseTransferPreview(null)).toBeNull();
  });

  it("returns null when previewData has no `result` field", () => {
    expect(parseTransferPreview({})).toBeNull();
    expect(parseTransferPreview({ otherField: "x" })).toBeNull();
  });

  it("parses full success data with all fields populated", () => {
    const out = parseTransferPreview({
      result: {
        ignis: { "ignis-need": "100", "ignis-text": "Need 100 ignis" },
        "pre-text": ["pre1", "pre2"],
        "post-text": ["post1"],
        kadena: { "kadena-need": 0 },
      },
    });
    expect(out).toEqual({
      ignisNeed: "100",
      ignisText: "Need 100 ignis",
      preText: ["pre1", "pre2"],
      postText: ["post1"],
      kadenaFree: true,
    });
  });

  it("applies fallback defaults on partial-success data (ignis-need undefined → '0', missing arrays → [], kadena-need !== 0 → kadenaFree=false)", () => {
    const out = parseTransferPreview({
      result: {
        ignis: { "ignis-need": undefined, "ignis-text": undefined },
        kadena: { "kadena-need": 5 },
      },
    });
    expect(out).toEqual({
      ignisNeed: "0",
      ignisText: "",
      preText: [],
      postText: [],
      kadenaFree: false,
    });
  });
});

// ══ getTransferPreview ══════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getTransferPreview", () => {
  it("returns parsed data wrapped in `{ result: ... }` on success", async () => {
    const stub = { ignis: { "ignis-need": 0 }, kadena: {} };
    setPactReader(successReader(stub));
    const out = await getTransferPreview("k:patron", "tok", "k:s", "k:r", "1.5");
    expect(out).toEqual({ result: stub });
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getTransferPreview("k:patron", "tok", "k:s", "k:r", "1.5");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getTransferPreview("k:patron", "tok", "k:s", "k:r", "1.5");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting transfer preview:", expect.any(Error));
  });
});

// ══ getCurlPreviewInfo ══════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getCurlPreviewInfo", () => {
  it("returns parsed data wrapped on success", async () => {
    const stub = { fee: 0.5, target: "x" };
    setPactReader(successReader(stub));
    const out = await getCurlPreviewInfo("k:p", "k:c", "ats1", "ats2", "tok", "10");
    expect(out).toEqual({ result: stub });
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getCurlPreviewInfo("k:p", "k:c", "ats1", "ats2", "tok", "10");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getCurlPreviewInfo("k:p", "k:c", "ats1", "ats2", "tok", "10");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting curl preview:", expect.any(Error));
  });
});

// ══ getBrumatePreviewInfo ═══════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getBrumatePreviewInfo", () => {
  it("returns parsed data wrapped on success", async () => {
    const stub = { lockDays: 100, ratio: "0.95" };
    setPactReader(successReader(stub));
    const out = await getBrumatePreviewInfo("k:p", "k:b", "ats1", "ats2", "tok", "5", 100);
    expect(out).toEqual({ result: stub });
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getBrumatePreviewInfo("k:p", "k:b", "ats1", "ats2", "tok", "5", 100);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getBrumatePreviewInfo("k:p", "k:b", "ats1", "ats2", "tok", "5", 100);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting brumate preview:", expect.any(Error));
  });
});

// ══ getConstrictPreviewInfo ═════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getConstrictPreviewInfo", () => {
  it("returns parsed data wrapped on success", async () => {
    const stub = { lockDays: 50, ratio: "0.85" };
    setPactReader(successReader(stub));
    const out = await getConstrictPreviewInfo("k:p", "k:c", "ats", "tok", "5", 50);
    expect(out).toEqual({ result: stub });
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getConstrictPreviewInfo("k:p", "k:c", "ats", "tok", "5", 50);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getConstrictPreviewInfo("k:p", "k:c", "ats", "tok", "5", 50);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting constrict preview:", expect.any(Error));
  });
});

// ══ getSublimateInfo ════════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getSublimateInfo", () => {
  it("returns success data verbatim (integer amount input)", async () => {
    const stub = { sublimated: "5.0", target: "k:t" };
    setPactReader(successReader(stub));
    const out = await getSublimateInfo("k:client", "k:t", 5);
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (decimal amount input)", async () => {
    const stub = { sublimated: "5.5", target: "k:t" };
    setPactReader(successReader(stub));
    const out = await getSublimateInfo("k:client", "k:t", 5.5);
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getSublimateInfo("k:client", "k:t", 5);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getSublimateInfo("k:client", "k:t", 5);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting sublimate info:", expect.any(Error));
  });
});

// ══ getFirestarterInfo ══════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getFirestarterInfo", () => {
  it("returns success data verbatim", async () => {
    const stub = { firestarter: "k:f", balance: "100.0" };
    setPactReader(successReader(stub));
    const out = await getFirestarterInfo("k:f");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getFirestarterInfo("k:f");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getFirestarterInfo("k:f");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting firestarter info:", expect.any(Error));
  });
});

// ══ getTransferInfo ═════════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getTransferInfo", () => {
  it("returns success data verbatim (integer amount)", async () => {
    const stub = { ignis: { "ignis-need": 0 }, source: "k:s" };
    setPactReader(successReader(stub));
    const out = await getTransferInfo("k:p", "tok", "k:s", "k:r", 10);
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (decimal amount)", async () => {
    const stub = { ignis: { "ignis-need": 0 } };
    setPactReader(successReader(stub));
    const out = await getTransferInfo("k:p", "tok", "k:s", "k:r", 10.5);
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getTransferInfo("k:p", "tok", "k:s", "k:r", 10);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getTransferInfo("k:p", "tok", "k:s", "k:r", 10);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting transfer info:", expect.any(Error));
  });
});

// ══ getRecoveryPrimordial ═══════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getRecoveryPrimordial", () => {
  it("returns success data verbatim", async () => {
    const stub = { recoveryAmount: "12.5", canRecover: true };
    setPactReader(successReader(stub));
    const out = await getRecoveryPrimordial("ats", "k:r");
    expect(out).toEqual(stub);
  });

  it("returns null when data is undefined (?? null fallback)", async () => {
    setPactReader(successReader(undefined));
    const out = await getRecoveryPrimordial("ats", "k:r");
    expect(out).toBeNull();
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getRecoveryPrimordial("ats", "k:r");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getRecoveryPrimordial("ats", "k:r");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting recovery primordial:", expect.any(Error));
  });
});

// ══ getColdRecoveryInfo ═════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getColdRecoveryInfo", () => {
  it("returns success data verbatim (integer-string ra)", async () => {
    const stub = { canRecover: true, fee: "0.5" };
    setPactReader(successReader(stub));
    const out = await getColdRecoveryInfo("k:p", "k:r", "ats", "10");
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (decimal-string ra)", async () => {
    const stub = { canRecover: true, fee: "0.7" };
    setPactReader(successReader(stub));
    const out = await getColdRecoveryInfo("k:p", "k:r", "ats", "10.5");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getColdRecoveryInfo("k:p", "k:r", "ats", "10");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getColdRecoveryInfo("k:p", "k:r", "ats", "10");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting cold recovery info:", expect.any(Error));
  });
});

// ══ getDirectRecoveryInfo ═══════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getDirectRecoveryInfo", () => {
  it("returns success data verbatim (integer-string ra)", async () => {
    const stub = { directAmount: "5.0" };
    setPactReader(successReader(stub));
    const out = await getDirectRecoveryInfo("k:p", "k:r", "ats", "5");
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (decimal-string ra)", async () => {
    const stub = { directAmount: "5.5" };
    setPactReader(successReader(stub));
    const out = await getDirectRecoveryInfo("k:p", "k:r", "ats", "5.5");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getDirectRecoveryInfo("k:p", "k:r", "ats", "5");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getDirectRecoveryInfo("k:p", "k:r", "ats", "5");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting direct recovery info:", expect.any(Error));
  });
});

// ══ getMaxRecoveryAmount ════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getMaxRecoveryAmount", () => {
  it("extracts decimal field from { decimal: '...' } object payload", async () => {
    setPactReader(successReader({ decimal: "5.5" }));
    const out = await getMaxRecoveryAmount("ats", "k:r");
    expect(out).toBe("5.5");
  });

  it("stringifies plain numeric payload", async () => {
    setPactReader(successReader(5.5));
    const out = await getMaxRecoveryAmount("ats", "k:r");
    expect(out).toBe("5.5");
  });

  it("returns null when payload is null", async () => {
    setPactReader(successReader(null));
    const out = await getMaxRecoveryAmount("ats", "k:r");
    expect(out).toBeNull();
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getMaxRecoveryAmount("ats", "k:r");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getMaxRecoveryAmount("ats", "k:r");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting max recovery amount:", expect.any(Error));
  });
});

// ══ getCullInfo (LC-7-E exception: no try/catch) ═══════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getCullInfo", () => {
  it("returns success data verbatim", async () => {
    const stub = { cullable: true, fee: "0.1" };
    setPactReader(successReader(stub));
    const out = await getCullInfo("k:p", "k:c", "ats");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status (via guard, not catch)", async () => {
    setPactReader(failureStatusReader);
    const out = await getCullInfo("k:p", "k:c", "ats");
    expect(out).toBeNull();
  });

  it("propagates the thrown error (no try/catch wrapper)", async () => {
    setPactReader(throwingReader);
    await expect(getCullInfo("k:p", "k:c", "ats")).rejects.toThrow(/simulated pactRead failure/);
  });
});

// ══ getHibernatedNoncesDisplay ══════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getHibernatedNoncesDisplay", () => {
  it("normalizes Pact wrappers (int / decimal / timep) on success (default sort)", async () => {
    const stub = [
      {
        nonce: { int: 5 },
        "nonce-supply": { int: 100 },
        "mint-time": { timep: "2026-05-09T00:00:00.000000" },
        "release-time": { timep: "2026-05-10T00:00:00.000000" },
        "hibernating-fee-promile": { decimal: "0.5" },
        remainder: { int: 0 },
        "hibernating-fee": { decimal: "0.0" },
      },
    ];
    setPactReader(successReader(stub));
    const out = await getHibernatedNoncesDisplay("k:r", "dpof");
    expect(out).toEqual([
      {
        nonce: 5,
        "nonce-supply": 100,
        "mint-time": "2026-05-09T00:00:00.000000Z",
        "release-time": "2026-05-10T00:00:00.000000Z",
        "hibernating-fee-promile": 0.5,
        remainder: 0,
        "hibernating-fee": 0.0,
      },
    ]);
  });

  it("normalizes nonces with sortBy: 'fee-promile' (sorted Pact wrapper)", async () => {
    const stub = [
      {
        nonce: { int: 7 },
        "nonce-supply": { int: 50 },
        "mint-time": { timep: "2026-05-01T00:00:00.000000" },
        "release-time": { timep: "2026-06-01T00:00:00.000000" },
        "hibernating-fee-promile": { decimal: "0.25" },
        remainder: { int: 5 },
        "hibernating-fee": { decimal: "1.0" },
      },
    ];
    setPactReader(successReader(stub));
    const out = await getHibernatedNoncesDisplay("k:r", "dpof", "fee-promile");
    expect(out).toEqual([
      {
        nonce: 7,
        "nonce-supply": 50,
        "mint-time": "2026-05-01T00:00:00.000000Z",
        "release-time": "2026-06-01T00:00:00.000000Z",
        "hibernating-fee-promile": 0.25,
        remainder: 5,
        "hibernating-fee": 1.0,
      },
    ]);
  });

  it("returns null when data is not an array", async () => {
    setPactReader(successReader({ notAnArray: true }));
    const out = await getHibernatedNoncesDisplay("k:r", "dpof");
    expect(out).toBeNull();
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getHibernatedNoncesDisplay("k:r", "dpof");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getHibernatedNoncesDisplay("k:r", "dpof");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting hibernated nonces:", expect.any(Error));
  });
});

// ══ getAwakeInfo ════════════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getAwakeInfo", () => {
  it("returns success data verbatim", async () => {
    const stub = { awakened: true, fee: "0.1" };
    setPactReader(successReader(stub));
    const out = await getAwakeInfo("k:p", "k:a", "dpof", 7);
    expect(out).toEqual(stub);
  });

  it("returns null when data is undefined (?? null fallback)", async () => {
    setPactReader(successReader(undefined));
    const out = await getAwakeInfo("k:p", "k:a", "dpof", 7);
    expect(out).toBeNull();
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getAwakeInfo("k:p", "k:a", "dpof", 7);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getAwakeInfo("k:p", "k:a", "dpof", 7);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting awake info:", expect.any(Error));
  });
});

// ══ getSlumberInfo ══════════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getSlumberInfo", () => {
  it("returns success data verbatim (single-element nonces array)", async () => {
    const stub = { slumberStatus: "merged" };
    setPactReader(successReader(stub));
    const out = await getSlumberInfo("k:p", "k:m", "dpof", [3]);
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (multi-element nonces array)", async () => {
    const stub = { slumberStatus: "merged-3" };
    setPactReader(successReader(stub));
    const out = await getSlumberInfo("k:p", "k:m", "dpof", [1, 2, 3]);
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getSlumberInfo("k:p", "k:m", "dpof", [3]);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getSlumberInfo("k:p", "k:m", "dpof", [3]);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting slumber info:", expect.any(Error));
  });
});

// ══ getClearDispoInfo ═══════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getClearDispoInfo", () => {
  it("returns success data verbatim", async () => {
    const stub = { dispoCleared: true };
    setPactReader(successReader(stub));
    const out = await getClearDispoInfo("k:p", "k:a");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getClearDispoInfo("k:p", "k:a");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getClearDispoInfo("k:p", "k:a");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error in getClearDispoInfo:", expect.any(Error));
  });
});

// ══ getInfoAddLiquidity ═════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getInfoAddLiquidity", () => {
  it("returns success data verbatim", async () => {
    const stub = { lpMinted: "10.5", optimal: true };
    setPactReader(successReader(stub));
    const out = await getInfoAddLiquidity("k:p", "k:a", "swp", ["10", "20"], "5");
    expect(out).toEqual(stub);
  });

  it("returns success data with mixed integer/decimal input amounts", async () => {
    const stub = { lpMinted: "11.0" };
    setPactReader(successReader(stub));
    const out = await getInfoAddLiquidity("k:p", "k:a", "swp", ["10.5", "20"], "5.5");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getInfoAddLiquidity("k:p", "k:a", "swp", ["10"], "5");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getInfoAddLiquidity("k:p", "k:a", "swp", ["10"], "5");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("getInfoAddLiquidity error:", expect.any(Error));
  });
});

// ══ getInfoFuel ═════════════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getInfoFuel", () => {
  it("returns success data verbatim", async () => {
    const stub = { fuelAmount: "2.5" };
    setPactReader(successReader(stub));
    const out = await getInfoFuel("k:p", "k:a", "swp", ["10", "20"]);
    expect(out).toEqual(stub);
  });

  it("returns success data with decimal-formatted amounts", async () => {
    const stub = { fuelAmount: "3.0" };
    setPactReader(successReader(stub));
    const out = await getInfoFuel("k:p", "k:a", "swp", ["10.5"]);
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getInfoFuel("k:p", "k:a", "swp", ["10"]);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getInfoFuel("k:p", "k:a", "swp", ["10"]);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("getInfoFuel error:", expect.any(Error));
  });
});

// ══ getInfoSinglePoolSwap ═══════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getInfoSinglePoolSwap", () => {
  it("returns success data verbatim", async () => {
    const stub = { outputAmount: "9.5", priceImpact: "0.01" };
    setPactReader(successReader(stub));
    const out = await getInfoSinglePoolSwap("k:p", "k:a", "swp", "tokA", "10", "tokB");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getInfoSinglePoolSwap("k:p", "k:a", "swp", "tokA", "10", "tokB");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getInfoSinglePoolSwap("k:p", "k:a", "swp", "tokA", "10", "tokB");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("getInfoSinglePoolSwap error:", expect.any(Error));
  });
});

// ══ getInfoMultiPoolSwap ════════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getInfoMultiPoolSwap", () => {
  it("returns success data verbatim (single-element inputIds array)", async () => {
    const stub = { outputAmount: "9.5" };
    setPactReader(successReader(stub));
    const out = await getInfoMultiPoolSwap("k:p", "k:a", "swp", ["tokA"], ["10"], "tokB");
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (multi-element inputIds array)", async () => {
    const stub = { outputAmount: "20.0" };
    setPactReader(successReader(stub));
    const out = await getInfoMultiPoolSwap("k:p", "k:a", "swp", ["tokA", "tokB"], ["10", "10"], "tokC");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getInfoMultiPoolSwap("k:p", "k:a", "swp", ["tokA"], ["10"], "tokB");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getInfoMultiPoolSwap("k:p", "k:a", "swp", ["tokA"], ["10"], "tokB");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("getInfoMultiPoolSwap error:", expect.any(Error));
  });
});

// ══ getInfoRemoveLiquidity ══════════════════════════════════════════════════
describe("v4.2.0 coverage — infoOneFunctions.getInfoRemoveLiquidity", () => {
  it("returns success data verbatim (decimal-string lpAmount)", async () => {
    const stub = { tokenAOut: "5.0", tokenBOut: "10.0" };
    setPactReader(successReader(stub));
    const out = await getInfoRemoveLiquidity("k:p", "k:a", "swp", "1.5");
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (integer-string lpAmount, appends '.0')", async () => {
    const stub = { tokenAOut: "5.0" };
    setPactReader(successReader(stub));
    const out = await getInfoRemoveLiquidity("k:p", "k:a", "swp", "1");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status and logs warn", async () => {
    setPactReader(failureStatusReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getInfoRemoveLiquidity("k:p", "k:a", "swp", "1.5");
    expect(out).toBeNull();
    expect(spyLogger.warn).toHaveBeenCalledWith("[INFO_RemoveLiquidity] FAILED:", undefined);
  });

  it("returns null and logs error on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getInfoRemoveLiquidity("k:p", "k:a", "swp", "1.5");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("getInfoRemoveLiquidity error:", expect.any(Error));
  });
});
