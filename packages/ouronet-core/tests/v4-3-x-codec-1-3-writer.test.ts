/**
 * Writer flip: buildCodexExport / serializeCodex must stamp the "1.3" envelope
 * version, matching the reader D1 already widened to accept.
 *
 * FUNDS-CRITICAL. This is the LIVE writer path (useCodexBackup → serializeCodex
 * → the file a user downloads and later restores). The reader in THIS file was
 * widened first (deserializeCodex accepts {"1.2","1.3"}); flipping the writer to
 * emit "1.3" without that widen would be a funds-loss inversion. The precondition
 * is enforced by the (D1-widened) round-trip assertion below: a freshly written
 * envelope must deserialize back through this package's own reader.
 *
 * RED phase: authored against the un-flipped writer (still stamps "1.2"). The
 * WRITER-STAMPS-1.3 case fails now (version is "1.2"); the round-trip case
 * passes now (1.2 is accepted) but pins the contract that the emitted version
 * must survive its own reader after the flip.
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

// ─── WRITER-STAMPS-1.3 (RED now — writer still stamps "1.2") ─────────────────

describe("buildCodexExport stamps the 1.3 envelope version", () => {
  it("emits version \"1.3\" — the writer contract now matches the widened reader", () => {
    // Drives the flip: a fresh export must carry the new version literal so the
    // downloaded backup declares the format its own reader accepts.
    const exp = buildCodexExport(makeFixtureCodex());
    expect(exp.version).toBe("1.3");
  });

  it("serializeCodex writes a JSON whose parsed version is \"1.3\"", () => {
    const json = serializeCodex(makeFixtureCodex());
    expect(JSON.parse(json).version).toBe("1.3");
  });

  it("omits foreignKeys when the source codex has none (bare 1.3 envelope, no empty block)", () => {
    // ouronet's PlaintextCodex has no foreignKeys source field, so the practical
    // emission is foreignKeys-ABSENT — a mandatory empty block would be a lie the
    // strict reader shouldn't have to allow-list on every write.
    const exp = buildCodexExport(makeFixtureCodex());
    expect(exp).not.toHaveProperty("foreignKeys");
  });
});

// ─── ROUND-TRIP THROUGH THIS PACKAGE'S OWN (D1-WIDENED) READER ───────────────

describe("writer output round-trips through the D1-widened reader", () => {
  it("serializeCodex → deserializeCodex yields a 1.3 envelope the reader accepts", () => {
    // The funds-loss guard: what the LIVE writer emits must deserialize back
    // through THIS package's reader. If the writer stamped a version the reader
    // rejected, a user's own backup would fail to restore.
    const codex = makeFixtureCodex();
    const json = serializeCodex(codex);
    const parsed = deserializeCodex(json);
    expect((parsed as { version: string }).version).toBe("1.3");
    expect(parsed.kadenaWallets).toEqual(codex.kadenaWallets);
    expect(parsed.ouronetWallets).toEqual(codex.ouronetWallets);
    expect(parsed.addressBook).toEqual(codex.addressBook);
    expect(parsed.uiSettings).toEqual(codex.uiSettings);
  });
});
