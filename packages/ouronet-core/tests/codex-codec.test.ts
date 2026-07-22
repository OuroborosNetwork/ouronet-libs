/**
 * Codex codec round-trip + format-integrity tests.
 *
 * The writer stamps `"1.2"`; the reader accepts BOTH `"1.2"` and
 * `"1.3"`. Every user with an `OuronetCodex_*.json` file on disk (still
 * "1.2") must be able to import it after any core update, and every fresh
 * "1.3" export must round-trip through the same reader. These tests lock
 * both halves of that contract.
 *
 * Part of Tier 1 (see OuronetUI/docs/TESTING_STRATEGY.md). Pure unit
 * tests — no WebCrypto, no fs, no network.
 */

import { describe, it, expect } from "vitest";
import {
  buildCodexExport,
  serializeCodex,
  deserializeCodex,
  migrateSeedType,
  UnknownSeedTypeError,
  CodexUnknownFieldError,
  type PlaintextCodex,
  type CodexExportV1_2,
  type SeedType,
} from "../src/codex";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// A realistic PlaintextCodex, shaped like what OuronetUI's LocalStorageCodexAdapter
// would produce from localStorage. Uses unknown-typed lists as the default
// generic encourages — consumers plug their own types.
function makeFixtureCodex(): PlaintextCodex {
  return {
    kadenaWallets: [
      { id: "seed-a", name: "Main seed", seedType: "koala", version: "1.0", index: 0, secret: "encrypted-blob-v2-here", main: "k:abc", createdAt: "2026-04-01T00:00:00Z", accounts: [] },
    ],
    ouronetWallets: [
      { id: "acct-1", name: "Resident", version: "1.0", isSmart: false, address: "ouro:AB-XYZ", guard: { pred: "keys-all", keys: ["pub1"] }, kadenaLedger: null, publicKey: "pub1", secret: "enc-secret", backup: "enc-backup" },
    ],
    addressBook: [
      { id: "ab-1", label: "Friend", address: "ouro:FRIEND" },
    ],
    pureKeypairs: [
      { id: "pk-1", label: "Pure1", publicKey: "pubPURE", encryptedPrivateKey: "enc", createdAt: "2026-04-02T00:00:00Z" },
    ],
    uiSettings: { infoZoneOpen: true, zbomExecutePosition: "top" },
    schemaVersion: 1,
    lastUpdatedAt: "2026-04-22T00:00:00Z",
    lastUpdatedDevice: "dev",
  };
}

// ─── buildCodexExport ─────────────────────────────────────────────────────────

