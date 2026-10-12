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
