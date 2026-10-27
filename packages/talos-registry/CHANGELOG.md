## 2.5.0 — 2026-10-27

**`execution.partition` — whether an operation may be split across transactions,
and along which parameter. Absence means do not split.**

`surfaceHash` `473598a1536ce019` → `65c983178cb70985`. **442 entrypoints and 447
previews, both unchanged** — no call gained, lost or altered a parameter. The
hash moved because twenty entries gained a new `execution.partition` block.

**2.4.1 WAS NEVER PUBLISHED.** It is committed, and npm went `2.4.0` → `2.5.0`.
Its content is included here: the 103 preview module hashes from the `AQP-INFO`
redeploy and the 89 ownership-clause reorderings, all with identical required
account sets. Folding rather than publishing twice, since nothing consumed 2.4.1.

### Added — `execution.partition`, and `splitPlan` / `splitCall`

A client splitting a large call needs two different facts, and only one of them
is in the registry:

| question | answered by |
|---|---|
| does this call NEED splitting? | **simulation** — gas is state-dependent, per selection, per block |
| may this call BE split at all? | **this field** — a property of the operation, fixed by its contract |

Neither can answer the other. A simulation cannot tell you that halving a
liquidity deposit prices it differently; this field cannot tell you that today's
420 nonces bust the budget.

**ABSENCE MEANS DO NOT SPLIT.** 16 of 442 entries carry a block; the other 426
are UNCLASSIFIED, and `splitCall` throws on them rather than defaulting to
allow. That default is the entire safety property — a wrong permission silently
converts an ATOMIC operation into a partially-applied one, and nothing
downstream can detect it. 105 entrypoints take a list parameter, so list-ness is
not the question; a reading of the operation is.

**TWO SHAPES, not one boolean.** `partition` means cutting the axis yields
pieces whose combined effect equals the single call — one round, submit
together. `reduction` means each piece yields a NEW intermediate that must be
fed back in: merging 860 nonces 123 at a time leaves 7, which are merged again.
Parallel WITHIN a round, strictly sequential BETWEEN rounds, and the next
round's arguments **do not exist** until the current one lands, because
`VST.XIv_MergeNonces` mints at `(+ 1 nonces-used)`.

One boolean would collapse those, and this project has already paid for that
exact conflation: the `p` recipe suffix was overloaded to mean
"multi-transaction" rather than "parallel", and a strictly sequential cursor
pager ended up wearing a prefix promising parallel safety
(`StoicSyntax-Prefixes.md`, CORRECTION 2026-09-14).

**`lockstep` is orthogonal to both** — the parameters POSITIONAL against the
axis, cut with it. This is the quiet failure: two arrays that line up by LENGTH
and are misaligned move the wrong amount to the wrong place, and the contract
cannot object. `splitCall` derives companion slices from the axis boundaries
once, so they cannot drift by even one element, and **refuses a length mismatch
rather than padding or truncating** — the tempting repair is precisely what
produces a misaligned pair.

`splitCall` exists because the alternative is what the consuming app actually
did: four components each hand-rolling the same cut with parameter names written
as string literals, and a fifth call site (collectable unstake) with no cut at
all because nobody noticed it was missing.

### Added — a SECOND splittable level, `inner`

Cutting the outer axis of a multi-bulk transfer yields fewer TOKENS per
transaction and does nothing about one token carrying 1,000 recipients. Owner,
2026-10-27: *"if i add a manifest for 100 tokens, each with 1000+ recipients,
the UI should be able to create as many individual txes as needed."* That is
100,000 legs, and one dimension cannot express it — splitting the token axis
alone gives 100 single-token calls of 1,000 legs each, every one still far too
large.

So `partition.inner` names the outer companions whose PER-ELEMENT arrays are cut
as well, and **the unit became the LEAF leg**: a 2-token call whose tokens hold
900 and 100 recipients is a 1,000-leg transaction, not a 2-leg one. Sizing by
outer length is precisely the mistake that makes "split it in two" produce one
transaction that still does not fit.

`splitCallByCapacity(key, values, capacity)` is the function a manifest needs.
It packs whole outer elements while the running leaf total fits, and emits an
oversized element ALONE with its inner arrays cut into `ceil(legs / capacity)`
pieces. Order is preserved throughout, so concatenating every emitted call
reproduces the input exactly — chosen over an optimal bin-pack deliberately:
being able to read the plan back against what the user submitted is worth more
than the occasional saved transaction. `capacity` comes from MEASUREMENT and
never from the registry.

