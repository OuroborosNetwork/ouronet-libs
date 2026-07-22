/**
 * REQ-21 / REQ-22 / REQ-23: aggressive readonly sweep regression-lock for ouronet-core.
 * Locks ~15 representative public-type fields against accidental mutation via
 * `// @ts-expect-error TS2540` assertions and `expectTypeOf.toMatchTypeOf<{readonly ...}>()`
 * shape checks.
 *
 * Pattern matches `tests/v4-1-1-type-preservation.test.ts` precedent (stoa-core).
 * Strategy A: shape assertions via `toMatchTypeOf<{readonly ...}>()`.
 * Strategy B: mutation-rejection via `// @ts-expect-error TS2540`.
 */
import { describe, it, expectTypeOf } from "vitest";
import type { PlaintextCodex, CodexExportV1_2 } from "@ouronet/ouronet-core/codex";
import type {
  AddLiquidityParams,
  SpecialLPParams,
  DeviationResult,
  LPTypeInfo,
} from "@ouronet/ouronet-core/interactions/addLiquidityFunctions";
import type {
  UnwrapStoaParams,
  UnwrapUrStoaParams,
} from "@ouronet/ouronet-core/interactions/ouroTypes";

describe("REQ-21/22: ouronet-core readonly invariant regression-lock", () => {
  // ── Strategy A: shape locks ──────────────────────────────────────────────

  it("PlaintextCodex.kadenaWallets is readonly", () => {
    expectTypeOf<PlaintextCodex>().toMatchTypeOf<{ readonly kadenaWallets: readonly unknown[] }>();
  });

  it("PlaintextCodex.uiSettings is readonly", () => {
    expectTypeOf<PlaintextCodex>().toMatchTypeOf<{ readonly uiSettings: unknown }>();
  });

  it("PlaintextCodex.schemaVersion is readonly", () => {
    expectTypeOf<PlaintextCodex>().toMatchTypeOf<{ readonly schemaVersion: number }>();
  });

  it("PlaintextCodex.lastUpdatedDevice is readonly", () => {
    expectTypeOf<PlaintextCodex>().toMatchTypeOf<{ readonly lastUpdatedDevice: "dev" | "main" }>();
  });

  it("CodexExportV1_2.version is readonly literal '1.2'", () => {
    expectTypeOf<CodexExportV1_2>().toMatchTypeOf<{ readonly version: "1.2" }>();
  });

  it("CodexExportV1_2.exportedAt is readonly", () => {
    expectTypeOf<CodexExportV1_2>().toMatchTypeOf<{ readonly exportedAt: string }>();
  });

  it("CodexExportV1_2.kadenaWallets is readonly", () => {
    expectTypeOf<CodexExportV1_2>().toMatchTypeOf<{ readonly kadenaWallets: readonly unknown[] }>();
  });

  it("AddLiquidityParams.account is readonly", () => {
    expectTypeOf<AddLiquidityParams>().toMatchTypeOf<{ readonly account: string }>();
  });

  it("AddLiquidityParams.swpair is readonly", () => {
    expectTypeOf<AddLiquidityParams>().toMatchTypeOf<{ readonly swpair: string }>();
  });

  it("SpecialLPParams.type is readonly", () => {
    expectTypeOf<SpecialLPParams>().toMatchTypeOf<{
      readonly type: "iced" | "glacial" | "frozen" | "sleeping";
    }>();
  });

  it("DeviationResult.isValid is readonly", () => {
    expectTypeOf<DeviationResult>().toMatchTypeOf<{ readonly isValid: boolean }>();
  });

  it("LPTypeInfo.hasFrozenLP is readonly", () => {
    expectTypeOf<LPTypeInfo>().toMatchTypeOf<{ readonly hasFrozenLP: boolean | null }>();
  });

  it("UnwrapStoaParams.targetAddress is readonly (post-Phase-2 ouroTypes.ts)", () => {
    expectTypeOf<UnwrapStoaParams>().toMatchTypeOf<{ readonly targetAddress: string }>();
  });

  it("UnwrapStoaParams.amount is readonly", () => {
    expectTypeOf<UnwrapStoaParams>().toMatchTypeOf<{ readonly amount: string }>();
  });

  it("UnwrapUrStoaParams.targetAddress is readonly", () => {
    expectTypeOf<UnwrapUrStoaParams>().toMatchTypeOf<{ readonly targetAddress: string }>();
  });

  // ── Strategy B: mutation-rejection compile-time locks ────────────────────

  it("rejects mutation of PlaintextCodex.uiSettings at compile time", () => {
    const codex: PlaintextCodex<unknown, unknown, unknown, unknown, { theme: string }> = {
      kadenaWallets: [],
      ouronetWallets: [],
      addressBook: [],
      pureKeypairs: [],
      uiSettings: { theme: "light" },
      schemaVersion: 1,
      lastUpdatedAt: null,
      lastUpdatedDevice: "main",
    };
    // @ts-expect-error TS2540: Cannot assign to 'uiSettings' because it is a read-only property.
    codex.uiSettings = { theme: "dark" };
    void codex;
  });

  it("rejects mutation of CodexExportV1_2.version at compile time", () => {
    const exp: CodexExportV1_2 = {
      version: "1.2",
      exportedAt: "2026-05-09T00:00:00Z",
      kadenaWallets: [],
      ouronetWallets: [],
      addressBook: [],
      uiSettings: undefined,
    };
    // @ts-expect-error TS2540: Cannot assign to 'version' because it is a read-only property.
    exp.version = "1.2";
    void exp;
  });

  it("rejects mutation of UnwrapStoaParams.targetAddress at compile time", () => {
    const params: UnwrapStoaParams = {
      patronAddress: "k:a",
      unwrapperAddress: "k:b",
      amount: "1.0",
      numAmount: 1,
      targetAddress: "k:c",
      targetExists: true,
      gasStationKey: { publicKey: "p", privateKey: "s" },
      patronGuardKeys: [],
      accountGuardKeys: [],
    };
    // @ts-expect-error TS2540: Cannot assign to 'targetAddress' because it is a read-only property.
    params.targetAddress = "k:other";
    void params;
  });
});
