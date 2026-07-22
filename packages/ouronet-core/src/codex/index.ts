/**
 * @ouronet/ouronet-core/codex — portable Codex types + serialization
 * codec + seed-type migration.
 *
 * Three small pieces that every codex consumer (OuronetUI, future HUB,
 * any CLI/recovery tool) needs:
 *
 *   - `PlaintextCodex<...>` — generic in-memory shape. Consumer plugs
 *     its own wallet/account/keypair types via the type params.
 *   - `CodexExportV1_2` / `CodexExportV1_3` + `serializeCodex` /
 *     `deserializeCodex` / `buildCodexExport` — the backup-JSON codec.
 *     The writer now stamps `"1.3"`; the reader accepts both `"1.2"` and
 *     `"1.3"` (reader-before-writer discipline — see codec.ts JSDoc).
 *   - `SeedType` + `migrateSeedType` — the legacy↔canonical name
 *     mapping, idempotent. Was inlined in OuronetUI's WalletStorage
 *     before; lives here now so HUB doesn't have to rediscover it.
 *
 * Intentionally does NOT handle encryption. Each entry's `secret` field
 * inside a codex is already an encrypted blob at rest; serializing /
 * deserializing the codex doesn't touch those. For encryption see
 * `@ouronet/ouronet-core/crypto`.
 */

export type {
  PlaintextCodex,
  CodexExportV1_2,
  CodexExportV1_3,
  CodexForeignKeyV1_3,
  CodexForeignKeysBlockV1_3,
} from "./types.js";
export {
  buildCodexExport,
  serializeCodex,
  deserializeCodex,
} from "./codec.js";
export type { SeedType, RawSeedType } from "./seedTypeMigration.js";
export { migrateSeedType } from "./seedTypeMigration.js";
export { CodexUnknownFieldError, UnknownSeedTypeError } from "./errors.js";
