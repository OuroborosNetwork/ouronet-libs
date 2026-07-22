/**
 * Phase 3 logger parity for remaining silent catches (REQ-10).
 *
 * Pins that getSWPPrincipals, getSwpairFromLpId, getDPTFIssueInfo route their
 * catch paths via getLogger().error("Error in <funcName>:", error) — not bare
 * console.error and not silent. Mirrors tests/phase5-catch-routing.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";
import {
  getSWPPrincipals,
  getSwpairFromLpId,
} from "../src/interactions/dexFunctions";
import { getDPTFIssueInfo } from "../src/interactions/ouroFunctions";

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

describe("Phase 3 logger parity for remaining silent catches (REQ-10)", () => {
  it("getSWPPrincipals returns [] on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getSWPPrincipals();

    expect(out).toEqual([]);
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getSWPPrincipals:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getSwpairFromLpId returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getSwpairFromLpId("test-lp-id");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getSwpairFromLpId:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getDPTFIssueInfo returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getDPTFIssueInfo("patron-addr", "resident-addr", ["token-id"]);

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getDPTFIssueInfo:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
