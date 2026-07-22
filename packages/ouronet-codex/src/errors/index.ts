// @ouronet/ouronet-codex/errors
//
// Typed error classes. See ./types.ts for the per-class docs.
//
// All extend the base CodexError so `e instanceof CodexError` is the
// catch-all discriminator. Each subclass adds structured fields relevant
// to its failure mode (e.g. CodexKeyMissingError carries publicKey +
// pureKeypairCount + derivedAccountCount).

export {
  CodexError,
  CodexLockedError,
  CodexKeyMissingError,
  CodexPrimeProtectedError,
  CodexPrimeSeedProtectedError,
  CodexKickstartError,
  CodexAdapterError,
  CodexImportError,
  CodexPasswordError,
  CodexMigrationError,
  CodexConsumerSettingsError,
  CodexIdentityError,
  CodexGuardError,
} from "./types.js";
