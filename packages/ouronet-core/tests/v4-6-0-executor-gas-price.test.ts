/**
 * v4.6.0 — every transaction-building executor prices against the live Yin floor.
 *
 * 4.5.0 fixed `crossChainFunctions.ts` and 4.5.1 fixed the two rotation
 * executors; the rest of `interactions/*` still set `creationTime` alone and
 * inherited the vendored client's `1.0e-8` default — exactly the Yin Engine's
 * genesis floor, and therefore underpriced from the floor's first tick onward.
 * 4.6.0 routes every `setMeta` in the package through the canonical
 * `stoaGasMeta` in `@stoachain/stoa-core/gas`.
 *
 * This file is the BEHAVIOURAL half of that lock: it drives one real executor
 * per fixed source file through the mocked network seam and reads the price off
 * the command JSON that would have gone to chainweb. The STRUCTURAL half —
 * every `setMeta` object literal in `src/`, not just the sampled ones — is
 * `v4-6-0-gas-price-invariant.test.ts`.
 *
 * Harness: `getFailoverClient` and `universalSignTransaction` are
 * `vi.mock`-replaced (nothing touches a node, no nacl signing); reads go
 * through `setPactReader`. The clock is pinned so the expected floor is exact.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
      listen: vi.fn(async () => ({ result: { status: "success" } })),
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

import { setPactReader, rawCalibratedDirtyRead, type PactReader } from "@stoachain/stoa-core/reads";

import { coilTokensGeneric, COIL_CONFIGS } from "../src/interactions/coilFunctions";
import { transferToken } from "../src/interactions/ouroTransferFunctions";
import { executeAddLiquidity } from "../src/interactions/addLiquidityFunctions";
import { movieBoosterBuy } from "../src/interactions/ouroMovieBoosterFunctions";
import { executeSmartSwapWithSlippage } from "../src/interactions/dexSwapPairSmartSwapFunctions";
import { executeWrapStoa } from "../src/interactions/wrapFunctions";
import { coilOuroToAuryn } from "../src/interactions/ouroCoilFunctions";
import { executeSingleSwapWithSlippage } from "../src/interactions/dexSwapPairExecuteFunctions";
import { executeStakeUrStoa } from "../src/interactions/urStoaFunctions";
import { executeDeployStandardAccount } from "../src/interactions/activateFunctions";
import { sublimateOuroToIgnis } from "../src/interactions/ouroSubCompressFunctions";
import { executeUnwrapUrStoa } from "../src/interactions/ouroUrStoaFunctions";
import { brumateWkdaToPkda } from "../src/interactions/pensionFunctions";
import { kpayBuy } from "../src/interactions/kpayFunctions";
import { wrapKadena } from "../src/interactions/ouroWrapFunctions";
import { rotateGuard } from "../src/interactions/guardFunctions";
import { rotateKadenaPaymentKey } from "../src/interactions/ouroRotateFunctions";
import {
  buildCrossChainTransfer,
  buildCTransferAcross,
  buildContinuationTransaction,
} from "../src/interactions/crossChainFunctions";

// ─── The Yin Engine, restated independently of the implementation ────────────
const GENESIS_TIME_S = 1771869600; // 2026-02-23T18:00:00Z — tick 0
const GENESIS_MIN_GAS_ANU = 10_000;
const MAX_GAS_ANU = 400_000;
const INTERVAL_S = 10_800; // 3 h per tick
const SKEW_S = 30; // `safeCreationTime()` = floor(now/1000) - 30 (F-BUG-002)
const CLIENT_DEFAULT_GAS_PRICE = 1.0e-8; // the stale genesis-floor default

function expectedGasPrice(creationTimeS: number): number {
  const elapsed = creationTimeS - GENESIS_TIME_S;
  const ticks = elapsed <= 0 ? 0 : Math.floor(elapsed / INTERVAL_S);
  const anu = Math.min(GENESIS_MIN_GAS_ANU + ticks, MAX_GAS_ANU);
  return Number("0." + String(anu).padStart(12, "0"));
}

// 1157 ticks past genesis → 11,157 ANU. Well clear of the 10,000 default, well
// short of the 400,000 cap, so a wrong formula cannot coincidentally pass.
const TICKS = 1157;
const PINNED_NOW_S = GENESIS_TIME_S + TICKS * INTERVAL_S + SKEW_S;
const EXPECTED_CREATION_TIME = PINNED_NOW_S - SKEW_S;
const EXPECTED_GAS_PRICE = Number("0.000000011157");

// ─── Fixtures ────────────────────────────────────────────────────────────────
const ouro = { address: "Ѻ.PATRON", publicKey: "patronpub", privateKey: "patronpriv" };
const kadena = { publicKey: "kadenapub", privateKey: "kadenapriv" };
const guard = { publicKey: "guardpub", privateKey: "guardpriv" };
const gasStationKey = { publicKey: "gaspub", privateKey: "gaspriv" };
const keyset = { keys: ["guardpub"], pred: "keys-all" as const };

// Permissive reader: the few executors that read before building only need a
// success-shaped answer, keyed off the Pact code they send.
const reader: PactReader = (pactCode: string) => {
  let data: unknown = "1.0";
  if (pactCode.includes("URC_Acquire")) data = ['(coin.TRANSFER "alice" "bob" 1.0)'];
  // SmartSwap now assembles a route bundle before building, so its readers need answers with
  // the right SHAPE -- a Hopper is {nodes, edges}, and a route of [BAR] means "no path", which
  // would make the executor refuse before it ever builds a transaction. These fixtures exist
  // so a GAS-PRICING test does not silently become a routing test.
  else if (pactCode.includes("URC_HopperActive")) {
    data = { nodes: ["IN", "OUT"], edges: ["POOL-1"], "output-values": [1.0] };
  } else if (pactCode.includes("URC_ReadPathCache")) {
    data = { nodes: ["|"], edges: [], "topology-version": 1 };   // a miss, so the trace runs
  } else if (pactCode.includes("UR_PoolTokens")) {
    data = ["FIRST-TOKEN", "OUT"];
  } else if (pactCode.includes("UR_SilverStoaID")) {
    data = "SSTOA";
  } else if (pactCode.includes("UR_WrappedStoaID")) {
    data = "WSTOA";
  }
  else if (pactCode.includes("URC_KpayAmountCosts")) {
    // SHAPED LIKE THE CONTRACT, not like the catch-all below. kpayBuy reads this to build its
    // `max-cost` ceiling, and the generic ["1.0","1.0"] made it throw "price is not numeric" --
    // correctly, because a two-element array is not a Costs object. A stub that answers every
    // read with the same shape will eventually answer one that cares.
    data = { pid: { decimal: "12.5" }, wkda: { decimal: "125.0" } };
  }
  else if (pactCode.includes("Slippage") || pactCode.includes("URC_")) data = ["1.0", "1.0"];
  return Promise.resolve({ result: { status: "success", data } } as any);
};

/**
 * One entry per source file fixed in this release. `run` must end in a
 * `submit()` of a built transaction (or, for the pure builders, capture the
 * command itself).
 */
