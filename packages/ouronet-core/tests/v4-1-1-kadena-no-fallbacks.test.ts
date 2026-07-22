/**
 * REQ-01 (F-ERR-022): Remove fabricated fallbacks in `kadenaFunctions.ts`.
 *
 * v3.0.0 sweep identified that `getBalance` silently returns `"0"` when
 * `result.data` is null/undefined, and `accountDescription` fabricates
 * `{ balance: "0", account: address, guard: null }` when the success envelope
 * lacks a `balance` field. These are false-ok responses — callers cannot
 * distinguish "account does not exist" from "Kadena returned malformed data".
 *
 * Phase 0 T0.1 classified both sites as STILL-OPEN (neither was closed by the
 * seam-migration sweep). This suite pins the corrected behavior:
 *
 *   - Malformed/absent `result.data` on a COIN success response → throw
 *     `KadenaShapeError` with the unexpected envelope stored as `cause`.
 *   - Well-formed envelopes → return existing happy-path shape unchanged.
 *   - `result.status === "failure"` in `accountDescription` → existing
 *     `isNewAccount: true` behavior is LEGITIMATE per REQ-01 and must stay
 *     green (that branch is intentional, not a fabricated fallback).
 *
 * Locked convention (class created in the following task):
 *   `KadenaShapeError extends Error`
 *   Constructor: `(message: string, options?: { cause?: unknown })`
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getBalance, accountDescription } from "@ouronet/ouronet-core/interactions/kadenaFunctions";
import { KadenaShapeError } from "@ouronet/ouronet-core/interactions/errors";

// ---------------------------------------------------------------------------
// Stub factory
// Each test installs its own stub via `setPactReader` inside beforeEach so
// the pattern mirrors the canonical seam-stub harness in interactions-read-seam.test.ts.
// ---------------------------------------------------------------------------

function makeStub(responseFactory: (pactCode: string) => unknown): PactReader {
  return (pactCode, _options) => Promise.resolve(responseFactory(pactCode) as any);
}

// ---------------------------------------------------------------------------
// Shared setup / teardown — restore default reader after every test so stub
// never leaks across test files when the suite runs in band.
// ---------------------------------------------------------------------------

beforeEach(() => {
  setPactReader(rawCalibratedDirtyRead);
});

afterEach(() => {
  setPactReader(rawCalibratedDirtyRead);
});

// ---------------------------------------------------------------------------
// getBalance — malformed envelope tests
// ---------------------------------------------------------------------------

describe("getBalance — shape validation", () => {
  it("throws KadenaShapeError with cause when result.data is undefined", async () => {
    const stub = makeStub(() => ({ result: { status: "success", data: undefined } }));
    setPactReader(stub);

    let err: unknown;
    try {
      await getBalance("k:test-account");
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(KadenaShapeError);
    expect((err as KadenaShapeError).cause).toBeDefined();
  });

  it("throws KadenaShapeError with cause when result.data is null", async () => {
    const stub = makeStub(() => ({ result: { status: "success", data: null } }));
    setPactReader(stub);

    let err: unknown;
    try {
      await getBalance("k:test-account");
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(KadenaShapeError);
    expect((err as KadenaShapeError).cause).toBeDefined();
  });

  it("returns account + unwrapped decimal string for object envelope { decimal: '42.5' }", async () => {
    const stub = makeStub(() => ({ result: { status: "success", data: { decimal: "42.5" } } }));
    setPactReader(stub);

    const result = await getBalance("k:test-account");

    expect(result).toEqual({ account: "k:test-account", balance: "42.5" });
  });

  it("returns account + plain string balance for string envelope '10.0'", async () => {
    const stub = makeStub(() => ({ result: { status: "success", data: "10.0" } }));
    setPactReader(stub);

    const result = await getBalance("k:test-account");

    expect(result).toEqual({ account: "k:test-account", balance: "10.0" });
  });
});

// ---------------------------------------------------------------------------
// accountDescription — shape validation and existing failure-branch behavior
// ---------------------------------------------------------------------------

describe("accountDescription — shape validation", () => {
  it("throws KadenaShapeError with cause when success envelope lacks balance field", async () => {
    // A success response where data exists but has no `balance` key is a
    // malformed Kadena COIN envelope — callers must not receive a fabricated "0".
    const stub = makeStub(() => ({
      result: {
        status: "success",
        data: { account: "k:abc", guard: { keys: ["pub"], pred: "keys-all" } },
        // NOTE: `balance` is intentionally absent — this is the shape mismatch
      },
    }));
    setPactReader(stub);

    let err: unknown;
    try {
      await accountDescription("k:abc");
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(KadenaShapeError);
    // `cause` must reference the actual unexpected envelope so callers can log
    // the real response; a fabricated { balance: "0", ... } must NOT appear here.
    expect((err as KadenaShapeError).cause).toBeDefined();
  });

  it("preserves isNewAccount: true and account/guard fallbacks when result.status is failure", async () => {
    // `status === "failure"` is the LEGITIMATE new-account signal from Kadena
    // (COIN.details throws when the account doesn't exist). The fallbacks
    // `account || address` and `guard || null` at those lines are intentional
    // and must remain green per REQ-01.
    const stub = makeStub((pactCode) => {
      if (pactCode.includes("coin.details")) {
        return {
          result: {
            status: "failure",
            error: { message: "row not found" },
          },
        };
      }
      return { result: { status: "success", data: null } };
    });
    setPactReader(stub);

    const result = await accountDescription("k:new-account");

    expect(result.isNewAccount).toBe(true);
    // Fallbacks for account and guard are legitimate on the failure branch
    expect(result.account).toBe("k:new-account"); // `result?.data?.account || address`
    expect(result.guard).toBeNull();               // `result?.data?.guard || null`
  });
});