The invariant that makes a hand-written nested declaration checkable: every
`inner` name must be a NESTED list (`[[...]]`) **and** must already be the outer
axis or one of its outer companions. An inner axis pointing at a list that is
not indexed by the outer one cuts along the **wrong dimension**, and every
resulting transaction would be internally consistent and wrong. Eight new check
rules, each negative-tested.

Six entries gained a second level: `DPTF|C_MultiBulkTransfer` (recipients within
a token), and `DPOF`/`DPSF`/`DPNF`/`DPDC` `C_BulkTransfer` plus
`DPDC|C_MultiTransfer` (nonces within a recipient or a token).

### Added — four Hydra fed slices that had no axis

`CCp_BackfillScoreSlice`, `Cp_DrainScoreSlice`, `CCp_FvtFixSlice`,
`CCp_StakeSpecialCustodial`. All four are `indirect-parallel`, so the registry
already said their slices are order-independent — but **not which parameter is
the slice**, which a consumer needs before it may cut one. The consuming app was
already cutting `CCp_FvtFixSlice`'s `users` from a hardcoded parameter name.

Each is justified from the contract's own `INFO_` text rather than inspection:
*"PRICED PER HOLDER, matching the execution path exactly"*, *"the sequential
fixer it parallelises"*, *"IDENTICAL IGNIS TO AN ORDINARY ORTO STAKE … the SAME
phase chain"*.

### Held — six AQP batch drain/vacate slices, deliberately unclassified

`CCp_BatchDrain{TrueFungible,OrtoFungible,Collectable}` and
`CCp_BatchVacate{TrueFungible,OrtoFungible,Collectables}` look like clean
per-leg fan-outs and are not obviously so. `BatchDrain`'s own `INFO_` reads
*"settle-on-last-drain only for beneficiaries fully drained THIS ROUND (live
UserUnn)"* — a **cross-leg condition**, so splitting one beneficiary's legs
across two transactions changes when, or whether, the settle fires. The vacate
trio carries a *"per-beneficiary score unwind"* with the same open question.

It probably converges, since `UserUnn` reaches zero only after the last leg
whichever order they land in. "Probably converges" is not the standard for a
permission that silently turns an atomic operation into a partially-applied one,
and these are the ops that move staked assets out of a pool. Unclassified costs
a client nothing today: the slice still comes from the `URH_` preflight that
already bounds it.

### Unchanged by design

`Cp_WipeSlice` (×3) gets no block — its slicer is ON CHAIN
(`URHC_BuildWipeSlicePlan`, named in `fedParams.slicedBy`), so a client asks for
slices rather than inventing them. The three cursor pagers
(`CCp_SweepRecomputeChunk`, `CCp_InjectFixChunk`, `CCp_UnstaleAll`) get none
either: they take a chunk SIZE, not a list, and firing two concurrently races
the stored cursor — a partition block there would be a licence to do the one
thing they forbid.

### Classified — 20 entrypoints

**Partition (12):** `DPTF|C_BulkTransfer`, `C_MultiTransfer`,
`C_MultiBulkTransfer`; `DPOF`/`DPSF`/`DPNF`/`DPDC` `C_BulkTransfer`;
`DPDC|C_MultiTransfer`; and the four AQP collectable stake/unstake calls.

**Reduction (4):** `VST|C_Merge`, `C_Slumber`, `C_RepurposeMerge`,
`C_RepurposeSlumber` — all four route through `XIv_MergeNonces`, which wipes the
inputs and mints ONE nonce carrying the amount-weighted mean unlock time.

Rounds are **exact, not approximate**: the weight is
`Σ(balance × stu) / Σbalance`, a true weighted mean, and round 1 mints an
ABSOLUTE release date, so wall-clock passing between rounds does not shift it.
The only drift is `floor()` to whole seconds, once per round, under a second
each.

**`C_MultiBulkTransfer` has TWO valid axes** and only the outer is declared.
Splitting by `id-lst` cuts whole tokens out, keeping each token's recipient set
intact. Splitting one token's `executee-array` across transactions is also
sound, and is deliberately NOT declared, because which a client should prefer is
a product decision — and an undeclared axis is safer than a guessed one.

