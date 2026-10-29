## 2.11.0 — 2026-10-29

**A decimal field inside an object can now be rendered: `pactDecimal` / `pactInteger`.**

`surfaceHash` unchanged (`2e2bfa3eb1273dc7`), 442 entrypoints, 447 previews. The
generated registry is untouched; this is `formatObject` again, and it is the half of
2.10.0's problem that `read-msg` cannot reach.

### What 2.10.0 left open

That release resolved the object-with-a-decimal argument by putting the object in the
transaction's `data` and rendering `(read-msg 'name)` — correct, and better than
correcting a round trip, for a chain-constructed value an EXECUTION hands straight
back.

**A cost preview has no `data`.** It is issued as a bare code string against `/local`,
so there is nowhere for the object to travel. `INFO_AQP-POOL|FullVacate` is the case
that forced this:

```pact
(defschema VCT|VacateTfLeg
    owner-id:string
    beneficiary-id:string
    balance:decimal
)
```

Measured on a two-leg lane:

```
(ouronet-ns.AQP-INFO.INFO_AQP-POOL|FullVacate "A" "P"
  [{ "asset-id": "OURO", "legs": [{ … "balance": 100 } { … "balance": 2.5 }] }] …)
```

The second is right and the first is refused by Pact's decimal lexer — **and the
difference is the DATA, not the code path.** A pool whose balances happen to be
fractional previews fine; one holding a round 100 does not. Intermittent by data is
the worst available failure, and it is exactly the kind a casual test passes: the
first draft of OuronetUI's own test used `2.5` and `1.0`, and `1.0` is `1` in
JavaScript, so it asserted nothing.

Seven vacate/drain entrypoints and four wipe entrypoints are affected. OuronetUI
currently ships the whole-pool vacate button **with no cost preview at all** rather
than one that usually fails — see its 2.83.0 notes.

### The type travels with the value

```ts
import { pactDecimal } from "@ouronet/talos-registry";

