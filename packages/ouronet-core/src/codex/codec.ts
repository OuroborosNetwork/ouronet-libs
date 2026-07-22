/**
 * Codex serialization / deserialization — the shared codec between
 * OuronetUI's "Export Codex" button and any future consumer that reads
 * the same backup JSON (HUB's codex-import flow, CLI recovery tools,
 * etc.).
 *
 * The written format is now `CodexExportV1_3` — the `"version": "1.3"`
 * string. This was an INTENTIONAL 1.2→1.3 bump made under strict
 * reader-before-writer discipline: `deserializeCodex` was widened to
 * accept BOTH "1.2" and "1.3" (and to allow-list the optional
 * `foreignKeys` block) BEFORE this writer began stamping "1.3". That
 * ordering is what makes the bump safe — every previously downloaded
 * `OuronetCodex_*.json` (still "1.2") keeps importing, and every new
 * export ("1.3") deserializes through the same reader.
 *
 * Do NOT revert the writer to "1.2" in isolation, and do NOT narrow the
 * reader back to "1.2"-only: emitting a version the reader rejects (or
 * rejecting the version the writer emits) is a funds-loss inversion — a
 * user's own fresh backup would fail to restore. Any future format change
 * must keep the reader ahead of the writer.
 *
 * All pure. No password handling in here — the BYTES INSIDE the JSON are
 * already encrypted at the codex-entry level (each wallet's `secret` field
 * is a V1 or V2 blob). Serializing the codex doesn't touch those blobs;
 * it just wraps them in the portable envelope.
 */

import type {
  CodexExportV1_2,
  CodexExportV1_3,
  PlaintextCodex,
} from "./types.js";
import { CodexUnknownFieldError } from "./errors.js";

/**
 * Build a codex-export payload from a PlaintextCodex. Stamps the current
 * `"1.3"` envelope version and `exportedAt` with the current ISO time.
 * Returns the object — the caller stringifies it (so callers in a
 * memory-constrained environment can stream it out instead of holding the
 * whole string in RAM).
 *
 * The return type is the `CodexExportV1_2 | CodexExportV1_3` union so
 * consumers written against the historical 1.2 shape still type-check
 * against the widened output; the runtime value is always a 1.3 envelope.
 *
 * The optional `foreignKeys` block is EMITTED only when the source codex
 * carries foreign keys. ouronet's `PlaintextCodex` has no foreign-key
 * source field today, so the practical output is a bare 1.3 envelope with
 * `foreignKeys` omitted — no mandatory empty block.
 *
 * Fields left out intentionally: `pureKeypairs`, `schemaVersion`,
 * `lastUpdatedAt`, `lastUpdatedDevice` — see CodexExportV1_3 JSDoc for
 * the rationale (historical shape, device-local fields don't travel).
 */
export function buildCodexExport<
  KS, OA, PK, AB, UI,
>(
  codex: PlaintextCodex<KS, OA, PK, AB, UI>,
): CodexExportV1_2<KS, OA, AB, UI> | CodexExportV1_3<KS, OA, AB, UI> {
  return {
    version: "1.3",
    exportedAt: new Date().toISOString(),
    kadenaWallets: codex.kadenaWallets,
    ouronetWallets: codex.ouronetWallets,
    addressBook: codex.addressBook,
    uiSettings: codex.uiSettings,
  };
}

/**
 * Stringify a PlaintextCodex into the `"1.3"` backup JSON format, the
 * exact output of OuronetUI's LocalStorageCodexAdapter.downloadAsJson.
 * Pretty-prints with 2-space indent because the file lands on disk and
 * a human occasionally opens it to sanity-check account addresses.
 */
export function serializeCodex<
  KS, OA, PK, AB, UI,
>(
  codex: PlaintextCodex<KS, OA, PK, AB, UI>,
): string {
  return JSON.stringify(buildCodexExport(codex), null, 2);
}

/**
 * Parse a codex-export JSON string. Does NOT decrypt any enclosed blobs
 * — the returned object's `kadenaWallets[i].secret` etc. are still V1/V2
 * encrypted strings. Caller is responsible for decrypting them with the
 * codex password once they've validated the parse.
 *
 * Throws on:
 *   - invalid JSON
 *   - missing `"version"` field (malformed)
 *   - version mismatch (not `"1.2"`)
 *   - shape mismatch (kadenaWallets, ouronetWallets, addressBook not arrays; uiSettings not an object)
 *
 * The version check exists to fail-fast rather than silently mis-decoding
 * a future V2 export format. Callers that want best-effort partial reads
 * can catch the throw and fall through to a recovery path.
 *
 * Shape-validation errors NAME the offending field but never echo its
 * value — a codex envelope can carry encrypted secrets and account
 * addresses, and surfacing those into telemetry/logs would breach the
 * codec's information-disclosure boundary.
 */
export function deserializeCodex<
  KS = unknown,
  OA = unknown,
  AB = unknown,
  UI = unknown,
>(
  json: string,
): CodexExportV1_2<KS, OA, AB, UI> {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("deserializeCodex: not an object");
  }
  // Strict-equality membership only. No trim/normalize/prefix matching: a
  // version string that merely LOOKS like an accepted one (" 1.3 ", "1.3.0",
  // "1.3\n") must fail closed, so the reader never silently mis-decodes a
  // format it doesn't actually understand.
  const ACCEPTED_VERSIONS = new Set(["1.2", "1.3"]);
  if (!ACCEPTED_VERSIONS.has(parsed.version)) {
    throw new Error(
      `deserializeCodex: unsupported version ${String(parsed.version)} — expected "1.2" or "1.3"`,
    );
  }
  const KNOWN_TOP_LEVEL_FIELDS = new Set([
    "version", "exportedAt", "kadenaWallets", "ouronetWallets", "addressBook", "uiSettings", "foreignKeys",
  ]);
  const unknownFields = Object.keys(parsed).filter(k => !KNOWN_TOP_LEVEL_FIELDS.has(k));
  if (unknownFields.length > 0) {
    throw new CodexUnknownFieldError(
      `Codex envelope contains unknown top-level field(s): ${unknownFields.join(", ")}`,
    );
  }
  if (!Array.isArray(parsed.kadenaWallets)) {
    throw new Error("deserializeCodex: kadenaWallets must be an array");
  }
  if (!Array.isArray(parsed.ouronetWallets)) {
    throw new Error("deserializeCodex: ouronetWallets must be an array");
  }
  if (!Array.isArray(parsed.addressBook)) {
    throw new Error("deserializeCodex: addressBook must be an array");
  }
  if (
    typeof parsed.uiSettings !== "object" ||
    parsed.uiSettings === null ||
    Array.isArray(parsed.uiSettings)
  ) {
    throw new Error("deserializeCodex: uiSettings must be an object");
  }
  return parsed as CodexExportV1_2<KS, OA, AB, UI>;
}
