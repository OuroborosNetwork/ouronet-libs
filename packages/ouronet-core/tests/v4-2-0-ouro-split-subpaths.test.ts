/**
 * REQ-08 / REQ-10 / REQ-11 / REQ-12 — v4.2.0 Phase 2 ouro-split regression-lock.
 *
 * Verifies the twelve-entity ouro file split holds: every new entity-oriented
 * subpath resolves to a non-empty module namespace and exposes one canonical
 * runtime symbol. The legacy `./interactions/ouroFunctions` shim still
 * re-exposes one canonical symbol per entity-domain via `export *` chains,
 * locking REQ-12 ("all 60 own + 13 tail-block re-exports reachable via OLD path").
 *
 * Pattern mirrors `v4-1-1-esm-roundtrip.test.ts:18-27` and the Phase 1
 * `v4-2-0-dex-split-subpaths.test.ts` precedent — 2-level assertion per subpath
 * (existence + canonical-symbol shape). Per Locked Convention #8, paths are
 * relative-source (`../src/interactions/ouroX`) so this file fail-then-greens
 * within the implementer TDD cycle without a build step.
 */
import { describe, it, expect } from "vitest";

describe("REQ-08/10/11/12: v4.2.0 ouro-split entity-oriented subpaths", () => {
  it("ouroTypes is dynamically importable (type-only module)", async () => {
    const mod = await import("../src/interactions/ouroTypes");
    expect(typeof mod).toBe("object");
    expect(mod).not.toBeNull();
  });

  it("ouroAccountFunctions exposes getAccountSelectorData as a function", async () => {
    const mod = await import("../src/interactions/ouroAccountFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getAccountSelectorData).toBe("function");
  });

  it("ouroPrimordialsFunctions exposes getPrimordials and buildPlaceholderPrimordials", async () => {
    const mod = await import("../src/interactions/ouroPrimordialsFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getPrimordials).toBe("function");
    expect(typeof mod.buildPlaceholderPrimordials).toBe("function");
  });

  it("ouroSubCompressFunctions exposes sublimateOuroToIgnis and getSublimatPreview", async () => {
    const mod = await import("../src/interactions/ouroSubCompressFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.sublimateOuroToIgnis).toBe("function");
    expect(typeof mod.getSublimatPreview).toBe("function");
  });

  it("ouroWrapFunctions exposes wrapKadena and executeUnwrapStoa", async () => {
    const mod = await import("../src/interactions/ouroWrapFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.wrapKadena).toBe("function");
    expect(typeof mod.executeUnwrapStoa).toBe("function");
  });

  it("ouroTransferFunctions exposes transferToken as a function", async () => {
    const mod = await import("../src/interactions/ouroTransferFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.transferToken).toBe("function");
  });

  it("ouroMovieBoosterFunctions exposes getSparksBalance and firestarter", async () => {
    const mod = await import("../src/interactions/ouroMovieBoosterFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getSparksBalance).toBe("function");
    expect(typeof mod.firestarter).toBe("function");
  });

  it("ouroCoilFunctions exposes coilOuroToAuryn and forwards 3 tail-block symbols", async () => {
    const mod = await import("../src/interactions/ouroCoilFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.coilOuroToAuryn).toBe("function");
    // Tail-block forwarded symbols (REQ-12 lock — one per source file forwarded from)
    expect(typeof mod.getAurynCoilPreview).toBe("function");      // from ./coilFunctions
    expect(typeof mod.brumateWkdaToPkda).toBe("function");        // from ./pensionFunctions
    expect(typeof mod.getCoilPreviewInfo).toBe("function");       // from ./infoOneFunctions
  });

  it("ouroBalanceFunctions exposes IGNIS_TOKEN_ID and getIgnisBalance", async () => {
    const mod = await import("../src/interactions/ouroBalanceFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.IGNIS_TOKEN_ID).toBe("string");
    expect(typeof mod.getIgnisBalance).toBe("function");
  });

  it("ouroRotateFunctions exposes rotateKadenaPaymentKey as a function", async () => {
    const mod = await import("../src/interactions/ouroRotateFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.rotateKadenaPaymentKey).toBe("function");
  });

  it("ouroPriceFunctions exposes getStoaPriceUSD as a function", async () => {
    const mod = await import("../src/interactions/ouroPriceFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.getStoaPriceUSD).toBe("function");
  });

  it("ouroUrStoaFunctions exposes executeUnwrapUrStoa as a function", async () => {
    const mod = await import("../src/interactions/ouroUrStoaFunctions");
    expect(typeof mod).toBe("object");
    expect(typeof mod.executeUnwrapUrStoa).toBe("function");
  });

  it("legacy ouroFunctions shim re-exposes one canonical symbol per entity-domain", async () => {
    const shim = await import("../src/interactions/ouroFunctions");
    expect(typeof shim).toBe("object");
    // 5 canonical picks across 5 different new files (account, wrap, movie-booster, balance, urstoa)
    expect(typeof (shim as any).getAccountSelectorData).toBe("function");
    expect(typeof (shim as any).wrapKadena).toBe("function");
    expect(typeof (shim as any).getSparksBalance).toBe("function");
    expect(typeof (shim as any).IGNIS_TOKEN_ID).toBe("string");
    expect(typeof (shim as any).executeUnwrapUrStoa).toBe("function");
  });
});
