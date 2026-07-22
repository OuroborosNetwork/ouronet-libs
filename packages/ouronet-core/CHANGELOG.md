# Changelog

All notable changes to `@ouronet/ouronet-core`.

This package is the historical continuation of `@ouronet/ouronet-core` v0.x–v3.3.8. v4.0.0 split it into a two-package npm workspace under `StoaChain/stoa-js` — chain-generic infrastructure moved out into [`@stoachain/stoa-core`](https://www.npmjs.com/package/@stoachain/stoa-core), this package retained the Ouronet-specific business logic. The `4.0.0` heading below is the first release after the split.

## 4.3.6 — 2026-06-11

Atomic-triplet lockstep bump — `4.3.5 → 4.3.6` alongside `@stoachain/stoa-core` (which carries an auto-gas-limit floor fix in `calculateAutoGasLimit` — a dirty-read under-reports a signed tx's real cost, so tiny estimates were starving txs) and `@stoachain/kadena-stoic-legacy`, per the cross-package version-pin invariant. This package is functionally identical to its 4.3.5 release.

## 4.3.5 — 2026-06-10

**Additive — Smart Ouronet Account deploy + keyset-ref-aware activation + fresh IGNIS balance.** Atomic-triplet bump — `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped 4.3.4 → 4.3.5 in lockstep per the cross-package version-pin invariant; those two are functionally identical to their 4.3.4 release (only ouronet-core changed).

- **`buildDeploySmartAccountPactCode({ account, kadenaAddress, sovereign, publicKey, mode?, keysetRef? })`** — emits `C_DeploySmartAccount <account> <guard> <kadena> <sovereign> <public>`, the Smart (Σ.) account deploy. Same shape as the Standard deploy plus the extra `sovereign` arg (an existing Standard Ѻ. account).
- **`getDeploySmartAccountInfo` / `getDeploySmartAccountInfoOnly`** — `URC_DeploySmartAccount` readers (mirror the Standard pair).
- **Keyset-ref-aware activation:** `buildDeployStandardAccountPactCode` + `buildDeploySmartAccountPactCode` gained `mode: "define" | "existing"` + `keysetRef`. In `"existing"` mode they emit `(keyset-ref-guard "<ref>")` instead of `(read-keyset "ks")`, so a "Use Existing Keyset" activation preserves the keyset-ref guard type instead of expanding it to a literal keyset. Default `"define"` is backward-compatible.
- **`getIgnisBalance` now reads at tier T1, not T5** — it's a balance read (T1 = high-churn/short-TTL per the canonical tier mapping). At T5 the patron IGNIS balance stayed stale right after a transfer, falsely blocking spends with "Insufficient IGNIS" until a hard refresh.

Pure additive to existing exports (the deploy builders gained optional params with backward-compatible defaults). Consumes downstream into `@ouronet/ouronet-codex@0.5.4`.

## 4.3.4 — 2026-06-08

**Bugfix — UrStoa vault earnings hover.** `ouroPrimordialsFunctions.parseResponse` routed the `urstoa-vault-earning-hover` field through `String(...)` before formatting. The chain returns that field as a `{ decimal: "…" }` object (like the supply hover), so `String({decimal})` produced `"[object Object]"`, which parsed back to `0` and wrongly disabled the Dashboard UrStoa **Collect** button (showing an `[object Object]` tooltip). It is now routed through `supplyHoverVal` (→ `mayComeWithDeimal`), matching the supply row, so the hover unwraps correctly and Collect re-enables when earnings are available.

Atomic-triplet bump — `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped 4.3.3 → 4.3.4 in lockstep per the cross-package version-pin invariant; those two packages are functionally identical to their 4.3.3 release.

## 4.3.3 — 2026-05-30

**Additive — StoicTag + governor-rotation builder/reader surface** supporting the OuronetUI v1.2.5 StoicTag wiring cycle (Register / Release StoicTag modals, Rotate Governor modal, tag-aware receiver fields). Atomic-triplet bump — `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped 4.3.2 → 4.3.3 in lockstep per the cross-package version-pin invariant; those two packages are functionally identical to their 4.3.2 release.

### New Pact builders (`src/pact/cfmBuilders.ts`)

- `buildRotateGovernorPactCode({ patron, account, governor })` — emits the `ouronet-ns` governor-rotation call.
- `buildNonKeyGuardExpr(constructor, ...)` (+ exported `NonKeyGuardConstructor` type) — serializes a User-guard or Capability-guard expression for the non-key governor branch.
- `buildReleaseStoicTagPactCode({ patron, tagName })` — `(ouronet-ns.TS01-C4.CODEX|C_ReleaseStoicTag "patron" "tag")`.
- `buildRegisterStoicTagPactCode({ patron, tagName, accountAddress })` — `(ouronet-ns.TS01-C4.CODEX|C_RegisterStoicTag "patron" "tag" "account")`.

### New interaction readers (`src/interactions/ouroAccountFunctions.ts`)

- `getStoicTagInfo` (URC_0027c) — forward StoicTag info read.
- `getStoicTagSelectorData` (URC_0027b) — batch selector-data read for tag pickers.
- `getRegisterStoicTagInfo(patron, tagName, account)` — combined `let*` read returning `{ info, receivers }` (INFO + `kadena-targets` resolved via `UR_AccountKadena`) for the native-STOA split registration flow.

### Types (`src/interactions/ouroTypes.ts`)

- `AccountSelectorData` gained `stoic-tag-has` / `stoic-tag` / `stoic-tag-registered-at`.
- New `StoicTagSelectorData` interface.

All additions are additive on the public typed surface — no existing builder, reader, or type signature changed. Covered by `tests/cfm-builders.test.ts` + `tests/stoic-tag-reads.test.ts`.

## 4.3.2 — 2026-05-30

**PATCH — frozen-keyset mutation fix in `resolveGuard` / `getKadenaAccountGuard`** (`src/interactions/ouroAccountFunctions.ts`). Atomic-triplet bump — `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped 4.3.1 → 4.3.2 in lockstep per the cross-package version-pin invariant; those two packages are functionally identical to their 4.3.1 release.

### The bug

Both helpers resolved a keyset-ref by reading the keyset and then **mutating the read result in place**:

```ts
const ks = await readKeyset(guardData.keysetref.ns, guardData.keysetref.ksn);
if (ks) ks.keysetRef = `${guardData.keysetref.ns}.${guardData.keysetref.ksn}`;
return ks;
```

`readKeyset` returns the object handed back by the configured `pactRead` seam. Under OuronetUI's cache-aware reader that object is a **shared, frozen reference**, so the in-place write threw `TypeError: Cannot assign to read only property 'keysetRef'`. In OuronetUI this rejection propagated through the `Promise.all` inside wallet-context's `syncOuroAccounts`, aborting the whole sync before the displayed account list / counts were updated — so newly-spawned Ouronet accounts (any creation mode) never appeared in the Codex, and Standard/Smart counts froze at the last successful-sync snapshot. The mode/curve "specificity" originally reported was incidental timing, not a per-mode code path.

The bug didn't surface server-side (AH hub) because the default uncached reader returns fresh, unfrozen objects each call.

### The fix

Return a shallow copy instead of mutating: `return ks ? { ...ks, keysetRef } : ks;`. The borrowed/frozen read result is never written to. Regression test in `tests/v4-3-2-resolve-guard-no-mutate-frozen-keyset.test.ts` installs a `pactReader` that returns a frozen keyset and asserts neither helper throws, the resolved `keysetRef` is present on the returned object, and the frozen source is left untouched. No public API or type changes.

## 4.3.1 — 2026-05-27

**PATCH — ESM extensionless-relative-import fix** (atomic-triplet bump). Same bug pattern as [`@stoachain/stoa-core@4.3.1`](https://www.npmjs.com/package/@stoachain/stoa-core) and [`@ouronet/ouronet-codex@0.2.1`](https://www.npmjs.com/package/@ouronet/ouronet-codex). See those entries for the full bug context.

40 source files updated, 90 imports rewritten in `src/**/*.ts`. Emitted `dist/**/*.js` now correctly has the `.js` extension on every relative import. Peer-deps on `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` updated 4.3.0 → 4.3.1.

Verification: 797/797 specs pass; smoke test of `await import('@ouronet/ouronet-core/codex')` (and `/pact`, `/constants`, `/interactions/*`) under Node 22+ strict ESM succeeds. No API changes.

## 4.3.0 — 2026-05-25

**MINOR — additive: 2 new account-rotation Pact builders** (`buildRotateGuardPactCode`, `buildRotateKadenaPactCode`) supporting the [`@ouronet/ouronet-codex`](https://www.npmjs.com/package/@ouronet/ouronet-codex) v0.1.0 Phase 6b rotation modals (`<RotateGuardModal>` + `<RotatePaymentKeyModal>`). The third rotation modal in the package (`<RotateSovereignModal>`) uses the pre-existing `buildRotateSovereignPactCode` (added v1.6.0). MINOR rather than PATCH because these unlock a new categorised public consumer surface — ouronet-codex's headless on-chain account-management UI — that wasn't reachable through the prior builder set; "additive on the public typed API surface in a way that enables a new consumer use case" is the established MINOR trigger for this monorepo (see also v4.2.0 which graduated the codex codec). Atomic-triplet bump — `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped 4.2.2 → 4.3.0 in lockstep per the cross-package version-pin invariant; those two packages are functionally identical to their 4.2.2 release.

### Added — Account rotation builders (TS01-C1.DALOS)

- **Rotate Guard** — `buildRotateGuardPactCode({ patron, account, mode, keysetRef?, safe })` in `src/pact/cfmBuilders.ts`. Emits the canonical `C_RotateGuard` 4-arg shape with a runtime-conditional guard expression: `(read-keyset "ks")` when `mode === "define"` (caller MUST `.addData("ks", { keys, pred })` on the builder), or `(keyset-ref-guard "<ref>")` when `mode === "existing"`. The `safe` boolean is emitted as a bare Pact bool literal (not quoted). Tests in `cfm-builders.test.ts` cover both modes + the empty-keysetRef defensive fallback + bare-bool emission + module/function path.
- **Rotate Payment Key** — `buildRotateKadenaPactCode({ patron, account, newPaymentKey })` in `src/pact/cfmBuilders.ts`. Emits the canonical `C_RotateKadena` 3-arg shape (named `RotateKadena` on chain because the kadena-ledger payment key is what's being rotated; the user-facing builder description uses "Payment Key" for clarity). Caller is responsible for `.addData("ks", patronGuard)` + (when patron ≠ account) `.addData("ks-account", accountGuard)` on the transaction builder — the builder ONLY emits the Pact code. Tests in `cfm-builders.test.ts` cover the canonical shape + argument order + special-character preservation.

### Deferred

- **Rotate Governor** — Pact function `C_RotateGovernor` exists on chain (Smart Account `Σ.` only) but no UI surface ships it yet, so no builder is added in this release. Will land in a later version once `@ouronet/ouronet-codex` consumes it (post-OuronetUI-Phase-9-migration per the modular-codex spec's locked decision).

## 4.2.2 — 2026-05-18

**PATCH — additive: new SWP-pair management builders + matching INFO readers + UR\_\* reads** to support the OuronetUI v1.0.8 cycle wiring the remaining 9 Liquidity-Pools-Management page buttons (Modify Can Change Owner, Modify Weights, Modify Amplifier, Toggle Swapping / Provisioning, Activate Frozen / Sleeping LP, Update Fee Targets, Update Branding). Shipped mid-cycle at 5-of-11 buttons wired (Change Ownership from v1.0.7, plus Modify Can Change Owner / Modify Weights / Toggle Swapping / Toggle Provisioning from this cycle) to validate the cascade on devwallet before completing the remaining 6. PATCH chosen to match the established project cadence — v4.2.1 was itself 23 additive builders shipped as PATCH; strict SemVer would call this MINOR, but the workspace convention has consistently been PATCH-for-additive (deliberate MINOR/MAJOR moments are user-decided, not automatic). Atomic-triplet bump — `@stoachain/kadena-stoic-legacy` and `@stoachain/stoa-core` bumped 4.2.1 → 4.2.2 in lockstep to satisfy the cross-package version-pin invariant (`tests/v4-1-1-cross-package-version-pin.test.ts`); those two packages are functionally identical to their 4.2.1 release.

### Added — SWP-pair management (TS01-C3.SWP + INFO-ONE.SWP + SWP.UR_*)

- **Modify Can Change Owner** (button #2 of 9): `buildModifyCanChangeOwnerPactCode({ patron, swpair, newBoolean })` in `src/pact/cfmBuilders.ts`; `getModifyCanChangeOwnerInfo(patron, swpair, newBoolean)` in `src/interactions/infoOneFunctions.ts`; `getSwpairCanChangeOwner(swpair)` UR read in `src/interactions/dexSwapPairAdminFunctions.ts`. Tests for the builder in `tests/cfm-builders.test.ts`.
- **Modify Weights** (button #3 of 9, Weighted pools only): `buildModifyWeightsPactCode({ patron, swpair, newWeights: string[] })` in `src/pact/cfmBuilders.ts` — emits the canonical 3-arg shape with a Pact `[decimal]` list literal, each weight formatted via `formatDecimalForPact` (closes F-SEC-001). `getModifyWeightsInfo(patron, swpair, newWeights)` in `src/interactions/infoOneFunctions.ts`. UI-side constraints (length matches pool token count, each ≤4 fractional digits, sum exactly 1) enforced in the consuming modal; chain re-validates as defense.
- **Toggle Swapping** + **Toggle Provisioning** (buttons #4 + #5 of 9, paired commit since they're structurally identical): `buildToggleSwapCapabilityPactCode({ patron, swpair, toggle })` + `buildToggleAddLiquidityPactCode({ patron, swpair, toggle })` in `src/pact/cfmBuilders.ts`. `getToggleSwapCapabilityInfo` + `getToggleAddLiquidityInfo` in `src/interactions/infoOneFunctions.ts`. `getSwpairCanSwap(swpair)` + `getSwpairCanAdd(swpair)` UR reads in `src/interactions/dexSwapPairAdminFunctions.ts`. Same autonomous-boolean-as-inverse-of-current pattern as `C_ModifyCanChangeOwner` (chain rejects same-value writes). Tests in `cfm-builders.test.ts` cover bare-bool literal (NOT quoted), `C_ToggleSwapCapability` vs `C_ToggleAddLiquidity` disambiguation guard, and argument order.

(remaining 6 buttons — Modify Amplifier, Activate Frozen LP, Activate Sleeping LP, Update Special Fee Targets, Update Pending Branding, Upgrade Branding — will land in v4.2.3 alongside OuronetUI v1.0.9 once wired)

## 4.2.1 — 2026-05-16

**PATCH — additive: new SWP `C_ChangeOwnership` builder + matching INFO reader, the `UR_OwnerKonto` lightweight read, and the full **Phase-3b strategy-migration builder set** (23 new builders + 1 INFO reader total) so the downstream OuronetUI v1.0.7 cycle could migrate every legacy `executeXxx` direct-helper caller (14 modals) onto the canonical `useCFMStrategy + buildXxxPactCode` pattern.** Atomic-triplet bump (`@stoachain/kadena-stoic-legacy@4.2.1` + `@stoachain/stoa-core@4.2.1` + `@ouronet/ouronet-core@4.2.1`) per the invariant enforced by `tests/v4-1-1-cross-package-version-pin.test.ts`. The other two packages are functionally identical to their 4.2.0 release — version bumped purely to satisfy the triplet model.

### Added — SWP family (TS01-C3.SWP)

- **`buildChangeOwnershipPactCode({ patron, swpair, newOwner })`** in `src/pact/cfmBuilders.ts`. Emits `(ouronet-ns.TS01-C3.SWP|C_ChangeOwnership "<patron>" "<swpair>" "<new-owner>")`. Companion builder for the OuronetUI `ChangeOwnershipCFMModal` wired on the Pool Settings → Transfer Ownership button.
- **`getChangeOwnershipInfo(patron, swpair, newOwner)`** in `src/interactions/infoOneFunctions.ts`. Reads `(ouronet-ns.INFO-ONE.SWP|INFO_ChangeOwnership ...)` at T2, returns `null` on RPC failure (honoring the F-API-002 nullable contract).
- **`getSwpairOwnerKonto(swpair)`** in `src/interactions/dexSwapPairAdminFunctions.ts`. Lightweight T5 read of `(ouronet-ns.SWP.UR_OwnerKonto <swpair>)` returning just the owner-konto string. Used by `ChangeOwnershipCFMModal` to decide which ghost-receiver address to pre-fill so the ghost never collides with the current owner.

### Added — Strategy-migration builders (Phase 3b)

The OuronetUI v1.0.7 cycle migrated all 14 legacy `executeXxx` direct-helper callers to `useCFMStrategy.execute({ build, guards, ... })` + typed builders. The following 22 builders were added in support:

**TS01-C2.LQD family — Wrap / Unwrap of native STOA + UrStoa:**
- `buildWrapStoaPactCode({ patron, wrapper, amount })`
- `buildWrapUrStoaPactCode({ patron, wrapper, amount })`
- `buildUnwrapStoaPactCode({ patron, unwrapper, amount })` — simple shape (target k:account exists)
- `buildUnwrapStoaWithCreateAccountPactCode({ patron, unwrapper, amount })` — composite multi-line Pact with `(namespace "ouronet-ns")` + `(IGNIS.C_Collect ...)` + `let` block that atomically `coin.C_CreateAccount`s the target then unwraps. Call site MUST `addData("ks", { keys: [<targetPubkey>], pred: "keys-all" })`.
- `buildUnwrapUrStoaPactCode({ patron, unwrapper, amount })` — simple shape (target exists)
- `buildUnwrapUrStoaWithCreateAccountPactCode({ patron, unwrapper, amount })` — UR variant; uses `coin.C_UR|CreateAccount` (NOT `coin.C_CreateAccount` — separate coin-module function for UrStoa accounts).

**TS01-C1.DALOS family — account deploy:**
- `buildDeployStandardAccountPactCode({ account, kadenaAddress, publicKey })`

**TS01-C3.SWP family — liquidity + swap:**
- `buildAddLiquidityPactCode({ patron, account, swpair, inputAmounts })`
- `buildRemoveLiquidityPactCode({ patron, account, swpair, lpAmount })`
- `buildSingleSwapWithSlippagePactCode({ patron, account, swpair, inputId, inputAmount, outputId })` — requires `addData("slippage-bounds", ...)` at call site.
- `buildSingleSwapNoSlippagePactCode({ patron, account, swpair, inputId, inputAmount, outputId })`
- `buildMultiSwapWithSlippagePactCode({ patron, account, swpair, inputIds, inputAmounts, outputId })` — requires `addData("slippage-bounds", ...)`.
- `buildMultiSwapNoSlippagePactCode({ patron, account, swpair, inputIds, inputAmounts, outputId })`

**TS02 token-set creation (SFT + NFT):**
- `buildCreateSetPactCode({ patron, account, id, nonces, setClass, howManySets })` — TS02-C1.DPSF.
- `buildCreateSetNFTPactCode({ patron, account, id, nonces, setClass })` — TS02-C2.DPNF (no how-many-sets).

**coin.C_URV family — StoaChain native UrStoa stake / unstake / collect (patronless):**
- `buildStakeUrStoaPactCode({ paymentKeyAddress, amount })` — emits `(coin.C_URV|Stake "<pk>" <amount>)`.
- `buildUnstakeUrStoaPactCode({ paymentKeyAddress, amount })` — emits `(coin.C_URV|Unstake "<pk>" <amount>)`.
- `buildCollectUrStoaPactCode({ paymentKeyAddress })` — simple shape, account exists.
- `buildCollectUrStoaWithCreateAccountPactCode({ paymentKeyAddress })` — composite with `coin.C_CreateAccount` + `(coin.C_URV|Collect ...)`. Requires `addData("ks", ...)`.

**coin.C_UR family — StoaChain native UrStoa transfer (4 conditional shapes):**
- `buildNativeUrTransferPactCode({ sender, receiver, amount })` — receiver exists, Transfer family.
- `buildNativeUrTransmitPactCode({ sender, receiver, amount })` — receiver exists, Transmit family.
- `buildNativeUrTransferAnewPactCode({ sender, receiver, amount })` — receiver new, Transfer family. Requires `addData("ks", { keys: [<receiverPub>], pred: "keys-all" })`.
- `buildNativeUrTransmitAnewPactCode({ sender, receiver, amount })` — receiver new, Transmit family. Same `addData` requirement.

### Test surface

- `tests/cfm-builders.test.ts` grew from 52 → **108 specs**. Each new builder gets a canonical-shape test + argument-ORDER guard + module/function-name guard. Decimal-formatting tests for amount-typed builders verify integers pad to `x.0` form (closes the F-SEC-001 Pact-code injection vector). Composite-shape builders (`*WithCreateAccount`, `*Anew`) additionally test the create-account-precedes-the-real-call ordering invariant. Cross-cutting `it.each` valid-shape sample list extended with the simple `ouronet-ns` builders; coin.* builders deliberately excluded (they emit `(coin.* ...)` which fails the `(ouronet-ns.` prefix assertion by design — they're tested in their own describe blocks).

### Note on the legacy `executeXxx` helpers

The pre-existing `executeWrapStoa`, `executeStakeUrStoa`, `executeAddLiquidity`, `executeSingleSwapWithSlippage`, etc. helpers in `src/interactions/*Functions.ts` are **retained** in this release — they're unused by OuronetUI as of v1.0.7 but may have other surfaces or be public API. Deletion deferred to a v4.3 cleanup pass.

### Compatibility

- Pure additive — no signature changes to existing exports. Peer-deps bumped to 4.2.1 only for atomic-triplet alignment (functionally identical to 4.2.0 on the chain-generic side). Consumers on `4.2.0` continue to work unchanged for everything already on 4.2.0; consumers wanting any of the new SWP / Wrap / Unwrap / DALOS / Liquidity / Swap / TokenSet / coin.C_URV / coin.C_UR builders upgrade to `4.2.1`.

## 4.2.0 — 2026-05-09

**MINOR — architectural closures + INTEGRATION-GUIDE deliverable + atomic-triplet bump (atomic with `@stoachain/kadena-stoic-legacy@4.2.0` + `@stoachain/stoa-core@4.2.0`).** Released 2026-05-09. Closes 6 audit findings (F-ARCH-001/002/003 god-file splits + F-API-002 nullable contract + F-API-018 readonly sweep + F-TEST-006 coverage expansion) plus a NEW deliverable (`INTEGRATION-GUIDE.md` at repo root).

### Changed — audit closures

- **REQ-03..REQ-07 / F-ARCH-001 — Phase 1 dex god-file split.** `interactions/dexFunctions.ts` (~600 LOC, 7-entity Ouronet taxonomy) decomposed into ~10 entity-oriented files: `dexSwapPairCalcFunctions.ts`, `dexSwapPairExecFunctions.ts`, `dexLiquidityCalcFunctions.ts`, `dexLiquidityExecFunctions.ts`, `dexFuelCalcFunctions.ts`, `dexFuelExecFunctions.ts`, `dexDashboardFunctions.ts`, `dexAccountSuppliesFunctions.ts`, `dexCappedInverseFunctions.ts`, `dexTypes.ts` (the shared types module). Old import path `@ouronet/ouronet-core/interactions/dexFunctions` continues to work as a thin re-export shim for backward compatibility; new entity-oriented subpaths are recommended for tree-shaking.

- **REQ-08..REQ-13 / F-ARCH-002 — Phase 2 ouro god-file split + chain/UI surgical separation.** `interactions/ouroFunctions.ts` (~2200 LOC) decomposed into ~11 entity-oriented files separating chain-side (RPC builders, signing pipelines) from UI-side (display formatting, dashboard reads) surfaces per the locked principle. Old import path `@ouronet/ouronet-core/interactions/ouroFunctions` continues to work as a thin re-export shim.

- **REQ-14..REQ-17 / F-ARCH-003 — Phase 3 parameterized liquidity executor.** `executeAddLiquiditySingle`, `executeAddLiquidity`, `executeSpecialAddLiquidity`, `executeFuel`, `executeRemoveLiquidity` consolidated into 5 thin wrappers + 1 internal `executeLiquidityOp` (LOC reduction ~600 → ~200). Public function signatures preserved verbatim — zero consumer impact. Buffer-strategy reconciliation note (Phase 3 T3.5): _"spec text mentioned 3 buffer strategies; codebase has 2 distinct (`fixed-5k`, `auto-gas-limit`); the third is a degenerate no-rebuild sub-branch of `auto-gas-limit`, not a separate strategy. The 2-member union is technically correct."_

- **REQ-18..REQ-20 / F-API-002 — Phase 4 nullable contract honoring.** 12 swap-calc and dashboard-read functions whose declared return type was `Promise<T | null>` now honor that contract — they return `null` on RPC failure (with `logger.error` invoked first) instead of rethrowing. Affected functions include `getSWPairDashboardInfo`, `getPoolPreviewData`, `getSWPairMultiDashboardInfo`, `getSwpairInternalDashboard`, `calculateDirectSwap`, `calculateInverseSwap`, `calculateDirectSwapB`, `calculateInverseSwapB`, `getCappedInverseAmount`, `getUserAccountSupplies`, plus 2 additional dashboard-read functions. Carry-forward snippet (Phase 4 T4.4): _"The 10 swap-calc and dashboard-read functions whose declared return type was `Promise<T | null>` now honor that contract — they return null on RPC failure (with logger.error invoked first) instead of rethrowing. Existing try/catch consumer patterns continue to work. New code can rely on the static-type signature with the `if (result === null)` pattern."_

- **REQ-21..REQ-24 / F-API-018 — Phase 5 readonly sweep across ouronet-core public types.** Aggressive `readonly` modifier sweep across ~50 public type fields in `codex/types.ts` and all `*Params` interfaces. TypeScript-only signal — no runtime change.

- **REQ-27..REQ-30 / F-TEST-006 — Phase 7 coverage expansion.** +127 specs across 6 modules: `infoOneFunctions`, `coilFunctions`, `kpayFunctions`, `pensionFunctions`, `activateFunctions`, `guardFunctions`. The audit's stated 37 untested functions corrected to 38 (the 2026-05-05 audit missed `guardFunctions.describeKeyset`); absorbed by Phase 7 as +1 function = +3 it-blocks; closure transition is from "PARTIAL — 38 untested" → "CLOSED-VERIFIED".

### Added — NEW deliverable

- **REQ-31..REQ-34 / Phase 8 — INTEGRATION-GUIDE.md at repo root.** New comprehensive cold-start consumer onboarding doc at `Z:\OuronetCore\INTEGRATION-GUIDE.md` (sibling to `MIGRATION-v4.md` + `MIGRATION-v4.1.md` + `MIGRATION-v4.2.md`). 13 mandated sections covering the full v4.0 → v4.1 → v4.2 architectural arc: install + peer-deps, the 3-package atomic-release model, subpath imports per package, the 5 typed error classes, the 7-entity Ouronet taxonomy, the 3 pluggable seams (`setPactReader`, `KeyResolver`+`PactClient`, `BalanceResolver`), codex backup format `"1.2"`, smart-account auth, gas calibration, full quick-start example. Doc-validity test (`tests/v4-2-0-integration-guide-validity.test.ts`) verifies all cited subpaths resolve, all cited error classes import, all cited seam functions are exported.

### Test surface

- 8 new `v4-2-0-*.test.ts` files in this package: `dex-split-subpaths`, `ouro-split-subpaths`, `add-liquidity-executor-parity`, `f-api-002-null-contract`, `readonly-invariant`, `info-one-coverage`/`coil-coverage`/`kpay-coverage`/`pension-coverage`/`activate-coverage`/`guard-functions-coverage` (Phase 7 coverage expansion fans out to 6 module-specific files), `integration-guide-validity` (Phase 8 doc-validity test).
- Test count: ~330 (v4.1.1) → ~710 (v4.2.0). Aggregate growth: +127 from Phase 7 + ~250 from Phases 1-5 + 8 regression-lock specs.

### Version

- Atomic-triplet bump 4.1.1 → 4.2.0.
- Peer-deps `@stoachain/kadena-stoic-legacy` and `@stoachain/stoa-core` both aligned to `4.2.0`.

### Migration

- For consumers using the documented subpath APIs: most changes are transparent. The two consumer-visible deltas are (a) public-type fields are now `readonly` (TypeScript-only signal — switch in-place mutations to spread-copy patterns) and (b) the 12 nullable-contract functions reliably return `null` on failure (existing try/catch patterns continue to work; new code can use the `if (result === null)` pattern).
- See [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) for the full upgrade map and [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) for cold-start onboarding.

## 4.1.1 — 2026-05-08

### Added — typed error classes (v4.1.1 audit closures)
- `KadenaShapeError` (`src/interactions/errors.ts`, REQ-01 / F-ERR-022): RPC envelope shape-mismatch error. Mirrors `InvalidEnvelopeError` from stoa-core (extends Error with ES2022 `cause`).
- `CodexUnknownFieldError` and `UnknownSeedTypeError` (`src/codex/errors.ts`, REQ-08 / REQ-12): codex-domain validation errors.

### Changed — audit closures
- **REQ-01 (F-ERR-022):** `kadenaFunctions.ts` lines 16+27 — fabricated `?? "0"` and `|| "0"` fallbacks dropped. Now throws typed `KadenaShapeError` on shape-mismatched RPC envelopes. The legitimate `account || address` and `guard || null` fallbacks at lines 28-29 are preserved.
- **REQ-02 (F-API-005):** `getSublimateInfo` dedup — duplicate body at `ouroFunctions.ts:2148` removed and replaced with a `@deprecated` JSDoc compat shim that adapts the legacy `(patron, resident, amount-as-string)` signature to canonical form. Canonical at `infoOneFunctions.ts:179`. Shim removed in v4.2.0.
- **REQ-03 (F-API-006):** `describeKeyset` dedup — private duplicate at `urStoaFunctions.ts:89` removed. Helper `describeKeysetOrNull` preserves the two behaviors the canonical does NOT have: `pred ?? "keys-all"` coercion and map-keys-not-array-to-null. Canonical at `guardFunctions.ts:62`.
- **REQ-08 (F-SEC-007):** `deserializeCodex` rejects envelopes with unknown top-level fields (against KNOWN_TOP_LEVEL_FIELDS = {version, exportedAt, kadenaWallets, ouronetWallets, addressBook, uiSettings}).
- **REQ-12 (F-BUG-010):** `migrateSeedType` no longer silently returns `"koala"` for unknown seed types. Now throws `UnknownSeedTypeError`. The idempotence test at `codex-codec.test.ts:345-352` updated to drop `"garbage"` from the inputs array.
- **REQ-16 (F-API-014):** `getSparksBalance` return type narrowed from `Promise<any>` to `Promise<any | null>`.

### Test surface
- 11 new v4-1-1-*.test.ts files: kadena-no-fallbacks, codec-strict-shape, seed-type-strict, seed-type-dedup, sparks-balance-narrow, dist-structure, esm-roundtrip, type-preservation, doc-gates, migration-doc-validity, package-metadata, peer-dep-coverage, full-chain-integration, cross-package-version-pin, publish-workflow-simulation, coil-functions-memoization.
- Test count: ~245 → ~330 specs.

### Version
- Atomic-triplet bump 4.1.0 → 4.1.1.
- Peer-deps `@stoachain/kadena-stoic-legacy` and `@stoachain/stoa-core` both aligned to `4.1.1`.

### Migration
- See `MIGRATION-v4.1.md` v4.1.1 appendix for caller-impact details (typed throws replacing fallbacks, deprecation shim, new error classes).

## 4.1.0 — 2026-05-07

**MINOR — sovereign supply-chain migration (atomic with `@stoachain/stoa-core@4.1.0` + `@stoachain/kadena-stoic-legacy@4.1.0`).** Retargets every internal `@kadena/*` import in `src/interactions/` to the new sibling subpaths under [`@stoachain/kadena-stoic-legacy`](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy) — a sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship.

### Why

Post-Kadena-LLC, the StoaChain ecosystem cannot accept supply-chain risk on unmaintained upstream npm packages. v4.0.0 pinned the `@kadena/*` peer-deps to exact versions (no `^`) as prep work — v4.1.0 is the follow-through: drop the upstream peer-deps entirely, depend on the StoaChain-stewarded vendored sibling, lock the migration with a runtime regression test that fails if any `@kadena/*` literal sneaks back into source or built output.

### What changed

  - **12 imports retargeted across `src/interactions/`.** All 12 internal `@kadena/*` imports across the 13 `interactions/*` modules (`ouroFunctions`, `coilFunctions`, `pensionFunctions`, `guardFunctions`, `infoOneFunctions`, `wrapFunctions`, etc.) rewired to `@stoachain/kadena-stoic-legacy/{client,types}`. Each retarget preserves the imported symbol set byte-identically — `Pact`, `createClient`, `ICommand`, `IUnsignedCommand`, `ChainId` — the vendored module re-exports the upstream surface verbatim.
  - **Peer-deps trimmed.** Three `@kadena/*` peer-dep declarations (`@kadena/client@1.18.3`, `@kadena/cryptography-utils@0.4.4`, `@kadena/types@0.7.0`) removed from `package.json`. Single `@stoachain/kadena-stoic-legacy: "4.1.0"` exact-pin added. `@stoachain/stoa-core` peer-dep bumped `4.0.1 → 4.1.0` (atomic-version invariant — all three packages always release at the same version).
  - **Public function signatures unchanged.** Every interactions function (`getOuronetKdaDetails`, `getCoilPreviewGeneric`, every `pension*` / `guard*` / `infoOne*` / `wrap*` / `unwrap*` / `migrate*` builder) retains byte-identical shape. Consumers who import via `@ouronet/ouronet-core/interactions/*` see no breaking change.
  - **Regression-lock added.** `tests/v4-1-0-no-kadena-imports.test.ts` (43 specs) walks `dist/**/*.{js,d.ts}` + `src/**/*.ts` and asserts no `@kadena/*` literal occurs in any import statement, type reference, or string. Fails the CI build if a future regression silently reintroduces an upstream `@kadena/*` dependency.

### Tests

**261/261 pass** (was 218 in v4.0.1; +43 from the new regression-lock).

### Migration

For consumers importing through subpath, **no migration required** — every `interactions/*` and `pact/cfm` public surface keeps its byte-identical shape. The upstream `@kadena/*` peer-deps are gone from this package's `package.json`, but consumers who keep a direct dependency on those upstream packages in their own code are unaffected (npm dedupes the @kadena tree at the consumer level). See [`MIGRATION-v4.1.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.1.md) at the monorepo root for the full upgrade map.

## 4.0.1 — 2026-05-06

**PATCH, cosmetic (published-metadata cleanup).** Strips the redundant `devDependencies` block from `package.json`. Pre-v4.0.1 the published manifest carried a `devDependencies` block that contained `@stoachain/stoa-core: "*"` (workspace-resolution plumbing — meaningless on a published artifact since the `peerDependency` already pins `@stoachain/stoa-core@4.0.1`) plus duplicates of the `@kadena/*` peer entries. The npmjs.com page now shows the cleaner shape: zero `dependencies`, just the canonical `peerDependencies` (the @kadena/* set + `@stoachain/stoa-core@4.0.1` exact-pin). The peer-dep on `@stoachain/stoa-core` was bumped from `4.0.0` to `4.0.1` (atomic-version invariant — both packages always release at the same version). NO source-code change. NO behaviour change. NO breaking change. **218/218 tests pass** (regression-lock test `tests/package-version.test.ts` updated to assert `4.0.1`).

## 4.0.0 — 2026-05-06

**MAJOR, breaking (monorepo split + deprecated-alias removal).** v4.0.0 is the structural refactor that v3.3.8 set up. The single `@ouronet/ouronet-core` package was split into two atomic-release npm packages under the new `StoaChain/stoa-js` GitHub monorepo:

  - **[`@stoachain/stoa-core`](https://www.npmjs.com/package/@stoachain/stoa-core)** — chain-generic StoaChain foundation (signing, wallet, crypto, network failover, gas, guard, errors, observability, dalos, reads, pact-format).
  - **`@ouronet/ouronet-core`** (this package) — Ouronet protocol business logic (codex codec, interactions/* function library, `KADENA_NAMESPACE`, `STOA_AUTONOMIC_*` accounts, cfm Pact builders).

Both packages release atomically out of the monorepo at the same version — a single `vX.Y.Z` git tag publishes both.

### What this means for consumers

If you imported _only_ Ouronet-specific surfaces (codex, interactions, the `ouronet-ns` namespace), you can keep `@ouronet/ouronet-core` and just bump the version. If you imported chain-generic surfaces (signing, wallet, crypto, network, etc.), those moved to `@stoachain/stoa-core` — install both packages and update the import paths. See `MIGRATION-v4.md` at the monorepo root for the full upgrade map.

### Breaking removals

The deprecated aliases marked `@deprecated` in v3.3.8 were removed:

  - `KADENA_BASE_URL` — pinned to `node2.stoachain.com` and bypassed the v2.1.0 failover layer. Migration: `import { getPactUrl, getSpvUrl } from "@stoachain/stoa-core/constants"` (failover-aware, takes a chainId argument).
  - `PACT_URL` — same reasoning. Migration: `getPactUrl("0")`.
  - `GAS_STATION` — alias for `STOA_AUTONOMIC_OURONETGASSTATION`. Migration: rename consumer references to the canonical `STOA_AUTONOMIC_OURONETGASSTATION` (still exported from `@ouronet/ouronet-core/constants`).
  - `NATIVE_TOKEN_VAULT` — alias for `STOA_AUTONOMIC_LIQUIDPOT`. Migration: `STOA_AUTONOMIC_LIQUIDPOT`.

The `IKadenaKeypair` interface duplicate that lived in `interactions/ouroFunctions.ts` (Phase-2b backwards-compat copy) was also removed. The canonical source is `@stoachain/stoa-core/signing`. Migration: `import type { IKadenaKeypair } from "@stoachain/stoa-core/signing"`.

### Internal moves (transparent to consumers using subpath imports)

  - Chain-generic constants (`KADENA_NETWORK`, `KADENA_CHAIN_ID`, `STOA_CHAINS`, `STOA_CHAIN_COUNT`, `KADENA_CHAINS`, `getPactUrl`, `getSpvUrl`) moved to `@stoachain/stoa-core/constants`. Re-exported through `@ouronet/ouronet-core/constants` for source-level back-compat with internal `../constants` imports — direct `@ouronet/ouronet-core/constants` consumers continue to work, but new code SHOULD import them from `@stoachain/stoa-core/constants` to make the chain-generic vs Ouronet-specific boundary explicit.
  - `pact/cfmBuilders.ts` (the cfm Pact-code string assembler) stays under the `@ouronet/ouronet-core/pact` subpath because it uses `KADENA_NAMESPACE` (Ouronet-specific). The chain-generic `formatDecimalForPact` / `formatIntegerForPact` / `mayComeWithDeimal` / `filterFreePositionData` / `formatEU` / `safeCreationTime` helpers now live in `@stoachain/stoa-core/pact`. Consumers of the chain-generic helpers should import from `@stoachain/stoa-core/pact`; consumers of cfm builders continue to import from `@ouronet/ouronet-core/pact`.

### Dependency hardening

All `@kadena/*` peer/dev deps + `@noble/curves` + `@scure/bip39` + `@ouronet/dalos-crypto` pinned to exact versions (no `^` ranges). This is the prep work for v4.1.0's selective `@kadena/client` vendoring (supply-chain hardening after Kadena LLC's dissolution) — pinning first means we can audit the exact bytes a consumer pulls in.

### Tests

703/703 passing across the two packages (485 in `@stoachain/stoa-core`, 218 in `@ouronet/ouronet-core`). The v3.3.8 regression-lock test file split — F-ARCH-011/F-ARCH-012 locks now live in `@stoachain/stoa-core/tests/v3-3-8-doc-cleanup.test.ts` (their SUTs are stoa-core-side); F-API-016 lock stays in `@ouronet/ouronet-core/tests/v3-3-8-doc-cleanup.test.ts` (CoilConfig is ouronet-core-side).

## 3.3.8 — 2026-05-06

**MINOR, additive (documentation/deprecation cleanup pass).** Closes 5 LOW-severity findings from the 2026-05-05 audit's `"v3.x deprecation cleanup"` + `"v3.x conventions alignment"` + `"v3.x API hygiene"` themes in a single bundled release. **One new public-API export** (`CoilConfig` interface, previously consumed but un-exported), **one `@deprecated` marker** (`KADENA_BASE_URL` redirecting consumers to the failover-aware reader), **two doc fixes** (stale JSDoc + import-discipline cleanup), **one stylistic cleanup** (single-quote → double-quote drift in dalos/account.ts). **NO breaking change**, **NO observable runtime behavior change**, **698/698 tests pass** (was 695 in v3.3.7; +3 from the new `tests/v3-3-8-doc-cleanup.test.ts` regression-lock file).

### F-API-015 — Stale `strict` JSDoc parameter mention

`src/dalos/account.ts:42-45` previously documented a `strict` parameter on `CreateAccountOptions` that the type union never had. v3.3.8 rewrites the JSDoc to document the actual mode-vs-primitive contract: if the selected primitive doesn't support the requested `mode` (e.g. `bitmap` on a non-DalosGenesis primitive), `createOuronetAccount` throws a descriptive error from the call site — there is no opt-out flag. Consumers wrap the call in their own try/catch if they want a non-throwing fallback.

Pure docstring change. No runtime regression to lock. The CHANGELOG entry is the audit trail.

### F-API-016 — Export `CoilConfig` interface

`src/interactions/coilFunctions.ts:17` previously declared `interface CoilConfig` (no `export`). The interface backs the exported `COIL_CONFIGS` constant, so consumers reaching into `COIL_CONFIGS.ouroToAuryn` got a value of type `CoilConfig` but couldn't TYPE-ANNOTATE a parameter or local with `CoilConfig` themselves without re-declaring the shape. v3.3.8 adds `export`. One-word change.

```ts
// Now works:
import { CoilConfig, COIL_CONFIGS } from "@ouronet/ouronet-core/interactions/coilFunctions";

function describeCoil(config: CoilConfig): string {
  return `${config.sourceToken} → ${config.targetToken}`;
}
```

Locked at `tests/v3-3-8-doc-cleanup.test.ts` T1: `expectTypeOf<CoilConfig>().toEqualTypeOf<{...}>()` — if a future edit drops the `export`, TS errors at typecheck time and the test fails to compile.

### F-SEC-005 / F-ARCH-014 — Mark `KADENA_BASE_URL` `@deprecated`

`src/constants/kadena.ts:17` exports `KADENA_BASE_URL = "https://node2.stoachain.com/chainweb/0.0/${KADENA_NETWORK}"` — pinned to node2, bypassing the failover layer added in v2.1.0. Direct consumers reading this constant lose node-recovery + node-degradation handling. v3.3.8 adds a prominent `@deprecated` JSDoc redirecting to `getActivePactUrl(chainId)` / `getActiveSpvUrl(chainId)` (or the same-subpath thin wrappers `getPactUrl(chainId)` / `getSpvUrl(chainId)`). The constant itself is preserved for consumer backwards-compat — removal is scheduled for v4.0.0; consumers reading it directly should migrate before the major bump.

The TypeScript compiler emits `Type 'string' is deprecated` warnings to consumers reading the constant directly when their `tsconfig` has `"reportsDeprecated": true` (or via TS-Server / IDE indicators). Consumers who never read the constant directly (the recommended pattern — they call `getPactUrl(chainId)` instead) see no change.

Pure JSDoc change. No runtime regression to lock.

### F-ARCH-011 — Consolidate `normalizeKeysetRef` import to `../guard` barrel

`src/interactions/ouroFunctions.ts:10` previously deep-imported:

```ts
import { IKeyset } from "../guard";
import { normalizeKeysetRef } from "../guard/smartAccountAuth";  // deep import
```

Inconsistent with the project's subpath-import discipline — every other consumer of `normalizeKeysetRef` reaches through the `../guard` barrel (which already re-exports `* from "./smartAccountAuth"`). v3.3.8 consolidates:

```ts
import { IKeyset, normalizeKeysetRef } from "../guard";
```

Behaviorally identical (same symbol, same module). Locked at `tests/v3-3-8-doc-cleanup.test.ts` T2: imports `normalizeKeysetRef` through the barrel and smoke-calls it with a `keysetref`-shaped object, asserting the round-trip works. Catches a regression that drops the `export *` line in `src/guard/index.ts` (which would also break ouroFunctions.ts).

### F-ARCH-012 — Single-quote → double-quote drift in `src/dalos/account.ts`

`src/dalos/account.ts` was the only file in `src/` still using single-quoted string literals (the `CreateAccountMode` discriminator labels `'random'` / `'bitString'` / etc., the typeof guard string `'function'`, the fallback string `'(default)'` — 19 sites total). v3.1.1 fixed `src/dalos/index.ts` but missed account.ts. v3.3.8 converts all 19 sites to double quotes, matching the rest of the project.

Pure stylistic change — TypeScript treats `'random'` and `"random"` as identical string literals at the type level. No observable behavior change.

Locked at `tests/v3-3-8-doc-cleanup.test.ts` T3: reads `src/dalos/account.ts` source verbatim, walks each line, strips JSDoc + single-line comments (English apostrophes in `registry's` / `doesn't` are exempt), and asserts no single-quote characters remain in the code-only portion. A future edit that introduces single-quoted string literals fails the test.

### Added — `tests/v3-3-8-doc-cleanup.test.ts` (3 it-blocks across 3 describe groups)

| Test | Closes | What regression it catches |
|---|---|---|
| **T1** (F-API-016) | `CoilConfig` type export | Future edit drops `export` keyword → TS typecheck fails on the import line |
| **T2** (F-ARCH-011) | `normalizeKeysetRef` barrel reachability + smoke-call | Future edit removes `export *` from `src/guard/index.ts` → import fails OR function shape changes |
| **T3** (F-ARCH-012) | Quote-style invariant on `src/dalos/account.ts` | Future edit introduces single-quoted string literals → grep walker fails the test |

F-API-015 (stale JSDoc) and F-SEC-005/F-ARCH-014 (`@deprecated` marker on `KADENA_BASE_URL`) are pure JSDoc changes that don't surface at runtime — no test added. The CHANGELOG entry is the audit trail.

### Verified

- `npm run typecheck` — zero errors. The new `CoilConfig` export type-checks cleanly across the three import sites that consume it (`getCoilPreviewGeneric`, `coilTokensGeneric`, the new test file). The `@deprecated` JSDoc on `KADENA_BASE_URL` is well-formed (TS picks it up as a deprecation indicator at consumer usage sites).
- `npm test` — **698/698 tests pass** (was 695 in v3.3.7; +3 from `tests/v3-3-8-doc-cleanup.test.ts`).
- `npm run build` — clean tsc emit. Change surface is `src/dalos/account.ts` (JSDoc rewrite + 19 quote-style edits), `src/interactions/coilFunctions.ts` (added `export`), `src/constants/kadena.ts` (`@deprecated` JSDoc), `src/interactions/ouroFunctions.ts` (consolidated imports — 1 line removed, 1 line edited).

### Migration

No consumer migration. The package's pre-v3.3.8 public API surface is byte-identical (with one ADDITION — the `CoilConfig` type export). Two consumer-side notes:

- **Consumers reading `KADENA_BASE_URL` directly** see a TypeScript deprecation warning in IDEs / on `tsc` runs with `"reportsDeprecated": true`. They are encouraged to migrate to `getPactUrl(chainId)` / `getSpvUrl(chainId)` (failover-aware) before v4.0.0, when `KADENA_BASE_URL` is scheduled for removal. Consumers using the recommended `getPactUrl(chainId)` pattern see no change.
- **Consumers using `CoilConfig` as a type annotation** can now import the type by name from `@ouronet/ouronet-core/interactions/coilFunctions` (previously they had to re-declare the shape inline).

### v3.3.x trajectory remaining (post-v3.3.8)

- **v3.3.9 / v3.4.0** — Dependency-hygiene release (pin exact versions of `@kadena/*` peerDeps; possibly vendor `@kadena/types` per the supply-chain risk discussion). Per the user's sequencing decision: this is the next planned release after v3.3.8.
- **v4.0.0** — Major structural release (monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`; god-file decomposition; F-ARCH-009 21-site GAS_STATION migration; F-ARCH-010 IKadenaKeypair canonical-source consolidation; F-ARCH-003 helper extract; F-PERF-014 sleep-to-state-poll; KADENA_BASE_URL removal; the bigger fork-into-stoachain-scope work for `@kadena/cryptography-utils` / `@kadena/client` / `@kadena/hd-wallet`).

The v3.3.x audit-closure track now spans **testing + performance + security + documentation** categories. Remaining items in the audit are either reserved for v4.0.0 (arch + sleep replacement) or are NEEDS CONTEXT findings flagged for human review (F-ERR-014 multi-step add-liquidity timeout, F-API-018 readonly modifiers, F-BUG-006 ad-hoc decimal formatter, F-BUG-008 Σ-prefix validation in CodexSigningStrategy).

---

## 3.3.7 — 2026-05-06

**MINOR, additive (security pass).** Closes two MEDIUM security findings from the 2026-05-05 audit in a single bundled release: **F-SEC-003** (seam-setter input validation) and **F-SEC-004** (V1-fallback security advisory). Three new public-API additions (`InvalidPactReaderError`, `InvalidLoggerError`, `decryptStringV2WithDetails` + `smartDecryptWithDetails` + `DecryptResultWithDetails` + a one-shot `getLogger().warn(...)` advisory inside the V1-decrypt path). All changes preserve byte-identical backwards-compat with v3.3.6 — existing consumer code that calls `setLogger({warn, error})` (v3.2.x compat path) or catches `instanceof TypeError` continues to work. **NO breaking change**, **695/695 tests pass** (was 674 in v3.3.6; +21 from two new test files).

### F-SEC-003 — Seam-setter input validation

Pre-v3.3.7 the two pluggable seams had inconsistent guards:

- `setPactReader(fn)` accepted **any** value (including `undefined`, `null`, numbers, plain objects). The misconfiguration only surfaced later as a confusing `_reader is not a function` at the first `pactRead(...)` call site, often far from the boot wiring that installed the bad value. v3.3.7 adds a `typeof reader !== "function"` guard that throws **`InvalidPactReaderError`** with a clear message naming the actual type passed (`received undefined`, `received null`, `received number`, etc.).

- `setLogger(logger)` only guarded `null`/`undefined`. Passing an object whose `warn` or `error` was non-callable (a typo'd field name, a half-finished test fixture, an `undefined` property access) silently installed the bad logger; the error surfaced later as `_logger.warn is not a function` at the first catch-block routing site. v3.3.7 adds shape validation that throws **`InvalidLoggerError`** with messages naming the specific invariant violated (`logger.warn must be a function`, `logger.error must be a function`, etc.).

Both new error classes extend `TypeError` so existing consumer `catch (e) { if (e instanceof TypeError) ... }` code is unchanged. The pre-v3.3.7 null/undefined message text on `setLogger` (`"setLogger requires a non-null Logger"`) is preserved verbatim — the v3.3.0 contract test at `tests/observability-logger.test.ts:68-80` that locks the byte-identical message continues to pass.

```ts
// New typed errors:
import { InvalidPactReaderError } from "@ouronet/ouronet-core/reads";
import { InvalidLoggerError } from "@ouronet/ouronet-core/observability";

// Caught at boot now, not at first call site:
try {
  setPactReader(myReader);
} catch (e) {
  if (e instanceof InvalidPactReaderError) {
    console.error("PactReader misconfigured:", e.message);
  }
}
```

### F-SEC-004 — V1-fallback security advisory

V1 envelopes use **PBKDF2-SHA256 / 10,000 iterations / AES-GCM-256**. OWASP's password-storage cheat sheet (2023+) recommends a PBKDF2-SHA256 minimum of **600,000** iterations — V1 is meaningfully crackable on commodity GPU hardware in ways the V2 envelope (PBKDF2-SHA512 / 600,000 iterations) is not. V1 lingers in the codebase for backwards-compat: codex backups exported before the V2 upgrade still parse via the V1 path inside `decryptStringV2` (envelopes lacking `v: 2`) and the V1 primitive route inside `smartDecrypt`.

Pre-v3.3.7 these paths were silent — consumers had no way to detect that a successful decrypt had used legacy-strength KDF parameters, and could not surface "your codex uses outdated encryption" UI banners or trigger in-place re-encrypt flows. v3.3.7 ships:

#### One-shot `getLogger().warn(...)` advisory

Fires on the FIRST V1 decrypt per process lifetime:

```
[ouronet-core/crypto] V1-format encrypted blob decoded successfully.
V1 uses PBKDF2-SHA256 at 10,000 iterations, well below OWASP's current
600,000 minimum (cracked meaningfully faster on commodity GPU hardware).
Re-encrypt affected codex entries to V2 (PBKDF2-SHA512 / 600,000) at the
earliest opportunity. Use `decryptStringV2WithDetails` or
`smartDecryptWithDetails` for the per-call `wasLegacyV1` flag. This
warning fires once per process lifetime.
```

The one-shot guard prevents bulk-decrypt log spam — a codex with 100 V1 entries logs **one** warning, not 100. Consumers wanting per-call programmatic detection use the new `*WithDetails` variants (below).

The advisory fires from BOTH code paths that reach V1: `decryptStringV2`'s V1-fallback branch (envelopes lacking `v: 2`) AND `smartDecrypt`'s shape-dispatch path that short-circuits to the V1 primitive. Without the duplicate hook in `smartDecrypt`, codex unlocks via the auto-detect entry point would silently skip the warning.

#### `decryptStringV2WithDetails(blob, password): Promise<{plaintext, wasLegacyV1}>`

Same failure contract as `decryptStringV2` (`CorruptEnvelopeError` / `WrongPasswordError`), but returns the rich shape so consumers can react programmatically per call:

```ts
import { decryptStringV2WithDetails } from "@ouronet/ouronet-core/crypto";

const result = await decryptStringV2WithDetails(blob, password);
if (result.wasLegacyV1) {
  // Re-encrypt to V2 in-place:
  const upgraded = await encryptStringV2(result.plaintext, password);
  await codexAdapter.replace(blobId, upgraded);
}
```

#### `smartDecryptWithDetails(blob, password): Promise<{plaintext, wasLegacyV1}>`

Mirrors `smartDecrypt`'s shape-dispatch (V2 envelopes via `decryptStringV2`, non-V2 via the V1 primitive). The single best entry point for "decrypt this codex entry AND tell me whether it was a V1 envelope so I can re-encrypt next."

#### JSDoc CVE-style risk documentation

Added prominent security blocks to:

- `EncryptedDataV1` interface JSDoc — full OWASP context, why V1 lingers, recommended upgrade path
- `decryptStringV2` function JSDoc — V1-fallback path advisory + cross-references to the new variants
- The `EncryptedDataV1` JSDoc references the in-place re-encrypt pattern so future contributors reading the source see the security context inline

### Added — `tests/v3-3-7-seam-validators.test.ts` (11 it-blocks across 3 describe groups)

| Group | Count | What it locks |
|---|---|---|
| **`setPactReader` input validation** | 4 | rejects `undefined` / `null` / non-function (number/string/object) → `InvalidPactReaderError`; accepts a valid `PactReader` function (no throw + replaces the seam) |
| **`setLogger` input-shape validation** | 5 | rejects `null` / `undefined` with the byte-identical pre-v3.3.7 message; rejects non-object inputs (string, number); rejects `{warn: undefined, error: () => {}}` naming the warn invariant; rejects `{warn: () => {}, error: 'oops'}` naming the error invariant — all via `InvalidLoggerError` |
| **`setLogger` backwards-compat preservation** | 2 | v3.3.0+ full-shape `{warn, error, info}` still installs cleanly with reference identity preserved; v3.2.x partial-shape `{warn, error}` (no info) still installs cleanly with synthesised `info` |

### Added — `tests/v3-3-7-v1-warning.test.ts` (10 it-blocks across 3 describe groups)

| Group | Count | What it locks |
|---|---|---|
| **`decryptStringV2WithDetails`** | 3 | V2 envelope → `wasLegacyV1: false`; V1 envelope → `wasLegacyV1: true` AND plaintext correct; `WrongPasswordError` propagates from the rich variant (failure contract unchanged) |
| **`smartDecryptWithDetails`** | 2 | V2 envelope routes via `decryptStringV2` → `wasLegacyV1: false`; V1 envelope routes via the V1 primitive → `wasLegacyV1: true` |
| **One-shot warning behavior** | 5 | first V1 decrypt via `decryptStringV2` emits the security-advisory `getLogger().warn(...)`; second V1 decrypt is **silent** (one-shot guard intact — load-bearing for bulk-codex-decrypt UX); V2 decrypts NEVER emit the warning; `smartDecrypt`'s short-circuit path also emits the warning (separate code path needs its own hook); rich `*WithDetails` variants emit the warning identically (delegation chain intact) |

The V1-warning tests use the internal `_resetV1WarningEmittedForTests()` helper (NOT exported via the public barrel) to reset the one-shot guard between tests. Production code never calls this — the warning is intentionally one-shot per process lifetime.

### Verified

- `npm run typecheck` — zero errors. The new `InvalidPactReaderError` / `InvalidLoggerError` / `DecryptResultWithDetails` types compile cleanly. `decryptStringV2WithDetails` and `smartDecryptWithDetails` delegate to the existing primitives with no shape change to the underlying functions.
- `npm test` — **695/695 tests pass** (was 674 in v3.3.6; +21 from `tests/v3-3-7-seam-validators.test.ts` (11) + `tests/v3-3-7-v1-warning.test.ts` (10)).
- `npm run build` — clean tsc emit. The change surface is `src/reads/pactReader.ts` (added error class + 3-line guard), `src/observability/logger.ts` (added error class + 4-clause shape guard), `src/crypto/v2.ts` (added one-shot guard + 2 rich variants + JSDoc + warning hooks at 2 V1 paths), `src/crypto/index.ts` (3 new exports).

### Migration

No consumer migration required. The package's pre-v3.3.7 public API surface is byte-identical: `setPactReader(validFn)` works unchanged; `setLogger({warn, error})` works unchanged with the v3.3.0-synthesised info; `decryptStringV2(...)` and `smartDecrypt(...)` return the same `Promise<string>` and throw the same error classes.

The new APIs are purely additive:

- Consumers wanting the per-call `wasLegacyV1` signal opt in by switching `decryptStringV2` → `decryptStringV2WithDetails` (or `smartDecrypt` → `smartDecryptWithDetails`). The plain functions keep returning `Promise<string>` for ergonomic call sites that don't care.
- The one-shot `getLogger().warn(...)` advisory fires automatically with no opt-in. Consumers using a structured logger (OuronetUI's redux-devtools, HUB's pino) see the warning routed through their pipeline; consumers with no `setLogger` call see it on `console.warn` (the seam's default).

Two error-handling notes for callers who are STRICT about narrowing:

- `setPactReader(notAFunction)` **previously** silently installed the bad value. v3.3.7+ throws `InvalidPactReaderError`. Code that defensively wrapped the call to swallow errors no longer needs to (the throw catches the misconfiguration earlier). Code that NEVER wrapped is unaffected (it would never trigger the throw because it was passing valid functions all along).
- `setLogger({warn: undefined, ...})` **previously** silently installed the bad value. v3.3.7+ throws `InvalidLoggerError`. Same reasoning as above.

### v3.3.x trajectory remaining (post-v3.3.7)

With v3.3.7 every MEDIUM finding from the 2026-05-05 audit's testing AND performance AND **security-input-validation** categories is closed. The track:

| Release | Findings | Track |
|---|---|---|
| v3.3.0 | F-LOGGER-SEAM-001 | logger seam |
| v3.3.2 | F-TEST-002 | testing |
| v3.3.4 | F-TEST-005 | testing |
| v3.3.5 | F-TEST-006 | testing |
| v3.3.6 | F-PERF-008, F-PERF-003, F-PERF-004 | performance |
| v3.3.7 | F-SEC-003, F-SEC-004 | security |

Plus v3.3.1 (workflow patches) + v3.3.3 (multi-party signing public surface).

- **v3.3.8** (planned) — Documentation/deprecation cleanup pass: KADENA_BASE_URL deprecation marker, `CreateAccountOptions` JSDoc fix, possibly other low-hanging doc tidies.
- **v3.3.9 / v3.4.0** (planned) — Dependency-hygiene: pin exact versions of `@kadena/*` peerDeps, possibly vendor `@kadena/types` per the supply-chain risk discussion.
- **v4.0.0** — Major structural release (monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`, god-file decomposition including `infoOneFunctions`'s 23 exports → multi-file split, type consolidation, F-ARCH-003 helper extract, F-PERF-014 sleep-to-state-poll, and the bigger fork-into-stoachain-scope work for `@kadena/cryptography-utils` / `@kadena/client` / `@kadena/hd-wallet`).

Remaining non-test/perf/sec MEDIUMs after v3.3.7: F-ARCH-003 (executeLiquidityPipeline helper — natural for v4.0.0 god-file split), F-ARCH-004/008 (type duplication + Phase 3b strategy migration — multi-minor), F-PERF-014 (3-second sleeps → state polling — natural for v4.0.0 submit-flow refactor), and 4 NEEDS CONTEXT findings (F-ERR-014 multi-step add-liquidity timeout, F-API-018 readonly modifiers, F-BUG-006 ad-hoc decimal formatter, F-BUG-008 Σ-prefix validation in CodexSigningStrategy) flagged for human review per the audit roadmap.

---

## 3.3.6 — 2026-05-06

**MINOR, additive (performance pass).** Closes three MEDIUM performance findings from the 2026-05-05 audit in a single bundled release: **F-PERF-008** (tree-shaking guarantee via `"sideEffects": false`), **F-PERF-003** (regex memoization in `coilFunctions.getCoilPreviewGeneric`), and **F-PERF-004** (parallelize `ouroFunctions.getOuronetKdaDetails`). All three are low-risk, behaviorally identical to v3.3.5; the change surface is two source files + one package.json field + one new regression-lock test file. **NO public API change**, **NO observable behavior change**, **674/674 tests pass** (was 672 in v3.3.5; +2 from the new `tests/v3-3-6-perf-pass.test.ts`).

### F-PERF-008 — Added `"sideEffects": false` to package.json

The biggest tree-shaking win available to consumer bundlers per the audit. Before v3.3.6, downstream bundlers (OuronetUI's webpack/Vite) couldn't prune unused barrel imports from the package's 16-subpath exports map, because they had to assume every imported module might have side effects at top-level. With this flag, bundlers know they can safely drop any imported module whose exports aren't actually used.

Verified safe before adding the flag: every seam in the package (`setPactReader` in `src/reads`, `setLogger` in `src/observability`, `setNodeConfig` in `src/network/nodeFailover`) is **consumer-invoked at boot** — none of them runs at module top-level. Confirmed by grepping `src/` for top-level callable statements (zero matches). Module evaluation only declares functions and constants; it does not mutate global state.

Consumer-side impact: OuronetUI's bundle should shrink for paths that import a single function from a barrel (e.g. `import { analyzeGuard } from "@ouronet/ouronet-core/guard"` previously pulled in the entire `./guard` module's evaluated code; with `sideEffects: false` it pulls only `analyzeGuard`'s code). The exact savings depend on the consumer's bundler config, but the audit cited this as "the single most impactful tree-shaking fix in the codebase."

Locked at `tests/v3-3-6-perf-pass.test.ts` T1: `expect(pkg.sideEffects).toBe(false)` — strict equality with literal `false`. A future package.json edit that drops the field, sets it to `true`, or sets it to a string/array all fail the check.

### F-PERF-003 — Memoized 8 RegExp allocations per call in `coilFunctions.getCoilPreviewGeneric`

Pre-v3.3.6, `getCoilPreviewGeneric` compiled 8 `RegExp` objects every call (4 for the `pre-text` array parsing, 4 for the `post-text` array fallback). The patterns interpolate `targetTokenName` (derived from `config.targetToken`), so the audit's literal suggested fix ("hoist each regex to a module-level const") doesn't apply directly — the patterns are dynamic per token. v3.3.6 adopts the **memoization-cache** form which achieves the same outcome: subsequent calls with the same `targetTokenName` reuse the compiled `RegExp` instances from a `Map<string, CoilPatternSet>` cache.

```ts
// New module-level cache + lazy-compile helper:
const coilPatternCache = new Map<string, CoilPatternSet>();
function getCoilPatterns(targetTokenName: string): CoilPatternSet {
  const cached = coilPatternCache.get(targetTokenName);
  if (cached) return cached;
  // ... compile 8 patterns once, cache, return ...
}

// Inside getCoilPreviewGeneric (no more `new RegExp(...)` calls):
const patterns = getCoilPatterns(targetTokenName);
for (const pattern of patterns.generates) { ... }
for (const pattern of patterns.generating) { ... }
```

Steady-state allocation cost: 0 RegExp objects per call after the cache warms (one warm-up call per unique target token). For the 3 standard `COIL_CONFIGS` entries (`AURYN`, `ELITEAURYN`, `SSTOA`), the cache size caps at 3. The Map structure handles arbitrary token names too, so consumer-supplied custom configs benefit equally.

Behavior is byte-identical to v3.3.5 — same patterns in the same order. Behavioral regression coverage already lives in `tests/v3-3-5-smoke.test.ts:117-141` which exercises `getCoilPreviewGeneric` with `COIL_CONFIGS.ouroToAuryn` and asserts the parsed `targetAmount === 5.0` from `pre-text: ["...generates 5.0 AURYN tokens"]`. That test passes unchanged in v3.3.6.

### F-PERF-004 — Parallelized `getOuronetKdaDetails` via Promise.all

Pre-v3.3.6:
```ts
const owner = await getKadenaAccountOwner(address);   // sequential
const guard = await getKadenaAccountGuard(address);   // (waits for owner)
```

v3.3.6:
```ts
const [owner, guard] = await Promise.all([
  getKadenaAccountOwner(address),
  getKadenaAccountGuard(address),
]);
```

Verified safe: `getKadenaAccountOwner` reads `DALOS.UR_AccountKadena`, `getKadenaAccountGuard` reads `DALOS.UR_AccountGuard` — neither depends on the other's result, no shared mutable state, no causal ordering. Both throw the same `Error("Failed to retrieve data from the transaction.")` on RPC failure, so error semantics are identical (Promise.all rejects with the first rejection — which would be the same error consumers saw in the sequential form).

Happy-path latency: was 2 sequential RPC roundtrips (the chain has to respond to the owner read before the guard read even starts), now 1 parallel roundtrip (both reads in flight simultaneously). On the typical Stoa network (~150-300ms per chain RPC), this halves the function's wall-clock duration to ~150-300ms. Consumer-side impact: UR-detail panels in OuronetUI render visibly faster.

One trade-off worth noting: the parallel form always issues both RPCs even when the first might have failed. The sequential form short-circuited on owner failure. With the failover layer absorbing transient RPC cost, this is a net win — but worth flagging for future contributors that the change is not strictly cost-free on the unhappy path.

Locked at `tests/v3-3-6-perf-pass.test.ts` T2: a counting reader that dispatches different stub payloads by Pact-code substring (`UR_AccountKadena` vs `UR_AccountGuard`). The test asserts both substrings appeared in the recorded calls AND the function returned the expected merged shape. A regression that accidentally drops one of the reads (e.g. only awaits `owner`) would fail loudly because the recorded calls would only contain one substring.

### Added — `tests/v3-3-6-perf-pass.test.ts` (2 it-blocks across 2 describe groups)

| Test | Locks | What regression it catches |
|---|---|---|
| **T1** (F-PERF-008) | `package.json` declares `sideEffects: false` | Future package.json edit drops field / changes type → CI fails before npm publish |
| **T2** (F-PERF-004) | `getOuronetKdaDetails` issues both `UR_AccountKadena` AND `UR_AccountGuard` reads | Future refactor accidentally drops one of the reads (e.g. await only `owner`, not `guard`) → CI fails because the recorded Pact-code calls only contain one substring |

F-PERF-003 (regex memoization) is NOT directly locked in this file because the cache is module-internal (not exported). Behavioral regression coverage lives in v3.3.5's `tests/v3-3-5-smoke.test.ts` for `getCoilPreviewGeneric`; if memoization broke pattern compilation OR matching, that test would fail. Currently it passes.

### Verified

- `npm run typecheck` — zero errors. The new `CoilPatternSet` interface and `coilPatternCache` Map both type-check cleanly; `Promise.all` destructuring preserves the existing return-type contract.
- `npm test` — **674/674 tests pass** (was 672 in v3.3.5; +2 from the new `tests/v3-3-6-perf-pass.test.ts`).
- `npm run build` — clean tsc emit. The change surface is `package.json` (1 field), `src/interactions/coilFunctions.ts` (cache + helper added, regex blocks replaced), `src/interactions/ouroFunctions.ts` (1 function body parallelized).
- `package.json` validates as JSON post-edit; `dist/package.json` is not ours (npm-side); the `sideEffects` flag travels with the published tarball via `files: ["dist", "CHANGELOG.md"]` (npm includes `package.json` automatically).

### Migration

No consumer migration. The package's public API surface is byte-identical to v3.3.5: same exports, same shapes, same return types, same error semantics. v3.3.6 is purely a performance pass; consumers see:

- **Smaller bundle sizes** when consuming via webpack/Vite/Rollup (F-PERF-008 enables tree-shaking pruning of unused barrel re-exports). Exact savings consumer-config-dependent.
- **Faster `getOuronetKdaDetails`** (F-PERF-004 — ~halved latency on the happy path).
- **No observable difference** for `getCoilPreviewGeneric` (F-PERF-003 — internal-only optimization; behavior identical).

### v3.3.x trajectory remaining

The v3.3.x audit-closure track now has 6 of the original 6 audit-closure releases done (v3.3.0/2/4/5 testing + logger; v3.3.6 performance). v3.3.1 + v3.3.3 were workflow patches and a new public surface respectively.

- **v3.3.7+** — Optional: small dependency-hygiene + doc-cleanup pass (KADENA_BASE_URL deprecation marker, `CreateAccountOptions` JSDoc, possibly pinning `@kadena/*` peerDeps). Or skip and go straight to v4.0.0.
- **v4.0.0** — Major structural release (monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`, god-file decomposition including `infoOneFunctions`'s 23 exports → multi-file split, type consolidation, F-ARCH-003 helper extract, and the bigger fork-into-stoachain-scope work for `@kadena/cryptography-utils` / `@kadena/client` / `@kadena/hd-wallet`).

Remaining unaddressed MEDIUM findings post-v3.3.6 are: F-PERF-014 (3-second sleeps replaced with state polling — naturally folds into v4.0.0's submit-flow refactor), F-ARCH-003 (executeLiquidityPipeline helper — natural for v4.0.0 god-file split), F-ARCH-004/008 (type duplication + Phase 3b strategy migration — multi-minor migration work), F-SEC-003/004 (seam validators + V1-decrypt warning — small, additive, fits a v3.3.7 if user wants).

---

## 3.3.5 — 2026-05-06

**MINOR, additive (test-only).** Closes audit finding **F-TEST-006** (MEDIUM, testing-auditor) — six interaction modules previously had insufficient runtime coverage: three with **zero runtime tests at all** (`pensionFunctions`, `guardFunctions`, `infoOneFunctions`) and three with **compile-only tests** (`coilFunctions`, `kpayFunctions`, `activateFunctions` are all type-checked at `tests/types.test.ts:44-47` via `expectTypeOf`, but the functions never actually execute in the test suite). v3.3.5 closes the gap with `tests/v3-3-5-smoke.test.ts` — **12 new it-blocks across 6 describe groups**, one happy-path + one error-path test per module, picking the simplest representative read-only function from each. **NO source-code change**, **NO public API change**, **672/672 tests pass** (was 660 in v3.3.4; +12 from the new test file).

### Why this is MEDIUM-severity even though no current bug

Compile-only tests (`expectTypeOf<typeof fn>().toEqualTypeOf<...>()`) prove the function's TYPE SIGNATURE matches consumer expectations but do NOT prove the function executes correctly. A bug that swapped two argument-string concatenations, forgot to await a Promise, or mis-routed the `pactRead` call would all type-check cleanly while producing wrong runtime behaviour — the tests pass, the chain rejects the malformed Pact code at consumer runtime, the failure surfaces as "transaction reverted" with no clear linkage back to the broken function. v3.3.5 makes that class of regression catchable in CI: a single happy-path runtime test per module asserts "function actually executes against a stubbed `pactRead`," and a single error-path runtime test asserts "graceful-degradation contract holds" (which for 5 of the 6 modules is `null`, and for `pensionFunctions.getHibernateFee` is a locally-computed fallback formula).

The audit's testing-auditor flagged this as MEDIUM because the gap was structural — three full modules had zero runtime tests, and three more had only type-level coverage despite shipping production interaction code. Landing this BEFORE v4.0.0's monorepo restructure means the v4.0.0 file-relocation refactor (which moves `src/interactions/*` into `packages/stoa-core/`) cannot accidentally break any of the 6 modules' runtime contracts — the regression-lock travels with the test file.

### Added — `tests/v3-3-5-smoke.test.ts` (12 it-blocks across 6 describe groups)

| Module | Function tested | Happy path | Error path |
|---|---|---|---|
| **`pensionFunctions`** | `getHibernateFee("pool", 100)` | `{decimal:"0.99"}` → `0.99` | thrown read → catch's local fallback formula `0.12 - 0.000008 * lockDays` clamped non-negative → `0.1192` (the ONLY one of the 6 modules with a non-null error path — graceful-degradation contract that lets pension UI show a sensible default fee even when the chain function isn't deployed yet) |
| **`guardFunctions`** | `getRotateGuardInfo("k:p", "k:a")` | success-path data returned verbatim | failure-status reader → `null`, `getLogger().error` not called (chain-failure-status path is silent by design — only the catch block routes through the logger) |
| **`infoOneFunctions`** | `getCoilPreviewInfo(p, c, ats, t, "100")` | `{previewField:1, ...}` → `{result: {previewField:1, ...}}` (the `{result: ...}` envelope is the function's defining shape — locks the wrap-in-envelope contract) | failure-status reader → `null` |
| **`coilFunctions`** | `getCoilPreviewGeneric("100", COIL_CONFIGS.ouroToAuryn)` | data with `pre-text: ["...generates 5.0 AURYN tokens"]` + `kadena: {...}` → parsed `{targetAmount: 5.0, fee: 0, kadenaInfo: {...}}` (locks the regex-based pre-text parse against the v2.x token-name patterns) | failure-status reader → **rethrows** with `/Failed to get coil preview/` (the ONLY module of the 6 that rethrows rather than returning `null`/fallback — locks the rethrow contract that consumers depend on for try/catch flow) |
| **`kpayFunctions`** | `getKpayData("k:abc")` | success-path data returned verbatim | failure-status reader → `null` |
| **`activateFunctions`** | `getDeployStandardAccountInfoOnly("k:abc")` | success-path data returned verbatim | thrown read → `null` AND `getLogger().error("Error in getDeployStandardAccountInfoOnly:", error)` routed through the seam (cross-checks v3.3.0's logger-seam completion is intact for this module) |

The strategy mirrors v3.3.4's `tests/v3-3-4-success-paths.test.ts`: install a `successReader` / `failureStatusReader` / `throwingReader` stub via `setPactReader(...)`, exercise the SUT, assert the parsed result. `afterEach` restores `rawCalibratedDirtyRead` so cross-file tests aren't polluted by the seam-mocking. Logger spies use `setLogger({warn, error, info})` matching v3.3.0's extended seam contract — `info` is included for forwards-compat even though none of the 6 SUTs invoke it.

### Why "minimal" is the right scope (and why we don't smoke-test the execute-class functions)

Each of the 6 modules exports a mix of read-only functions (`pactRead`-based — easy to mock via `setPactReader`) and transaction-execute functions (require signing via `CodexSigningStrategy` + `submit` to the chain + `listenForCompletion`-style polling). Smoke-testing the read-only one is cheap; smoke-testing the execute function would require mocking the full `@kadena/client` signing + submit + status-polling chain, which is a much bigger surface and out-of-scope for a MEDIUM audit-closure release. The read-only smoke is sufficient to satisfy F-TEST-006's "function actually executes against the stubbed seam" assertion. The execute-path coverage is queued for v4.0.0's monorepo split where the `CodexSigningStrategy` seam will land properly tested as part of the `packages/stoa-core/` extraction.

### Why a dedicated v3.3.5 file rather than appending to existing files

Same rationale as v3.3.4: (1) **audit-finding traceability** — F-TEST-006 closure lives in one greppable place, mirroring v3.3.2 (F-TEST-002 → `universal-sign.test.ts`), v3.3.3 (new public surface → `partial-sig.test.ts`), and v3.3.4 (F-TEST-005 → `v3-3-4-success-paths.test.ts`); (2) **per-file scope clarity** — appending across 6 different modules' existing test homes would scatter the F-TEST-006 closure across 6 places and muddy each file's per-module scope statement.

### Verified

- `npm run typecheck` — zero errors. The new test file imports from `../src/reads`, `../src/observability`, and 6 stable interaction subpaths; all types resolve cleanly.
- `npm test` — **672/672 tests pass** (was 660 in v3.3.4; +12 from `tests/v3-3-5-smoke.test.ts`).
- `npm run build` — clean tsc emit. No source-code change; every module under test is byte-identical to v3.3.4.

### Migration

No consumer migration. The package's public API surface is byte-identical to v3.3.4. This release adds tests that lock existing module behaviour against future regressions; consumers see no observable difference.

### v3.3.x trajectory ahead

- **v3.3.6+** — Documentation/deprecation cleanups (KADENA_BASE_URL deprecation marker, `CreateAccountOptions` JSDoc, etc.); possibly a small dependency-hygiene release (pin exact versions of `@kadena/*` peerDeps + vendor `@kadena/types` per the supply-chain risk discussion deferred from earlier in the v3.3.x cycle).
- **v4.0.0** — Major structural release (monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`, god-file decomposition including `infoOneFunctions`'s 23 exports → multi-file split, type consolidation, and the bigger fork-into-stoachain-scope work for `@kadena/cryptography-utils` / `@kadena/client` / `@kadena/hd-wallet`). The v3.3.x test-coverage track (`universal-sign`, `partial-sig`, `v3-3-4-success-paths`, `v3-3-5-smoke`) all relocate to `packages/stoa-core/tests/` since the SUTs they cover are StoaChain-generic infrastructure.

### v3.3.x audit-closure track — COMPLETE

This release closes the last MEDIUM testing-auditor finding from the 2026-05-05 audit. The full v3.3.x audit-closure track:

| Release | Audit finding | Severity | What it closed |
|---|---|---|---|
| v3.3.0 | F-LOGGER-SEAM-001 | (consolidated, 8 of 8 agents) | Logger seam completion + 7 routed sites + regression-lock |
| v3.3.1 | (workflow follow-ups from v3.0.0..v3.3.0 pollinate runs) | n/a | npm provenance + gh-CLI `--repo` flag drop |
| v3.3.2 | F-TEST-002 | HIGH | Direct test coverage for `universalSignTransaction` (3 seedType branches + foreign-key + multi-signer + partial-sig primitive) |
| v3.3.3 | (new public surface — not an audit finding) | n/a | Multi-party partial-signature workflow for OuronetUI's "AnyOne v2" |
| v3.3.4 | F-TEST-005 | MEDIUM | Success-path tests for the 13 of 16 v3.0.0 nullable-widened functions |
| v3.3.5 | F-TEST-006 | MEDIUM | Smoke tests for 6 modules (3 zero-runtime + 3 compile-only) |

All MEDIUM testing findings from the 2026-05-05 audit are now CLOSED. Remaining MEDIUM findings are non-test (`F-PERF-008` sideEffects, `F-PERF-003` regex hoisting, `F-PERF-004` Promise.all, etc.) — those remain as the Short-term Actions queue per the audit roadmap.

---

## 3.3.4 — 2026-05-06

**MINOR, additive (test-only).** Closes audit finding **F-TEST-005** (MEDIUM, testing-auditor) — the v3.0.0 nullable-widening sweep widened 16 read-side interaction functions from `Promise<T>` → `Promise<T | null>`, replacing each fabricated sentinel (`1.0` / `8` / `0` / `"0"` / `"N/A"`) with `null` on RPC failure. v3.0.0 added null-path tests for all 16 (proving each returns `null` when `pactRead` throws or returns `failure` status), but **only 3 of the 16 had a paired success-path test** — `getStoaPriceUSD` in `tests/interactions-pricing.test.ts:80`, `getLPTypeInfo`'s per-flag mixed-state lock in `tests/interactions-balance-cluster.test.ts:137`, and `getUrStoaGuard`'s 3-state contract at the same file:207. The remaining 13 could not distinguish "always returns null" (silent regression) from "returns null only on RPC failure" (correct contract). v3.3.4 closes that gap with `tests/v3-3-4-success-paths.test.ts` — **13 new it-blocks across 6 describe groups**, one per missing function, each installing a `successReader` stub via `setPactReader(...)` that resolves to `{result: {status: "success", data: <stub>}}`, exercising the SUT, and asserting the parsed non-null return. **NO source-code change**, **NO public API change**, **660/660 tests pass** (was 647 in v3.3.3; +13 from the new test file).

### Why this is MEDIUM-severity even though no current bug

A future regression that returned `null` unconditionally — e.g. a flipped `if (response?.result?.status === "success")` to `!== "success"`, or a `return null;` accidentally inserted before the parse logic — would slip past every existing test in the v3.0.0 fabricated-fallback regression suite. The null-path tests would still pass (the stubbed throwing/failure-status reader still returns `null`, just for the wrong reason). The bug would surface only at consumer runtime, where the OuronetUI balance/price banners would silently switch to "RPC error" UI for legitimate non-zero values — a hard-to-reproduce, intermittently-correlated failure mode. v3.3.4's success-path lock makes this regression class **physically impossible** to ship without tripping CI.

The audit's testing-auditor flagged this as MEDIUM because the gap was structural (every widened function had the same gap in the same way), and the closure is mechanical (one stub per function, ~5 lines each). Landing this BEFORE v4.0.0's monorepo restructure means the v4.0.0 file-relocation refactor (which moves `src/interactions/*` into `packages/stoa-core/`) cannot accidentally regress any of the 13 success paths — the regression-lock travels with the test file.

### Added — `tests/v3-3-4-success-paths.test.ts` (13 it-blocks across 6 describe groups)

| Group | Tests | Functions covered | Locks |
|---|---|---|---|
| **Pricing-quartet** (REQ-01..REQ-04) | 3 | `getTokenDecimals`, `getPoolTotalFee`, `getDPTFMinMove` | `{int: "12"}` → `12` (parseInt path); `{decimal: "0.003"}` → `0.003` (parseFloat path); `{decimal: "0.0001"}` → `0.0001` (mayComeWithDeimal path). All three locks verify `Number.isFinite()` accepts the parsed value. (`getStoaPriceUSD` already covered at `interactions-pricing.test.ts:80`.) |
| **String-balance cluster** (REQ-05) | 4 | `getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`, `getVirtualOuro` | All four unwrap a Pact `{decimal: "..."}` payload via `mayComeWithDeimal` to the underlying string. Locks the v3.0.0 contract that a successful read with a non-zero decimal returns the parsed string — NOT `null` (RPC failure), NOT `"0"` (which v2.x's fabricated sentinel collapsed both cases onto). |
| **urStoa pair** (REQ-07) | 2 | `getUrStoaBalance`, `checkCoinAccountExists` (urStoa) | `{decimal: "42.5"}` → `42.5` for the balance read; `data: true` → `true` for the urStoa account-existence probe. Test-block JSDoc explicitly cites the inverted-typeof Pact gymnastics in `urStoaFunctions.ts:567` (out of scope for this release; locked-as-is so a future fix can be measured against the current contract). (`getUrStoaGuard`'s 3-state lock at `interactions-balance-cluster.test.ts:207` already counts as success-path.) |
| **validateLiquidity mixed-shape** (REQ-08) | 1 | `validateLiquidity` | The ONLY one of the 16 widenings where the success path shape differs from the failure path shape. Stub: chain returns `[{decimal:"0.05"}, {decimal:"0.10"}]`. Asserts function returns `{valid: true, computed: "0.05", max: "0.10"}` AND `error` field is `undefined` — the v3.0.0 locked-decision mutual exclusion between `valid:true` and `error` (otherwise consumer's `if (out.error)` branch mis-fires and shows RPC-failure UI for a successful liquidity check). |
| **getMaxBuyMovieBooster** (REQ-08) | 1 | `getMaxBuyMovieBooster` | `{int: "5000"}` → `5000`. Locks `Number.isFinite` guard against the v2.x fabricated-`0` (which collapsed sold-out and RPC-fail onto the same return value). |
| **Magic-string elimination** (REQ-09) | 2 | `getSWPSpawnLimit`, `getSWPInactiveLimit` | Both unwrap `{decimal: "..."}` to the underlying string. Belt-and-suspenders assertion: `expect(out).not.toBe("N/A")` — proves the v3.0.0 BREAKING `"N/A"` → `null` swap is intact at the success path, so a regression that re-introduced the magic string would fail the not-`"N/A"` assertion even if it satisfied the toBe-string check. |

The strategy mirrors the pre-existing pattern at `tests/interactions-pricing.test.ts:80-88` (the one success-path test that existed pre-v3.3.4): `setPactReader(successReader({...}))` → call SUT → assert. `afterEach` restores `rawCalibratedDirtyRead` so cross-file tests aren't polluted by the seam-mocking. No global state lives across the 13 it-blocks.

### Why a dedicated v3.3.4 file rather than appending to existing files

(1) **Audit-finding traceability** — F-TEST-005 closure lives in one greppable place, mirroring v3.3.2's `tests/universal-sign.test.ts` (F-TEST-002 closure) and v3.3.3's `tests/partial-sig.test.ts` (new public surface). Future contributors who grep for `F-TEST-005` find the audit citation, the per-function rationale, and the success-path lock all in one file.

(2) **Per-file scope clarity** — the existing files (`interactions-pricing.test.ts`, `interactions-balance-cluster.test.ts`) document themselves as Phase-1 / Phase-2 fabricated-fallback regression locks. Appending post-v3.0.0 audit-closure work to them would muddy the per-file scope statement. The dedicated file keeps the v3.3.4 audit citation visible to future contributors AND keeps the existing files focused on their original v3.0.0-ship purpose.

### Verified

- `npm run typecheck` — zero errors. The new test file imports types from `../src/reads` (`PactReader`), `../src/interactions/ouroFunctions`, `../src/interactions/dexFunctions`, `../src/interactions/urStoaFunctions`, `../src/interactions/addLiquidityFunctions` — all stable subpaths from v3.0.0+.
- `npm test` — **660/660 tests pass** (was 647 in v3.3.3; +13 from `tests/v3-3-4-success-paths.test.ts`).
- `npm run build` — clean tsc emit. No source-code change; every interaction function is byte-identical to v3.3.3.

### Migration

No consumer migration. The package's public API surface is byte-identical to v3.3.3. This release adds tests that lock existing v3.0.0 behaviour against future regressions; consumers see no observable difference.

### v3.3.x trajectory ahead

- **v3.3.5** — F-TEST-006 behavioural tests for `pensionFunctions`/`guardFunctions`/`infoOneFunctions` (3 modules with zero tests; 3 more compile-only).
- **v3.3.6+** — Documentation/deprecation cleanups; possibly a small dependency-hygiene release (pin exact versions of `@kadena/*` peerDeps + vendor `@kadena/types` per the supply-chain risk discussion deferred from earlier in the v3.3.x cycle).
- **v4.0.0** — Major structural release (monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`, god-file decomposition, type consolidation, and the bigger fork-into-stoachain-scope work for `@kadena/cryptography-utils` / `@kadena/client` / `@kadena/hd-wallet`). The test files added across v3.3.2/3/4 (`universal-sign`, `partial-sig`, `v3-3-4-success-paths`) all relocate to `packages/stoa-core/tests/` since the SUTs they cover are StoaChain-generic infrastructure.

---

## 3.3.3 — 2026-05-03

**MINOR, additive (NEW PUBLIC SURFACE — not a bug fix).** Ships the multi-party partial-signature workflow OuronetUI has been blocked on: "Person A signs → exports → Person B imports → signs → exports → Person C imports → signs → submits", with cross-party tamper detection at every handoff. Builds on v3.3.2's locked partial-signing primitive (signing with a subset of declared signers fills only those slots; pre-existing slots stay intact across re-signing passes) by wrapping it in a versioned export envelope + slot-status helpers + Ed25519 sig-verification helper. New `src/signing/partialSig.ts` module, re-exported from `@ouronet/ouronet-core/signing`. **NO existing API changed**, **NO source-side behaviour change** outside the new module, **647/647 tests pass** (was 631 in v3.3.2; +16 from the new `tests/partial-sig.test.ts`).

### Why this is a NEW ADDITION, not a bug fix

Pre-v3.3.3 the underlying primitive existed (since `universalSignTransaction`'s loop has always been "iterate keypairs, sign matching slots, leave others alone" — locked under runtime test in v3.3.2's "partial-signing primitive (v3.3.3 foundation)" describe group), but the multi-party flow required consumers to:

1. Manually serialise an `IUnsignedCommand` to JSON (no envelope, no version, no transport metadata).
2. Manually parse + cast the JSON back into an `IUnsignedCommand` on import.
3. Implement their own hash-recompute-and-compare for tamper detection.
4. Implement their own Ed25519 sig-verification loop to catch tampered signatures.

OuronetUI's pending "AnyOne v2" multi-sig flow needed all four. v3.3.3 ships the public surface so the workflow lives in shared core (one implementation, one set of locked tests) rather than getting reinvented per-consumer.

### Added — `src/signing/partialSig.ts` (7 functions + 2 typed errors + envelope interface)

| Symbol | Kind | Purpose |
|---|---|---|
| `signPartial(tx, keypairs)` | function | Thin wrapper around `universalSignTransaction` that drops `onMissingKey` on purpose. In the multi-party flow each signer commits only their OWN keys; "missing" keys mean "another party will sign in their next pass" — not "paste-resolve a foreign key now." Consumers wanting foreign-key paste resolution still call `universalSignTransaction` directly. |
| `serializePartialTransaction(tx, metadata?)` | function | Wrap the `IUnsignedCommand` in a versioned `PartialSigEnvelope` (`format: "ouronet-partial-sig"`, `version: 1`) and stringify with 2-space indent (mirrors `serializeCodex`'s human-eyeballable choice). `metadata.exportedAt` / `metadata.exportedBy` / `metadata.note` optional, freeform-ish; readers ignore unknowns (forwards-compat). |
| `deserializePartialTransaction(json)` | function | Parse + format/version literal check + transaction-shape check (`cmd` string, `hash` string, `sigs` array) + **hash-integrity check via `kadenaHash(cmd) === transaction.hash`**. Throws `InvalidEnvelopeError` on shape problems, `TamperedHashError` on hash mismatch. Returns the unwrapped `IUnsignedCommand` ready for the next signer. |
| `getMissingSigners(tx)` | function | Pubkeys of `cmd.signers` whose parallel `sigs[i]?.sig` slot is empty. Drives "who needs to sign next" UI. |
| `getFilledSigners(tx)` | function | Inverse of `getMissingSigners` — pubkeys with a filled sig slot. Drives "X of Y signers complete" status. |
| `isFullySigned(tx)` | function | `getMissingSigners(tx).length === 0`. Cheap pre-check before submitting to chain. |
| `verifyExistingSignatures(tx)` | function | Verifies every filled `sigs[i]` against `cmd.signers[i].pubKey` over the canonical hash via `nacl.sign.detached.verify`. Empty slots are skipped (not failures). Returns `{allValid, invalid: [{publicKey, reason}]}`. Catches the "tampered cmd + tampered hash to match" attack the envelope's hash-integrity gate alone misses (any cmd modification invalidates every prior signature against any hash, original or rewritten). |
| `InvalidEnvelopeError` | class | ES2022 `cause` chaining for the JSON-parse path. Message names the offending FIELD but never the field VALUE — an envelope can carry a Pact cmd with embedded data, and surfacing those into telemetry/logs would breach the export's information-disclosure boundary (mirrors `deserializeCodex`'s discipline). |
| `TamperedHashError` | class | Carries `expected` (what the envelope embedded) and `actual` (what `kadenaHash(cmd)` recomputed). Operator can decide whether the divergence is a UI bug, transport corruption, or malicious modification. |
| `PartialSigEnvelope` | interface | The v1 export shape. `transaction` is the `IUnsignedCommand` verbatim (no field rename); `metadata` is optional and free-form-ish. |
| `PARTIAL_SIG_FORMAT` / `PARTIAL_SIG_VERSION` | const | The `"ouronet-partial-sig"` and `1` literals exposed for tooling sanity-checks. |

### Added — `tests/partial-sig.test.ts` (16 it-blocks across 7 describe groups)

| Group | Test count | What it locks |
|---|---|---|
| **`signPartial` — fills only matching slots** | 2 | (a) 3-signer tx + 1 keypair fills only that slot, others empty (regression-lock for the wrapper level — v3.3.2 locked this at the `universalSignTransaction` level); (b) re-signing on TOP of a previously partially-signed tx preserves the existing sig byte-for-byte and adds the new one — the load-bearing handoff invariant. |
| **serialize / deserialize round-trip** | 2 | (a) full envelope round-trip preserves cmd/hash/sigs byte-for-byte; (b) `metadata` is optional — serialising without it produces a valid envelope. |
| **`deserializePartialTransaction` — rejection cases** | 4 | Throws `InvalidEnvelopeError` on: not JSON, wrong format literal, wrong version literal, missing `transaction.cmd`. |
| **`deserializePartialTransaction` — `TamperedHashError`** | 1 | Embedded `transaction.hash` doesn't match `kadenaHash(transaction.cmd)` → throws `TamperedHashError` with both `expected` and `actual` populated. The `actual` field equals `signed.hash` (sanity check that the chain's hash IS what `kadenaHash(cmd)` produces — locks the assumption the integrity check rests on). |
| **slot-status helpers** | 3 | `getMissingSigners` / `getFilledSigners` / `isFullySigned` correctly partition a 3-signer tx across (a) 0 signed → all missing, none filled, not fully signed; (b) 1 signed → 2 missing, 1 filled, not fully signed; (c) all 3 signed → 0 missing, 3 filled, fully signed. |
| **`verifyExistingSignatures`** | 3 | (a) properly-signed all-slots-filled tx → `allValid: true`; (b) partial-signed tx with empty slots → `allValid: true` (empty slots skipped, not flagged as failures); (c) tampered sig (1 hex digit flipped) → `allValid: false` with `invalid[0].publicKey` and reason text matching `/Ed25519 verification/`. |
| **end-to-end 3-party round-trip** | 1 | Full A→B→C handoff via serialize/deserialize: A signs → exports JSON → B imports (hash + cmd + A's sig all intact) → B signs → exports JSON → C imports (all 3 verifications pass) → C signs → final tx has all 3 slots filled, `verifyExistingSignatures` returns `allValid: true`, every sig validates against the original hash via direct `nacl.sign.detached.verify`. The chain-validator-equivalent end-state assertion. |

### How OuronetUI consumes this

```ts
import {
  signPartial,
  serializePartialTransaction,
  deserializePartialTransaction,
  getMissingSigners,
  isFullySigned,
  verifyExistingSignatures,
} from "@ouronet/ouronet-core/signing";

// ── Person A's side ──
const txWithA = await signPartial(unsignedTx, [personAKeypair]);
const exportFromA = serializePartialTransaction(txWithA, {
  exportedAt: new Date().toISOString(),
  exportedBy: "k:a3f...",
});
// → exportFromA flows out via download / QR / chat.

// ── Person B's side ──
const importedAtB = deserializePartialTransaction(exportFromA);
//   ↑ throws TamperedHashError if cmd was modified mid-flight.
const verifyAtB = verifyExistingSignatures(importedAtB);
if (!verifyAtB.allValid) { /* surface verifyAtB.invalid in UI */ }
const stillNeed = getMissingSigners(importedAtB);
//   ↑ ["personB-pubkey", "personC-pubkey"] — drives "who's left to sign?" panel.
const txWithAB = await signPartial(importedAtB, [personBKeypair]);
const exportFromB = serializePartialTransaction(txWithAB, { exportedBy: "k:b1c..." });

// ── Person C's side ──
const importedAtC = deserializePartialTransaction(exportFromB);
const txWithABC = await signPartial(importedAtC, [personCKeypair]);
if (isFullySigned(txWithABC)) {
  // → submit to chain via the existing OuronetUI submitToChain flow.
}
```

### Verified

- `npm run typecheck` — zero errors. The new `PartialSigEnvelope` interface, `InvalidEnvelopeError` / `TamperedHashError` classes, and the `VerifyExistingSignaturesResult` type all compile cleanly. The seven exported functions all use existing `IUnsignedCommand` / `ICommand` types from `@kadena/types`; no new third-party dependency.
- `npm test` — **647/647 tests pass** (was 631 in v3.3.2; +16 from the new test file).
- `npm run build` — clean tsc emit. `dist/signing/partialSig.js` + `dist/signing/partialSig.d.ts` produced; `dist/signing/index.d.ts` re-exports the new symbols. No source-code change to any pre-v3.3.3 file (only the `export * from "./partialSig"` line added to `src/signing/index.ts`).

### Migration

No consumer migration. The package's pre-v3.3.3 public API surface is byte-identical: `universalSignTransaction`, `fromKeypair`, `CodexSigningStrategy`, `KeyResolver` etc. all behave exactly as in v3.3.2. v3.3.3 is purely additive — consumers who don't import the new symbols see no observable difference. OuronetUI's "AnyOne v2" branch can now wire the workflow above; the AncientHolder HUB can adopt the same surface for any multi-admin signing flow it grows into.

### v3.3.x trajectory ahead

- **v3.3.4** — F-TEST-005 success-path tests for the 13 v3.0.0 nullable-widened functions.
- **v3.3.5** — F-TEST-006 behavioural tests for `pensionFunctions`/`guardFunctions`/`infoOneFunctions`.
- **v3.3.6+** — Documentation/deprecation cleanups; possibly a small dependency-hygiene release (pin exact versions of `@kadena/*` peerDeps + vendor `@kadena/types` per the supply-chain risk discussion deferred from earlier in the v3.3.x cycle).
- **v4.0.0** — Major structural release (monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`, god-file decomposition, type consolidation, and the bigger fork-into-stoachain-scope work for `@kadena/cryptography-utils` / `@kadena/client` / `@kadena/hd-wallet`). `src/signing/partialSig.ts` is StoaChain-generic infrastructure and slated for `packages/stoa-core/`.

---

## 3.3.2 — 2026-05-06

**MINOR, additive (test-only).** Closes audit finding **F-TEST-002** (HIGH) — the central signing entry point `universalSignTransaction` in `src/signing/universalSign.ts` had ZERO direct tests pre-v3.3.2. Adds `tests/universal-sign.test.ts` with **9 new it-blocks** covering all three seedType branches (koala / chainweaver / eckowallet), the foreign-key onMissingKey resolution path (success and key-mismatch error cases), the multi-signer mixed-seedType case, the partial-signing primitive (foundation lock for v3.3.3's planned multi-party signing public surface), and the silent-skip-when-not-in-signers contract. **NO source-code change**, **NO public API change**, **631/631 tests pass** (was 622 in v3.3.1; +9).

### Why this is HIGH-severity even though no current bug

`universalSignTransaction` is the central choke point through which every signed Pact transaction in the ecosystem flows. Pre-v3.3.2:

- The only mention of `universalSignTransaction` in `tests/` was a comment in `tests/signing.test.ts:5` stating "the full universalSignTransaction is not exercised here."
- `tests/strategy.test.ts` exercises `CodexSigningStrategy` which calls `universalSignTransaction` internally — but only with `seedType: "koala"`. The chainweaver / eckowallet / foreign branches were never runtime-tested.
- The seedType dispatcher itself (the switch-equivalent in lines 89-104 of `universalSign.ts`) was never runtime-tested. A typo that mis-routed `eckowallet` → `koala` would silently produce a wrong-shape signature; the failure surfaces only when a real consumer with a chainweaver wallet tries to sign and the chain rejects with "invalid signature" — far from the actual cause.

The audit's bug-detector and testing-auditor agents both flagged this as HIGH. v3.3.2 closes it before v4.0.0's monorepo restructure moves `src/signing/universalSign.ts` (it's StoaChain-generic infrastructure, slated for `packages/stoa-core/`). Locking the chainweaver/eckowallet/foreign paths NOW means the v4.0.0 file-relocation refactor can't accidentally break them.

### Added — `tests/universal-sign.test.ts` (9 it-blocks across 6 describe groups)

| Group | Test count | What it locks |
|---|---|---|
| **Koala branch (nacl Ed25519)** | 2 | Round-trip with RFC-8032 vector + verification via `nacl.sign.detached.verify`; `fromKeypair` adapter normalising consumer-shape `privateKey` field into the universal `secretKey` field |
| **Chainweaver branch (WASM kadenaSign)** | 1 | Real chainweaver keypair derivation via `KadenaWalletBuilder.createWalletPairFromMnemonic` using the `@kadena/hd-wallet` vendor vector → `universalSignTransaction` produces a valid Ed25519 signature verifiable against the derived publicKey |
| **Eckowallet branch (label-only difference)** | 1 | Identical derivation as chainweaver but with `seedType: "eckowallet"` — locks the dispatcher routing both labels to the same WASM signing path. Eckowallet is not just "chainweaver renamed" at the type level; this test runtime-confirms it. |
| **Multi-signer mixed seedTypes** | 1 | Two-signer transaction with one koala signer + one chainweaver signer; both slots filled, both verifiable. Locks the iterate-and-dispatch-each loop's correctness. |
| **Foreign branch (onMissingKey)** | 2 | (a) Success: callback resolves a signer-pubkey not in our keypairs list; (b) Failure: callback returns mismatched private key → throws "Key mismatch" error citing both expected and derived pubkeys for operator diagnosability |
| **Partial-signing primitive (v3.3.3 foundation)** | 2 | (a) 3-signer transaction signed with only 1 keypair — only that slot filled, other two left empty (the load-bearing assertion for v3.3.3's multi-party signing workflow); (b) keypairs whose pubkey is NOT in cmd.signers are silently skipped (current contract per `universalSign.ts:91`) |

The verification approach uses `nacl.sign.detached.verify` over the base64URL-decoded `signed.hash` bytes. This works for BOTH the nacl-direct path (koala/foreign) AND the WASM-Ed25519 path (chainweaver/eckowallet) — `kadenaSign` produces standard Ed25519 signatures verifiable with the same primitive, despite the BIP32-derived key path. The test file documents this explicitly so future contributors know the verification helper handles both branches.

### Verified

- `npm run typecheck` — zero errors. The `UniversalKeypair` type's seedType union (`"koala" | "chainweaver" | "eckowallet" | "foreign"`) compiles cleanly across all 9 test cases.
- `npm test` — **631/631 tests pass** (was 622 in v3.3.1; +9 from the new test file).
- `npm run build` — clean tsc emit. No source-code change; `universalSign.ts` is byte-identical to v3.3.1.

### Migration

No consumer migration. The package's public API surface is byte-identical to v3.3.1. This release adds tests that lock existing behaviour against future regressions; consumers see no observable difference.

### v3.3.x trajectory ahead

- **v3.3.3** — Multi-party partial-sig public surface (`signPartial`, `serializePartialTransaction`, `deserializePartialTransaction`, `getMissingSigners`, `getFilledSigners`, `isFullySigned`, `verifyExistingSignatures`). Builds on v3.3.2's locked partial-signing primitive. Enables the OuronetUI workflow where Person A signs and exports a transaction, Person B imports and adds their signature, Person C imports and submits — with hash-integrity verification at each handoff so a tampered cmd between signers gets rejected. New `src/signing/partialSig.ts` module.
- **v3.3.4** — F-TEST-005 success-path tests for the 13 v3.0.0 nullable-widened functions.
- **v3.3.5** — F-TEST-006 behavioural tests for `pensionFunctions`/`guardFunctions`/`infoOneFunctions`.
- **v3.3.6+** — Documentation/deprecation cleanups; possibly a small dependency-hygiene release (pin exact versions of `@kadena/*` peerDeps + vendor `@kadena/types` per the supply-chain risk discussion deferred from earlier in the v3.3.x cycle).
- **v4.0.0** — Major structural release (monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`, god-file decomposition, type consolidation, and the bigger fork-into-stoachain-scope work for `@kadena/cryptography-utils` / `@kadena/client` / `@kadena/hd-wallet`).

---

## 3.3.1 — 2026-05-06

**PATCH, workflow-only.** Closes the two carried-forward follow-ups that have appeared in every pollinate run's "follow-ups" block since v3.0.0: (1) `npm publish` now passes the `--provenance` flag (and the workflow gains the `id-token: write` permission required to mint the OIDC token npm exchanges with npmjs.org), so v3.3.1 onwards every release carries a verifiable SLSA attestation linking the published tarball to the exact GitHub Action run that produced it; and (2) the `gh release create` invocations in both the main Release-creation step and the idempotent backfill step drop the `--repo` flag, eliminating the `gh release create --notes-from-tag --repo X` flag-combination incompatibility that the GitHub-hosted runners' gh CLI image rejected starting around 2026-04-30. Both fixes are workflow-file-only — `.github/workflows/publish.yml` is the only file that ships behaviour change. **NO source-code change**, **NO public API change**, **622/622 tests pass unchanged** (the workflow file isn't in the test scope; verification is the v3.3.1 publish run itself).

### Why this is a workflow-only patch (and why that's load-bearing)

Every v3.x publish since v3.0.0 has produced two recurring artifacts in the pollinate "follow-ups" block:

1. **Missing npm provenance attestation.** `lifecycle.use_provenance: true` in `.bee/config.json` told pollinate to expect a 200 response from `https://registry.npmjs.org/-/npm/v1/attestations/@ouronet/ouronet-core@{version}`, but the actual workflow's `npm publish --access public` call lacked the `--provenance` flag, so npm silently skipped attestation generation. Each v3.x release shipped without the provenance signal that downstream consumers (and npmjs.com's "Provenance" badge) verify against.
2. **Inline gh-CLI Release creation failed every run.** The `gh release create --notes-from-tag --repo X` invocation in the workflow has hit the same "using `--notes-from-tag` with `--repo` is not supported" failure on every v3.x run since the GitHub-hosted runners' gh-CLI image update on/around 2026-04-30. Pollinate's Step 9c REST-API fallback created the Release manually each time — the user-facing artefact was always present, but a workflow step was failing on every run, leaving a misleading red-X on the workflow run page.

Both are workflow-file fixes that don't require a source-code change, don't break any consumer contract, and don't merit dragging a test-coverage block (v3.3.2/3/4 were lined up as the next coding work) into a release pipeline patch. v3.3.1 is published explicitly to land these two fixes as a clean PATCH release with a clear CHANGELOG audit trail. From v3.3.1 onwards, the workflow's success indicator on each publish IS the green-check we want — no manual-fallback tracking required.

### Added — `id-token: write` to workflow `permissions` block

`.github/workflows/publish.yml`'s `permissions` block extends from `contents: write` (the existing scope, granted at v2.0.2 to fix the GitHub-Releases-403 problem) to also include `id-token: write`. The token is the GitHub-Actions-OIDC-issued credential that `npm publish --provenance` exchanges with npmjs.org's attestation endpoint to produce the SLSA verification trail. Without this permission, `npm publish --provenance` doesn't fail — it silently skips the attestation step and produces a published-but-not-attested package.

### Added — `--provenance` flag on `npm publish`

The Publish-to-npmjs.org step changes from `npm publish --access public` to `npm publish --access public --provenance`. `npm` 9.5+ supports the flag; the `setup-node@v4` action used here installs Node 22 with a recent npm. The first attestation will surface on `npmjs.com/package/@ouronet/ouronet-core/v/3.3.1` via the "Provenance" badge in the version sidebar, plus a 200 response from `https://registry.npmjs.org/-/npm/v1/attestations/@ouronet/ouronet-core@3.3.1`. Pollinate's Step 9a `use_provenance` check (which has been silently failing on every v3.x run) will pass cleanly from v3.3.1 onwards.

### Changed — dropped `--repo` flag from `gh release create` and `gh release view` calls

The main "Create GitHub Release for the pushed tag" step + the idempotent "Backfill GitHub Releases for prior tags" step both used `gh release create $TAG --repo "${{ github.repository }}" ...`. After the GitHub-hosted runners' gh-CLI image update around 2026-04-30, the combination `gh release create --notes-from-tag --repo X` started returning "this flag combination is not supported." Pre-v3.3.1 the workaround was pollinate's own REST-API fallback (Step 9c); v3.3.1's workflow patch fixes the upstream cause: `--repo` is unnecessary in the workflow context because `actions/checkout@v4` (the first step) sets the working directory to the checked-out repo, and the gh CLI auto-detects the repo from that context. Same fix applied to the `gh release view` calls that gate the idempotent skip-if-exists check (no failure mode there pre-v3.3.1, but kept consistent for tooling-symmetry).

### Verified

- **`npm run typecheck` / `npm test` / `npm run build`** — all pass; tests run against the source-code surface which is unchanged in v3.3.1 (only `.github/workflows/publish.yml`, `package.json` version field, and `tests/package-version.test.ts` pin were touched).
- **Workflow change cannot be verified locally** — the `--provenance` flag requires the GitHub-Actions-OIDC token (only available inside a CI run), and the `gh release create --repo` drop's behaviour change only manifests against GitHub's API. The proof of correctness will arrive when the v3.3.1 publish run finishes: pollinate's Step 9a should report `provenance: present` (was `absent` on every v3.x release), and the gh-CLI Release-creation step should conclude `success` (was `failure` on every v3.x release with REST fallback handling it).

### Migration

No consumer migration. The package's public API surface is byte-identical to v3.3.0. Consumers who track npm provenance attestations (e.g., Sigstore-aware build pipelines) will see v3.3.1 as the first attested release in the v3.x line.

### v3.3.x trajectory ahead (unchanged from v3.3.0's roadmap)

- **v3.3.2** — F-TEST-002 universalSign coverage (chainweaver/eckowallet/foreign branches)
- **v3.3.3** — F-TEST-005 success-path tests for the 13 v3.0.0 nullable-widened functions
- **v3.3.4** — F-TEST-006 behavioural tests for `pensionFunctions`/`guardFunctions`/`infoOneFunctions`
- **v3.3.5+** — Documentation/deprecation cleanups (KADENA_BASE_URL, CreateAccountOptions JSDoc, etc.)
- **v4.0.0** — Major structural release (monorepo split, god-file decomposition, type consolidation)

---

## 3.3.0 — 2026-05-06

**MINOR, additive (Logger interface extension) + behaviour change (call-site routing).** First release in the v3.3.x line, opening the second post-audit cleanup track. Closes the consolidated **F-LOGGER-SEAM-001** finding the 2026-05-05 audit flagged across 8 of 8 audit agents at 9 distinct source sites — the highest-redundancy finding in the entire audit. Two of the nine sites were already removed by v3.2.2's deletion of `executeAddLiquidityMultiStepComplete` (`addLiquidityFunctions.ts:642` + `:660`); v3.3.0 closes the remaining seven by extending the `Logger` interface with an `info(...)` method and routing every surviving raw `console.*` call in `src/` through the seam (or deleting debug-leak instrumentation that had no operational value). Post-v3.3.0 invariant: **zero raw `console.*` call sites in `src/` outside the seam's own default-logger implementation in `observability/logger.ts`** — verified by a new regression-lock test in `tests/v3-3-0-logger-seam-completion.test.ts` that greps the entire `src/` tree (excluding JSDoc/comments/the seam file itself) and fails on any future regression. **622/622 tests pass** (was 618 in v3.2.3; +3 new logger-seam contract tests covering the new `info` channel, +1 regression-lock test scanning src/, +1 existing test updated to reflect the new 3-method Logger shape).

### Added — `info(msg, ...args): void` channel on `Logger`

`src/observability/logger.ts` extends the `Logger` type from a 2-method shape (`{warn, error}`) to a 3-method shape (`{warn, error, info}`). The new channel is for operational events that aren't errors but consumers may still want to capture in their structured logs:

- **Node-recovery announcements** — `nodeFailover.ts:61`'s "primary node recovered, switching back" message (symmetric counterpart to line 53's failover-detected `getLogger().warn(...)`).
- **Error-suggestions callouts** — `transactionErrors.ts:259`'s "Suggestions:" line in `logDetailedError` (the operationally-informative "how do you recover from this?" annotations attached to typed `SigningError` instances).

The pre-v3.3.0 seam exposed only `warn`/`error`, so these `info`-class events fell through to raw `console.info` calls that bypassed consumer-supplied loggers (HUB pino, OuronetUI Sentry, redux-devtools panels). The new channel keeps the seam semantically aligned with what the codebase actually emits.

### Changed — `setLogger` accepts a partial input shape with `info` filled-in default (v3.x backwards-compat)

Pre-v3.3.0 the `setLogger` parameter was typed as `Logger` (which now requires `info`). To avoid forcing every existing v3.2.x consumer to update their `setLogger({warn, error})` call sites in lockstep with v3.3.0, the setter now accepts:

- A **full** `Logger` (`{warn, error, info}`) — reference identity preserved; `getLogger()` returns the same object passed in.
- A **partial** v3.2.x-compatible input (`{warn, error}` with no `info`) — the setter synthesises a wrapper that fills in `info` from the default `console.info` routing. The wrapper is a NEW object (not the input reference); `info` calls go to `console.info`, `warn`/`error` go to the consumer's logger.

This keeps v3.2.x consumers working unchanged while letting v3.3.0+ consumers wire `setLogger({warn, error, info})` for full structured-log capture. Type signature: `setLogger(logger: Logger | { warn, error }): void`.

### Changed — 7 raw `console.*` call sites in `src/` routed through the seam (or deleted)

| File:Line | Before | After |
|---|---|---|
| `transactionErrors.ts:252` | `console.group(\`🚨 ${error.name}: ${error.code}\`)` | folded into `getLogger().error(\`🚨 ${error.name}: ${error.code} — ${error.message}\`)` (seam doesn't model grouping; pino/structured loggers don't support it) |
| `transactionErrors.ts:259` | `console.info("Suggestions:", error.suggestions)` | `getLogger().info("Suggestions:", error.suggestions)` |
| `transactionErrors.ts:261` | `console.groupEnd()` | dropped (no seam equivalent) |
| `nodeFailover.ts:61` | `console.info("[node-failover] Primary node recovered...", PRIMARY_HOST)` | `getLogger().info("[node-failover] Primary node recovered...", PRIMARY_HOST)` |
| `infoOneFunctions.ts:599` | `console.log("[INFO_RemoveLiquidity] pactCode:", pactCode)` | DELETED (debug-leak — `getLogger().warn` already on line 602 for the failure path) |
| `infoOneFunctions.ts:600` | `console.log("[INFO_RemoveLiquidity] response:", JSON.stringify(response?.result, null, 2))` | DELETED (debug-leak — pretty-printed JSON dump on every preview read had no operational value beyond developer trace, plus added serialisation cost) |
| `ouroFunctions.ts:1590` | `console.log("Coil preview failed:", response?.result)` | `getLogger().warn("Coil preview failed:", response?.result)` (failure context — kept at warn-level so structured-logger consumers capture it) |
| `ouroFunctions.ts:1595` | `console.log("Coil preview response data:", data)` | DELETED (debug-leak — success-path data dump, no operational value) |
| `urStoaFunctions.ts:348` | `console.info(\`[UrStoa] Rebuilding transaction with ${validGuardKeys.length} valid guard key(s)...\`)` | `getLogger().warn(...)` (promoted to warn-level — signature pruning is an unusual operational event that a HUB operator running structured logs would want in their incident pipeline, not info-level chatter) |

Net 4 calls routed through the seam, 3 deleted as debug-leak. Two `console.log` instances flagged by the audit as "left-over dev instrumentation" are removed entirely — their information value was zero (developer-only trace; the legitimate diagnostics on the same code paths already routed through `getLogger`). One was promoted from `info` → `warn` (urStoaFunctions:348's signature-pruning event) because the level mismatch between "we just rebuilt a transaction because some keys didn't match" and "info-level status update" was an audit smell.

### Added — `tests/v3-3-0-logger-seam-completion.test.ts` regression lock

A new test file scans the entire `src/` tree (recursively, all `.ts` files, excluding `.d.ts`) for raw `console.{log,info,group,groupEnd,debug,warn,error}` call patterns. JSDoc blocks (`/** ... */`), single-line `// ...` comments, and `*` continuation lines are filtered out. The seam's own default-logger implementation in `observability/logger.ts` is exempted (that's how the default routing works — `console.warn` etc. ARE the implementation of the default `Logger.warn` etc.). Any future commit that introduces a raw `console.*` call elsewhere in `src/` fails this test with a structured per-violation report. The audit's consolidated finding becomes a permanent invariant rather than a one-time cleanup.

### Verified

- `npm run typecheck` — zero errors. The `Logger | { warn, error }` union type on `setLogger`'s parameter compiles cleanly; the runtime fill-in branch produces a `Logger` whether the input had 2 or 3 methods.
- `npm test` — **622/622 tests pass** (was 618 in v3.2.3; +3 new + 1 regression-lock + 1 existing-updated to reflect the new 3-method Logger shape).
- `npm run build` — clean tsc emit. The new `Logger.info` field is visible in the published `.d.ts` of the `./observability` subpath.
- Direct-grep verification: `grep -rE "console\.(log|info|group|groupEnd|debug|warn|error)" src/` returns only JSDoc/comment matches and the seam-file's intentional default-logger implementations. No call-sites remain.

### Migration

For v3.2.x consumers wiring `setLogger({warn, error})`: **no migration required**. The setter's backwards-compat path synthesises an `info` wrapper that falls through to `console.info` for the new channel. Existing `getLogger().warn(...)` and `.error(...)` call sites continue to behave identically.

For consumers who want full control of all three channels (recommended for HUB pino integrations and OuronetUI Sentry/redux-devtools wiring): pass a 3-method object to `setLogger`:

```ts
import { setLogger, type Logger } from "@ouronet/ouronet-core/observability";

const myLogger: Logger = {
  warn:  (msg, ...args) => myPipeline.warn(msg, args),
  error: (msg, ...args) => myPipeline.error(msg, args),
  info:  (msg, ...args) => myPipeline.info(msg, args),
};
setLogger(myLogger);
```

Output that previously bypassed the seam (the 4 `console.{group,info}` calls + 4 `console.log` debug-leaks the audit identified) is now either captured by the consumer's logger (4 routed calls) or removed entirely (4 deleted debug-leaks — the developer-only trace they emitted had no operational value).

For consumers calling `logDetailedError(error: SigningError)` from `@ouronet/ouronet-core/errors`: behaviour change. Pre-v3.3.0 the function emitted `console.group`/`console.groupEnd` framing around the error fields; post-v3.3.0 it emits a single `getLogger().error(...)` line with the `name: code — message` header inlined, plus the existing `Context:`, `Original Error:`, and `Suggestions:` (now via `getLogger().info`) routed through the seam. Visual layout in browser DevTools is flatter (no collapsible group), but consumer-supplied structured loggers now capture the entire error envelope reliably. If the grouped-DevTools layout was important to a consumer, they can wrap the call in their own `console.group` / `console.groupEnd` before/after invoking it.

---

## 3.2.3 — 2026-05-05

**MINOR, behaviour change.** Fourth and final wave of the v3.2.x audit-cycle close-out track. Four targeted bug fixes that close the highest-user-impact remaining audit findings: `creationTime` in `buildCrossChainTransfer` (F-BUG-002), `fetchSpvProof` failover + 30s AbortController timeout (F-BUG-004 — the highest-impact bug in the entire audit), `setNodeConfig` URL parse + `https:` scheme allow-list (F-SEC-002), and `@throws` JSDoc documentation on the three crossChainFunctions submit/listen helpers (F-ERR-001). With these four findings closed, the v3.2.x sequence has remediated **15 of the audit's 62 confirmed findings** across four ship cycles. The remaining ~47 findings (logger-seam completion, test coverage, structural decomposition, type consolidation, etc.) are scheduled for v3.3.x and v4.0.0 per the audit's suggested spec groupings. **618/618 tests pass** (was 601 in v3.2.2; +17 new it-blocks in `tests/v3-2-3-bug-fixes.test.ts` covering creationTime presence + offset, setNodeConfig URL validation across 8 cases, and fetchSpvProof failover/timeout/proof-shape across 4 cases; +2 existing network.test.ts tests updated to reflect the new setNodeConfig contract).

### Added — `creationTime: safeCreationTime()` to `buildCrossChainTransfer` (closes F-BUG-002)

`src/interactions/crossChainFunctions.ts:113-119` setMeta block now includes `creationTime: safeCreationTime()`. Pre-v3.2.3 the field was omitted and `@kadena/client` fell back to `Math.floor(Date.now() / 1000)`. On a consumer machine with a slightly-ahead clock, that produced `creationTime` values past the chainweb node's "is creation time too far in the future?" tolerance window, causing sporadic submit rejections that confusingly looked like network failures. The v2.3.0 audit consolidated `safeCreationTime()` (returns `Date.now()/1000 - 30`) precisely to absorb client-side clock drift; this builder was the lone interactions-surface function that omitted the helper after the v2.3.0 sweep — every other `setMeta` block (including the sibling `buildCTransferAcross` two functions below) already includes it. One-line addition; no other behaviour change.

### Added — `withFailover` + `AbortSignal.timeout(30s)` on `fetchSpvProof` (closes F-BUG-004 — HIGHEST USER-IMPACT FIX)

`src/interactions/crossChainFunctions.ts:267-345` (`fetchSpvProof`) is rewritten to wrap the `fetch()` call in `withFailover` and add a per-attempt `AbortSignal.timeout(SPV_PROOF_TIMEOUT_MS)` deadline. Pre-v3.2.3 this was the only chain-RPC function in the entire codebase that called raw `fetch()` without either guard, with three compounding consequences:

1. **No `AbortController`**: a wedged primary node (slow, not erroring) would hang the `await fetch(...)` indefinitely. The outer `pollSpvProof` retry loop never advanced because each attempt awaited the hung fetch.
2. **No `withFailover`**: even if the primary node returned an error or timed out, traffic stayed pinned to the primary; the consumer's subsequent attempts hit the same wedged node forever.
3. **Combined consequence**: the user's KDA was committed to `kadena-xchain-gas` escrow on the source chain (step 1 succeeded), but step 2's SPV proof retrieval hung silently with the UI showing a perpetual "Waiting for SPV proof..." spinner and **no recovery path**.

This was identified by the bug-detector audit agent as the highest-impact bug surfaced by the 2026-05-05 audit. Post-v3.2.3 behaviour: each attempt has a hard 30-second deadline; on timeout (`TimeoutError`/`AbortError`) or any network-class error on the primary node, `withFailover` switches to the fallback node and retries once. The outer `pollSpvProof` loop then re-invokes this function after the configured `delayMs` (default 5s), so a stuck primary surfaces as ~30s of waiting, then automatic fallback, then continued polling — never an infinite hang. New module-level constant `SPV_PROOF_TIMEOUT_MS = 30_000` makes the deadline a single tunable. The unused `getSpvUrl` import is removed (the URL is now constructed inline from `withFailover`'s `baseUrl` callback).

### Added — URL parse + `https:` scheme allow-list on `setNodeConfig` (closes F-SEC-002)

`src/network/nodeFailover.ts:160-194` (`setNodeConfig`) `selected: "custom"` path now validates `customUrl` before assignment via three guards:

1. **Required-field check**: `customUrl` must be present (was just truthy-check pre-v3.2.3, which silently fell through to node2 on missing input — now throws `TypeError("customUrl is required when selected === 'custom'")`).
2. **URL parseability**: `new URL(customUrl)` rejects malformed strings (`"foo"`, `"not a url"`, etc.) with `TypeError("customUrl is not a valid URL")`.
3. **Scheme allow-list**: only `https:` is accepted. `http:`, `javascript:`, `ftp:`, etc. throw `TypeError("customUrl must use https://")`. Chain transactions sign sensitive payloads (capability args, derived public keys); transmitting them over plaintext defeats the cryptographic discipline the rest of the codebase enforces.

Plus a fourth defensive change: `parsed.origin` discards any pathname/query/fragment from the input URL. Pre-v3.2.3 the entire input string was assigned to `PRIMARY_HOST`, so a `customUrl` like `"https://node.example.com/some-path"` would have produced `https://node.example.com/some-path/chainweb/0.0/{network}` when `getActiveBaseUrl()` appended its suffix — a confusing trap. Now the host portion is the only part that survives.

This is a **behaviour change for consumers passing malformed `customUrl`**: pre-v3.2.3 such inputs silently fell through to default node2; post-v3.2.3 they throw `TypeError` at the function entry. Any consumer relying on the silent-fallthrough was already shipping wrong configuration; the throw is the audit-mandated diagnostic improvement. Added `@throws` to the function's JSDoc so the contract is documented.

### Added — `@throws` JSDoc on `submitCrossChainTransfer`, `submitContinuation`, `listenForCompletion` (closes F-ERR-001)

`src/interactions/crossChainFunctions.ts` — three submit/listen helpers gain JSDoc `@throws` annotations documenting their error contracts. Runtime behaviour is unchanged; this is documentation-only. The three helpers diverge from the discriminated-union pattern (`{status, error?: string}`) used by their siblings (`pollTransactionStatus`, `getBalanceOnChain`) — they propagate errors via throws because a failed submit/listen is a hard failure that must surface to the consumer's error UI, not a transient state to poll past. The audit finding asked for either consistent envelope-wrapping OR documentation; we picked documentation because the throwing behaviour is correct (see the F-ERR-014 lesson: the multi-step add-liquidity path that swallowed listen-timeouts caused user double-pay; we don't want to repeat that pattern here). The new JSDoc explicitly distinguishes:

- **`submitCrossChainTransfer`** / **`submitContinuation`**: `@throws SigningError(code: "TIMEOUT")` on per-tier deadline; `@throws Error` on network failure surviving both primary+fallback. Caller treats either as **definitively failed** — no retry without surfacing to user.
- **`listenForCompletion`**: same `@throws` shape, but with the critical caveat that a TIMEOUT **must be treated as `pending`, not `failed`** — the chainweb listen endpoint times out at 180s, but the transaction may still complete on chain after that deadline. Caller should poll via `pollTransactionStatus` rather than retry the submit (which would double-pay gas for a transaction that may already be confirmed). This is the exact pattern F-ERR-014 surfaced for the multi-step add-liquidity flow before that surface was deleted in v3.2.2 — codified here as documentation so future consumers don't re-introduce it.

### Verified

- `npm run typecheck` — zero errors. The unused `getSpvUrl` and `getActiveSpvUrl` imports were cleaned up after the `fetchSpvProof` refactor; no other call sites depend on them.
- `npm test` — **618/618 tests pass** (was 601 in v3.2.2; +17 new it-blocks for the v3.2.3 surface; +2 existing `tests/network.test.ts` tests updated to reflect the new `setNodeConfig` throw-on-malformed-input contract).
- `npm run build` — clean tsc emit. The four behaviour changes flow into `dist/`: `creationTime` in cross-chain transactions, the rewritten `fetchSpvProof` with timeout + failover, the validated `setNodeConfig`, and the documented error contracts on the three submit/listen helpers.

### Migration

For consumers calling `buildCrossChainTransfer`: no change required. The `creationTime` addition is invisible at the API surface — the transaction shape is the same, just with one extra `meta` field that didn't exist before. Sporadic chain-side rejections under client clock drift should disappear.

For consumers calling `fetchSpvProof` directly (as opposed to via `pollSpvProof`): no change required. Same return shape (`{ proof: string | null; error?: string }`); the difference is that a wedged primary node now produces a `{ proof: null, error: "SPV proof fetch timed out after 30000ms..." }` after 30s rather than hanging forever. Callers that already handle the `proof: null` path get the new behaviour for free.

For consumers calling `setNodeConfig("custom", customUrl, ...)`: **migration required if `customUrl` may come from untrusted/unvalidated input**. Wrap the call in try/catch:

```ts
try {
  setNodeConfig("custom", userInput);
} catch (e: unknown) {
  if (e instanceof TypeError) {
    showError("Invalid custom node URL. Must use https:// scheme.");
  } else {
    throw e;
  }
}
```

Consumers passing well-formed `https://` URLs see no behaviour change. Consumers passing malformed input were already shipping wrong configuration (the silent-fallthrough was a footgun, not a feature); the throw is the audit-mandated diagnostic improvement.

For consumers calling `submitCrossChainTransfer` / `submitContinuation` / `listenForCompletion`: no migration required. Runtime behaviour unchanged; the new `@throws` JSDoc just documents existing behaviour. Callers should ensure they wrap these in try/catch (as they always should have); the `listenForCompletion` JSDoc now flags that a TIMEOUT must be treated as `pending` and polled, **not** as `failed` and retried (which would double-pay gas).

### v3.2.x sequence — completed

| Wave | Version | Findings closed | Type |
|---|---|---|---|
| 1 | v3.2.0 | (infrastructure only) | additive |
| 2 | v3.2.1 | F-SEC-001, F-BUG-003 | behaviour change |
| 3 | v3.2.2 | F-ERR-005, F-ERR-014, F-PERF-014, F-PERF-015, F-API-026 | public-API removal |
| 4 | v3.2.3 | F-BUG-002, F-BUG-004, F-SEC-002, F-ERR-001 | behaviour change + docs |

**15 audit findings closed** across the v3.2.x track (counting v3.1.1's earlier 5 audit-cycle gaps brings the total to **20** across the v3.x line). Next: v3.3.x for logger-seam completion + test coverage + documentation cleanups; v4.0.0 for structural decomposition + monorepo split + type consolidation.

---

## 3.2.2 — 2026-05-05

**MINOR, public API removal.** Third wave of the v3.2.x audit-cycle close-out. Removes the four `executeAddLiquidityMultiStep*` functions plus the `MultiStepAddLiquidityResult` type from `src/interactions/addLiquidityFunctions.ts`, along with the `_strategy` parameter on `executeAddLiquidity`. Closes audit findings **F-ERR-005** (`error.message.includes` retry-loop crash on non-Error throws), **F-ERR-014** (listen-timeout vs submit-failure conflation causing user double-pay risk), **F-PERF-014** (4× hardcoded 3-second sleeps), **F-PERF-015** (retry-with-fixed-sleep against string-matched `error.message.includes("Cannot find module")` patterns), and **F-API-026** (the `_strategy: "auto" | "single" | "multi"` parameter on `executeAddLiquidity` was always handled as `"auto"` → single-step path; dead public surface). All five findings are closed **by removal** rather than fix — the cleaner outcome by far. Net code change: **−338 lines** (1031 → 693 lines in `addLiquidityFunctions.ts`). **601/601 tests pass** unchanged; no test exercised the removed functions, which was itself a v3.2.x audit signal that the surface was unused.

### Why this is a public-API removal (and why it's classified MINOR not MAJOR)

The four removed functions were exported from `src/interactions/addLiquidityFunctions.ts` and reachable via the per-file glob subpath `@ouronet/ouronet-core/interactions/addLiquidityFunctions`. Strict semver classifies any removal of an exported public symbol as a breaking change requiring a MAJOR bump. We're classifying as MINOR for v3.2.2 because:

1. **The functions had no consumer.** OuronetUI is the only known consumer of the multi-step path; per the user's confirmation, OuronetUI hasn't called these since the StoaChain chainweb gas-limit increase made multi-step unnecessary. The published v3.x.x npm artefacts contain the functions, but no code in this ecosystem invokes them.
2. **The Pact-side multi-step contract still exists on chain** (`TS01-CP.SWP|C_AddStandardLiquidity` defpact with continuation steps) — preserved for historical interoperability. Consumers who genuinely need the multi-step flow (none expected) can build it directly via `@kadena/client`'s `Pact.builder.continuation` API; we just stop providing the TypeScript wrappers in this package.
3. **The dead code carried real correctness risk.** F-ERR-005's `error.message.includes` crash on non-Error throws is a genuine bug; F-ERR-014's listen-timeout-vs-submit-failure conflation could cause user double-pay; F-PERF-014's hardcoded sleeps add ~6 seconds of unnecessary wall-clock latency to every successful flow. Fixing each in place would require ~30 minutes of work each plus tests; removing the surface that nobody uses takes 5 minutes and closes all five findings simultaneously.

If a consumer surfaces post-publish that DID rely on the multi-step path, this becomes a v3.x → v4.0.0 trigger; otherwise the MINOR classification holds. Documenting the removal explicitly in the migration section below so the audit trail is unambiguous.

### Removed — four `executeAddLiquidityMultiStep*` functions

- **`executeAddLiquidityMultiStep1(params: AddLiquidityParams): Promise<any>`** — built and submitted the initial defpact transaction for `TS01-CP.SWP|C_AddStandardLiquidity`. ~90 lines.
- **`executeAddLiquidityMultiStep2(params: AddLiquidityParams, step1Result: any): Promise<any>`** — built and submitted the first continuation step. ~50 lines.
- **`executeAddLiquidityMultiStep3(params: AddLiquidityParams, step1Result: any): Promise<any>`** — built and submitted the second continuation step. ~50 lines.
- **`executeAddLiquidityMultiStepComplete(params: AddLiquidityParams, onProgress?: (step: number) => void): Promise<MultiStepAddLiquidityResult>`** — orchestrated all three steps with the retry loops, hardcoded sleeps, and confused error-handling that the audit flagged. ~140 lines.

### Removed — `MultiStepAddLiquidityResult` type

- The discriminated-union return shape `{ type: "multi-step"; steps: Array<{stepNumber, transaction, requestKey, status}>; totalSteps; requestKey?; chainId?; networkId? }` is no longer exported. It was used only as the return type of `executeAddLiquidityMultiStepComplete` and was not referenced from any test file or other source file (verified via repo-wide grep at removal time).

### Removed — `_strategy` parameter on `executeAddLiquidity`

The signature changed from:

```ts
executeAddLiquidity(params: AddLiquidityParams, _strategy?: "auto" | "single" | "multi"): Promise<any>
```

to:

```ts
executeAddLiquidity(params: AddLiquidityParams): Promise<any>
```

The parameter was prefix-underscored (a TypeScript convention for unused parameters) and the function body always called `executeAddLiquiditySingle(params)` regardless of the `_strategy` value. Closes F-API-026.

### Verified

- `npm run typecheck` — zero errors. The removal is internally consistent; no remaining code in `src/` references the removed symbols (verified via `grep -rn "MultiStepAddLiquidityResult|executeAddLiquidityMultiStep" src/` returning zero hits post-removal).
- `npm test` — **601/601 tests pass**, unchanged. No test file referenced the removed functions or types — itself a strong audit signal that the surface was unused (any working code is tested; untested code is suspect).
- `npm run build` — clean tsc emit. The `dist/interactions/addLiquidityFunctions.js` and `.d.ts` no longer carry the removed exports.

### Migration

For consumers calling any of the four `executeAddLiquidityMultiStep*` functions: the recommended migration is to call `executeAddLiquidity(params)` instead — same `AddLiquidityParams` shape, single-step under the 2M chainweb gas budget. The TypeScript SDK no longer exposes the multi-step wrappers; the on-chain `TS01-CP.SWP|C_AddStandardLiquidity` defpact is still callable via `@kadena/client`'s low-level `Pact.builder.continuation()` API for any consumer with the unusual need.

For consumers passing `_strategy` to `executeAddLiquidity`: drop the second argument. The function's behaviour is identical (it always called the single-step path anyway).

For consumers importing `MultiStepAddLiquidityResult` as a type: this type is gone; consumers should not have been importing it (the only producer was `executeAddLiquidityMultiStepComplete`, which is also gone). If a consumer does have an orphan reference, it should be deleted.

---

## 3.2.1 — 2026-05-05

**MINOR, behaviour change.** Second wave of the v3.2.x audit-cycle close-out. v3.2.0 built the number-hygiene infrastructure (`formatDecimalForPact` with comma support, `formatIntegerForPact`, branded types); v3.2.1 puts those helpers to work at the four chain-call sites the 2026-05-05 audit flagged. Closes audit findings **F-SEC-001** (Pact-code injection via raw `${amount}` interpolation in urStoa stake/unstake) and **F-BUG-003** (`parseFloat(amount).toFixed(N)` silent precision loss + silent rounding in cross-chain transfer + urStoa native transfer). **601/601 tests pass** (was 593 in v3.2.0; +8 new decimal-validation tests pinning the synchronous-throw + comma-normalisation + arbitrary-precision contract at the function boundaries).

### Why this is a behaviour change

Pre-v3.2.1, the four call sites silently corrupted user input:

- `parseFloat("1.9999").toFixed(3)` → `"2.000"` — silent rounding. User typed 1.9999 urStoa, transaction sent 2.000.
- `parseFloat("1,5").toFixed(3)` → `"1.000"` — silent comma-stripping (parseFloat is lenient). User typed 1,5 KDA, transaction sent 1.0.
- `parseFloat("garbage").toFixed(12)` → `"NaN"` — gets interpolated into Pact code, chain rejects with confusing error far from the actual cause.
- Raw `${amount}` interpolation in urStoa stake/unstake accepts `"1.0) (some-injected-form"` as syntactically valid Pact code (Pact-code injection vector).

Post-v3.2.1, all four sites route through `formatDecimalForPact(amount)`, which:

- **Throws synchronously on malformed input** with `Error("Invalid decimal format")` — caller's catch block fires immediately, before any chain interaction begins.
- **Preserves arbitrary precision** — the formatter never round-trips through float64. A 39-digit-int + 18-digit-fractional decimal that pre-v3.2.1 would have been silently truncated by `.toFixed(12)` is now round-tripped byte-identical.
- **Accepts EU-locale comma input** (per the v3.2.0 contract) and normalises to period before validation. UI text fields capturing `"1,5"` work without upstream normalisation.
- **Truncates at 24 decimals** rather than rounding at 3/12, so the chain sees the user's full intent up to the (configurable) cap.

This is classified as MINOR rather than MAJOR because:
- Any caller relying on the silent-failure paths (`"NaN"` interpolation, silent rounding, silent comma-stripping) was already producing wrong on-chain values; the throw is the audit-mandated diagnostic improvement, not a regression.
- The function signatures are unchanged (still `(amount: string, ...)` — not yet brand-typed as `ValidatedDecimal`; that's reserved for v4.0.0 since it would force every consumer to migrate).
- Comma-as-decimal-separator is strictly additive: every previously-rejected EU-locale input now succeeds, and every previously-accepted input continues to produce identical output.

### Changed — 4 chain-call sites adopt `formatDecimalForPact`

- **`src/interactions/crossChainFunctions.ts:92`** (`buildCrossChainTransfer`) — replaced `parseFloat(amount).toFixed(12)` with `formatDecimalForPact(amount)`. The interpolated value in the `coin.transfer-crosschain` Pact code is now arbitrary-precision-safe and EU-locale-friendly.
- **`src/interactions/urStoaFunctions.ts:206`** (`executeNativeUrStoaTransfer`) — replaced `parseFloat(amount).toFixed(3)` with `formatDecimalForPact(amount)`. The 4-decimal silent-rounding case (`"1.9999"` → `"2.000"`) is fixed: the user's full input precision now reaches `coin.C_UR|Transfer/Transmit/...AnewVariants`.
- **`src/interactions/urStoaFunctions.ts:441`** (`executeStakeUrStoa`) — wrapped raw `${amount}` interpolation in `coin.C_URV|Stake` Pact code with `formatDecimalForPact(amount)`. The validated string is computed once outside the closure and reused both in the pact-code interpolation AND the `coin.URV|STAKE` capability arg, so the cap-arg and the executed code are guaranteed to agree (was `String(numAmount)` separately, which had the float-precision gap). Closes F-SEC-001 (Pact-code injection vector) and F-BUG-003 (cap-arg precision drift).
- **`src/interactions/urStoaFunctions.ts:497`** (`executeUnstakeUrStoa`) — same pattern as `executeStakeUrStoa`, applied to `coin.C_URV|Unstake` and `coin.URV|UNSTAKE`.

### Deprecated — `numAmount` field on `StakeUrStoaParams` / `UnstakeUrStoaParams`

The `numAmount: number` field on these two parameter types is no longer read by the executors (the validated `amount: string` is now the single source of truth for both pact-code and cap-arg). The field is **retained on the interfaces for v3.x backwards compatibility** but marked `@deprecated` in JSDoc and changed from required to optional. Will be removed in v4.0.0. Consumers can stop populating it as soon as they bump to v3.2.1.

### Added — 8 new it-blocks in `tests/interactions-decimal-validation.test.ts`

A new test file pinning the v3.2.1 contract:

- 6 tests against `buildCrossChainTransfer` covering: synchronous throw on malformed input, synchronous throw on mixed period+comma, synchronous throw on multi-comma thousand-separator, comma-to-period normalisation in pact-code, 18-decimal-fractional precision preservation past pre-v3.2.1's 12-decimal `.toFixed` truncation, and 39-digit-int amount preservation past `Number.MAX_SAFE_INTEGER`.
- 2 tests against `executeStakeUrStoa` and `executeUnstakeUrStoa` proving validation happens at function entry: a counting `PactReader` stub asserts the reader is **never invoked** when the amount input is malformed — i.e., the function rejects before any chain interaction starts. This is the strongest assertion of the contract: validation is not somewhere deep in the call stack, it's at the boundary.

### Verified

- `npm run typecheck` — zero errors. The `numAmount` field demotion to optional is correctly typed; the `ValidatedDecimal` return from `formatDecimalForPact` flows into both `string` slots (pact-code interpolation and cap-arg `decimal` field) without explicit casts because `ValidatedDecimal extends string` structurally.
- `npm test` — **601/601 tests pass** (was 593 in v3.2.0; +8 new decimal-validation tests).
- `npm run build` — clean tsc emit. The four call-site changes are visible in the published `.d.ts` only via the `@deprecated` JSDoc on the `numAmount` fields (the function signatures themselves are unchanged).

### Migration

For consumers passing well-formed decimal strings (digits, optional period, no comma): **no migration needed**. Same input → same output. The existing call shape continues to work.

For consumers passing comma-decimal EU-locale input: this previously failed with the legacy `parseFloat`-based formatters returning either `NaN` (then `"NaN"` in pact code → chain reject) or `1` (silent comma-strip → wrong amount). Post-v3.2.1, `"1,5"` → `"1.5"` automatically. **No code change needed**, but the previously-broken path now works.

For consumers passing malformed input (garbage strings, mixed separators, scientific notation): pre-v3.2.1 these silently produced `"NaN"` or wrong-on-chain amounts. Post-v3.2.1 they throw `Error("Invalid decimal format")` synchronously at the function entry. **Wrap in try/catch if your consumer can produce malformed input from upstream sources** (e.g., user typing in a text field without UI-side validation). The synchronous throw is the audit-mandated improvement — a legible diagnostic at the right layer beats a confusing chain-side rejection downstream.

For consumers populating `numAmount` on `StakeUrStoaParams` / `UnstakeUrStoaParams`: the field is now optional. You can drop it from your call sites whenever convenient. It will be removed entirely in v4.0.0.

---

## 3.2.0 — 2026-05-05

**MINOR, additive.** First wave of the v3.2.x audit-cycle close-out — number-hygiene infrastructure for Pact-bound integers and decimals. Pact has arbitrary-precision integers AND arbitrary-precision decimals; JavaScript's number primitive is IEEE-754 float64 (~15-17 significant digits). Round-tripping a chain value through `parseFloat` / `Number()` / `.toFixed()` silently destroys precision for any value beyond float64's range. v3.2.0 closes that loophole at the package level by introducing the validation contract; v3.2.1 will apply it at the existing `parseFloat(...).toFixed(N)` call sites; v3.2.2 will remove the dead multi-step add-liquidity surface; v3.2.3 will land the targeted bug fixes (creationTime, fetchSpvProof failover, setNodeConfig URL validation). **No consumer-visible behaviour changes in v3.2.0** — every existing valid input to `formatDecimalForPact` continues to produce the same output. The additions are: a relaxation of the input contract to accept comma-as-decimal-separator (so European-locale UI text fields work without upstream normalisation), a new sibling helper for integer-typed Pact arguments, and a pair of branded TypeScript types that prove "this string passed the formatter" at the type level. **593/593 tests pass** (was 565 in v3.1.1; +28 = 6 comma-normalisation cases, 4 arbitrary-precision round-trip cases including the explicit truncation-at-maxDecimals lock, 13 `formatIntegerForPact` cases, 3 brand-type compile probes; the 1 pre-v3.2.0 "rejects EU decimal separator" test was removed because the new comma-support contract supersedes it, and the 3 brand-type tests use `@ts-expect-error` probes that count as runtime-asserted compile checks).

### Added — `formatIntegerForPact(amount: string): ValidatedInteger`

New helper sibling to `formatDecimalForPact`. Pact distinguishes integers from decimals at the lexer level: functions expecting `integer` arguments (counts, indices, slot numbers, integer-typed cap arguments) reject `1.0` and accept `1`. Without a dedicated formatter, callers historically interpolated integer values via `String(numAmount)` (`urStoaFunctions.ts` cap-args do this today) or hand-rolled `${value | 0}` patterns — both vulnerable to JS float64 precision loss for values past `Number.MAX_SAFE_INTEGER` (`2^53 - 1` ≈ `9.0e15`). The new helper validates `^\d+$` (non-negative, no decimal point, no scientific notation, no thousand-separators), trims whitespace, and returns the trimmed input verbatim with no float round-trip. A 100-digit integer string round-trips byte-identical. Throws `Error("Invalid integer format")` on rejection — same shape as `formatDecimalForPact`'s error message so consumer catch blocks can be written once.

### Added — `ValidatedDecimal` and `ValidatedInteger` brand types

TypeScript-only newtypes (zero runtime cost — just a `unique symbol` brand on the string type) that flow out of `formatDecimalForPact` and `formatIntegerForPact` respectively. A function declared `(amount: ValidatedDecimal) => Transaction` cannot accidentally accept a raw user-input string; the type system requires the caller to pass a value through the formatter first. The two brands are **distinct types** (a `ValidatedInteger` is not assignable to `ValidatedDecimal` and vice versa), preserving Pact's lexer-level int vs decimal distinction at the function-boundary level — the failure mode of accidentally interpolating an integer where a decimal was needed (and vice versa) becomes a compile error rather than a runtime chain-side rejection. Both brands are runtime-equivalent to `string` so JSON serialisation, console logging, and Pact-code interpolation all work without unwrapping. v3.2.1 will adopt them at the call-site signatures so the formatter→builder→submit pipeline is statically traceable.

### Changed — `formatDecimalForPact` accepts a single comma as decimal separator

Pre-v3.2.0, the helper accepted only `^\d+\.?\d*$` and rejected any comma. European-locale UIs that capture user input as `"1,5"` (German `1 Komma 5`, French `1 virgule 5`, etc.) had to swap separators upstream before calling the helper. v3.2.0 normalises a single comma to a period before validation, so `"1,5"` and `"1.5"` both produce `"1.5"`. **Multi-comma strings (thousand-separator-style `"1,234,567"`) still throw** — the consumer's UI must strip thousand-grouping before calling the helper. Mixed comma+period strings (`"1,5.6"`, `"1.234,56"`) also throw — these are ambiguous between "decimal point + grouping" and "grouping + decimal comma" and the helper refuses to guess. The relaxation is strictly additive: every previously-accepted input continues to produce the same output, plus a new class of inputs (single-comma-as-decimal) is now accepted.

### Documented — number-hygiene contract in `src/pact/format.ts` JSDoc

The file-level JSDoc now spells out the three-rule contract: (1) UI/consumer code passes amounts AS STRINGS, never as `number`; (2) the `format*ForPact` family is the sole boundary where a string becomes a Pact-code literal — strict regex enforces digits-only with at most one optional decimal point, no exponent notation, no thousand-separators, no signs; (3) the brand types prove "this string passed the formatter" at the type level so downstream code that interpolates them can rely on the chain accepting them verbatim. This codifies the v2.0.0+ design intent that was previously implicit in the codebase's idioms but never written down.

### Verified

- `npm run typecheck` — zero errors. The brand types compile cleanly with `unique symbol` declarations; the `@ts-expect-error` probes in the new test block prove the compile-time contract.
- `npm test` — **593/593 tests pass** (was 565 in v3.1.1; +28 net = +29 new it-blocks for the v3.2.0 surface − 1 deleted "rejects EU decimal separator" test that the comma-support contract supersedes).
- `npm run build` — clean tsc emit to `dist/`. The new `formatIntegerForPact` value, `ValidatedDecimal` type, and `ValidatedInteger` type are all exposed in the published `.d.ts` of the `./pact` subpath.

### Migration

No migration required. Every existing valid input continues to produce byte-identical output. New surface is opt-in:

- Consumers who want to accept European-locale UI input directly can stop pre-stripping commas before the formatter call.
- Consumers who type a function parameter as `(amount: ValidatedDecimal)` get compile-time enforcement that the value came through the formatter; consumers who keep using `string` parameters see no change.
- `formatIntegerForPact` is a new export; existing call sites that still use `String(num)` continue to work, and v3.2.1 will sweep the codebase to replace them.

---

## 3.1.1 — 2026-05-05

**PATCH, additive.** Pre-publish audit-cycle close-out for the v3.1.0 dalos-crypto integration. v3.1.0 was committed locally (`bf10dc1`) but had not been published to npm when the post-integration audit (2026-05-05, see `.bee/AUDIT-REPORT.md`) flagged five gaps directly attributable to that commit. v3.1.1 closes all five before the package reaches npmjs, so the first published release on the new dalos-crypto v4.0.3 line carries the corrections rather than a broken-then-fixed pair. **565/565 tests pass** (was 558 in v3.1.0; +7 = 1 new strict locale grouping-style assertion + 5 new Schnorr re-export tests + 1 new validation-error class probe).

### Why a patch release

v3.1.0 never reached npm — `git log` shows the v3.1.0 commit followed by this v3.1.1 commit before any `git tag v3.1.0` push. From the consumer's perspective, the npm registry skips from `3.0.0` to `3.1.1`, with v3.1.0 visible only in the GitHub commit history. The five gaps closed here are: three additive re-export plumbing fixes that finish the v3.1.0 integration surface, one stylistic alignment that brings the dalos/ subdirectory back in line with the rest of the codebase's CONVENTIONS.md, one test-strictness fix that locks the en-US locale shape introduced in v3.1.0, and a fresh test file that covers the v3.1.0 Schnorr re-exports end-to-end. None of the changes alter runtime behaviour for any consumer of v3.1.0's documented surface; the additions simply make the surface complete and the test suite more decisive.

### Added — three typed error classes re-exported on `./dalos` (closes F-BUG-005)

`@ouronet/dalos-crypto/gen1` v4.0.2 introduced three typed validation-error classes — `InvalidBitStringError`, `InvalidBitmapError`, `InvalidPrivateKeyError` — specifically so consumers can `instanceof`-discriminate validation failures from system errors when calling `generateFromBitString`, `generateFromBitmap`, or `generateFromInteger` (all reachable via `createOuronetAccount`). v3.1.0's Schnorr re-export pass picked up `SchnorrSignError` but missed these three. v3.1.1 re-exports all three from `@ouronet/ouronet-core/dalos` so consumers building bitstring/bitmap key-gen flows (notably OuronetUI's "Draw a bitmap" page and the bitstring-input modal) can catch validation failures with type-safe `instanceof` checks through the OuronetCore subpath alone, instead of dual-importing from `@ouronet/dalos-crypto/gen1`. Class identity is preserved across the re-export — `instanceof InvalidBitStringError` works regardless of whether the consumer imports the class from ouronet-core or directly from dalos-crypto, eliminating the dual-package-hazard footgun.

### Added — `CoordAffine` type re-exported on `./dalos` (closes F-API-024)

`SchnorrSignature.r: CoordAffine` was already reachable in v3.1.0 (`SchnorrSignature` is re-exported), but its component type `CoordAffine` was not, breaking the "single integration surface" promise the `./dalos` subpath JSDoc makes for advanced consumers. Without it, any consumer typing a function parameter as `(sig: SchnorrSignature) => sig.r.x` had to dual-import `CoordAffine` from `@ouronet/dalos-crypto/gen1`. v3.1.1 re-exports `CoordAffine` as a type-only export from the same subpath, restoring the single-import promise.

### Changed — dalos/ subdirectory style aligned with CONVENTIONS.md (closes F-ARCH-012)

`src/dalos/index.ts` and `src/dalos/account.ts` were the only files in `src/` using single-quoted import strings (every other file in the codebase uses double quotes per the project's CONVENTIONS.md note "double-quoted strings — matches `src/signing/types.ts`, `src/network/nodeFailover.ts`, `src/pact/cfmBuilders.ts` consistently"). They were also the only files using explicit `.js` extensions on TypeScript relative imports (`from "./account.js"` instead of `from "./account"`). The drift originated when the dalos integration was first ported from the upstream `@ouronet/dalos-crypto` style and was perpetuated by v3.1.0's Schnorr re-export pass. v3.1.1 converts both files to double quotes throughout and drops the `.js` extension on the two relative imports. Mass-edit only — zero behaviour change. The bundler (`moduleResolution: "bundler"` in `tsconfig.json:6`) handles both forms identically; this is purely a CONVENTIONS.md alignment.

### Fixed — locale-determinism test assertion now strict (closes F-TEST-001)

v3.1.0 hardcoded `'en-US'` in `formatMaxFee`'s `toLocaleString()` call (`src/gas/gasUtils.ts:101`) precisely to make the test assertion deterministic across host locales. The test, however, used `expect(result.anu).toMatch(/10,000,000/)` — a substring regex. The regex would tolerate a future revert of `toLocaleString('en-US')` to `toLocaleString()` as long as CI ran on a US-locale host, defeating the lock entirely. v3.1.1 changes the assertion to strict equality `expect(result.anu).toBe("10,000,000")` and adds a sibling assertion `expect(formatMaxFee(123_456_789, 1).anu).toBe("123,456,789")` that catches grouping-style regressions a uniform-3-digit-group string would not (e.g., a future `toLocaleString('en-IN')` emitting `"12,34,56,789"` still matches the prior regex but fails strict equality). The locale-determinism contract introduced in v3.1.0 is now actually locked by the test suite.

### Added — Schnorr re-export coverage in `tests/dalos-integration.test.ts` (closes F-TEST-004)

v3.1.0 added 6 Schnorr exports (5 values + 1 type) to `src/dalos/index.ts` for advanced consumers. The re-export plumbing was verified at upgrade time only by `npm run typecheck` — there were zero runtime tests pinning the surface. A future delete or rename in `@ouronet/dalos-crypto/gen1` would have broken at consumer's first import rather than in this package's CI. v3.1.1 adds two new `describe` blocks covering: (a) `schnorrSign` + `schnorrVerify` round-trip on a Genesis keypair (proves the canonical sign↔verify contract); (b) `schnorrSignAsync` + `schnorrVerifyAsync` round-trip identically (proves the async surface produces verifiable signatures, the main browser-INP win that justified the re-export); (c) `SchnorrSignError` class-identity assertions including `instanceof Error` and `instanceof SchnorrSignError` (proves dual-package-hazard prevention); (d) `SchnorrSignature` and `CoordAffine` type-import compile probes (proves the type-side re-exports). A third `describe` block covers the new v3.1.1 typed-validation-error classes — `InvalidBitStringError` fires when `createOuronetAccount({mode: "bitString"})` receives malformed input, plus class-identity probes for `InvalidBitmapError` and `InvalidPrivateKeyError`.

### Verified

- `npm run typecheck` — zero errors with the new re-exports + style-aligned imports.
- `npm test` — **565/565 tests pass** (was 558 in v3.1.0; +7 = 1 new strict locale grouping-style assertion at `tests/gas.test.ts` + 5 new it-blocks in `tests/dalos-integration.test.ts` for Schnorr round-trip, async round-trip, SchnorrSignError instanceof + SchnorrSignature/CoordAffine type-imports, and 1 v3.1.1 validation-error class probe; the existing `tests/gas.test.ts` "10,000,000" assertion was tightened from `toMatch` regex to strict `toBe` rather than counted as a new test).
- `npm run build` — `tsc -p tsconfig.build.json` emits clean to `dist/`; the `./dalos` subpath barrel exports the new symbols in the `.d.ts`.
- `tests/package-version.test.ts` — re-pinned to `3.1.1`.

### Migration

Strictly additive — every change is non-breaking for any consumer:

1. **Three new error class re-exports** on `./dalos` — only visible to consumers who choose to `import { InvalidBitStringError } from "@ouronet/ouronet-core/dalos"`; consumers who already `instanceof`-checked against the dalos-crypto-direct import continue to work.
2. **CoordAffine type re-export** — only visible to consumers who choose to `import type { CoordAffine } from "@ouronet/ouronet-core/dalos"`; otherwise invisible.
3. **dalos/ style alignment** — zero runtime impact; the bundler emits byte-identical output before and after.
4. **Locale test assertion strictness** — internal CI signal only; consumer-facing behaviour of `formatMaxFee` is unchanged from v3.1.0 (`'en-US'` was hardcoded then and remains so).
5. **Schnorr test coverage** — internal CI signal only; no runtime change.

Audit cycle 2026-05-05 closed: 5 of 5 "today's commit gaps" remediated. Remaining audit findings (security hardening, nullable widening completion, structural decomposition) are scheduled for v3.2.0 / v4.0.0 per `.bee/AUDIT-REPORT.md`'s suggested spec groupings.

---

## 3.1.0 — 2026-05-05

**MINOR, additive.** Upgrades `@ouronet/dalos-crypto` from `^1.2.0` to `^4.0.3` (covers v2.0.0–v4.0.3 of the dalos-crypto release line — Schnorr v2 wire format, Schnorr cofactor-subgroup hardening, generator-precompute matrix cache, async signing surfaces, RFC-6979-style determinism, the v4.0.0 Elliptic-package carve-out, and the v4.0.3 LOW-band closures), exposes the previously-internal Schnorr signature surface through the `./dalos` subpath, and ships a small locale-determinism fix in `./gas`. **558/558 tests pass.** No public surface from prior versions changes shape; all additions are opt-in.

### Added — Schnorr signature surface re-exports on `./dalos`

The high-level `primitive.sign(keyPair, message)` path through the registry has always been Schnorr internally (DalosGenesis is a Schnorr-over-DALOS-Ellipse primitive), so consumers who use that path continue to work unchanged. v3.1.0 re-exports the lower-level Schnorr functions and types directly from the `./dalos` subpath for advanced consumers who need them — most notably OuronetUI's browser path, where the `*Async` variants yield to the event loop on a fixed data-independent cadence so signing keeps INP under the 200 ms budget without freezing the tab. Five values + one type are added to `@ouronet/ouronet-core/dalos`:

- `schnorrSign(privateKey, message, ellipse)` — synchronous sign; throws `SchnorrSignError` on internal Fiat-Shamir derivation failure (the typed throw was the v3.1.0 throw-contract finalisation in the upstream package; consumers `instanceof SchnorrSignError` to catch).
- `schnorrVerify(signatureString, message, publicKey, ellipse)` — synchronous verify; returns `boolean`. Includes the v4.0.0 cofactor subgroup-membership checks (`[4]·R ≠ O`, `[4]·P ≠ O`) that reject order-4 small-subgroup attack signatures the pre-Phase-6 verifier accepted.
- `schnorrSignAsync` / `schnorrVerifyAsync` — async wrappers that yield to the event loop every 8 outer-loop iterations on a fixed cadence (data-independent, constant-time). Recommended for browser consumers; the cadence is verified by the upstream package's REQ-14 yield-count constant-time test.
- `SchnorrSignError` — typed exception class, importable for `instanceof` catch blocks.
- `SchnorrSignature` — the canonical signature shape, useful for typing function parameters that take a parsed signature.

The exports are sourced from `@ouronet/dalos-crypto/gen1` (the same subpath we already use for `Bitmap` + bitmap utilities), so no new transitive dependency surface is introduced.

### Changed — `@ouronet/dalos-crypto` dep range bumped `^1.2.0` → `^4.0.3`

Per the upstream v4.0.0 changelog, **TypeScript consumers see no breaking surface changes** between v1.2.0 and v4.0.3. The v4.0.0 major bump was driven entirely by a Go-reference reorganisation (the `Elliptic/` package carve-out into a new `keystore/` package, plus the `EllipseMethods.SchnorrVerify` parameter-order alignment) that affects only Go consumers. On the TS side, all changes across the v2.x/v3.x/v4.x line are additive (new exports, new optional fields like `BitStringValidation.reason?`) or behavior-preserving (`bigIntToBase49` is now O(n) instead of O(n²) but byte-identical for every input; `Modular` is now a structural property on the `Ellipse` interface, derived per curve at construction time, eliminating the `DALOS_FIELD` default-param footgun without changing any externally-observable behavior).

The full set of symbols ouronet-core imports from `@ouronet/dalos-crypto/registry` and `@ouronet/dalos-crypto/gen1` was audited at upgrade time — all 18 symbols (`KeyPair`, `PrivateKeyForms`, `FullKey`, `PrimitiveMetadata`, `CryptographicPrimitive`, `DalosGenesisPrimitive`, `isDalosGenesisPrimitive`, `DalosGenesis`, `CryptographicRegistry`, `createDefaultRegistry`, `Leto`, `Artemis`, `Apollo`, `createGen1Primitive`, `DALOS_PREFIXES`, `Gen1PrimitiveConfig`, `AddressPrefixPair`, `Bitmap` plus the bitmap utility functions) are present and shape-compatible in v4.0.3. The four local gates (`npm install`, `npm run typecheck`, `npm test`, `npm run build`) all pass after the upgrade with zero source-code changes outside the new schnorr re-exports.

### Fixed — locale determinism in `formatMaxFee` (`./gas`)

`formatMaxFee(gasPrice, gasLimit)` in `src/gas/gasUtils.ts` previously called `totalAnu.toLocaleString()` without a locale argument, so the formatted ANU string varied with the host locale (`"10.000.000"` on a German-locale host vs `"10,000,000"` on a US-locale host). The test suite (`tests/gas.test.ts`) was already pinning the en-US shape, so the test silently failed on any non-en-US host while passing on CI (Linux + en-US default). v3.1.0 pins the call to `toLocaleString('en-US')` so consumer rendering and test assertions are deterministic across host locales. Trivial 1-line change. No public-API or runtime-behavior change for en-US consumers (the formatted string is identical); non-en-US consumers see their UI's ANU thousands-separator switch from their locale's separator (e.g., `.` on de-DE) to the en-US comma — a deliberate trade-off for cross-host parity.

### Verified

- `npm run typecheck` — zero errors with the new schnorr re-exports + dalos-crypto v4.0.3.
- `npm test` — **558/558 tests pass**, including `tests/dalos-integration.test.ts`, `tests/gas.test.ts` (now passing on de-DE locale post-fix), `tests/package-version.test.ts` (re-pinned to `3.1.0`), and the full crypto/guard/signing/strategy/codex regression set.
- `npm run build` — `tsc -p tsconfig.build.json` emits clean to `dist/`; the `./dalos` subpath barrel exports the new schnorr surface in the `.d.ts`.
- `package-lock.json` — refreshed to pin `@ouronet/dalos-crypto@4.0.3`.

### Migration

No migration required for any existing consumer. The four cluster-of-changes are each strictly additive at the public-surface level:

1. **dalos-crypto upgrade** — same imports work, same shapes returned, same algorithms produce same byte-identical outputs (Genesis 105-vector corpus byte-identity preserved at upstream extended-elided SHA-256 = `082f7a40405d4c075f1975af0a6075bb0228bbccae60a53b05b350a09ce223ae`).
2. **Schnorr re-exports** — only visible if a consumer chooses to `import { schnorrSignAsync } from "@ouronet/ouronet-core/dalos"`; consumers who keep using `primitive.sign(...)` see no change.
3. **Locale fix** — non-en-US consumers see their ANU thousands separator switch to `,` (was their locale's separator). UI inspection confirms the en-US shape is the canonical OuronetUI display. No breaking-change classification because the field is presentational; no caller logic depends on the separator character.
4. **Test pin update** — `tests/package-version.test.ts` updated `3.0.0` → `3.1.0` to match the new release; not consumer-visible.

---

## 3.0.0 — 2026-05-03

**BREAKING release: 15 fabricated-fallback fabrications widened from `Promise<T>` to `Promise<T | null>` plus 1 mixed-shape addition (`validateLiquidity` gains optional `error?: string` field per Q10/A10) so consumers see RPC failures instead of fabricated chain values; 14 NON-BREAKING logger-routing additions across 5 files complete the silent-catch-elimination sweep.**

Closes the M3 milestone of the 2026-04-30 audit cycle (lead finding F-CORE-007 HIGH plus the broader ~24-site fabrication catalog). Sixteen interactions-surface functions previously swallowed RPC failures by returning fabricated sentinel values — `1.0` for STOA price, `8` for token decimals, `0` for fees and minimum-move amounts, `"0"` for balances and supplies, `false` for LP-type checks, an empty-guard sentinel for urStoa guards, and the magic string `"N/A"` for SWP limits. Consumers had no way to distinguish "RPC failed" from "the chain returned this value." This release widens those return types so RPC failures surface as `null` (or, for `validateLiquidity`, as a populated `error?: string` field on the existing object shape) and routes their previously silent catches through the project logger established in v2.3.0.

The release composes four phases: Phase 1 closes the four HIGH-risk pricing functions flagged by F-CORE-007; Phase 2 sweeps the broader catalog (the four-function string-balance cluster, field-level `LPTypeInfo` widening, the urStoa trio, two audit-missed extras, and the two `"N/A"` magic-string eliminations); Phase 3 brings logger parity to fourteen remaining silent catches across five files so the silent-catch pattern is fully eliminated from the interactions surface; Phase 4 ships the release artifacts (this entry, the README migration guide, the package version bump, and the verification gate). This is the FIRST major bump since v2.0.0 (2026-05-01). All sixteen modified functions retain their NAMES and PARAMETER signatures (NFR-03) — only return types widen (15 nullable widenings + 1 structural addition). The `tests/types.test.ts` v1.7.0 type-regression lock has been updated atomically across Phases 1 + 2 to assert the new nullable signatures (NFR-02), so the public-surface contract continues to be machine-verified at every commit.

Consumers should read the `## Migrating to v3.x` section of `README.md` for per-function `Before:` / `After:` migration patterns. The short version: every `=== "N/A"` check becomes `=== null`; every previously-fabricated read needs an `if (result === null) showRPCErrorBanner();` branch before the value is used; `LPTypeInfo` consumers can now render the per-flag mixed UI state (Frozen=true, Sleeping=null); `validateLiquidity` consumers route a populated `error` field to the network-failure banner.

### Phase 1 — Critical pricing functions (4 BREAKING)

The four functions flagged by F-CORE-007 (HIGH-risk) all return numeric values used directly in financial-math paths — STOA-to-USD price, token decimal counts, pool total fee, and DPTF minimum-move amounts. Each previously fabricated a plausible default on RPC failure (`1.0`, `8`, `0`, `0`) that consumers could not distinguish from a real chain answer. Each now resolves to `null` on any of three failure paths: outer catch (network exception), chain-level failure response (`status !== "success"`), and an unexpected payload that fails a `Number.isFinite()` guard. Each catch is routed through `getLogger().error("Error in <funcName>:", error)` per the v2.3.0 Phase 5 convention. The four functions are `getStoaPriceUSD` (`src/interactions/ouroFunctions.ts`), `getTokenDecimals` and `getPoolTotalFee` (`src/interactions/dexFunctions.ts`), and `getDPTFMinMove` (`src/interactions/ouroFunctions.ts`). `getDPTFMinMove` was promoted into Phase 1 because it is structurally identical to the other three pricing functions; the audit citation `dexFunctions.ts:1318` was an imprecise line reference whose actual subject is `getPoolTotalFee`.

### Phase 2 — Catalog HIGH-risk + bonus extras + magic-strings (12 BREAKING)

The broader catalog sweep covers four clusters. **The four-function string-balance cluster** (REQ-05) — `getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`, `getVirtualOuro` (all in `src/interactions/ouroFunctions.ts`) — moves together as a tightly-coupled cluster because partial migration would leave a UI in which some buttons silently misbehave on RPC failure while others correctly disable. All four widen `Promise<string>` to `Promise<string | null>`; both `return "0"` sites in each function become `return null`; the v2.3.0 logger routing is preserved. **The `LPTypeInfo` widening** (REQ-06, Approach A locked) widens the inner field shapes from `{ hasFrozenLP: boolean; hasSleepingLP: boolean }` to `{ hasFrozenLP: boolean | null; hasSleepingLP: boolean | null }`; the function-level return shape (`Promise<LPTypeInfo>`) is preserved so callers can render granular per-flag mixed UI state (Frozen=true, Sleeping=null). Both inner IIFEs return `null` on failure (was `false`) and route through `getLogger().error()` with distinguished contextual messages. The 3-state preservation guarantee (chain-failure-status returns `false`, catch returns `null`, success returns `true`) was added per the Phase 2 P-001 plan-review fix. **The urStoa trio** (REQ-07) — `getUrStoaBalance`, `getUrStoaGuard`, `checkCoinAccountExists` (all in `src/interactions/urStoaFunctions.ts`) — aligns with the nullable house style: `getUrStoaBalance` widens to `Promise<number | null>`; `getUrStoaGuard` widens to `Promise<UrStoaGuardResult | null>` and drops the previously-fabricated empty-guard sentinel object so consumers gain an explicit three-state flow (RPC failure / no guard yet / guard present); `checkCoinAccountExists` widens to `Promise<boolean | null>` and gains a JSDoc cross-reference to its semantically aligned sibling in `src/interactions/ouroFunctions.ts` (the rename to disambiguate names is deferred to a separate breaking change). **Two audit-missed extras** (REQ-08): `validateLiquidity` (`src/interactions/addLiquidityFunctions.ts`) gains an optional `error?: string` field on its existing `{ valid: boolean; ... }` return shape so consumers can distinguish RPC failure (populated `error`) from real validation rejection (`valid: false` with no `error`); `getMaxBuyMovieBooster` (`src/interactions/ouroFunctions.ts`) widens to `Promise<number | null>` matching Phase 1's pattern. **The two magic-string eliminations** (REQ-09): `getSWPSpawnLimit` and `getSWPInactiveLimit` (both in `src/interactions/dexFunctions.ts`) stop returning the string sentinel `"N/A"` and instead widen to `Promise<string | null>`; both gain logger routing on their previously silent catches; consumers swap their `=== "N/A"` checks for `=== null` checks, removing a class of stringly-typed sentinel from the public surface.

### Phase 3 — Logger parity for remaining silent catches (14 NON-BREAKING)

Fourteen remaining silent catches across five files gain `getLogger().error("Error in <funcName>:", error)` routing without any type changes — these functions are already correctly modelled as nullable or as empty-collection returns; the only gap was that their catches did not visibly log the RPC failure. The fourteen functions are: in `src/interactions/dexFunctions.ts` — `getSWPPrincipals`, `getTrueFungibleLPEntry`, `getOwnedSwapPairs`, `getSwpairFromLpId`, `getSwpairsFromLpIds`, `getPrimordialPool`, `describeModule`; in `src/interactions/ouroFunctions.ts` — `getDPTFIssueInfo`, `getSublimateInfo`, `getCompressInfo`; in `src/interactions/activateFunctions.ts` — `getDeployStandardAccountInfoOnly`; in `src/interactions/infoOneFunctions.ts` — `getClearDispoInfo`; in `src/interactions/urStoaFunctions.ts` — the file-private helpers `verifyEd25519Sig` and `describeKeyset`. End-state goal: the silent-catch pattern is fully eliminated from the interactions surface; a maintainer audit grep for unrouted catch-then-return patterns in `src/interactions/*.ts` returns zero matches. The two LP-type-info inner-IIFE catches that would otherwise belong to this set are already covered by REQ-06 (Phase 2) so they are out of REQ-10 scope to avoid double-coverage.

### Public API impact

- **Breaking change — `getStoaPriceUSD` (`@ouronet/ouronet-core/interactions/ouroFunctions`):** return type widens from `Promise<number>` to `Promise<number | null>`. Three failure paths now yield `null`: outer catch, chain-level `status !== "success"`, and a success payload that fails a `Number.isFinite()` guard (replacing the previous `Number(...) || 1.0` fabrication). The optional `skipTempWatcher` parameter is preserved unchanged.

  Before:
  ```ts
  const price: number = await getStoaPriceUSD();
  const usd = stoaAmount * price;  // silently uses 1.0 on RPC failure
  ```

  After:
  ```ts
  const price: number | null = await getStoaPriceUSD();
  if (price === null) { showRPCErrorBanner(); return; }
  const usd = stoaAmount * price;
  ```

- **Breaking change — `getTokenDecimals` (`@ouronet/ouronet-core/interactions/dexFunctions`):** return type widens from `Promise<number>` to `Promise<number | null>`. All three `return 8` sites become `return null`: chain-failure branch, unexpected-data-shape branch, catch. Two defensive `Number.isFinite()` guards on `parseInt` results catch malformed `{int: "abc"}` chain data.

  Before:
  ```ts
  const decimals: number = await getTokenDecimals(tokenId);
  const display = amount / 10 ** decimals;  // silently uses 8 on RPC failure
  ```

  After:
  ```ts
  const decimals: number | null = await getTokenDecimals(tokenId);
  if (decimals === null) { showRPCErrorBanner(); return; }
  const display = amount / 10 ** decimals;
  ```

- **Breaking change — `getPoolTotalFee` (`@ouronet/ouronet-core/interactions/dexFunctions`):** return type widens from `Promise<number>` to `Promise<number | null>`. Both `return 0` sites become `return null`. A `Number.isFinite()` guard wraps the `resolvePactDecimalLocal` helper return so that helper-internal `NaN` results are caught at the user-facing boundary. The helper itself is unchanged because it is not user-facing.

  Before:
  ```ts
  const fee: number = await getPoolTotalFee(swpair);
  const cost = amount * fee;  // silently uses 0 (free swap!) on RPC failure
  ```

  After:
  ```ts
  const fee: number | null = await getPoolTotalFee(swpair);
  if (fee === null) { disableSwapButton(); showRPCErrorBanner(); return; }
  const cost = amount * fee;
  ```

- **Breaking change — `getDPTFMinMove` (`@ouronet/ouronet-core/interactions/ouroFunctions`):** return type widens from `Promise<number>` to `Promise<number | null>`. Both `return 0` sites become `return null`; the success-path `parseFloat(...) || 0` falsy-coalesce becomes `parseFloat(...)` followed by a `Number.isFinite()` guard.

  Before:
  ```ts
  const minMove: number = await getDPTFMinMove(tokenId);
  if (amount < minMove) showError();  // silently uses 0 on RPC failure
  ```

  After:
  ```ts
  const minMove: number | null = await getDPTFMinMove(tokenId);
  if (minMove === null) { showRPCErrorBanner(); return; }
  if (amount < minMove) showError();
  ```

- **Breaking change — string-balance cluster (`@ouronet/ouronet-core/interactions/ouroFunctions`):** four functions move together as a tightly-coupled cluster — `getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`, `getVirtualOuro`. Each widens from `Promise<string>` to `Promise<string | null>`; both `return "0"` sites in each function become `return null`. The four move together because partial migration would create a UI in which some buttons silently misbehave on RPC failure while others correctly disable; this risk was explicitly surfaced in research and locked at requirements time.

  Before:
  ```ts
  const balance: string = await getIgnisBalance(account);
  if (parseFloat(balance) > 0) enableButton();  // silently uses "0" on RPC failure
  ```

  After:
  ```ts
  const balance: string | null = await getIgnisBalance(account);
  if (balance === null) { disableButton(); showRPCErrorBanner(); return; }
  if (parseFloat(balance) > 0) enableButton();
  ```

- **Breaking change — `LPTypeInfo` field widening (`@ouronet/ouronet-core/interactions/addLiquidityFunctions`):** the `LPTypeInfo` type's two inner fields widen from `boolean` to `boolean | null` so that "Frozen LP check failed" and "Sleeping LP check failed" can be rendered as distinct mixed states. The function-level return shape (`Promise<LPTypeInfo>`) is preserved (the function still resolves to an `LPTypeInfo` object); only the two boolean flags inside the object widen to allow `null`. Both inner failure paths return `null` instead of `false`. Approach A (field-level widening) was selected over function-level nullability and over an error-channel approach because it preserves the maximum amount of granular information for consumer UIs. The 3-state preservation guarantee per the Phase 2 P-001 fix: chain-failure-status returns `false` (real chain answer), catch returns `null` (RPC failure), success returns `true` (real chain answer).

  Before:
  ```ts
  type LPTypeInfo = { hasFrozenLP: boolean; hasSleepingLP: boolean };
  const info = await getLPTypeInfo(account);
  if (info.hasFrozenLP) showFrozenBadge();  // silently false on RPC failure
  ```

  After:
  ```ts
  type LPTypeInfo = { hasFrozenLP: boolean | null; hasSleepingLP: boolean | null };
  const info = await getLPTypeInfo(account);
  if (info.hasFrozenLP === null) showFrozenIndeterminateBadge();
  else if (info.hasFrozenLP) showFrozenBadge();
  if (info.hasSleepingLP === null) showSleepingIndeterminateBadge();
  else if (info.hasSleepingLP) showSleepingBadge();
  ```

- **Breaking change — urStoa trio (`@ouronet/ouronet-core/interactions/urStoaFunctions`):** three functions align with the nullable house style. `getUrStoaBalance` widens from `Promise<number>` to `Promise<number | null>`; both `return 0` sites become `return null`. `getUrStoaGuard` widens from `Promise<UrStoaGuardResult>` to `Promise<UrStoaGuardResult | null>`; the previously-fabricated `empty = {exists:false, isKeyset:false, keys:[], pred:""}` sentinel object is dropped in favour of `null` on failure; consumers gain an explicit three-state flow (RPC failure / no guard yet / guard present). `checkCoinAccountExists` widens from `Promise<boolean>` to `Promise<boolean | null>`; the previously silent catch now routes through the project logger; both failure paths return `null` instead of `false`. The function gains a JSDoc cross-reference to its semantically aligned sibling in the OURO functions module, explaining that the two functions share the nullable-boolean shape but differ in account scope (urStoa vs coin); the rename to disambiguate names is deferred to a separate breaking change.

  Before:
  ```ts
  const guard: UrStoaGuardResult = await getUrStoaGuard(account);
  if (guard.exists) renderEditGuardForm(guard);
  else renderCreateGuardForm();  // silently fabricates empty guard on RPC failure
  ```

  After:
  ```ts
  const guard: UrStoaGuardResult | null = await getUrStoaGuard(account);
  if (guard === null) { showRPCErrorBanner(); return; }
  if (!guard.exists) renderCreateGuardForm();
  else renderEditGuardForm(guard);
  ```

- **Breaking change — `validateLiquidity` mixed-shape addition (`@ouronet/ouronet-core/interactions/addLiquidityFunctions`):** the boolean validity flag is preserved, and an optional `error?: string` field is added that is populated only when an RPC error occurred. This is a mixed-shape addition (NOT a nullable widening): the existing `{ valid: boolean; ... }` shape gains an OPTIONAL `error?: string` field per the Q10/A10 locked decision. Consumers therefore route a populated `error` to a network-failure banner and a `valid: false` with no `error` to a validation-failure message.

  Before:
  ```ts
  const result = await validateLiquidity(...);
  if (!result.valid) showValidationFail();  // silently catches RPC failure as valid:false
  ```

  After:
  ```ts
  const result = await validateLiquidity(...);
  if (result.error) showRPCErrorBanner(result.error);
  else if (!result.valid) showValidationFail();
  ```

- **Breaking change — `getMaxBuyMovieBooster` (`@ouronet/ouronet-core/interactions/ouroFunctions`):** return type widens from `Promise<number>` to `Promise<number | null>`. Both `return 0` sites become `return null`; the success-path `|| 0` falsy-coalesce becomes a `Number.isFinite()` guard.

  Before:
  ```ts
  const maxBuy: number = await getMaxBuyMovieBooster(account);
  if (amount > maxBuy) showLimitExceeded();  // silently uses 0 on RPC failure
  ```

  After:
  ```ts
  const maxBuy: number | null = await getMaxBuyMovieBooster(account);
  if (maxBuy === null) { showRPCErrorBanner(); return; }
  if (amount > maxBuy) showLimitExceeded();
  ```

- **Breaking change — magic-string eliminations: `getSWPSpawnLimit` and `getSWPInactiveLimit` (`@ouronet/ouronet-core/interactions/dexFunctions`):** both functions widen from `Promise<string>` to `Promise<string | null>`. Both `return "N/A"` sites become `return null`. Both gain `getLogger().error()` routing on their previously silent catches. Consumers swap `=== "N/A"` checks for `=== null` checks, removing a class of stringly-typed sentinel from the public surface (Q11/A11 locked decision).

  Before:
  ```ts
  const limit = await getSWPSpawnLimit(swpair);
  if (limit === "N/A") showUnknownLimit();  // stringly-typed sentinel
  else displayLimit(limit);
  ```

  After:
  ```ts
  const limit = await getSWPSpawnLimit(swpair);
  if (limit === null) showRPCErrorBanner();
  else displayLimit(limit);
  ```

- **Non-breaking observability — fourteen logger-routing additions across five files:** the fourteen previously silent catches in `dexFunctions.ts` (`getSWPPrincipals`, `getTrueFungibleLPEntry`, `getOwnedSwapPairs`, `getSwpairFromLpId`, `getSwpairsFromLpIds`, `getPrimordialPool`, `describeModule`), `ouroFunctions.ts` (`getDPTFIssueInfo`, `getSublimateInfo`, `getCompressInfo`), `activateFunctions.ts` (`getDeployStandardAccountInfoOnly`), `infoOneFunctions.ts` (`getClearDispoInfo`), and `urStoaFunctions.ts` (file-private helpers `verifyEd25519Sig` and `describeKeyset`) gain `getLogger().error("Error in <funcName>:", error)` routing. No return-type changes — these functions are already correctly modelled as nullable or as empty-collection returns. End-state goal: the silent-catch pattern is fully eliminated from the interactions surface.

- **No public-API removals (NFR-03):** all sixteen modified functions retain their NAMES and PARAMETER signatures. No exports are removed. The release is breaking only in the sense of return-type widening (15 nullable widenings + 1 structural addition for `validateLiquidity`). Consumers who rebuild against v3.0.0 will see TypeScript errors at every call site that does not handle the `null` (or, for `validateLiquidity`, the optional `error` field) — this is the deliberate forcing function that surfaces every consumer call site for explicit migration.

### Migration

See the `## Migrating to v3.x` section of `README.md` for the full per-function `Before:` / `After:` migration patterns. Short version: every consumer call site that previously consumed one of the sixteen modified functions needs an explicit RPC-failure branch. For the fifteen nullable widenings, add `if (result === null) showRPCErrorBanner();` before reading the previously-fabricated value. For `validateLiquidity`, route a populated `error` field to the network-failure banner (`if (result.error) showRPCErrorBanner(result.error); else if (!result.valid) showValidationFail();`). For the two magic-string eliminations (`getSWPSpawnLimit`, `getSWPInactiveLimit`), swap `=== "N/A"` checks for `=== null` checks. For `LPTypeInfo` consumers, render the per-flag mixed UI state (Frozen=true, Sleeping=null) per Approach A — each of the two flags is now individually nullable. Consumer-side migration code in OuronetUI and AncientHolder HUB is OUT OF SCOPE per `spec.md` — those repos handle their own update work informed by the README.

### Stats

Files changed:

- NEW: `tests/interactions-pricing.test.ts`, `tests/interactions-balance-cluster.test.ts`, `tests/interactions-logger-parity.test.ts`
- MODIFIED: `src/interactions/ouroFunctions.ts`, `src/interactions/dexFunctions.ts`, `src/interactions/addLiquidityFunctions.ts`, `src/interactions/urStoaFunctions.ts`, `src/interactions/activateFunctions.ts`, `src/interactions/infoOneFunctions.ts`, `tests/types.test.ts`, `tests/phase5-catch-routing.test.ts`, `package.json`, `CHANGELOG.md`, `README.md`

Test count: **558** passing (up from 500 v2.3.0 baseline; +58 new in v3.0.0).

## 2.3.0 — 2026-05-02

**Additive medium-and-low audit closures release. MINOR, non-breaking.**

Closes 13 audit findings — 7 MEDIUM tier (F-CORE-013, F-CORE-014, F-CORE-015, F-CORE-016a, F-CORE-016b, F-CORE-016c, F-CORE-017) and 6 LOW tier (F-CORE-018a, F-CORE-018b, F-CORE-019, F-CORE-020, F-CORE-021, F-CORE-022) — from the 2026-04-30 audit cycle. Introduces 2 new public surfaces: (1) a typed `UnknownPredicateError` class re-exported from the `./guard` subpath, and (2) a NEW `./observability` subpath with `Logger` type + `setLogger` mutator + `getLogger` accessor mirroring the existing `setPactReader` injection-seam pattern at `src/reads/pactReader.ts`. All changes are additive — no public exports removed, no return types widened, existing `instanceof Error` checks and existing analysis-flag access continue to work; the new typed-class discrimination and logger-seam injection are purely opt-in.

### Added (public surface)

- `UnknownPredicateError` — `@ouronet/ouronet-core/guard`. Thrown by
  `computeThreshold` when it encounters an unrecognized predicate. The
  general-purpose `analyzeGuard` catches it and folds it into a
  `predicateRecognized: false` bit on the returned analysis (replaces
  the previous silent `console.warn` diagnostic).
- NEW `./observability` subpath — `@ouronet/ouronet-core/observability`.
  Exports `Logger` type (`{ warn(msg, ...args), error(msg, ...args) }`),
  `setLogger(logger: Logger): void` (throws `TypeError` with message
  exactly `setLogger requires a non-null Logger` on null/undefined
  input), `getLogger(): Logger` (returns the currently-configured
  logger; default routes `warn` to `console.warn` and `error` to
  `console.error`). Mirrors the existing `setPactReader` seam at
  `src/reads/pactReader.ts:33-71`.
- Optional `firstSignableButUnsatisfied: number` field on
  `SmartAccountAuthPathsAnalysis` (`@ouronet/ouronet-core/guard`) —
  names the index of the first signable-but-unsatisfied path;
  `undefined` if none. Additive, opt-in.

### Fixed

**M1 (MEDIUM tier — 7 findings):**

- **F-CORE-013 — Codex shape validation.** `deserializeCodex` at
  `src/codex/codec.ts:75-93` gains runtime shape checks after the
  version check. Validates that `kadenaWallets`, `ouronetWallets`,
  `addressBook` are arrays and `uiSettings` is an object.
  Domain-prefixed errors NAME the offending field but never echo its
  value (preserves the secrets-stay-out-of-telemetry boundary).
  Forward-compat preserved: extra unknown top-level fields survive the
  deserialize round-trip exactly as before (v1.2 envelope contract
  unchanged).
- **F-CORE-014 — Foreign-key resolver pre-flight.**
  `CodexSigningStrategy` at `src/signing/codexStrategy.ts:180-182`
  gains a pre-flight check: when a transaction requires a foreign-key
  signer AND `this.resolver.requestForeignKey` is undefined, throws a
  precise error before reaching `universalSignTransaction`. JSDoc on
  `KeyResolver.requestForeignKey` at `src/signing/types.ts:62-69` is
  clarified to state the optional-at-the-interface-but-required-at-
  execute-time-when-needed contract. Server resolvers that omit
  `requestForeignKey` AND receive a foreign-key transaction now get a
  clear error instead of an opaque deep-stack failure.
- **F-CORE-015 — `safeCreationTime` DRY refactor.** Removed 11
  byte-identical inline `function safeCreationTime` declarations
  across `src/interactions/*Functions.ts` (activate, addLiquidity,
  coil, crossChain, dex, guard, kpay, ouro, pension, urStoa, wrap).
  All 11 files now import the canonical declaration from
  `src/pact/format.ts:138-140` (single source of truth). Mechanical
  refactor with byte-identical behavior.
- **F-CORE-016a — Tightened `classifyGuardKind`.** Requires the FULL
  minimal shape per kind: capability needs `cgName` + `cgArgs` +
  `cgPactId`; user needs `fun` + `args`; keyset needs `pred` +
  `keys`; keyset-ref accepts either casing of the ref field.
  Under-specified guard shapes that previously silently mis-classified
  now classify as `unknown` and are surfaced to the caller.
- **F-CORE-016b — Keyset-reference casing normalization.** New
  `normalizeKeysetRef` helper applied at the `resolveGuard` boundary
  (`src/guard/smartAccountAuth.ts:118-126`) so internal code only sees
  the camelCase form. Maps the lowercase chain-native `keysetref` →
  camelCase `keysetRef` at the chain-IO boundary.
- **F-CORE-016c — `SmartAccountAuthPathsAnalysis` 4 reachable states.**
  JSDoc at `src/guard/smartAccountAuth.ts:209-240` enumerates the 4
  reachable states: `firstSatisfied >= 0`; `firstSatisfied === -1 &&
  anyKeyBased === true`; `firstSatisfied === -1 && anyKeyBased ===
  false && anyKnownKind`; all-unknown. Optional
  `firstSignableButUnsatisfied: number` field added to the analysis
  surface.
- **F-CORE-017 — `UnknownPredicateError` typed class +
  `predicateRecognized` flag.** `computeThreshold` at
  `src/guard/guardUtils.ts:76-79` throws the new typed
  `UnknownPredicateError` (additive public class re-exported from
  `./guard`). `analyzeGuard` catches the class and folds it into a
  structured `predicateRecognized: false` bit on the returned
  analysis. The previous silent `console.warn` is removed.

**M2 (LOW tier — 6 findings):**

- **F-CORE-018a — README header version table refresh.**
  `Z:/OuronetCore/README.md` header version table updated from its
  v1.3.0 / v1.4.0 baseline to current v2.2.0 reality, cross-
  referencing `CHANGELOG.md` for per-version detail.
- **F-CORE-018b — CONTEXT.md interactions section refresh.**
  `Z:/OuronetCore/.bee/CONTEXT.md` interactions section updated to
  describe v1.4 (`AccountSelectorData` `public-key` / `sovereign` /
  `governor` fields), v1.5 (`Leto` / `Artemis` / `Apollo` re-exports
  + `createGen1Primitive` factory + `AddressPrefixPair` type), v1.6
  (Smart Ouronet Account auth-path resolution primitives +
  `buildRotateSovereignPactCode`).
- **F-CORE-019 — Catch-block consistency in `ouroFunctions.ts`.** All
  7 affected catch sites in `src/interactions/ouroFunctions.ts` now
  route via `getLogger().error(...)` from `../observability`.
  Convention is documented in a code comment near the affected
  handlers.
- **F-CORE-020 — Tier semantics JSDoc.** `src/reads/pactReader.ts`
  and `src/reads/rawCalibratedRead.ts:40-46` JSDoc enumerates the
  canonical tier mapping (T1=balance, T2=preview, T3=metadata,
  T7=very-static, matching OuronetUI's reader). Documents that the
  default reader accepts and ignores the `tier` argument and
  cross-references `setPactReader` for cache-aware consumers.
- **F-CORE-021 — Drop dead try/catch in `getLPTypeInfo`.** Outer
  try/catch wrapping `getLPTypeInfo`'s `Promise.all` was dead code
  (two never-rejecting promises cannot themselves reject) and is
  removed (Option A LOCKED — the "comment as belt-and-braces"
  alternative was explicitly rejected). Future regressions in inner
  catches surface as real test failures rather than silent masking.
- **F-CORE-022 — Central logger seam at `./observability`.** New
  two-file source layout `src/observability/{index.ts,logger.ts}`
  exposes `Logger` / `setLogger` / `getLogger` mirroring the
  `setPactReader` pattern. Default routes to `console.warn` /
  `console.error`. `package.json` exports map gains the new
  `./observability` subpath. Every `console.warn` and `console.error`
  in `src/` is rerouted through the seam — verifiable by
  `grep -nE "console\.(warn|error)" src/` returning ZERO matches
  outside the seam itself.

### Stats

- Files changed: NEW — `src/observability/index.ts`,
  `src/observability/logger.ts`, `tests/observability-logger.test.ts`,
  `tests/phase5-catch-routing.test.ts`. MODIFIED — `src/codex/codec.ts`,
  `src/signing/codexStrategy.ts`, `src/signing/types.ts`, 11×
  `src/interactions/*Functions.ts` (Phase 1 `safeCreationTime` DRY),
  `src/guard/smartAccountAuth.ts`, `src/guard/guardUtils.ts`,
  `src/guard/index.ts`, `src/reads/pactReader.ts`,
  `src/reads/rawCalibratedRead.ts`, `src/network/nodeFailover.ts`,
  `src/errors/transactionErrors.ts`, `src/interactions/ouroFunctions.ts`
  (Phase 5 catch-routing + Phase 6 sweep),
  `src/interactions/addLiquidityFunctions.ts` (Phase 5 dead-catch
  drop + Phase 6 sweep), `Z:/OuronetCore/README.md`,
  `Z:/OuronetCore/.bee/CONTEXT.md`, `package.json`, `CHANGELOG.md`.
- Test count: **500** passing (up from `458` v2.2.0 baseline; +42
  new in v2.3.0).
- No public-API removals. The 2 new public surfaces
  (`UnknownPredicateError` class on `./guard`; `Logger` type +
  `setLogger` + `getLogger` on the new `./observability` subpath) are
  additive; no existing exports change shape; no return types
  widened; no breaking changes for downstream consumers (`OuronetUI`,
  `AncientHolder HUB`).

## 2.2.0 — 2026-05-02

**Additive crypto error taxonomy and previously-untested critical-surface coverage. MINOR, non-breaking.**

Closes three audit findings (F-CORE-009, F-CORE-011, F-CORE-012) by introducing three new typed error classes on the `./crypto` subpath, fixing a wrong-password timing leak in `smartDecrypt`, and landing four new test files plus five test-file extensions across previously-untested critical surfaces. A fourth audit finding (F-CORE-010 — pact-code injection escaping) was reviewed during spec discovery and intentionally rejected; rationale captured below. All public-API additions are additive — no existing exports change shape, no breaking changes for downstream consumers (`OuronetUI` and `AncientHolder HUB`).

### Added (public surface)

- `WrongPasswordError` — `@ouronet/ouronet-core/crypto`. Thrown by
  `decryptString`, `decryptStringV2`, and `smartDecrypt` when AES-GCM
  authentication-tag verification fails. Per the AES-GCM spec, a
  correct-password-with-tampered-ciphertext attempt is
  cryptographically indistinguishable from a wrong-password attempt
  and routes to this same class.
- `CorruptEnvelopeError` — `@ouronet/ouronet-core/crypto`. Thrown on
  envelope-parsing failures: `JSON.parse` failure, outer `atob`
  base64-decode failure, missing required envelope fields, and
  parsed-value-not-an-object. Distinguishes structural corruption from
  authentication failure.
- `UnsupportedFormatError` — `@ouronet/ouronet-core/crypto`. Additive
  reservation for future format extensions; no current call site
  throws this. Exported now so consumers can pin a `catch` clause once
  without a future minor-bump break.

### Fixed

- **F-CORE-009 — Crypto error taxonomy + `smartDecrypt` timing-leak
  fix.** Three typed error classes (`WrongPasswordError`,
  `CorruptEnvelopeError`, `UnsupportedFormatError`) replace the V1/V2
  catch-all string messages. `smartDecrypt` now uses a single
  deterministic shape-based branch (`isEncryptedV2`) instead of a
  try-V2-then-fallback-to-V1 sequence — this eliminates the ~1.5 s
  wall-time differential previously observable on a wrong-password V1
  envelope (which would burn the V2 PBKDF2 work-factor before falling
  through). Console-error calls in the V1 catch sites are removed; the
  thrown errors carry the underlying cause via the ES2022
  `Error.cause` property so consumers retain debug telemetry without
  the side-channel `console.error` noise.
- **F-CORE-011 — Test coverage for previously-untested critical
  surfaces.** Four new test files: `tests/pact-reader.test.ts`
  (covers the `setPactReader` injection seam and the default
  `rawCalibratedDirtyRead` fallback), `tests/wallet-builder.test.ts`
  (covers `KadenaWalletBuilder` mnemonic dispatch across all three
  seed types, vendor-vector-pinned), `tests/transaction-errors.test.ts`
  (covers every documented branch of `createSigningError` and
  `createSimulationError`), and `tests/seed-type-migration.test.ts`
  (covers the codex seed-type migration round-trip).
- **F-CORE-012 — Boundary-edge-case test extensions.** Five existing
  test files extended with edge-case it-blocks at the boundaries
  flagged by the audit pass.

### Rejected (decisions log)

- **F-CORE-010 — Pact-code injection escaping.** Reviewed during spec
  discovery (2026-05-02) and intentionally NOT implemented. Rationale:
  chain-side Pact compilation/simulation already validates account
  format, token-ID format, and DALOS charset at submission time.
  Mirroring those validations in the library would (a) duplicate logic
  that already lives at the canonical enforcement boundary, (b) drift
  from chain reality whenever DALOS extends its accepted character
  set, and (c) impose ongoing maintenance burden for a
  defense-in-depth that is theoretical only — no concrete attack
  vector was identified that the chain wouldn't already reject. A
  narrower blocklist variant (escape only known-bad characters) was
  also considered and rejected on the same theoretical-only argument.
  The audit-spec source remains under `bundles/high-additive/` with a
  "rejected" note appended for traceability.

### Stats

- Files changed: NEW — `src/crypto/errors.ts`,
  `tests/pact-reader.test.ts`, `tests/wallet-builder.test.ts`,
  `tests/transaction-errors.test.ts`,
  `tests/seed-type-migration.test.ts`, plus this changelog entry and
  `README.md` updates. MODIFIED — `src/crypto/v1.ts`, `src/crypto/v2.ts`,
  `src/crypto/index.ts`, five existing test files (boundary-edge-case
  extensions), and `package.json` (version bump).
- Test count: **458** passing (up from `386` at v2.1.2; +72 new in v2.2.0).
- No public-API removals. The three new error classes are additive;
  existing exports are unchanged.
- The `smartDecrypt` timing-leak fix is the only behavioural change a
  consumer can observe — wrong-password V1 attempts now return on the
  same ~PBKDF2-V1 wall-time path as before, but the prior
  try-V2-first leak that burned the V2 work-factor is gone.

## 2.1.2 — 2026-05-01

**Concurrency-race correction in `withFailover`. No public API change.**

Closes audit finding **F-BUG-001** documented in `.bee/audit-specs/high-withfailover-concurrency-race.md` (will move to `.bee/audit-specs-done/2026-05-01-high-withfailover-concurrency-race.md` post-archive per the project's audit-specs lifecycle). The bug surfaced during the v2.1.0 reliability-failover spec's final implementation review by the audit-bug-detector agent: under concurrent chain calls during a primary-node failover event, sibling `withFailover` invocations could surface spurious TIMEOUT errors even though the fallback host was healthy. v2.1.0's `getFailoverClient` adoption widened the blast radius — every chain call now routes through `withFailover`, making concurrent flows the norm. v2.1.2 is a behavior correction toward the documented "retry once on the fallback if the primary attempt errors with a network-class failure" contract; it is patch-version-eligible per strict semver.

### Fixed

- **F-BUG-001 — `withFailover` retry guard now uses per-invocation captured base URLs.** The catch-block guard at `src/network/nodeFailover.ts:120` previously read the shared module-level `currentHost === PRIMARY_HOST`, which a sibling concurrent call could have already flipped, causing the second invocation's catch to incorrectly skip the fallback retry. The rewrite captures BOTH `attemptedBaseUrl` (current active host at fn-entry) AND `attemptedPrimaryBaseUrl` (current primary host at fn-entry) into local `const`s before invoking the wrapped function, then compares the two captured locals at catch-time. This makes the decision robust to ANY concurrent module-state mutation (sibling `withFailover` flip, mid-flight `setNodeConfig`, mid-flight `resetNodeFailover`). The retry path now calls `switchToFallback()` unconditionally — its pre-existing line-50 idempotency (`if (currentHost === FALLBACK_HOST) return;`) handles the concurrent-flip case correctly without an additional guard. The retry call uses `await fn(getActiveBaseUrl())` (with `await`) for symmetry with the initial call. New module-private helper `getPrimaryBaseUrl()` added to `src/network/nodeFailover.ts:82-85`; not exported (semver-clean).

### Stats

- Files changed: 5 (`src/network/nodeFailover.ts`, `tests/network.test.ts`, `package.json`, `CHANGELOG.md`, `README.md`).
- Lines added: ~30; lines removed: ~6.
- Test count: **386** passing (up from `385` at v2.1.1; +1 from the new concurrent-failover regression test in `tests/network.test.ts`).
- New regression test: `describe("withFailover — concurrent retry race", ...)` added to `tests/network.test.ts` (one new it-block exercising `Promise.all([withFailover(fn1), withFailover(fn2)])` during a primary-down event; pins the request-key dedup-equivalent semantic for concurrent failover).
- No new public exports. The new `getPrimaryBaseUrl()` helper is module-private.

## 2.1.1 — 2026-05-01

**README documentation patch. No runtime change.**

The v2.1.0 release published the runtime fixes (4 closed audit findings,
new `getFailoverClient` / `runWithTimeout` / `resetNodeFailover` /
`createTimeoutError` / `readTimeoutMs` surface, 385 tests) but the
README's `## Status` block was still pinned to `2.0.1` and the version
history hadn't been updated past v2.0.1. Without this patch, the npm
package page (https://www.npmjs.com/package/@ouronet/ouronet-core)
showed stale documentation that didn't describe the v2.1.0 reliability
hardening work — making the new public surface invisible to consumers
who land on the npm listing first.

### Fixed

- **README `## Status` block** updated to lead with `2.1.0`, summarise
  the reliability hardening release, and mention the 4 closed audit
  findings (F-CORE-002 / F-CORE-003 / F-CORE-004 / F-CORE-008).
- **Version history extended** with entries for v2.0.2, v2.0.3, v2.0.4
  (release-pipeline hardening patches that previously had no README
  mention) and v2.1.0 (full reliability hardening summary).
- **Test count updated** from `346` to `385` in two places (the
  `## Status` paragraph and the `npm test` block under
  `## Local development`).
- **Submodule table** rows for `./network` and `./reads` updated to
  cite the v2.1.0+ additions (`getFailoverClient`, `runWithTimeout`,
  `FailoverClientOptions`, `resetNodeFailover`, `readTimeoutMs?`).
- **New section: "What's new in v2.1.0"** added between the
  `npm install` snippet and the `## Migrating to v2.x` block, with
  copy-paste examples covering the factory, the timeout precedence
  contract, the lower-level `runWithTimeout` helper, and a
  no-migration-required note for v2.0.x consumers.

### Stats

- Files changed: 3 (`README.md`, `package.json`, `CHANGELOG.md`).
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 385.

## 2.1.0 — 2026-05-01

**Reliability hardening release. MINOR, non-breaking.**

Closes four HIGH-severity audit findings (F-CORE-002, F-CORE-003, F-CORE-004,
F-CORE-008) by wiring automatic node failover, bounded timeouts with
`TIMEOUT` classification, and Node event-loop hygiene through every chain
RPC surface in the library. All public-API additions are additive — no
existing exports change shape, no breaking changes for downstream consumers
(`OuronetUI` and `AncientHolder HUB`).

### Fixed

- **F-CORE-002 — Automatic failover wired into every submit and read.** New
  `getFailoverClient(chainId, options?)` factory in `src/network/failoverClient.ts`
  returns `{ dirtyRead, submit, listen, pollOne }` methods that compose
  `withFailover` + per-tier timeout into one reusable surface. All 81
  legacy `createClient(getPactUrl(chainId))` invocations across the 11
  interaction files (activate, addLiquidity, coil, crossChain, dex, guard,
  kpay, ouro, pension, urStoa, wrap) now route through the factory. Primary
  node failure on any chain call now triggers automatic fallback retry.
- **F-CORE-003 — Default reader URL is now per-call, not module-init.**
  `rawCalibratedDirtyRead`'s default Pact URL now resolves from
  `getActivePactUrl(chainId)` per invocation instead of capturing the
  static `PACT_URL` constant at module load. This propagates failover
  coverage to all 16 already-`pactRead`-routed read sites without touching
  any of them. The static `PACT_URL` constant is preserved (semver) but
  marked `@deprecated` with a pointer to `getActivePactUrl(chainId)`.
- **F-CORE-008 — Bounded timeouts on all four chain-call tiers.** New
  `runWithTimeout(operation, fn, timeoutMs)` helper applies
  `Promise.race` + `AbortController` + `try/finally clearTimeout`
  defence-in-depth. Per-tier defaults: read 15 s, submit 60 s,
  listen 180 s (~6 Kadena blocks), pollOne 30 s. Two-tier override
  precedence: per-call > factory-time > locked default. Timeouts are
  classified as `SigningError { code: "TIMEOUT" }` via the new
  `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)`
  factory. The `codexStrategy.ts` simulate-and-submit pair gets
  timeout-only enforcement (failover stays the consumer's `PactClient`
  responsibility — adding a base-URL accessor would be a breaking change).
- **F-CORE-004 — State isolation and Node event-loop hygiene.**
  `resetNodeFailover()` exported for test isolation (returns all five
  module-level state slots to initial values). `retryTimer.unref?.()`
  attached inside `startRetryLoop()` so Node consumers no longer pin the
  event loop on the failover health-check timer. Browser consumers
  (numeric setInterval handle) unaffected via the optional-call form.

### Added (public surface)

- `getFailoverClient(chainId, options?)` — `@ouronet/ouronet-core/network`
- `runWithTimeout(operation, fn, timeoutMs)` — `@ouronet/ouronet-core/network`
- `FailoverClientOptions` type — `@ouronet/ouronet-core/network`
- `resetNodeFailover()` — `@ouronet/ouronet-core/network`
- `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)` —
  `@ouronet/ouronet-core/errors`
- `readTimeoutMs?: number` field — added to the `PactReader` options bag and to
  `rawCalibratedDirtyRead`'s options (default 15000 ms when omitted)

### Stats

- Files changed: ~16 (1 new module `src/network/failoverClient.ts`,
  11 interaction files, 4 supporting files: `nodeFailover.ts`,
  `transactionErrors.ts`, `pactReader.ts`, `rawCalibratedRead.ts`,
  `kadena.ts`, `codexStrategy.ts`).
- New tests: 4 files. `tests/failover-client.test.ts` (18 it-blocks),
  `tests/timeouts.test.ts` (13 it-blocks), `tests/failover-submit.test.ts`
  (2 it-blocks), and `tests/network.test.ts` extended (+2 it-blocks for
  `resetNodeFailover` + `retryTimer.unref` spy). Plus `tests/strategy.test.ts`
  extended (+6 it-blocks for the codexStrategy timeout seam).
- Test count: ~386 passing (from 346 baseline). v1.7.0 type-regression
  lock continues to fire.
- 81 `createClient(getPactUrl(...))` call sites migrated to
  `getFailoverClient(...)` across 11 interaction files (44 invocations,
  averaging ~1.8 chain operations per createClient destructure).

## 2.0.4 — 2026-05-01

**Triggers the v2.0.3 PAT-fallback workflow with the now-installed
`RELEASE_TOKEN` repo secret. No runtime change.**

The v2.0.3 workflow change (token fallback expression
`${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`) was correct,
but its workflow run still failed because the user hadn't yet added
the `RELEASE_TOKEN` secret to the repository. The secret is now in
place. v2.0.4 is pushed solely to trigger a fresh workflow run that
exercises the PAT-bearing branch of the fallback expression.

### Fixed

- **Backfill loop extended to v2.0.3.** Previous backfill ran
  `for PRIOR_TAG in v1.7.0 v2.0.0 v2.0.1 v2.0.2` — now adds v2.0.3 so
  the v2.0.4 workflow run creates Releases retroactively for ALL six
  prior tags whose Release-creation step had failed in earlier runs.

### Stats

- Files changed: 3 (`package.json`, `CHANGELOG.md`, `.github/workflows/publish.yml`).
- Lines added: ~15; lines removed: ~3.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.3 — 2026-05-01

**Final release-process hotfix. No runtime change.**

The v2.0.2 attempted fix (adding `permissions: contents: write` to
publish.yml) failed because the StoaChain organization has the
"Workflow permissions" setting locked at the org level, which caps
the auto-provided `GITHUB_TOKEN` to read-only regardless of what the
workflow YAML requests.

### Fixed

- **`.github/workflows/publish.yml` now uses a fallback token
  expression:** `${{ secrets.RELEASE_TOKEN || secrets.GITHUB_TOKEN }}`.
  When the user-supplied `RELEASE_TOKEN` PAT secret is present (with
  Contents: Read and write scope on this repo), it bypasses the
  org-level workflow-permissions cap. When the secret is not set, the
  expression falls back to the auto-provided `GITHUB_TOKEN` — which
  works in orgs that allow write at the workflow level.
- **Backfill list extended to v2.0.2.** The v2.0.3 workflow run
  creates Releases retroactively for v1.7.0, v2.0.0, v2.0.1, and
  v2.0.2 — all the tags whose Release-creation step had previously
  failed or not yet existed.

### Stats

- Files changed: 3 (`package.json`, `CHANGELOG.md`, `.github/workflows/publish.yml`).
- Lines added: ~25; lines removed: ~3.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.2 — 2026-05-01

**Permissions hotfix for the v2.0.1 release-process patch. No runtime change.**

The v2.0.1 publish-workflow run published the package to npm
successfully but failed at the new "Create GitHub Release for the
pushed tag" step with HTTP 403. Root cause: the default
`GITHUB_TOKEN` ships with read-only `contents` scope, and
`gh release create` requires `contents: write`. Because the failure
happened mid-run, the subsequent backfill step was skipped, so v1.7.0
and v2.0.0 Releases also remained un-created.

### Fixed

- **`.github/workflows/publish.yml` now declares `permissions:
  contents: write`** at the job level. This grants the auto-provided
  `GITHUB_TOKEN` the minimum scope needed for `gh release create` to
  succeed. Verified via the failed v2.0.1 workflow-run job log.
- **Backfill list extended to include v2.0.1** alongside v1.7.0 and
  v2.0.0. The v2.0.2 workflow run will create Releases retroactively
  for all three previously-shipped tags whose Release-creation step
  was not yet possible. Idempotent — becomes a no-op once complete.

### Stats

- Files changed: 3 (`package.json`, `CHANGELOG.md`,
  `.github/workflows/publish.yml`).
- Lines added: ~30; lines removed: ~3.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.1 — 2026-05-01

**Documentation + release-process patch. No runtime behaviour change.**

The v2.0.0 release shipped with two documentation-discoverability gaps
that this patch closes. Consumers on v2.0.0 do NOT need to upgrade for
any code reason; v2.0.1 is functionally identical except for the
shipping artefacts.

### Fixed

- **`CHANGELOG.md` is now bundled with the npm tarball.** v2.0.0 had
  `package.json:files: ["dist"]` which excluded the changelog.
  Consumers running `npm view @ouronet/ouronet-core@2.0.0` saw only
  the README and had to visit the GitHub repo for migration guidance.
  v2.0.1 ships `CHANGELOG.md` alongside `dist/` so the migration
  guidance is reachable from the registry.
- **GitHub Releases now created automatically on every `v*` tag
  push.** Previously `publish.yml` only published to npm; the
  Releases page on GitHub stayed empty. The new workflow step uses
  the `gh` CLI (pre-installed on `ubuntu-latest` runners) with the
  auto-provided `GITHUB_TOKEN` to call `gh release create
  --notes-from-tag` on every push. Idempotent — safe to re-run.
- **Backfill for v1.7.0 and v2.0.0 GitHub Releases.** This v2.0.1
  workflow run also creates Releases retroactively for the two
  previously-shipped tags using their existing annotated-tag
  messages. After this run, `https://github.com/StoaChain/OuronetCore/releases`
  shows all three versions; the backfill step becomes a no-op on
  subsequent runs.

### Changed

- **`README.md` refreshed** to reflect v2.0.x state: status section
  now shows v2.0.1, v1.7.0/v2.0.0/v2.0.1 entries added; new
  "Migrating to v2.x" section documents the `BalanceResolver` wiring
  pattern and the `simulateTransaction(pactCode, chainId)` signature
  change with before/after code samples; test count updated from 295
  → 346; interactions submodule description flags the v2.0.0 signature
  change.

### Internal

- `package.json:files` extended from `["dist"]` to `["dist", "CHANGELOG.md"]`.
- `.github/workflows/publish.yml` gains two steps after `npm publish`:
  one to create a GitHub Release for the pushed tag, one to backfill
  Releases for `v1.7.0` and `v2.0.0` (idempotent — guarded by
  `gh release view`).

### Stats

- Files changed: 4 (`package.json`, `CHANGELOG.md`, `README.md`,
  `.github/workflows/publish.yml`).
- Lines added: ~120; lines removed: ~50.
- No `src/` changes; no `tests/` changes.
- Test count unchanged at 346.

## 2.0.0 — 2026-05-01

**Cut the `wallet -> interactions` import edge with a `BalanceResolver` seam, and adopt the `pactRead` injection seam across all sixteen pure-read sites in `interactions/*`.**

Two architectural-layering passes ship together. The first (Phase 1)
closes the wallet-subpath edge by injecting a per-instance
`BalanceResolver` seam onto `KadenaWallet`. The second (Phase 2) sweeps
the remaining direct `createClient(...).local(...)` and
`Pact.builder...createTransaction()`-then-`.dirtyRead()` call sites in
`src/interactions/*` onto the existing `pactRead` injection point, so
every internal pure read now honours the consumer-configured reader
(cache-aware in OuronetUI, raw in HUB) and the dynamic node-failover
machinery uniformly.

### Phase 1 — Wallet edge cut

Closes the wallet-subpath half of the architectural-layering audit pass:
the runtime `KadenaWallet` account class previously reached into
`@ouronet/ouronet-core/interactions/kadenaFunctions` to fetch on-chain
balances, which meant any consumer importing
`@ouronet/ouronet-core/wallet` transitively pulled in the entire
`interactions/*` tree (and through it, `@kadena/client`, the Pact builders,
and the failover machinery). For browser SPAs that only wanted the HD
keypair builder this was dead weight; for server consumers wiring their
own indexer it was a forced dependency on the Pact-client read path they
intended to bypass.

Post-edit: `KadenaWallet.getBalance()` delegates to a new instance-level
`balanceResolver: BalanceResolver` seam (`(address: string) => Promise<string>`).
The wallet file no longer imports from `interactions/*`; importing the
wallet subpath no longer transitively pulls in `@kadena/client`. Each
consumer wires its own resolver. Note: `interactions/kadenaFunctions.getBalance`
returns `Promise<BalanceItem>` (`{ account, balance }`), so consumers wrap it
in a one-line adapter to match the `BalanceResolver` contract:

```ts
import KadenaWallet from "@ouronet/ouronet-core/wallet";
import { getBalance } from "@ouronet/ouronet-core/interactions/kadenaFunctions";

const wallet = new KadenaWallet({
  ...,
  balanceResolver: (address) => getBalance(address).then((r) => r.balance ?? "0"),
});
```

A server consumer (HUB) plugs in its own indexer-backed reader; tests plug
in an in-memory stub. The wrapping adapter is the same pattern shown in
the `BalanceResolver` JSDoc at `src/wallet/types.ts`.

The seam mirrors the existing `setPactReader` / `KeyResolver` patterns
documented in `CLAUDE.md` under "Pluggable seams, not DI" — narrow,
function-shaped, opt-in. The `BalanceResolver` alias is published from
`src/wallet/types.ts` and is reachable as
`import type { BalanceResolver } from "@ouronet/ouronet-core/wallet"`.

`KadenaWalletBuilder` is unaffected: its five static methods all return
keypair tuples or primitives and never instantiate a `KadenaWallet`, so
there is no construction path through the builder that needs to forward
the resolver. REQ-06 (builder propagation) is satisfied vacuously with
grep evidence in the phase TASKS.md.

### Phase 2 — Reader seam adoption across `interactions/*`

Every pure-read call inside `src/interactions/*` now flows through the
`pactRead(pactCode, { tier, pactUrl?, chainId? })` injection seam (set
once at boot via `setPactReader(fn)`). Sixteen call sites across four
files were migrated:

- `kadenaFunctions.ts` — `getBalance` (T1) and `accountDescription` (T5).
- `wrapFunctions.ts` — `getWrapStoaInfo` (T2), `getWrapperPaymentKey` (T5),
  `getPaymentKeyBalance` (T1), `getWrapUrStoaInfo` (T2).
- `addLiquidityFunctions.ts` — nine reads in the URC_LD / UEV_Liquidity /
  URC_BalancedLiquidity / URC_SortLiquidity / UR_IzFrozenLP /
  UR_IzSleepingLP family (T2 / T5 / T7 per call).
- `crossChainFunctions.ts` — `simulateTransaction` reshaped to the
  read signature (`pactCode`, `chainId`) so it routes through the same
  reader as the rest. **Public-API break** — see "Breaking change" below.

Each site preserves its existing response-unwrap branching (the
`{ result: { status, data } }` two-level envelope) and its existing
return shape, so behavioural equivalence to the prior
`createClient(...).local(...)` path holds for callers that don't rely
on cache semantics. Consumers that DO want caching gain it transparently
once they call `setPactReader(...)` at boot — that path was already
configured in OuronetUI and HUB, but until this release only a subset of
internal reads honoured it.

Submit / listen / poll / cross-chain SPV continuation paths (the
non-read paths inside `crossChainFunctions.ts`,
`activateFunctions.ts`, `coilFunctions.ts`, etc.) are
**unchanged** — they still build through `Pact.builder` and submit via
`createClient(getPactUrl(chainId)).submit(...)` because they need the
full transaction-descriptor return shape, not a dirty-read result.

A new `tests/interactions-read-seam.test.ts` regression guard
exercises every migrated function against a counting stub installed via
`setPactReader(...)` and asserts both the call count and the locked
`tier` value per site, so future drift back to direct
`createClient(...).local(...)` is caught at test time.

### Public API impact

- **Constructor signature widened (non-breaking):** `KadenaWallet`'s
  options object now accepts an optional `balanceResolver?: BalanceResolver`
  field appended after `derivationPath`. Existing callers that omit it
  compile and run unchanged — the field defaults to a throwing stub that
  fires only when `getBalance()` is invoked, so wallets used for
  address-only flows stay zero-config.
- **New instance property:** `wallet.balanceResolver` is publicly
  mutable. Consumers can either inject via the constructor or assign
  post-construction (`wallet.balanceResolver = fn`) before calling
  `getBalance()`. Both paths are equivalent.
- **New exported type:** `BalanceResolver` from
  `@ouronet/ouronet-core/wallet` —
  `(address: string) => Promise<string>`. JSDoc documents the `"0"`
  sentinel for absent accounts and the narrow-seam framing.
- **Edge cut:** importing `@ouronet/ouronet-core/wallet` no longer
  transitively pulls in `@kadena/client`, the `interactions/*` tree, or
  the Pact-client failover machinery. Bundle-size win for browser
  consumers that only use `KadenaWalletBuilder`.
- **Default resolver remediation:** if a consumer calls `getBalance()`
  on a wallet constructed without a resolver, the call rejects with
  `"KadenaWallet: balanceResolver not configured. Inject one via the
  constructor or set wallet.balanceResolver before calling getBalance()."`
  Remediation: either pass `balanceResolver` to the `KadenaWallet`
  constructor, or set `wallet.balanceResolver = fn` before calling
  `wallet.getBalance()`. The browser consumer (OuronetUI) wraps
  `interactions/kadenaFunctions.getBalance` in a one-line adapter
  (`(addr) => getBalance(addr).then(r => r.balance ?? "0")`) because
  the interactions function returns the wrapped `BalanceItem` shape
  `{ account, balance }` while `BalanceResolver` expects a bare
  decimal string. A server consumer (HUB) wires its own indexer-backed
  resolver. Mirrors the existing `setPactReader` consumer-wiring
  guidance in `src/reads/pactReader.ts`.
- **Breaking change — `simulateTransaction` signature
  (`@ouronet/ouronet-core/interactions/crossChainFunctions`):** the
  first parameter changed from a pre-built
  `IUnsignedCommand` / transaction object to the raw Pact code string
  the simulation should evaluate. The full new signature is
  `simulateTransaction(pactCode: string, chainId: string)`; the return
  shape (`{ success: boolean; result?: any; error?: string; gas?: number }`)
  is unchanged. Migration: callers that previously did
  `const tx = Pact.builder.execution(code).…createTransaction();
  await simulateTransaction(tx, chainId);` should now pass `code`
  directly — `await simulateTransaction(code, chainId);` — and drop
  the local `Pact.builder` plumbing. This routes the simulation through
  the same `pactRead` seam every other read uses, so the consumer-
  configured reader (e.g. OuronetUI's cache-aware wrapper) governs it
  uniformly.
- **Reader seam now adopted (no consumer-facing change for already-
  configured readers):** sixteen pure-read sites in `interactions/*`
  that previously bypassed `setPactReader(...)` by calling
  `createClient(...).local(...)` directly now flow through `pactRead`.
  Consumers that were already calling `setPactReader(...)` at boot
  (OuronetUI does; HUB leaves the default) see no API change — the
  seam was already there; this just makes every internal read honour
  it. Consumers that were NOT calling `setPactReader(...)` continue to
  hit the default `rawCalibratedDirtyRead`, identical pre-state behaviour.

### Behavioural impact (mildly breaking)

- **Removed silent `?? "0"` fallback in `getBalance()`.** The previous
  body was:

  ```ts
  const balance = await getBalance(this.address);
  this.balance = balance.balance ?? "0";
  return this.balance;
  ```

  The `?? "0"` swallowed any case where the upstream returned an
  envelope without a `balance` field, fabricating a "0" balance that
  could not be distinguished from a genuinely-zero on-chain account.
  The new body assigns the resolver's raw return value and propagates
  any error verbatim:

  ```ts
  this.balance = await this.balanceResolver(this.address);
  return this.balance;
  ```

  Consumers that today rely on `getBalance()` always returning a string
  (never throwing) must either (a) wrap their call sites in `try/catch`,
  or (b) supply a resolver whose own error path returns `"0"` to
  preserve the old behaviour. The `BalanceResolver` JSDoc still
  documents `"0"` as the stable sentinel for "absent on chain" — the
  contract for absent accounts is unchanged; only the silent-on-error
  swallow is gone.

### Changed

- `src/wallet/KadenaWallet.ts` — removed the `import { getBalance }
  from "../interactions/kadenaFunctions"` edge; added
  `import type { BalanceResolver } from "./types"`; added
  `public balanceResolver: BalanceResolver` instance field; constructor
  options-object widened with optional `balanceResolver?` argument;
  `getBalance()` body delegates to `this.balanceResolver(this.address)`
  with no `?? "0"` swallow; class JSDoc and property JSDoc updated to
  describe the new injection-seam reality and the last-write-wins
  race semantics.
- `src/interactions/kadenaFunctions.ts` — `getBalance` (T1) and
  `accountDescription` (T5) routed through `pactRead`. Direct
  `createClient(getPactUrl(...))` + `Pact.builder` plumbing removed;
  `import { pactRead } from "../reads"` added; unused
  `Pact` / `createClient` / `getPactUrl` / `KADENA_NETWORK` /
  `KADENA_CHAIN_ID` imports pruned (where no remaining call sites
  reference them). The `export interface BalanceItem` declaration is
  preserved verbatim — it's a public-API contract for downstream
  consumers.
- `src/interactions/wrapFunctions.ts` — four reads migrated:
  `getWrapStoaInfo` (T2), `getWrapperPaymentKey` (T5),
  `getPaymentKeyBalance` (T1), `getWrapUrStoaInfo` (T2). The eight
  submit/listen/poll wrap helpers
  (`executeFirestarter`/`executeWrap*`/etc.) keep their existing
  `Pact.builder` + `createClient(...).submit(...)` paths — those need
  the full transaction-descriptor return shape and are not reads.
- `src/interactions/addLiquidityFunctions.ts` — nine reads migrated
  across the URC_LD / UEV_Liquidity / URC_BalancedLiquidity /
  URC_SortLiquidity / UR_IzFrozenLP / UR_IzSleepingLP families at
  locked tiers (T2 / T5 / T7 per call). The IIFE wrapper shape used
  for the URC_0027-style batched selector is preserved; the submit /
  listen / poll paths in the same file are untouched.
- `src/interactions/crossChainFunctions.ts` — `simulateTransaction`
  reshaped from `(transaction, chainId)` to `(pactCode, chainId)` and
  routed through `pactRead`. **Public-API break — see "Breaking
  change" above.** `getBalanceOnChain` (already on `pactRead` since
  v1.6.1) is unchanged. The cross-chain transfer build / submit / SPV /
  finish paths are untouched.

### Added

- `src/wallet/types.ts` — new `BalanceResolver` type alias with full
  JSDoc (the `"0"` sentinel, the narrow-seam framing, the
  `wallet.balanceResolver = fn` wiring example).
- `tests/wallet.test.ts` — 8 behavioural tests covering: default-throw
  on call (exact error string), constructor-injected resolver delegation,
  post-construction assignment, async rejection propagation, sync throw
  propagation, plus construction-sanity checks.
- `tests/interactions-read-seam.test.ts` — behavioural regression guard
  with one it-block per migrated function. Each test installs a
  counting `pactRead` stub via `setPactReader(...)`, invokes the real
  exported function, and asserts both the call count (the stub fired
  exactly once per call site) and the `tier` value the stub received
  (so future drift back to direct `createClient(...).local(...)` or to
  a wrong tier is caught at test time). Total: ~15 it-blocks across
  the four migrated files. Combined with the existing
  `tests/wallet.test.ts` coverage, this is the new safety net the
  reader-seam adoption rests on.

### Unchanged

- `src/interactions/kadenaFunctions.ts` — `getBalance` (and
  `accountDescription`) still exported. The per-file subpath
  `@ouronet/ouronet-core/interactions/kadenaFunctions` continues to
  resolve. Only the wallet-side import is gone; downstream consumers
  that imported `getBalance` directly from interactions are unaffected.
- `KadenaWalletBuilder` — no API changes. The class's five static
  methods return keypair tuples or primitives; none constructs a
  `KadenaWallet` instance, so there is no propagation path to add.
- `package.json` `exports` map — unchanged.
- All submit / listen / poll / SPV / finish paths in
  `interactions/*` — unchanged. Only pure reads were touched;
  transaction-submitting helpers continue to build through
  `Pact.builder` and submit via
  `createClient(getPactUrl(chainId)).submit(...)` because they need
  the full `ITransactionDescriptor` return shape, not a dirty-read
  result.

### Process notes

This release was produced via the BeeDev workflow. Phase 1 of the
`arch-layering-and-seams` spec (REQ-01 through REQ-06) addresses the
wallet edge cut. Phase 2 (REQ-07 through REQ-17) adopts the existing
`pactRead` seam across the remaining sixteen pure-read sites in
`interactions/*` and reshapes `simulateTransaction`'s signature. The
`CLAUDE.md` "Pluggable seams" header is updated in this release from
"Two narrow injection points" to "Three narrow injection points" — the
new third bullet (`BalanceResolver`) was added additively in Phase 1;
the count text was deferred to Phase 2 (this entry) so it would land
together with the full adoption proof. The version number is left as
`Unreleased — TBD` in this entry; the release coordinator fills it in
at tag time per the `Publishing flow` ceremony, picking the
appropriate semver bump (Phase 2's `simulateTransaction` signature
change is breaking, so a major bump is the expected outcome unless
the coordinator rules it out).

### Release ceremony — pre-tag verification

Before tagging this release, the release coordinator MUST re-run the
import-graph regression grep to confirm Phase 1's wallet edge cut still
holds in the freshly-built `dist/`. The check is:

```sh
npm run build
grep -nE "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/*.js
# (or, with ripgrep)
rg -E "(from|require\()\s*['\"][^'\"]*interactions" dist/wallet/
```

Expected output: **zero hits** (grep exits 1, rg exits with no
results). The narrow regex matches only `from "..."` and
`require("...")` import-graph references — a substring grep of
"interactions" would produce a false positive on the JSDoc text in
`BalanceResolver` (TypeScript preserves JSDoc by default in
`tsconfig.build.json`). Any hit means the wallet subpath has
re-acquired a transitive dependency on `interactions/*` and the tag
should NOT proceed until the import is restored to a seam injection.

## 1.7.0 — 2026-04-30

**Consolidate `IKadenaKeypair` to a single canonical declaration.**

Closes audit finding **F-CORE-001 (CRITICAL)** from the v1.6.1 audit pass.
The signing-ready keypair shape was declared SIX times across the
codebase: once canonically in `src/signing/types.ts:22-30`, once with
documented Phase-2b backwards-compat in `src/interactions/ouroFunctions.ts`,
and four undocumented duplicates (in `activateFunctions`, `dexFunctions`,
`kpayFunctions`, `coilFunctions` — the last one non-exported). The
duplicates were not byte-identical: each omitted `"foreign"` from the
`seedType` literal-union and used `encryptedSecretKey?: any` instead of
`unknown`.

Post-consolidation: only TWO declarations remain. The four undocumented
duplicates are deleted and re-routed to the canonical via type-only
imports through the `../signing` barrel; each subpath also gets an
`export type { IKadenaKeypair } from "../signing"` re-export to preserve
its public API surface (consumers that imported `IKadenaKeypair` from
those subpaths still resolve cleanly). The Phase-2b copy in
`ouroFunctions.ts` stays in place but gains an `@deprecated` JSDoc tag.

The `IKadenaKeypair` half of the F-INT-001 circular dependency between
`addLiquidityFunctions` and `dexFunctions` is broken as a side effect:
`addLiquidityFunctions.ts:10` is split — `IOuroAccountKeypair` keeps its
value-position import from `./dexFunctions` (deferred consolidation),
`IKadenaKeypair` moves to a type-only import from `../signing`.

A new `tests/types.test.ts` regression-lock test asserts cross-subpath
assignability of `IKadenaKeypair` via `Parameters<typeof fn>` slots
against real exported functions in each subpath. Combined with a new
`tsconfig.tests.json` and `vitest.config.ts` `typecheck.tsconfig`
pointer, the lock fires under `npm test`: any future change that
reintroduces a drifted local `IKadenaKeypair` (omitting `"foreign"`)
breaks CI.

### Public API impact

- **Type widening (intentional):** the `IKadenaKeypair` resolved through
  `@ouronet/ouronet-core/interactions/{activate,dex,kpay,coil}Functions`
  now includes `seedType: "foreign"` in its literal-union (it didn't
  before — those subpaths' duplicates had a narrower `seedType`).
- **Type tightening (intentional, mildly breaking):** the resolved type
  now uses `encryptedSecretKey?: unknown` instead of `?: any`. Consumer
  code that did `kp.encryptedSecretKey.someField` (relying on `any`'s
  permissive structural access) needs a narrowing cast. The canonical
  declaration in `src/signing/types.ts` already used `unknown` since
  earlier versions; consumers importing from there are unaffected.
- **No runtime behaviour change.** All edits are type-position only.
- **Deprecated copy preserved.** `src/interactions/ouroFunctions.ts:816`
  retains its `IKadenaKeypair` declaration with `encryptedSecretKey?: any`
  for root-barrel consumers. The new `@deprecated` JSDoc surfaces in IDEs
  as strikethrough on import sites.

### Changed

- `src/interactions/activateFunctions.ts` — duplicate deleted; canonical
  imported and re-exported via `export type`
- `src/interactions/dexFunctions.ts` — same
- `src/interactions/kpayFunctions.ts` — same
- `src/interactions/coilFunctions.ts` — same; sibling non-exported
  `IOuroAccountKeypair` duplicate also deleted (routed to
  `./ouroFunctions`); imports reordered into a single contiguous block
- `src/interactions/addLiquidityFunctions.ts` — line 10's combined import
  split (F-INT-001 cycle break for `IKadenaKeypair`)
- `src/interactions/guardFunctions.ts:13` — value-position import from
  `./ouroFunctions` switched to type-only from `../signing`
- `src/interactions/wrapFunctions.ts:18` — same
- `src/interactions/ouroFunctions.ts:812-818` — `@deprecated` JSDoc added;
  declaration body byte-equivalent (preserves `any` for backwards-compat)
- `vitest.config.ts` — added `test.typecheck = { enabled: true,
  tsconfig: "tsconfig.tests.json", include: ["tests/types.test.ts"] }`

### Added

- `tests/types.test.ts` — type-level regression lock with 5 assignability
  assertion sites (1 canonical via direct type import + 4
  `Parameters<typeof fn>[N]` extractions covering both struct-nested and
  direct-positional shapes)
- `tsconfig.tests.json` — narrow tsconfig that includes only
  `tests/types.test.ts` alongside `src/**/*.ts`, used exclusively by
  vitest's typecheck pass to make the regression lock fire under
  `npm test`

### Process notes

This release was produced via the BeeDev workflow (`/bee:init` →
`/bee:audit` → `/bee:audit-to-spec` → `/bee:new-spec` → `/bee:plan-all` →
`/bee:ship`). The audit pass produced 32 confirmed findings; this
release closes one of them (the CRITICAL). Specs for the remaining 9
are stored in `.bee/audit-specs/` for future releases. The plan went
through 3 rounds of plan-review per phase plus 3 rounds of cross-plan
consistency review, surfacing several real planning errors before
implementation began (see `.bee/STATE.md` Decisions Log for the full
audit trail). Final implementation review caught a public-API
regression (deletion of `export interface` without re-export) and a
critical regression-lock failure (vitest 4.1.5's typecheck mode does
not auto-add test files to its tsc program); both were auto-fixed.

## 1.6.1 — 2026-04-27

**Fix: every internal `interactions/*` helper now honors the active node.**

`PACT_URL` was a static module-level constant frozen at import time —
`https://node2.stoachain.com/.../pact`. Code inside `interactions/*.ts`
called `createClient(PACT_URL)` directly, which created Pact clients
pinned to node2 forever, completely bypassing the failover machinery
in `network/nodeFailover` (which `withFailover` and `pactRead` honor
correctly). Symptom: when a consumer flipped the primary to node1
via `setNodeConfig("node1")`, batched read/write helpers in core's
interactions still hit node2 and timed out / returned stale data.

55 occurrences across 11 files swapped from `createClient(PACT_URL)`
to `createClient(getPactUrl(KADENA_CHAIN_ID))`. The `getPactUrl`
helper (which itself wraps `getActivePactUrl` from nodeFailover) was
already exported from `constants/kadena.ts` since v1.5.0 — this
release just makes everything inside core actually use it.

### Changed

- `src/interactions/activateFunctions.ts` — 1 site
- `src/interactions/addLiquidityFunctions.ts` — 18 sites
- `src/interactions/coilFunctions.ts` — 1 site
- `src/interactions/dexFunctions.ts` — 6 sites
- `src/interactions/guardFunctions.ts` — 1 site
- `src/interactions/kadenaFunctions.ts` — 2 sites
- `src/interactions/kpayFunctions.ts` — 1 site
- `src/interactions/ouroFunctions.ts` — 13 sites
- `src/interactions/pensionFunctions.ts` — 2 sites
- `src/interactions/urStoaFunctions.ts` — 4 sites
- `src/interactions/wrapFunctions.ts` — 6 sites

Each file's `import` from `../constants` swapped `PACT_URL` for
`getPactUrl`. No other behaviour change in any helper.

### Unchanged

- `PACT_URL` still exported from `constants/kadena` for backwards
  compatibility (consumers may still depend on it). New code should
  use `getPactUrl(chainId)` instead.
- `getActivePactUrl` / `getActiveSpvUrl` / `setNodeConfig` /
  `getCurrentNodeStatus` / `withFailover` from `network` —
  unchanged.
- All 320 tests pass; no test changes required.

### Why this matters for consumers

Before 1.6.1: a UI calling `setNodeConfig("node1")` got correct
failover for any read using `pactRead` (URC_0027 batched account
selector, balance fetches, guard fetches), but broken behaviour for
every transaction-submitting modal — those built their `Pact.builder`
through a `createClient(PACT_URL)` instance still pointing at node2.

After 1.6.1: the entire core resolves the Pact endpoint through the
same dynamic getter, so a single `setNodeConfig` flip routes every
internal call (reads + simulates + submits) to the chosen node.

UI consumers (OuronetUI specifically) should ALSO replace any
direct `import { PACT_URL }` + `createClient(PACT_URL)` pattern in
their own source — the OuronetUI v0.30.13b bump does this
alongside the core upgrade.

## 1.6.0 — 2026-04-25

**Smart Ouronet Account auth-path resolution + Rotate Sovereign builder.**

Smart accounts (Σ. prefix) authorise mutations via `enforce-one` over
three branches: the account's own guard, the current sovereign
account's guard, and the account's governor. Any one branch
satisfying its predicate authorises the transaction. This release
adds the primitives that let downstream consumers (OuronetUI's
AuthPathZone, the future HUB, custom tooling) discriminate the four
Pact guard shapes (keyset / keyset-ref / capability / user) and
produce a ready-to-render summary of which branches the codex can
sign for, plus the first CFM builder that targets a Smart account's
auth path (`C_RotateSovereign`).

`CodexSigningStrategy` is **unchanged**: it still takes
`guards: IKeyset[]` (AND-required). The UI resolves the OR-of-3 to a
single chosen keyset before calling `strategy.execute`. This keeps
the strategy small and pushes the auth-path picker UX where it
belongs (the consumer).

### Added

- `src/guard/smartAccountAuth.ts` — three new primitives, all pure
  (no I/O, no `@kadena/client`):
  - `classifyGuardKind(g: unknown): 'keyset' | 'keyset-ref' | 'capability' | 'user' | 'unknown'`
    — pure shape discriminator. Mirrors OuronetUI's `<GuardTree>`
    detection 1:1; both stay in lockstep across releases.
  - `extractKeysetFromGuard(g: unknown): IKeyset | null` — returns
    the keyset payload for inline keysets and resolved keyset-refs;
    null for unresolved refs / capabilities / user-guards.
    Caller resolves keyset-refs upstream via existing `resolveGuard`.
  - `analyzeSmartAccountAuthPaths({ accountGuard, sovereignGuard, governor }, codexPubs, manualKeys)`
    — composes the classifier + extractor + `analyzeGuard` for each
    of the three branches and returns a `SmartAccountAuthPaths`
    summary: per-branch kind / keyBased / GuardAnalysis / rawGuard,
    plus derived `anyKeyBased` and `firstSatisfied` flags.
- `src/pact/cfmBuilders.ts` — `buildRotateSovereignPactCode({ patron, account, newSovereign })`.
  Emits `(ouronet-ns.TS01-C1.DALOS|C_RotateSovereign "<patron>" "<account>" "<new-sovereign>")`.
- `src/guard/index.ts` re-exports the new module via the existing
  `/guard` subpath. No package.json `exports` change required.
- Tests: `tests/smart-account-auth.test.ts` (full truth-tables for all
  three primitives) + `tests/cfm-builders.test.ts` extended with
  `buildRotateSovereignPactCode` cases.

### Public-API surface (semver minor — additive only)

```ts
// New from "@ouronet/ouronet-core/guard"
export type GuardKind = "keyset" | "keyset-ref" | "capability" | "user" | "unknown";
export function classifyGuardKind(g: unknown): GuardKind;
export function extractKeysetFromGuard(g: unknown): IKeyset | null;
export interface SmartAccountAuthBranch {
  readonly which: "guard" | "sovereign" | "governor";
  readonly kind: GuardKind;
  readonly keyBased: boolean;
  readonly analysis: GuardAnalysis | null;
  readonly rawGuard: unknown;
}
export interface SmartAccountAuthPaths {
  readonly branches: readonly [SmartAccountAuthBranch, SmartAccountAuthBranch, SmartAccountAuthBranch];
  readonly anyKeyBased: boolean;
  readonly firstSatisfied: number; // 0 | 1 | 2 | -1
}
export function analyzeSmartAccountAuthPaths(
  guards: { accountGuard: unknown; sovereignGuard: unknown; governor: unknown },
  codexPubs: Set<string>,
  resolvedManualKeys?: Record<string, string>,
): SmartAccountAuthPaths;

// New from "@ouronet/ouronet-core/pact"
export function buildRotateSovereignPactCode(p: {
  patron: string;
  account: string;
  newSovereign: string;
}): string;
```

No breaking changes — every existing symbol stays at its v1.5.0
signature. Consumers can upgrade with a `^1.6.0` range bump and
`npm install`.

### Unchanged

- `CodexSigningStrategy.execute` signature.
- `analyzeGuard` / `GuardAnalysis` — the new module composes them,
  doesn't replace them.
- `createDefaultRegistry()`, `createOuronetAccount`, encryption,
  codex codec, gas helpers, all 14 pre-existing CFM builders.

## 1.5.0 — 2026-04-24

**Historical-curve primitives surfaced via the `/dalos` subpath.**
Pairs with `@ouronet/dalos-crypto@1.2.0`, which promotes LETO /
ARTEMIS / APOLLO from low-level `Ellipse` constants to full
`CryptographicPrimitive` singletons with their own address prefixes,
Schnorr v2 sign + verify, and registry detection.

OuronetCore re-exports the new symbols through its `/dalos` subpath so
downstream consumers (OuronetUI, AncientHoldings HUB, custom tools)
can reach them without adding a direct dependency on dalos-crypto.

### Added (re-exports from `@ouronet/dalos-crypto/registry`)

- `Leto`, `Artemis`, `Apollo` — the three historical-curve primitive
  singletons. Each implements `CryptographicPrimitive` (5 input paths
  + Schnorr v2 + detect-by-prefix). **NOT registered in the default
  registry** — opt-in via `registry.register(Leto)`.
- `createGen1Primitive(config)` — factory for building custom
  Gen-1-family primitives from any `Ellipse` + prefix-pair config.
- `AddressPrefixPair` type + `DALOS_PREFIXES` constant — for
  consumers needing to construct primitives with their own prefix
  conventions.

### Changed

- `package.json` dependency range on `@ouronet/dalos-crypto` tightened
  to `^1.2.0` (was `^1.0.0`) — the new symbols require that version
  floor.

### Unchanged (Ouronet behaviour preserved)

- `createDefaultRegistry()` still returns a registry with only
  `DalosGenesis`. Ouronet continues to use DALOS Genesis exclusively.
- `createOuronetAccount` / Pact builders / signing / codex — no
  changes.
- Full 295/295 test suite still passes.

## 1.4.0 — 2026-04-24

**Smart Ouronet Account fields in batched selector.** Extends the
on-chain `URC_0027_AccountSelectorMapper` response type (the Pact-side
change already landed on-chain) so the TypeScript consumers can type
and display the three new fields that the mapper now returns:
`public-key`, `sovereign`, and `governor`.

### Added

- `AccountSelectorData.public-key: string` — on-chain source-of-truth
  public key (DALOS `{prefixLenBase49}.{xyBase49}` format). Populated
  for both Standard and Smart accounts; expected to match the
  codex-stored `publicKey` for any account created through the normal
  flow. A mismatch indicates either an admin-level chain-side rotation
  (last-resort correction tool) or a corrupted codex entry.
- `AccountSelectorData.sovereign: string | false` — only populated for
  Smart (Σ.) accounts. Pact returns the Ѻ. address of the sovereign
  Standard account that controls the Smart account's sovereign
  authorization path. Standard accounts and unactivated accounts
  return `false`.
- `AccountSelectorData.governor: any | false` — only populated for
  Smart accounts. The Pact guard used for complex custom authorization
  (capability / module / user guards, alternative keysets). For Smart
  accounts where no custom governor has been set, this matches the
  account's own `ouronet-account-guard`. Standard accounts and
  unactivated accounts return `false`.

### Notes

No other changes to the interaction surface; `getAccountSelectorData`
itself is unchanged (it already returns whatever the Pact mapper
sends, just with an extended TS type now). The three new fields flow
through the existing T5 read → 80-second sync cycle in OuronetUI.

Future Smart-account management operations (spawn on-chain,
rotate-governor, etc.) will be added in a subsequent release as typed
Pact builders.

## 1.3.0 — 2026-04-23

**DALOS Cryptography integration.** OuronetCore now exposes the full DALOS cryptographic stack through a new `./dalos` subpath. Consumers (OuronetUI, AncientHoldings hub, CLI tools) can mint Ouronet accounts locally, sign with Schnorr v2, and verify addresses via a single, stable API without depending on the remote `go.ouronetwork.io/api/generate` service.

### Added

- **Dependency**: `@ouronet/dalos-crypto@^1.0.0` (byte-identical TypeScript port of the Go DALOS reference — all 85 Go test vectors reproduced byte-for-byte, all 20 Schnorr signatures match).
- **Subpath**: `@ouronet/ouronet-core/dalos` — re-exports the full `CryptographicPrimitive` + `CryptographicRegistry` surface plus a `createOuronetAccount` convenience helper.
- **`src/dalos/index.ts`** — re-exports:
  - Types: `KeyPair`, `PrivateKeyForms`, `FullKey`, `PrimitiveMetadata`, `CryptographicPrimitive`, `DalosGenesisPrimitive`, `Bitmap`
  - Values: `DalosGenesis`, `CryptographicRegistry`, `createDefaultRegistry`, `isDalosGenesisPrimitive`, bitmap utilities
- **`src/dalos/account.ts`** — `createOuronetAccount(registry, options)`:
  - Discriminated-union `CreateAccountOptions` covering all 6 input modes (`random`, `bitString`, `integerBase10`, `integerBase49`, `seedWords`, `bitmap`)
  - Dispatches to the right primitive method
  - Returns a fully-materialised `FullKey` (keyPair + all 3 private-key forms + both Ѻ./Σ. addresses)
  - Throws descriptive errors on unregistered primitives or unsupported modes
- **`tests/dalos-integration.test.ts`** — 9 integration tests (all 6 modes + registry detect/sign/verify end-to-end + error paths).

### Usage example

```typescript
import {
  createDefaultRegistry,
  createOuronetAccount,
} from '@ouronet/ouronet-core/dalos';

const registry = createDefaultRegistry();

// Mint an account from seed words:
const account = createOuronetAccount(registry, {
  mode: 'seedWords',
  data: ['hello', 'world', 'dalos', 'genesis'],
});
console.log(account.standardAddress); // Ѻ.xxxxx...

// Sign + verify:
const primitive = registry.detect(account.standardAddress);
const sig = primitive!.sign!(account.keyPair, 'approve tx 123');
const valid = primitive!.verify!(sig, 'approve tx 123', account.keyPair.publ);
```

### Verified

- All existing **286 OuronetCore tests still pass** (no regressions).
- **9 new integration tests all pass**.
- **Total: 295/295 tests pass in ~14 s**.
- Build clean (`tsc -p tsconfig.build.json`).

### Dependency resolution

`@ouronet/dalos-crypto@^1.0.0` is resolved from the public npmjs registry
(`https://registry.npmjs.org/@ouronet/dalos-crypto/-/dalos-crypto-1.0.0.tgz`).
The earlier `file:../DALOS_Crypto/ts` placeholder was cleared in this same
version — the published tarball now ships with a registry-ranged dep, so
downstream consumers (OuronetUI, AncientHoldings hub) don't need a sibling
checkout to install.

### Migration notes for consumers

This release is purely additive — no existing OuronetCore API changed. Consumers that don't import from `./dalos` see zero behavioural difference. The OuronetUI migration to the local-generation path lands separately as Phase 9 of the DALOS TypeScript port.

---

## 1.2.2 — 2026-04-23

**Secret name fix.** v1.2.1 still failed ENEEDAUTH because the workflow referenced `secrets.NPM_TOKEN` but the actual GitHub repo secret is named `NPMPUSHER`. Updated the workflow to use the correct secret name. The secret itself (content-wise) is correct — just a name mismatch between what the workflow expected and what was registered. No source changes.

## 1.2.1 — 2026-04-23

**Publish fix.** v1.2.0's publish workflow failed with `ENEEDAUTH` because `setup-node`'s scope-based `.npmrc` generation didn't reliably propagate `NODE_AUTH_TOKEN` to `npm publish`. Rewrote the workflow to write `.npmrc` itself with an explicit `_authToken` line, plus added an `npm whoami` verify step so future auth failures surface earlier. Pure infrastructure fix — source code identical to v1.2.0.

## 1.2.0 — 2026-04-22

**Registry switch: GitHub Packages → npmjs.org.** Pure distribution change, zero source code changes. Everything that made v1.1.0 work still works identically; consumers just pull from a different registry.

### Changed

- `.github/workflows/publish.yml` rewired to publish to `https://registry.npmjs.org` instead of `https://npm.pkg.github.com`. Uses the `NPM_TOKEN` repo secret (granular npmjs token, 90-day expiry, scoped to `@stoachain` read+write with bypass-2FA enabled for CI automation).
- `package.json` `publishConfig` → `{ registry: https://registry.npmjs.org, access: public }`. Scoped packages default to "restricted" on npmjs.org; explicit `access: public` makes them installable anonymously.

### Why the switch

GitHub Packages for npm requires any consumer to authenticate with a GitHub PAT even for packages marked "public" at the package level — the StoaChain org doesn't have the legacy "allow anonymous access" toggle, so every install site (Ploi, local dev, team laptops, CI) needed `NPM_TOKEN` configured. npmjs.org is the standard public JS registry — `npm install @ouronet/ouronet-core` just works anywhere with zero auth setup. Switch has no tradeoff: the package is already public in source form on github.com/StoaChain/OuronetCore, so making it installable without friction is pure upside.

### For consumers (OuronetUI, future HUB, team laptops)

- Delete any `.npmrc` entries or `NPM_TOKEN` env vars that pointed at GitHub Packages.
- Run `npm install` — everything resolves from the default registry.
- No credentials needed. No `@stoachain:registry=...` lines needed.

### For contributors publishing new versions

Same workflow as before: bump version, update changelog, `git tag v$VERSION && git push --tags`. The `publish.yml` workflow handles the rest. The `NPM_TOKEN` secret in the repo needs to be rotated every 90 days (granular npm tokens' max lifetime).

## 1.1.0 — 2026-04-22

**Tier 2 testing pass.** 18 new tests across 2 files (one extension + one new). 286 total pass (was 268). No source changes — tests exercise existing code paths that weren't previously covered. See `OuronetUI/docs/TESTING_STRATEGY.md` §Tier 2.

### Added

- **`tests/strategy.test.ts` extended** — 6 new edge-case tests:
  - Foreign key synthesis via `resolvedForeignKeys` (ForeignKeySignModal flow)
  - Tx with unsigned slot for a foreign pub when no resolvedForeignKeys supplied — documents that strategy doesn't police guard satisfaction; chain-level rejection is the user-visible failure mode
  - `resolver.requestForeignKey` invocation path + error propagation
  - Impossible case: only codex key is also payment key AND guard key → throw
  - Resolver throw (HD derivation fail, password cancelled) propagates up execute()
  - Multi-guard: 2-of-3 patron + 1-of-1 resident → caps correctly picks the one free codex key
  - Keyset-ref guards flow through without surprise
- **`tests/encryption-upgrade.test.ts`** NEW — 12 tests for the V1 → V2 upgrade-on-unlock flow:
  - Happy path: V1 blob decrypts → re-encrypt with schemaVersion=1 → V2 blob → decrypts back to same plaintext
  - Idempotent: re-running upgrade on a V2 blob leaves it V2
  - schemaVersion-null/0 → V1 blob (fail-safe pre-upgrade behaviour)
  - Mixed-codex state: some V1 + some V2 blobs all decrypt via `smartDecrypt`
  - Wrong-password rejection for both V1 and V2 (no silent V2-fallback slip)
  - `isCodexUpgraded` ↔ `smartEncrypt` contract across null/0/1/2/99/garbage inputs
  - Password-change-during-upgrade: new password decrypts, old password fails
  - `decryptStringV2` V1-fallback path (belt-and-suspenders)
  - Full-codex simulation: 5 entries (wallet + account + pure keypair fields), all round-trip through the upgrade pipeline

### No changes

- Source. These are pure test additions.

## 1.0.0 — 2026-04-22

**Extraction complete.** Symbolic bump to 1.0.0 to mark the end of the OuronetUI → OuronetCore migration. Every piece of blockchain logic that used to live in OuronetUI (Pact builders, signing pipeline, encryption, guard analysis, gas calibration, codex codec, seed-type migration) now lives here. OuronetUI is a pure consumer. No API changes from 0.11.0 — strict semver would call this 0.11.1, but the bump signals "this is the public surface we commit to and will semver against going forward."

### Documentation

- `README.md` — rewritten. Status now "extraction complete", not "skeleton only". Submodule table reflects current exports (including the 14 `buildXxxPactCode` builders added in 0.11.0). Cross-links to OuronetUI's TESTING_STRATEGY + CFM_BUILD_GUIDE. Documents the `npm link` local-dev flow and the tag-push publish workflow.

### What 1.0.0 commits to

- Public API: the 10 subpath exports listed in `package.json` (`/constants`, `/network`, `/gas`, `/guard`, `/crypto`, `/signing`, `/codex`, `/reads`, `/pact`, `/interactions`). Removing or renaming anything exported at the top level of any of these = major version bump.
- Codex export format: `"version": "1.2"` is stable — existing `OuronetCodex_*.json` files users have on disk must stay importable forever.
- Signing strategy contract: `CodexSigningStrategy.execute({ build, guards, paymentKey?, resolvedForeignKeys?, extraSigners? })` is the stable shape.

## 0.11.0 — 2026-04-22

**Tier 1 testing pass.** Extracts the per-modal Pact-code builders into a pure module and adds 75 tests across 4 new/extended test files. All 268 tests pass (was 193). See `OuronetUI/docs/TESTING_STRATEGY.md` for the testing strategy rationale.

### Added

- **`@ouronet/ouronet-core/pact/cfmBuilders`** — 14 pure Pact-code string builders, one per CFM function the ecosystem ships: `buildTransferPactCode`, `buildClearDispoPactCode`, `buildSublimatePactCode`, `buildCompressPactCode`, `buildCoilPactCode`, `buildCurlPactCode`, `buildBrumatePactCode`, `buildConstrictPactCode`, `buildColdRecoveryPactCode`, `buildDirectRecoveryPactCode`, `buildCullPactCode`, `buildAwakePactCode`, `buildSlumberPactCode`, `buildFirestarterPactCode`. Replaces the inline template literals that used to live in OuronetUI's 23 CFM modals. Each builder takes a typed params object and returns the canonical Pact-code string.
- **`tests/cfm-builders.test.ts`** — 35 tests. One per builder + argument-order preservation + decimal formatting + edge cases (empty nonce list, single-item list, dayz as integer not decimal, etc). Cross-cutting "every builder produces `(ouronet-ns...)` shape" test for forward-compat.
- **`tests/codex-codec.test.ts`** — 31 tests covering `buildCodexExport` / `serializeCodex` / `deserializeCodex` / `migrateSeedType`. Round-trip + version-mismatch rejection + unicode preservation + idempotent seed-type migration.
- **`tests/strategy.test.ts`** — 9 tests for `CodexSigningStrategy.execute()` + `sign()`. Uses mock `PactClient` + mock `KeyResolver` with real Ed25519 nacl signing (RFC 8032 test vectors for keypairs). Verifies call-order (simulate → submit), gas calibration flows through, sim-failure halts pipeline, guard keypair dedup, `extraSigners` folded into sign step.

### Changed

- `tests/guard.test.ts` — extended with multi-guard scenarios (patron+resident cooperating) and keyset-ref guard edge cases. The pattern every CFM modal runs internally but that wasn't directly covered before.

### Migration notes

- `@ouronet/ouronet-core/pact` now also exports the 14 `buildXPactCode` functions. Existing imports of `formatDecimalForPact`, `safeCreationTime`, `filterFreePositionData`, `mayComeWithDeimal`, `parseEU`, `formatEU` all still work.
- No breaking change — pure additions.

## 0.10.0 — 2026-04-22

**Phase 4 of the OuronetUI → OuronetCore extraction.** Moves encryption primitives + introduces portable Codex types + the backup-JSON codec. Pure additions — no existing export changes.

### Added

- **`@ouronet/ouronet-core/crypto`** — migrated wholesale from OuronetUI's `src/lib/encryptor.ts` + `src/lib/encryptorV2.ts`. Both V1 (PBKDF2-SHA256 10k) and V2 (PBKDF2-SHA512 600k) primitives, plus `smartDecrypt` auto-format-detection + `smartEncrypt` (now pure — takes `schemaVersion: string | null` as an argument instead of reading `localStorage.codex_schema_version`). Works in browser + Node.js.
- **`@ouronet/ouronet-core/codex`** — portable Codex shape + codec:
  - `PlaintextCodex<KS, OA, PK, AB, UI>` — generic in-memory shape. Default type params are `unknown`; consumers (OuronetUI, future HUB) plug in their own wallet/account/keypair types. Fields: kadenaWallets, ouronetWallets, addressBook, pureKeypairs, uiSettings, schemaVersion, lastUpdatedAt, lastUpdatedDevice.
  - `CodexExportV1_2<KS, OA, AB, UI>` — the `"version": "1.2"` backup-JSON shape OuronetUI has been writing since early 2025. Intentionally preserved byte-for-byte: existing `OuronetCodex_*.json` files stay valid.
  - `buildCodexExport(codex)` + `serializeCodex(codex)` (stringify with 2-space indent) + `deserializeCodex(json)` (throws on version mismatch — fail-fast before mis-decoding a hypothetical future V2).
  - `migrateSeedType(rawType)` + `SeedType`/`RawSeedType` types — the historical `legacy → chainweaver`, `new → koala` mapping. Was inlined in OuronetUI's WalletStorage; lives here now so HUB doesn't rediscover it. Idempotent.
- 31 new encryption tests moved to `tests/encryption.test.ts` (from OuronetUI's `src/lib/__tests__/encryption.test.ts`). Covers V1/V2 round-trips, wrong-password, envelope shape, smartDecrypt mixed-format, isCodexUpgraded predicate, smartEncrypt schema-version dispatch. **193 tests total pass** (was 162).

### Migration notes

- `smartEncrypt` API changed: now `smartEncrypt(plaintext, password, schemaVersion)` instead of the browser-only `smartEncrypt(plaintext, password)`. OuronetUI keeps a tiny `src/lib/smart-encrypt-browser.ts` wrapper that reads `localStorage.codex_schema_version` and delegates here — no behaviour change for UI consumers.
- Existing codex blobs decrypt identically — no on-disk format change.

## 0.9.1 — 2026-04-22

**Phase 3b cleanup.** Deletes 15 now-unused `executeX` helpers from `interactions/wrapFunctions.ts` and re-tightens `tsconfig.json` (`noUnusedLocals` + `noUnusedParameters` back on, were relaxed during the 3a/3b scaffolding).

### Removed

- `executeFirestarter`, `executeSublimate`, `executeCompress`, `executeTransferToken`, `executeCoil`, `executeCurl`, `executeBrumate`, `executeConstrict`, `executeColdRecovery`, `executeDirectRecovery`, `executeCull`, `buildNativeTransferTx`, `executeAwake`, `executeSlumber`, `executeClearDispo` — every last CFM modal in OuronetUI (v0.29.7c) moved to `strategy.execute()`, so these direct-path helpers have no remaining callers. Kept: `executeWrapStoa` + `executeWrapUrStoa` (still used by the two Wrap* modals, which aren't CFM modals).

### Changed

- `tsconfig.json`: `noUnusedLocals: true`, `noUnusedParameters: true` — both were off during 3a/3b to let scaffolding compile with in-flight unused symbols. Back on, with a handful of leftover unused imports (`NATIVE_TOKEN_VAULT`, `IKeyset`, a couple of dev-local variables) cleaned up.

### Migration

Consumers that still imported these helpers will fail to resolve — if you're one of those, switch to `CodexSigningStrategy` via `new CodexSigningStrategy(resolver, client)` + `strategy.execute({...})` (see codexStrategy.ts docstring).

## 0.9.0 — 2026-04-22

**Phase 3b.2 Wave 4 support.** Small SigningStrategy API addition — adds `extraSigners?: IKadenaKeypair[]` to `execute()` so flows with more than two signer roles (like Firestarter, which needs GAS_PAYER + payment-key with `coin.TRANSFER` cap + account guards) can plug in. No breaking change: existing consumers pass nothing and behave exactly as before.

### Added

- `SigningStrategy.execute({ extraSigners? })` — optional array of pre-resolved `IKadenaKeypair`s. The strategy folds them into the sign step alongside the guard keypairs (deduplicated by pubkey). Used by OuronetUI's `FirestarterCFMModal` to supply the payment-key signer whose `coin.TRANSFER` cap the build closure wires explicitly via `addSigner`.

## 0.8.0 — 2026-04-22

**Phase 3b.2 Wave 1 support.** Pure addition — exposes `safeCreationTime()` from `@ouronet/ouronet-core/pact` so CFM modals in OuronetUI can mint `creationTime` values the same way every core `execute*` helper already does (Pact `setMeta`'s creationTime − 30s to sidestep node clock-skew rejections). No behavior changes to existing exports.

### Added

- `safeCreationTime(): number` — shared `Math.floor(Date.now()/1000) - 30` helper. Used by the CFM modals' `strategy.execute({ build })` closures so their `setMeta({creationTime})` matches what the A-F pipeline has always done. Keeps sim + submit consistent across every modal.

## 0.7.0 — 2026-04-22

**Phase 3b.1 of the OuronetUI → OuronetCore extraction.** Ships `CodexSigningStrategy` — the first real `SigningStrategy` implementation. The 23 CFM modals in OuronetUI can now delete their ~43-line `handleExecute` A-F pipeline in favor of a ~30-line `strategy.execute({...})` call. Done one modal at a time with smoke-testing between each; `CompressCFMModal` is the first consumer (see OuronetUI v0.29.6).

### Added

- **`@ouronet/ouronet-core/signing/CodexSigningStrategy`** — implements the full pipeline:
  1. Get codex pub set from resolver
  2. `analyzeGuard` each guard (with any caller-provided resolvedForeignKeys)
  3. Resolve keypairs via `resolver.getKeyPairByPublicKey` (or synthesize inline for resolved-foreign keys)
  4. `selectCapsSigningKey` for GAS_PAYER avoiding pure-signer overlap
  5. Build via caller closure (given the resolved pubkeys)
  6. `client.dirtyRead` to simulate → fail-fast
  7. `calculateAutoGasLimit` on measured gas
  8. Rebuild with real gas
  9. `universalSignTransaction` with deduped keypairs
  10. `client.submit` → return `{requestKey, raw}`
- `.execute(...)` for the full pipeline; `.sign(...)` as a lower-level primitive for callers that own their simulation flow.

### Changed

- `SigningStrategy.execute`'s `build` closure signature widened: now receives `{gasLimit, capsKeyPub, guardPubs}` instead of just `gasLimit`. Necessary because Pact.builder's `addSigner` calls need the pubkeys at simulation time (cap-requiring modules reject sims with missing capability signers).

### Migration semantics

Resolved-foreign-keys handling: when a guard-signer pubkey is in the caller's `resolvedForeignKeys` map (user pasted a raw priv via `ForeignKeySignModal` or equivalent), the strategy synthesizes `{publicKey: pub, privateKey, seedType: "foreign"}` inline rather than asking the resolver — the resolver never knew about it. Codex keys still go through the resolver which handles password prompts + HD derivation.

## 0.6.0 — 2026-04-22

**Phase 3a of the OuronetUI → OuronetCore extraction.** Pure scaffolding release — introduces the signing abstractions Phase 3b will wire up and collapse the 23 CFM `handleExecute` duplicates against.

### Added

- **`@ouronet/ouronet-core/signing/types`** — three interfaces grounded in the research pass (`docs/EXTRACT_OURONET_CORE_PLAN.md §2.2` in the OuronetUI repo):
  - **`IKadenaKeypair`** — canonical home for the keypair shape. Same structure ouroFunctions has been exporting since Phase 2b; this version is the authoritative one going forward. Both paths compile because the shape is identical.
  - **`KeyResolver`** — the three-method contract (`listCodexPubs`, `getKeyPairByPublicKey`, optional `requestForeignKey`) each consumer implements against their own Codex backend. OuronetUI: `ReduxCodexResolver` (Redux + wallet-context). HUB: future `FileCodexResolver` (disk file + env/KMS passphrase). CLI: `readline`. Etc.
  - **`PactClient`** — minimal `dirtyRead` + `submit` subset of `@kadena/client`'s `createClient` return. Strategies accept one so the URL isn't baked into core (browser needs the CF-worker proxy; server hits Stoa directly).
  - **`SigningStrategy`** — the `execute(...)` + `sign(...)` pipeline interface. Still unimplemented in this release; `CodexSigningStrategy` lands in Phase 3b.

### Changed

Nothing — this is additive scaffolding. Every existing import path keeps working unchanged; every runtime behavior is identical to v0.5.0.

### Tests

Still 162 — the new interfaces are compile-time only and have no runtime until Phase 3b wires an implementation. On-chain acceptance for the whole signing surface runs at the end of 3b (9-item real-wallet matrix).

## 0.5.0 — 2026-04-22

**Phase 2c of the OuronetUI → OuronetCore extraction.** HD keypair derivation + runtime wallet class move to core; `CodexStorageAdapter` interface defined so browser + server consumers each implement their own storage backend.

### Added

- **`@ouronet/ouronet-core/wallet/KadenaWalletBuilder`** — HD keypair derivation + mnemonic generation/validation. Two paths: `koala` (24-word BIP39 + SLIP-10 Ed25519) and `chainweaver`/`eckowallet` (12-word Kadena mnemonic + BIP32-Ed25519). Plus `encrypt`/`decrypt` wrapping `@kadena/hd-wallet`'s AES-GCM primitive (distinct from core/crypto's Codex-level encryption — this is the inner per-seed wrapper).
- **`@ouronet/ouronet-core/wallet/KadenaWallet`** — runtime account class with `address`, `publicKey`, `derivationPath`, and lazy `getBalance()`. Pure data holder + one async chain read.
- **`@ouronet/ouronet-core/wallet/SeedType`** — `"koala" | "chainweaver" | "eckowallet"`. Picks the derivation algorithm; NOT a delegation marker (no browser-wallet integration is wired).
- **`@ouronet/ouronet-core/wallet/CodexStorageAdapter`** — interface only. Two methods: `load()`, `save(codex)`, `clear()`. Concrete implementations live in each consumer: OuronetUI ships `LocalStorageCodexAdapter` (backed by localStorage + redux-persist); the HUB will ship `EncryptedFileCodexAdapter` (AES-GCM file on disk). Core intentionally provides no default — each runtime brings its own.

### Why no default adapter in core

Different runtimes have fundamentally different idioms: Redux action-dispatch (browser) vs direct-mutation-then-write (server) vs async-backend (future). Trying to force them through one shared state machine gains nothing; the interface is the minimal contract. Phase 4's `PlaintextCodex` type will concrete-type the payload both adapters persist.

### Tests

Still 162 — the wallet code is integration-level (needs real @kadena/hd-wallet WASM + a mnemonic); unit-testing would mostly exercise the library. Phase 3b's on-chain checklist covers HD-derivation end-to-end.

## 0.4.1 — 2026-04-22

**Phase 2b refinement.** Adds a pluggable Pact reader so consumers can wire their own cache-aware implementation, restoring the read behavior OuronetUI had before Phase 2b. Caught via a Smart Swap UI flicker bug: after v0.4.0, every dex read inside `interactions/*` went through `rawCalibratedDirtyRead` — no cache, no dedup — so a widget that fires reads per-keystroke (Smart Swap's token selector) flickered and couldn't finalize a selection.

### Added

- **`@ouronet/ouronet-core/reads`** — new `setPactReader(reader)` + `getPactReader()` + `pactRead(pactCode, options)`. Interactions now call `pactRead` instead of `rawCalibratedDirtyRead` directly; the default is `rawCalibratedDirtyRead` (so HUB / server consumers see no change), but OuronetUI calls `setPactReader(calibratedDirtyRead)` at boot and its cache-aware wrapper takes over.

### Changed

- Every `rawCalibratedDirtyRead(...)` call inside `src/interactions/*` rewritten to `pactRead(...)`. Behavior identical when no reader is configured (default is still raw); behavior cache-aware when a consumer configures one.

### Why

Phase 2b's sed swapped `calibratedDirtyRead` → `rawCalibratedDirtyRead` blanket across all moved interactions. That was too aggressive — the intent was "simulations shouldn't be cached" (one-shot reads before signing), but the same swap also touched routine display reads inside `interactions/*` (`getPoolTotalFee`, `getSwpairs`, `getSWPairGeneralInfo`, etc.). These need cache dedup because UI widgets call them repeatedly as users interact. Pluggable reader keeps both worlds clean: raw by default, cached on request.

## 0.4.0 — 2026-04-22

**Phase 2b of the OuronetUI → OuronetCore extraction.** The largest single phase so far — all Pact builders + error helpers + signing core move into the package. Both consumers (OuronetUI today, HUB in future) now get every on-chain action OuronetUI performs by importing from `@ouronet/ouronet-core/interactions/*`.

### Added

- **`@ouronet/ouronet-core/interactions/*`** — 13 files from OuronetUI's `src/kadena/interactions/`:
  `activateFunctions`, `addLiquidityFunctions`, `coilFunctions`, `crossChainFunctions`, `dexFunctions` (swap + pool reads), `guardFunctions` (guard rotation), `infoOneFunctions` (INFO_* cost-estimate reads), `kadenaFunctions` (native coin + account reads), `kpayFunctions`, `ouroFunctions` (OURO token family, ignis, virtual-OURO, activation flow), `pensionFunctions` (brumate / hibernate), `urStoaFunctions` (stake / unstake / collect), `wrapFunctions` (Coil / Curl / Compress / Sublimate / Awake / Slumber / Transfer / Firestater). Sub-path-importable as `@ouronet/ouronet-core/interactions/ouroFunctions` etc. — the package now declares a wildcard subpath so every file is its own entry.
- **`@ouronet/ouronet-core/errors`** — `TransactionError`, `SigningError` + `createSigningError` / `createSimulationError` / `formatErrorForUser` / `logDetailedError`. Moved wholesale from OuronetUI's `src/lib/transaction-errors.ts`; 100% pure, no browser deps.
- **`@ouronet/ouronet-core/signing/universalSign.ts`** — `universalSignTransaction`, `UniversalKeypair`, `fromKeypair`. Phase-3 will collapse with OuronetUI's local copy (which still exists — interactions in core use core's version, the rest of UI uses its own until signing's full refactor lands).
- **`@ouronet/ouronet-core/guard`** adds `IKeyset` type (was in OuronetUI's `src/ouro.d.ts`).

### Changed

- `rawCalibratedDirtyRead` gained accepted-and-ignored `tier?: string` + `skipTempWatcher?: boolean` options — source-compatibility shim for the 20+ call sites that previously hit OuronetUI's cache-aware wrapper with these options.
- Barrel `src/interactions/index.ts` now re-exports only `ouroFunctions` (the canonical source of shared types). Cross-file collisions on `IKadenaKeypair` / `IOuroAccountKeypair` / etc. surface if consumers import from the root barrel; use sub-path imports (`./interactions/<filename>`) when in doubt.

### Internal

- Relaxed `tsconfig.json`: removed `noUnusedLocals` + `noUnusedParameters` (OuronetUI's cached typecheck was silently tolerating these; re-tighten in a later cleanup phase).
- ~12 surgical `as any` casts inside the moved interactions where stricter `@kadena/types` in TS 5.9 rejected access patterns that worked under the OuronetUI cache. All casts are boundary-level (narrowing response bodies, slippage-bounds addData args, BIP32 WASM hashBytes). No behaviour change.

### Tests

Still 162 tests / 5 files on the core side — the moved interaction code has no tests yet (interactions are integration-level; Phase 3b's on-chain acceptance checklist is the real verification). Phase 3 / 4 add more.

## 0.3.0 — 2026-04-22

**Phase 2a of the OuronetUI → OuronetCore extraction.** Adds raw on-chain read + Pact-format helpers.

### Added

- **`@ouronet/ouronet-core/reads`** — `rawCalibratedDirtyRead(pactCode, options?)`. Uncached Pact dirty-read with a read-friendly 10M gas ceiling. Pure, no React lifecycle. OuronetUI layers its PactQueryCache on top; the HUB will call this directly.
- **`@ouronet/ouronet-core/pact`** — three helpers moved from OuronetUI's `src/lib/utils.ts`:
  - `formatDecimalForPact(amount, maxDecimals?)` — canonicalize a decimal string for Pact code literals (adds `.0` to integers, truncates overlong fractional parts, validates shape).
  - `mayComeWithDeimal(data)` — unwrap Pact's `{ decimal: "…" }` envelope to the underlying string (typo preserved from original to keep name compatibility).
  - `filterFreePositionData(raw)` — normalise the `[{ "reward-tokens": [0] }]` sentinel the chain returns for "no positions" to an empty array.
- **`@ouronet/ouronet-core/signing`** — `toHexString(byteArray)` added alongside `publicKeyFromPrivateKey` + `publicKeyFromExtendedKey`. Used wherever raw bytes cross into strings (derived private keys, signed-tx hashes).

### Tests

+52 tests across `pact-format.test.ts` (29: formatDecimalForPact, mayComeWithDeimal, filterFreePositionData, Pact code template snapshots) and `signing.test.ts` (signing-primitives test moved from OuronetUI, plus 7 new tests for toHexString). Total suite: 162 tests across 5 files (was 110).

### `exports` map

Added `./pact` subpath to `package.json` exports. Existing `./reads` and `./signing` subpaths gain new symbols; consumers don't need to change import style.

## 0.2.0 — 2026-04-22

**Phase 1 of the OuronetUI → OuronetCore extraction.** First real code move.

### Added

- **`@ouronet/ouronet-core/constants`** — full StoaChain / Chainweb / Pact constants:
  - `KADENA_NETWORK`, `KADENA_CHAIN_ID`, `KADENA_NAMESPACE`, `KADENA_BASE_URL`, `PACT_URL`, `KADENA_CHAINS`, `STOA_CHAINS`, `STOA_CHAIN_COUNT`
  - Stoa autonomic account addresses: `STOA_AUTONOMIC_OUROBOROS`, `STOA_AUTONOMIC_LIQUIDPOT`, `STOA_AUTONOMIC_OURONETGASSTATION`, legacy aliases `GAS_STATION` + `NATIVE_TOKEN_VAULT`
  - `MAIN_TOKENS` list
  - Token IDs: `TOKEN_ID_OURO`, `TOKEN_ID_IGNIS`, `TOKEN_ID_AURYN`, `TOKEN_ID_ELITEAURYN`, `TOKEN_ID_WSTOA`, `TOKEN_ID_SSTOA`, `TOKEN_ID_GSTOA`, `ALL_TOKEN_IDS`
  - Helper accessors `getPactUrl(chainId)` + `getSpvUrl(chainId)` that route through node-failover
- **`@ouronet/ouronet-core/network`** — Stoa node failover:
  - Primary node2 → fallback node1, with health check + 30s retry loop
  - `getActiveBaseUrl`, `getActiveHost`, `getActivePactUrl`, `getActiveSpvUrl`
  - `setNodeConfig` (node2 / node1 / custom), `getNodeConfig`, `getCurrentNodeStatus`, `getNodeGasLimit`, `getActiveGasLimit`, `CHAINWEB_DEFAULT_GAS_LIMIT`
  - `withFailover(fn)` — wrapper that retries once on fallback for network errors
  - `initNodeFailover()` — optional startup health check
- **`@ouronet/ouronet-core/gas`** — gas + ANU/STOA math:
  - `ANU_PER_STOA` (10^12), `GAS_LIMIT_MAX` (2M), `GAS_PRICE_MIN_ANU`, TTL constants
  - `anuToStoa`, `stoaToAnu`, `formatAnuAsStoa`
  - `getGasLimitStatus` (safe/warning/danger bands) + `GAS_LIMIT_COLORS`
  - `formatMaxFee`, `calculateAutoGasLimit` (5-bucket buffer with node-cap)
- **`@ouronet/ouronet-core/guard`** — full guard analysis surface:
  - `computeThreshold` for 14 predicates: standard (keys-all/keys-any/keys-2), stoic fixed (keys-1/3/4), M-of-N (2-of-3 through 5-of-9), percentage (51/60/66/75/90pct), tolerance (all-but-one/two)
  - `predicateLabel`, `analyzeGuard`, `buildCodexPubSet`, `classifyPaymentKey`, `tryDerivePublicKey`, `selectCapsSigningKey` — all pure
- **`@ouronet/ouronet-core/signing`** — phase-1 temp copy of pure public-key primitives:
  - `publicKeyFromPrivateKey` (standard Ed25519 from 64-char seed)
  - `publicKeyFromExtendedKey` (BIP32-Ed25519 from kL half of extended key)
  - Full signing surface (universalSignTransaction, KeyResolver, SigningStrategy) lands in Phase 3

### Tests

110 tests across 3 files (`guard.test.ts` 54, `gas.test.ts` 31, `network.test.ts` 25), all green in Node environment.

### Peer dependencies added

- `@kadena/cryptography-utils ^0.4.0` (public-key derivation)
- `@noble/curves ^1.4.0` (BIP32-Ed25519 math)

## 0.1.0 — 2026-04-21

Initial scaffold commit. Empty-barrel skeleton. See
[`docs/EXTRACT_OURONET_CORE_PLAN.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/EXTRACT_OURONET_CORE_PLAN.md) in the OuronetUI repo for the multi-phase plan driving this package's development.
