/**
 * Codex serialization / deserialization — the shared codec between
 * OuronetUI's "Export Codex" button and any future consumer that reads
 * the same backup JSON (HUB's codex-import flow, CLI recovery tools,
 * etc.).
 *
 * `deserializeCodex` accepts BOTH "1.2" and "1.3" (and allow-lists the
 * optional `foreignKeys` block). The writer currently stamps **"1.2"**.
 *
 * THE INVARIANT: the reader must stay ahead of the writer. Emitting a
 * version the reader rejects — or rejecting the version the writer emits —
 * is a funds-loss inversion, because a user's own fresh backup would fail
 * to restore. The reader is therefore always widened first, in a release
 * that ships everywhere, and only then does the writer advance.
 *
 * Why the writer sits at "1.2" while the reader already understands "1.3":
 * that is the mid-point of the migration, and it is deliberate. The reader
 * half shipped; the writer half has not, because the ecosystem is not yet
 * uniformly on a 1.3-capable reader — `@ancientpantheon/codex` still gates
 * on 1.2. A writer that ran ahead would produce backups that the user's own
 * other apps could not open. That is the exact inversion above, one step
 * removed.
 *
 * This writer's 1.3 output was a BARE envelope — ouronet's `PlaintextCodex`
 * has no foreign-key source field, so no `foreignKeys` block was ever
 * emitted. The only difference between its 1.2 and 1.3 output is the
 * version string itself, which is why holding at "1.2" costs no capability.
 *
 * TO ADVANCE THE WRITER TO "1.3": confirm every consumer resolves a core
 * whose reader accepts 1.3 (that is 4.3.6+ under the @ouronet scope), and
 * that `@ancientpantheon/codex` no longer rejects 1.3, then flip the
 * `version` literal below and ship it as a MINOR. Do not narrow the reader
 * at any point.
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
 * `"1.2"` envelope version and `exportedAt` with the current ISO time.
 * Returns the object — the caller stringifies it (so callers in a
 * memory-constrained environment can stream it out instead of holding the
 * whole string in RAM).
 *
 * The return type is the `CodexExportV1_2 | CodexExportV1_3` union so this
 * signature does not have to change when the writer advances to 1.3; the
 * runtime value today is a 1.2 envelope. See the file header for why the
 * writer trails the reader and what has to be true before it advances.
 *
 * The optional `foreignKeys` block belongs to the 1.3 shape and is never
 * emitted here — ouronet's `PlaintextCodex` has no foreign-key source
 * field — so the output carries no 1.3-only data and nothing is lost by
 * stamping 1.2.
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
    version: "1.2",
    exportedAt: new Date().toISOString(),
    kadenaWallets: codex.kadenaWallets,
    ouronetWallets: codex.ouronetWallets,
    addressBook: codex.addressBook,
    uiSettings: codex.uiSettings,
  };
}

/**
 * Stringify a PlaintextCodex into the `"1.2"` backup JSON format, the
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
 *   - version mismatch (neither `"1.2"` nor `"1.3"`)
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
