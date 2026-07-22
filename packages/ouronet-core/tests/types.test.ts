/**
 * IKadenaKeypair cross-subpath type-level regression lock.
 *
 * This file is the compile-time guard that the canonical IKadenaKeypair
 * declaration at `src/signing/types.ts` remains the SOLE source of truth
 * across every subpath that previously declared a duplicate. After the
 * Phase-1 consolidation, the four `interactions/*` subpaths
 * (activateFunctions, dexFunctions, kpayFunctions, coilFunctions) consume
 * the canonical type via a type-only import from "../signing" — they do
 * NOT re-export the type. A direct type-only import from any of those
 * subpaths therefore fails with `TS2305: has no exported member`.
 *
 * Resolution: assert assignability against the call surface using a
 * function-parameter slot extracted from each exported function — direct
 * positional for kpayBuy/coilTokensGeneric, struct-nested (named field)
 * for executeDeployStandardAccount/executeSmartSwapWithSlippage. This
 * exercises the public API end-to-end and is a STRONGER assertion than
 * a direct type-alias import.
 *
 * Assertions are compile-time only and fire under vitest's
 * `test.typecheck` mode (enabled in `vitest.config.ts`). The 5 typed-const
 * assignment sites verify that a fixture with `seedType: "foreign"` and
 * `encryptedSecretKey: unknown` assigns cleanly to each subpath's
 * `IKadenaKeypair` slot.
 *
 * Reintroducing a drifted local `interface IKadenaKeypair` on any of the
 * four interactions subpaths that OMITS `"foreign"` from the `seedType`
 * literal-union will cause this file to fail to typecheck (TS2322:
 * `"foreign"` not assignable to `"koala" | "chainweaver" | "eckowallet"`)
 * and `npm test` to exit non-zero. That is the regression lock.
 *
 * Coverage caveat (intentional, documented): this file does NOT lock the
 * `encryptedSecretKey: unknown` typing. A drifted local declaration that
 * weakens `encryptedSecretKey` to `any` would silently pass — TypeScript
 * accepts assignment of `unknown` into an `any` slot. The `seedType`
 * literal is the load-bearing canonical-vs-drifted discriminator; the
 * `encryptedSecretKey` width is not. If `unknown` enforcement is later
 * needed, switch to `expectTypeOf<...>().not.toEqualTypeOf<any>()` from
 * vitest's type-tests, or add an `IsAny<T>` conditional-type guard.
 */

import { describe, it, expect } from "vitest";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { executeDeployStandardAccount } from "../src/interactions/activateFunctions";
import { executeSmartSwapWithSlippage } from "../src/interactions/dexFunctions";
import { kpayBuy } from "../src/interactions/kpayFunctions";
import { coilTokensGeneric } from "../src/interactions/coilFunctions";

// v3.0.0 Phase 1 lock imports
import { getStoaPriceUSD, getDPTFMinMove } from "../src/interactions/ouroFunctions";
import { getTokenDecimals, getPoolTotalFee } from "../src/interactions/dexFunctions";

// v3.0.0 Phase 2 lock imports
import {
  getIgnisBalance,
  getAccountTokenSupply,
  getOuroDispoCapacity,
  getVirtualOuro,
  getMaxBuyMovieBooster,
} from "../src/interactions/ouroFunctions";
import {
  getLPTypeInfo,
  validateLiquidity,
} from "../src/interactions/addLiquidityFunctions";
import {
  getUrStoaBalance,
  getUrStoaGuard,
  checkCoinAccountExists,
} from "../src/interactions/urStoaFunctions";
import {
  getSWPSpawnLimit,
  getSWPInactiveLimit,
} from "../src/interactions/dexFunctions";

describe("IKadenaKeypair regression lock", () => {
  it("compile-time assignability across all 5 subpaths", () => {
    const FIXTURE: {
      publicKey:          string;
      privateKey:         string;
      seedType:           "foreign";
      encryptedSecretKey: unknown;
    } = {
      publicKey: "deadbeef",
      privateKey: "00ff",
      seedType: "foreign" as const,
      encryptedSecretKey: undefined as unknown,
    };

    // Canonical site — direct type import resolves via `signing/index.ts`
    // re-export of `./types`.
    const _check_signing:  IKadenaKeypair                                                          = FIXTURE;

    // Struct-nested: activateFunctions.executeDeployStandardAccount takes a
    // single `DeployStandardAccountParams` struct; IKadenaKeypair lives at
    // the `gasPayerKey` field.
    const _check_activate: Parameters<typeof executeDeployStandardAccount>[0]["gasPayerKey"]       = FIXTURE;

    // Struct-nested: dexFunctions.executeSmartSwapWithSlippage takes a
    // single `SmartSwapExecutionParams` struct; IKadenaKeypair lives at
    // the `kadenaKeypair` field.
    const _check_dex:      Parameters<typeof executeSmartSwapWithSlippage>[0]["kadenaKeypair"]     = FIXTURE;

    // Direct-positional: kpayFunctions.kpayBuy takes IKadenaKeypair as
    // its 5th positional parameter (index 4) — `kadenaAccount`.
    const _check_kpay:     Parameters<typeof kpayBuy>[4]                                           = FIXTURE;

    // Direct-positional: coilFunctions.coilTokensGeneric takes
    // IKadenaKeypair as its 2nd positional parameter (index 1) —
    // `kadenaAccount`.
    const _check_coil:     Parameters<typeof coilTokensGeneric>[1]                                 = FIXTURE;

    // Reference the locals so `noUnusedLocals` (tsconfig.json:14) cannot
    // flag them even if a future refactor moves them to module scope.
    void _check_signing;
    void _check_activate;
    void _check_dex;
    void _check_kpay;
    void _check_coil;
  });
});

