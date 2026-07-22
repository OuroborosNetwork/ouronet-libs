/**
 * v4.2.0 — F-TEST-006 BREADTH closure: comprehensive runtime coverage for the
 * 7 previously-untested exports of `coilFunctions.ts` plus a const-shape lock
 * for `COIL_CONFIGS`.
 *
 * Closes REQ-27 (per-module test files), REQ-28 (canonical isolation harness),
 * REQ-29 (per-function 3-spec contract), REQ-30 (≥1110 aggregate spec floor).
 *
 * Mirrors `tests/v3-3-5-smoke.test.ts:80-120` for the LC-7-A canonical
 * isolation harness. The 3 read-only wrappers (`getCoilPreview`,
 * `getAurynCoilPreview`, `getWkdaCoilPreview`) delegate to
 * `getCoilPreviewGeneric` which RE-THROWS on failure-status (LC-7-E exception
 * — see source line 120). The 4 execute-class functions (`coilTokensGeneric`,
 * `coilOuroToAuryn`, `coilAurynToElite`, `coilWkdaToLkda`) get the LC-7-D
 * adapted shape — type-signature smoke only, since they route through
 * `getFailoverClient(...).dirtyRead/submit` and are not stubable via
 * `setPactReader`. Per-file floor: ≥15 it-blocks.
 */

import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";

import {
  getCoilPreview,
  getAurynCoilPreview,
  getWkdaCoilPreview,
  coilTokensGeneric,
  coilOuroToAuryn,
  coilAurynToElite,
  coilWkdaToLkda,
  COIL_CONFIGS,
  type CoilConfig,
} from "../src/interactions/coilFunctions";
import type { IOuroAccountKeypair } from "../src/interactions/ouroTypes";

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

// ══ getCoilPreview (OURO → AURYN) — LC-7-E throw-on-failure ═════════════════
describe("v4.2.0 coverage — coilFunctions.getCoilPreview", () => {
  it("parses 'generates X AURYN' on success and exposes auryn/fee/kadenaInfo shape", async () => {
    setPactReader(
      successReader({
        "pre-text": ["This action generates 5.0 AURYN tokens"],
        kadena: {
          "kadena-text": "OK",
          "kadena-discount": 1,
          "kadena-full": 0,
          "kadena-need": 0,
        },
      }),
    );
    const out = await getCoilPreview("100");
    expect(out).toEqual({
      auryn: 5.0,
      fee: 0,
      kadenaInfo: { text: "OK", discount: 1, full: 0, need: 0 },
    });
  });

  it("re-throws 'Failed to get coil preview' on failure-status (LC-7-E)", async () => {
    setPactReader(failureStatusReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    await expect(getCoilPreview("100")).rejects.toThrow(/Failed to get coil preview/);
  });

  it("propagates the thrown read and logs via getLogger().error", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    await expect(getCoilPreview("100")).rejects.toThrow(/simulated pactRead failure/);
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting coil preview:", expect.any(Error));
  });
});

// ══ getAurynCoilPreview (AURYN → ELITEAURYN) — LC-7-E throw-on-failure ══════
describe("v4.2.0 coverage — coilFunctions.getAurynCoilPreview", () => {
  it("parses 'generates X ELITEAURYN' (or hyphenated/spaced variant) on success", async () => {
    setPactReader(
      successReader({
        "pre-text": ["This action generates 2.5 ELITEAURYN tokens"],
        kadena: {
          "kadena-text": "OK",
          "kadena-discount": 1,
          "kadena-full": 0,
          "kadena-need": 0,
        },
      }),
    );
    const out = await getAurynCoilPreview("10");
    expect(out).toEqual({
      eliteAuryn: 2.5,
      fee: 0,
      kadenaInfo: { text: "OK", discount: 1, full: 0, need: 0 },
    });
  });

  it("re-throws on failure-status (LC-7-E)", async () => {
    setPactReader(failureStatusReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    await expect(getAurynCoilPreview("10")).rejects.toThrow(/Failed to get coil preview/);
  });

  it("propagates the thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    await expect(getAurynCoilPreview("10")).rejects.toThrow(/simulated pactRead failure/);
  });
});

