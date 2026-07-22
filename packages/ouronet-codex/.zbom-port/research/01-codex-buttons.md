# ZBOM Operations Reachable from "My Codex" — Button/Modal Map

**Research scope:** Map every ZBOM-driven button/modal reachable from the legacy
"My Codex" page so the list can drive a 1:1 port into `@ouronet/ouronet-codex`.
RESEARCH ONLY — no code modified.

---

## Important entry-point correction

`OuronetUI/src/routes/logged-in/codex-ui.tsx` is **NOT** the legacy page — it is the
**new packaged** Codex UI that already consumes `@ouronet/ouronet-codex/ui`
(the thing being built). It has no ZBOM operations of its own beyond a
`ZbomShellDemoButton` demo.

The **legacy "My Codex" page** — the source of truth for the port — is:

- **`OuronetUI/src/routes/logged-in/settings.tsx`** (page title rendered as
  "Ouronet Codex"). Sidebar route = Settings/Codex.

This page hosts the Ouronet Accounts tab, which renders
**`OuronetUI/src/components/settings/OuroAccountList.tsx`**. Every rotate/tag
ZBOM button lives on the per-account expandable row (`AccountRow`) inside that
list. `ActivateStandardAccountModal` is the only ZBOM modal opened directly by
`settings.tsx`.

**"Register CodexID" does NOT exist** as a ZBOM modal anywhere in
`OuronetUI/src`. The CodexID surface is observational-only. Do not include it in
the port plan.

---

## The 7 ZBOM operations (complete & exhaustive list)

| # | Operation | Trigger location | Modal file |
|---|-----------|------------------|------------|
| 1 | Activate Standard Account | `settings.tsx:875` (row Activate btn → `onActivate` → `settings.tsx:818`) | `ActivateStandardAccountModal.tsx` |
| 2 | Rotate Payment Key | `OuroAccountList.tsx:611` (GoldenBtn) | `RotatePaymentKeyModal.tsx` |
| 3 | Rotate Guard | `OuroAccountList.tsx:658` (GoldenBtn) | `RotateGuardModal.tsx` |
| 4 | Add (Register) StoicTag | `OuroAccountList.tsx:688` (GreenBtn) | `RegisterStoicTagModal.tsx` |
| 5 | Release StoicTag | `OuroAccountList.tsx:681` (GreenBtn) | `ReleaseStoicTagModal.tsx` |
| 6 | Rotate Sovereign | `OuroAccountList.tsx:719` (VioletBtn, Smart only) | `RotateSovereignModal.tsx` |
| 7 | Rotate Governor | `OuroAccountList.tsx:746` (VioletBtn, Smart only) | `RotateGovernorModal.tsx` |

Modal mount points in `OuroAccountList.tsx`: RotatePaymentKey `:892`,
RotateGuard `:902`, RotateSovereign `:913` (gated `account.isSmart`),
RotateGovernor `:925` (gated `account.isSmart`), ReleaseStoicTag `:937`
(gated `account.stoicTag`), RegisterStoicTag `:949` (gated `!account.stoicTag`).

---

## Two ZBOM "flavors" found

All 7 use the shared `ZbomLayout` shell, but split into **two signing back-ends**:

- **Flavor A — `interactions/*` helper functions** (older builders; the helper
  builds + signs + submits internally). Used by: Rotate Guard, Rotate Payment Key.
- **Flavor B — `useCFMStrategy().execute({ build, guards, paymentKey, ... })`**
  (the canonical CFM v2 pattern from CLAUDE.md; modal supplies a `build` closure
  that calls a `build*PactCode` core builder). Used by: Activate, Rotate Sovereign,
  Rotate Governor, Register StoicTag, Release StoicTag.

The port should standardize on Flavor B (`useCFMStrategy`), which is what the
package's CFM strategy hook will mirror.

---

## Per-operation detail