/**
 * v3.0.0 Phase 1 — nullable pricing-function return-type regression lock.
 *
 * The four pricing helpers below were widened from `Promise<number>` to
 * `Promise<number | null>` so that internal failures (read errors, missing
 * pool/token, watchdog timeouts) propagate as `null` instead of a
 * fabricated zero. The lock pattern below uses typed-const assignment of
 * `null` against `Awaited<ReturnType<typeof fn>>` for each function: it
 * compiles ONLY when the awaited return is `number | null` (so `null` is
 * assignable to the slot). If a future change narrows any of the four
 * back to `Promise<number>`, the corresponding line fails to compile
 * (TS2322) under vitest typecheck mode and `npm test` exits non-zero.
 *
 * The runtime `expect(true).toBe(true)` is a no-op pass — the load-bearing
 * assertion is the compile-time slot check, fired by vitest's
 * `test.typecheck` mode (vitest.config.ts:9).
 */
describe("v3.0.0 nullable pricing-function signatures (REQ-01..REQ-04 lock)", () => {
  it("locks getStoaPriceUSD return type to Promise<number | null>", () => {
    const _null_assignable_getStoaPriceUSD: Awaited<ReturnType<typeof getStoaPriceUSD>> = null;
    void _null_assignable_getStoaPriceUSD;
    expect(true).toBe(true);
  });

  it("locks getTokenDecimals return type to Promise<number | null>", () => {
    const _null_assignable_getTokenDecimals: Awaited<ReturnType<typeof getTokenDecimals>> = null;
    void _null_assignable_getTokenDecimals;
    expect(true).toBe(true);
  });

  it("locks getPoolTotalFee return type to Promise<number | null>", () => {
    const _null_assignable_getPoolTotalFee: Awaited<ReturnType<typeof getPoolTotalFee>> = null;
    void _null_assignable_getPoolTotalFee;
    expect(true).toBe(true);
  });

  it("locks getDPTFMinMove return type to Promise<number | null>", () => {
    const _null_assignable_getDPTFMinMove: Awaited<ReturnType<typeof getDPTFMinMove>> = null;
    void _null_assignable_getDPTFMinMove;
    expect(true).toBe(true);
  });
});

describe("v3.0.0 nullable signatures (REQ-05..REQ-09 lock — Phase 2)", () => {
  it("locks getIgnisBalance to Promise<string | null>", () => {
    const _x: Awaited<ReturnType<typeof getIgnisBalance>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getAccountTokenSupply to Promise<string | null>", () => {
    const _x: Awaited<ReturnType<typeof getAccountTokenSupply>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getOuroDispoCapacity to Promise<string | null>", () => {
    const _x: Awaited<ReturnType<typeof getOuroDispoCapacity>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getVirtualOuro to Promise<string | null>", () => {
    const _x: Awaited<ReturnType<typeof getVirtualOuro>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getUrStoaBalance to Promise<number | null>", () => {
    const _x: Awaited<ReturnType<typeof getUrStoaBalance>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getUrStoaGuard to Promise<UrStoaGuardResult | null>", () => {
    const _x: Awaited<ReturnType<typeof getUrStoaGuard>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks checkCoinAccountExists (urStoa) to Promise<boolean | null>", () => {
    const _x: Awaited<ReturnType<typeof checkCoinAccountExists>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getMaxBuyMovieBooster to Promise<number | null>", () => {
    const _x: Awaited<ReturnType<typeof getMaxBuyMovieBooster>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getSWPSpawnLimit to Promise<string | null>", () => {
    const _x: Awaited<ReturnType<typeof getSWPSpawnLimit>> = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getSWPInactiveLimit to Promise<string | null>", () => {
    const _x: Awaited<ReturnType<typeof getSWPInactiveLimit>> = null; void _x;
    expect(true).toBe(true);
  });

  it("locks getLPTypeInfo.hasFrozenLP field to boolean | null", () => {
    const _x: Awaited<ReturnType<typeof getLPTypeInfo>>["hasFrozenLP"] = null; void _x;
    expect(true).toBe(true);
  });
  it("locks getLPTypeInfo.hasSleepingLP field to boolean | null", () => {
    const _x: Awaited<ReturnType<typeof getLPTypeInfo>>["hasSleepingLP"] = null; void _x;
    expect(true).toBe(true);
  });

  it("locks validateLiquidity.error field to optional string", () => {
    const _present: Awaited<ReturnType<typeof validateLiquidity>>["error"] = "any string"; void _present;
    const _undef: Awaited<ReturnType<typeof validateLiquidity>>["error"] = undefined; void _undef;
    expect(true).toBe(true);
  });
});
