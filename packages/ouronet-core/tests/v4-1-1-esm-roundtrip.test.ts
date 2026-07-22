/**
 * REQ-28 (T7.8 catch-up): ouronet-core ESM dynamic-import roundtrip.
 * Validates the built artifact is importable from a Node ESM context.
 * The root barrel is intentionally near-empty (per design); subpath exports
 * carry the surface. Confirms named exports are reachable from key subpaths.
 */
import { describe, it, expect } from "vitest";

describe("REQ-28: ouronet-core ESM roundtrip", () => {
  it("codex subpath is dynamically importable and non-empty", async () => {
    const mod = await import("@ouronet/ouronet-core/codex");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
    const exportNames = Object.keys(mod);
    expect(exportNames.length).toBeGreaterThan(0);
  });

  it("interactions/kadenaFunctions subpath is dynamically importable", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/kadenaFunctions");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("interactions/kadenaFunctions exposes getBalance as a function", async () => {
    const mod = await import("@ouronet/ouronet-core/interactions/kadenaFunctions");
    expect(typeof mod.getBalance).toBe("function");
  });
});