buildPreviewCall("TS02-C3.AQP-POOL|CC_FullVacate", {
  patron, "pool-id": poolId,
  "tf-lanes": [{ "asset-id": assetId, legs: legs.map(l => ({
    "owner-id": l.ownerId, "beneficiary-id": l.beneficiary,
    balance: pactDecimal(l.balanceRaw),          // "16.800576521961000000000000"
  })) }],
  "of-lanes": [], "coll-lanes": [], "coll-son": false,
});
```

`pactDecimal` accepts a number or a **string**, and the string is the lossless form:
Pact decimals carry up to 24 places while a JS `number` holds about 15 significant
digits, so a value read from the chain and handed back should travel as the digits the
chain sent.

`pactInteger` is its sibling and matters less often — a whole JS number already renders
as an integer — but it turns the MIRROR defect into an error. Untagged, a fractional
value in an integer field renders as `2.5` and is refused by the chain after signing;
tagged, it is refused here, with the value named.

### Why an opt-in and not a table in this package

The field types ARE derivable — from the Pact sources' `defschema` forms, which is how
the Pact repo's `_ghostshape.py` now checks the ghost layer. But this package bundles a
snapshot of the **deployed** surface and its whole discipline is that deployed code
wins. A repo-sourced schema table inside it would be a second authority:
authoritative-looking, and unverified against the chain.

So 2.10.0's closing sentence still stands — *"inventing them here would be guessing
about a contract"* — and the type is declared at the call site by the code that knows
which schema it is building for. Same reasoning as `read-msg`'s: the caller chooses,
because only the caller knows.

### Additive

An untagged value renders exactly as before, and the first test in the new file
CHARACTERISES that rather than asserting it away — a whole number still becomes an
integer. `C_UpdateSpecialFeeTargets`, the one live object-passing consumer
(`{target:string, value:integer}`, no decimal), needs no edit.

### Tests

`tests/object-field-types.test.ts`, 12 cases: the defect characterised in both its
whole and fractional forms, `pactDecimal` on numbers, fractions, an exact 24-place
chain string and an integral string, nesting inside a list of objects, a refusal for a
non-numeric value, `pactInteger`'s mirror refusal, and the full `INFO_AQP-POOL|
FullVacate` call rendered both ways. 606 tests green across the package.

Three mutants. Ignoring the tag kills 9 cases; tagging `pactDecimal` as `integer`
kills 6. The third — moving the tag check down to sit immediately above the object
branch — **survived, and survives correctly**: a `PactTyped` cannot collide with the
string, boolean, number or array branches, so its position among those is immaterial.
What IS load-bearing is that it precede the OBJECT branch, or it would render as a
nested literal `{ "__pactType": "decimal", … }`, which parses and means something
else. The comment on `formatLoose` says that rather than claiming the first position
matters, because a surviving mutant is a claim about the mutant and that claim has to
be checked too.

## 2.10.0 — 2026-10-28

**An object argument may be passed as `(read-msg 'name)`.**

`surfaceHash` unchanged (`2e2bfa3eb1273dc7`), 442 entrypoints, 447 previews. The
generated registry is untouched; this is `formatObject`, and it could not render one
of the argument types the registry already declares.

### What could not be expressed

`SwapInterface`'s two WITH-slippage variants take
`slippage-bounds: object{SwapperUsageV4.Slippage}`:

```pact
(defschema Slippage
    expected-output-amount:decimal
    output-precision:integer
    slippage-percent:decimal
)
```

Two decimals and an integer. Object FIELDS are rendered by `formatLoose`, whose own
doc comment says *"best-effort for values inside an untyped object, where no declared
type is available"* — and it cannot know those types, because the registry carries a
PARAMETER's type but not the named schema's FIELD types. Measured, all three ways of
passing it were wrong:

| passed | rendered | verdict |
|---|---|---|
| `{"expected-output-amount": 5, …}` | `{ "expected-output-amount": 5, … }` | integer literal where `decimal` is declared |
| `{"expected-output-amount": 5.0, …}` | `{ "expected-output-amount": 5, … }` | JavaScript has no `5.0`; the zero is gone before the formatter sees it |
| `{"expected-output-amount": {decimal: "5.0"}, …}` | `{ "expected-output-amount": { "decimal": "5.0" }, … }` | that is the capability-argument encoding, not Pact object syntax |

### And the deeper reason is PROVENANCE, not formatting

A `Slippage` is **constructed by the chain** (`SWPU.UDC_SpawnSlippageBounds`), read
into the client, and handed straight back. Re-serialising a chain-produced value
through a JS literal formatter is a round trip through a lossy encoding for no
benefit; putting it in the transaction's `data` returns the chain its own JSON. That
is why the deployed templates render `(read-msg 'slippage-bounds)`.

### Additive, so nothing existing changes

A **string** (or `{ readMsg: "name" }`) means *"this argument lives in the
transaction data under that name"*. An **object** still renders inline, exactly as
before.

That matters because there IS one live consumer: `C_UpdateSpecialFeeTargets` passes
`[object{SwapperV5.FeeSplit}]`, whose schema is `{target:string, value:integer}` —
no decimal, so inline rendering is correct for it and it needs no edit. Measured
across all four of OuronetUI's spec files, it is the **only** object argument any
Ouronet client passes.

The caller chooses, because only the caller knows whether its value came from the
chain. The alternative — refusing every object with a decimal field — needs schema
field types this registry does not carry, and inventing them here would be guessing
about a contract.

This mirrors the existing guard convention exactly: a `guard` takes the NAME of a
data key and renders `(read-keyset "<name>")`, with `{ readKeyset }` as the explicit
form. `{ readMsg }` is its object-typed sibling.

### Tests

`tests/msg-ref.test.ts`. Three mutants — strings no longer becoming `read-msg`, the
symbol form becoming a quoted string, and every object becoming a `read-msg` and so
breaking the one existing consumer — all die. Two of them initially "survived"
because the mutation script had a quoting error and never applied; a surviving mutant
is a claim about the mutant, and that claim has to be checked too.

## 2.9.0 — 2026-10-28

**`STOA_SIGNATURES` carries the contract's whole `C_` surface: 9 entries -> 18.**

`surfaceHash` unchanged (`2e2bfa3eb1273dc7`), 442 entrypoints, 447 previews. The
generated registry is untouched; this is the HAND-WRITTEN native table, and it was
short.

### What it held, and why nine was the wrong nine

The nine entries were the ones a consumer had asked for. That is not a surface, and
the difference was live in three places at once:

- **`coin.C_CreateAccount` and `coin.C_UR|CreateAccount` were absent** — the first
  leg of every "create the destination, then act" composite in OuronetUI. A consumer
  needing one had no choice but a hand-written Pact string, which is the thing this
  package exists to end.
- **`coin.C_UR|TransferAnew` / `C_UR|TransmitAnew` were absent** — what the UrStoa
  transfer needs. And `PAPYRUS_ENGINE_SPEC.md` §2.5.4 cited `coin.C_UR|TransferAnew`
  **from this table** as evidence the surface was already covered. The entry it
  actually matched was `C_TransferAnew`, the non-UR one. **A near-name is how a gap
  reads as a presence.**
- **Nothing could report the shortfall**, because nothing compares this table to the
  contract — the Pact sources are in another repository. They still are. So every
  entry now carries its source LINE, which is the audit trail: re-derive with
  `grep -n "(defun C_" coin-live.pact`, which is how the list was built.

### Added

`C_CreateAccount` · `C_RotateAccount` · `C_TransferAcross` · `C_UR|CreateAccount` ·
`C_UR|RotateAccount` · `C_UR|TransferAnew` · `C_UR|TransmitAnew` · `C_URV|Inject` ·
`C_URV|CoinbaseInject`

### Asserted

Completeness against the contract cannot be checked from here, so what is checked is
what can be: all 18 build from ghost values through `buildNativeCall`, none renders a
namespace, each of the 9 guard parameters renders as `(read-keyset "...")` and never
as a literal, and **no family is half-present** — every create, rotate, transfer and
`Anew` has its `UR` twin. A missing twin is the shape the gap took last time.

The count assertion failed on its author first: the table was written with a hand
count of 17 against a real 18. 585 -> 589 tests.

## 2.8.0 — 2026-10-28

**`buildNativeCall` — the registry can now describe a call it does not contain.**

`surfaceHash` unchanged (`2e2bfa3eb1273dc7`), 442 entrypoints, 447 previews. Nothing
was regenerated: this release is three functions over data that has been published
here, typed, since the tooltip canon landed.

### The gap

`buildCall` names `ouronet-ns.<key>` and reads the generated registry, so it can only
describe Ouronet's surface. Three operations in OuronetUI are not on it at all —
UrStoa stake, unstake and collect execute `coin.C_URV|Stake` / `|Unstake` /
`|Collect`, **StoaChain's own root-namespace contract**, with no `ouronet-ns`
entrypoint anywhere. They were the last carriers of that app's modal migration whose
blocker was not a feature of the form but the plain fact that *nothing could describe
the call*, so each one kept a hand-written Pact template in `@ouronet/ouronet-core`.

The gap was also MIS-SIZED, as "a generator plus a table", after a search of a
different artefact — the consumer's own `pactSignatures.generated.ts`, which is
generated from the Ouronet sources and so is correctly Ouronet-only.
`STOA_SIGNATURES` and `KADENA_SIGNATURES` have been right here the whole time, with
names AND types, and `formatForType` already renders every type they use, guards
included.

### What landed

- **`buildNativeCall(key, args)`** — by name, rendered in the contract's declared
  order, **no namespace prefixed** (the native contract is root; `ouronet-ns.coin.…`
  would name a module that does not exist and fail as a resolution error on chain).
  Emits byte-for-byte what the hand-written templates emit, which is asserted against
  them.
- **`nativeSignature(key)`** — the declared parameters, or `undefined`. Resolves
  through `chainOf`, which REFUSES a key declared for both chains rather than picking:
  both chains call their contract `coin`, and building against the wrong one is the
  kind of wrong that looks right.
- **`composeCalls(calls)`** — a transaction body is a sequence of forms, so a
  composite is a join. Written down because each consumer re-derived it and one has to
  be read twice to see whether the create comes before the collect.
- **`buildCall` now names the mistake.** A native key used to reach `getEntrypoint`
  and be reported as *"the name is stale or the module is not deployed"*, sending the
  reader to look for a deploy that was never going to exist. It now says the key is a
  chain-native call and points at `buildNativeCall`, keeping the `Unknown entrypoint`
  prefix so a caller matching on it still matches.

### A surviving mutant wrote one of the tests

Replacing `params.map` with `Object.keys(args).map` — rendering in whatever order the
caller typed — **passed every assertion in the new file**, because each supplied its
arguments in declared order. Transposition is precisely the defect this package exists
to prevent (`C_ChangeOwnership` moved its pool id to last while keeping its arity), and
it was undetectable until one object was written out of order on purpose. 584 tests.

## 2.7.0 — 2026-10-27

**`partition.groupBy` — a cut POSITION can be unsound even when the split is.
And the six AQP drain/vacate slices are classified, by reading the exec.**

`surfaceHash` `ab8e2031f3fc0be5` -> `2e2bfa3eb1273dc7`. 442 entrypoints and 447
previews unchanged. **36 routes: 26 `list`, 8 `architectural`, 2 `cursor`.**

### Resolved — the six AQP batch drain/vacate slices

Held back in 2.5.0 pending an owner ruling. No ruling was needed; the exec
answers it, and **the two families are not the same case.**

**DRAIN x3 — safe to cut anywhere.** Their `INFO_` text misleads: it says settle
fires *"only for beneficiaries fully drained THIS ROUND"*, which reads as a
per-call condition. The implementation is

```pact
(if (= (ref-AQP::UR_AQP|UserUnn pool-id beneficiary-id) 0) ...settle... (UC_EmptyOc))
```

— a test on the **resulting state** after this call's legs decrement `unn`, not
on whether this call carried all of them. A beneficiary with 10 legs cut 5/5
goes 10->5 (no settle) then 5->0 (settle): **exactly once, order-independent**,
whichever batch lands last. So cutting mid-beneficiary is fine.

**VACATE x3 — cuttable only on a beneficiary boundary.**
`XI_1|Vacate*UnwindFromLegs` calls the per-beneficiary unwind once per unique
beneficiary **in that slice, ungated**, fed
`UC_VacateSumAmountForBeneficiaryFromLegs` — that slice's partial sum. Two of
the unwind's six legs are genuinely delta-based
(`XE_*BeneficiaryRollup ... amount false`, `XE_Apply*StakeDelta ... amount false`)
so partial sums add up. The other four are the settle triple — and **the drain
path gates that same triple behind `UserUnn == 0` precisely so it fires once.**
Vacate does not. That asymmetry is the evidence: the vacate design assumes a
beneficiary never spans two slices.

### Added — `groupBy`

A parameter whose value must not be split across batches; every element sharing
it stays in one transaction. It constrains **where** a cut may fall, not whether
one may happen — a distinction neither `axis` nor `lockstep` could express, and
without it `axis: owner-ids` would happily cut between two legs of the same
beneficiary, which is the one position the vacate is unsound.

`splitCallByCapacity` honours it in both dimensions. **Contiguity is not
assumed** — the same value may appear at non-adjacent indices and a preflight is
under no obligation to sort — so groups are collected by value and emitted as
index *sets*, which is why each call is built from an explicit index list rather
than a range. Order within a group is preserved and groups are emitted in order
of first appearance.

Checked to be the axis itself or one of its lockstep companions: a key not
positional against the axis cannot define a boundary in it. Three new generator
rules, each negative-tested.

### Removed — a branch that could not change a result

A special case emitted an over-capacity group alone. Mutation testing showed
deleting it changed no outcome: the ordinary rule already produces exactly that,
because a group heavier than `capacity` overflows whatever is accumulating,
flushes it, then overflows again and is emitted on its own. A branch that cannot
change a result is not a guard — it is something a later reader has to verify
and will believe instead.

### Verified

Seven mutations of the group packer all fail the suite, including two that only
started failing after the tests were corrected: **every earlier group test used
the FLAT vacate variant**, so the nested path's boundary check was never
exercised; and **every overflow fixture coincided with an oversized group**,
handled by a different branch, so the ordinary flush never ran. Three 2-leg
groups against a capacity of 3 was the case that needed writing.

## 2.6.0 — 2026-10-27

**`partition.kind` — a split is LIST-based, CURSOR-based or ARCHITECTURAL, and
the three are not interchangeable.**

`surfaceHash` `65c983178cb70985` → `ab8e2031f3fc0be5`. 442 entrypoints and 447
previews unchanged. **30 entries now carry a route: 20 `list`, 8
`architectural`, 2 `cursor`.**

### Added — the kind discriminator

2.5.0 described one kind of split: cut a list argument. That is incomplete, and
the gap is structural rather than cosmetic.

| kind | the list is | piece count | expressed as |
|---|---|---|---|
| `list` | an **argument** | **measured**, unbounded | N independent transactions |
| `cursor` | in chain **state** | unbounded, not knowable | a pager advancing stored progress, **strictly sequential** |
| `architectural` | *there is no list* | **fixed**, intrinsic | a defpact's ordered phases |

**WHY A DEFPACT CANNOT CARRY A LIST SPLIT** (owner ruling 2026-10-27, and the
distinction this taxonomy was missing): *"defpacts is not ideal for list based
split because the list can be longer than the number of steps defined in the
defpacts."* A defpact's step count is **fixed by its definition**; a list has no
fixed length. So a defpact expresses a decomposition whose piece-count is
**intrinsic** to the operation — ordered phases, each depending on what the last
left behind, which is what continuation state is for — and it cannot express one
whose piece-count comes from measuring a list. A 2-step twin caps the work at
two steps forever.

### Added — 8 architectural routes, DERIVED not authored

Every defpact already names its single-transaction twin in `preferInstead`.
Inverting that pointer **is** the architectural route, so the eight are
generated rather than hand-written and cannot drift from the eight pairs the
existing check already validates in the other direction.

They are **triggered by measurement only**: the single transaction is the route
whenever it fits, which is why these carried `supported: false`. At a 2,000,000
gas limit the SWP family measures 415,419 — 21% of budget — so the route never
fires. It would fire at the old 150,000. Owner, confirming the rule is uniform
rather than special-cased: *"if the block limit would have been 150k limit this
would be the case of the swp defpacts."*

That also retires `supported: false` as a hand-kept verdict. The twin is not
*unsupported*; it is **the architectural route, gated on gas** — a fact about
the operation rather than a policy that goes stale when the block limit moves.
Which it already did once.

### Added — 2 cursor routes, and the two defpacts they supersede

`AQP-FVT|CC_Inject` and `CC_SweepRevokeAnchor` take **no list parameter** —
`(patron, executor, fvt-id, reward-dptf-id, amount)` and
`(patron, executor, anchor-id)`. Their work is list-*shaped*, but the set lives
in chain state (`URH_FvtStalePresentUsers`, `UR_FVT|SweepProgress`). So a client
has nothing to cut, and `kind: list` would invite it to slice an argument that
does not exist.

Their scalable route is the matching pager — `CCp_InjectFixChunk`,
`CCp_SweepRecomputeChunk` — whose own note already reads *"repeat until the
report says done"*: **unbounded** calls, strictly sequential because two race
the cursor.

**So `MTX-AQP|2|CC_Inject` and `MTX-AQP|2|CC_SweepRevokeAnchor` are recorded as
`architecturalSuperseded`, not offered as routes.** They are `steps: 2` against
an unbounded workload — list-shaped work solved with a fixed-step tool. Owner,
on why they exist: *"i dont even know why we made them in the first place."*
They are the first attempt, kept deployed because a deployed module cannot be
removed.

**Measured, and this is the live case:** an inject on a 5-score pool cost
~257,000 gas and scales with the score and present-user sets. It is the first
route in this registry expected to be needed in practice rather than in
principle.

### Verified

10 new generator rules, each negative-tested by breaking the data: a bogus kind;
a cursor `via` that is not a pager, is not an entrypoint, or is a **defpact**; a
cursor whose `progress` disagrees with the pager's own preflight; a cursor
carrying a list axis; an architectural `via` that is not a defpact or does not
point back; a step count disagreeing with the twin's; a superseded orphan; and a
superseded entry that is not a defpact.

The tenth is the one negative testing earned: **the two mechanisms must be
jointly exhaustive.** Every defpact naming a twin is either derived into an
architectural route or explicitly superseded. Dropping a supersession entry was
initially *invisible* — the twin already carried an authored `cursor` block, the
derivation skips authored keys, and nothing objected. The behaviour stayed right
by accident while the record of **why** evaporated, which is the state that
rots: remove the cursor block next and the derivation silently makes an
unbounded workload architectural again.

`splitPlan` now reports `kind`, `via`, `progress` and `steps`; `splittable` means
**list-splittable only**. `splitCall` and `splitCallByCapacity` refuse the other
two kinds with the action each one needs — telling someone to "record a partition
block" for a cursor route sends them to author metadata for an argument that
does not exist. 563 tests; 6 mutations of the kind dispatch verified to fail.

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
