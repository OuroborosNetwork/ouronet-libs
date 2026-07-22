/**
 * D1: widen the codex reader to accept the "1.3" envelope + a forward-compat
 * `foreignKeys` top-level field, WITHOUT loosening the fail-closed version gate
 * or the strict unknown-field rejection.
 *
 * FUNDS-CRITICAL. A codex backup carries every wallet's encrypted secret blob.
 * The reader must:
 *   - accept the new "1.3" export shape (T5.2 GREEN widens the version gate),
 *   - tolerate a `foreignKeys` placeholder field on 1.3 (allow-listed),
 *   - STILL reject any other unknown field (allow-list widens for foreignKeys ONLY),
 *   - STILL reject every non-"1.3"/"1.2" version — including near-miss strings
 *     that only LOOK like 1.3 (" 1.3 ", "1.3.0", "1.3\n") — locking strict
 *     equality against future leniency drift,
 *   - never echo a field's secret-looking value into the thrown message.
 *
 * RED phase (T5.1): this file is authored against the UN-widened codec.ts.
 * Cases (a) ACCEPT-1.3 and (c) FOREIGNKEYS-TOLERATED FAIL now — the current
 * gate throws `unsupported version` for "1.3", and foreignKeys throws
 * CodexUnknownFieldError. Cases (b),(d),(e),(f) assert current behavior and
 * PASS now; they are the regression guards that must stay GREEN after T5.2.
 */

import { describe, it, expect } from "vitest";
import { deserializeCodex, CodexUnknownFieldError } from "../src/codex";

// The canonical valid "1.2" envelope — mirrors codex-codec.test.ts (six known
// fields, exportedAt required by the codec return type). This is the shape
// T5.2's GREEN must keep round-tripping untouched.
const validEnvelope12 = {
  version: "1.2",
  exportedAt: "2026-04-22T07:23:01.234Z",
  kadenaWallets: [],
  ouronetWallets: [],
  addressBook: [],
  uiSettings: {},
};

// The new "1.3" envelope — same six known fields, only the version string
// differs. T5.2 GREEN widens the gate to accept this.
const validEnvelope13 = {
  ...validEnvelope12,
  version: "1.3",
};

// ─── (a) ACCEPT-1.3 (RED now) ────────────────────────────────────────────────

describe("(a) ACCEPT-1.3: a well-formed 1.3 envelope deserializes without throwing", () => {
  it("accepts the six-field 1.3 envelope — the whole point of the widen", () => {
    // RED against un-widened codec.ts: gate throws `unsupported version 1.3`.
    expect(() => deserializeCodex(JSON.stringify(validEnvelope13))).not.toThrow();
  });

  it("returns the 1.3 envelope with its four collections intact", () => {
    // Drives the round-trip contract: a restored 1.3 backup must expose the
    // same wallet/address collections it was serialized with.
    const parsed = deserializeCodex(JSON.stringify(validEnvelope13));
    expect((parsed as { version: string }).version).toBe("1.3");
    expect(parsed.kadenaWallets).toEqual([]);
    expect(parsed.ouronetWallets).toEqual([]);
    expect(parsed.addressBook).toEqual([]);
  });
});

// ─── (b) FORWARD-COMPAT-1.2 (GREEN now AND after — regression guard) ──────────

describe("(b) FORWARD-COMPAT-1.2: the exact 1.2 envelope still deserializes clean", () => {
  it("still parses the canonical 1.2 envelope after the widen (1.2 backups keep importing)", () => {
    const parsed = deserializeCodex(JSON.stringify(validEnvelope12));
    expect((parsed as { version: string }).version).toBe("1.2");
    expect(parsed.kadenaWallets).toEqual([]);
    expect(parsed.ouronetWallets).toEqual([]);
    expect(parsed.addressBook).toEqual([]);
    expect(parsed.uiSettings).toEqual({});
  });

  it("does NOT graft foreignKeys onto a restored 1.2 backup (widen must not mutate 1.2 shape)", () => {
    // A user restoring an old 1.2 file must get back exactly what they saved —
    // the 1.3 forward-compat field must never appear on a 1.2 parse.
    const parsed = deserializeCodex(JSON.stringify(validEnvelope12));
    expect(parsed).not.toHaveProperty("foreignKeys");
  });
});

// ─── (c) FOREIGNKEYS-TOLERATED (RED now) ─────────────────────────────────────

