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
 * and a toast library, across ~8,800 lines in nine files. Lifting those before inverting them
 * would not move the engine; it would COPY it, and a copy is the thing this package exists to
 * end. §4.3 of the spec measures each one; P2 inverts them in place, where the consuming suite
 * can prove behaviour is unchanged, and P3 lifts what P2 has freed.
 *
 * (This said "~10 touchpoints" until 2026-10-28. The count was of call sites of four named
 * facilities, and it missed react, host components and every transitive edge — which made four
 * of the nine files read as portable when none of them are. The spec's table is measured by a
 * test now, not maintained by hand.)
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
  // Planning by MEASUREMENT: probe candidate batches and return only a plan whose largest
  // batch was simulated under the ceiling. This is the planner the batched flows actually
  // call; `planStakeBatches` above is the synchronous ESTIMATOR it replaced.
  planBatchesVerified,
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

/**
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * v0.2.0 — THE MULTI-TRANSACTION VOCABULARY, and driving a defpact
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * Everything below was written in OuronetUI during the Papyrus migration and lifted here on
 * 2026-10-29, by the same rule v0.1.0 used: only what has ZERO HOST COUPLINGS, measured. Their
 * imports were, before the lift, `@ouronet/talos-registry` and one host hook each — and the one
 * host thing they wanted was `PartitionMeta`, which is engine vocabulary and so moved too.
 *
 * `defpactPayer.ts` imported NOTHING AT ALL, which is as portable as a file gets.
 *
 * WHAT IS STILL NOT HERE, and the measurement rather than a promise: `contDriver.ts` (263 lines)
 * is the one continuation SENDER in the ecosystem, and it is portable after this release — its
 * remaining host import, `lib/gas-price.ts`, itself imports nothing but `@stoachain/stoa-core`.
 * It is held back because it would add `@stoachain/kadena-stoic-legacy` to this package's runtime
 * surface and because it is the signing path, which wants an integration harness this package
 * does not have yet. That is a decision, not an oversight; see the CHANGELOG.
 */
export {
  // THE REGISTRY'S SPLIT JUDGEMENT. The host re-exports these so its call sites are unchanged.
  partitionOf,
  leafCount,
  registryCarriesPartitionData,
  type PartitionMeta,
} from "./partition.js";

export {
  // THE JUDGEMENT APPLIED. Cutting a fed slice honours axis, lockstep AND groupBy together --
  // each one failed alone is a different silent defect, and none of the three fails loudly.
  sliceFedArgs,
  type FedSlice,
  type SliceOutcome,
} from "./fedslice.js";

export {
  // HOW A MULTI-TRANSACTION OPERATION MAY BE RUN — parallel, sequential-free,
  // sequential-constrained. Owner ruling 2026-10-28.
  concurrencyOf,
  type Concurrency,
  type ConcurrencyVerdict,
} from "./concurrency.js";

export {
  // WHO PAYS A DEFPACT'S CONTINUATIONS. Owner ruling 2026-10-29: the payment key of the
  // currently selected Ouronet account. The gas station CANNOT — `DALOS.GAS_PAYER` binds
  // `exec-code` eagerly and a `cont` payload has none.
  defpactPayerVerdict,
  ASSUMED_STEP_GAS,
  type DefpactPayerInput,
  type DefpactPayerVerdict,
} from "./defpactPayer.js";

export {
  // IS THIS ENTRYPOINT A DEFPACT, AND HOW MANY STEPS? Read off `execution.mode`/`execution.steps`
  // on the DOOR — not off the single-shot's `partition.via`, which reaches only 8 of the 10.
  defpactTwinOf,
  defpactStepsOf,
  defpactDoorFor,
  allDefpactTwins,
  defpactIndexProblems,
  __resetDefpactIndex,
  type DefpactInfo,
  type DefpactIndexProblem,
} from "./defpactTwin.js";

export {
  // THE MULTI-STEP VARIANT OF A SPEC, DERIVED — every door's parameter list is identical to its
  // single-shot twin's, so it is one field changed rather than a second spec.
  multistepSpecOf,
  multistepProblemsFor,
  // The parameter comparison, exported so the REFUSAL can be exercised: inside
  // `multistepSpecOf` that branch is unreachable against the real registry, and an unexercised
  // refusal is indistinguishable from a missing one.
  multistepParamMismatch,
  type RepointableSpec,
  type MultistepDerivation,
  type MultistepProblem,
} from "./multistepSpec.js";
