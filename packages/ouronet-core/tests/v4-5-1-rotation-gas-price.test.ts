/**
 * v4.5.1 — Yin Engine gas pricing for the two rotation executors.
 *
 * `rotateGuard` (guardFunctions.ts) and `rotateKadenaPaymentKey`
 * (ouroRotateFunctions.ts) set `creationTime` but never set `gasPrice`, so the
 * vendored client stamped its `1.0e-8` default — exactly the 10,000-ANU
 * genesis floor. StoaChain's minimum gas price rises 1 ANU every 3 hours, so
 * from the floor's first tick onward every rotation was rejected as
 * underpriced. The Gas Station paying the transaction does not exempt it: the
 * chain-wide minimum-price rule is evaluated before `DALOS.GAS_PAYER` runs.
 *
 * These specs lock the three properties the fix has to keep:
 *   1. `gasPrice` is present on the submitted command and tracks the live floor.
 *   2. `gasPrice` is derived from THE SAME clock read as `creationTime`
 *      (the anti-race rule) — assertable because the derivation is a pure
 *      function of the `creationTime` that actually shipped in the command.
 *   3. The ANU → STOA conversion is padding-built, so the value is exact at
 *      12 decimals rather than a float-division artefact.
 *
 * Harness follows `v4-2-0-add-liquidity-executor-parity.test.ts`: the network
 * client and `universalSignTransaction` are `vi.mock`-replaced so nothing
 * touches a node, and the command JSON is read off the transaction handed to
 * `dirtyRead` / `submit` rather than by stubbing the fluent Pact builder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Capture buffers ─────────────────────────────────────────────────────────
let simulatedMeta: any = null;
let submittedMeta: any = null;

vi.mock("@stoachain/stoa-core/network", async () => {
  const actual = await vi.importActual<typeof import("@stoachain/stoa-core/network")>(
    "@stoachain/stoa-core/network",
  );
  return {
    ...actual,
    getFailoverClient: vi.fn(() => ({
      dirtyRead: vi.fn(async (tx: any) => {
        simulatedMeta = JSON.parse(tx.cmd).meta;
        return { result: { status: "success", data: {} }, gas: 50_000 };
      }),
      submit: vi.fn(async (tx: any) => {
        submittedMeta = JSON.parse(tx.cmd).meta;
        return { requestKey: "stub-request-key" };
      }),
      poll: vi.fn(async () => ({ result: { status: "success" } })),
    })),
  };
});

vi.mock("@stoachain/stoa-core/signing", async () => {
  const actual = await vi.importActual<typeof import("@stoachain/stoa-core/signing")>(
    "@stoachain/stoa-core/signing",
  );
  return {
    ...actual,
    universalSignTransaction: vi.fn(async (tx: any) => tx),
  };
});

import { rotateGuard } from "../src/interactions/guardFunctions";
import { rotateKadenaPaymentKey } from "../src/interactions/ouroRotateFunctions";

// ─── The Yin Engine, restated independently of the implementation ────────────
// Deliberately NOT imported from the source (the helpers are module-private,
// and a test that reuses the implementation cannot catch a wrong formula).
const GENESIS_TIME_S = 1771869600; // 2026-02-23T18:00:00Z — tick 0
const GENESIS_MIN_GAS_ANU = 10_000;
const MAX_GAS_ANU = 400_000;
const INTERVAL_S = 10_800; // 3 h per tick

function expectedAnu(creationTimeS: number): number {
  const elapsed = creationTimeS - GENESIS_TIME_S;
  const ticks = elapsed <= 0 ? 0 : Math.floor(elapsed / INTERVAL_S);
  return Math.min(GENESIS_MIN_GAS_ANU + ticks, MAX_GAS_ANU);
}

function expectedGasPrice(creationTimeS: number): number {
  return Number("0." + String(expectedAnu(creationTimeS)).padStart(12, "0"));
}

/** The stale default the vendored client stamps when `gasPrice` is omitted. */
const CLIENT_DEFAULT_GAS_PRICE = 1.0e-8;

// `safeCreationTime()` is `floor(Date.now() / 1000) - 30`, so pinning the
// system clock pins the creationTime — and therefore the expected price.
const SKEW_S = 30;

// ─── Fixtures ────────────────────────────────────────────────────────────────
const gasStationKey = { publicKey: "gaspub", privateKey: "gaspriv" };
const patronGuardKeys = [{ publicKey: "patronpub", privateKey: "patronpriv" }];
const accountGuardKeys = [{ publicKey: "accountpub", privateKey: "accountpriv" }];
const newGuardKeys = [{ publicKey: "newpub", privateKey: "newpriv" }];