### 1. Activate Standard Account
- **File:** `OuronetUI/src/components/settings/ActivateStandardAccountModal.tsx`
- **Trigger:** Row "Activate" button (`OuroAccountList.tsx:875`, hidden for
  active/APOLLO accounts) → `onActivate(account)` in `settings.tsx` → opens modal at `settings.tsx:817-826`. Guarded by `assertTransactable(account)` / `transactableBlockReason` (`settings.tsx:707-721`).
- **INFO:** `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_DeployStandardAccount` (account)
  — via `getDeployStandardAccountInfoOnly` / `getDeployStandardAccountInfo`
  (`@ouronet/ouronet-core/interactions/activateFunctions`).
- **EXECUTE:** `ouronet-ns.TS01-C1.DALOS|C_DeployStandardAccount` — pact code from
  `buildDeployStandardAccountPactCode({ account, kadenaAddress, publicKey })`.
- **Inputs:** INPUT I `account:string` (autonomous), INPUT II `guard:guard`
  (auto = CodexPrime Key #1; manual = `GuardEntryInput` free), INPUT III
  `kadena:string` (auto = `k:`+CodexPrime Key #0; manual free), INPUT IV
  `public:string` (autonomous = account.publicKey). Keyset also fed via
  `addData("ks", { keys, pred })`.
- **Zones:** Generic ZbomLayout. **PATRONLESS** (no PatronZone). Zone 0 =
  `FunctionInfoZone`; Zone 1 = `Zone2Wrapper` inputs; Zone 2/3 = bespoke inline
  Signing zone (CodexPrime dual-role, Signing/CAPS tabs). Has an "Auto" toggle.
- **Caps/signers:** GasStation key (= CodexPrime Key #0) signs
  `DALOS.GAS_PAYER` + N `coin.TRANSFER` (one per `kadena-split` receiver from
  INFO). New account guard keyset signs pure (`guards: [newAccountGuard]`,
  `paymentKey: primeKey0`).
- **Preconditions:** Standard account, NOT yet active, NOT APOLLO (₱./Π. blocked
  by `assertTransactable`). Needs CodexPrime seed with ≥2 derived keys in auto
  mode; payment account needs ≥ `kadena-full` STOA.
- **Shared blocks:** `ZbomLayout`, `FunctionInfoZone`, `Zone2Wrapper`,
  `StringEntryInput`/`GuardEntryInput` (`@/components/cfm/...`), `useCFMStrategy`
  (`@/lib/signing/useCFMStrategy`), `Modal`, `InfoTooltip`, `txPending`.

### 2. Rotate Payment Key
- **File:** `RotatePaymentKeyModal.tsx`
- **Trigger:** `OuroAccountList.tsx:611` GoldenBtn "Rotate Payment Key" (in
  Payment Key section, activated accounts with `kadenaLedger`).
- **INFO:** `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateKadena` (patron, account)
  — `getRotateKadenaInfo` (`@ouronet/ouronet-core/interactions/ouroRotateFunctions`).
- **EXECUTE:** `ouronet-ns.TS01-C1.DALOS|C_RotateKadena` — via
  `rotateKadenaPaymentKey(...)` helper (**Flavor A**, not a build-closure).
- **Inputs:** INPUT I `patron` (autonomous), INPUT II `account` (autonomous),
  INPUT III `new-payment-key:string` (free, addressBookType "stoa").
- **Zones:** Generic. Zone 0 `FunctionInfoZone`, Zone 1 `PatronZonePattern2`,
  Zone 2 `Zone2Wrapper`, Zone 3 `SigningZone`.
- **Signers:** GasStation key (`selectCapsSigningKey`) carries GAS_PAYER; patron
  guard + account guard sign pure (collected via `analyzeGuard` →
  `getKadenaKeyPairsByPublicKey`). Manual missing-key resolution supported.
- **Preconditions:** Activated account; patron has enough IGNIS; patron+account
  guards satisfiable from codex.
- **Shared blocks:** `ZbomLayout`, `FunctionInfoZone`, `PatronZonePattern2`
  (`@/components/cfm/PatronSpend`), `SigningZone`, `Zone2Wrapper`,
  `StringEntryInput`, `usePatronSelectionDefaults` (`@/hooks/usePatronSelection`),
  `analyzeGuard`/`buildCodexPubSet`/`selectCapsSigningKey`
  (`@stoachain/stoa-core/guard`).

### 3. Rotate Guard
- **File:** `RotateGuardModal.tsx`
- **Trigger:** `OuroAccountList.tsx:658` GoldenBtn "Rotate Guard" (Guard section,
  activated accounts with `account.guard`).
- **INFO:** `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateGuard` (patron, account)
  — `getRotateGuardInfo` (`@ouronet/ouronet-core/interactions/guardFunctions`).
- **EXECUTE:** `ouronet-ns.TS01-C1.DALOS|C_RotateGuard` — via `rotateGuard(...)`
  helper (**Flavor A**). Supports `mode: "define" | "existing"` + `safe:bool`.
- **Inputs:** INPUT I `patron` (auto), INPUT II `account` (auto), INPUT III
  `guard:guard` (`GuardEntryInput`, Define Keys or Use Existing Keyset), INPUT IV
  `safe:bool` (`BoolEntryInput`).
- **Zones:** Generic. Zone 0 Info, Zone 1 `PatronZonePattern2`, Zone 2
  `Zone2Wrapper`, Zone 3 `SigningZone` with `additionalGuards` (New Guard signs
  when defining new keys / safe-existing).
- **Signers:** GasStation key; patron guard + current account guard + (new guard
  when applicable) sign pure. Threshold-limited key collection via `analyzeGuard`.
- **Preconditions:** Activated account; sufficient IGNIS; all involved guards
  satisfiable.
- **Shared blocks:** same set as Rotate Payment Key, plus `GuardEntryInput`/
  `BoolEntryInput`, `GuardChangeValue`/`GuardInputMode` types.

### 4. Register (Add) StoicTag
- **File:** `RegisterStoicTagModal.tsx`
- **Trigger:** `OuroAccountList.tsx:688` GreenBtn "Add StoicTag" (StoicTag
  section, shown when `!stoicTag`; disabled if `simStoicTagEnabled`).
- **INFO:** `ouronet-ns.CODEX.CODEX|INFO_RegisterStoicTag` (patron, tag-name,
  account) — `getRegisterStoicTagInfo`
  (`@ouronet/ouronet-core/interactions/ouroAccountFunctions`). Debounced 450ms.
- **EXECUTE:** `ouronet-ns.TS01-C4.CODEX|C_RegisterStoicTag` — pact from
  `buildRegisterStoicTagPactCode({ patron, tagName, accountAddress })` (**Flavor B**).
- **Inputs:** INPUT I `patron` (auto), INPUT III `account` (auto), tag input
  (Cinzel § glyph field, DALOS glyph filter `filterToDalosGlyphs`,
  `MAX_STOIC_TAG_GLYPHS`).
- **Zones:** Generic. Zone 0 Info, Zone 1 `PatronZonePattern2`, Zone 2
  `Zone2Wrapper` (custom tag UI + cost + payment-key panel), Zone 3 `SigningZone`
  (passed `kadenaNeed`/`kadenaReceivers`/`kadenaAmounts`).
- **Cost/Signers:** **Native STOA** (Elite-tier discounted, all amounts from
  INFO). GasStation signs GAS_PAYER; patron's **payment key** (resolved via
  `getWrapperPaymentKey` → `classifyPaymentKey`) signs N `coin.TRANSFER`
  (passed as `extraSigners` + `paymentKey`); tagged account guard signs (ownership).
  `guards: [patronGuard, accountGuard]`.
- **Preconditions:** Activated account WITHOUT a tag; patron payment key must be a
  `k:` account present in codex (or manually resolved via `PaymentKeyInput`);
  enough STOA on payment key + enough IGNIS on patron.
- **Shared blocks:** `ZbomLayout`, `FunctionInfoZone`, `PatronZonePattern2`,
  `Zone2Wrapper`, `SigningZone`, `StringEntryInput`, `useCFMStrategy`,
  `useEnsureCodexUnlocked` (`@/hooks/useEnsureCodexUnlocked`), `StoicTagDisplay`
  (`@/components/StoicTagDisplay`), `PaymentKeyInput` (`@/components/ui/ManualKeyInput`),
  `classifyPaymentKey`/`buildCodexPubSet` (`@stoachain/stoa-core/guard`),
  `getWrapperPaymentKey`/`getPaymentKeyBalance`
  (`@ouronet/ouronet-core/interactions/wrapFunctions`).

### 5. Release StoicTag
- **File:** `ReleaseStoicTagModal.tsx`
- **Trigger:** `OuroAccountList.tsx:681` GreenBtn "Release StoicTag" (StoicTag
  section, shown when `stoicTag` present; disabled if `simStoicTagEnabled`).
- **INFO:** `ouronet-ns.CODEX.CODEX|INFO_ReleaseStoicTag` (patron, tag-name) —
  raw `pactRead` (T7), no dedicated helper.
- **EXECUTE:** `ouronet-ns.TS01-C4.CODEX|C_ReleaseStoicTag` — pact from
  `buildReleaseStoicTagPactCode({ patron, tagName })` (**Flavor B**). `tag-name`
  sent BARE (no § sigil).
- **Inputs:** INPUT I `patron` (auto), INPUT II `tag-name` (read-only
  `StoicTagDisplay`, sourced from `account.stoicTag`).
- **Zones:** Generic. Zone 0 Info, Zone 1 `PatronZonePattern2`, Zone 2
  `Zone2Wrapper`, Zone 3 `SigningZone`.
- **Cost/Signers:** **IGNIS only** (1 per glyph). GasStation signs GAS_PAYER;
  `guards: [patronGuard, accountGuard]` (bound account guard proves ownership).
- **Preconditions:** Account HAS a `stoicTag`; sufficient IGNIS on patron.
- **Shared blocks:** `ZbomLayout`, `FunctionInfoZone`, `PatronZonePattern2`,
  `Zone2Wrapper`, `SigningZone`, `StringEntryInput`, `useCFMStrategy`,
  `useEnsureCodexUnlocked`, `StoicTagDisplay`, `pactRead`
  (`@stoachain/stoa-core/reads`).

### 6. Rotate Sovereign (Smart accounts only)
- **File:** `RotateSovereignModal.tsx`
- **Trigger:** `OuroAccountList.tsx:719` VioletBtn "Rotate Sovereign" (Sovereign
  section, rendered only when `isActivated && account.isSmart`). Modal mount
  gated `account.isSmart` (`:912`).
- **INFO:** `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateSovereign` (patron,
  account) — raw `pactRead` (T7).
- **EXECUTE:** `ouronet-ns.TS01-C1.DALOS|C_RotateSovereign` — pact from
  `buildRotateSovereignPactCode({ patron, account, newSovereign })` (**Flavor B**).
- **Inputs:** INPUT I `patron` (auto), INPUT II `account` (auto), CURRENT
  sovereign (metadata row), INPUT III `new-sovereign:string` (free, must be a
  Standard `Ѻ.` account, ≠ current).
- **Zones:** Generic + **`AuthPathZone`** (Smart-account three-branch
  `enforce-one` picker over account guard / sovereign guard / governor; UI
  resolves the OR and emits one `chosenKeyset`). Zone 0 Info, Zone 1
  `PatronZonePattern2`, Zone 2 `Zone2Wrapper`, AuthPath, Zone 3 `SigningZone`.
- **Signers:** GasStation GAS_PAYER; `guards: [patronGuard,
  authSelection.chosenKeyset]` (strategy stays AND-only over the chosen branch).
- **Preconditions:** Smart (Σ.) account, activated; on-chain sovereign fetched
  via `getKadenaAccountGuard`; a key-based auth branch must be satisfiable
  (else `impossibleViaZbom` → "use Execute Code"); new sovereign must be `Ѻ.`
  Standard and different from current; sufficient IGNIS.
- **Shared blocks:** `ZbomLayout`, `FunctionInfoZone`, `PatronZonePattern2`,
  `Zone2Wrapper`, `SigningZone`, `StringEntryInput`, **`AuthPathZone`** +
  `AuthPathSelection` (`@/components/cfm/AuthPathZone`), `useCFMStrategy`,
  `getKadenaAccountGuard` (`@ouronet/ouronet-core/interactions/ouroAccountFunctions`),
  `pactRead`, `OuronetAddressHighlight`.

### 7. Rotate Governor (Smart accounts only)
- **File:** `RotateGovernorModal.tsx`
- **Trigger:** `OuroAccountList.tsx:746` VioletBtn "Rotate Governor" (Governor
  section, rendered only when `isActivated && account.isSmart`). Modal mount
  gated `account.isSmart` (`:924`).
- **INFO:** `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateGovernor` (patron,
  account) — raw `pactRead` (T7).
- **EXECUTE:** `ouronet-ns.TS01-C1.DALOS|C_RotateGovernor` — pact from
  `buildRotateGovernorPactCode({ patron, account, governorExpr })` where
  `governorExpr` is assembled by `buildNonKeyGuardExpr` (**Flavor B**).
- **Inputs:** INPUT I `patron` (auto), INPUT II `account` (auto), INPUT III
  `governor:guard` via **`NonKeyGuardEntryInput`** — a NON-key-based guard
  (user / capability / module / pact constructor + body), pre-filled from the
  current on-chain governor (`serializeGovernorToInput`).
- **Zones:** Generic + `AuthPathZone` (here exposes only the TWO key-based
  branches — account guard + sovereign guard; governor branch dropped). Zone 0
  Info, Zone 1 `PatronZonePattern2`, Zone 2 `Zone2Wrapper`, AuthPath, Zone 3
  `SigningZone`.
- **Signers:** GasStation GAS_PAYER; `guards: [patronGuard,
  authSelection.chosenKeyset]`. Calls `ensureCodexUnlocked()` before signing.
- **Preconditions:** Smart (Σ.) account, activated; governor must be a non-key
  guard and changed from current (`governorUnchanged` blocks no-op); a key-based
  branch satisfiable; sufficient IGNIS.
- **Shared blocks:** `ZbomLayout`, `FunctionInfoZone`, `PatronZonePattern2`,
  `Zone2Wrapper`, `SigningZone`, `StringEntryInput`, **`NonKeyGuardEntryInput`**,
  `serializeGovernorToInput`/`NonKeyGuardValue` (`@/components/cfm/governorSerialize`),
  `AuthPathZone`, `useCFMStrategy`, `useEnsureCodexUnlocked`,
  `buildNonKeyGuardExpr`/`NonKeyGuardConstructor` (`@ouronet/ouronet-core/pact`).

---

## Shared building blocks inventory (names + paths only)

UI / CFM (`OuronetUI/src/components/cfm/`):
- `ZbomLayout` — `components/cfm/ZbomLayout`
- `FunctionInfoZone` — `components/cfm/FunctionInfoZone`
- `PatronZonePattern2` — `components/cfm/PatronSpend`
- `Zone2Wrapper` — `components/cfm/Zone2Wrapper`
- `SigningZone` — `components/cfm/SigningZone`
- `AuthPathZone` + `AuthPathSelection` — `components/cfm/AuthPathZone`
- Inputs (`components/cfm/inputs`): `StringEntryInput`, `GuardEntryInput`,
  `BoolEntryInput`, `NonKeyGuardEntryInput`; types `GuardChangeValue`,
  `GuardInputMode`
- `serializeGovernorToInput`, `NonKeyGuardValue` — `components/cfm/governorSerialize`
- `FunctionInfoZone`-adjacent: `InfoTooltip` — `components/settings/InfoTooltip`

Hooks / lib (`OuronetUI/src/`):
- `useCFMStrategy` — `lib/signing/useCFMStrategy`
- `usePatronSelectionDefaults` — `hooks/usePatronSelection`
- `useEnsureCodexUnlocked` — `hooks/useEnsureCodexUnlocked`
- `useWallet` — `context/wallet-context` (`getKadenaKeyPairsByPublicKey`,
  `setCurrentTransaction`)
- `txPending` — `lib/toast-manager`; `pactQueryCache.triggerPostTx` — `lib/pact-query-cache`
- `StoicTagDisplay` — `components/StoicTagDisplay`; `PaymentKeyInput` —
  `components/ui/ManualKeyInput`; `OuronetAddressHighlight` —
  `components/OuronetAddressHighlight`
- `filterToDalosGlyphs`/`MAX_STOIC_TAG_GLYPHS` — `lib/dalos/characterSet`
- `assertTransactable`/`transactableBlockReason` — `lib/dalos/assertTransactable`
- `detectOriginCurve` — `lib/dalos/originCurve`

Core (`@stoachain/*`):
- Pact builders (`@ouronet/ouronet-core/pact`):
  `buildDeployStandardAccountPactCode`, `buildRotateSovereignPactCode`,
  `buildRotateGovernorPactCode`, `buildRegisterStoicTagPactCode`,
  `buildReleaseStoicTagPactCode`, `buildNonKeyGuardExpr`; types
  `NonKeyGuardConstructor`
- Pact utils (`@stoachain/stoa-core/pact`): `safeCreationTime`, `mayComeWithDeimal`
- Guard (`@stoachain/stoa-core/guard`): `analyzeGuard`, `buildCodexPubSet`,
  `selectCapsSigningKey`, `classifyPaymentKey`; type `IKeyset`
- Signing (`@stoachain/stoa-core/signing`): `publicKeyFromPrivateKey`,
  `publicKeyFromExtendedKey`; type `IKadenaKeypair`
- Reads (`@stoachain/stoa-core/reads`): `pactRead`
- Constants (`@ouronet/ouronet-core/constants`): `KADENA_NAMESPACE`,
  `STOA_AUTONOMIC_OURONETGASSTATION`; (`@stoachain/stoa-core/constants`):
  `KADENA_CHAIN_ID`, `KADENA_NETWORK`
- Client (`@stoachain/kadena-stoic-legacy/client`): `Pact`
- Interaction helpers: `activateFunctions` (getDeployStandardAccountInfo[Only]),
  `guardFunctions` (getRotateGuardInfo, rotateGuard), `ouroRotateFunctions`
  (getRotateKadenaInfo, rotateKadenaPaymentKey), `ouroAccountFunctions`
  (getKadenaAccountGuard, getRegisterStoicTagInfo), `ouroBalanceFunctions`
  (getIgnisBalance), `wrapFunctions` (getWrapperPaymentKey, getPaymentKeyBalance),
  `kadenaFunctions` (getBalance — used by the list row, not a ZBOM)

---

## Notes for the port plan

- Already-started package mirrors exist: `stoa-js/packages/ouronet-codex/src/
  components/{RotateGuardModal,RotateSovereignModal,RotatePaymentKeyModal}.tsx`,
  `src/ui/internal/RotateModals.tsx`, `src/ui/tabs/OuronetAccountsTab.tsx`, and
  tests `tests/rotation-modals.test.tsx`, `tests/ui-ouronet-accounts-tab.test.tsx`.
  Cross-check these against the app originals — RotateGovernor, RegisterStoicTag,
  ReleaseStoicTag, and ActivateStandardAccount appear NOT yet ported into the
  package `components/` dir (only Guard/Sovereign/PaymentKey present there).
- Two of the seven (Rotate Guard, Rotate Payment Key) use Flavor-A `interactions`
  helpers rather than the `useCFMStrategy` build-closure; decide whether the port
  standardizes them onto Flavor B.
- Smart-only ops (Rotate Sovereign, Rotate Governor) require the `AuthPathZone`
  enforce-one branch picker — the most complex shared block to port.
- `version.ts`/MEMORY note: `functionMeta.addedInVersion` values in these modals
  range 0.3.x → 1.2.5 — leave them as-is when porting (they describe the app, not
  the package).
