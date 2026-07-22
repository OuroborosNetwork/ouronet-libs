/**
 * Cross-repo parity — ouronet-core's post-writer-flip codec vs. codex-core's
 * canonical codec, run against the SHARED subset of the D-06 matrix.
 *
 * FUNDS-CRITICAL. The "1.3" envelope is INTENTIONALLY duplicated in two repos
 * (codex-core canonical + ouronet-core peer) with no cross-org runtime edge. This
 * file proves BEHAVIOURAL parity: the ouronet-core reader/writer agree with the
 * codex-core matrix on every row of the SHARED subset — same golden 1.2 fixture,
 * same 1.2→1.3 forward, same 1.3 round-trip, same tolerance of a foreignKeys
 * block, same unknown-field rejection, same out-of-set fail-closed, same
 * secret-freedom.
 *
 * KEY DIFFERENCE from codex-core: ouronet-core's reader was D1-WIDENED to TOLERATE
 * the `foreignKeys` field (allow-list only). It does NOT structurally validate the
 * block's contents — unlike codex-core, which owns the canonical model and
 * validates the shape. So the foreignKeys rows here assert TOLERANCE (does NOT
 * throw on a well-formed block), NOT structural validation.
 *
 * EXCLUDED from this shared subset (F-006): null / undefined / non-string
 * `version`. codex-core AND ouronet-core throw /unsupported version/ on those, but
 * StoaWallet's importCodex returns reason:'invalid-json' — those are
 * READER-SPECIFIC, not shared-identical, and including them would false-RED the
 * parity claim. Only near-miss STRING version variants are in the shared set.
 *
 * The 1.2 case replays the EXACT `GOLDEN_12_WIRE` string literal from
 * codex-core's codec-1-3-matrix.test.ts (CI-104: both readers pinned to ONE
 * golden — this literal is COPIED verbatim, not re-authored).
 *
 * Pure unit tests — no WebCrypto, no fs, no network.
 */

import { describe, it, expect } from "vitest";
import {
  buildCodexExport,
  deserializeCodex,
  serializeCodex,
  CodexUnknownFieldError,
  type PlaintextCodex,
} from "../src/codex";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// COPIED VERBATIM from codex-core/tests/codec-1-3-matrix.test.ts's GOLDEN_12_WIRE
// (CI-104: both readers replay ONE golden — do NOT fork a second 1.2 literal). The
// frozen byte-exact 1.2 wire-shape golden; the two readers must agree on THIS
// EXACT string.
const GOLDEN_12_WIRE = JSON.stringify(
  {
    version: "1.2",
    exportedAt: "2026-01-13T00:00:00.000Z",
    kadenaWallets: [
      { id: "seed-golden", name: "Golden seed", seedType: "chainweaver", secret: "enc:v2:golden-seed-blob", main: "k:golden", accounts: [] },
    ],
    ouronetWallets: [
      { id: "acct-golden", name: "Golden resident", address: "ouro:GOLDEN", guard: { pred: "keys-all", keys: ["pubG"] }, secret: "enc:golden-acct" },
    ],
    addressBook: [{ id: "ab-golden", label: "GoldenFriend", address: "ouro:GFRIEND" }],
    uiSettings: { infoZoneOpen: false, dockPosition: "left" },
  },
  null,
  2,
);

// A Kadena-only PlaintextCodex (ouronet-core's writer input). ouronet's
// PlaintextCodex has no foreignKeys source, so the writer always omits the block.
function makeFixtureCodex(): PlaintextCodex {
  return {
    kadenaWallets: [
      { id: "seed-a", name: "Main seed", seedType: "koala", secret: "encrypted-blob-v2-here", main: "k:abc", accounts: [] },
    ],
    ouronetWallets: [
      { id: "acct-1", name: "Resident", address: "ouro:AB-XYZ", guard: { pred: "keys-all", keys: ["pub1"] }, secret: "enc-secret" },
    ],
    addressBook: [{ id: "ab-1", label: "Friend", address: "ouro:FRIEND" }],
    pureKeypairs: [],
    uiSettings: { infoZoneOpen: true, zbomExecutePosition: "top" },
    schemaVersion: 1,
    lastUpdatedAt: "2026-04-22T00:00:00Z",
    lastUpdatedDevice: "dev",
  };
}

// A valid "1.3" envelope literal builder. `foreignKeys` param controls the block.
function make13Envelope(foreignKeys?: unknown): Record<string, unknown> {
  const env: Record<string, unknown> = {
    version: "1.3",
    exportedAt: "2026-07-04T00:00:00.000Z",
    kadenaWallets: [{ id: "seed-a", secret: "enc-seed" }],
    ouronetWallets: [{ id: "acct-1", secret: "enc-acct" }],
    addressBook: [],
    uiSettings: { infoZoneOpen: true },
  };
  if (foreignKeys !== undefined) env.foreignKeys = foreignKeys;
  return env;
}

// ─── (1) 1.2 GOLDEN REPLAY — field-complete parse of the SHARED golden ─────────

describe("(1) 1.2 GOLDEN REPLAY — ouronet-core deserializes the SHARED GOLDEN_12_WIRE field-complete", () => {
  it("parses the frozen 1.2 golden with every top-level field present (parity with codex-core's row 1b)", () => {
    const source = JSON.parse(GOLDEN_12_WIRE);
    const parsed = deserializeCodex(GOLDEN_12_WIRE) as Record<string, unknown>;
    expect(parsed.version).toBe("1.2");
    expect(parsed.exportedAt).toBe(source.exportedAt);
    expect(parsed.kadenaWallets).toEqual(source.kadenaWallets);
    expect(parsed.ouronetWallets).toEqual(source.ouronetWallets);
    expect(parsed.addressBook).toEqual(source.addressBook);
    expect(parsed.uiSettings).toEqual(source.uiSettings);
    // 1.2 predates the keyring block — a 1.2 restore carries no foreignKeys.
    expect(parsed).not.toHaveProperty("foreignKeys");
  });
});

