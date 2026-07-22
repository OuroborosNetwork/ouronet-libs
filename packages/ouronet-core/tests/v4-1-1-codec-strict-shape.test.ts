/**
 * REQ-08: deserializeCodex strict-shape validation.
 *
 * The codec's deserialization boundary must reject unknown top-level fields
 * rather than silently passing them through. An attacker-controlled import
 * file could smuggle unexpected keys into the parsed codex object; strict
 * rejection at the gate prevents downstream consumers from treating those
 * keys as authoritative. The error class (CodexUnknownFieldError) is typed
 * separately so callers can distinguish "unknown field" from "wrong version"
 * or "malformed array".
 *
 * RED phase — T2.2b GREEN will add the unknown-field check to codec.ts and
 * remove the conflicting "preserves unknown extra fields" pin in codex-codec.test.ts
 * (that pin was forward-compat speculation that REQ-08 explicitly overrides).
 */

import { describe, it, expect } from "vitest";
import { deserializeCodex, CodexUnknownFieldError } from "../src/codex";

describe("REQ-08: deserializeCodex strict-shape validation", () => {
  // Mirrors the canonical valid envelope from codex-codec.test.ts fixtures.
  // exportedAt is required by the codec's return type; all six known fields present.
  const validEnvelope = {
    version: "1.2",
    exportedAt: new Date().toISOString(),
    kadenaWallets: [],
    ouronetWallets: [],
    addressBook: [],
    uiSettings: {},
  };

  it("accepts a valid v1.2 envelope with only the six known top-level fields", () => {
    expect(() => deserializeCodex(JSON.stringify(validEnvelope))).not.toThrow();
  });

  it("throws CodexUnknownFieldError when envelope contains an unknown top-level field", () => {
    const tampered = { ...validEnvelope, pureKeypairs: [{ secret: "leaked" }] };
    expect(() => deserializeCodex(JSON.stringify(tampered))).toThrow(
      CodexUnknownFieldError,
    );
  });

  it("error message names the unknown field so the caller can surface it safely", () => {
    const tampered = { ...validEnvelope, malicious: "x" };
    let caught: unknown;
    try {
      deserializeCodex(JSON.stringify(tampered));
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(CodexUnknownFieldError);
    expect((caught as Error).message).toMatch(/malicious/);
  });

  it("rejects when multiple unknown fields are present", () => {
    const tampered = { ...validEnvelope, foo: 1, bar: 2 };
    expect(() => deserializeCodex(JSON.stringify(tampered))).toThrow(
      CodexUnknownFieldError,
    );
  });

  it("preserves existing version-mismatch rejection after strict-shape check is added", () => {
    // Confirms strict-shape validation does not inadvertently suppress
    // the pre-existing version guard for malformed imports.
    const wrongVersion = { ...validEnvelope, version: "0.9" };
    expect(() => deserializeCodex(JSON.stringify(wrongVersion))).toThrow();
  });
});
