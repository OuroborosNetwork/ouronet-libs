/**
 * Behavioral-regression lock for the 5 liquidity executors in
 * `addLiquidityFunctions.ts`. Captures pre-refactor goldens so the
 * Phase 3 parameterized executor consolidation (5 pipelines → 1 internal +
 * 5 thin wrappers) can be proven byte-equivalent on the public boundary.
 *
 * Five strategies, ~28 it-blocks total:
 *   A: Pact-code golden-string lock           — 5 it-blocks
 *   B: Error-prefix lock                      — 8 it-blocks (5 wrappers + 3 special variants)
 *   C: Catch-logger asymmetry lock            — 5 it-blocks (2 log, 3 do not)
 *   D: Compile-time signature lock            — 5 it-blocks (expectTypeOf)
 *   E: Module-existence baseline              — 5 it-blocks
 *
 * Strategy A captures `payload.exec.code` from the transaction's `cmd` JSON
 * via a stubbed `dirtyRead` — NOT by stubbing `Pact.builder.execution`,
 * which would break the fluent-builder chain.
 *
 * Stub invariants:
 *  - `getFailoverClient` is `vi.mock`-replaced at module-load (the real
 *    network must NEVER be hit).
 *  - `universalSignTransaction` is replaced to return the input transaction
 *    unchanged (no real nacl signing in unit tests).
 *  - `safeCreationTime` would otherwise yield wall-clock-dependent values;
 *    we don't assert on `creationTime`, only on `payload.exec.code`, so no
 *    spy is required.
 */

import { describe, it, expect, vi, beforeEach, afterEach, expectTypeOf } from "vitest";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";

// ─── Module-level capture buffer for Strategy A ──────────────────────────────
let capturedCode: string = "";
let dirtyReadResponse: any = {
  result: { status: "success", data: { gas: 50_000 } },
  gas: 50_000,
};
let submitResponse: any = { result: { status: "success" } };

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Replace getFailoverClient so dirtyRead can capture the Pact code without
// touching the network.
vi.mock("@stoachain/stoa-core/network", async () => {
  const actual = await vi.importActual<typeof import("@stoachain/stoa-core/network")>(
    "@stoachain/stoa-core/network",
  );
  return {
    ...actual,
    getFailoverClient: vi.fn(() => ({
      dirtyRead: vi.fn(async (tx: any) => {
        const cmd = JSON.parse(tx.cmd);
        capturedCode = cmd.payload.exec.code;
        return dirtyReadResponse;
      }),
      submit: vi.fn(async () => submitResponse),
      poll: vi.fn(async () => submitResponse),
    })),
  };
});

// Bypass real signing (avoids nacl crypto calls in unit tests).
vi.mock("@stoachain/stoa-core/signing", async () => {
  const actual = await vi.importActual<typeof import("@stoachain/stoa-core/signing")>(
    "@stoachain/stoa-core/signing",
  );
  return {
    ...actual,
    universalSignTransaction: vi.fn(async (tx: any) => tx),
  };
});

// Imports that depend on the mocked modules MUST come after `vi.mock` calls.
// Vitest hoists `vi.mock` to the top so the import order in source code is fine,
// but we keep the import block below to make the dependency direction explicit.
import {
  executeAddLiquiditySingle,
  executeAddLiquidity,
  executeSpecialAddLiquidity,
  executeFuel,
  executeRemoveLiquidity,
  type AddLiquidityParams,
  type SpecialLPParams,
} from "../src/interactions/addLiquidityFunctions";

// ─── Deterministic fixtures ──────────────────────────────────────────────────
const fixedPatron = {
  address: "k:abc",
  publicKey: "patronpub",
  privateKey: "patronpriv",
};
const fixedKadena = { publicKey: "kadenapub", privateKey: "kadenapriv" };
const fixedGuard = { publicKey: "guardpub", privateKey: "guardpriv" };

const baseAddLiquidityParams: AddLiquidityParams = {
  patronKeypair: fixedPatron,
  kadenaKeypair: fixedKadena,
  guardKeypair: fixedGuard,
  account: "Ouro.Test",
  swpair: "KDA:OURO",
  inputAmounts: ["1.5", "2.5"],
};

