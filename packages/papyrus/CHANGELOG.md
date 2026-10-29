# Changelog

## 0.2.0 — 2026-10-29

**The multi-transaction vocabulary, lifted — and a correction to one of these modules made within
the hour it was written.**

Five modules move in, by v0.1.0's rule: only what has **zero host couplings, measured**. Their
imports before the lift were `@ouronet/talos-registry` and one host hook each, and the one host
thing they wanted was `PartitionMeta` — which is engine vocabulary, so it moved too.
`defpactPayer.ts` imported **nothing at all**.

### `partition.ts` — the registry's split judgement

`PartitionMeta`, `partitionOf`, `leafCount`, `registryCarriesPartitionData`, lifted out of
`OuronetUI/src/lib/signing/useGasLockIn.ts`. The host re-exports them, so its call sites are
unchanged — a re-export is one definition under two names, which is not the duplication this
package exists to end.

### `concurrency.ts` — how a multi-transaction run may be driven

`parallel` / `sequential-free` / `sequential-constrained`, read off `execution.partition`. Owner
ruling, 2026-10-28. `parallel` is returned only on POSITIVE evidence (`kind: "list"` **and**
`shape: "partition"`); every unrecognised shape classifies as sequential, because the two errors
are not equal — calling a parallel op sequential costs wall-clock time, while calling a
**sequential** op parallel invites firing N transactions whose batch N+1 depends on batch N.

Its header in OuronetUI said it belonged here and was not here yet, for a stated reason
(`PartitionMeta` lived in a host hook; the package is consumed published rather than linked). This
is that move.

### `defpactPayer.ts` — who pays a defpact's continuations

Owner ruling, 2026-10-29, verbatim: *"the answer is the payment key of the currently selected
Ouronet Account which was selected when triggering the defpact multistep transaction. The user has
to be warned about this that his payment key must contain sufficient stoa otherwise his
continuations may not happen and the execution may end up stranded."*

The gas station cannot do it. `DALOS.GAS_PAYER` binds `(at "exec-code" (read-msg))` **eagerly**,
and a `cont` payload has no such key, so the `at` raises before any check runs. **Step 0 is still
free** — it is an `exec` carrying code — so the asymmetry is the hazard: the expensive,
irreversible part of the operation starts gasless and finishes on the user's own STOA.
`stoa-xchain-gas` accepts a `cont` payload and caps at **850 gas**.

It counts `continuations = steps - 1`, not `steps`, because step 0 IS funded and charging for it
would overstate the requirement on every pact. And it **refuses** rather than only warning, which
is a stronger reading than the ruling asked for and is stated as such: `MTX-SWP` pacts are
PERISHABLE — the middle step enforces `(= prev-pool-state current-pool-state)` — so a user who
cannot pay for step 1 does not wait, the window closes and the pact is stranded for good. Two
liquidity additions were lost that way on 2026-10-15.

### `defpactTwin.ts` — and the correction that shaped it

**`partitionOf("TS01-CP.SWP|C_AddStandardLiquidity")` is `null`.** The first version of this module
concluded from that finding that a pact's length is recorded only on the SINGLE-SHOT entrypoint,
and indexed `partition.via`. The finding is true; the conclusion was not, and it was never
checked, because the `null` had already been explained.

**`execution.mode === "defpact"` and `execution.steps` are on the DOOR itself**, with an
`execution.continuation` block spelling out the payload and a `sponsorship` block whose own words
are *"Step 0 is sponsored; every later step is not."* — the owner's ruling, already written down by
the registry.

Measured against `@ouronet/talos-registry@2.10.0`: **10 entrypoints have `mode: "defpact"`; only 8
are named by an `architectural` partition's `via`.** The invisible two are
`TS02-C3.MTX-AQP|2|CC_Inject` and `TS02-C3.MTX-AQP|2|CC_SweepRevokeAnchor`.

**AND THE TEST PASSED**, which is the part worth keeping. It asserted
`allDefpactTwins().length === (count of architectural partitions)` — comparing the index against
its OWN FILTER, which it satisfies by construction. The population is now counted with a predicate
the index does not use, and a mutant restoring the `via`-only filter fails two assertions.

Two further measured facts it carries: **all ten defpacts are `supported: false`**, and they are
the only ten of 442 entrypoints that declare the flag at all — each naming a single-transaction
`preferInstead` with a byte-identical parameter list, because *"multi-step existed only for the old
150k block gas limit"*. And contradictions (a missing step count, a door disagreeing with its
partition) are **reported rather than resolved**, so the suite can assert there are none.

### `multistepSpec.ts` — the derivation

Every door's parameter list is identical to its single-shot twin's, so the multi-step variant of a
spec is that spec with ONE FIELD CHANGED — `fields`, `txData` and `previewValues` asserted to be
the **same objects**, not copies that could be edited apart. The identity is re-checked PER CALL,
because "identical today" is a measurement of a snapshot and not a contract; a mismatch returns
`null`, which a surface renders as "no multi-step form on chain" rather than a button that sends a
call the door does not declare.

`multistepParamMismatch` is exported so the refusal can be EXERCISED. Inside `multistepSpecOf` that
branch is unreachable against the real registry — the door is found by inverting `preferInstead`, so
the single-shot key is known by construction — and an unexercised refusal is indistinguishable from
a missing one.