const EXECUTORS: ReadonlyArray<[string, () => Promise<unknown>]> = [
  ["coilFunctions.coilTokensGeneric", () =>
    coilTokensGeneric(ouro, kadena, guard, "Ѻ.TARGET", "1.0", COIL_CONFIGS.ouroToAuryn)],
  ["ouroTransferFunctions.transferToken", () =>
    transferToken(ouro, "TOKEN-ID", "Ѻ.SENDER", "Ѻ.RECEIVER", "1.0", false, kadena, guard)],
  ["addLiquidityFunctions.executeAddLiquidity", () =>
    executeAddLiquidity({
      patronKeypair: ouro, kadenaKeypair: kadena, guardKeypair: guard,
      account: "Ѻ.ACCOUNT", swpair: "SWP-PAIR", inputAmounts: ["1.0", "1.0"],
    })],
  ["ouroMovieBoosterFunctions.movieBoosterBuy", () =>
    movieBoosterBuy(ouro, "Ѻ.BUYER", 3, true, kadena, guard)],
  ["dexSwapPairSmartSwapFunctions.executeSmartSwapWithSlippage", () =>
    executeSmartSwapWithSlippage({
      patronKeypair: ouro, kadenaKeypair: kadena, guardKeypair: guard,
      account: "Ѻ.ACCOUNT", inputId: "IN", inputAmount: "1.0", outputId: "OUT", slippage: 1,
    })],
  ["wrapFunctions.executeWrapStoa", () =>
    executeWrapStoa({
      patronAddress: "Ѻ.PATRON", wrapperAddress: "Ѻ.WRAPPER", amount: "1.000000000000",
      numAmount: 1, paymentKeyAddress: "k:kadenapub", gasStationKey,
      paymentSignerKey: kadena, patronGuardKeys: [guard], wrapperGuardKeys: [guard],
    })],
  ["ouroCoilFunctions.coilOuroToAuryn", () =>
    coilOuroToAuryn(ouro, kadena, guard, "Ѻ.TARGET", "1.0")],
  ["dexSwapPairExecuteFunctions.executeSingleSwapWithSlippage", () =>
    executeSingleSwapWithSlippage({
      patronKeypair: ouro, kadenaKeypair: kadena, guardKeypair: guard,
      account: "Ѻ.ACCOUNT", swpair: "SWP-PAIR", outputId: "OUT",
      inputId: "IN", inputAmount: "1.0", slippage: 1,
    })],
  ["urStoaFunctions.executeStakeUrStoa", () =>
    executeStakeUrStoa({ paymentKeyAddress: "k:kadenapub", amount: "1.0", numAmount: 1, gasStationKey })],
  ["activateFunctions.executeDeployStandardAccount", () =>
    executeDeployStandardAccount({
      account: "Ѻ.NEW", guardKeys: ["guardpub"], guardPred: "keys-all",
      kadenaAddress: "k:kadenapub", publicKey: "kadenapub",
      receivers: [], amounts: [], gasPayerKey: gasStationKey, guardSignerKeys: [guard],
    })],
  ["ouroSubCompressFunctions.sublimateOuroToIgnis", () =>
    sublimateOuroToIgnis(ouro, kadena, guard, "Ѻ.TARGET", "1.0")],
  ["ouroUrStoaFunctions.executeUnwrapUrStoa", () =>
    executeUnwrapUrStoa({
      patronAddress: "Ѻ.PATRON", unwrapperAddress: "Ѻ.UNWRAPPER", amount: "1.0",
      targetAddress: "k:kadenapub", targetExists: true, gasStationKey,
      patronGuardKeys: [guard], accountGuardKeys: [guard],
    })],
  ["pensionFunctions.brumateWkdaToPkda", () =>
    brumateWkdaToPkda(ouro, kadena, guard, "1.0", 30)],
  ["kpayFunctions.kpayBuy", () =>
    kpayBuy(ouro, "Ѻ.BUYER", 2, true, kadena, guard, keyset, 1.0)],
  ["ouroWrapFunctions.wrapKadena", () =>
    wrapKadena(ouro, "Ѻ.WRAPPER", kadena, guard, "1.0")],
  // Already fixed in 4.5.1 — re-asserted here because 4.6.0 swapped their
  // local Yin copy for the canonical stoa-core helper.
  ["guardFunctions.rotateGuard", () =>
    rotateGuard({
      patronAddress: "Ѻ.PATRON", accountAddress: "Ѻ.ACCOUNT", mode: "define",
      newKeys: ["newpub"], newPred: "keys-all", safe: true,
      gasStationKey, patronGuardKeys: [guard], accountGuardKeys: [guard], newGuardKeys: [guard],
    })],
  ["ouroRotateFunctions.rotateKadenaPaymentKey", () =>
    rotateKadenaPaymentKey("Ѻ.PATRON", "Ѻ.ACCOUNT", "k:newkey", gasStationKey, [guard], [guard],
      { keys: ["patronpub"], pred: "keys-all" }, { keys: ["guardpub"], pred: "keys-all" })],
];

