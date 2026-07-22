/**
 * Phase 1 fabricated-fallback removal — pricing functions (REQ-01..REQ-04).
 *
 * Pins that getStoaPriceUSD, getTokenDecimals, getPoolTotalFee, and getDPTFMinMove
 * return null (NOT the prior fabricated sentinels 1.0/8/0/0) when the chain read
 * throws, returns a non-success status, or yields a non-finite numeric, AND that
 * each catch path routes via getLogger().error("Error in <funcName>:", error)
 * — never bare console.error.
 *
 * Strategy mirrors tests/phase5-catch-routing.test.ts (the v2.3.0 Phase 5 precedent
 * for catch-routing regression tests): install a throwing/failure-status PactReader
 * via setPactReader, install a spy logger via setLogger, exercise each SUT, and
 * assert (a) returned null, (b) spyLogger.error called with the exact prefix,
 * (c) console.error never called.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";
import {
  getStoaPriceUSD,
  getDPTFMinMove,
} from "../src/interactions/ouroFunctions";
import {
  getTokenDecimals,
  getPoolTotalFee,
} from "../src/interactions/dexFunctions";

const throwingReader: PactReader = () =>
  Promise.reject(new Error("simulated pactRead failure"));

const failureStatusReader: PactReader = () =>
  Promise.resolve({ result: { status: "failure" } } as any);

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

describe("Phase 1 fabricated-fallback removal — pricing functions (REQ-01..REQ-04)", () => {
  it("getStoaPriceUSD returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getStoaPriceUSD();

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledTimes(1);
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getStoaPriceUSD:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getStoaPriceUSD returns null on chain failure-status without invoking the catch", async () => {
    setPactReader(failureStatusReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);

    const out = await getStoaPriceUSD();

    expect(out).toBeNull();
    expect(spyLogger.error).not.toHaveBeenCalled();
  });

  it("getStoaPriceUSD returns the parsed finite numeric on success path (counting stub)", async () => {
    const successReader: PactReader = () =>
      Promise.resolve({ result: { status: "success", data: { decimal: "1.5" } } } as any);
    setPactReader(successReader);

    const out = await getStoaPriceUSD();

    expect(out).toBe(1.5);
  });

  it("getTokenDecimals returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getTokenDecimals("OURO");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getTokenDecimals:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getTokenDecimals returns null on parseInt-NaN payload (Number.isFinite guard)", async () => {
    const nanReader: PactReader = () =>
      Promise.resolve({ result: { status: "success", data: { int: "abc" } } } as any);
    setPactReader(nanReader);

    const out = await getTokenDecimals("OURO");

    expect(out).toBeNull();
  });

  it("getPoolTotalFee returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getPoolTotalFee("test-pair");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getPoolTotalFee:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("getDPTFMinMove returns null on thrown read and routes catch via getLogger().error", async () => {
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const out = await getDPTFMinMove("OURO");

    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith(
      "Error in getDPTFMinMove:",
      expect.any(Error),
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
