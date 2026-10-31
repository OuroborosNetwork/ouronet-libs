# Changelog

## 0.3.0 — 2026-10-29

**`groupBy` reaches the type, and `sliceFedArgs` applies the whole judgement.**

> **Published 2026-10-31 against `@ouronet/talos-registry@2.12.0`, and the registry moved under
> the tests between authoring and release.** V18 took `AQP-POOL|CCp_BatchDrain*` to the admin
> band, which the registry does not index, and added `AQP-EVCT|CCp_EvictMultiRewards`. So the
> population is now **441 entrypoints, 34 partitioned** (was 442/36) and the verdict tally is
> **20 parallel / 6 sequential-free / 8 sequential-constrained** (was 22/6/8) — three losses and
> one gain, re-read against the new data rather than adjusted to fit.
>
> The DRAIN family named below is therefore **no longer on this surface**, and the test that
> asserted its ungrouped-ness was failing on its FIRST line (`carries no partition block`)
> rather than on its claim — a test that cannot reach its own assertion. The contrast now runs
> against `CCp_EvictMultiRewards`, which is live and the same shape, and it gained the two
> assertions it was missing: `groupBy: undefined` is ALSO what an entrypoint with no partition
> block reports, so `kind` and `axis` are pinned too. That is what separates *"cut anywhere"*
> from *"do not cut at all"*.
>
> The reasoning in the section *"Why it matters for the vacate family specifically"* is
> unchanged and still true of the admin wrappers — the Talos doc calls them byte-for-byte their
> `CCp_` predecessors with a gasless patron in slot 0.

A judgement the registry carried correctly was invisible to every consumer that read it through
this package. That is the defect; the splitter is the fix.

### The field that was published and untyped

`PartitionMeta` declared `kind`, `shape`, `axis`, `lockstep`, `inner`, `rounds`, `via`,
`progress`, `steps` and `reason`. It did not declare **`groupBy`** — a boundary a cut may not fall
inside — which `Deploy/OURONET-REGISTRY.json` carries on three entrypoints:

```
AQP-POOL|CCp_BatchVacate{TrueFungible,OrtoFungible,Collectables}   groupBy: "beneficiary-ids"
```

It is authored deliberately, validated by the Pact repo's `_registry.py --check` (is it a
parameter, is it a list, is it the axis or one of its lockstep members), and published into the
artefact. So `partitionOf(key)` returned it at RUNTIME while the interface said it did not exist,
and a splitter written from this type would honour `axis` and `lockstep`, cut wherever it liked,
and be wrong in exactly the place the field exists to protect.

**OuronetUI's own changelog said as much when the field shipped** — *"`groupBy` constrains WHERE a
cut may fall, which neither `axis` nor `lockstep` could express — and without it the splitter
would cut exactly where the vacate is unsound."* The knowledge was recorded in one repo, enforced
in another, and absent from the type between them.

### Why it matters for the vacate family specifically

`XI_1|Vacate*UnwindFromLegs` calls the per-beneficiary unwind once per unique beneficiary **in
that slice, UNGATED**, fed that slice's partial sum. Two of its six legs are genuinely
delta-based and add up correctly; the other four are a settle triple that would fire **once per
SLICE instead of once per BENEFICIARY**.

The sibling DRAIN family gates that same triple behind `UR_AQP|UserUnn == 0`, so it fires once
however the legs are cut. **That asymmetry is the evidence for both halves**, which is why the
drain blocks carry no `groupBy` and are safe to cut anywhere — and why a test here asserts their
*absence* as well as the vacate family's presence.

### `sliceFedArgs(meta, args, requested)`

Cuts one argument map into at most `requested` slices, honouring `axis`, `lockstep` **and**
`groupBy` together. Each failed alone is a different silent defect:

| ignored | what happens | detectable downstream? |
|---|---|---|
| `axis` | a wrong parameter is cut; the whole list is sent N times | no |
| `lockstep` | two equal-length arrays, misaligned — wrong amount to wrong nonce | no |
| `groupBy` | the cut falls mid-group; an ungated per-group write runs per SLICE | no |

So the judgement is not re-derived per consumer. Non-positional arguments (`patron`, `pool-id`,
the asset id) are copied into every slice unchanged.

**Grouped by VALUE, not by adjacency.** A preflight is free to interleave two beneficiaries' legs;
grouping contiguous runs would then split one across slices *while appearing to have grouped*. The
test fixture is deliberately `b1,b2,b1,b2`, and the adjacency mutant dies on it.

**Refusal is a result, not an exception.** The registry's default is *absence means DO NOT SPLIT*,
so every reason returns a sentence: unclassified, cursor (naming the pager and its sequencing),
architectural (naming the twin), reduction (parallel within a round, sequential between),
axis-less, axis-not-a-list, empty axis, and a lockstep length mismatch reported with both counts.
A caller handed one slice back from an unclassified operation has been told it may fan out when it
may not.

### Tests

`tests/fedslice.test.ts`, 22 cases. Four mutants, all dead: `groupBy` ignored (3 failures),
grouping by adjacency (3), lockstep not permuted with the axis (4), lockstep length check dropped
(1). Three of the cases read the REAL bundled registry rather than fixtures — presence on all
three vacate blocks, absence on all three drain blocks, and one real block cut end to end —
because the gap being closed was a type that had drifted from the data, and fixtures cannot see
that.

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

### THE FIRST `v0.2.0` TAG FAILED ITS GATE, and the reason is this dependency

`@ouronet/papyrus` typechecks against `@ouronet/talos-registry`'s EMITTED DECLARATIONS, and the
root `typecheck` script ran `npm run typecheck --workspaces` — whose order put papyrus **before**
talos-registry. In CI, on a fresh checkout, `packages/talos-registry/dist` does not exist yet, so
papyrus reported `TS2307: Cannot find module '@ouronet/talos-registry'` three times in `src/` and
three more in `tests/`, plus a cascade of `TS7006` implicit-anys from the untyped import.

**It passed locally and would have gone on passing**, because `dist/` was already sitting there
from an earlier build — the classic shape of a build-order bug: the machine that has done the work
before cannot see it. The workflow's own `Typecheck + Build + Test` step carries a comment saying
*"Build precedes test so any dist-resolved imports exist"*; the same reasoning now applies to
typecheck, and did not.

Fixed by making the root `typecheck` script build that one package's declarations first:

    "typecheck": "npm run build:ci --workspace=@ouronet/talos-registry && npm run typecheck --workspaces"

Explicit rather than relying on the workflow reordering its steps, because a fresh local clone has
exactly the same problem and a CI-only fix would leave it there.

**NO npm VERSION WAS BURNED.** The gate runs before npm sees a byte, which is the second time this
month that ordering has saved a release — the first was `talos-registry@2.10.0`, stopped by the
docs-parity check for a missing CHANGELOG entry.

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