describe("(c) FOREIGNKEYS-TOLERATED: a 1.3 envelope with a foreignKeys field does not throw", () => {
  it("does NOT throw when 1.3 carries foreignKeys (allow-listed placeholder)", () => {
    // RED against un-widened codec.ts: the 1.3 gate throws today, and even past
    // it the unknown-field check would reject foreignKeys. After T5.2 the whole
    // parse succeeds. We assert `.not.toThrow()` (no error class) rather than
    // `.not.toThrow(CodexUnknownFieldError)` — the latter would pass VACUOUSLY
    // now because the current throw is a plain Error, hiding the RED. Assert
    // NOTHING about foreignKeys CONTENTS — only that the envelope is tolerated.
    const withForeignKeys = { ...validEnvelope13, foreignKeys: [] };
    expect(() =>
      deserializeCodex(JSON.stringify(withForeignKeys)),
    ).not.toThrow();
  });
});

// ─── (d) UNKNOWN-FIELD-STILL-THROWS (GREEN now AND after) ─────────────────────

describe("(d) UNKNOWN-FIELD-STILL-THROWS: 1.3 with a bogus field still throws", () => {
  it("throws CodexUnknownFieldError naming bogusField (allow-list widened for foreignKeys ONLY)", () => {
    // Proves the widen is surgical: foreignKeys is tolerated, but any other
    // unknown top-level key is still rejected at the deserialization boundary.
    // RED now: the 1.3 gate pre-empts the unknown-field check, so today this
    // throws a plain unsupported-version Error, not CodexUnknownFieldError.
    // After T5.2 the gate accepts 1.3 and bogusField reaches the allow-list.
    const tampered = { ...validEnvelope13, bogusField: "x" };
    expect(() => deserializeCodex(JSON.stringify(tampered))).toThrow(
      CodexUnknownFieldError,
    );
    expect(() => deserializeCodex(JSON.stringify(tampered))).toThrow(/bogusField/);
  });
});

// ─── (e) OUT-OF-SET-STILL-THROWS — fail-closed version gate ──────────────────
// The near-miss variants (" 1.3 ", "1.3.0", "1.30", "1.3\n") are the highest
// risk class: they LOOK like 1.3 but must throw, locking strict equality
// against future leniency drift (e.g. an accidental .trim()/.startsWith()).

describe("(e) OUT-OF-SET-STILL-THROWS: every non-1.2/1.3 version fails closed", () => {
  const outOfSetVersions: Array<[string, unknown]> = [
    ["1.1", "1.1"],
    ["1.4", "1.4"],
    ["2.0", "2.0"],
    ["missing/undefined", undefined],
    ["null", null],
    ["non-string 123", 123],
    ['near-miss " 1.3 " (whitespace)', " 1.3 "],
    ['near-miss "1.3.0"', "1.3.0"],
    ['near-miss "1.30"', "1.30"],
    ['near-miss "1.3\\n" (trailing newline)', "1.3\n"],
  ];

  it.each(outOfSetVersions)(
    "throws unsupported version for %s",
    (_label, version) => {
      // `version: undefined` is dropped by JSON.stringify — the resulting
      // envelope has no version field, which the gate reports as
      // `unsupported version undefined`. That is the fail-closed path.
      const envelope = { ...validEnvelope13, version };
      expect(() => deserializeCodex(JSON.stringify(envelope))).toThrow(
        /unsupported version/i,
      );
    },
  );
});

// ─── (f) SECRET-FREE-ERRORS ──────────────────────────────────────────────────

describe("(f) SECRET-FREE-ERRORS: a malformed 1.3 field is named but its value is never echoed", () => {
  it("names the offending field without leaking its secret-looking value", () => {
    // Security boundary: the bad field's value can be an encrypted blob or an
    // account address. The thrown message must NAME kadenaWallets but never
    // echo the secret substring into logs/telemetry.
    // RED now: the 1.3 gate pre-empts the shape check, so today the throw is
    // the unsupported-version Error. After T5.2 the 1.3 envelope reaches the
    // shape validation and this secret-free-error contract holds.
    const secret = "SECRET-LOOKING-BLOB-98765";
    const malformed = { ...validEnvelope13, kadenaWallets: secret };
    let caught: unknown;
    try {
      deserializeCodex(JSON.stringify(malformed));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toMatch(/kadenaWallets must be an array/);
    expect(message).not.toContain(secret);
    expect(message).not.toContain("98765");
  });
});
