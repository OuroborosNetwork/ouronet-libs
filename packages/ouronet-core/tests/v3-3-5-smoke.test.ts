/**
 * v3.3.5 — runtime smoke tests for 6 interaction modules with no
 * runtime test coverage prior to this release.
 *
 * Closes audit finding F-TEST-006 (MEDIUM, testing-auditor).
 *
 * Background
 * ----------
 * The 2026-05-05 audit's testing-auditor flagged six interaction
 * modules with insufficient runtime test coverage:
 *
 *   Zero runtime tests:
 *     - pensionFunctions   (3 exports)
 *     - guardFunctions     (3 exports)
 *     - infoOneFunctions   (23 exports — biggest gap)
 *
 *   Compile-only tests (`expectTypeOf` only — function never executes):
 *     - coilFunctions      (9 exports; type-checked at tests/types.test.ts:47)
 *     - kpayFunctions      (4 exports; type-checked at tests/types.test.ts:46)
 *     - activateFunctions  (3 exports; type-checked at tests/types.test.ts:44)
 *
 * Per the audit's suggested fix ("Add minimal smoke tests for each
 * (one happy-path, one error-path)"), this file ships ONE happy-path
 * + ONE error-path runtime test per module — 12 tests total.
 *
 * Why "minimal" is the right scope
 * ---------------------------------
 * Compile-only tests aren't worthless — they prove the function's
 * type signature is what consumers expect. But they don't prove the
 * function executes correctly: a bug that swapped two argument-string
 * concatenations OR forgot to await a Promise OR mis-routed the
 * pactRead call would all type-check cleanly but produce wrong runtime
 * behaviour. A single happy-path runtime test per module catches the
 * "function actually executes" case; a single error-path runtime test
 * catches the "graceful-degradation contract holds" case (which for
 * 5 of the 6 modules is `null`, and for `pensionFunctions.getHibernateFee`
 * is a locally-computed fallback formula — see below).
 *
 * Why we test the read-only function per module, not the execute-class one
 * -----------------------------------------------------------------------
 * Each of the 6 modules exports a mix of read-only functions
 * (`pactRead`-based) and transaction-execute functions (signing +
 * `submit` + chain wait). Smoke-testing the read-only one is cheap
 * — just `setPactReader(...)` to a stub. Smoke-testing the execute
 * function would require mocking the full `@kadena/client` signing
 * + submit + status-polling chain, which is out-of-scope for a MEDIUM
 * audit-closure release. The read-only smoke is sufficient to satisfy
 * F-TEST-006's "function actually executes" assertion. The
 * execute-path coverage is queued for v4.0.0's monorepo split (where
 * the CodexSigningStrategy seam will land properly tested).
 *
 * What this file locks (12 it-blocks across 6 describe groups, one per module)
 * ----------------------------------------------------------------------------
 *
 *   pensionFunctions.getHibernateFee      — happy: parses {decimal:"0.99"} → 0.99;
 *                                           error: thrown read → catch's local
 *                                           fallback formula (0.12 - 0.000008*lockDays
 *                                           clamped non-negative). The ONLY one of
 *                                           the 6 with a non-null error path.
 *   guardFunctions.getRotateGuardInfo     — happy: returns success-path data verbatim;
 *                                           error: failure-status → null.
 *   infoOneFunctions.getCoilPreviewInfo   — happy: wraps success data in {result: ...};
 *                                           error: failure-status → null.
 *   coilFunctions.getCoilPreviewGeneric   — happy: parses "generates 5.0 AURYN" out of
 *                                           data['pre-text'] regex match; error: thrown
 *                                           read → re-throws (only one of the 6 that
 *                                           rethrows rather than null/fallback).
 *   kpayFunctions.getKpayData             — happy: returns success-path data verbatim;
 *                                           error: failure-status → null.
 *   activateFunctions.getDeployStandardAccountInfoOnly — happy: returns success-path
 *                                           data; error: thrown read → catch → null.
 *
 * Strategy mirrors the v3.3.4 file: `setPactReader(...)` to inject a
 * stubbed reader (success/failure-status/throwing as the test
 * dictates), call the SUT, assert the parsed result. `afterEach`
 * restores `rawCalibratedDirtyRead` so cross-file tests aren't
 * polluted by the seam-mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";

import { getHibernateFee } from "../src/interactions/pensionFunctions";
import { getRotateGuardInfo } from "../src/interactions/guardFunctions";
import { getCoilPreviewInfo } from "../src/interactions/infoOneFunctions";
import {
  getCoilPreviewGeneric,
  COIL_CONFIGS,
} from "../src/interactions/coilFunctions";
import { getKpayData } from "../src/interactions/kpayFunctions";
import { getDeployStandardAccountInfoOnly } from "../src/interactions/activateFunctions";

// ─── Stub builders ───────────────────────────────────────────────────────────
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

// ══ pensionFunctions — getHibernateFee ══════════════════════════════════════
describe("v3.3.5 smoke — pensionFunctions.getHibernateFee", () => {
  it("returns the parsed decimal on success path", async () => {
    setPactReader(successReader({ decimal: "0.99" }));
    const out = await getHibernateFee("pool-id", 100);
    expect(out).toBe(0.99);
  });

  it("returns the locally-computed fallback on thrown read (graceful-degradation contract)", async () => {
    setPactReader(throwingReader);
    // Suppress any logger noise from the catch (the function's catch is
    // SILENT — no getLogger() call — but install a no-op spy regardless
    // so future-self changes don't muddy the assertion.)
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    // Fallback formula per source: 0.12 - 0.000008 * lockDays, clamped
    // to non-negative. For lockDays=100: 0.12 - 0.0008 = 0.1192.
    const out = await getHibernateFee("pool-id", 100);
    expect(out).toBeCloseTo(0.1192, 6);
  });
});

// ══ guardFunctions — getRotateGuardInfo ═════════════════════════════════════
describe("v3.3.5 smoke — guardFunctions.getRotateGuardInfo", () => {
  it("returns the success-path data verbatim", async () => {
    const stub = { someField: "someValue", nested: { ok: true } };
    setPactReader(successReader(stub));
    const out = await getRotateGuardInfo("k:patron", "k:account");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status without invoking the catch", async () => {
    setPactReader(failureStatusReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getRotateGuardInfo("k:patron", "k:account");
    expect(out).toBeNull();
    expect(spyLogger.error).not.toHaveBeenCalled();
  });
});

// ══ infoOneFunctions — getCoilPreviewInfo ═══════════════════════════════════
describe("v3.3.5 smoke — infoOneFunctions.getCoilPreviewInfo", () => {
  it("wraps success-path data in { result: ... } envelope", async () => {
    const stub = { previewField: 1, anotherField: "x" };
    setPactReader(successReader(stub));
    const out = await getCoilPreviewInfo(
      "k:patron",
      "k:coiler",
      "ats-pair",
      "OURO-tokenid",
      "100",
    );
    expect(out).toEqual({ result: stub });
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getCoilPreviewInfo(
      "k:patron",
      "k:coiler",
      "ats-pair",
      "OURO-tokenid",
      "100",
    );
    expect(out).toBeNull();
  });
});

// ══ coilFunctions — getCoilPreviewGeneric ═══════════════════════════════════
describe("v3.3.5 smoke — coilFunctions.getCoilPreviewGeneric", () => {
  it("parses target amount from 'generates X AURYN' pre-text on success", async () => {
    // Per the source's regex: pre-text matches /generates\s+([\d.]+)\s+AURYN/i
    // when targetToken is "AURYN-8Nh-JO8JO4F5" (stripped → "AURYN").
    setPactReader(
      successReader({
        "pre-text": ["This action generates 5.0 AURYN tokens"],
        kadena: {
          "kadena-text": "Kadena fee info",
          "kadena-discount": 0.5,
          "kadena-full": 100,
          "kadena-need": 50,
        },
      }),
    );
    const out = await getCoilPreviewGeneric("100", COIL_CONFIGS.ouroToAuryn);
    expect(out.targetAmount).toBe(5.0);
    expect(out.fee).toBe(0);
    expect(out.kadenaInfo).toEqual({
      text: "Kadena fee info",
      discount: 0.5,
      full: 100,
      need: 50,
    });
  });

  it("re-throws on chain failure (only module of the 6 that rethrows rather than null/fallback)", async () => {
    setPactReader(failureStatusReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    await expect(
      getCoilPreviewGeneric("100", COIL_CONFIGS.ouroToAuryn),
    ).rejects.toThrow(/Failed to get coil preview/);
  });
});

// ══ kpayFunctions — getKpayData ═════════════════════════════════════════════
describe("v3.3.5 smoke — kpayFunctions.getKpayData", () => {
  it("returns the success-path data verbatim", async () => {
    const stub = { ouroAccount: "k:abc", kpayBalance: "1000.0" };
    setPactReader(successReader(stub));
    const out = await getKpayData("k:abc");
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getKpayData("k:abc");
    expect(out).toBeNull();
  });
});

// ══ activateFunctions — getDeployStandardAccountInfoOnly ════════════════════
describe("v3.3.5 smoke — activateFunctions.getDeployStandardAccountInfoOnly", () => {
  it("returns the success-path data verbatim", async () => {
    const stub = { isDeployed: true, kadenaTargets: ["chain-0", "chain-1"] };
    setPactReader(successReader(stub));
    const out = await getDeployStandardAccountInfoOnly("k:abc");
    expect(out).toEqual(stub);
  });

  it("returns null on thrown read and routes catch via getLogger().error", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getDeployStandardAccountInfoOnly("k:abc");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getDeployStandardAccountInfoOnly:",
      expect.any(Error),
    );
  });
});