**Deliberately unclassified: the SWP liquidity and pool-issue ops.** Their legs
are priced against pool state an earlier batch has already moved, and the 40%
deviation ceiling is evaluated per call, so a split is a *different* operation
rather than a finer-grained one. They have 3-step defpact twins for exactly
this, reachable through `preferInstead`. A test asserts they stay unclassified.

### Verified

The claim is hand-authored, in `OURONET-REGISTRY.authored.json`, alongside ghost
values and for the same reason: a contract states that a parameter is a list,
never that cutting it is equivalent. The SEMANTIC half is a human reading and is
attributed as one, in `reason`.

The SHAPE half is mechanical and is checked. `_registry.py --check` is fatal in
the gate and rejects: an axis that is not a parameter, an axis or companion that
is not list-typed, a companion repeating the axis, a bogus shape, a reduction
with no `rounds`, a partition WITH `rounds`, a missing `reason`, an authored
block that failed to merge — and **ORPHANS**, an entry naming an entrypoint that
no longer exists. That last rule is borrowed rather than invented:
`_patronslots.py` carried five entries that had outlived their sites, and
because a vanished site is simply skipped by a scan, they were never consulted
again while the tool reported success. All eleven rules were negative-tested by
breaking the data and watching the check fail.

18 new tests; all seven mutations of the splitter were verified to fail it,
including the two that matter most — unclassified defaulting to splittable, and
a length mismatch being truncated instead of refused.

## 2.4.1 — 2026-10-27

**The V15/V16 surface: no API change, and two kinds of stale metadata that no
guard in either repo could see.**

Regenerated from the chain after V15 (multiplet collect optimisation) and V16
(`FVT|C>UNSTALED` events) deployed. **442 entrypoints and 447 previews, both
unchanged** — neither round added or removed a client-facing call. `surfaceHash`
`56f3f7f008117146` → `473598a1536ce019`.

### Changed — 103 preview module hashes

`AQP-INFO` was redeployed, so every preview that lives in it carries a new
`moduleHash`. Nothing about what they compute moved; the hash is how a client
knows the module it is pricing against is the one it was told about.

### Changed — 89 entrypoint ownership orderings

Across all seven Talos modules (TS01-C1 22, TS02-C1 21, TS02-C2 21, TS02-C3 20,
TS01-C3 3, TS01-C2 1, TS01-C4 1), the `ownership.requires` list is reordered to
put `patron` first, following the patron/executor/executee position canon.

**The required account SET is identical in all 89 — verified, not assumed.**
Comparing the published 2.4.0 tarball against this snapshot: 89 differ, 89 have
the same set of accounts, 0 have a different one. So no client has to collect a
signature it was not already collecting, which is what makes this a PATCH rather
than a breaking change. The per-requirement field churn (`via`, `subject`,
`reader`, `meaning`) is the consequence of comparing position by position after a
reorder, not independent drift.

### Why this sat unpublished

Both guards on the registry artefact compare it to a **copy of itself**:
`sync-registry.mjs --check` diffs the package snapshot against
`Deploy/OURONET-REGISTRY.json`, and `_pkgsync.py` does the same from the other
side. The artefact had been regenerated, the package snapshot synced from it, and
both then reported "in sync" — truthfully, and about the wrong question.
`_registrylive.py` asks the chain but covers the twelve module **hashes**, all of
which were genuinely current. **Nothing in either repo compares the snapshot to
what is on npm**, so a published package can be arbitrarily stale while every
check passes.

What settled it was `npm pack @ouronet/talos-registry@2.4.0` and a semantic diff
against the working copy. Until a guard does that automatically, treat
"in sync" as "the two local copies agree".

## 2.4.0 — 2026-10-25

**The Ouronet V14 surface: two one-way latches, and a preview that should have shipped with V13.**

Regenerated from the chain (`_registry.py --probe`) after V14 deployed.
**439 → 442 entrypoints, 444 → 447 previews.** `surfaceHash`
`77a4205182ce2954` → `56f3f7f008117146`.

### Added entrypoints

- `TS02-C3.AQP-FVT|CC_LatchStreamEligible` — the FVT-level stream-eligibility
  latch. Heavy: it scans every enabled member and refuses while any one of them
  is not drift-locked. One-way.
- `TS02-C3.AQP-SCR|C_LockScoreDrift` — the score-level drift latch, settable
  only while `deb-boost` is false **and** `boost-class-link` is BAR. One-way.