### `tests/surface.test.ts` — the module set is stated ONCE

It spelled the module list three times (the imports, the runtime loop, the type loop), so five new
modules would have meant three places to remember. `MODULES` is now the single statement, and a new
assertion compares it against the **directory**, which is the one source neither list can fall
behind. It earned its keep immediately: `multistepParamMismatch` was added to `src/` and left off
the index, and this is what said so.

### A NEW PEER DEPENDENCY, and it is a real requirement rather than a formality

`@ouronet/talos-registry >= 2.10.0` joins `@stoachain/stoa-core` in `peerDependencies`. Three of
the five new modules import it AT MODULE LOAD, and `index.ts` re-exports them, so **importing
`@ouronet/papyrus` at all now requires the registry to resolve** — it is not reachable only by the
consumer who calls `defpactTwinOf`.

Said plainly because it is the kind of change that breaks a consumer silently. OuronetUI already
depends on `2.10.0`. **`@ouronet/ouronet-codex` does not depend on it at all**, so the Codex side
of the Papyrus work (P4) has to add it in the same commit that adds `@ouronet/papyrus` — checked
rather than assumed: codex's dependency list carries `dalos-crypto`, `kadena-stoic-legacy`,
`ouronet-core` and `stoa-core`, and no registry.

### Not here, and measured rather than promised

`contDriver.ts` (263 lines) — the one continuation SENDER in the ecosystem, extracted from
OuronetUI's recovery screen rather than rewritten — is portable after this release: its last host
import, `lib/gas-price.ts`, itself imports nothing but `@stoachain/stoa-core`. It is held back
because it would add `@stoachain/kadena-stoic-legacy` to this package's runtime surface, and
because it is the signing path and wants an integration harness this package does not have yet.

## 0.1.1 — 2026-10-28

**`planBatchesVerified` is exported. In 0.1.0 it was not, and that made it unreachable.**

`package.json` `exports` admits `"."` alone — a deliberate choice, so that the surface is one
curated list rather than whatever file layout `dist/` happens to have. The cost of that choice is
that `index.ts` is not documentation, it is the **boundary**: a symbol missing from it cannot be
imported by any path, no matter that it is sitting in `dist/batch.js` with its types alongside.

0.1.0's index exported `ProbeOutcome` and `VerifiedBatchPlan` — the argument type and the result
type of `planBatchesVerified` — and not the function between them. So the published surface
advertised a signature nobody could call. It was found the way these are always found: the first
consumer wired the package and its three batched flows had nothing to import.

- **`planBatchesVerified` re-exported**, with a comment saying what distinguishes it from the
  synchronous `planStakeBatches` it replaced: it probes candidate batches and returns a plan only
  when the plan's **largest** batch was simulated under the ceiling.
- **`tests/surface.test.ts`** — the index may REORDER and ANNOTATE, and may not OMIT. Runtime
  exports are compared as module keys, so there is no string matching to fool; types are compared
  as name sets parsed from sources with comments stripped first, because a name in prose is not a
  name exported. Both halves were mutation-checked: dropping the function fails two assertions,
  dropping a type fails one.

A curated list is worth keeping — it is the only place a reader learns the shape of a surface —
but a hand-kept list of an evolving module falls behind, and this is what makes it safe to keep.

## 0.1.0 — 2026-10-28

**The first slice of the Papyrus Engine, and deliberately a small one.**

The engine existed before this package did, and was implemented **three times across two
repositories** — `ZbomModal` in Codex, `RegistryOpCFMModal` in OuronetUI, and 28 bespoke modals
beside it. Nothing on screen said which one you were in, which is why it went a year unnoticed.
This package exists so that a change to how an Ouronet transaction is described, priced, signed
and reported is made once.

### What is here

- **the vocabulary** — the three members (Page, Roll, Leaf) and `PAPYRUS_VERSION`. A file with no
  imports at all. The Leaf was named 2026-10-28 for Smart Swap's dirty-read discovery popup: *"no
  zbom is used, but rather a small dirty read progress popup appears, then i click the sign, and
  the transaction executes."*
- **the batch planner** — `planStakeBatches`, `fitGasModel`, `solveBatchCount`,
  `planFromExceededProbe`, `perBatchPerNonce`. 538 lines importing nothing but
  `@stoachain/stoa-core`.

### What is NOT here, and why that is the point

Everything else in the engine still reaches into its host — a wallet context, a query cache,
redux, a toast library — about ten touchpoints across ~8,800 lines. **Lifting those before
inverting them would copy the engine rather than move it**, and a copy is what this package
exists to end. The extraction is phased in `PAPYRUS_ENGINE_SPEC.md`: P2 inverts the couplings in
place, where the consuming suite can prove behaviour is unchanged; P3 lifts what P2 has freed.

### Found by extracting

The package's tsconfig carries `noUncheckedIndexedAccess`, which OuronetUI's does not, so moving
the planner surfaced six index accesses the app had never held it to — including a `filter().map()`
pair that cannot be proven sound (rewritten as one `flatMap`) and a `reduce` seeded with
`batches[0]` where a zero-batch plan would have reached `undefined.length`. **An empty plan is now
refused rather than reduced over.** None of them was reachable in practice; all six are now
structurally impossible.
