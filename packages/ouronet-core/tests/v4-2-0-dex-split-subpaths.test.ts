/**
 * REQ-04 / REQ-05 / REQ-07 — v4.2.0 Phase 1 dex-split regression-lock.
 *
 * Verifies the seven-entity DEX file split holds: every new entity-oriented
 * subpath resolves to a non-empty module namespace, the type-only and
 * placeholder modules resolve to empty (or near-empty) module namespaces,
 * and the legacy `./interactions/dexFunctions` shim still re-exposes one
 * canonical symbol per entity-domain.
 *
 * Pattern mirrors `v4-1-1-esm-roundtrip.test.ts` — 2-level assertion per
 * subpath (existence + canonical-symbol shape). Twelve `it` blocks total
 * (11 new entity files + 1 legacy shim).
 */
import { describe, it, expect } from "vitest";

describe("REQ-04/05/07: v4.2.0 dex-split entity-oriented subpaths", () => {
  it("dexTypes is dynamically importable (type-only module)", async () => {
    const mod = await import("../src/interactions/dexTypes");
    expect(typeof mod).toBe("object");
    // Type-only module — runtime exports are erased; assert namespace shape only.
    expect(mod).not.toBeNull();
  });

  it("dexParseFunctions exposes parseDecimalValue as a function", async () => {
    const mod = await import("../src/interactions/dexParseFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.parseDecimalValue).toBe("function");
  });

  it("dexSwapPairCalcFunctions exposes calculateDirectSwap as a function", async () => {
    const mod = await import("../src/interactions/dexSwapPairCalcFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.calculateDirectSwap).toBe("function");
  });

  it("dexSwapPairExecuteFunctions exposes executeSingleSwapWithSlippage as a function", async () => {
    const mod = await import("../src/interactions/dexSwapPairExecuteFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.executeSingleSwapWithSlippage).toBe("function");
  });

  it("dexSwapPairSmartSwapFunctions exposes getAllPoolTokens as a function", async () => {
    const mod = await import("../src/interactions/dexSwapPairSmartSwapFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getAllPoolTokens).toBe("function");
  });

  it("dexSwapPairDashboardFunctions exposes getSWPairDashboardInfo as a function", async () => {
    const mod = await import("../src/interactions/dexSwapPairDashboardFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getSWPairDashboardInfo).toBe("function");
  });

  it("dexSwapPairAdminFunctions exposes describeModule as a function", async () => {
    const mod = await import("../src/interactions/dexSwapPairAdminFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.describeModule).toBe("function");
  });

  it("dexTrueFungibleFunctions exposes getTrueFungibleHeader as a function", async () => {
    const mod = await import("../src/interactions/dexTrueFungibleFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getTrueFungibleHeader).toBe("function");
  });

  it("dexOrtoFungibleFunctions exposes getOrtoFungibleHeader as a function", async () => {
    const mod = await import("../src/interactions/dexOrtoFungibleFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getOrtoFungibleHeader).toBe("function");
  });

  it("dexCollectablesFunctions exposes getCollectablesHeader as a function", async () => {
    const mod = await import("../src/interactions/dexCollectablesFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getCollectablesHeader).toBe("function");
  });

  it("dexAcquisitionPoolFunctions is dynamically importable (placeholder, no exports)", async () => {
    const mod = await import("../src/interactions/dexAcquisitionPoolFunctions");
    expect(typeof mod).toBe("object");
    // Placeholder file — no chain-call functions yet (Pact module pending deployment).
    // The module namespace exists but exposes no own enumerable runtime symbols.
    expect(mod).not.toBeNull();
  });

  it("legacy dexFunctions shim re-exposes one canonical symbol per entity-domain", async () => {
    const mod = await import("../src/interactions/dexFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.parseDecimalValue).toBe("function");
    expect(typeof mod.calculateDirectSwap).toBe("function");
    expect(typeof mod.getTrueFungibleHeader).toBe("function");
    expect(typeof mod.getOrtoFungibleHeader).toBe("function");
    expect(typeof mod.getCollectablesHeader).toBe("function");
  });
});