- `TS02-C3.AQP-FVT|C_SetMinInjectAmount` — **not new on chain.** It shipped in
  V13 with no `INFO_` reader, so the registry carried it as an entrypoint a
  client could not price, and `generate-execution-specs.py` skipped it with "no
  INFO preview". V14's `INFO_AQP-FVT|SetMinInjectAmount` closes that, and it
  enters this snapshot previewable for the first time.

### Added previews

- `AQP-INFO.INFO_AQP-SCR|LockScoreDrift`
- `AQP-INFO.INFO_AQP-FVT|LatchStreamEligible`
- `AQP-INFO.INFO_AQP-FVT|SetMinInjectAmount`

Each was measured against what the chain actually charged, not merely asserted:
predicted 9.54 / 14.84 / 32.33 against real 9.5400 / 14.8400 / 32.3300.

### Why the latches exist

`CC_InjectStream` could open a stream over a **stale** membership. The drip
divides by the stored `total-deb-score` mirror and pays each member against
their stored deb for the stream's whole duration — with no fix loop and no
freshness enforce — so a mis-split persisted for the life of the stream and was
never corrected retroactively. Rather than add a scan at drip time (gas on a
path that deliberately has none), the invariant moved to two one-way latches
proven once at latch time and kept true at every later admission.

**Consumers gain three callable entrypoints and three previews.** Nothing was
removed; no existing signature changed.

## 2.3.1-0 — 2026-10-14

**No functional change. This release exists to activate OIDC trusted publishing.**

2.3.0 was published from CI on a bootstrap token, not through the trusted
publisher, because the workflow filename in the OIDC claim did not match the one
the connection was created with (`publish.yaml` against `publish.yml`). npm
refuses a mismatch with "OIDC token exchange error - package not found", which
names neither the file nor the mismatch, and the connection stayed "Pending
validation" because no publish had ever arrived through it.

With the names agreed, the exchange endpoint returns `201 Created` and a live
token for this repository's workflow. Validating that requires a publish through
the publisher, and a published version cannot be republished -- hence a
prerelease rather than a second attempt at 2.3.0.

**Tagged `next`, deliberately, so `latest` stays 2.3.0.** npm applies `latest` to
whatever it publishes unless told otherwise, prerelease or not; consumers
resolving `@ouronet/talos-registry` are unaffected by this version and should not
install it.

## 2.3.0 — 2026-10-14

**The reassign-beneficiary surface moved, and this package had not caught up.** Re-synced
against mainnet (surface `6759484a5916ba4c` → `77a4205182ce2954`, 438 → 439 entrypoints,
443 → 444 previews):

- `AQP-POOL|CCp_ReassignOrtoStakeBeneficiary` and `AQP-POOL|CCp_ReassignCollectableStakeBeneficiary`
  (the Hydra multi-tx recipe shape) are GONE, replaced one-for-one by plain, single-transaction
  `AQP-POOL|CC_ReassignOrtoStakeBeneficiary` / `AQP-POOL|CC_ReassignCollectableStakeBeneficiary` —
  the recipe shape was never warranted for these; see the sovereign repo's own patron-slots /
  executor-canon notes for why.
- NEW: `AQP-POOL|CC_ReassignTrueFungibleStakeBeneficiary`, the true-fungible counterpart that
  did not exist before, plus its preview `AQP-INFO.INFO_AQP-POOL|ReassignTrueFungibleStakeBeneficiary`.

**Why a minor bump, not a patch.** Two public entrypoint names disappeared (renamed, not merely
added-alongside), which is consumer-breaking for anyone who had built against the `CCp_` names.
No published version of this package ever carried them as deployed-and-callable in production
use beyond the sovereign repo's own direct chain calls, so the practical blast radius is believed
to be zero — recorded as a minor rather than a patch anyway, because "believed to be zero" is not
the same claim as "is zero".

**The surface hash moved twice before this shipped, and only the last one is in the data.** An
intermediate build carried `03e494c800f38a5e`; it was never published. A module hash is part of
every entry's provenance, so ANY redeploy of a module moves the surface hash even when no name,
parameter or type changes — and between that build and this one, the sovereign `PureV11` round
redeployed `TS02-C3` (plus `AQP-INFO` and `AQP-BOOT`, its two dot-pinned callers) to remove 14
redundant `@event` annotations from Talos capabilities that merely forward to an already-evented
core capability. **No entrypoint, parameter list or type in this package changed as a result** —
only the hashes under `provenance`. Confirmed live the same day: `_registrylive.py` records
`verifiedAt 2026-10-14`, surface `77a4205182ce2954`.

