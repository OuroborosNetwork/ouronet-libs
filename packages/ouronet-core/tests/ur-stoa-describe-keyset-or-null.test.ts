/**
 * Structural guard for the describeKeysetOrNull refactor in urStoaFunctions.
 *
 * The private describeKeyset helper was replaced with describeKeysetOrNull,
 * which delegates to the canonical guardFunctions.describeKeyset. The only
 * observable behavioral difference from outside the module is the logger error
 * message: the old helper logged "Error in describeKeyset:" whereas the new
 * helper logs "Error in describeKeysetOrNull:".
 *
 * This test exercises the error path (pactRead throws on the describe-keyset
 * call) and asserts the new message, which fails against the old code and
 * passes after the refactor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";
import { getUrStoaGuard } from "../src/interactions/urStoaFunctions";

let defaultLogger: Logger;

/**
 * A two-phase reader: succeeds for the UR_UR|Guard call (returning a keysetref
 * so the second branch is exercised) then throws for the describe-keyset call.
 * This forces the catch block inside describeKeysetOrNull to fire.
 */
const guardSuccessDescribeThrows: PactReader = (pactCode) => {
  if (pactCode.includes("UR_UR|Guard")) {
    return Promise.resolve({
      result: {
        status: "success",
        data: { keysetref: "test-keyset-ref" },
      },
    });
  }
  // describe-keyset call — throw to trigger the catch block
  return Promise.reject(new Error("simulated describe-keyset failure"));
};

beforeEach(() => {
  defaultLogger = getLogger();
  setPactReader(guardSuccessDescribeThrows);
});

afterEach(() => {
  setLogger(defaultLogger);
  setPactReader(rawCalibratedDirtyRead);
  vi.restoreAllMocks();
});

describe("describeKeysetOrNull error path — logger message after refactor", () => {
  it("logs 'Error in describeKeysetOrNull:' (not 'Error in describeKeyset:') when describe-keyset throws", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const result = await getUrStoaGuard("Σ.some-account");

    // The guard call itself should not throw — describeKeysetOrNull returns null
    // and the caller falls through to Case 3 (exists but not a keyset)
    expect(result).not.toBeNull();
    expect(result?.exists).toBe(true);
    expect(result?.isKeyset).toBe(false);

    // The refactored helper must log with the new name
    const errorCalls = (spyLogger.error as ReturnType<typeof vi.fn>).mock.calls;
    const messages = errorCalls.map((c: unknown[]) => c[0]);
    expect(messages).toContain("Error in describeKeysetOrNull:");
    expect(messages).not.toContain("Error in describeKeyset:");
  });
});
