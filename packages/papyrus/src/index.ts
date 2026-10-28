/**
 * `@ouronet/papyrus` — THE PAPYRUS ENGINE.
 *
 * One engine turns *"a user pressed a button"* into *"a transaction is on chain and reported"*:
 *
 *     hover hint → Papyrus (price · simulate · lock in · split) → sign → submit → toast
 *
 * It existed before this package did, and was implemented THREE times across two repositories —
 * `ZbomModal` in Codex, `RegistryOpCFMModal` in OuronetUI, and 28 bespoke modals beside it. The
 * full specification, the measured history and the phased extraction live in
 * `OuronetUI/docs/PAPYRUS_ENGINE_SPEC.md`.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IS HERE, AND WHY IT IS NOT YET THE WHOLE ENGINE
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * This is v0.1.0 and it deliberately carries only what has **zero host couplings today**,
 * measured rather than assumed:
 *
 *   - **the vocabulary** (`kind.ts`) — the three members of the family and the engine's own
 *     version. Zero imports of any kind.
 *   - **the batch planner** (`batch.ts`) — plan, fit, verify and split a multi-transaction run.
 *     538 lines importing nothing but `@stoachain/stoa-core`.
 *
 * The rest of the engine still reaches into its host for a wallet context, a query cache, redux
 * and a toast library — ~10 touchpoints over ~8,800 lines. Lifting those before inverting them
 * would not move the engine; it would COPY it, and a copy is the thing this package exists to
 * end. §4.3 of the spec measures each one; P2 inverts them in place, where the consuming suite
 * can prove behaviour is unchanged, and P3 lifts what P2 has freed.
 *
 * So the honest description of v0.1.0 is: **the parts that were already portable, plus the name.**
 * The version here is what a Papyrus badge displays, so publishing it is what makes that badge
 * report a real artefact instead of a local constant.
 */
export {
  PAPYRUS_VERSION,
  PAPYRUS_COPY,
  type PapyrusKind,
} from "./kind.js";

export {
  // Planning a run before any of it is signed.
  planStakeBatches,
  evenSplit,
  solveBatchCount,
  type StakeBatchPlan,
  // Fitting the chain's own gas behaviour from measured samples.
  fitGasModel,
  type GasModel,
  type GasSample,
  // Recovering from a refusal that names a ceiling.
  isGasLimitExceededMessage,
  planFromExceededProbe,
  type ProbeOutcome,
  type VerifiedBatchPlan,
  // Splitting a per-nonce argument so a batch's Nth slice carries the Nth values.
  perBatchPerNonce,
  // Ceilings and thresholds the planner reasons against.
  safeBatchGasCeiling,
  nodeProbeCeiling,
  QUICK_PREFILTER_NONCE_COUNT,
  WORST_KNOWN_CALIBRATED_PER_NONCE,
} from "./batch.js";