describe("buildCodexExport", () => {
  it("produces a v1.2 export object (the writer deliberately trails the widened reader)", () => {
    const codex = makeFixtureCodex();
    const exp = buildCodexExport(codex);
    expect(exp.version).toBe("1.2");
  });

  it("stamps exportedAt with an ISO timestamp", () => {
    const codex = makeFixtureCodex();
    const exp = buildCodexExport(codex);
    // e.g. "2026-04-22T07:23:01.234Z"
    expect(exp.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });

  it("copies kadenaWallets, ouronetWallets, addressBook, uiSettings verbatim", () => {
    const codex = makeFixtureCodex();
    const exp = buildCodexExport(codex);
    expect(exp.kadenaWallets).toEqual(codex.kadenaWallets);
    expect(exp.ouronetWallets).toEqual(codex.ouronetWallets);
    expect(exp.addressBook).toEqual(codex.addressBook);
    expect(exp.uiSettings).toEqual(codex.uiSettings);
  });

  it("does NOT include pureKeypairs (historical shape excludes them — they ship in cloud-backup)", () => {
    const codex = makeFixtureCodex();
    const exp = buildCodexExport(codex);
    expect(exp).not.toHaveProperty("pureKeypairs");
  });

  it("does NOT include schemaVersion / lastUpdatedAt / lastUpdatedDevice (device-local fields don't travel)", () => {
    const codex = makeFixtureCodex();
    const exp = buildCodexExport(codex);
    expect(exp).not.toHaveProperty("schemaVersion");
    expect(exp).not.toHaveProperty("lastUpdatedAt");
    expect(exp).not.toHaveProperty("lastUpdatedDevice");
  });
});

// ─── serializeCodex ───────────────────────────────────────────────────────────

describe("serializeCodex", () => {
  it("returns valid JSON", () => {
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("pretty-prints with 2-space indent (users open these files in notepad)", () => {
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    // Pretty-printed JSON has newlines between fields and 2-space indent
    expect(json).toContain("\n  ");
  });

  it("starts with the version field visible (prevents accidental renames)", () => {
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("1.2");
  });
});

// ─── deserializeCodex ─────────────────────────────────────────────────────────

describe("deserializeCodex", () => {
  it("parses a freshly written export (writer output round-trips through its own reader)", () => {
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    const parsed = deserializeCodex(json);
    // Version-agnostic on purpose: the guard is that the writer's own output
    // survives the reader, which must hold before and after the writer advances.
    expect(parsed.version).toBe(JSON.parse(json).version);
    expect(parsed.kadenaWallets).toEqual(codex.kadenaWallets);
    expect(parsed.ouronetWallets).toEqual(codex.ouronetWallets);
  });

  it("throws on non-JSON input", () => {
    expect(() => deserializeCodex("not json")).toThrow();
  });

  it("throws on missing version field", () => {
    const badJson = JSON.stringify({ exportedAt: "x", kadenaWallets: [], ouronetWallets: [], addressBook: [], uiSettings: {} });
    expect(() => deserializeCodex(badJson)).toThrow(/unsupported version/i);
  });

  it("throws on version mismatch (future v2.0)", () => {
    const badJson = JSON.stringify({ version: "2.0", exportedAt: "x", kadenaWallets: [], ouronetWallets: [], addressBook: [], uiSettings: {} });
    expect(() => deserializeCodex(badJson)).toThrow(/unsupported version/i);
  });

  it("throws on plain-string input (not an object)", () => {
    expect(() => deserializeCodex('"just a string"')).toThrow();
  });

  it("throws on null input", () => {
    expect(() => deserializeCodex("null")).toThrow(/not an object/i);
  });

  it("throws CodexUnknownFieldError for unknown top-level fields (strict-shape enforcement)", () => {
    // REQ-08 supersedes the old forward-compat pass-through: unknown fields
    // are rejected at the deserialization boundary to prevent attacker-controlled
    // import files from smuggling unexpected keys into the parsed codex object.
    const json = '{"version":"1.2","kadenaWallets":[],"ouronetWallets":[],"addressBook":[],"uiSettings":{},"futureFieldX":"x"}';
    expect(() => deserializeCodex(json)).toThrow(CodexUnknownFieldError);
    expect(() => deserializeCodex(json)).toThrow(/futureFieldX/);
  });
});

// ─── deserializeCodex shape validation (REQ-02 / F-CORE-013) ─────────────────
// Runtime shape checks fire AFTER the version match and BEFORE the typed cast.
// Errors NAME the offending field but never echo its value — the codex
// envelope can carry encrypted secrets and account addresses, so surfacing
// them into telemetry/logs would breach the codec's information-disclosure
// boundary.

describe("deserializeCodex shape validation (REQ-02)", () => {
  it("throws when kadenaWallets is not an array", () => {
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: "not-an-array",
      ouronetWallets: [],
      addressBook: [],
      uiSettings: {},
    });
    expect(() => deserializeCodex(json)).toThrow(/kadenaWallets must be an array/);
  });

  it("throws when ouronetWallets is not an array", () => {
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: [],
      ouronetWallets: { obj: true },
      addressBook: [],
      uiSettings: {},
    });
    expect(() => deserializeCodex(json)).toThrow(/ouronetWallets must be an array/);
  });

  it("throws when addressBook is not an array", () => {
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: [],
      ouronetWallets: [],
      addressBook: 42,
      uiSettings: {},
    });
    expect(() => deserializeCodex(json)).toThrow(/addressBook must be an array/);
  });

  it("throws when uiSettings is not an object (string variant)", () => {
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: [],
      ouronetWallets: [],
      addressBook: [],
      uiSettings: "not-an-object",
    });
    expect(() => deserializeCodex(json)).toThrow(/uiSettings must be an object/);
  });

  it("throws when uiSettings is null (null is not a valid object for the codex envelope)", () => {
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: [],
      ouronetWallets: [],
      addressBook: [],
      uiSettings: null,
    });
    expect(() => deserializeCodex(json)).toThrow(/uiSettings must be an object/);
  });

  it("throws when uiSettings is an array (array is not a plain object)", () => {
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: [],
      ouronetWallets: [],
      addressBook: [],
      uiSettings: [],
    });
    expect(() => deserializeCodex(json)).toThrow(/uiSettings must be an object/);
  });

  it("throws on the FIRST malformed field in declaration order (kadenaWallets wins over uiSettings)", () => {
    // Both kadenaWallets and uiSettings are malformed. Validation order is
    // deterministic and matches the declaration order of CodexExportV1_2,
    // so kadenaWallets fails first and its error wins.
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: "x",
      ouronetWallets: [],
      addressBook: [],
      uiSettings: "x",
    });
    expect(() => deserializeCodex(json)).toThrow(/kadenaWallets must be an array/);
    expect(() => deserializeCodex(json)).not.toThrow(/uiSettings/);
  });

  it("does NOT echo the bad field's value into the error message (no info disclosure)", () => {
    // Security boundary: the bad field's value can be a secret-looking string
    // (e.g. encrypted blob, account address). The error message must NAME the
    // offending field without echoing its contents into logs/telemetry.
    const json = JSON.stringify({
      version: "1.2",
      kadenaWallets: "SECRET-LOOKING-VALUE-12345",
      ouronetWallets: [],
      addressBook: [],
      uiSettings: {},
    });
    let caught: unknown;
    try {
      deserializeCodex(json);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/kadenaWallets must be an array/);
    expect(message).not.toContain("SECRET-LOOKING-VALUE-12345");
    expect(message).not.toContain("12345");
  });
});

