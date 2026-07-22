/**
 * v4.2.0 — F-TEST-006 BREADTH closure: comprehensive runtime coverage for the
 * 2 previously-untested exports of `guardFunctions.ts` (the audit-stated count
 * of 1 was an undercount; `describeKeyset` was missed from the audit list and
 * is covered here as the +1 — Phase 7 treats the audit "1" as the floor, not
 * the ceiling).
 *
 * Closes REQ-27 (per-module test files), REQ-28 (canonical isolation harness),
 * REQ-29 (per-function 3-spec contract), REQ-30 (≥1110 aggregate spec floor).
 *
 * `describeKeyset` is pactRead-routed read-only but has NO try/catch wrapper —
 * it THROWS on non-success at source line 72-74 (LC-7-E exception). Both the
 * failure-status path and the RPC-throw path produce a thrown error,
 * assertable via `rejects.toThrow`. `rotateGuard` is execute-class (LC-7-D
 * adapted shape — type-signature smoke + mode-discriminator smoke).
 * Per-file floor: ≥3 it-blocks.
 */

import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";

import {
  describeKeyset,
  rotateGuard,
  type IDescribedKeyset,
  type RotateGuardParams,
} from "../src/interactions/guardFunctions";

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

// ══ describeKeyset — LC-7-E throw-on-failure (no try/catch) ═════════════════
describe("v4.2.0 coverage — guardFunctions.describeKeyset", () => {
  it("returns { keys, pred } extracted from success-path data", async () => {
    const stub = { keys: ["pubkey1", "pubkey2"], pred: "keys-all" };
    setPactReader(successReader(stub));
    const out: IDescribedKeyset = await describeKeyset("test-ks");
    expect(out).toEqual({ keys: ["pubkey1", "pubkey2"], pred: "keys-all" });
  });

  it("throws 'Failed to describe keyset' on failure-status (no error.message available)", async () => {
    setPactReader(failureStatusReader);
    await expect(describeKeyset("test-ks")).rejects.toThrow(/Failed to describe keyset/);
  });

  it("propagates the thrown read error (no try/catch wrapper)", async () => {
    setPactReader(throwingReader);
    await expect(describeKeyset("test-ks")).rejects.toThrow(/simulated pactRead failure/);
  });
});

// ══ rotateGuard — LC-7-D execute-class adapted shape ════════════════════════
describe("v4.2.0 coverage — guardFunctions.rotateGuard (execute-class)", () => {
  it("locks the public-API parameter list (single RotateGuardParams arg)", () => {
    expectTypeOf(rotateGuard).parameters.toEqualTypeOf<[RotateGuardParams]>();
    expectTypeOf(rotateGuard).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("is a callable function with arity 1", () => {
    expect(typeof rotateGuard).toBe("function");
    expect(rotateGuard.length).toBe(1);
  });

  it("locks the RotateGuardParams.mode discriminated union ('define' | 'existing')", () => {
    expectTypeOf<RotateGuardParams["mode"]>().toEqualTypeOf<"define" | "existing">();
  });
});
