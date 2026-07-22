# @ouronet/ouronet-core

Ouronet protocol business logic on top of [`@stoachain/stoa-core`](https://www.npmjs.com/package/@stoachain/stoa-core) — codex backup format, the 13 `interactions/*` Pact builders for the `ouronet-ns` modules, the `STOA_AUTONOMIC_*` autonomic accounts, and the cfm Pact-code assembler. Consumed by **OuronetUI** (browser SPA) and the **AncientHolder HUB** (Node.js server).

Chain-generic infrastructure (signing, wallet, crypto, network failover, gas, guard, errors, observability, dalos, reads, pact-format helpers) lives in the sibling [`@stoachain/stoa-core`](https://www.npmjs.com/package/@stoachain/stoa-core) package — install both, or just this one if you only need the Ouronet-specific surface.

> **Renamed.** This package was published as `@stoachain/ouronet-core` through 4.3.5. The
> code, version line, and release history continue unbroken under the `@ouronet` scope —
> the published name now matches the organisation that owns it. The old name is deprecated
> on npm and points here. Migration is a rename and nothing else:
>
> ```diff
> - import { serializeCodex } from "@stoachain/ouronet-core/codex";
> + import { serializeCodex } from "@ouronet/ouronet-core/codex";
> ```

## Status

**`4.3.7` on public npmjs** — **PATCH (chain-peer realignment with `@stoachain/stoa-core@4.3.7` + `@stoachain/kadena-stoic-legacy@4.3.7`).** Released 2026-07-22. NO code changes in this package. The exact chain peers move 4.3.6 → 4.3.7 so consumers resolving the current chain layer get a satisfiable tree; stoa-js 4.3.7 repointed DALOS onto `@ouronet/dalos-crypto@4.0.4`. **785 specs pass.**

**`4.3.6` on public npmjs** — **PATCH (atomic-triplet alignment with `@stoachain/stoa-core@4.3.6` + `@stoachain/kadena-stoic-legacy@4.3.6`).** Released 2026-06-11. NO code changes in this package; version bumped solely to maintain the atomic-triplet invariant. The v4.3.6 change (a `@stoachain/stoa-core` auto-gas-limit floor fix in `calculateAutoGasLimit`) lives entirely in `@stoachain/stoa-core`. Functionally identical to `4.3.5`. **829 specs pass.**

**`4.3.5` on public npmjs** — **ADDITIVE (atomic-triplet with `@stoachain/stoa-core@4.3.5` + `@stoachain/kadena-stoic-legacy@4.3.5` — those two functionally identical to 4.3.4; only ouronet-core changed).** Released 2026-06-10. Smart Ouronet Account deploy (`buildDeploySmartAccountPactCode` + `getDeploySmartAccountInfo`/`…InfoOnly` → `C_DeploySmartAccount`/`URC_DeploySmartAccount`); keyset-ref-aware activation (`buildDeploy{Standard,Smart}AccountPactCode` gained `mode`/`keysetRef` → `(keyset-ref-guard "<ref>")` in `"existing"` mode, preserving the keyset-ref guard type); and `getIgnisBalance` moved to tier **T1** (balance reads belong there — at T5 the patron IGNIS balance stayed stale right after a transfer, falsely blocking spends). Pure additive — existing exports unchanged (deploy builders gained optional defaults). See CHANGELOG.

**`4.3.4` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/stoa-core@4.3.4` + `@stoachain/kadena-stoic-legacy@4.3.4`).** Released 2026-06-08. **Bugfix — UrStoa vault-earnings hover unwrap.** `ouroPrimordialsFunctions.parseResponse` routed `urstoa-vault-earning-hover` (a `{ decimal }` object) through `String()` → `"[object Object]"` → `0`, wrongly disabling the Dashboard UrStoa **Collect** button; it is now routed through `supplyHoverVal` (→ `mayComeWithDeimal`), matching the supply row. **822 specs pass.** See CHANGELOG.

**`4.3.3` on public npmjs** — **Additive (atomic-triplet with `@stoachain/stoa-core@4.3.3` + `@stoachain/kadena-stoic-legacy@4.3.3`).** Released 2026-05-30. New StoicTag + governor-rotation builders (`buildRotateGovernorPactCode`, `buildNonKeyGuardExpr`, `buildReleaseStoicTagPactCode`, `buildRegisterStoicTagPactCode`) + readers (`getStoicTagInfo` URC_0027c, `getStoicTagSelectorData` URC_0027b, `getRegisterStoicTagInfo`) + `StoicTagSelectorData` type, supporting the OuronetUI v1.2.5 StoicTag cycle. Bundles the never-published v4.3.2 frozen-keyset fix in `resolveGuard` / `getKadenaAccountGuard` (shallow-copy instead of mutating a frozen read result). Pure additive — no signature changes to existing exports. **822 specs pass.** npm publishes 4.3.1 → 4.3.3 (4.3.2 was never tagged).

**`4.3.1` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/stoa-core@4.3.1` + `@stoachain/kadena-stoic-legacy@4.3.1`).** Released 2026-05-27. **ESM extensionless-relative-import fix** in emitted `dist/**/*.js` — same bug pattern as the sibling 4.3.1 packages. 40 source files updated, 90 imports rewritten. Strict ESM dynamic-imports (`await import('@ouronet/ouronet-core/codex')`, `/pact`, `/constants`, `/interactions/*`) now succeed under Node 22+. Peer-deps on `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped 4.3.0 → 4.3.1. No API changes. **797/797 specs pass.** See CHANGELOG.

**`4.3.0` on public npmjs** — **MINOR (atomic-triplet with `@stoachain/stoa-core@4.3.0` + `@stoachain/kadena-stoic-legacy@4.3.0`).** Released 2026-05-25. Pure additive surface: 2 new account-rotation Pact builders — `buildRotateGuardPactCode({ patron, account, mode, keysetRef?, safe })` (emits `C_RotateGuard` with runtime-conditional `(read-keyset "ks")` or `(keyset-ref-guard "<ref>")` expression) + `buildRotateKadenaPactCode({ patron, account, newPaymentKey })` (emits `C_RotateKadena`, the kadena-ledger payment-key rotation Pact). MINOR over PATCH because these unlock a new categorised public consumer surface — the new sibling package [`@ouronet/ouronet-codex@0.1.0`](https://www.npmjs.com/package/@ouronet/ouronet-codex)'s headless rotation modals — that wasn't reachable through the prior builder set. Deferred: `buildRotateGovernorPactCode` (Pact function exists on chain, Smart Account `Σ.` only, but no consumer UI ships it yet; lands when OuronetUI consumes it post-Phase-9-migration). Test count: **797 specs pass** (was 788 in v4.2.2; +9 across the new builders). No signature changes to existing exports — consumers on `4.2.2` continue to work unchanged.

**`4.2.2` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/stoa-core@4.2.2` + `@stoachain/kadena-stoic-legacy@4.2.2`).** Released 2026-05-18. Pure additive surface: 4 new `buildXxxPactCode` helpers (`ModifyCanChangeOwner`, `ModifyWeights`, `ToggleSwapCapability`, `ToggleAddLiquidity`) + 5 new INFO readers (`ChangeOwnership`, `ModifyCanChangeOwner`, `ModifyWeights`, `ToggleSwapCapability`, `ToggleAddLiquidity`) + 4 new UR\_\* reads (`getSwpairOwnerKonto`, `getSwpairCanChangeOwner`, `getSwpairCanSwap`, `getSwpairCanAdd`), supporting the OuronetUI v1.0.8 cycle wiring the SWP-pair Liquidity-Pools-Management page buttons. Shipped mid-cycle at 5-of-11 buttons wired (Change Ownership from v1.0.7 + Modify Can Change Owner / Modify Weights / Toggle Swapping / Toggle Provisioning) to validate the cascade on devwallet before the remaining 6 land in v4.2.3. Test count: **~796 specs pass** (was 776 in v4.2.1; +20 across the new builders). No signature changes to existing exports — consumers on `4.2.1` continue to work unchanged.

**`4.2.1` on public npmjs** — **PATCH (atomic-triplet with `@stoachain/stoa-core@4.2.1` + `@stoachain/kadena-stoic-legacy@4.2.1`).** Released 2026-05-16. Pure additive surface: 23 new `buildXxxPactCode` helpers + 1 INFO reader (`getChangeOwnershipInfo`) + 1 unprotected read helper (`getSwpairOwnerKonto`), supporting the OuronetUI v1.0.7 Phase-3b strategy migration cycle (every legacy `executeXxx` direct-helper caller — 14 modals — migrated onto the canonical `useCFMStrategy + buildXxxPactCode` pattern). New families: SWP (ChangeOwnership), TS01-C2.LQD (Wrap + Unwrap families with composite-create-account variants), TS01-C1.DALOS (DeployStandardAccount), TS01-C3.SWP liquidity + swap (AddLiquidity, RemoveLiquidity, 4 swap variants), TS02-C1.DPSF + TS02-C2.DPNF (token-set creation), coin.C_URV (Stake / Unstake / Collect), coin.C_UR (4 native UR transfer variants). Test count: **776 specs pass** (was 710 in v4.2.0; +66 across the new builders). No signature changes to existing exports — consumers on `4.2.0` continue to work unchanged.

**`4.2.0` on public npmjs** — **MINOR (atomic with `@stoachain/stoa-core@4.2.0` + `@stoachain/kadena-stoic-legacy@4.2.0`).** Released 2026-05-09. Closes 6 audit findings: **F-ARCH-001** (Phase 1 dex god-file split — ~10 entity-oriented files + thin re-export shim), **F-ARCH-002** (Phase 2 ouro god-file split + chain/UI surgical separation — ~11 entity-oriented files + thin re-export shim), **F-ARCH-003** (Phase 3 parameterized liquidity executor — 5 thin wrappers + 1 internal `executeLiquidityOp`, LOC reduction ~600 → ~200), **F-API-002** (Phase 4 — 12 functions honor declared `Promise<T | null>` contract, return null on RPC failure instead of rethrowing), **F-API-018** (Phase 5 readonly sweep — ~50 public-type fields in `codex/types.ts` and all `*Params` interfaces), **F-TEST-006** (Phase 7 — +127 specs across 6 modules: `infoOneFunctions`, `coilFunctions`, `kpayFunctions`, `pensionFunctions`, `activateFunctions`, `guardFunctions`). NEW deliverable: [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) at repo root — comprehensive cold-start consumer onboarding doc, 13 sections, full v4.0 → v4.1 → v4.2 architectural arc. 8 new `v4-2-0-*.test.ts` regression-lock files. Test count: **710 specs pass** (was ~330 in v4.1.1). Cross-reference: see [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) at the monorepo root.

**v4.3.7** — chain-peer realignment bump (exact peers on `@stoachain/stoa-core@4.3.7` + `@stoachain/kadena-stoic-legacy@4.3.7`). Released 2026-07-22. NO code changes. Required because this package pins its chain peers exactly and stoa-js now releases independently. **785 specs pass.**

**v4.3.6** — atomic-triplet alignment bump (atomic with `@stoachain/stoa-core@4.3.6` + `@stoachain/kadena-stoic-legacy@4.3.6`). Released 2026-06-11. NO code changes; the v4.3.6 change (a stoa-core auto-gas-limit floor fix in `calculateAutoGasLimit`) lives in `@stoachain/stoa-core`. Functionally identical to v4.3.5. **829 specs pass.**

**v4.3.5** — ADDITIVE (atomic-triplet with `@stoachain/stoa-core@4.3.5` + `@stoachain/kadena-stoic-legacy@4.3.5`). Released 2026-06-10. Smart Ouronet Account deploy builder (`buildDeploySmartAccountPactCode` + `getDeploySmartAccountInfo`/`…InfoOnly`); keyset-ref-aware activation (`mode`/`keysetRef` → `(keyset-ref-guard "<ref>")`); `getIgnisBalance` moved to tier T1 (fresh balance read). Pure additive. **829 specs pass.**

**v4.3.4** — PATCH bugfix (atomic-triplet with `@stoachain/stoa-core@4.3.4` + `@stoachain/kadena-stoic-legacy@4.3.4`). Released 2026-06-08. Routes the `urstoa-vault-earning-hover` `{ decimal }` object through `supplyHoverVal` instead of `String()`, re-enabling the Dashboard UrStoa Collect button. **822 specs pass.**

**v4.3.3** — additive StoicTag + governor-rotation release (atomic-triplet with `@stoachain/stoa-core@4.3.3` + `@stoachain/kadena-stoic-legacy@4.3.3`). Released 2026-05-30. New builders `buildRotateGovernorPactCode`, `buildNonKeyGuardExpr`, `buildReleaseStoicTagPactCode`, `buildRegisterStoicTagPactCode`; new readers `getStoicTagInfo`, `getStoicTagSelectorData`, `getRegisterStoicTagInfo`; new `StoicTagSelectorData` type. Bundles the never-published v4.3.2 frozen-keyset fix (`resolveGuard` / `getKadenaAccountGuard` shallow-copy). Pure additive — no signature changes to existing exports. **822 specs pass.**

**v4.3.1** — ESM packaging fix (atomic-triplet with `@stoachain/stoa-core@4.3.1` + `@stoachain/kadena-stoic-legacy@4.3.1`). Released 2026-05-27. Fixes extensionless relative imports in emitted `dist/**/*.js` that broke `await import('@ouronet/ouronet-core/...')` under Node 22+ strict ESM. 40 source files updated, 90 imports rewritten. Per TypeScript's recommended `.js`-suffix-in-source ESM pattern. Peer-deps on `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped 4.3.0 → 4.3.1. No API changes; **797/797 specs pass**.

**v4.3.0** — additive account-rotation release (atomic-triplet with `@stoachain/stoa-core@4.3.0` + `@stoachain/kadena-stoic-legacy@4.3.0`). Released 2026-05-25. 2 new `buildXxxPactCode` helpers — `buildRotateGuardPactCode` (emits `C_RotateGuard` with runtime-conditional guard expression switched by `mode: "define" | "existing"`; the `safe` boolean is emitted as a bare Pact literal) and `buildRotateKadenaPactCode` (emits `C_RotateKadena`, the kadena-ledger payment-key rotation Pact). Supporting the new sibling package `@ouronet/ouronet-codex@0.1.0`'s headless `<RotateGuardModal>` + `<RotatePaymentKeyModal>` (`<RotateSovereignModal>` uses the pre-existing `buildRotateSovereignPactCode`). Pure additive — no signature changes to existing exports. Test count: 797 (was 788 in v4.2.2; +9 across the new builders). Deferred: `buildRotateGovernorPactCode` lands when OuronetUI consumes it post-migration.

**v4.2.2** — additive SWP-pair management release (atomic-triplet with `@stoachain/stoa-core@4.2.2` + `@stoachain/kadena-stoic-legacy@4.2.2`). Released 2026-05-18. 4 new `buildXxxPactCode` helpers (`ModifyCanChangeOwner`, `ModifyWeights`, `ToggleSwapCapability`, `ToggleAddLiquidity`) + 5 new INFO readers + 4 new UR\_\* reads, supporting the OuronetUI v1.0.8 cycle wiring the SWP-pair Liquidity-Pools-Management page buttons. Shipped mid-cycle at 5-of-11 buttons wired; remaining 6 (Modify Amplifier, Activate Frozen LP, Activate Sleeping LP, Update Special Fee Targets, Update Pending Branding, Upgrade Branding) will land in v4.2.3. Pure additive — no signature changes to existing exports. Test count: ~796 (was 776 in v4.2.1; +20 across the new builders + UR reads).

**v4.2.1** — additive strategy-migration release (atomic-triplet with `@stoachain/stoa-core@4.2.1` + `@stoachain/kadena-stoic-legacy@4.2.1`). Released 2026-05-16. 23 new `buildXxxPactCode` helpers + 1 INFO reader + 1 unprotected read helper, supporting the OuronetUI v1.0.7 Phase-3b strategy migration cycle (14 modals migrated off legacy `executeXxx` direct-helper paths onto `useCFMStrategy + buildXxxPactCode`). New families: SWP `C_ChangeOwnership` + `getSwpairOwnerKonto`; TS01-C2.LQD `Wrap{Stoa,UrStoa}` + `Unwrap{Stoa,UrStoa}` (simple + composite-with-create-account variants); TS01-C1.DALOS `DeployStandardAccount`; TS01-C3.SWP `AddLiquidity` + `RemoveLiquidity` + 4 swap variants (single/multi × with/no-slippage); TS02-C1.DPSF + TS02-C2.DPNF `CreateSet` + `CreateSetNFT`; coin.C_URV `Stake` + `Unstake` + `Collect` (simple + WithCreateAccount); coin.C_UR `NativeUrTransfer` / `Transmit` (+ their `Anew` variants). Composite-shape builders (Unwrap/Collect/Anew family) require the call site to `addData("ks", { keys: [<pub>], pred: "keys-all" })`. Pure additive — no signature changes to existing exports. Test count: 776 (was 710 in v4.2.0; +47 from cfm-builders test growth + ~19 from related coverage). All builders fully tested with canonical-shape + argument-ORDER + module/function-name guards.

