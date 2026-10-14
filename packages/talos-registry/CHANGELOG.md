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
