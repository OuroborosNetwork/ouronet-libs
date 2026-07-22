/**
 * Typed error for shape mismatches in Kadena RPC envelopes.
 *
 * Mirrors `InvalidEnvelopeError` (stoa-core/signing/partialSig.ts): extends
 * Error (NOT TypeError — TypeError is reserved for input-validation seam
 * errors), uses ES2022 Error.cause for original-envelope propagation.
 */
export class KadenaShapeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KadenaShapeError";
  }
}
