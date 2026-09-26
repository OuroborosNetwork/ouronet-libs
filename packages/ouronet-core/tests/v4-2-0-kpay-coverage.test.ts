/**
 * v4.2.0 — F-TEST-006 BREADTH closure: comprehensive runtime coverage for the
 * 3 previously-untested exports of `kpayFunctions.ts`.
 *
 * Closes REQ-27 (per-module test files), REQ-28 (canonical isolation harness),
 * REQ-29 (per-function 3-spec contract), REQ-30 (≥1110 aggregate spec floor).
 *
 * Mirrors `tests/v3-3-5-smoke.test.ts:80-120` for the LC-7-A canonical
 * isolation harness. The 2 read-only functions (`getKpayAmountCosts`,
 * `getKpayAcquireCapabilities`) get the LC-7-C 3-spec shape — happy /
 * RPC-failure / RPC-throw. The 1 execute-class function (`kpayBuy`) gets the
 * LC-7-D adapted 2-spec shape: type-signature smoke + a pre-call-validation
 * smoke that exploits its internal call to `getKpayAcquireCapabilities` to
 * trigger the "Failed to retrieve capabilities for KPAY purchase" throw via
 * `setPactReader(failureStatusReader)`. Per-file floor: ≥7 it-blocks.
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
  getKpayAmountCosts,
  getKpayAcquireCapabilities,
  kpayBuy,
  type IOuroAccountKeypair,
} from "../src/interactions/kpayFunctions";

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

// ══ getKpayAmountCosts ══════════════════════════════════════════════════════
describe("v4.2.0 coverage — kpayFunctions.getKpayAmountCosts", () => {
  it("returns success data verbatim (default futureSeconds)", async () => {
    const stub = { pid: "1.5", wkda: "100.0" };
    setPactReader(successReader(stub));
    const out = await getKpayAmountCosts(10);
    expect(out).toEqual(stub);
  });

  it("returns success data verbatim (custom futureSeconds)", async () => {
    const stub = { pid: "2.0", wkda: "120.0" };
    setPactReader(successReader(stub));
    const out = await getKpayAmountCosts(10, 1800);
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getKpayAmountCosts(10);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getKpayAmountCosts(10);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting KPay amount costs:", expect.any(Error));
  });
});

// ══ getKpayAcquireCapabilities ══════════════════════════════════════════════
describe("v4.2.0 coverage — kpayFunctions.getKpayAcquireCapabilities", () => {
  it("returns capability strings array verbatim on success (isNative=true)", async () => {
    const stub = ['<(coin.TRANSFER "k:from" "c:to" 46.298)>'];
    setPactReader(successReader(stub));
    const out = await getKpayAcquireCapabilities("k:buyer", 100, true, 1.0);
    expect(out).toEqual(stub);
  });

  it("returns capability strings array verbatim on success (isNative=false, WSTOA)", async () => {
    const stub = ['<(ouronet-ns.WSTOA.TRANSFER "k:from" "c:to" 100.0)>'];
    setPactReader(successReader(stub));
    const out = await getKpayAcquireCapabilities("k:buyer", 100, false, 1.0);
    expect(out).toEqual(stub);
  });

  it("returns null on failure-status", async () => {
    setPactReader(failureStatusReader);
    const out = await getKpayAcquireCapabilities("k:buyer", 100, true, 1.0);
    expect(out).toBeNull();
  });

  it("returns null and logs on thrown read", async () => {
    setPactReader(throwingReader);
    const spyLogger: Logger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    setLogger(spyLogger);
    const out = await getKpayAcquireCapabilities("k:buyer", 100, true, 1.0);
    expect(out).toBeNull();
    expect(spyLogger.error).toHaveBeenCalledWith("Error getting KPay acquire capabilities:", expect.any(Error));
  });
});

// ══ kpayBuy — LC-7-D execute-class with pre-call validation smoke ══════════
describe("v4.2.0 coverage — kpayFunctions.kpayBuy (execute-class)", () => {
  // UPDATED 2026-09-26. This "lock" pinned a SEVEN-parameter signature, and seven parameters
  // could not build a valid transaction: the execution string named TS02-DPAD.KPAY|C_BuyKpay,
  // a module/function pair that does not exist, and omitted `max-cost` -- so the deployed
  // TS02-CPAD.KPAY|C_BuyStoicPay would have partially applied to a closure rather than erroring.
  // A signature lock asserts that the shape has not drifted; it cannot notice that the shape was
  // never right. `slippagePercent` is the eighth, and it is required rather than defaulted
  // because the same number bounds BOTH the capability pad and max-cost.
  it("locks the public-API parameter list and return type", () => {
    expectTypeOf(kpayBuy).parameters.toEqualTypeOf<
      [
        IOuroAccountKeypair,
        string,
        number,
        boolean,
        IKadenaKeypair,
        IKadenaKeypair,
        { keys: string[]; pred: "keys-all" | "keys-any" | "keys-2" },
        number
      ]
    >();
    expectTypeOf(kpayBuy).returns.toMatchTypeOf<Promise<unknown>>();
  });

  it("throws 'Failed to retrieve capabilities' when upstream getKpayAcquireCapabilities returns null (failure-status)", async () => {
    setPactReader(failureStatusReader);
    const patron: IOuroAccountKeypair = { address: "k:patron", publicKey: "pk", privateKey: "sk" };
    const kadena: IKadenaKeypair = { publicKey: "k1", privateKey: "s1" } as IKadenaKeypair;
    const guard: IKadenaKeypair = { publicKey: "k2", privateKey: "s2" } as IKadenaKeypair;
    await expect(
      kpayBuy(patron, "k:buyer", 100, true, kadena, guard, { keys: ["pk"], pred: "keys-all" }, 1.0),
    ).rejects.toThrow(/Failed to retrieve capabilities for KPAY purchase/);
  });

  it("refuses an out-of-range slippage before reaching the chain", async () => {
    const patron: IOuroAccountKeypair = { address: "k:patron", publicKey: "pk", privateKey: "sk" };
    const kadena: IKadenaKeypair = { publicKey: "k1", privateKey: "s1" } as IKadenaKeypair;
    const guard: IKadenaKeypair = { publicKey: "k2", privateKey: "s2" } as IKadenaKeypair;
    const ks = { keys: ["pk"], pred: "keys-all" as const };
    for (const bad of [-1, 50.1, NaN]) {
      await expect(kpayBuy(patron, "k:buyer", 100, true, kadena, guard, ks, bad))
        .rejects.toThrow(/Slippage must be between 0 and 50 percent/);
    }
  });
});