const removeParams = {
  patronKeypair: { address: "k:abc", publicKey: "patronpub" },
  kadenaKeypair: { publicKey: "kadenapub", secretKey: "kadenapriv" },
  guardKeypair: { publicKey: "guardpub", secretKey: "guardpriv" },
  account: "Ouro.Test",
  swpair: "KDA:OURO",
  lpAmount: "3.0",
};

// ─── Spy logger for Strategy C ───────────────────────────────────────────────
let originalLogger: Logger;
let spyLogger: Logger;

beforeEach(() => {
  capturedCode = "";
  dirtyReadResponse = {
    result: { status: "success", data: { gas: 50_000 } },
    gas: 50_000,
  };
  submitResponse = { result: { status: "success" } };

  originalLogger = getLogger();
  spyLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  setLogger(spyLogger);
});

afterEach(() => {
  setLogger(originalLogger);
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// Strategy A — Pact-code golden-string lock
// ═════════════════════════════════════════════════════════════════════════════
describe("Strategy A — Pact-code golden-string lock", () => {
  it("executeAddLiquiditySingle emits the locked TS01-C3 AddLiquidity code", async () => {
    await executeAddLiquiditySingle(baseAddLiquidityParams);
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_AddLiquidity "k:abc" "Ouro.Test" "KDA:OURO" [1.5 2.5])`,
    );
  });

  it("executeAddLiquidity emits the same code as executeAddLiquiditySingle (delegation contract)", async () => {
    await executeAddLiquidity(baseAddLiquidityParams);
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_AddLiquidity "k:abc" "Ouro.Test" "KDA:OURO" [1.5 2.5])`,
    );
  });

  it("executeSpecialAddLiquidity (iced) emits the locked TS01-CP AddIcedLiquidity code", async () => {
    const special: SpecialLPParams = { type: "iced" };
    await executeSpecialAddLiquidity(baseAddLiquidityParams, special);
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-CP.SWP|C_AddIcedLiquidity "k:abc" "Ouro.Test" "KDA:OURO" [1.5 2.5])`,
    );
  });

  it("executeFuel emits the locked TS01-C3 Fuel code", async () => {
    await executeFuel(baseAddLiquidityParams);
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_Fuel "k:abc" "Ouro.Test" "KDA:OURO" [1.5 2.5])`,
    );
  });

  it("executeRemoveLiquidity emits the locked TS01-C3 RemoveLiquidity code", async () => {
    await executeRemoveLiquidity(removeParams);
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_RemoveLiquidity "k:abc" "Ouro.Test" "KDA:OURO" 3.0)`,
    );
  });
});

// Auxiliary describe-block so all 4 special-type Pact codes are individually
// pinned (single, glacial, frozen, sleeping). Counts toward Strategy A.
describe("Strategy A — special-type Pact-code variants", () => {
  it("special:glacial emits the locked AddGlacialLiquidity code", async () => {
    await executeSpecialAddLiquidity(baseAddLiquidityParams, { type: "glacial" });
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-CP.SWP|C_AddGlacialLiquidity "k:abc" "Ouro.Test" "KDA:OURO" [1.5 2.5])`,
    );
  });

  it("special:frozen emits the locked AddFrozenLiquidity code with first input amount", async () => {
    await executeSpecialAddLiquidity(baseAddLiquidityParams, {
      type: "frozen",
      frozenDptf: "DPTF-id",
    });
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-CP.SWP|C_AddFrozenLiquidity "k:abc" "Ouro.Test" "KDA:OURO" "DPTF-id" 1.5)`,
    );
  });

  it("special:sleeping emits the locked AddSleepingLiquidity code with nonce", async () => {
    await executeSpecialAddLiquidity(baseAddLiquidityParams, {
      type: "sleeping",
      sleepingDpmf: "DPMF-id",
      nonce: 42,
    });
    expect(capturedCode).toBe(
      `(ouronet-ns.TS01-CP.SWP|C_AddSleepingLiquidity "k:abc" "Ouro.Test" "KDA:OURO" "DPMF-id" 42)`,
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Strategy B — Error-prefix lock
// ═════════════════════════════════════════════════════════════════════════════
describe("Strategy B — simulation-failure error-prefix lock", () => {
  beforeEach(() => {
    dirtyReadResponse = {
      result: { status: "failure", error: { message: "boom" } },
    };
  });

  it("executeAddLiquiditySingle throws with the locked Add-liquidity simulation prefix", async () => {
    await expect(executeAddLiquiditySingle(baseAddLiquidityParams)).rejects.toThrow(
      "Add liquidity simulation failed: boom",
    );
  });

  it("executeAddLiquidity propagates the locked Add-liquidity simulation prefix", async () => {
    await expect(executeAddLiquidity(baseAddLiquidityParams)).rejects.toThrow(
      "Add liquidity simulation failed: boom",
    );
  });

  it("executeSpecialAddLiquidity (iced) throws with the iced simulation prefix", async () => {
    await expect(
      executeSpecialAddLiquidity(baseAddLiquidityParams, { type: "iced" }),
    ).rejects.toThrow("Add iced liquidity simulation failed: boom");
  });

  it("executeSpecialAddLiquidity (glacial) throws with the glacial simulation prefix", async () => {
    await expect(
      executeSpecialAddLiquidity(baseAddLiquidityParams, { type: "glacial" }),
    ).rejects.toThrow("Add glacial liquidity simulation failed: boom");
  });

  it("executeSpecialAddLiquidity (frozen) throws with the frozen simulation prefix", async () => {
    await expect(
      executeSpecialAddLiquidity(baseAddLiquidityParams, {
        type: "frozen",
        frozenDptf: "DPTF-id",
      }),
    ).rejects.toThrow("Add frozen liquidity simulation failed: boom");
  });

  it("executeSpecialAddLiquidity (sleeping) throws with the sleeping simulation prefix", async () => {
    await expect(
      executeSpecialAddLiquidity(baseAddLiquidityParams, {
        type: "sleeping",
        sleepingDpmf: "DPMF-id",
        nonce: 42,
      }),
    ).rejects.toThrow("Add sleeping liquidity simulation failed: boom");
  });

  it("executeFuel throws with the locked Fuel simulation prefix", async () => {
    await expect(executeFuel(baseAddLiquidityParams)).rejects.toThrow(
      "Fuel simulation failed: boom",
    );
  });

  it("executeRemoveLiquidity throws with the locked Remove-liquidity simulation prefix", async () => {
    await expect(executeRemoveLiquidity(removeParams)).rejects.toThrow(
      "Remove liquidity simulation failed: boom",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Strategy C — Catch-logger asymmetry lock (2 log, 3 do not)
// ═════════════════════════════════════════════════════════════════════════════
describe("Strategy C — outer-catch logger asymmetry", () => {
  beforeEach(() => {
    dirtyReadResponse = {
      result: { status: "failure", error: { message: "boom" } },
    };
  });

  it("executeAddLiquidity DOES log via getLogger().error with 'Add Liquidity Error:' prefix", async () => {
    await expect(executeAddLiquidity(baseAddLiquidityParams)).rejects.toThrow();
    expect(spyLogger.error).toHaveBeenCalledWith("Add Liquidity Error:", expect.any(Error));
  });

  it("executeSpecialAddLiquidity DOES log via getLogger().error with type-prefixed message", async () => {
    await expect(
      executeSpecialAddLiquidity(baseAddLiquidityParams, { type: "iced" }),
    ).rejects.toThrow();
    expect(spyLogger.error).toHaveBeenCalledWith("Add iced Liquidity Error:", expect.any(Error));
  });

  it("executeAddLiquiditySingle does NOT call getLogger().error in its outer catch", async () => {
    await expect(executeAddLiquiditySingle(baseAddLiquidityParams)).rejects.toThrow();
    expect(spyLogger.error).not.toHaveBeenCalled();
  });

  it("executeFuel does NOT call getLogger().error in its outer catch", async () => {
    await expect(executeFuel(baseAddLiquidityParams)).rejects.toThrow();
    expect(spyLogger.error).not.toHaveBeenCalled();
  });

  it("executeRemoveLiquidity does NOT call getLogger().error in its outer catch", async () => {
    await expect(executeRemoveLiquidity(removeParams)).rejects.toThrow();
    expect(spyLogger.error).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Strategy D — Compile-time signature lock (expectTypeOf)
// ═════════════════════════════════════════════════════════════════════════════
describe("Strategy D — public signatures are non-widening", () => {
  it("executeAddLiquiditySingle accepts AddLiquidityParams and returns Promise<any>", () => {
    expectTypeOf(executeAddLiquiditySingle)
      .parameter(0)
      .toEqualTypeOf<AddLiquidityParams>();
    expectTypeOf(executeAddLiquiditySingle).returns.resolves.toBeAny();
  });

  it("executeAddLiquidity accepts AddLiquidityParams and returns Promise<any>", () => {
    expectTypeOf(executeAddLiquidity).parameter(0).toEqualTypeOf<AddLiquidityParams>();
    expectTypeOf(executeAddLiquidity).returns.resolves.toBeAny();
  });

  it("executeSpecialAddLiquidity accepts (AddLiquidityParams, SpecialLPParams)", () => {
    expectTypeOf(executeSpecialAddLiquidity).parameter(0).toEqualTypeOf<AddLiquidityParams>();
    expectTypeOf(executeSpecialAddLiquidity).parameter(1).toEqualTypeOf<SpecialLPParams>();
  });

  it("executeFuel accepts AddLiquidityParams and returns Promise<any>", () => {
    expectTypeOf(executeFuel).parameter(0).toEqualTypeOf<AddLiquidityParams>();
    expectTypeOf(executeFuel).returns.resolves.toBeAny();
  });

  // Locked Convention #6: executeRemoveLiquidity's anonymous inline param shape
  // stays inline. Promoting it to AddLiquidityParams or any named exported
  // interface would widen the public surface and is FORBIDDEN. This assertion
  // pins the inline 6-key shape (with `lpAmount`, NOT `inputAmounts`).
  it("executeRemoveLiquidity accepts an inline anonymous shape with lpAmount (NOT AddLiquidityParams)", () => {
    type RemoveParam = Parameters<typeof executeRemoveLiquidity>[0];
    expectTypeOf<RemoveParam>().toEqualTypeOf<{
      patronKeypair: { address: string; publicKey: string };
      kadenaKeypair: { publicKey: string; secretKey: string };
      guardKeypair: { publicKey: string; secretKey: string };
      account: string;
      swpair: string;
      lpAmount: string;
    }>();
    // The inline shape must NOT structurally match AddLiquidityParams (which
    // carries `inputAmounts` and uses `IKadenaKeypair` with `privateKey`).
    expectTypeOf<RemoveParam>().not.toEqualTypeOf<AddLiquidityParams>();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Strategy E — Module-existence baseline
// ═════════════════════════════════════════════════════════════════════════════
describe("Strategy E — module exports the 5 executors as functions", () => {
  it("addLiquidityFunctions module is dynamically importable", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/addLiquidityFunctions");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("executeAddLiquiditySingle is exported as a function", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/addLiquidityFunctions");
    expect(typeof mod.executeAddLiquiditySingle).toBe("function");
  });

  it("executeAddLiquidity is exported as a function", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/addLiquidityFunctions");
    expect(typeof mod.executeAddLiquidity).toBe("function");
  });

  it("executeSpecialAddLiquidity is exported as a function", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/addLiquidityFunctions");
    expect(typeof mod.executeSpecialAddLiquidity).toBe("function");
  });

  it("executeFuel is exported as a function", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/addLiquidityFunctions");
    expect(typeof mod.executeFuel).toBe("function");
  });

  it("executeRemoveLiquidity is exported as a function", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/addLiquidityFunctions");
    expect(typeof mod.executeRemoveLiquidity).toBe("function");
  });

  it("dexFunctions shim forwards executeAddLiquiditySingle (Phase-1 backwards-compat)", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/dexFunctions");
    expect(typeof mod.executeAddLiquiditySingle).toBe("function");
    expect(typeof mod.executeAddLiquidity).toBe("function");
    expect(typeof mod.executeSpecialAddLiquidity).toBe("function");
    expect(typeof mod.executeFuel).toBe("function");
    expect(typeof mod.executeRemoveLiquidity).toBe("function");
  });
});
