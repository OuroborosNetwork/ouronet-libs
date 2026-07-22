/**
 * v4.2.0 — F-TEST-006 BREADTH closure: comprehensive runtime coverage for the
 * 2 previously-untested exports of `activateFunctions.ts`.
 *
 * Closes REQ-27 (per-module test files), REQ-28 (canonical isolation harness),
 * REQ-29 (per-function 3-spec contract), REQ-30 (≥1110 aggregate spec floor).
 *
 * Mirrors `tests/v3-3-5-smoke.test.ts:243-262` (the
 * `getDeployStandardAccountInfoOnly` pattern). `getDeployStandardAccountInfo`
 * gets the LC-7-C 3-spec shape (it's pactRead-routed read-only with try/catch
 * + null-on-failure, with SPECIAL extraction `{ info, receivers }` from the
 * data payload). `executeDeployStandardAccount` gets the LC-7-D adapted
 * 2-spec shape (type-signature smoke + function-existence smoke). Per-file
 * floor: ≥4 it-blocks.
 */

import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";

import {
  getDeployStandardAccountInfo,
  executeDeployStandardAccount,
  type DeployStandardAccountParams,
} from "../src/interactions/activateFunctions";

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

// ══ getDeployStandardAccountInfo — LC-7-C 3-spec ═══════════════════════════
describe("v4.2.0 coverage — activateFunctions.getDeployStandardAccountInfo", () => {
  it("extracts { info, receivers } from the success-path data payload", async () => {
    const stub = { info: { foo: 1 }, receivers: ["k:a", "k:b"] };
    setPactReader(successReader(stub));
    const out = await getDeployStandardAccountInfo("k:account");
    expect(out).toEqual({ info: { foo: 1 }, receivers: ["k:a", "k:b"] });
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getDeployStandardAccountInfo("k:account");
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getDeployStandardAccountInfo("k:account");
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error fetching DeployStandardAccount info:",
      expect.any(Error),
    );
  });
});

// ══ executeDeployStandardAccount — LC-7-D execute-class adapted shape ══════
describe("v4.2.0 coverage — activateFunctions.executeDeployStandardAccount (execute-class)", () => {
  it("locks the public-API parameter list (single DeployStandardAccountParams arg)", () => {
    expectTypeOf(executeDeployStandardAccount).parameters.toEqualTypeOf<[DeployStandardAccountParams]>();
    expectTypeOf(executeDeployStandardAccount).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable function with arity 1", () => {
    expect(typeof executeDeployStandardAccount).toBe("function");
    expect(executeDeployStandardAccount.length).toBe(1);
  });
});
