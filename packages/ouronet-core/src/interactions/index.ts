// @ouronet/ouronet-core/interactions
//
// Pact builders + submit helpers for every on-chain action OuronetUI (and
// the future HUB backend) performs. Thirteen files in this directory — they
// have overlapping symbol names, so consumers should import from specific
// subpaths rather than via this barrel:
//
//   import { executeCoil } from "@ouronet/ouronet-core/interactions/wrapFunctions";
//
// IKadenaKeypair lives in @stoachain/stoa-core/signing — chain-generic key
// shape, not Ouronet-specific. v4.0.0 removed the Phase-2b backwards-compat
// re-declaration that previously lived in interactions/ouroFunctions.ts;
// consumers should import directly:
//
//   import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
//
// This barrel re-exports only ouroFunctions (the canonical source for
// IOuroAccountKeypair and the Ouronet-specific function-shaped types) for
// the convenience of any caller that wants just those.

export * from "./ouroFunctions.js";
