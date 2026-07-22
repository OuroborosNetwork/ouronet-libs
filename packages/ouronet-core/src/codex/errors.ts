/**
 * Typed errors for codex validation. Covers strict-shape enforcement on
 * deserialized codex payloads and seed-type migration input validation.
 *
 * Both classes follow the ES2022 Error.cause pattern mirroring WrongPasswordError
 * in stoa-core/src/crypto/errors.ts. `this.name` is set explicitly so
 * error-name-based branching works regardless of bundler minification.
 */
export class CodexUnknownFieldError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CodexUnknownFieldError";
  }
}
export class UnknownSeedTypeError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UnknownSeedTypeError";
  }
}