beforeEach(() => {
  simulatedMeta = null;
  submittedMeta = null;
  setPactReader(reader);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(PINNED_NOW_S * 1000));
});

afterEach(() => {
  vi.useRealTimers();
  setPactReader(rawCalibratedDirtyRead);
  vi.clearAllMocks();
});

describe.each(EXECUTORS)("v4.6.0 live-floor pricing — %s", (_name, run) => {
  it("prices the submitted command at the live floor, not the 1.0e-8 default", async () => {
    await run();

    expect(submittedMeta, "executor never reached submit()").not.toBeNull();
    expect(submittedMeta.gasPrice).toBe(EXPECTED_GAS_PRICE);
    expect(submittedMeta.gasPrice).toBeGreaterThan(CLIENT_DEFAULT_GAS_PRICE);
  });

  it("derives that price from the creationTime it actually ships", async () => {
    await run();

    for (const meta of [simulatedMeta, submittedMeta].filter(Boolean)) {
      expect(meta.creationTime).toBe(EXPECTED_CREATION_TIME);
      expect(meta.gasPrice).toBe(expectedGasPrice(meta.creationTime));
    }
  });
});

// ── The four cross-chain builders are pure: no mocks needed, read the command ──
describe("v4.6.0 live-floor pricing — crossChainFunctions builders", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(PINNED_NOW_S * 1000));
  });
  afterEach(() => vi.useRealTimers());

  const cases: ReadonlyArray<[string, () => any]> = [
    ["buildCrossChainTransfer", () =>
      buildCrossChainTransfer({
        sender: "k:sender", receiver: "k:receiver",
        receiverGuard: { keys: ["receiverpub"], pred: "keys-all" },
        amount: "1.0", sourceChain: "0", targetChain: "2", senderPublicKey: "senderpub",
      })],
    ["buildCTransferAcross (chain 0, DALOS.GAS_PAYER)", () =>
      buildCTransferAcross({
        sender: "k:sender", receiver: "k:receiver",
        receiverGuard: { keys: ["receiverpub"], pred: "keys-all" },
        amount: "1.000000000000", sourceChain: "0", targetChain: "2",
        senderPublicKey: "senderpub", gasStationPublicKey: "gaspub",
      })],
    ["buildCTransferAcross (stoa-xchain-gas)", () =>
      buildCTransferAcross({
        sender: "k:sender", receiver: "k:receiver",
        receiverGuard: { keys: ["receiverpub"], pred: "keys-all" },
        amount: "1.000000000000", sourceChain: "1", targetChain: "2",
        senderPublicKey: "senderpub",
      })],
    ["buildContinuationTransaction", () =>
      buildContinuationTransaction("pact-id", "proof", "2")],
  ];

  it.each(cases)("%s prices at the live floor for its own creationTime", (_n, build) => {
    const meta = JSON.parse(build().cmd).meta;
    expect(meta.creationTime).toBe(EXPECTED_CREATION_TIME);
    expect(meta.gasPrice).toBe(EXPECTED_GAS_PRICE);
    expect(meta.gasPrice).toBe(expectedGasPrice(meta.creationTime));
  });
});