**Published only after** OuronetUI's full True-Fungible/LP unstake flow — including Change
Beneficiary against these three calls — was wired and verified end to end against a local link of
this exact package.

## 2.2.1 — 2026-10-12

**15 entrypoints deployed on-chain were never synced into the published package.** Re-running
`REPL/tools/_registry.py --probe` against mainnet picked up everything landed since the last sync
that this package never carried: `AQP-FVT|CC_ClearPoolSweep`, `AQP-FVT|CCp_FvtFixSlice`,
`AQP-POOL|CC_FinalizeScoreRevoke`, `AQP-POOL|CC_UpdateScoreMultipliers`, the four
`AQP-POOL|CC_Vacate*` ops (TrueFungible/OrtoFungible/SemiFungible/NonFungible),
`AQP-POOL|CCp_BackfillScoreSlice`, `AQP-POOL|CCp_ReassignCollectableStakeBeneficiary`,
`AQP-POOL|CCp_ReassignOrtoStakeBeneficiary`, `AQP-POOL|CCp_ReleaseSpecialCustodial`,
`AQP-POOL|CCp_StakeSpecialCustodial`, `AQP-POOL|C_BeginScoreRevoke`,
`AQP-POOL|Cp_DrainScoreSlice`. 423 → 438 entrypoints, 428 → 443 previews, surface
`8107265a0be6edc3` → `6759484a5916ba4c`.

**Why it mattered.** Consumers (OuronetUI's reassign-beneficiary and unstake flows among them)
had nothing to build a call or preview against for any of these — not a missing feature, a
missing sync. No contract changed as part of this release; every added entry is `"source":
"deployed"` against an already-live module hash.

## 1.1.0 — 2026-09-26

**Ghost values: 40 account-shaped parameters stopped rendering as `"example"`.**

Surface `67c0979111eb156b` → `7e59e59d4c5b7257`. No contract changed — the module hashes are
identical, verified by `_registrylive.py` (12 modules, 0 drifted). What moved is the ghost
dictionary, and the surface hash moves with it because the snapshot is the whole artefact.

**Why it mattered.** A consumer previewing `ATS|C_Coil` got
`No value found in table … for key: example` — true, and useless. The ghost dictionary keyed
account values on `patron` / `executor` / `executee` / `account` / `buyer` / `receiver`, and the
contracts' own vocabulary is much wider: `coiler`, `curler`, `brumator`, `constricter`, `culler`,
`fueler`, `kickstarter`, `awaker`, `hibernator`, `wrapper`, `unwrapper`, `vester`, `redeemer`,
`transmuter`, `donor`, `owner-konto`, `redemption-payer` … Every one fell through to the generic
string ghost.

**Not guessed.** The names were matched against `_executorplan.ACCT` — the curated account-vs-
entity vocabulary the patron/executor canon sweep already maintains in the Pact repo, for exactly
this distinction. Reusing it means there is one list, not two that drift.

**227 slots are still generic, and deliberately so.** They are entity ids — `fvt-id`, `pool-id`,
`score-id`, `collectable-id` — where a plausible-looking fake would produce a confident number for
an entity nobody owns. An obviously-fake `"example"` is the better failure.

### `params` on every spec

Consumers merging real values into a preview need the **preview's** parameter names, and
**410 of 423 previews take a different parameter list from their entrypoint** —
`INFO_DPTF|Transfer` is `(patron id sender receiver transfer-amount)` against `C_Transfer`'s
`(patron executor executee id transfer-amount method)`. Merging on the execution signature would
put an account in an `id` slot on 97% of calls, silently, with a cost beside it.

# @ouronet/talos-registry

## 1.0.0

First release. 423 entrypoints, 428 previews, surface `67c0979111eb156b`, generated against
mainnet by `REPL/tools/_registry.py --probe`.

* `buildCall` / `buildPreviewCall` / `buildGhostCall` — arguments by NAME, rendered in the
  contract's declared order and checked against the deployed signature.
* `planCall` / `explainCall` — preflight reads, capability reader, signers, transaction count
  and the warnings that live in different keys of the record.
* `capabilityRecipe` / `parseCapabilities` — the four launchpad buys.
* `formatForType` — Pact literal rules: decimals never bare, lists space-separated, glyph
  strings verbatim, guards as `(read-keyset "name")`.
* Full types for the record.

450 tests, including one per entrypoint asserting its ghost builds.
