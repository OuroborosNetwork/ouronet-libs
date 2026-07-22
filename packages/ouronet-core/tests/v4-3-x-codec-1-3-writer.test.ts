/**
 * Writer/reader version contract for the codex envelope.
 *
 * FUNDS-CRITICAL. This is the LIVE writer path (useCodexBackup → serializeCodex
 * → the file a user downloads and later restores).
 *
 * THE INVARIANT, which is what this file really guards: the reader must stay
 * ahead of the writer. Whatever the writer emits must deserialize through this
 * package's own reader, or a user's own fresh backup fails to restore.
 *
 * Current position in the migration: the reader accepts {"1.2","1.3"}; the
 * writer still stamps "1.2". That gap is deliberate, not an oversight. The
 * reader half shipped, the writer half has not, because the wider ecosystem is
 * not yet uniformly on a 1.3-capable reader — `@ancientpantheon/codex` still
 * gates on 1.2, so a writer running ahead would produce backups the user's own
 * other apps could not open.
 *
 * Since ouronet's PlaintextCodex carries no foreign-key source field, the
 * writer never emits the 1.3-only `foreignKeys` block — so 1.2 and 1.3 output
 * differ only in the version string, and holding at 1.2 costs no capability.
 *
 * WHEN THE WRITER ADVANCES TO 1.3: change the two version expectations below to
 * "1.3". Everything else in this file — especially the round-trip and the
 * reader-accepts-both cases — must keep passing unchanged, because those encode
 * the invariant rather than the current position.
 */

import { describe, it, expect } from "vitest";
import {
  buildCodexExport,
  serializeCodex,
  deserializeCodex,
  type PlaintextCodex,
} from "../src/codex";

// A realistic PlaintextCodex — mirrors codex-codec.test.ts's fixture shape so
// the writer test exercises the same envelope the live export path produces.
function makeFixtureCodex(): PlaintextCodex {
  return {
    kadenaWallets: [
      { id: "seed-a", name: "Main seed", seedType: "koala", version: "1.0", index: 0, secret: "encrypted-blob-v2-here", main: "k:abc", createdAt: "2026-04-01T00:00:00Z", accounts: [] },
    ],
    ouronetWallets: [
      { id: "acct-1", name: "Resident", version: "1.0", isSmart: false, address: "ouro:AB-XYZ", guard: { pred: "keys-all", keys: ["pub1"] }, kadenaLedger: null, publicKey: "pub1", secret: "enc-secret", backup: "enc-backup" },
    ],
    addressBook: [{ id: "ab-1", label: "Friend", address: "ouro:FRIEND" }],
    pureKeypairs: [],
    uiSettings: { infoZoneOpen: true },
    schemaVersion: 1,
    lastUpdatedAt: "2026-04-22T00:00:00Z",
    lastUpdatedDevice: "dev",
  };
}

// ─── CURRENT WRITER POSITION (trails the reader on purpose) ──────────────────

describe("buildCodexExport stamps the envelope version the ecosystem can read", () => {
  it("emits version \"1.2\" — the writer deliberately trails the widened reader", () => {
    const exp = buildCodexExport(makeFixtureCodex());
    expect(exp.version).toBe("1.2");
  });

  it("serializeCodex writes a JSON whose parsed version is \"1.2\"", () => {
    const json = serializeCodex(makeFixtureCodex());
    expect(JSON.parse(json).version).toBe("1.2");
  });

  it("never emits foreignKeys — ouronet has no foreign-key source field", () => {
    // A mandatory empty block would be a lie the strict reader shouldn't have to
    // allow-list on every write. Its absence is also why holding the writer at
    // 1.2 loses nothing: there is no 1.3-only payload to carry.
    const exp = buildCodexExport(makeFixtureCodex());
    expect(exp).not.toHaveProperty("foreignKeys");
  });
});

// ─── THE INVARIANT — must hold at every point of the migration ───────────────

describe("reader stays ahead of writer", () => {
  it("whatever the writer emits round-trips through this package's own reader", () => {
    // The funds-loss guard. Deliberately asserts the round-trip WITHOUT naming a
    // version, so it keeps guarding after the writer advances.
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    const parsed = deserializeCodex(json);
    expect((parsed as { version: string }).version).toBe(JSON.parse(json).version);
    expect(parsed.kadenaWallets).toEqual(codex.kadenaWallets);
    expect(parsed.ouronetWallets).toEqual(codex.ouronetWallets);
    expect(parsed.addressBook).toEqual(codex.addressBook);
    expect(parsed.uiSettings).toEqual(codex.uiSettings);
  });

  it("the reader accepts BOTH 1.2 and 1.3, so the writer can advance without a reader change", () => {
    const codex = makeFixtureCodex();
    const asWritten = JSON.parse(serializeCodex(codex));

    // 1.2 — what the writer emits today.
    expect(() => deserializeCodex(JSON.stringify({ ...asWritten, version: "1.2" }))).not.toThrow();
    // 1.3 — what it will emit next, already readable.
    expect(() => deserializeCodex(JSON.stringify({ ...asWritten, version: "1.3" }))).not.toThrow();
  });

  it("still fails closed on a version neither side understands", () => {
    const codex = makeFixtureCodex();
    const asWritten = JSON.parse(serializeCodex(codex));
    expect(() => deserializeCodex(JSON.stringify({ ...asWritten, version: "1.4" }))).toThrow(/unsupported version/);
  });
});