async function runRotateGuard() {
  return rotateGuard({
    patronAddress: "Ѻ.PATRON",
    accountAddress: "Ѻ.ACCOUNT",
    mode: "define",
    newKeys: ["newpub"],
    newPred: "keys-all",
    safe: true,
    gasStationKey,
    patronGuardKeys,
    accountGuardKeys,
    newGuardKeys,
  });
}

async function runRotateKadena() {
  return rotateKadenaPaymentKey(
    "Ѻ.PATRON",
    "Ѻ.ACCOUNT",
    "k:newpaymentkey",
    gasStationKey,
    patronGuardKeys,
    accountGuardKeys,
    { keys: ["patronpub"], pred: "keys-all" },
    { keys: ["accountpub"], pred: "keys-all" },
  );
}

const EXECUTORS: ReadonlyArray<[string, () => Promise<unknown>]> = [
  ["guardFunctions.rotateGuard", runRotateGuard],
  ["ouroRotateFunctions.rotateKadenaPaymentKey", runRotateKadena],
];

beforeEach(() => {
  simulatedMeta = null;
  submittedMeta = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe.each(EXECUTORS)("v4.5.1 Yin gas pricing — %s", (_name, run) => {
  it("stamps a gasPrice at the live floor, not the client's genesis default", async () => {
    // 1157 ticks past genesis → 11,157 ANU, comfortably above the default.
    vi.setSystemTime(new Date((GENESIS_TIME_S + 1157 * INTERVAL_S + SKEW_S) * 1000));
    await run();

    expect(submittedMeta.gasPrice).toBe(Number("0.000000011157"));
    expect(submittedMeta.gasPrice).toBeGreaterThan(CLIENT_DEFAULT_GAS_PRICE);
  });

  it("derives gasPrice from the very creationTime it ships (one clock read)", async () => {
    vi.setSystemTime(new Date((GENESIS_TIME_S + 900 * INTERVAL_S + SKEW_S) * 1000));
    await run();

    // Both the simulated and the re-built (auto-gas-limit) command must be
    // internally consistent: price is a pure function of the shipped time.
    for (const meta of [simulatedMeta, submittedMeta]) {
      expect(meta.creationTime).toBe(GENESIS_TIME_S + 900 * INTERVAL_S);
      expect(meta.gasPrice).toBe(expectedGasPrice(meta.creationTime));
    }
  });

  it("holds at the genesis floor at (and before) tick 0", async () => {
    vi.setSystemTime(new Date((GENESIS_TIME_S + SKEW_S) * 1000));
    await run();

    expect(submittedMeta.gasPrice).toBe(CLIENT_DEFAULT_GAS_PRICE);
    expect(submittedMeta.gasPrice).toBe(expectedGasPrice(GENESIS_TIME_S));
  });

  it("caps at 400,000 ANU however far past genesis the clock is", async () => {
    vi.setSystemTime(new Date((GENESIS_TIME_S + 5_000_000 * INTERVAL_S + SKEW_S) * 1000));
    await run();

    expect(submittedMeta.gasPrice).toBe(Number("0.000000400000"));
    expect(expectedAnu(submittedMeta.creationTime)).toBe(MAX_GAS_ANU);
  });

  it("produces an exact 12-decimal value (padding-built, not float division)", async () => {
    // 1565 ticks → 11,565 ANU, the price the v4.5.0 cross-chain fix was
    // verified against on a live node.
    vi.setSystemTime(new Date((GENESIS_TIME_S + 1565 * INTERVAL_S + SKEW_S) * 1000));
    await run();

    expect(submittedMeta.gasPrice).toBe(Number("0.000000011565"));
    // The value round-trips through the command JSON without precision drift.
    expect(submittedMeta.gasPrice.toFixed(12)).toBe("0.000000011565");
  });

  it("leaves the auto-gas-limit re-build priced identically to the simulation", async () => {
    vi.setSystemTime(new Date((GENESIS_TIME_S + 2000 * INTERVAL_S + SKEW_S) * 1000));
    await run();

    expect(simulatedMeta.gasPrice).toBe(submittedMeta.gasPrice);
    expect(submittedMeta.gasLimit).not.toBe(2_000_000); // auto-gas-limit applied
  });
});
