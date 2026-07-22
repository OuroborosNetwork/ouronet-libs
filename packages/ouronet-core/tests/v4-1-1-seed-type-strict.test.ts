/**
 * REQ-12 (F-BUG-010): migrateSeedType strict throw on unknown seed types.
 * Replaces the silent `|| "koala"` default with a typed throw so codex import
 * code paths cannot silently route unknown seed types through koala derivation.
 */
import { describe, it, expect } from "vitest";
import { migrateSeedType } from "../src/codex";
import { UnknownSeedTypeError } from "../src/codex";

describe("REQ-12: migrateSeedType strict rejection of unknown seed types", () => {
  it("known canonical 'koala' → returns 'koala' (happy path)", () => {
    expect(migrateSeedType("koala")).toBe("koala");
  });

  it("known canonical 'chainweaver' → returns 'chainweaver'", () => {
    expect(migrateSeedType("chainweaver")).toBe("chainweaver");
  });

  it("known canonical 'eckowallet' → returns 'eckowallet'", () => {
    expect(migrateSeedType("eckowallet")).toBe("eckowallet");
  });

  it("known legacy 'legacy' → migrates to canonical (whatever SEED_TYPE_MIGRATION maps it to)", () => {
    const result = migrateSeedType("legacy");
    expect(result).toBeDefined();
    expect(["koala", "chainweaver", "eckowallet"]).toContain(result);
  });

  it("unknown 'garbage' → throws UnknownSeedTypeError (NEW contract)", () => {
    expect(() => migrateSeedType("garbage")).toThrow(UnknownSeedTypeError);
  });

  it("unknown 'KOALA' (uppercase) → throws (case-sensitive matching)", () => {
    expect(() => migrateSeedType("KOALA")).toThrow(UnknownSeedTypeError);
  });

  it("empty string → throws", () => {
    expect(() => migrateSeedType("")).toThrow(UnknownSeedTypeError);
  });

  it("error message references the unknown input verbatim", () => {
    let caught: unknown;
    try { migrateSeedType("v3-future-seed"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(UnknownSeedTypeError);
    expect((caught as Error).message).toMatch(/v3-future-seed/);
  });
});