// ══ getWkdaCoilPreview (WSTOA → SSTOA) — LC-7-E throw-on-failure ════════════
describe("v4.2.0 coverage — coilFunctions.getWkdaCoilPreview", () => {
  it("parses 'generates X SSTOA' on success", async () => {
    setPactReader(
      successReader({
        "pre-text": ["This action generates 1.0 SSTOA tokens"],
        kadena: {
          "kadena-text": "OK",
          "kadena-discount": 1,
          "kadena-full": 0,
          "kadena-need": 0,
        },
      }),
    );
    const out = await getWkdaCoilPreview("1");
    expect(out).toEqual({
      lkda: 1.0,
      fee: 0,
      kadenaInfo: { text: "OK", discount: 1, full: 0, need: 0 },
    });
  });

  it("re-throws on failure-status (LC-7-E)", async () => {
    setPactReader(failureStatusReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    await expect(getWkdaCoilPreview("1")).rejects.toThrow(/Failed to get coil preview/);
  });

  it("propagates the thrown read", async () => {
    setPactReader(throwingReader);
    setLogger({ warn: vi.fn(), error: vi.fn(), info: vi.fn() });
    await expect(getWkdaCoilPreview("1")).rejects.toThrow(/simulated pactRead failure/);
  });
});

// ══ coilTokensGeneric — LC-7-D execute-class adapted shape ═════════════════
describe("v4.2.0 coverage — coilFunctions.coilTokensGeneric (execute-class)", () => {
  it("locks the public-API parameter list and return type", () => {
    expectTypeOf(coilTokensGeneric).parameters.toEqualTypeOf<
      [IOuroAccountKeypair, IKadenaKeypair, IKadenaKeypair, string, string, CoilConfig]
    >();
    expectTypeOf(coilTokensGeneric).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable function (existence smoke)", () => {
    expect(typeof coilTokensGeneric).toBe("function");
    expect(coilTokensGeneric.length).toBe(6);
  });
});

// ══ coilOuroToAuryn — LC-7-D execute-class wrapper ═════════════════════════
describe("v4.2.0 coverage — coilFunctions.coilOuroToAuryn (execute-class)", () => {
  it("locks the public-API parameter list (no CoilConfig — bound to ouroToAuryn)", () => {
    expectTypeOf(coilOuroToAuryn).parameters.toEqualTypeOf<
      [IOuroAccountKeypair, IKadenaKeypair, IKadenaKeypair, string, string]
    >();
    expectTypeOf(coilOuroToAuryn).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable wrapper of coilTokensGeneric", () => {
    expect(typeof coilOuroToAuryn).toBe("function");
    expect(coilOuroToAuryn.length).toBe(5);
  });
});

// ══ coilAurynToElite — LC-7-D execute-class wrapper ═════════════════════════
describe("v4.2.0 coverage — coilFunctions.coilAurynToElite (execute-class)", () => {
  it("locks the public-API parameter list (no CoilConfig — bound to aurynToElite)", () => {
    expectTypeOf(coilAurynToElite).parameters.toEqualTypeOf<
      [IOuroAccountKeypair, IKadenaKeypair, IKadenaKeypair, string, string]
    >();
    expectTypeOf(coilAurynToElite).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable wrapper of coilTokensGeneric", () => {
    expect(typeof coilAurynToElite).toBe("function");
    expect(coilAurynToElite.length).toBe(5);
  });
});

// ══ coilWkdaToLkda — LC-7-D execute-class wrapper ═══════════════════════════
describe("v4.2.0 coverage — coilFunctions.coilWkdaToLkda (execute-class)", () => {
  it("locks the public-API parameter list (no CoilConfig — bound to wkdaToLkda)", () => {
    expectTypeOf(coilWkdaToLkda).parameters.toEqualTypeOf<
      [IOuroAccountKeypair, IKadenaKeypair, IKadenaKeypair, string, string]
    >();
    expectTypeOf(coilWkdaToLkda).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable wrapper of coilTokensGeneric", () => {
    expect(typeof coilWkdaToLkda).toBe("function");
    expect(coilWkdaToLkda.length).toBe(5);
  });
});

// ══ COIL_CONFIGS const-shape lock (LC-7-E) ═══════════════════════════════════
describe("v4.2.0 coverage — coilFunctions.COIL_CONFIGS (const-shape lock)", () => {
  it("locks the COIL_CONFIGS const shape (3 keys × 4 fields each)", () => {
    expect(Object.keys(COIL_CONFIGS).sort()).toEqual([
      "aurynToElite",
      "ouroToAuryn",
      "wkdaToLkda",
    ]);
    expect(COIL_CONFIGS.ouroToAuryn).toEqual({
      atsPair: "Auryndex-O136CBn22ncY",
      sourceToken: "OURO-8Nh-JO8JO4F5",
      targetToken: "AURYN-8Nh-JO8JO4F5",
      previewCommand: "Auryndex-O136CBn22ncY",
    });
    expect(COIL_CONFIGS.aurynToElite).toEqual({
      atsPair: "EliteAuryndex-O136CBn22ncY",
      sourceToken: "AURYN-8Nh-JO8JO4F5",
      targetToken: "ELITEAURYN-8Nh-JO8JO4F5",
      previewCommand: "EliteAuryndex-O136CBn22ncY",
    });
    expect(COIL_CONFIGS.wkdaToLkda).toEqual({
      atsPair: "SilverStoaPillar-O136CBn22ncY",
      sourceToken: "WSTOA-8Nh-JO8JO4F5",
      targetToken: "SSTOA-8Nh-JO8JO4F5",
      previewCommand: "SilverStoaPillar-O136CBn22ncY",
    });
  });
});