// ─── (2) 1.2 → 1.3 FORWARD — writer stamps 1.3, omits foreignKeys ──────────────

describe("(2) 1.2 → 1.3 FORWARD — reader accepts 1.2 golden; writer stamps 1.3 with no foreignKeys", () => {
  it("deserializes the 1.2 golden clean AND the writer stamps 1.3 (never 1.2) omitting foreignKeys", () => {
    const parsed = deserializeCodex(GOLDEN_12_WIRE) as Record<string, unknown>;
    expect(parsed.version).toBe("1.2");
    const exp = buildCodexExport(makeFixtureCodex());
    expect(exp.version).toBe("1.3");
    expect(exp).not.toHaveProperty("foreignKeys");
  });
});

// ─── (3) 1.3 ROUND-TRIP (no foreign keys) ─────────────────────────────────────

describe("(3) 1.3 ROUND-TRIP — build → serialize → deserialize with no foreign keys", () => {
  it("round-trips a 1.3 export whose result has NO foreignKeys property", () => {
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    const parsed = deserializeCodex(json) as Record<string, unknown>;
    expect(parsed.version).toBe("1.3");
    expect(parsed).not.toHaveProperty("foreignKeys");
    expect(parsed.kadenaWallets).toEqual(codex.kadenaWallets);
    expect(parsed.ouronetWallets).toEqual(codex.ouronetWallets);
  });
});

// ─── (4) 1.3 EMPTY foreignKeys — TOLERATED (allow-listed, NOT validated) ───────

describe("(4) 1.3 EMPTY foreignKeys — ouronet-core TOLERATES the block (no throw), does not validate contents", () => {
  it("does NOT throw on a well-formed empty foreignKeys block (tolerance, not structural validation)", () => {
    // ouronet-core's reader was D1-widened to ALLOW-LIST foreignKeys — it tolerates
    // the field but (unlike codex-core) does not structurally validate its contents.
    // Assert TOLERANCE: a well-formed block does not throw.
    const env = make13Envelope({ schemaVersion: 1, keys: [] });
    expect(() => deserializeCodex(JSON.stringify(env))).not.toThrow();
  });
});

// ─── (5) 1.3 POPULATED foreignKeys — TOLERATED ─────────────────────────────────

describe("(5) 1.3 POPULATED foreignKeys — ouronet-core TOLERATES a populated block (no throw)", () => {
  it("does NOT throw on a well-formed populated foreignKeys block (tolerance parity)", () => {
    const env = make13Envelope({
      schemaVersion: 1,
      keys: [
        { id: "fk-ar-1", label: "Arweave main", chainId: "arweave:mainnet", encryptedKeyfile: "enc:AR-keyfile-blob-1" },
        { id: "fk-ar-2", chainId: "arweave:mainnet", encryptedKeyfile: "enc:AR-keyfile-blob-2" },
      ],
    });
    expect(() => deserializeCodex(JSON.stringify(env))).not.toThrow();
  });
});

// ─── (6) UNKNOWN FIELD THROWS — parity with codex-core row 6 ────────────────────

describe("(6) UNKNOWN FIELD — a 1.3 envelope with bogusField throws CodexUnknownFieldError naming it", () => {
  it("throws CodexUnknownFieldError and names bogusField (allow-list widened for foreignKeys ONLY)", () => {
    const env = make13Envelope();
    env.bogusField = "x";
    const json = JSON.stringify(env);
    expect(() => deserializeCodex(json)).toThrow(CodexUnknownFieldError);
    expect(() => deserializeCodex(json)).toThrow(/bogusField/);
  });
});

// ─── (7) OUT-OF-SET VERSION THROWS — STRING variants only (F-006 excludes rest) ─

describe("(7) OUT-OF-SET VERSION — each rejected STRING version throws /unsupported version/i", () => {
  // SHARED subset: near-miss STRING variants only. null/undefined/non-string are
  // EXCLUDED (F-006) — codex-core & ouronet-core throw on those, but StoaWallet's
  // importCodex returns invalid-json, so they are reader-specific, not shared.
  const inSetParityCases: Array<[string, string]> = [
    ["1.1", "1.1"],
    ["1.4", "1.4"],
    ["2.0", "2.0"],
    ["near-miss ' 1.3 '", " 1.3 "],
    ["near-miss '1.3.0'", "1.3.0"],
    ["near-miss '1.30'", "1.30"],
    ["near-miss '1.3\\n'", "1.3\n"],
  ];

  it.each(inSetParityCases)("throws for version %s", (_label, version) => {
    const env = make13Envelope();
    env.version = version;
    expect(() => deserializeCodex(JSON.stringify(env))).toThrow(/unsupported version/i);
  });
});

// ─── (8) SECRET NEVER ECHOED — malformed field named, value never leaked ────────

describe("(8) SECRET NEVER ECHOED — a malformed top-level field is named but its secret value never echoed", () => {
  const SECRET = "SUPER-SECRET-KEYFILE-CIPHERTEXT-9f3a2b";

  it("names kadenaWallets without echoing its secret-looking value (parity with codex-core row 8)", () => {
    const env = make13Envelope();
    env.kadenaWallets = SECRET;
    let caught: unknown;
    try {
      deserializeCodex(JSON.stringify(env));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/kadenaWallets/);
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain("9f3a2b");
  });
});
