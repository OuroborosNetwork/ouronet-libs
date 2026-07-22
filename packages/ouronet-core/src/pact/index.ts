// @ouronet/ouronet-core/pact
//
// Ouronet-specific Pact-code builders. The 23 OuronetUI CFM modals
// import these to build the exact Pact-function-call strings their
// `strategy.execute({ build })` calls hand to the chain.
//
// Pure formatting helpers (formatDecimalForPact, mayComeWithDeimal,
// safeCreationTime, etc.) live in @stoachain/stoa-core/pact — chain-
// generic, reusable across any Pact-based project.

export * from "./cfmBuilders.js";
