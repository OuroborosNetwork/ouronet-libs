/**
 * Seed-type migration — codex round-trip integration + locked unknown-input
 * invariant. Complements the unit-level tests at
 * `tests/codex-codec.test.ts:202-232` (which cover direct-call mappings,
 * canonical idempotence, and `"unknown"` / `""` / `"KOALA"` fallback).
 *
 * Coverage angle here, NOT covered by codex-codec.test.ts:
 *   1. Round-trip integration: a legacy `seedType` survives
 *      `serializeCodex` → `deserializeCodex` byte-identically (the codec
 *      is shape-only; migration is a load-time consumer concern), AND
 *      `migrateSeedType` applied to the deserialized value yields the
 *      canonical mapping.
 *   2. Locked unknown-input invariant on a previously-untested string
 *      (`"v3-future-seed"`) — pins the audit-locked default-to-`"koala"`
 *      contract from `src/codex/seedTypeMigration.ts:40-42`.
 *   3. Parameterized 5-row matrix from `SEED_TYPE_MIGRATION` at
 *      `src/codex/seedTypeMigration.ts:26-32` exercised end-to-end through
 *      the codec round-trip — `legacy/new/chainweaver/koala/eckowallet` →
 *      `chainweaver/koala/chainweaver/koala/eckowallet`.
 */

import { describe, it, expect } from "vitest";
import {
  serializeCodex,
  deserializeCodex,
  migrateSeedType,
  UnknownSeedTypeError,
  type PlaintextCodex,
  type SeedType,
} from "../src/codex";

// Self-contained minimal-codex builder — deliberately NOT reusing
// `makeFixtureCodex()` from codex-codec.test.ts so this file stays
// independently meaningful when read in isolation.
function makeMinimalCodex(seedType: string): PlaintextCodex {
  return {
    kadenaWallets: [
      {
        id: "seed-rt-1",
        name: "Round-trip seed",
        seedType,
        version: "1.0",
        index: 0,
        secret: "encrypted-blob-placeholder",
        main: "k:rt",
        createdAt: "2026-05-02T00:00:00Z",
        accounts: [],
      },
    ],
    ouronetWallets: [],
    addressBook: [],
    pureKeypairs: [],
    uiSettings: {},
    schemaVersion: 1,
    lastUpdatedAt: null,
    lastUpdatedDevice: "dev",
  };
}

// ─── 1. Codex round-trip integration ─────────────────────────────────────────

describe("migrateSeedType — codex round-trip integration", () => {
  it("preserves a legacy seedType through serialize → deserialize byte-identically, and consumer-side migration maps it to the canonical name", () => {
    const codex = makeMinimalCodex("legacy");
    const json = serializeCodex(codex);

    // Raw JSON preserves the legacy string verbatim — the codec is a pure
    // envelope, migration is the consumer's responsibility on load.
    expect(json).toContain('"seedType": "legacy"');

    const parsed = deserializeCodex<{ seedType: string }>(json);
    expect(parsed.kadenaWallets[0]!.seedType).toBe("legacy");

    // Apply migration on load — this is what UI/HUB do after deserializing.
    const migrated = migrateSeedType(parsed.kadenaWallets[0]!.seedType);
    expect(migrated).toBe("chainweaver");
  });

  it("preserves the legacy `new` seedType through round-trip and migrates it to koala on load", () => {
    const codex = makeMinimalCodex("new");
    const json = serializeCodex(codex);

    expect(json).toContain('"seedType": "new"');

    const parsed = deserializeCodex<{ seedType: string }>(json);
    expect(parsed.kadenaWallets[0]!.seedType).toBe("new");

    const migrated = migrateSeedType(parsed.kadenaWallets[0]!.seedType);
    expect(migrated).toBe("koala");
  });
});

// ─── 2. Locked unknown-input fallback invariant ──────────────────────────────

describe("migrateSeedType — locked unknown-input throw invariant", () => {
  it('throws UnknownSeedTypeError for "v3-future-seed" (strict contract; distinct from the "unknown" / "" / "KOALA" / "garbage" strings already exercised in codex-codec.test.ts)', () => {
    expect(() => migrateSeedType("v3-future-seed")).toThrow(UnknownSeedTypeError);
  });
});

// ─── 3. Parameterized 5-row matrix through the codec round-trip ──────────────

describe("migrateSeedType — parameterized 5-row matrix end-to-end through codec round-trip", () => {
  // Source of truth: `SEED_TYPE_MIGRATION` table at
  // `src/codex/seedTypeMigration.ts:26-32`.
  const matrix: ReadonlyArray<readonly [string, SeedType]> = [
    ["legacy", "chainweaver"],
    ["new", "koala"],
    ["chainweaver", "chainweaver"],
    ["koala", "koala"],
    ["eckowallet", "eckowallet"],
  ];

  it.each(matrix)(
    "round-trips %s through serialize/deserialize and migrates to %s",
    (input, expected) => {
      const codex = makeMinimalCodex(input);
      const json = serializeCodex(codex);
      const parsed = deserializeCodex<{ seedType: string }>(json);

      expect(parsed.kadenaWallets[0]!.seedType).toBe(input);
      expect(migrateSeedType(parsed.kadenaWallets[0]!.seedType)).toBe(expected);
    },
  );
});