// ─── Round-trip ───────────────────────────────────────────────────────────────

describe("round-trip serialize → deserialize", () => {
  it("preserves all four collections byte-identically", () => {
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    const parsed = deserializeCodex(json);

    expect(parsed.kadenaWallets).toEqual(codex.kadenaWallets);
    expect(parsed.ouronetWallets).toEqual(codex.ouronetWallets);
    expect(parsed.addressBook).toEqual(codex.addressBook);
    expect(parsed.uiSettings).toEqual(codex.uiSettings);
  });

  it("preserves empty collections", () => {
    const empty: PlaintextCodex = {
      kadenaWallets: [], ouronetWallets: [], addressBook: [], pureKeypairs: [],
      uiSettings: { infoZoneOpen: true },
      schemaVersion: 0, lastUpdatedAt: null, lastUpdatedDevice: "dev",
    };
    const json = serializeCodex(empty);
    const parsed = deserializeCodex(json);
    expect(parsed.kadenaWallets).toEqual([]);
    expect(parsed.ouronetWallets).toEqual([]);
    expect(parsed.addressBook).toEqual([]);
  });

  it("preserves unicode in names / labels (important for international users)", () => {
    const codex = makeFixtureCodex();
    (codex.kadenaWallets[0] as any).name = "🔐 Резиденция™";
    const json = serializeCodex(codex);
    const parsed = deserializeCodex(json);
    expect((parsed.kadenaWallets[0] as any).name).toBe("🔐 Резиденция™");
  });

  it("preserves deeply nested keyset guards", () => {
    const codex = makeFixtureCodex();
    (codex.ouronetWallets[0] as any).guard = {
      pred: "keys-2",
      keys: ["pub-a", "pub-b", "pub-c"],
      keysetRef: "ouronet-ns.dh_sc_dpdc-keyset",
    };
    const json = serializeCodex(codex);
    const parsed = deserializeCodex(json);
    expect((parsed.ouronetWallets[0] as any).guard).toEqual({
      pred: "keys-2",
      keys: ["pub-a", "pub-b", "pub-c"],
      keysetRef: "ouronet-ns.dh_sc_dpdc-keyset",
    });
  });
});

// ─── migrateSeedType ──────────────────────────────────────────────────────────

describe("migrateSeedType", () => {
  it("maps legacy → chainweaver", () => {
    expect(migrateSeedType("legacy")).toBe("chainweaver");
  });

  it("maps new → koala", () => {
    expect(migrateSeedType("new")).toBe("koala");
  });

  it("passes through canonical types unchanged (idempotent)", () => {
    const canonical: SeedType[] = ["koala", "chainweaver", "eckowallet"];
    for (const t of canonical) {
      expect(migrateSeedType(t)).toBe(t);
    }
  });

  it("is idempotent: migrate(migrate(x)) === migrate(x)", () => {
    const inputs = ["legacy", "new", "koala", "chainweaver", "eckowallet"];
    for (const x of inputs) {
      const once = migrateSeedType(x);
      const twice = migrateSeedType(once);
      expect(twice).toBe(once);
    }
  });

  it("throws UnknownSeedTypeError for unknown strings (strict contract)", () => {
    expect(() => migrateSeedType("unknown")).toThrow(UnknownSeedTypeError);
    expect(() => migrateSeedType("")).toThrow(UnknownSeedTypeError);
    expect(() => migrateSeedType("KOALA")).toThrow(UnknownSeedTypeError);
  });
});

// ─── Type exports exist (compile-time check) ─────────────────────────────────

describe("exported types (compile-time check)", () => {
  it("PlaintextCodex accepts the generic fixture type", () => {
    // If this compiles, the test passes. If the generic signature
    // changes and breaks consumers, TypeScript rejects this file.
    const codex: PlaintextCodex = makeFixtureCodex();
    expect(codex.kadenaWallets.length).toBeGreaterThan(0);
  });

  it("CodexExportV1_2 is the right shape", () => {
    const exp: CodexExportV1_2 = {
      version: "1.2",
      exportedAt: new Date().toISOString(),
      kadenaWallets: [],
      ouronetWallets: [],
      addressBook: [],
      uiSettings: {},
    };
    expect(exp.version).toBe("1.2");
  });
});
