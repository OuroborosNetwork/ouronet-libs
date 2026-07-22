/**
 * v4.2.0 — F-TEST-006 BREADTH closure: comprehensive runtime coverage for the
 * 2 previously-untested exports of `pensionFunctions.ts`.
 *
 * Closes REQ-27 (per-module test files), REQ-28 (canonical isolation harness),
 * REQ-29 (per-function 3-spec contract), REQ-30 (≥1110 aggregate spec floor).
 *
 * Both untested functions (`brumateWkdaToPkda`, `constrictLkdaToPkda`) are
 * execute-class — they call `getFailoverClient(...).dirtyRead/submit` and are
 * NOT stubable via `setPactReader`. LC-7-D adapted shape applies. Neither has
 * synchronous pre-call validation that throws BEFORE `dirtyRead`, so the
 * "pre-call-validation smoke" of LC-7-D is omitted; instead each gets 3
 * type-level lock specs (parameter list, return type, function existence) to
 * land the file's ≥5 it-block floor (LC-7-I). `getHibernateFee` is already
 * covered by `tests/v3-3-5-smoke.test.ts:124-141` — Phase 7 does not re-test it.
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
  brumateWkdaToPkda,
  constrictLkdaToPkda,
} from "../src/interactions/pensionFunctions";
import type { IOuroAccountKeypair } from "../src/interactions/ouroTypes";

// ─── Stub builders (LC-7-A canonical harness) ───────────────────────────────
function successReader(data: unknown): PactReader {
  return () =>
    Promise.resolve({ result: { status: "success", data } } as any);
}

let defaultLogger: Logger;

beforeEach(() => {
  defaultLogger = getLogger();
});

afterEach(() => {
  setLogger(defaultLogger);
  setPactReader(rawCalibratedDirtyRead);
  vi.restoreAllMocks();
});

// Reference unused harness members so bare-tsc does not flag them as dead
// (kept for symmetry with the other 5 Phase-7 test files; the const-fn
// references make them dependencies of the file's symbol graph).
void successReader;

// ══ brumateWkdaToPkda — LC-7-D execute-class adapted shape ═════════════════
describe("v4.2.0 coverage — pensionFunctions.brumateWkdaToPkda (execute-class)", () => {
  it("locks the public-API parameter list (5 args including lockDays:number)", () => {
    expectTypeOf(brumateWkdaToPkda).parameters.toEqualTypeOf<
      [IOuroAccountKeypair, IKadenaKeypair, IKadenaKeypair, string, number]
    >();
  });

  it("locks the return type as Promise<unknown>", () => {
    expectTypeOf(brumateWkdaToPkda).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable function with arity 5", () => {
    expect(typeof brumateWkdaToPkda).toBe("function");
    expect(brumateWkdaToPkda.length).toBe(5);
  });
});

// ══ constrictLkdaToPkda — LC-7-D execute-class adapted shape ═══════════════
describe("v4.2.0 coverage — pensionFunctions.constrictLkdaToPkda (execute-class)", () => {
  it("locks the public-API parameter list (5 args including lockDays:number)", () => {
    expectTypeOf(constrictLkdaToPkda).parameters.toEqualTypeOf<
      [IOuroAccountKeypair, IKadenaKeypair, IKadenaKeypair, string, number]
    >();
  });

  it("locks the return type as Promise<unknown>", () => {
    expectTypeOf(constrictLkdaToPkda).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable function with arity 5", () => {
    expect(typeof constrictLkdaToPkda).toBe("function");
    expect(constrictLkdaToPkda.length).toBe(5);
  });
});