**v4.2.0** — architectural-closures + INTEGRATION-GUIDE deliverable. **MINOR (atomic with `@stoachain/stoa-core@4.2.0` + `@stoachain/kadena-stoic-legacy@4.2.0`).** Released 2026-05-09. Lands the v4.2.0 audit-closures release: 6 audit findings closed in this package — **F-ARCH-001 (Phase 1)**: dex god-file split (~600 LOC `interactions/dexFunctions.ts` decomposed into ~10 entity-oriented files: `dexSwapPairCalcFunctions`, `dexSwapPairExecFunctions`, `dexLiquidityCalcFunctions`, `dexLiquidityExecFunctions`, `dexFuelCalcFunctions`, `dexFuelExecFunctions`, `dexDashboardFunctions`, `dexAccountSuppliesFunctions`, `dexCappedInverseFunctions`, `dexTypes`); old import path `@ouronet/ouronet-core/interactions/dexFunctions` continues to work as thin re-export shim. **F-ARCH-002 (Phase 2)**: ouro god-file split + chain/UI surgical separation (~2200 LOC `interactions/ouroFunctions.ts` → ~11 entity-oriented files; chain-side and UI-side surfaces cleanly separated per the locked principle); thin re-export shim preserved. **F-ARCH-003 (Phase 3)**: parameterized liquidity executor — `executeAddLiquiditySingle`, `executeAddLiquidity`, `executeSpecialAddLiquidity`, `executeFuel`, `executeRemoveLiquidity` consolidated into 5 thin wrappers + 1 internal `executeLiquidityOp` (LOC reduction ~600 → ~200); public function signatures preserved verbatim — zero consumer impact. **F-API-002 (Phase 4)**: 12 swap-calc and dashboard-read functions whose declared return type was `Promise<T | null>` now honor that contract — they return null on RPC failure (with `logger.error` invoked first) instead of rethrowing. Existing try/catch consumer patterns continue to work; new code can rely on the static-type signature with the `if (result === null)` pattern. Affected: `getSWPairDashboardInfo`, `getPoolPreviewData`, `getSWPairMultiDashboardInfo`, `getSwpairInternalDashboard`, `calculateDirectSwap`, `calculateInverseSwap`, `calculateDirectSwapB`, `calculateInverseSwapB`, `getCappedInverseAmount`, `getUserAccountSupplies`, plus 2 dashboard-read functions. **F-API-018 (Phase 5)**: aggressive `readonly` sweep across ~50 public-type fields in `codex/types.ts` and all `*Params` interfaces. TypeScript-only signal — no runtime change. Switch in-place mutations to immutable spread copy: `const updatedParams = { ...params, account: 'k:...' };`. **F-TEST-006 (Phase 7)**: +127 specs across 6 modules (`infoOneFunctions` / `coilFunctions` / `kpayFunctions` / `pensionFunctions` / `activateFunctions` / `guardFunctions`); the audit's stated 37 untested functions corrected to 38 (`guardFunctions.describeKeyset` was missed by the 2026-05-05 audit; absorbed by Phase 7 as +1 function = +3 it-blocks). NEW deliverable: **INTEGRATION-GUIDE.md** at repo root — comprehensive cold-start consumer onboarding doc, 13 mandated sections covering the full v4.0 → v4.1 → v4.2 architectural arc (install + peer-deps, the 3-package atomic-release model, subpath imports per package, the 5 typed error classes, the 7-entity Ouronet taxonomy, the 3 pluggable seams `setPactReader`/`KeyResolver`+`PactClient`/`BalanceResolver`, codex backup format `"1.2"`, smart-account auth, gas calibration, full quick-start example). Doc-validity test (`tests/v4-2-0-integration-guide-validity.test.ts`) verifies all cited subpaths resolve, all cited error classes import, all cited seam functions are exported. 8 new `v4-2-0-*.test.ts` regression-lock files in this package. Test count: 710 specs pass (was ~330 in v4.1.1; +127 from Phase 7 + ~250 from Phases 1-5 + 8 regression-lock specs). Cross-reference: [`MIGRATION-v4.2.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.2.md) for the v4.1.x → v4.2.0 transition guide, [`INTEGRATION-GUIDE.md`](https://github.com/StoaChain/stoa-js/blob/main/INTEGRATION-GUIDE.md) for cold-start onboarding.

**`4.1.1` on public npmjs** — **PATCH (atomic with `@stoachain/stoa-core@4.1.1` + `@stoachain/kadena-stoic-legacy@4.1.1`).** Released 2026-05-08. Closes audit findings: F-ERR-022 (fabricated `"0"` fallbacks in `kadenaFunctions` dropped — typed `KadenaShapeError` thrown instead), F-API-005 (`getSublimateInfo` dedup with deprecation shim), F-API-006 (`describeKeyset` dedup), F-API-007 (`EncryptedDataV1` collapse), F-SEC-007 (codex strict-shape with `CodexUnknownFieldError`), F-BUG-010 (`migrateSeedType` strict throw with `UnknownSeedTypeError`), F-API-014 (`getSparksBalance` return type narrowed). New file: `src/interactions/errors.ts` (`KadenaShapeError`). No breaking changes — `getSublimateInfo` deprecation shim preserves backward compatibility. **~330 specs pass.**

**`4.1.0` on public npmjs** — **MIGRATION (atomic with `@stoachain/stoa-core@4.1.0` + `@stoachain/kadena-stoic-legacy@4.1.0`).** Retargets all 12 internal `@kadena/*` imports in `src/interactions/` to the new sibling subpaths under [`@stoachain/kadena-stoic-legacy`](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy). Drops the three `@kadena/*` peer-dep declarations; bumps `@stoachain/stoa-core` peer-dep `4.0.1 → 4.1.0` (atomic-version invariant); adds `@stoachain/kadena-stoic-legacy: "4.1.0"`. No interactions-surface change for consumers — every `Pact.builder` call site rewires under the hood. Test count: 261 (was 218; +43 from new `tests/v4-1-0-no-kadena-imports.test.ts` runtime regression-lock).

**`4.0.1` on public npmjs** — **PATCH, cosmetic (published-metadata cleanup).** Strips the redundant `devDependencies` block from `package.json`. Pre-v4.0.1 the manifest carried `@stoachain/stoa-core: "*"` (workspace-resolution plumbing — meaningless on a published artifact since the `peerDependency` already pins `@stoachain/stoa-core@4.0.1`) plus duplicates of the `@kadena/*` peer entries. The npmjs.com page now shows the cleaner shape: zero `dependencies`, just the canonical `peerDependencies`. Atomic-version invariant: peer-dep on `@stoachain/stoa-core` bumped from `4.0.0` to `4.0.1` (both packages always release at the same version). NO source-code change. NO behaviour change. **218/218 tests pass.**

**`v4.0.0`** — **MAJOR, breaking (monorepo split + deprecated-alias removal).** v4.0.0 is the structural refactor that v3.3.8 set up. The single `@ouronet/ouronet-core` package was split into two atomic-release npm packages under the new `StoaChain/stoa-js` GitHub monorepo: `@stoachain/stoa-core` (chain-generic foundation) + `@ouronet/ouronet-core` (Ouronet protocol, this package). Both packages release atomically out of the monorepo at the same version — a single `vX.Y.Z` git tag publishes both. Removed the v3.3.8-deprecated aliases (`KADENA_BASE_URL`, `PACT_URL`, `GAS_STATION`, `NATIVE_TOKEN_VAULT`) and the duplicate `IKadenaKeypair` interface in `interactions/ouroFunctions.ts`. Consumers using only the Ouronet-specific surface (codex, interactions, the `ouronet-ns` namespace) can keep this package and bump the version. Consumers using chain-generic surfaces must add `@stoachain/stoa-core` and update the import paths — see [`MIGRATION-v4.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.md) at the monorepo root for the full upgrade map. **703/703 tests pass** across both packages (485 in stoa-core, 218 in ouronet-core; up from v3.3.8's 698 because the F-ARCH-011/F-ARCH-012 v3.3.8 regression locks now live alongside their stoa-core SUTs — every prior test preserved). Also pinned all `@kadena/*` + `@noble/curves` + `@scure/bip39` + `@ouronet/dalos-crypto` peer/dev deps to exact versions (no `^`) — prep work for v4.1.0's selective vendoring of `@kadena/client` (supply-chain hardening after Kadena LLC's dissolution).

**`v3.3.8`** — **MINOR, additive
(documentation/deprecation cleanup pass).** Closes 5
LOW-severity findings from the 2026-05-05 audit's `"v3.x
deprecation cleanup"` + `"v3.x conventions alignment"` + `"v3.x
API hygiene"` themes in a single bundled release.
**F-API-015** rewrote stale `strict`-parameter JSDoc on
`src/dalos/account.ts:42-45` (the parameter never existed in
the `CreateAccountOptions` type union; new doc explains the
actual mode-vs-primitive throw contract).
**F-API-016** added `export` to the `CoilConfig` interface in
`src/interactions/coilFunctions.ts:17` — consumers holding a
`CoilConfig` value (e.g. from `COIL_CONFIGS.ouroToAuryn`)
could USE it but couldn't TYPE-ANNOTATE a parameter or local
with `CoilConfig` without re-declaring the shape; now they can.
**F-SEC-005 / F-ARCH-014** added `@deprecated` JSDoc to
`KADENA_BASE_URL` redirecting consumers to the failover-aware
`getActivePactUrl(chainId)` / `getActiveSpvUrl(chainId)` (or
the same-subpath thin wrappers `getPactUrl(chainId)` /
`getSpvUrl(chainId)`); removal scheduled for v4.0.0. The
constant was pinned to `node2.stoachain.com` and bypassed the
v2.1.0 failover layer.
**F-ARCH-011** consolidated `normalizeKeysetRef` deep-import
in `src/interactions/ouroFunctions.ts:10` to the `../guard`
barrel, matching the project's subpath-import discipline.
**F-ARCH-012** converted 19 single-quoted string literals to
double quotes in `src/dalos/account.ts` — the file was the
only remaining drift after v3.1.1's fix to
`src/dalos/index.ts`. Pure stylistic; TypeScript treats the
two forms as identical string literals at the type level.
**NO breaking change**, **NO observable runtime behavior
change**, **698/698 tests pass** (was 695 in v3.3.7; +3 from
the new `tests/v3-3-8-doc-cleanup.test.ts` regression-lock
file). One new public-API export (`CoilConfig` interface).

**`3.3.7`** — **MINOR, additive (security
pass).** Closes two MEDIUM security findings from the
2026-05-05 audit in a single bundled release: **F-SEC-003**
(seam-setter input validation) and **F-SEC-004** (V1-fallback
security advisory). **F-SEC-003** adds two new typed errors —
`InvalidPactReaderError` (rejects non-function values passed to
`setPactReader`) and `InvalidLoggerError` (rejects null /
undefined / non-object inputs and any object whose `warn` or
`error` are non-callable, passed to `setLogger`). Both extend
`TypeError` so existing consumer `instanceof TypeError` catches
are unchanged. Pre-v3.3.7 the misconfigurations only surfaced
later as `_reader is not a function` / `_logger.warn is not a
function` at the first call site, far from the boot wiring;
v3.3.7 surfaces them at the boot site. **F-SEC-004** wires a
**one-shot** `getLogger().warn(...)` security advisory into the
V1-decrypt path (V1 = PBKDF2-SHA256 / 10,000 iterations; OWASP
2023+ recommends 600,000) — fires on the FIRST V1 envelope
decoded per process lifetime, stays silent after that so a
codex with 100 V1 entries logs ONE warning, not 100. Adds two
new public-API rich variants `decryptStringV2WithDetails` and
`smartDecryptWithDetails` that return `{plaintext, wasLegacyV1}`
for the per-call programmatic signal — consumers can react by
re-encrypting affected entries to V2 in-place. JSDoc CVE-style
risk documentation added to `EncryptedDataV1`,
`decryptStringV2`, and `smartDecrypt`. **NO breaking change**,
**695/695 tests pass** (was 674 in v3.3.6; +21 from
`tests/v3-3-7-seam-validators.test.ts` (11) +
`tests/v3-3-7-v1-warning.test.ts` (10)). v3.3.0 contract test
locking the byte-identical `setLogger requires a non-null
Logger` message preserved verbatim — the new
`InvalidLoggerError` extends `TypeError` to keep that contract
intact.

**`3.3.6`** — **MINOR, additive (performance
pass).** Closes three MEDIUM performance findings from the
2026-05-05 audit in a single bundled release:
**F-PERF-008** — added `"sideEffects": false` to `package.json`
(the audit's "single most impactful tree-shaking fix"; lets
downstream bundlers prune unused barrel imports from the
16-subpath exports map; verified safe via top-level-mutation
grep across `src/`);
**F-PERF-003** — memoized 8 `RegExp` allocations per call in
`coilFunctions.getCoilPreviewGeneric` to a per-`targetTokenName`
`Map<string, CoilPatternSet>` cache (the audit's literal
suggested fix "hoist to module-level const" doesn't apply
because patterns interpolate `targetTokenName` from `config`,
but the cache form achieves the same outcome — steady-state
allocation cost is 0 RegExp objects per call after warm-up);
**F-PERF-004** — parallelized `ouroFunctions.getOuronetKdaDetails`
from sequential `await getKadenaAccountOwner()` →
`await getKadenaAccountGuard()` to a single
`Promise.all([owner, guard])` (verified independent: probes
`DALOS.UR_AccountKadena` vs `DALOS.UR_AccountGuard` with no
causal dependency; halves happy-path latency from 2 sequential
RPC roundtrips to 1 parallel roundtrip).
All three are low-risk, behaviorally identical to v3.3.5.
Consumer-side impact: smaller OuronetUI bundle sizes (F-PERF-008,
exact savings bundler-config-dependent); faster
`getOuronetKdaDetails` (F-PERF-004, ~half wall-clock); no
observable difference for `getCoilPreviewGeneric` (F-PERF-003,
internal-only). **NO public API change**, **674/674 tests pass**
(was 672 in v3.3.5; +2 from the new
`tests/v3-3-6-perf-pass.test.ts` regression-lock file). Locks
both F-PERF-008 (`expect(pkg.sideEffects).toBe(false)` strict
equality) and F-PERF-004 (counting reader proves both
`UR_AccountKadena` AND `UR_AccountGuard` reads still happen,
catching a regression that accidentally drops one of the reads).

**`3.3.5`** — **MINOR, additive (test-only).**
Closes audit finding **F-TEST-006** (MEDIUM, testing-auditor) —
six interaction modules previously had insufficient runtime
coverage: three with **zero runtime tests at all**
(`pensionFunctions`, `guardFunctions`, `infoOneFunctions`) and
three with **compile-only tests** (`coilFunctions`,
`kpayFunctions`, `activateFunctions` are all type-checked at
`tests/types.test.ts:44-47` via `expectTypeOf`, but the functions
never actually execute in the test suite). Compile-only tests
prove the type signature matches consumer expectations but do
NOT prove the function executes correctly — a bug that swapped
two argument-string concatenations, forgot to await a Promise,
or mis-routed the `pactRead` call would all type-check cleanly
while producing wrong runtime behaviour. v3.3.5 closes the gap
with `tests/v3-3-5-smoke.test.ts` — **12 new it-blocks across 6
describe groups**, one happy-path + one error-path test per
module, picking the simplest representative read-only function
from each: `pensionFunctions.getHibernateFee` (the ONLY of the 6
with a non-null error path — graceful-degradation fallback
formula `0.12 - 0.000008 * lockDays` clamped non-negative);
`guardFunctions.getRotateGuardInfo`;
`infoOneFunctions.getCoilPreviewInfo` (locks the
`{result: ...}` envelope wrap contract);
`coilFunctions.getCoilPreviewGeneric` (the ONLY of the 6 that
rethrows rather than returning `null`/fallback — locks the
rethrow contract that consumers depend on for try/catch flow);
`kpayFunctions.getKpayData`;
`activateFunctions.getDeployStandardAccountInfoOnly`. Strategy
mirrors v3.3.4: install a stubbed reader via `setPactReader(...)`,
call SUT, assert. **NO source-code change**, **NO public API
change**, **672/672 tests pass** (was 660 in v3.3.4; +12 from
the new test file). With v3.3.5 the **v3.3.x audit-closure track
is COMPLETE** — all MEDIUM testing findings from the 2026-05-05
audit are now closed (F-LOGGER-SEAM-001 → v3.3.0; F-TEST-002 →
v3.3.2; F-TEST-005 → v3.3.4; F-TEST-006 → v3.3.5).

**`3.3.4`** — **MINOR, additive (test-only).**
Closes audit finding **F-TEST-005** (MEDIUM, testing-auditor) —
the v3.0.0 nullable-widening sweep widened 16 read-side
interaction functions from `Promise<T>` → `Promise<T | null>`,
but only **3 of the 16** had a paired success-path test
(`getStoaPriceUSD` at `tests/interactions-pricing.test.ts:80`,
`getLPTypeInfo`'s mixed-state lock at
`interactions-balance-cluster.test.ts:137`, and
`getUrStoaGuard`'s 3-state contract at the same file:207). The
other 13 could not distinguish "always returns null" (silent
regression) from "returns null only on RPC failure" (correct
contract) — a future bug that returned `null` unconditionally
would slip past every existing test, surface only at consumer
runtime, and be caught only by chain-side breakage. v3.3.4
closes the gap with `tests/v3-3-4-success-paths.test.ts` —
**13 new it-blocks across 6 describe groups**, one per missing
function, each installing a `successReader` stub via
`setPactReader(...)` and asserting the parsed non-null return
value. The 13 functions: `getTokenDecimals`, `getPoolTotalFee`,
`getDPTFMinMove` (pricing-quartet missing 3); `getIgnisBalance`,
`getAccountTokenSupply`, `getOuroDispoCapacity`, `getVirtualOuro`
(string-balance cluster — none previously covered);
`getUrStoaBalance` and `checkCoinAccountExists` (urStoa pair);
`validateLiquidity` (mixed-shape success — locks the
`valid:true` ↔ `error:undefined` mutual exclusion that
distinguishes a successful liquidity check from an RPC-failure
one); `getMaxBuyMovieBooster` (locks `Number.isFinite` guard
against v2.x fabricated-`0`); `getSWPSpawnLimit` and
`getSWPInactiveLimit` (magic-string elimination — also asserts
`expect(out).not.toBe("N/A")` so the v3.0.0 BREAKING swap
cannot regress unnoticed). **NO source-code change**, **NO
public API change**, **660/660 tests pass** (was 647 in v3.3.3;
+13 from the new test file).

**`3.3.3`** — **MINOR, additive (NEW PUBLIC
SURFACE — not a bug fix).** Ships the multi-party
partial-signature workflow OuronetUI has been blocked on:
"Person A signs → exports → Person B imports → signs → exports →
Person C imports → signs → submits", with cross-party tamper
detection at every handoff. Builds on v3.3.2's locked
partial-signing primitive (signing with a subset of declared
signers fills only those slots; pre-existing slots stay intact
across re-signing passes) by wrapping it in a versioned export
envelope + slot-status helpers + Ed25519 sig-verification helper.
New `src/signing/partialSig.ts` module re-exported from
`@ouronet/ouronet-core/signing`, exposing 7 functions
(`signPartial`, `serializePartialTransaction`,
`deserializePartialTransaction`, `getMissingSigners`,
`getFilledSigners`, `isFullySigned`, `verifyExistingSignatures`)
+ 2 typed errors (`InvalidEnvelopeError`, `TamperedHashError`) +
the `PartialSigEnvelope` interface. The envelope embeds both
`cmd` and `hash` so importers can verify integrity; if the cmd
was tampered mid-flight, `deserializePartialTransaction` rejects
with `TamperedHashError` carrying both `expected` and `actual` for
operator diagnosability. As a second layer,
`verifyExistingSignatures` runs `nacl.sign.detached.verify` on
every filled slot — works for both nacl-direct (koala/foreign)
and BIP32-WASM (chainweaver/eckowallet) sigs since both produce
standard Ed25519 over the same canonical hash bytes. **NO
existing API changed**, **NO source-side behaviour change**
outside the new module, **647/647 tests pass** (was 631 in
v3.3.2; +16 from the new `tests/partial-sig.test.ts`).

**`3.3.2`** — **MINOR, additive (test-only).**
Closes audit finding **F-TEST-002** (HIGH) — the central signing
entry point `universalSignTransaction` in
`src/signing/universalSign.ts` had ZERO direct tests pre-v3.3.2.
The only mention in `tests/` was a comment in
`tests/signing.test.ts:5` stating "the full
universalSignTransaction is not exercised here";
`tests/strategy.test.ts` exercises a higher-level wrapper but only
covers `seedType: "koala"`. The chainweaver / eckowallet / foreign
branches AND the seedType dispatcher itself were never
runtime-tested — a regression that mis-routed `eckowallet` →
`koala` (or any other dispatch error) would silently produce
wrong-shape signatures, surfaced only by chain-side "invalid
signature" rejection at consumer runtime. v3.3.2 adds
`tests/universal-sign.test.ts` with **9 new it-blocks** covering
all three seedType branches with real-keypair round-trips
(koala via RFC-8032 vector, chainweaver/eckowallet via the
@kadena/hd-wallet vendor vector through
`KadenaWalletBuilder.createWalletPairFromMnemonic`), the
foreign-key `onMissingKey` callback (success and key-mismatch
error cases), the multi-signer mixed-seedType case, the
partial-signing primitive (foundation lock for v3.3.3's
multi-party signing public surface), and the
silent-skip-when-not-in-signers contract. **NO source-code
change**, **NO public API change**, **631/631 tests pass** (was
622 in v3.3.1; +9 from the new test file).

**`3.3.1`** — **PATCH, workflow-only.** Closes the
two carried-forward follow-ups that have appeared in every
pollinate run's "follow-ups" block since v3.0.0: (1) `npm publish`
now passes `--provenance` (and the workflow gains `id-token:
write` permission), so v3.3.1 onwards every release carries a
verifiable SLSA attestation linking the published tarball to the
exact GitHub Action run that produced it; (2) the `gh release
create` calls drop the `--repo` flag, eliminating the
`gh release create --notes-from-tag --repo X` flag-combination
incompatibility that the GitHub-hosted runners' gh-CLI image
rejected starting around 2026-04-30 (every v3.x release pre-v3.3.1
needed pollinate's REST-API fallback at Step 9c to create the
GitHub Release manually). Both fixes are workflow-file-only —
`.github/workflows/publish.yml` is the only file with a behaviour
change. **NO source-code change**, **NO public API change**,
**622/622 tests pass unchanged**. Consumers see byte-identical
package contents to v3.3.0; the difference is the v3.3.1
attestation badge on npmjs.com and a green-check on the GitHub
Action run page (vs the recurring red-X for the gh-CLI Release
step that every v3.x release pre-v3.3.1 produced).

**`3.3.0`** — **MINOR, additive (Logger interface
extension) + behaviour change (call-site routing)** — first release
in the v3.3.x line. Closes the consolidated **F-LOGGER-SEAM-001**
finding flagged by all 8 audit agents at 9 distinct source sites
(highest-redundancy finding in the entire 2026-05-05 audit). Two
of the nine sites were already removed by v3.2.2's deletion of
`executeAddLiquidityMultiStepComplete`; v3.3.0 closes the remaining
seven by extending the `Logger` interface from `{warn, error}` to
`{warn, error, info}` and routing every surviving raw `console.*`
call in `src/` through the seam (or deleting debug-leak
instrumentation that had no operational value). Post-v3.3.0
invariant: **zero raw `console.*` call sites in `src/`** outside
the seam's own default-logger implementation, verified by a new
regression-lock test that scans the entire src/ tree on every run.
Backwards-compat: v3.2.x consumers wiring
`setLogger({warn, error})` continue to work — the setter synthesises
an `info` wrapper that falls through to `console.info` for the new
channel; consumers that want full control pass
`setLogger({warn, error, info})`. **622/622 tests pass.**

**`3.2.3`** — **MINOR, behaviour change** — fourth
and final wave of the v3.2.x audit-cycle close-out track. Four
targeted bug fixes closing the highest-user-impact remaining
findings: **F-BUG-002** (added `creationTime: safeCreationTime()`
to `buildCrossChainTransfer` setMeta block — the lone interactions
builder that omitted the helper after v2.3.0's sweep, causing
sporadic chain-side rejections under client clock drift); **F-BUG-004**
(rewrote `fetchSpvProof` to wrap in `withFailover` + add
`AbortSignal.timeout(30s)` per-attempt deadline — pre-v3.2.3 a
wedged primary node would hang the function indefinitely with the
user's KDA committed to `kadena-xchain-gas` escrow and no recovery
path, identified as the highest-impact bug in the entire audit);
**F-SEC-002** (added URL parse + `https:` scheme allow-list to
`setNodeConfig("custom", customUrl)` — pre-v3.2.3 it accepted any
truthy string and assigned it to `PRIMARY_HOST`, allowing an
attacker-controlled custom-node setting to redirect every signed
transaction); and **F-ERR-001** (added `@throws` JSDoc to
`submitCrossChainTransfer`, `submitContinuation`, and
`listenForCompletion`, documenting the
TIMEOUT-as-pending-not-failed contract that prevents user
double-pay on `listen` timeouts). With these four findings closed,
the v3.2.x sequence has remediated **15 of the audit's 62
confirmed findings** across four ship cycles. **618/618 tests pass**
(was 601 in v3.2.2; +17 new it-blocks). Next: v3.3.x for
logger-seam completion + test coverage; v4.0.0 for structural
decomposition + monorepo split + type consolidation.

**`3.2.2`** — **MINOR, public API removal** —
third wave of the v3.2.x audit-cycle close-out track. Removes the
four `executeAddLiquidityMultiStep*` functions plus the
`MultiStepAddLiquidityResult` type from
`src/interactions/addLiquidityFunctions.ts`, along with the
unused `_strategy` parameter on `executeAddLiquidity`. Closes audit
findings **F-ERR-005** (`error.message.includes` retry-loop crash on
non-Error throws), **F-ERR-014** (listen-timeout vs submit-failure
conflation causing user double-pay risk), **F-PERF-014** (4×
hardcoded 3-second sleeps adding ~6s wall-clock latency to every
successful flow), **F-PERF-015** (retry-with-fixed-sleep against
string-matched `error.message.includes("Cannot find module")`
patterns), and **F-API-026** (the always-`"auto"` `_strategy`
parameter on `executeAddLiquidity` was dead public surface). All
five findings closed **by removal** rather than fix — the
multi-step pipeline existed because the historical Kadena chainweb
gas limit (150k per block) couldn't fit a single-block
add-liquidity transaction; StoaChain's 2M-per-block chainweb fits
the entire flow in one transaction, so multi-step has been dead
code in OuronetUI since the gas-limit increase. Net code change:
**−338 lines** (1031 → 693 lines in `addLiquidityFunctions.ts`).
**601/601 tests pass** unchanged; no test exercised the removed
functions, which was itself a v3.2.x audit signal that the surface
was unused. The Pact-side multi-step contract
(`TS01-CP.SWP|C_AddStandardLiquidity` defpact) is still on chain
for historical interoperability — this package just stops exposing
the TypeScript wrappers around it. Strict-semver-wise this is a
breaking change requiring a MAJOR bump; classified MINOR for v3.2.2
because the removed functions had no known consumer (verified via
repo-wide grep + user confirmation that OuronetUI no longer uses
multi-step). v3.2.3 will land the targeted bug fixes
(`creationTime`, `fetchSpvProof` failover, `setNodeConfig` URL
validation).

**`3.2.1`** — **MINOR, behaviour change** —
second wave of the v3.2.x audit-cycle close-out track. Puts the
v3.2.0 number-hygiene helpers (`formatDecimalForPact`,
`formatIntegerForPact`, `ValidatedDecimal` / `ValidatedInteger`
brand types) to work at the four chain-call sites the 2026-05-05
audit flagged: `buildCrossChainTransfer` (`crossChainFunctions:92`),
`executeNativeUrStoaTransfer` (`urStoaFunctions:206`),
`executeStakeUrStoa` (`urStoaFunctions:441`), and
`executeUnstakeUrStoa` (`urStoaFunctions:497`). Closes audit
findings **F-SEC-001** (Pact-code injection via raw `${amount}`
interpolation in urStoa stake/unstake) and **F-BUG-003**
(`parseFloat(amount).toFixed(N)` silent precision loss + silent
rounding). All four sites now route through the validated
formatter: malformed input throws synchronously before any chain
interaction begins; arbitrary-precision decimals (e.g., 39-digit
integer amounts that would overflow float64) round-trip
byte-identical; EU-locale comma input (`"1,5"`) is normalised to
period; and the urStoa stake/unstake cap-arg now reuses the
validated string so pact-code and cap-arg are guaranteed to agree.
The `numAmount` field on `StakeUrStoaParams` / `UnstakeUrStoaParams`
is deprecated (still accepted, no longer read; will be removed in
v4.0.0). **601/601 tests pass.** v3.2.2 will remove the dead
multi-step add-liquidity surface; v3.2.3 will land the targeted
bug fixes (`creationTime`, `fetchSpvProof` failover,
`setNodeConfig` URL validation).

**`3.2.0`** — **MINOR, additive** release that opened
the v3.2.x audit-cycle close-out track with number-hygiene
infrastructure for Pact-bound integers and decimals.
`formatDecimalForPact` now accepts a single comma as decimal
separator (so European-locale UI text fields work without upstream
normalisation); a new sibling `formatIntegerForPact(amount: string):
ValidatedInteger` validates integer-typed Pact arguments without ever
round-tripping through float64 (arbitrary-precision-safe — a
100-digit integer string passes through byte-identical); two new
branded TypeScript types (`ValidatedDecimal`, `ValidatedInteger`)
prove "this string passed the formatter" at the type level so
downstream call sites get compile-time guarantees that consumer
input has been validated before it reaches Pact-code interpolation.
**No consumer-visible behaviour changes** — every previously-valid
input continues to produce byte-identical output. **593/593 tests
pass** (was 565 in v3.1.1; +28 covering comma-normalisation,
arbitrary-precision round-trips with the explicit
truncation-at-maxDecimals lock, the new integer formatter, and the
brand-type compile contract). v3.2.1 will apply the new helpers at
the existing `parseFloat(...).toFixed(N)` call sites to close the
F-SEC-001 / F-BUG-003 precision-loss vectors; v3.2.2 will remove
the dead multi-step add-liquidity surface (chainweb's gas bump made
it obsolete); v3.2.3 will land the targeted bug fixes
(`creationTime`, `fetchSpvProof` failover, `setNodeConfig` URL
validation).

**`3.1.1`** — **PATCH, additive** release that closed the
audit-cycle gaps identified by the post-v3.1.0-integration audit
(see [`CHANGELOG.md`](CHANGELOG.md) v3.1.1 entry for the full
per-finding trace). Three additive re-exports completed the
`./dalos` integration surface (`InvalidBitStringError`,
`InvalidBitmapError`, `InvalidPrivateKeyError` for typed
validation-failure discrimination + `CoordAffine` companion type
for `SchnorrSignature`); the `src/dalos/` subdirectory was
realigned with CONVENTIONS.md (double-quoted imports, no `.js`
extensions); the v3.1.0 locale-determinism test assertion in
`tests/gas.test.ts` was tightened to strict equality (was a
substring regex that wouldn't detect a regression on a US-locale
CI host); a fresh `tests/dalos-integration.test.ts` block covered
the v3.1.0 Schnorr re-exports end-to-end. No runtime change for
any v3.1.0 consumer; v3.1.0 itself was committed locally
(`bf10dc1`) but never pushed to npm — the npm registry skips from
`3.0.0` to `3.1.1`.

**`3.1.0`** (committed locally `bf10dc1`, never published) — **MINOR,
additive** release that upgrades `@ouronet/dalos-crypto` from
`^1.2.0` to `^4.0.3` (covering
the v2.x/v3.x/v4.x line of the upstream package — Schnorr v2 wire
format, cofactor subgroup-membership hardening, generator-precompute
matrix cache, async signing surfaces, the v4.0.0 Elliptic-package
carve-out on the Go side, and the v4.0.3 LOW-band closures), exposes
the previously-internal **Schnorr signature surface** through the
`./dalos` subpath (`schnorrSign` / `schnorrVerify` and the browser-
friendly `schnorrSignAsync` / `schnorrVerifyAsync` async variants
that yield to the event loop on a fixed cadence; plus the typed
`SchnorrSignError` exception and the `SchnorrSignature` shape type),
and ships a small locale-determinism fix in `formatMaxFee` so the
ANU thousands separator is `,` on every host (was host-locale-
dependent — silently passed CI on en-US Linux while failing locally
on a German-locale host). **558/558 tests pass.** No public surface
from prior versions changes shape; all additions are opt-in. Per
the upstream v4.0.0 changelog: TypeScript consumers see no breaking
surface changes across the dalos-crypto v1.2.0 → v4.0.3 jump (the
v4.0.0 major bump was driven entirely by a Go-reference
reorganisation that doesn't affect TS consumers). See
[`CHANGELOG.md`](CHANGELOG.md) for the full v3.1.0 entry.

**`3.0.0`** — **BREAKING** major release closing M3 from the
2026-04-30 audit cycle (F-CORE-007 fabricated-fallback removal +
comprehensive HIGH-risk catalog sweep). This was the FIRST major
bump since **v2.0.0** (2026-05-01) — downstream consumers
(OuronetUI, AncientHolder HUB) MUST update call sites to handle
`null` returns. **16 fabricated-fallback widenings** land across 4
interaction files: 15 functions widen from `Promise<T>` to
`Promise<T | null>` so that consumers see RPC failures instead of
fabricated chain values (`1.0` USD prices, `"0"` balances, sentinel
`"N/A"` strings, fake `false` existence flags), plus 1 mixed-shape
addition for `validateLiquidity` (preserves `valid: boolean` while
adding optional `error?: string` to distinguish RPC failure from
validation rejection). In lockstep, **14 NON-BREAKING logger-routing
additions** across 5 files complete the silent-catch-elimination
sweep started in v2.3.0 — every previously-silent diagnostic catch
in `src/interactions/*` now routes through the
`@ouronet/ouronet-core/observability` `getLogger().error()` seam.
NO public-API removals (NFR-03): all 16 modified functions retain
their names and parameter signatures; only return types widen. See
[`CHANGELOG.md`](CHANGELOG.md) for the full v3.0.0 entry, and the
**Migrating to v3.x** H2 section below for per-cluster `Before:` /
`After:` migration patterns (Option B null-pattern locked decision
per Q3..Q11 of the requirements). The optional **What's new in
v3.0.0** section ships a copy-paste example for adapting to nullable
returns.

Every piece of blockchain logic that used to live in OuronetUI has
landed here: Pact builders, signing pipeline (CodexSigningStrategy +
universalSignTransaction), encryption (V1 + V2 + smartDecrypt), guard
analysis, gas calibration, codex codec, seed-type migration. OuronetUI
is now a pure consumer.

As of the current **v3.1.0** shipping line (originally introduced in
**v1.3.0**, dep range bumped to `^4.0.3` in v3.1.0), OuronetCore
integrates
**[`@ouronet/dalos-crypto@^4.0.3`](https://www.npmjs.com/package/@ouronet/dalos-crypto)**
via the `./dalos` subpath — consumers mint Ouronet accounts locally
(all six DALOS input modes: random, bitmap, bitstring, base-10,
base-49, seed words) without touching the retired
`go.ouronetwork.io/api/generate` endpoint. As of v3.1.0 the `./dalos`
subpath also re-exports the lower-level **Schnorr signature surface**
(`schnorrSign`, `schnorrVerify`, plus browser-friendly
`schnorrSignAsync` / `schnorrVerifyAsync` variants, the typed
`SchnorrSignError` exception, and the `SchnorrSignature` shape type)
for advanced consumers who need direct access without going through
`primitive.sign(...)`.

The per-version paragraphs below are compact deltas; for the full
authoritative per-version detail (Added / Changed / Fixed sections,
finding closures, file-level citations) see
[`CHANGELOG.md`](CHANGELOG.md). The README mirrors the headline only
and points readers at the changelog for the rest.

**v1.4.0** — `AccountSelectorData` now includes `public-key`,
`sovereign`, and `governor` for Smart Ouronet Account display (Σ.
prefix accounts with sovereign + governor authorisation paths).

**v1.5.0** — re-exports `Leto` / `Artemis` / `Apollo` historical-curve
primitives + `createGen1Primitive` factory through the `./dalos`
subpath. NOT registered in `createDefaultRegistry()` — Ouronet stays
Genesis-only; consumers opt in.

**v1.6.0** — Smart Ouronet Account auth-path primitives. `/guard`
gains `classifyGuardKind`, `extractKeysetFromGuard`,
`analyzeSmartAccountAuthPaths` to discriminate the four guard shapes
and resolve the `enforce-one` over (account guard / sovereign /
governor). `buildRotateSovereignPactCode` is the first CFM function
targeting a Smart account's auth path.

**v1.6.1** — every internal `interactions/*` helper now honors the
active failover node (no more `createClient(PACT_URL)` pinned to
node2).

**v1.7.0** — `IKadenaKeypair` consolidated to a single canonical
declaration in `src/signing/types.ts`. The duplicate copies that lived
across `interactions/*` are replaced with `import type` re-exports.
Closes audit finding F-CORE-001 (CRITICAL).

**v2.0.0** — wallet subpath layering restored + `pactRead` injection
seam fully adopted. Closes F-CORE-005 + F-CORE-006 (HIGH). **Two
breaking changes** for consumers — see migration guide below.

**v2.0.1** — documentation/release-process patch. Adds `CHANGELOG.md`
to the npm tarball, auto-creates GitHub Releases on tag push, and
backfills Releases for v1.7.0 and v2.0.0. No runtime change.

**v2.0.2 / v2.0.3 / v2.0.4** — release-pipeline hardening patches. No
runtime change. v2.0.2 added `permissions: contents: write` to
`publish.yml` for the GitHub Releases step. v2.0.3 introduced a
`RELEASE_TOKEN` PAT fallback expression to bypass org-locked
`GITHUB_TOKEN` write permissions. v2.0.4 triggered the workflow with
the secret installed.

**v2.1.0** — reliability hardening release. New `getFailoverClient(chainId, options?)`
factory composes `withFailover` + per-tier timeout into one reusable
surface; all 81 legacy `createClient(getPactUrl(chainId))` invocations
across the 11 interaction files now route through it (primary node
failure on any chain call now triggers automatic fallback retry).
Bounded timeouts on every chain-call tier (read 15s, submit 60s,
listen 180s, pollOne 30s) with `Promise.race` + `AbortController`
defence-in-depth. New `runWithTimeout(operation, fn, timeoutMs)`
helper, new `createTimeoutError(...)` factory returning a
`SigningError { code: "TIMEOUT" }`, new `resetNodeFailover()` export
for test isolation, new `readTimeoutMs?: number` option on
`PactReader` and `rawCalibratedDirtyRead`. MINOR, non-breaking —
existing imports continue to work; the new surface is opt-in.

**v2.1.2** — concurrency-race correction in `withFailover`. PATCH, no
public API change. The retry guard now uses per-invocation captured
base URLs (`attemptedBaseUrl` AND `attemptedPrimaryBaseUrl` captured
at fn-entry as local consts) instead of reading the shared
module-level `currentHost === PRIMARY_HOST` at catch-time. This makes
the catch-block decision robust to concurrent module-state mutation
(sibling `withFailover` flip, mid-flight `setNodeConfig`, mid-flight
`resetNodeFailover`). Closes F-BUG-001. New module-private
`getPrimaryBaseUrl()` helper added to `src/network/nodeFailover.ts`;
not exported.

**v2.2.0** — crypto error-taxonomy + test-coverage hardening release.
MINOR, additive. The `./crypto` subpath gains three typed error
classes — `WrongPasswordError`, `CorruptEnvelopeError`,
`UnsupportedFormatError` — that discriminate decryption failure modes
(closes F-CORE-009). `smartDecrypt` switches to single-path dispatch
via the existing `isEncryptedV2` shape predicate, eliminating the
~1.5s wall-time differential a wrong-password V1 input previously
exhibited (timing-leak fix); the V1 catch path no longer logs to
`console.error` and propagates the original failure via ES2022
`Error.cause`. Existing `instanceof Error` checks and `error.message`
access continue to work — the new typed-class discrimination is
opt-in. Test coverage expands across 4 previously-untested critical
surfaces (closes F-CORE-011, F-CORE-012): four new test files cover
the `pactReader` injection seam (`tests/pact-reader.test.ts`),
`KadenaWalletBuilder` mnemonic dispatch with vendor-vector pinning for
all three seed types (`tests/wallet-builder.test.ts`), every
documented branch of `createSigningError` + `createSimulationError`
(`tests/transaction-errors.test.ts`), and the codex seed-type
migration round-trip (`tests/seed-type-migration.test.ts`). Five
existing test files gain extensions: `tests/encryption.test.ts`,
`tests/encryption-upgrade.test.ts`, `tests/codex-codec.test.ts`,
`tests/cfm-builders.test.ts`, `tests/pact-format.test.ts`. F-CORE-010
(a proposed `pactString` charset/blocklist helper) was reviewed and
explicitly **rejected** — chain-side Pact validation already enforces
identifier rules, so a client-side blocklist would duplicate
authoritative server-side checks and risk silent drift if Pact's
grammar evolves. The decision is logged in `CHANGELOG.md` under a
`### Rejected (decisions log)` section.

**v2.3.0** — medium-and-low audit closures release. MINOR, additive.
Closes 13 audit findings grouped into two milestones: **M1 — 7
MEDIUM tier** (F-CORE-013 codex shape validation; F-CORE-014
foreign-key resolver pre-flight in `CodexSigningStrategy`; F-CORE-015
`safeCreationTime` DRY refactor — 11 inline copies removed across
`src/interactions/*Functions.ts`, all routed through the canonical
declaration in `src/pact/format.ts`; F-CORE-016a tightened
`classifyGuardKind` requiring full minimal shape per kind; F-CORE-016b
new `normalizeKeysetRef` helper at the `resolveGuard` boundary;
F-CORE-016c `SmartAccountAuthPathsAnalysis` JSDoc enumerating 4
reachable states + optional `firstSignableButUnsatisfied` field;
F-CORE-017 typed `UnknownPredicateError` class re-exported from
`./guard` plus `predicateRecognized: false` bit on `analyzeGuard`'s
returned analysis, replacing the previous silent `console.warn`
diagnostic) and **M2 — 6 LOW tier** (F-CORE-018a README header
version table refresh; F-CORE-018b CONTEXT.md interactions section
refresh covering v1.4 / v1.5 / v1.6 additions; F-CORE-019 catch-block
consistency in `ouroFunctions.ts` — all 7 affected catch sites now
route via `getLogger().error(...)` from `../observability`; F-CORE-020
tier-semantics JSDoc on `pactReader.ts` and `rawCalibratedRead.ts`
enumerating the canonical T1=balance / T2=preview / T3=metadata /
T7=very-static mapping; F-CORE-021 dead try/catch wrapping
`getLPTypeInfo`'s `Promise.all` removed (Option A — the
"comment as belt-and-braces" alternative was explicitly rejected);
F-CORE-022 central logger seam at `./observability` with two-file
source layout `src/observability/{index.ts,logger.ts}`, `Logger` type
+ `setLogger` (throws `TypeError("setLogger requires a non-null
Logger")` on null/undefined input) + `getLogger` exports, and a
sweep that reroutes every `console.warn` / `console.error` in `src/`
through the seam — verified by `grep -nE "console\.(warn|error)"
src/` returning ZERO matches outside the seam itself). Two new
public surfaces ship in lockstep: `UnknownPredicateError` on
`./guard` and the `./observability` subpath. All changes additive;
no existing exports change shape.

**v3.0.0** — fabricated-fallbacks-removal release. **BREAKING.**
Closes M3 from the 2026-04-30 audit cycle (lead finding F-CORE-007
HIGH plus the comprehensive ~24-site catalog sweep). First major
bump since v2.0.0. **Phase 1 — critical pricing functions (4
BREAKING widenings):** `getStoaPriceUSD`, `getTokenDecimals`,
`getPoolTotalFee`, `getDPTFMinMove` all widen from `Promise<number>`
to `Promise<number | null>`; the previous `1.0` / `0` / `8`
fabrication sentinels are replaced with `null`, and
`Number.isFinite()` guards catch `NaN` from malformed chain data
(e.g. `parseInt("abc", 10)` or `parseFloat(String(undefined))`).
**Phase 2 — catalog sweep + bonus extras + magic-strings (12
BREAKING widenings):** the 4-function string-balance cluster
(`getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`,
`getVirtualOuro`) widens uniformly to `Promise<string | null>`;
`LPTypeInfo` field types widen to `boolean | null` per inner flag
(Approach A — function return type unchanged; chain-failure-status
returns `false`, catch returns `null`, success returns `true`); the
urStoa trio (`getUrStoaBalance`, `getUrStoaGuard`,
`checkCoinAccountExists`) widens to nullable returns and
`getUrStoaGuard` drops its sentinel `empty` shape; `validateLiquidity`
gains an optional `error?: string` field on its mixed shape (preserves
`valid: boolean` — consumers route a populated `error` to the
network-failure banner and a `valid: false` with no `error` to the
validation-failure message); `getMaxBuyMovieBooster` widens to
`Promise<number | null>`; magic-string sentinels disappear from
`getSWPSpawnLimit` and `getSWPInactiveLimit` (now `Promise<string |
null>` — consumers swap `=== "N/A"` for `=== null`). **Phase 3 —
logger parity (14 NON-BREAKING):** `getLogger().error("Error in
<funcName>:", error)` routing lands in 14 previously-silent catches
across 5 files (`dexFunctions.ts`, `ouroFunctions.ts`,
`activateFunctions.ts`, `infoOneFunctions.ts`, and the
`urStoaFunctions.ts` private helpers `verifyEd25519Sig` +
`describeKeyset`) — completes the silent-catch elimination sweep
started in v2.3.0. NO public-API removals (NFR-03): all 16 modified
functions keep their names + parameter signatures; only return types
widen. See the new **Migrating to v3.x** H2 section below for
per-cluster `Before:` / `After:` migration patterns and the locked
Option B / Approach A / mixed-shape / 3-state-preservation /
magic-string-removal decisions (Q3..Q11) embedded verbatim.

**v3.1.0** — dalos-crypto v4.0.3 integration + Schnorr surface
re-exports + locale-determinism fix. **MINOR, additive.** Bumps the
`@ouronet/dalos-crypto` dep from `^1.2.0` to `^4.0.3` (per the
upstream v4.0.0 changelog: TypeScript consumers see no breaking
surface changes across the v1.2.0 → v4.0.3 jump — the v4.0.0 major
bump was driven entirely by a Go-reference reorganisation, not the
TS port). The `./dalos` subpath gains direct re-exports of the
**Schnorr signature surface** for advanced consumers:
`schnorrSign` / `schnorrVerify` for synchronous use; the
browser-friendly `schnorrSignAsync` / `schnorrVerifyAsync` async
variants that yield to the event loop on a fixed data-independent
cadence (the upstream package's REQ-14 yield-count constant-time
test verifies the cadence is data-independent and constant-time);
the typed `SchnorrSignError` exception class for `instanceof` catch
blocks; and the `SchnorrSignature` shape type for parameter typing.
The high-level `primitive.sign(keyPair, message)` path through the
registry is unchanged (it has always been Schnorr internally for
DalosGenesis); the new direct-access surface is opt-in and exists
mainly so OuronetUI's browser path can use the `*Async` variants to
keep INP under the 200 ms budget during signing. Also fixes
`formatMaxFee` in `./gas` to pin its `toLocaleString()` call to
`'en-US'` so the ANU thousands separator is `,` on every host (was
host-locale-dependent — silently passed CI on en-US Linux while
failing locally on a German-locale host); the test suite was already
pinning the en-US shape, so this restores cross-host parity. NO
public-API removals or shape changes; all changes additive. See the
v3.1.0 **CHANGELOG.md** entry for the full per-symbol export list,
the audit-trail of the 18 dalos-crypto symbols verified
shape-compatible at upgrade time, and the verification-gate results
(typecheck + 558/558 tests + build all green).

**v3.1.1** — pre-publish audit-cycle close-out for the v3.1.0
dalos-crypto integration. **PATCH, additive.** Closes 5 audit
findings the post-v3.1.0-integration audit (2026-05-05) flagged
against commit `bf10dc1` before that commit reached npm: 3 typed
validation-error class re-exports added to `./dalos`
(`InvalidBitStringError`, `InvalidBitmapError`,
`InvalidPrivateKeyError` — close F-BUG-005 by completing the
`instanceof`-discrimination surface); 1 type-only re-export added
(`CoordAffine` — closes F-API-024 by restoring the "single
integration surface" promise for `SchnorrSignature.r`); 1
stylistic alignment (`src/dalos/{index,account}.ts` converted
from single quotes + `.js` extensions to the codebase's standard
double quotes + bare relative imports — closes F-ARCH-012); 1
test-strictness fix (`tests/gas.test.ts` `formatMaxFee` assertion
tightened from `toMatch(/10,000,000/)` substring regex to strict
`toBe("10,000,000")` — closes F-TEST-001 so the v3.1.0
locale-determinism contract is actually locked); and 1 fresh
test block (`tests/dalos-integration.test.ts` gains coverage for
the v3.1.0 Schnorr re-exports — closes F-TEST-004 with 5
new it-blocks covering sign/verify round-trip, async variants,
`SchnorrSignError` class identity, and `SchnorrSignature` /
`CoordAffine` type-import compile probes). v3.1.0 was committed
locally (`bf10dc1`) but never pushed to npm, so the npm registry
goes from `3.0.0` straight to `3.1.1` with v3.1.0 visible only in
the GitHub commit history. **565/565 tests pass** (was 558 in
v3.1.0; +7 = 1 new strict locale grouping-style sibling
assertion + 5 new Schnorr re-export it-blocks + 1 new
validation-error class probe).

**v3.2.0** — number-hygiene infrastructure for the v3.2.x
audit-cycle close-out track. **MINOR, additive.** First wave of the
v3.2.x sequence (v3.2.0 = infrastructure / v3.2.1 = apply at call
sites / v3.2.2 = delete dead multi-step add liquidity / v3.2.3 =
targeted bug fixes). v3.2.0 lands three additive surfaces in the
`./pact` subpath: (1) `formatDecimalForPact` now accepts a single
comma as decimal separator and normalises it to a period before
validation, so European-locale UI inputs (`"1,5"`, `"0,9"`,
`"1234,567890"`) work without upstream normalisation; multi-comma
strings (`"1,234,567"` thousand-separator-style) and mixed
period+comma strings (`"1,5.6"`, `"1.234,56"`) still throw because
they are ambiguous. (2) New `formatIntegerForPact(amount: string):
ValidatedInteger` sibling helper for integer-typed Pact arguments
— Pact distinguishes integers from decimals at the lexer level
(`integer` cap-args reject `1.0`, accept `1`); the new helper
validates `^\d+$` and returns the trimmed input verbatim with no
float round-trip, so 100-digit integer strings round-trip
byte-identical (versus `Number(big)` which collapses past
`Number.MAX_SAFE_INTEGER` ≈ `9.0e15`). (3) Two new branded
TypeScript types `ValidatedDecimal` and `ValidatedInteger` (zero
runtime cost — just `unique symbol` brands on `string`) flow out
of the formatters; functions declared `(amount: ValidatedDecimal)
=> Transaction` cannot accidentally accept raw user input, and the
two brands are distinct types so the lexer-level int-vs-decimal
distinction is enforced at the function-boundary level. The
file-level JSDoc in `src/pact/format.ts` now spells out the
three-rule number-hygiene contract: strings in, strings out, never
round-trip through float64. NO consumer-visible behaviour change
— every previously-valid input produces byte-identical output;
the new surface is opt-in. v3.2.1 will adopt the new helpers at
the existing `parseFloat(...).toFixed(N)` and raw `${amount}`
interpolation sites to close the F-SEC-001 / F-BUG-003
precision-loss vectors that the 2026-05-05 audit flagged.

**v3.2.1** — applies the v3.2.0 number-hygiene helpers at the four
chain-call sites flagged by the 2026-05-05 audit. **MINOR,
behaviour change.** Closes **F-SEC-001** (Pact-code injection vector
in urStoa stake/unstake's raw `${amount}` interpolation) and
**F-BUG-003** (`parseFloat(amount).toFixed(N)` silent precision loss
in `buildCrossChainTransfer:92` and `executeNativeUrStoaTransfer:206`,
plus silent rounding `1.9999 → 2.000` in the urStoa transfer path).
All four sites now route through `formatDecimalForPact(amount)`:
malformed input throws synchronously before any chain interaction
begins (counting-stub `PactReader` test proves the reader is never
invoked when the amount is malformed — validation is at the function
boundary, not deeper); arbitrary-precision decimals round-trip
byte-identical (39-digit integer amounts and 18-digit-fractional
decimals that pre-v3.2.1's float-based formatters would have
truncated or scientific-notation-mangled now reach the chain
intact); EU-locale comma input is auto-normalised to period (per
v3.2.0's relaxed input contract); and the urStoa stake/unstake
cap-args now reuse the **same** validated string as the pact-code
interpolation, so the `coin.URV|STAKE` / `coin.URV|UNSTAKE` cap-arg
and the executed `coin.C_URV|Stake` / `coin.C_URV|Unstake` decimal
literal are guaranteed to agree (was `String(numAmount)` separately
which had the float-precision drift). The `numAmount: number` field
on `StakeUrStoaParams` and `UnstakeUrStoaParams` is **deprecated** in
v3.2.1 (still accepted on the interfaces for v3.x backwards
compatibility, no longer read by the executors; will be removed in
v4.0.0). 8 new it-blocks in `tests/interactions-decimal-validation.test.ts`
pin the contract: synchronous throw on malformed input, pact-code
contains comma-normalised value, high-precision and 39-digit-int
amounts preserved past pre-v3.2.1's truncation point, reader-stub
proves fail-fast at function entry. NO consumer-side migration
required for callers passing well-formed decimal strings; consumers
that previously relied on silent `"NaN"` interpolation or
silent-rounding need to wrap calls in try/catch (the throw is the
audit-mandated improvement).

**v3.2.2** — removes the dead multi-step add-liquidity surface from
`src/interactions/addLiquidityFunctions.ts`. **MINOR, public API
removal.** Closes **F-ERR-005**, **F-ERR-014**, **F-PERF-014**,
**F-PERF-015**, and **F-API-026** — five audit findings
simultaneously, all by removal rather than fix. The historical
multi-step pipeline existed because Kadena chainweb's 150k-per-block
gas limit couldn't fit a single-block add-liquidity transaction;
StoaChain runs at 2M gas per block (13×), which fits the entire
flow in one transaction. OuronetUI hasn't called the multi-step
path since the gas-limit increase, and no test in this package's
suite exercised it — both signals that the four exported
`executeAddLiquidityMultiStep*` functions plus their
`MultiStepAddLiquidityResult` return type plus the unused
`_strategy` parameter on `executeAddLiquidity` were dead public
surface carrying real correctness risk (F-ERR-005's
`.includes(...)` crash on non-Error throws; F-ERR-014's
listen-timeout-vs-submit-failure conflation that could cause user
double-pay; F-PERF-014's 4× hardcoded 3-second sleeps adding ~6s
to every successful flow; F-PERF-015's retry loops against
string-matched `error.message`). Net code change: **−338 lines**
(1031 → 693 in `addLiquidityFunctions.ts`). The Pact-side defpact
contract (`TS01-CP.SWP|C_AddStandardLiquidity` with continuation
steps) is still on chain for historical interoperability;
consumers with unusual need can still invoke it via
`@kadena/client`'s low-level `Pact.builder.continuation()` API.
Migration: callers of `executeAddLiquidityMultiStep*` should
switch to `executeAddLiquidity(params)`, same `AddLiquidityParams`
shape, single-step path. Callers passing `_strategy` to
`executeAddLiquidity` should drop the second argument (the
function's behaviour is identical — it always called the
single-step path anyway). Strict-semver-wise the removal is
breaking and would justify a MAJOR bump; classified MINOR for
v3.2.2 because the removed surface had no known consumer
(verified via repo-wide grep + user confirmation).

**v3.2.3** — final wave of the v3.2.x audit-cycle close-out track.
**MINOR, behaviour change.** Four targeted bug fixes closing the
highest-user-impact remaining findings: **F-BUG-002** added
`creationTime: safeCreationTime()` to `buildCrossChainTransfer`
setMeta (the lone interactions/* builder that omitted the helper
post v2.3.0's DRY sweep, causing sporadic chain-side rejections
under client-clock drift); **F-BUG-004** rewrote `fetchSpvProof` to
wrap in `withFailover` + 30-second `AbortSignal.timeout()` —
pre-v3.2.3 this was the only chain-RPC function calling raw
`fetch()` without either guard, with the consequence that a wedged
primary node hung cross-chain transfers indefinitely with the
user's KDA committed to `kadena-xchain-gas` escrow on the source
chain and no recovery path (the highest-impact bug surfaced by the
2026-05-05 audit); **F-SEC-002** added URL parse + `https:` scheme
allow-list to `setNodeConfig`'s custom-URL path — pre-v3.2.3 it
accepted any truthy string and assigned it to `PRIMARY_HOST`,
allowing an attacker-controlled custom-node setting to redirect
every signed transaction (now throws `TypeError` on missing,
unparseable, or non-https customUrl, with the parsed origin only
stored to discard pathname/query/fragment); **F-ERR-001** added
`@throws` JSDoc to the three `crossChainFunctions` submit/listen
helpers — documentation-only, no runtime change, but the
`listenForCompletion` JSDoc now explicitly calls out that a
TIMEOUT must be treated as `pending` (poll via
`pollTransactionStatus`) **not** as `failed` (do NOT retry the
submit, which would double-pay gas for a transaction that may
already be confirmed). 17 new it-blocks in
`tests/v3-2-3-bug-fixes.test.ts` cover all four fixes; 2 existing
`tests/network.test.ts` tests updated to reflect the new
`setNodeConfig` throw-on-malformed-input contract.

**v3.2.x sequence completed** — 15 audit findings closed across 4
ship cycles (v3.2.0 infrastructure / v3.2.1 apply-formatters /
v3.2.2 delete-multi-step / v3.2.3 targeted-bug-fixes). Combined
with v3.1.1's 5 audit-cycle gaps, the v3.x line has remediated
**20 audit findings** total. The remaining ~47 confirmed findings
are scheduled for v3.3.x (logger-seam completion + test coverage
+ documentation cleanups) and v4.0.0 (structural decomposition +
monorepo split into `@stoachain/stoa-core` + `@ouronet/ouronet-core`
+ type consolidation + `readonly` on public types + nullable
widening for the 10 swap functions).

**v3.3.0** — Logger seam completion. **MINOR, additive + behaviour
change.** First release in the v3.3.x cleanup track. Closes the
consolidated **F-LOGGER-SEAM-001** finding (9 distinct source sites
flagged by 8 of 8 audit agents — the highest-redundancy finding in
the entire 2026-05-05 audit). v3.2.2's `executeAddLiquidityMultiStepComplete`
deletion already removed 2 of the 9 sites by removal; v3.3.0 closes
the remaining 7 — `transactionErrors.ts:252-261` (3 calls in
`logDetailedError`), `nodeFailover.ts:61` (primary-recovery
announcement), `infoOneFunctions.ts:599-600` (debug-leak in remove-
liquidity preview), `ouroFunctions.ts:1590,1595` (Coil preview
failure path + success-path data dump), and `urStoaFunctions.ts:348`
(signature-pruning announcement). 4 of those 7 are routed through
the seam (`getLogger().info` for ops events, `getLogger().warn` for
unusual operational events worth structured-log capture, folded
into existing `getLogger().error` calls where grouping framing was
the only thing using `console.group`); 3 are deleted as
debug-leak (the `console.log` calls flagged by the audit as
"left-over dev instrumentation" with no operational value beyond
developer trace). The `Logger` interface gains an `info(msg,
...args): void` channel — the missing surface that caused 4 of
the 7 seam violations (the seam previously exposed only `warn` and
`error`, so `info`-class events fell through to raw `console.info`
that bypassed consumer-supplied loggers). v3.3.0's `setLogger`
accepts BOTH the v3.2.x 2-method input shape (`{warn, error}` —
synthesised wrapper fills in `info` from default `console.info`
routing) AND the v3.3.0 3-method input shape (`{warn, error, info}`
— reference identity preserved). Backwards-compat is automatic;
v3.2.x consumers see no behaviour change unless they were emitting
to one of the seven raw-console sites that no longer exist. New
regression-lock test in `tests/v3-3-0-logger-seam-completion.test.ts`
scans the entire `src/` tree on every run and fails on any future
commit that re-introduces a raw `console.*` call (filters out
JSDoc/comments + the seam's own intentional default-logger
implementation in `observability/logger.ts`). The audit's
consolidated finding becomes a permanent invariant rather than a
one-time cleanup. NO breaking changes: every previously-valid
consumer call shape continues to work; new surface is opt-in.

**v3.3.x trajectory ahead:** test coverage completion (F-TEST-002
adding `tests/universal-sign.test.ts` for the chainweaver/
eckowallet/foreign branches; F-TEST-005 adding success-path tests
for the 13 v3.0.0 nullable-widened functions; F-TEST-006 adding
behavioural tests for `pensionFunctions`/`guardFunctions`/
`infoOneFunctions`); various documentation cleanups (deprecate
`KADENA_BASE_URL`, fix `CreateAccountOptions` JSDoc, etc.).
v4.0.0 is the major structural release (monorepo split into
`@stoachain/stoa-core` + `@ouronet/ouronet-core`, god-file
decomposition, type consolidation, `readonly` modifiers across
the public type surface).

**v4.1.1** — audit-closure patch. **PATCH (atomic with `@stoachain/stoa-core@4.1.1` + `@stoachain/kadena-stoic-legacy@4.1.1`).** Closes 7 STILL-OPEN audit findings: F-ERR-022 (fabricated `"0"` fallbacks in `kadenaFunctions.ts` lines 16+27 dropped — `getBalance` and `accountDescription` now throw a typed `KadenaShapeError` (extends Error with ES2022 `cause`) on shape-mismatched RPC envelopes; legitimate fallbacks at lines 28-29 preserved), F-API-005 (`getSublimateInfo` dedup — duplicate body removed from `ouroFunctions.ts:2148` and replaced with a `@deprecated` JSDoc compat shim that adapts the legacy signature; canonical at `infoOneFunctions.ts:179`; shim removed in v4.2.0), F-API-006 (`describeKeyset` dedup with `describeKeysetOrNull` adapter helper that preserves the two behaviors the canonical does NOT have: `pred ?? "keys-all"` coercion + map-keys-not-array-to-null), F-API-007 (byte-identical `EncryptedDataV1` collapsed into a re-export of `EncryptedData` from `crypto/v1` in stoa-core), F-SEC-007 (codex strict-shape — `deserializeCodex` rejects envelopes with unknown top-level fields against KNOWN_TOP_LEVEL_FIELDS = {version, exportedAt, kadenaWallets, ouronetWallets, addressBook, uiSettings} via new `CodexUnknownFieldError`), F-BUG-010 (`migrateSeedType` no longer silently returns `"koala"` for unknown seed types — throws new `UnknownSeedTypeError` instead), F-API-014 (`getSparksBalance` return type narrowed from `Promise<any>` to `Promise<any | null>`). New file: `src/interactions/errors.ts` (`KadenaShapeError`). New codex/errors.ts contains `CodexUnknownFieldError` + `UnknownSeedTypeError`. Test count: ~330 (was 261; +~69 from 11 new v4-1-1-*.test.ts files: kadena-no-fallbacks, codec-strict-shape, seed-type-strict, seed-type-dedup, sparks-balance-narrow, dist-structure, esm-roundtrip, type-preservation, doc-gates, migration-doc-validity, package-metadata, peer-dep-coverage, full-chain-integration, cross-package-version-pin, publish-workflow-simulation, coil-functions-memoization). NO breaking changes — `getSublimateInfo` deprecation shim preserves backward compatibility for one release. See `MIGRATION-v4.1.md` v4.1.1 appendix at the monorepo root for caller-impact details.

**v4.1.0** — sovereign supply-chain migration. **MINOR (atomic with `@stoachain/stoa-core@4.1.0` + `@stoachain/kadena-stoic-legacy@4.1.0`).** Retargets all 12 internal `@kadena/*` imports in `src/interactions/` to the new sibling subpaths under [`@stoachain/kadena-stoic-legacy`](https://www.npmjs.com/package/@stoachain/kadena-stoic-legacy) — a sovereign vendoring of `@kadena/{client,cryptography-utils,types,hd-wallet}` under StoaChain stewardship, born at v4.1.0 in response to Kadena LLC's dissolution and the resulting unmaintained-upstream supply-chain risk. The three `@kadena/*` peer-dep declarations (`@kadena/client`, `@kadena/cryptography-utils`, `@kadena/types`) are dropped from `package.json`; the peer-dep on `@stoachain/stoa-core` is bumped `4.0.1 → 4.1.0` (atomic-version invariant — all three packages always release at the same version); a new `@stoachain/kadena-stoic-legacy@4.1.0` peer-dep is added. Every `Pact.builder` call site across the 13 `interactions/*` modules rewires under the hood — the public function signatures (`getOuronetKdaDetails`, `getCoilPreviewGeneric`, every interactions function) keep byte-identical shape. Test count: **261** (was 218; +43 from the new `tests/v4-1-0-no-kadena-imports.test.ts` runtime regression-lock that asserts no `@kadena/*` literal appears in any built or source file). Release is atomic — `vX.Y.Z` git tag publishes all three packages simultaneously via `.github/workflows/publish.yml` in dependency order (kadena-stoic-legacy first, stoa-core second, ouronet-core third), each with its own `--provenance` SLSA attestation. **No consumer migration required** for subpath imports — every `interactions/*` and `pact/cfm` surface is unchanged.

**v4.0.1** — cosmetic published-metadata cleanup. **PATCH.** Strips the redundant `devDependencies` block from `package.json`. Pre-v4.0.1 the manifest carried `@stoachain/stoa-core: "*"` (workspace-resolution plumbing — meaningless on a published artifact) plus `@kadena/*` peer/dev duplicates. The npmjs.com page now shows zero `dependencies`, just the canonical `peerDependencies` (the `@kadena/*` set + `@stoachain/stoa-core@4.0.1` exact-pin). Atomic-version invariant: peer-dep on `@stoachain/stoa-core` bumped from `4.0.0` to `4.0.1` (both packages always release at the same version). NO source-code change. NO behaviour change. **218/218 tests pass.** Regression-lock at `tests/package-version.test.ts` updated to assert `4.0.1`.

**v4.0.0** — monorepo split + deprecated-alias removal. **MAJOR,
breaking.** The structural refactor that v3.3.8 set up. The single
`@ouronet/ouronet-core` package was split into two atomic-release
npm packages under the new `StoaChain/stoa-js` GitHub monorepo:
[`@stoachain/stoa-core`](https://www.npmjs.com/package/@stoachain/stoa-core)
(chain-generic foundation — signing, wallet, crypto, network
failover, gas, guard, errors, observability, dalos, reads,
pact-format) + `@ouronet/ouronet-core` (this package — Ouronet
protocol business logic: codex codec, interactions/* function
library, `KADENA_NAMESPACE`, `STOA_AUTONOMIC_*` accounts, cfm Pact
builders). Both packages release atomically out of the monorepo at
the same version — a single `vX.Y.Z` git tag publishes both.
**Breaking removals**: the v3.3.8-deprecated `KADENA_BASE_URL` /
`PACT_URL` / `GAS_STATION` / `NATIVE_TOKEN_VAULT` aliases plus the
duplicate `IKadenaKeypair` interface in
`interactions/ouroFunctions.ts` were removed. Migration: use the
failover-aware `getPactUrl(chainId)` / `getSpvUrl(chainId)` from
`@stoachain/stoa-core/constants`; rename references to the canonical
`STOA_AUTONOMIC_OURONETGASSTATION` / `STOA_AUTONOMIC_LIQUIDPOT` (still
exported from `@ouronet/ouronet-core/constants`); `import type
{ IKadenaKeypair } from "@stoachain/stoa-core/signing"`. Consumers
using only the Ouronet-specific surface (codex, interactions, the
`ouronet-ns` namespace) can keep this package and bump the version.
Consumers using chain-generic surfaces must add `@stoachain/stoa-core`
and update the import paths — see
[`MIGRATION-v4.md`](https://github.com/StoaChain/stoa-js/blob/main/MIGRATION-v4.md)
at the monorepo root for the full upgrade map. **Internal moves**
(transparent if you stayed on subpath imports): chain-generic
constants moved to `@stoachain/stoa-core/constants` (re-exported
through `@ouronet/ouronet-core/constants` for source-level
back-compat); `pact/cfmBuilders.ts` stays under
`@ouronet/ouronet-core/pact` (uses `KADENA_NAMESPACE`); chain-generic
`formatDecimalForPact` / `formatIntegerForPact` / `mayComeWithDeimal`
/ `filterFreePositionData` / `formatEU` / `safeCreationTime` helpers
moved to `@stoachain/stoa-core/pact`. **Dependency hardening**: all
`@kadena/*` + `@noble/curves` + `@scure/bip39` +
`@ouronet/dalos-crypto` peer/dev deps pinned to exact versions (no
`^`) — prep work for v4.1.0's selective vendoring of `@kadena/client`
(supply-chain hardening after Kadena LLC's dissolution). **CI
workflow** rewritten for dual-package publish: a single `vX.Y.Z`
tag now triggers two `npm publish` calls in dependency order
(stoa-core first, ouronet-core second), each with its own
`--provenance` SLSA attestation; per-package version-parity gates
(README + CHANGELOG must reference the publish version on EACH
package independently) preserve the v2.1.x staleness lessons.
**703/703 tests pass** across the two packages (485 in stoa-core,
218 in ouronet-core; up from v3.3.8's 698 because the
F-ARCH-011/F-ARCH-012 v3.3.8 regression locks now live alongside
their stoa-core SUTs — every prior test preserved).

**v3.3.8** — documentation/deprecation cleanup pass closing 5
LOW-severity findings from the 2026-05-05 audit. **MINOR,
additive.** **F-API-015** rewrote a stale JSDoc parameter
mention in `src/dalos/account.ts` (the `strict` flag was never
implemented; new wording documents the actual contract).
**F-API-016** added `export` to the `CoilConfig` interface so
consumers can type-annotate `CoilConfig` values directly
without re-declaring the shape — one-word change, additive,
consumer-facing improvement. **F-SEC-005 / F-ARCH-014** marked
`KADENA_BASE_URL` `@deprecated` redirecting to the
failover-aware `getActivePactUrl` / `getActiveSpvUrl` (or the
same-subpath `getPactUrl` / `getSpvUrl` wrappers); the constant
itself remains for backwards-compat, removal scheduled for
v4.0.0. **F-ARCH-011** consolidated `normalizeKeysetRef`
deep-import in `ouroFunctions.ts` to the `../guard` barrel,
matching the project's subpath-import discipline. **F-ARCH-012**
converted 19 single-quoted string literals to double quotes in
`src/dalos/account.ts` — the only remaining drift after v3.1.1's
fix to `src/dalos/index.ts`; TypeScript treats both forms as
identical string literals at the type level (pure stylistic).
NO breaking change. NO observable runtime behavior change. One
new public-API export (`CoilConfig` interface). Locked at
`tests/v3-3-8-doc-cleanup.test.ts` with 3 it-blocks across 3
describe groups: T1 verifies the `CoilConfig` type export via
`expectTypeOf`; T2 verifies `normalizeKeysetRef` is reachable
through the `../guard` barrel and round-trips a
keysetref-shaped object; T3 reads `src/dalos/account.ts` source
verbatim and asserts no single-quoted string literals remain in
code (English apostrophes inside JSDoc comments are exempt).
F-API-015 (stale JSDoc) and F-SEC-005/F-ARCH-014 (`@deprecated`
marker) are pure JSDoc changes that don't surface at runtime;
the CHANGELOG entry is the audit trail. **+3 new tests**
bringing the suite to **698/698 passing** (was 695 in v3.3.7).

**v3.3.7** — security pass closing two MEDIUM security findings
from the 2026-05-05 audit in one bundled release. **MINOR,
additive.** **F-SEC-003** ships `InvalidPactReaderError` and
`InvalidLoggerError` (both extend `TypeError`) and tightens
`setPactReader` (now rejects non-function inputs with a clear
message naming the actual type) and `setLogger` (now rejects
null / undefined / non-object inputs AND objects whose `warn`
or `error` are non-callable). Pre-v3.3.7 misconfigurations
only surfaced later as `_reader is not a function` /
`_logger.warn is not a function` at the first call site, far
from the boot wiring. **F-SEC-004** wires a one-shot
`getLogger().warn(...)` security advisory into the V1-decrypt
path — V1 envelopes use PBKDF2-SHA256 / 10,000 iterations,
well below OWASP's current 600,000 minimum; the warning fires
once per process lifetime (no bulk-decrypt log spam). Adds
new rich variants `decryptStringV2WithDetails` and
`smartDecryptWithDetails` returning `{plaintext, wasLegacyV1}`
for per-call programmatic detection so consumers can re-encrypt
affected codex entries to V2 in-place. JSDoc CVE-style risk
documentation added to `EncryptedDataV1`, `decryptStringV2`,
and `smartDecrypt`. NO breaking change. v3.3.0 contract test
locking the byte-identical `setLogger requires a non-null
Logger` message preserved verbatim. Locked at
`tests/v3-3-7-seam-validators.test.ts` (11 it-blocks across 3
describe groups: setPactReader input validation,
setLogger input-shape validation, setLogger
backwards-compat preservation) and
`tests/v3-3-7-v1-warning.test.ts` (10 it-blocks across 3
describe groups: decryptStringV2WithDetails,
smartDecryptWithDetails, one-shot warning behavior including
the load-bearing "second V1 decrypt is silent" assertion that
proves the bulk-codex-decrypt UX is non-spammy). **+21 new
tests** bringing the suite to **695/695 passing** (was 674 in
v3.3.6).

**v3.3.6** — performance pass closing three MEDIUM perf findings
from the 2026-05-05 audit in one release. **MINOR, additive.**
**F-PERF-008** added `"sideEffects": false` to `package.json` —
the audit's "single most impactful tree-shaking fix"; verified
safe via grep showing zero top-level callable statements in
`src/` (every seam — `setPactReader`, `setLogger`, `setNodeConfig`
— is consumer-invoked at boot, never at module top-level);
consumer bundles can now prune unused barrel imports from the
16-subpath exports map. **F-PERF-003** memoized 8 `RegExp`
allocations per call in `coilFunctions.getCoilPreviewGeneric`
to a `Map<string, CoilPatternSet>` cache keyed by
`targetTokenName` — patterns are dynamic per token (interpolate
`config.targetToken`) so the audit's literal "hoist to
module-level const" doesn't apply; the cache form achieves the
same outcome with steady-state 0 RegExp allocations per call
after warm-up. **F-PERF-004** parallelized
`ouroFunctions.getOuronetKdaDetails` via `Promise.all([owner,
guard])` — verified independent (probes `DALOS.UR_AccountKadena`
vs `DALOS.UR_AccountGuard` with no causal dependency); halves
happy-path latency from ~2 sequential RPC roundtrips to ~1
parallel roundtrip. NO public API change. NO observable
behavior change outside the latency win and the bundler
tree-shaking pruning. Locked at
`tests/v3-3-6-perf-pass.test.ts` with 2 it-blocks: T1 strict
equality `pkg.sideEffects === false` for F-PERF-008, T2
counting-reader assertion that both `UR_AccountKadena` AND
`UR_AccountGuard` Pact codes appear in the recorded calls for
F-PERF-004. F-PERF-003's regex memoization is module-internal;
behavioral coverage already lives in v3.3.5's
`tests/v3-3-5-smoke.test.ts:117-141` for `getCoilPreviewGeneric`
which passes unchanged. **+2 new tests** bringing the suite to
**674/674 passing** (was 672 in v3.3.5).

**v3.3.5** — runtime smoke tests for 6 interaction modules with
no runtime test coverage prior to this release. **MINOR,
additive (test-only).** Closes audit finding **F-TEST-006**
(MEDIUM, testing-auditor). Three modules had **zero runtime
tests** (`pensionFunctions`, `guardFunctions`,
`infoOneFunctions`); three more had **compile-only tests**
(`coilFunctions`, `kpayFunctions`, `activateFunctions`). v3.3.5
adds `tests/v3-3-5-smoke.test.ts` — **12 new it-blocks across 6
describe groups**, one happy-path + one error-path test per
module: `getHibernateFee` parses `{decimal:"0.99"}` → `0.99` and
catches into local fallback formula on thrown read;
`getRotateGuardInfo` returns success-path data verbatim, `null`
on failure-status; `getCoilPreviewInfo` wraps success data in
`{result: ...}`, returns `null` on failure-status;
`getCoilPreviewGeneric` parses `"generates 5.0 AURYN"` from
`pre-text` regex match, **rethrows** on failure-status (the only
module of the 6 that rethrows); `getKpayData` returns success
data verbatim, `null` on failure-status;
`getDeployStandardAccountInfoOnly` returns success data
verbatim, `null` + `getLogger().error` on thrown read. Read-only
function smoke is sufficient per F-TEST-006's "function actually
executes" assertion; transaction-execute coverage requires
mocking the full `@kadena/client` signing + submit chain and is
queued for v4.0.0's monorepo split. NO source-code change. **+12
new tests** bringing the suite to **672/672 passing** (was 660
in v3.3.4). Closes the v3.3.x audit-closure track —
F-LOGGER-SEAM-001 (v3.3.0), F-TEST-002 (v3.3.2), F-TEST-005
(v3.3.4), F-TEST-006 (v3.3.5) all CLOSED; remaining MEDIUM
findings are performance/architecture, not test coverage.

**v3.3.4** — success-path tests for the 13 v3.0.0 nullable-widened
functions that previously had only RPC-failure-path coverage.
**MINOR, additive (test-only).** Closes audit finding
**F-TEST-005** (MEDIUM, testing-auditor). Pre-v3.3.4, only 3 of
the 16 v3.0.0 widenings had a paired success-path test —
`getStoaPriceUSD`, `getLPTypeInfo` mixed-state, and
`getUrStoaGuard` 3-state. The remaining 13 could not distinguish
"always returns null" (silent regression) from "returns null
only on RPC failure" (correct contract). v3.3.4 adds
`tests/v3-3-4-success-paths.test.ts` — **13 new it-blocks
across 6 describe groups**: pricing-quartet (3 — int/decimal
parse paths for `getTokenDecimals`/`getPoolTotalFee`/`getDPTFMinMove`);
string-balance cluster (4 — `getIgnisBalance` /
`getAccountTokenSupply` / `getOuroDispoCapacity` /
`getVirtualOuro` all unwrap `{decimal:"..."}` to the
underlying string via `mayComeWithDeimal`); urStoa pair (2 —
`getUrStoaBalance` parses `{decimal:"42.5"}` → `42.5`,
`checkCoinAccountExists` (urStoa) returns `true` when chain
data is `true`); `validateLiquidity` mixed-shape success (1 —
chain returns `[{decimal:"0.05"}, {decimal:"0.10"}]` →
function returns `{valid:true, computed:"0.05", max:"0.10"}`
AND `error` is `undefined`, locking the v3.0.0 mutual
exclusion); `getMaxBuyMovieBooster` (1 — `{int:"5000"}` →
`5000`); magic-string elimination (2 — `getSWPSpawnLimit` and
`getSWPInactiveLimit` return the decimal string AND
`expect(out).not.toBe("N/A")` so the v3.0.0 BREAKING swap
cannot regress unnoticed). Strategy mirrors the pre-existing
`tests/interactions-pricing.test.ts:80-88` success-path lock:
`setPactReader(successReader({...}))` → call SUT → assert. NO
source-code change; every interaction function is byte-identical
to v3.3.3. **+13 new tests** bringing the suite to **660/660
passing** (was 647 in v3.3.3).

**v3.3.3** — multi-party partial-signature public surface for
cross-party signing handoffs. **MINOR, additive (NEW PUBLIC
SURFACE — not a bug fix).** Ships the OuronetUI-requested
"Person A signs → exports → Person B imports → signs → exports
→ Person C imports → signs → submits" workflow as shared core,
with cross-party tamper detection at every handoff. Builds on
v3.3.2's locked partial-signing primitive (signing with a subset
of declared signers fills only those slots; pre-existing slots
stay intact across re-signing passes) by wrapping it in a
versioned export envelope + slot-status helpers + Ed25519
sig-verification helper. New `src/signing/partialSig.ts` module
re-exported from `@ouronet/ouronet-core/signing`, exposing
**7 functions** (`signPartial`, `serializePartialTransaction`,
`deserializePartialTransaction`, `getMissingSigners`,
`getFilledSigners`, `isFullySigned`,
`verifyExistingSignatures`), **2 typed errors**
(`InvalidEnvelopeError`, `TamperedHashError`), and the
`PartialSigEnvelope` interface. Two-layer tamper defence: (1)
`deserializePartialTransaction` recomputes blake2b-256(cmd) and
rejects mismatch with `TamperedHashError` carrying both
`expected` and `actual` for operator diagnosability; (2)
`verifyExistingSignatures` runs `nacl.sign.detached.verify` on
every filled slot — works for both nacl-direct (koala/foreign)
and BIP32-WASM (chainweaver/eckowallet) sigs since both produce
standard Ed25519 over the same canonical hash bytes; catches
the "tampered cmd + tampered hash to match" attack the
hash-integrity gate alone misses (any cmd modification
invalidates every prior signature against the new hash). NO
existing API changed; NO source-side behaviour change outside
the new module. **+16 new tests** (`tests/partial-sig.test.ts`
— 16 it-blocks across 7 describe groups including end-to-end
3-party round-trip via serialize/deserialize handoffs), bringing
the suite to **647/647 passing** (was 631 in v3.3.2; +16).

**v3.3.2** — direct test coverage for `universalSignTransaction`
(closes audit finding **F-TEST-002** HIGH). **MINOR, additive
(test-only).** Pre-v3.3.2, the central signing entry point in
`src/signing/universalSign.ts` had ZERO direct tests — the
chainweaver / eckowallet / foreign seedType branches AND the
seedType dispatcher itself were never runtime-tested. v3.3.2 adds
`tests/universal-sign.test.ts` with 9 new it-blocks across 6
describe groups: koala branch round-trip with RFC-8032 vector
(2 tests including the `fromKeypair` adapter that normalises
consumer-shape `privateKey` field into universal `secretKey`);
chainweaver branch round-trip with real WASM `kadenaSign`
derived from the @kadena/hd-wallet vendor mnemonic vector
(1 test); eckowallet branch round-trip proving the dispatcher
routes both labels to the same WASM signing path (1 test);
multi-signer mixed-seedType case proving the
iterate-and-dispatch-each loop's correctness (1 test);
foreign-key `onMissingKey` callback resolution — success path
where the callback returns the matching private key (1 test) +
failure path where the callback returns a mismatched key →
"Key mismatch" error citing both expected and derived pubkeys
(1 test); and the partial-signing primitive that v3.3.3's
planned multi-party signing public surface will build on —
3-signer transaction signed with only 1 keypair fills only
that slot, other slots stay empty (1 test); and keypairs whose
pubkey is NOT in cmd.signers are silently skipped (1 test).
The verification helper uses `nacl.sign.detached.verify` over
the base64URL-decoded `signed.hash` bytes — works for BOTH
the nacl-direct path (koala/foreign) AND the WASM-Ed25519
path (chainweaver/eckowallet) since both produce standard
Ed25519 signatures over the same canonical hash. NO
source-code change; `universalSign.ts` is byte-identical to
v3.3.1.

**v3.3.1** — workflow-file patch. **PATCH, workflow-only.** Closes
the two carried-forward follow-ups that appeared in every
pollinate run's final report from v3.0.0 through v3.3.0: (1) `npm
publish --provenance` flag added (plus the `id-token: write`
workflow permission required to mint the GitHub-Actions-OIDC token
that npm exchanges with npmjs.org's attestation endpoint) — every
v3.3.1+ release carries a SLSA attestation visible as the
"Provenance" badge on npmjs.com and a 200 response on
`https://registry.npmjs.org/-/npm/v1/attestations/@ouronet/ouronet-core@{version}`;
pre-v3.3.1, every release shipped without provenance because
`lifecycle.use_provenance: true` in `.bee/config.json` was
truth-claimed by pollinate but the actual workflow's `npm publish
--access public` lacked the flag. (2) `gh release create`
invocations drop the `--repo` flag — the
`gh release create --notes-from-tag --repo X` flag combination
started failing on GitHub-hosted runners around 2026-04-30 with
the gh-CLI image update; every v3.x release pre-v3.3.1 needed
pollinate's REST-API fallback (Step 9c) to create the GitHub
Release manually. Dropping `--repo` lets gh auto-detect the repo
from the working-directory context (set by `actions/checkout@v4`
at the top of the workflow), which is the same repo we want
anyway. From v3.3.1 onwards the workflow's gh-Release step
succeeds inline; pollinate's REST fallback becomes
idempotency-skip code (Step 9b's "release exists?" check passes,
Step 9c skips). Workflow-only patch — `.github/workflows/publish.yml`
is the sole behaviour-change file; source code is byte-identical
to v3.3.0; **622/622 tests pass unchanged** (workflow files
aren't in the test scope; verification arrives with the v3.3.1
publish run itself).

**698 tests** pass on every commit (up from 695 in v3.3.7; +3
from the new `tests/v3-3-8-doc-cleanup.test.ts` regression-lock
file added in v3.3.8 to close 5 LOW-severity findings from the
2026-05-05 audit — F-API-015 stale JSDoc, F-API-016 export
CoilConfig, F-SEC-005/F-ARCH-014 KADENA_BASE_URL @deprecated
marker, F-ARCH-011 normalizeKeysetRef barrel-import
consolidation, F-ARCH-012 dalos/account.ts quote-style cleanup.
With v3.3.8 the v3.3.x audit-closure track now spans testing
AND performance AND security-input-validation AND
documentation/deprecation categories; remaining items are
either reserved for v4.0.0 (arch + sleep-replacement) or
NEEDS CONTEXT findings flagged for human review.
Dependency-hygiene release planned for v3.3.9 / v3.4.0. Published to the public npmjs registry via
`.github/workflows/publish.yml` on every `v*` tag (which also
creates a GitHub Release). Published to the public
npmjs registry via `.github/workflows/publish.yml` on every `v*`
tag (which also creates a GitHub Release).

```bash
npm install @ouronet/ouronet-core
```

## What's new in v2.1.0

The chain-RPC surface used to be 81 ad-hoc `createClient(getPactUrl(chainId))`
calls scattered across 11 interaction files, each pinned to whatever
URL `getPactUrl` returned at the moment of construction and each with
no timeout. v2.1.0 collapses that into one reusable factory:

```ts
import { getFailoverClient } from "@ouronet/ouronet-core/network";

// All four standard chain operations, each wrapped in withFailover +
// per-tier timeout. The factory's submit captures the same signed-tx
// reference across primary + fallback attempts (REQ-01 dedup contract).
const { dirtyRead, submit, listen, pollOne } = getFailoverClient(chainId);

const txDescriptor = await submit(signedTx);          // 60s default, auto-failover
const result        = await listen(txDescriptor);     // 180s default (~6 Kadena blocks), auto-failover
```

### Timeouts

Per-tier defaults: **read 15s**, **submit 60s**, **listen 180s**
(~6 Kadena blocks for inclusion long-polling), **pollOne 30s**.
Two-tier override precedence — per-call wins over factory-time wins
over locked default:

```ts
// Factory-time override
const client = getFailoverClient(chainId, { submitTimeoutMs: 30_000 });

// Per-call override
await client.submit(signedTx, { submitTimeoutMs: 5_000 });
```

A primary-side timeout rejects with `Error.name === "AbortError"`
inside `withFailover`, which classifier-matches the existing fallback
contract — so a primary timeout transparently triggers the fallback
retry. Only if **both** primary and fallback time out does the consumer
see a `SigningError { code: "TIMEOUT" }` surfaced via the factory's
outer-boundary catch.

### Lower-level helpers

For the codex signing strategy seam (where failover is intentionally
the consumer's `PactClient` responsibility), v2.1.0 also exports a
plain timeout helper:

```ts
import { runWithTimeout } from "@ouronet/ouronet-core/network";

await runWithTimeout("operation-name", (controller) =>
  fetch("https://...", { signal: controller.signal }), 15_000);
// Rejects with Error.name === "AbortError" on timeout. Caller is
// responsible for converting to SigningError { code: "TIMEOUT" }.
```

Plus `createTimeoutError(operation, timeoutMs, originalError?, additionalContext?)`
from `@ouronet/ouronet-core/errors` for that conversion, and
`resetNodeFailover()` from `@ouronet/ouronet-core/network` for test
isolation.

### Migration

**No migration required.** All existing imports continue to work
unchanged. The new surface is purely opt-in. Internal calls have
already been migrated — your existing reads and submits now get
failover and timeouts automatically.

## What's new in v2.2.0

The `./crypto` subpath previously surfaced every decryption failure as
a generic `Error` — wrong password, structurally damaged envelope, and
unsupported schema version all collapsed to a string-message check.
v2.2.0 adds three typed error classes that discriminate the failure
modes, plus a single-path `smartDecrypt` dispatch that closes a
wall-time timing differential observed on V1 wrong-password inputs:

```ts
import {
  smartDecrypt,
  WrongPasswordError,
  CorruptEnvelopeError,
} from "@ouronet/ouronet-core/crypto";

try {
  const plaintext = await smartDecrypt(blob, password);
} catch (err) {
  if (err instanceof WrongPasswordError) {
    // most common case — show "wrong password" UI
  } else if (err instanceof CorruptEnvelopeError) {
    // blob is structurally damaged — recovery / re-import path
  } else {
    // unexpected (UnsupportedFormatError, or anything else) — log and
    // surface to user as a generic decrypt failure
    throw err;
  }
}
```

Existing consumers that only check `instanceof Error` or read
`error.message` continue to work unchanged — the typed classes extend
`Error`, so the new discrimination is purely opt-in.

## What's new in v2.3.0

The v2.3.0 audit-closure release introduces a central logger seam at
`@ouronet/ouronet-core/observability` mirroring the existing
`setPactReader` injection-seam pattern. Every diagnostic
`console.warn` / `console.error` call inside `src/` now routes through
this seam, so consumers can capture, redirect, or suppress library
log events without monkey-patching the global `console`:

```ts
import { setLogger, getLogger, type Logger } from "@ouronet/ouronet-core/observability";

// Option 1: Forward to your existing app logger (Pino, Winston, Sentry, …).
const myLogger: Logger = {
  warn: (msg, ...args) => myApp.warn(msg, args),
  error: (msg, ...args) => myApp.error(msg, args),
};
setLogger(myLogger);

// Option 2: Capture for telemetry without losing console output.
const original = getLogger();
setLogger({
  warn: (msg, ...args) => { telemetry.warn(msg, args); original.warn(msg, ...args); },
  error: (msg, ...args) => { telemetry.error(msg, args); original.error(msg, ...args); },
});

// Or do nothing — the default routes to console.warn / console.error so
// existing v2.2.x behavior is preserved exactly.
```

The mutator rejects null/undefined input with a clear `TypeError`:

```ts
setLogger(null);
// throws TypeError: setLogger requires a non-null Logger
```

The companion addition is a typed `UnknownPredicateError` class
re-exported from the `./guard` subpath. `computeThreshold` throws it
when it encounters an unrecognized predicate; the general-purpose
`analyzeGuard` catches it and folds it into a structured
`predicateRecognized: false` bit on the returned analysis. Consumers
that want to discriminate this failure mode can branch on the typed
class:

```ts
import { computeThreshold, UnknownPredicateError } from "@ouronet/ouronet-core/guard";

try {
  const threshold = computeThreshold(guard);
} catch (err) {
  if (err instanceof UnknownPredicateError) {
    // Surface a recognizable "unknown predicate" diagnostic to the user.
  } else {
    throw err;
  }
}
```

Existing `instanceof Error` checks and existing analysis-flag access
continue to work unchanged — the typed-class discrimination from
`./guard` and the logger-seam injection from `./observability` are
both purely opt-in.

## What's new in v3.0.0

The v3.0.0 fabricated-fallbacks-removal release closes M3 from the
2026-04-30 audit cycle (lead finding F-CORE-007 HIGH plus the
~24-site catalog sweep). The headline change is uniform: every
`src/interactions/*` read helper that previously fabricated a chain
value on RPC failure (`1.0` USD prices, `"0"` balances, sentinel
`"N/A"` strings, fake `false` existence flags) now returns `null`
on failure so consumers can distinguish "RPC failed" from "chain
returned this real value." Sixteen functions widen their return
types in lockstep; consumers add `if (result === null) { ... }`
branches at call sites:

```ts
import { getStoaPriceUSD } from "@ouronet/ouronet-core/interactions/ouroFunctions";

// v3.0.0 — null on RPC failure / chain failure / non-finite parse,
// real number on success.
const price = await getStoaPriceUSD();

if (price === null) {
  // RPC failed or chain returned malformed data — show an error
  // banner instead of computing positions against a fabricated 1.0.
  showRPCErrorBanner("Could not fetch STOA/USD price");
  return;
}

// price is a real Number.isFinite(...) value — safe to use.
renderPriceLabel(`$${price.toFixed(4)}`);
```

`getLPTypeInfo` keeps its function-level return type but widens its
inner field types so consumers can render mixed UI per flag (Frozen
LP succeeded, Sleeping LP RPC-failed):

```ts
import { getLPTypeInfo } from "@ouronet/ouronet-core/interactions/addLiquidityFunctions";

const info = await getLPTypeInfo(swpair); // { hasFrozenLP, hasSleepingLP }

// Three states per flag now: true (chain confirmed exists),
// false (chain confirmed absent OR chain failure-status), null (catch).
if (info.hasFrozenLP === null) {
  renderFrozenSection({ status: "rpc-error" });
} else {
  renderFrozenSection({ status: info.hasFrozenLP ? "present" : "absent" });
}

if (info.hasSleepingLP === null) {
  renderSleepingSection({ status: "rpc-error" });
} else {
  renderSleepingSection({ status: info.hasSleepingLP ? "present" : "absent" });
}
```

In lockstep, **14 NON-BREAKING logger-routing additions** across 5
files complete the silent-catch-elimination sweep started in v2.3.0
— previously-silent diagnostic catches in `dexFunctions.ts`,
`ouroFunctions.ts`, `activateFunctions.ts`, `infoOneFunctions.ts`,
and `urStoaFunctions.ts` private helpers now route via
`getLogger().error("Error in <funcName>:", error)`. Consumers who
called `setLogger(...)` (introduced in v2.3.0) automatically capture
these new error events with no additional wiring.

## Migrating to v3.x

v3.0.0 is the first major bump since v2.0.0 and the deliberate
forcing function for **Option B null-pattern** (locked Q3..Q11):
sixteen `src/interactions/*` read helpers that previously fabricated
chain values on RPC failure now widen their return types so consumers
see RPC failures instead of silently fabricated sentinels (`1.0` USD
prices, `"0"` balances, sentinel `"N/A"` strings, fake `false`
existence flags). Fifteen functions widen from `Promise<T>` to
`Promise<T | null>`; one (`validateLiquidity`) adds an optional
`error?: string` field on its mixed shape to distinguish "RPC failed"
from "validation rejected" without dropping the existing `valid:
boolean` contract.

Every breaking change below stems from the **Option B null-pattern**
locked decision per the 2026-04-30 audit cycle: callers add `if
(result === null) { showRPCErrorBanner(); return; }` branches before
reading the previously-fabricated value. The 14 NON-BREAKING
logger-routing additions across 5 files (Phase 3) require **NO
consumer migration** — they are pure observability and existing call
sites continue to work unchanged.

### 1. Pricing-quartet — `Promise<number>` → `Promise<number | null>`

`getStoaPriceUSD`, `getTokenDecimals`, `getPoolTotalFee`, and
`getDPTFMinMove` (REQ-01..REQ-04) all widen to `Promise<number |
null>`. The previous `1.0` / `0` / `8` fabrication sentinels are
replaced with `null`, and `Number.isFinite()` guards catch `NaN`
from malformed chain data (e.g. `parseInt("abc", 10)` or
`parseFloat(String(undefined))`). All three failure paths — outer
catch (network failure), `status !== "success"` branch (chain
failure), and success-but-not-finite branch — now return `null`.

These are transaction-relevant amounts: silently fabricating `1.0`
for a missing USD price would have produced wildly wrong position
values; silently returning `8` for missing token decimals would have
produced off-by-many-orders-of-magnitude amounts. The **Option B
null-pattern** locked decision makes this failure mode explicit at
the call site.

```ts
// Before (v2.x):
const price = await getStoaPriceUSD();          // number — could be fabricated 1.0
const decimals = await getTokenDecimals(token); // number — could be fabricated 8
renderPosition(price * amount, decimals);

// After (v3.x):
const price = await getStoaPriceUSD();
const decimals = await getTokenDecimals(token);
if (price === null || decimals === null) {
  showRPCErrorBanner("Could not fetch pricing data");
  return;
}
renderPosition(price * amount, decimals);
```

### 2. String-balance cluster — `Promise<string>` → `Promise<string | null>`

`getIgnisBalance`, `getAccountTokenSupply`, `getOuroDispoCapacity`,
and `getVirtualOuro` (REQ-05) all widen to `Promise<string | null>`
as a tightly-coupled cluster — both `return "0"` sentinels in each
function become `return null`. Per the locked decision, "changing
only some risks a UI where some buttons silently misbehave on RPC
failure while others now correctly disable" — these four functions
move together so consumer-side balance-display UI can branch
uniformly on `null`.

Existing v2.3.0 logger routing is preserved; only the type and
sentinel change. Catch paths still route via `getLogger().error()`.

```ts
// Before (v2.x):
const balance = await getIgnisBalance(account); // string — could be fabricated "0"
showBalance(formatToken(balance));

// After (v3.x):
const balance = await getIgnisBalance(account);
if (balance === null) {
  showBalanceUnknown(); // Distinguish RPC failure from a real "0" balance
  return;
}
showBalance(formatToken(balance));
```

### 3. `getLPTypeInfo` field widening (Approach A — function return type unchanged)

`getLPTypeInfo` (REQ-06) widens its inner field types from `{
hasFrozenLP: boolean; hasSleepingLP: boolean }` to `{ hasFrozenLP:
boolean | null; hasSleepingLP: boolean | null }`. Per the locked
**Approach A** decision, the **function-level return type is
UNCHANGED** — only the inner field types widen. Consumers can render
granular per-flag mixed UI (e.g. Frozen LP succeeded but Sleeping LP
RPC-failed). Approach B (function-level null) was rejected because
it loses granularity; Approach C (separate error channel) was
rejected because it is non-breaking and defeats the audit purpose.

Per the Phase 2 P-001 fix, **3-state preservation** is the locked
contract for each flag: chain-failure-status (`response.result.status
!== "success"`) returns `false`, the inner IIFE catch returns `null`,
and a successful chain read returns `true`. Both inner catches route
via `getLogger().error("Error checking Frozen LP:", error)` and
`("Error checking Sleeping LP:", error)`.

```ts
// Before (v2.x):
const info = await getLPTypeInfo(swpair);
// { hasFrozenLP: boolean; hasSleepingLP: boolean }
if (info.hasFrozenLP) renderFrozen();
if (info.hasSleepingLP) renderSleeping();

// After (v3.x):
const info = await getLPTypeInfo(swpair);
// { hasFrozenLP: boolean | null; hasSleepingLP: boolean | null }
if (info.hasFrozenLP === null) renderFrozenRpcError();
else if (info.hasFrozenLP) renderFrozen();
else renderFrozenAbsent();

if (info.hasSleepingLP === null) renderSleepingRpcError();
else if (info.hasSleepingLP) renderSleeping();
else renderSleepingAbsent();
```

### 4. urStoa trio — `Promise<T>` → `Promise<T | null>`

`getUrStoaBalance`, `getUrStoaGuard`, and `checkCoinAccountExists`
(urStoa) (REQ-07) all widen to nullable returns as a tightly-coupled
trio. `getUrStoaBalance` widens `Promise<number>` → `Promise<number
| null>` (both `return 0` sites become `return null`).
`getUrStoaGuard` widens `Promise<UrStoaGuardResult>` →
`Promise<UrStoaGuardResult | null>` and **drops the sentinel** `empty
= { exists: false, isKeyset: false, keys: [], pred: "" }` value;
`null` now means RPC failed, while a real `UrStoaGuardResult` means
the chain answered. **3-state preservation** in `getUrStoaGuard` is
the locked contract: `null` (RPC failed), `{ exists: false, ... }`
(chain confirmed no guard), `{ exists: true, ... }` (chain returned a
real guard). `checkCoinAccountExists` widens `Promise<boolean>` →
`Promise<boolean | null>` and gains `getLogger().error("Error in
checkCoinAccountExists (urStoa):", error)` routing (was silent); JSDoc
gains a cross-reference to the `ouroFunctions.ts:2088` sibling that
already has the same nullable-boolean shape.

```ts
// Before (v2.x):
const guard = await getUrStoaGuard(account);
// guard is always present; "empty" sentinel masks RPC failure
if (!guard.exists) renderCreateGuardForm();
else renderEditGuardForm(guard);

// After (v3.x):
const guard = await getUrStoaGuard(account);
if (guard === null) showRPCError();           // RPC failed
else if (!guard.exists) renderCreateGuardForm(); // chain confirmed no guard
else renderEditGuardForm(guard);              // chain returned a real guard
```

### 5. `validateLiquidity` mixed-shape addition

`validateLiquidity` (REQ-08) **preserves** its existing `valid:
boolean` field but adds an optional `error?: string` field on RPC
failure. This is the **mixed-shape** locked decision: distinguishing
"validation rejected" from "RPC failed" without collapsing both into
`valid: false`. Consumers route a populated `error` to the
network-failure banner and a `valid: false` with no `error` to the
validation-failure message.

The catch path now routes via `getLogger().error("Error in
validateLiquidity:", error)` (preserved from v2.3.0) and sets the
`error` field on the returned object.

```ts
// Before (v2.x):
const result = await validateLiquidity(...);  // { valid: boolean; ... }
if (!result.valid) showValidationFail("Liquidity rejected");

// After (v3.x):
const result = await validateLiquidity(...);  // { valid: boolean; error?: string; ... }
if (result.error) {
  showRPCErrorBanner(result.error);          // RPC failure
} else if (!result.valid) {
  showValidationFail("Liquidity rejected");  // real validation rejection
}
```

### 6. `getMaxBuyMovieBooster` — `Promise<number>` → `Promise<number | null>`

`getMaxBuyMovieBooster` (REQ-08) widens to `Promise<number | null>`,
matching the Phase 1 `getPoolTotalFee` pattern exactly. Both `return
0` sites become `return null`; the success-path falsy-collapse (`||
0`) becomes a `Number.isFinite()` guard. A `0` max-buy is a plausible
chain return (e.g. when a booster is sold out) — collapsing the
fabricated-failure case onto the same `0` made the two states
indistinguishable. Existing v2.3.0 logger routing is preserved.

```ts
// Before (v2.x):
const max = await getMaxBuyMovieBooster(); // number — 0 could mean sold-out OR RPC fail
if (max === 0) showSoldOut();              // ambiguous

// After (v3.x):
const max = await getMaxBuyMovieBooster();
if (max === null) showRPCErrorBanner();    // RPC failed
else if (max === 0) showSoldOut();         // chain confirmed sold-out
else showAvailable(max);                   // chain returned real positive max
```

### 7. Magic-string elimination — `getSWPSpawnLimit` + `getSWPInactiveLimit`

`getSWPSpawnLimit` and `getSWPInactiveLimit` (REQ-09) widen from
`Promise<string>` (sentinel `"N/A"`) to `Promise<string | null>` per
the **magic-string elimination** locked decision. Both `return
"N/A"` sites in each function become `return null`; consumers swap
`=== "N/A"` checks for `=== null` checks. Both functions also gain
`getLogger().error("Error in <funcName>:", error)` routing in their
catch paths (was silent).

```ts
// Before (v2.x):
const spawnLimit = await getSWPSpawnLimit(swpair);
if (spawnLimit === "N/A") showRPCError();
else renderLimit(spawnLimit);

// After (v3.x):
const spawnLimit = await getSWPSpawnLimit(swpair);
if (spawnLimit === null) showRPCError();
else renderLimit(spawnLimit);
```

### Phase 3 logger-routing additions — no consumer migration required

The 14 NON-BREAKING logger-routing additions across 5 files
(`dexFunctions.ts`, `ouroFunctions.ts`, `activateFunctions.ts`,
`infoOneFunctions.ts`, and the `urStoaFunctions.ts` private helpers
`verifyEd25519Sig` + `describeKeyset`) are pure observability —
return types and parameter signatures are unchanged. Consumers who
called `setLogger(...)` (introduced in v2.3.0) automatically capture
the new error events with no additional wiring; consumers who did
not configure a logger continue to see the default `console.error`
output that the seam falls back to. No migration is required for
this set of changes.

## Migrating to v2.x

Two breaking changes shipped in v2.0.0 — both consumer-side, no
internal call sites in `src/` are affected.

### 1. `KadenaWallet` requires a `balanceResolver` to fetch balances

The `wallet/` subpath no longer imports from `interactions/*` (closes
F-CORE-005). The `KadenaWallet` class now exposes a publicly mutable
`balanceResolver: BalanceResolver` instance property. The default is a
lazy throwing stub — it fires only when `wallet.getBalance()` is
actually called, so wallets used purely for address derivation stay
zero-config.

```ts
import KadenaWallet from "@ouronet/ouronet-core/wallet";
import { getBalance } from "@ouronet/ouronet-core/interactions/kadenaFunctions";

const wallet = new KadenaWallet({
  parentId: 0, index: 0,
  secret: ..., publicKey: ..., derivationPath: "m/44'/...",
  // Wrap interactions.getBalance to match the
  // (address) => Promise<string> contract:
  balanceResolver: (addr) => getBalance(addr).then((r) => r.balance ?? "0"),
});

// Or assign post-construction:
wallet.balanceResolver = (addr) => myIndexer.balanceOf(addr);
```

`wallet.getBalance()` now **propagates errors** — the previous
`?? "0"` silent fallback is gone (mildly breaking behavioural shift).
Wrap the call in `try/catch`, or have your resolver default-on-error
return `"0"`.

### 2. `simulateTransaction(pactCode, chainId)` signature change

`interactions/crossChainFunctions.simulateTransaction` previously
accepted a pre-built `IUnsignedCommand` transaction object. It now
accepts the Pact code string directly:

```ts
// Before (v1.x):
const tx = Pact.builder.execution(code).setMeta(...).createTransaction();
const result = await simulateTransaction(tx, chainId);

// After (v2.x):
const result = await simulateTransaction(code, chainId);
```

The return shape `{ success, result?, error?, gas? }` is unchanged.

## Design docs

The architectural plan, per-phase migration history, HUB handoff, and
decision log live in the **OuronetUI repo** under `docs/`:

- [`EXTRACT_OURONET_CORE_PLAN.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/EXTRACT_OURONET_CORE_PLAN.md) — the 8-phase migration plan (now complete)
- [`ANCIENTHOLDER_HUB_HANDOFF.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/ANCIENTHOLDER_HUB_HANDOFF.md) — what the HUB agent needs to know to integrate
- [`TESTING_STRATEGY.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/TESTING_STRATEGY.md) — 3-tier testing approach + current state + roadmap
- [`CFM_BUILD_GUIDE.md`](https://github.com/DemiourgosHoldings/OuronetUI/blob/dev/docs/CFM_BUILD_GUIDE.md) — how a CFM modal uses this package

Don't fork logic — add to core, version-bump, publish, and consumers
upgrade deliberately.

## Submodules

Each is a subpath export of the package: `import { ... } from "@ouronet/ouronet-core/<submodule>"`.

| Path | Contains |
|---|---|
| `@ouronet/ouronet-core/constants` | `KADENA_NAMESPACE`, `KADENA_CHAIN_ID`, `KADENA_NETWORK`, `PACT_URL`, gas-station + liquidpot addresses, every `TOKEN_ID_*` |
| `@ouronet/ouronet-core/network` | Node failover (node2 → node1), URL construction; **(v2.1.0+)** `getFailoverClient(chainId, options?)` factory returning `{ dirtyRead, submit, listen, pollOne }` with `withFailover` + per-tier timeout baked in, `runWithTimeout(operation, fn, timeoutMs)` helper, `FailoverClientOptions` type, `resetNodeFailover()` for test isolation |
| `@ouronet/ouronet-core/gas` | `calculateAutoGasLimit`, ANU/STOA math |
| `@ouronet/ouronet-core/guard` | `analyzeGuard`, `buildCodexPubSet`, `selectCapsSigningKey`, `computeThreshold` (all predicates including `stoa-ns.stoic-predicates.*`); **(v1.6.0+)** `classifyGuardKind`, `extractKeysetFromGuard`, `analyzeSmartAccountAuthPaths` for the Smart Ouronet Account three-branch auth-path resolution (`enforce-one` over account-guard / sovereign-guard / governor) |
| `@ouronet/ouronet-core/crypto` | V1 + V2 AES-GCM-256 encryption, `smartDecrypt`, pure `smartEncrypt(pt, pw, schemaVersion)`; **(v2.2.0+)** typed error classes `WrongPasswordError`, `CorruptEnvelopeError`, `UnsupportedFormatError` discriminate decryption failure modes; `smartDecrypt` single-path dispatch eliminates v1-then-v2 timing-leak |
| `@ouronet/ouronet-core/signing` | `KeyResolver` / `SigningStrategy` interfaces, `CodexSigningStrategy`, `universalSignTransaction`, signing primitives (`publicKeyFromPrivateKey`, etc.) |
| `@ouronet/ouronet-core/codex` | `PlaintextCodex` generic type, `serializeCodex` / `deserializeCodex` (backup format `"1.2"`), `migrateSeedType` |
| `@ouronet/ouronet-core/reads` | `rawCalibratedDirtyRead` (pure Pact read with node failover + 15s timeout; no cache); **(v2.1.0+)** accepts a `readTimeoutMs?: number` option for per-call timeout override; **(v2.3.0+)** JSDoc enumerates the canonical tier mapping (T1=balance, T2=preview, T3=metadata, T7=very-static) and documents that the default reader accepts and ignores the `tier` argument — see `setPactReader` for cache-aware consumers |
| `@ouronet/ouronet-core/observability` | **(v2.3.0+)** central logger seam mirroring `setPactReader`. Exports `Logger` type (`{ warn(msg, ...args), error(msg, ...args) }`), `setLogger(logger)` mutator (throws `TypeError("setLogger requires a non-null Logger")` on null/undefined), `getLogger()` accessor. Default routes `warn` to `console.warn` and `error` to `console.error` — consumers who do nothing observe identical behavior to direct `console.*` calls. |
| `@ouronet/ouronet-core/guard` | **(v2.3.0+)** `UnknownPredicateError` typed class — thrown by `computeThreshold` on unrecognized predicates; `analyzeGuard` catches it and folds it into a `predicateRecognized: false` bit on the returned analysis. Also adds optional `firstSignableButUnsatisfied: number` field on `SmartAccountAuthPathsAnalysis`. |
| `@ouronet/ouronet-core/pact` | `formatDecimalForPact`, `safeCreationTime`, `filterFreePositionData`, EU locale formatters, and **14 `buildXxxPactCode` builders** for every CFM function the ecosystem ships |
| `@ouronet/ouronet-core/interactions` | Read helpers (`getXxxInfo`, `getXxxBalance`, `getHibernatedNonces…`) + non-CFM execute helpers (`executeWrapStoa`, `executeWrapUrStoa`, `executeNativeUrStoaTransfer`); **(v2.0.0+)** `simulateTransaction(pactCode, chainId)` (signature change — see Migrating to v2.x); **(v3.0.0+)** 16 fabricated-fallback fabrications widened to `Promise<T \| null>` (BREAKING — see Migrating to v3.x); 14 logger-routing additions across 5 files complete the silent-catch elimination (NON-BREAKING) |
| `@ouronet/ouronet-core/dalos` | **(v1.3.0+)** thin re-export of `@ouronet/dalos-crypto/registry` + `createOuronetAccount(registry, options)` convenience helper covering all 6 DALOS input modes. One-stop shop for browser-side key-gen; no need to install `dalos-crypto` as a separate dep. **(v3.1.0+)** dep range bumped to `@ouronet/dalos-crypto@^4.0.3`; re-exports the lower-level Schnorr signature surface (`schnorrSign`, `schnorrVerify`, `schnorrSignAsync`, `schnorrVerifyAsync`, `SchnorrSignError`, `SchnorrSignature`) for advanced consumers — the `*Async` variants yield to the event loop on a fixed data-independent cadence so browser signing keeps INP < 200ms. |

## Quick start — `/dalos` subpath

Mint a new Ouronet account locally in one call:

```ts
import {
  createDefaultRegistry,
  createOuronetAccount,
} from "@ouronet/ouronet-core/dalos";

const registry = createDefaultRegistry();

// Random account (simplest — OS randomness)
const a = createOuronetAccount(registry, { mode: "random" });

// From a seed phrase (any array of UTF-8 words, 4–256 entries)
const b = createOuronetAccount(registry, {
  mode: "seedWords",
  data: ["mountain", "whisper", "aurora", "eternal"],
});

// From a 40×40 bitmap (1 = black, 0 = white; row-major TTB-LTR)
import type { Bitmap } from "@ouronet/ouronet-core/dalos";
const bitmap: Bitmap = /* 40 rows × 40 cols */;
const c = createOuronetAccount(registry, { mode: "bitmap", data: bitmap });

console.log(b.standardAddress);    // Ѻ.xxxxx…
console.log(b.keyPair.priv);       // base-49 private key
console.log(b.privateKey.int49);   // same, via `privateKey` object
console.log(b.privateKey.int10);   // base-10 representation
console.log(b.privateKey.bitString); // 1600-bit binary
```

Same API shape as `@ouronet/dalos-crypto/registry` — OuronetCore just
re-exports the types and adds `createOuronetAccount` as a convenience.
See [`@ouronet/dalos-crypto`](https://www.npmjs.com/package/@ouronet/dalos-crypto)
for deeper documentation on the cryptographic primitive itself.

## Local development

```bash
npm install
npm run build        # tsc -p tsconfig.build.json → dist/
npm run typecheck    # tsc --noEmit
npm test             # vitest run — 558 tests across crypto, guard, gas, pact format, signing, strategy, codex, cfmBuilders, dalos integration, wallet, interactions-read-seam, network, failover-client, timeouts, failover-submit, pact-reader, wallet-builder, transaction-errors, seed-type-migration, crypto-errors, crypto-v2-classification, package-version, observability-logger, phase5-catch-routing, interactions-pricing, interactions-balance-cluster, interactions-logger-parity
```

To hot-reload changes into OuronetUI (which now depends on the published
registry version), use `npm link`:

```bash
cd stoa-js && npm link
cd OuronetUI && npm link @ouronet/ouronet-core
# Edit core, run `npm run build` in stoa-js, UI picks up the change.
# npm unlink @ouronet/ouronet-core  # restores registry resolution
```

## Publishing

Push a `v*`-prefixed tag and `.github/workflows/publish.yml` handles the
rest — typecheck + build + test + `npm publish` to **public npmjs.org**
under the `@stoachain` scope. Version parity check bakes in protection
against mismatched tag / package.json versions.

```bash
# After bumping package.json + CHANGELOG.md and committing:
git tag v1.3.1 -m "v1.3.1 — ..."
git push origin v1.3.1
# Workflow publishes within ~2 minutes. Consumers run `npm install` to pick up.
```

## Versioning

Strict semver. Breaking changes → major version bump → consumers upgrade
deliberately. Changelog in `CHANGELOG.md`.

## License

UNLICENSED (org-owned package). Public on
[npmjs.com/package/@ouronet/ouronet-core](https://www.npmjs.com/package/@ouronet/ouronet-core);
authoring rights retained by AncientHoldings GmbH.
