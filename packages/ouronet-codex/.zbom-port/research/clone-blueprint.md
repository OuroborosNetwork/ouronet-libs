# ZBOM Modal Clone Blueprint — OuronetUI → @ouronet/ouronet-codex

Research-only. Faithful code-for-code clone of 7 bespoke modals + their shared
cfm zone components. Rewire ONLY the data layer (Redux/Context/useCFMStrategy →
Zustand store + package hooks). All provenance tags: `[CITED]` = read in
codebase, `[VERIFIED]` = confirmed via signature/export, `[ASSUMED]` = inference.

Source: `D:\_Claude\StoaOuronet\OuronetUI\src`
Target: `D:\_Claude\StoaOuronet\stoa-js\packages\ouronet-codex\src`

---

## 0. Key findings up front

- **The abstraction to scrap** `[CITED]`: `ui/zbom/ZbomOperationModal.tsx`
  (descriptor host, `ZbomOperationModalProps` @ L73) + `zbom/operations/*`
  (descriptor registry) + the simplified `ui/zbom/{zones,SigningZone,PatronZone,
  AuthPathZone,FunctionInfoZone,inputs,ManualKeyInput}.tsx`. Mounted by
  `ui/tabs/OuronetAccountsTab.tsx:412` via `setActiveOpId` (7 trigger sites:
  L268/291/303/304/326/341/390).
- **The wiring target** `[CITED]`: OuronetUI mounts each modal directly in
  `components/settings/OuroAccountList.tsx` (imports L23-28; JSX L892-951;
  open-state L432-437). Package's `OuronetAccountsTab.tsx` must mount the 7
  cloned modals the same way — replace the single `<ZbomOperationModal>` with
  7 conditionally-rendered modals keyed off the same `activeOpId` triggers.
- **Modal prop shape is uniform** `[CITED]` across all 7:
  `{ open, onClose, account|ouroAccount, accounts, kadenaSeeds, kadenaAccounts }`.
  (`ActivateStandardAccountModal` uses `ouroAccount` not `account`.)
- **Two data-seam patterns dominate** `[CITED]`:
  - Pattern A (strategy.execute): Register, Release, RotateSovereign,
    RotateGovernor, Activate — call `strategy.execute({ build, guards,
    paymentKey, resolvedForeignKeys })`.
  - Pattern B (manual key collection): RotatePaymentKey, RotateGuard — call
    `getKadenaKeyPairsByPublicKey(pub)` in a `collectKeys` loop, then pass keys
    to a core interaction fn (`rotateKadenaPaymentKey` / `rotateGuard`).
  Both patterns then call `setCurrentTransaction(raw)` + dynamic-import
  `pactQueryCache.triggerPostTx()`.

---

## 1. Per-modal dependency tree

Legend: **(a)** pure UI copy-verbatim · **(b)** data-seam rewire · **(c)** `@stoachain/*` core (stays identical).

### RegisterStoicTagModal.tsx (451 LOC) `[CITED]`
- (a) `InfoTooltip`, `StoicTagDisplay`, `PaymentKeyInput` (from ManualKeyInput),
  `cfm/{ZbomLayout,FunctionInfoZone,PatronSpend→PatronZonePattern2,Zone2Wrapper,
  SigningZone,inputs→StringEntryInput}`, `@/lib/dalos/characterSet`
  (`filterToDalosGlyphs`, `MAX_STOIC_TAG_GLYPHS`), lucide
  (`Tag,Loader2,AlertTriangle,Trash2`).
- (b) `Modal` (`@/components/ui/Modal`), `useWallet()` →
  `{ setCurrentTransaction, getKadenaKeyPairsByPublicKey }` (L76),
  `usePatronSelectionDefaults`, `useCFMStrategy`, `useEnsureCodexUnlocked`,
  `txPending` (toast-manager), `pactQueryCache.triggerPostTx`, `@/ouro` types.
- (c) `Pact` (kadena-stoic-legacy/client); `getIgnisBalance`,
  `getWrapperPaymentKey`, `getPaymentKeyBalance`, `getRegisterStoicTagInfo`
  (ouronet-core/interactions); `KADENA_CHAIN_ID,KADENA_NETWORK`
  (stoa-core/constants); ouronet-core/constants;
  `buildRegisterStoicTagPactCode` (ouronet-core/pact); `safeCreationTime,
  mayComeWithDeimal` (stoa-core/pact); `classifyPaymentKey,buildCodexPubSet`
  + types `IKeyset` (stoa-core/guard); `IKadenaKeypair` (stoa-core/signing).

### ReleaseStoicTagModal.tsx (329 LOC) `[CITED]`
- (a) `InfoTooltip`, `StoicTagDisplay`, `cfm/{ZbomLayout,FunctionInfoZone,
  PatronZonePattern2,Zone2Wrapper,SigningZone,StringEntryInput}`, lucide
  (`Unlink,Loader2`).
- (b) `Modal`, `useWallet()` → `{ setCurrentTransaction }` (L72),
  `usePatronSelectionDefaults`, `useCFMStrategy`, `useEnsureCodexUnlocked`,
  `txPending`, `pactQueryCache`, `@/ouro`.
- (c) `Pact`; `getIgnisBalance`; `pactRead` (stoa-core/reads);
  constants; `buildReleaseStoicTagPactCode`; `safeCreationTime,
  mayComeWithDeimal`; type `IKeyset`.

### RotatePaymentKeyModal.tsx (328 LOC) `[CITED]`
- (a) `InfoTooltip`, `cfm/{ZbomLayout,FunctionInfoZone,PatronZonePattern2,
  SigningZone,StringEntryInput,Zone2Wrapper}`, lucide (`RotateCw,Loader2`),
  `derivePubKey` (local helper using `publicKeyFromPrivateKey/ExtendedKey`).
- (b) `Modal`, `useWallet()` → `{ getKadenaKeyPairsByPublicKey,
  setCurrentTransaction }` (L64), `usePatronSelectionDefaults`,
  `toast` (sonner), `txPending`, `pactQueryCache`, `@/ouro`.
  **NO `useCFMStrategy`/`useEnsureCodexUnlocked`** — uses manual collectKeys
  (Pattern B).
- (c) `getIgnisBalance`; `getRotateKadenaInfo,rotateKadenaPaymentKey`
  (ouronet-core/interactions/ouroRotateFunctions); `mayComeWithDeimal`;
  `analyzeGuard,buildCodexPubSet,selectCapsSigningKey` (stoa-core/guard);
  `publicKeyFromPrivateKey,publicKeyFromExtendedKey` (stoa-core/signing).

### RotateGuardModal.tsx (347 LOC) `[CITED]`
- (a) `InfoTooltip`, `cfm/{ZbomLayout,FunctionInfoZone,PatronZonePattern2,
  SigningZone,inputs→StringEntryInput,GuardEntryInput,BoolEntryInput +
  types GuardChangeValue,GuardInputMode,Zone2Wrapper}`, lucide
  (`Shield,Loader2`).
- (b) `Modal`, `useWallet()` → `{ getKadenaKeyPairsByPublicKey,
  setCurrentTransaction }` (L53), `usePatronSelectionDefaults`, `toast`,
  `txPending`, `pactQueryCache`, `@/ouro`. **Pattern B** (manual collectKeys).
- (c) `getIgnisBalance`; `getRotateGuardInfo,rotateGuard`
  (ouronet-core/interactions/guardFunctions); `mayComeWithDeimal`;
  `analyzeGuard,buildCodexPubSet,selectCapsSigningKey`.

### RotateSovereignModal.tsx (611 LOC) `[CITED]`
- (a) `InfoTooltip`, `OuronetAddressHighlight`,
  `cfm/{ZbomLayout,FunctionInfoZone,PatronZonePattern2,Zone2Wrapper,
  SigningZone,StringEntryInput,AuthPathZone + type AuthPathSelection}`,
  lucide (`Copy,Crown,Loader2,Lock`).
- (b) `Modal`, `useWallet()` → `{ setCurrentTransaction }` (L169),
  `usePatronSelectionDefaults`, `useCFMStrategy` (Pattern A),
  `txPending`, `pactQueryCache`, `@/ouro`.
- (c) `Pact`; `getIgnisBalance`; `getKadenaAccountGuard`
  (ouronet-core/interactions/ouroAccountFunctions); `pactRead`; constants;
  `buildRotateSovereignPactCode`; `safeCreationTime,mayComeWithDeimal`;
  type `IKeyset`.

### RotateGovernorModal.tsx (511 LOC) `[CITED]`
- (a) `InfoTooltip`, `cfm/{ZbomLayout,FunctionInfoZone,PatronZonePattern2,
  Zone2Wrapper,SigningZone,inputs→StringEntryInput,NonKeyGuardEntryInput,
  governorSerialize→serializeGovernorToInput + type NonKeyGuardValue}`,
  lucide (`Gavel,Loader2`).
- (b) `Modal`, `useWallet()` → `{ setCurrentTransaction }` (L98),
  `usePatronSelectionDefaults`, `useCFMStrategy` (Pattern A), `txPending`,
  `pactQueryCache`, `@/ouro`.
- (c) `Pact`; `getIgnisBalance`; `getKadenaAccountGuard`; `pactRead`;
  constants; `buildRotateGovernorPactCode,buildNonKeyGuardExpr +
  type NonKeyGuardConstructor` (ouronet-core/pact); `safeCreationTime,
  mayComeWithDeimal`; type `IKeyset`.

### ActivateStandardAccountModal.tsx (615 LOC) `[CITED]`
- (a) `InfoTooltip`, `StoaChainBrand`, `cfm/{ZbomLayout,FunctionInfoZone,
  Zone2Wrapper,inputs→StringEntryInput,GuardEntryInput + type
  GuardChangeValue}`, `Switch` (`@/components/ui/switch`), `Input`
  (`@/components/ui/input`), lucide.
- (b) `Modal`, `useSelector`/`RootState` (`@/redux/store` — direct Redux read,
  **strongest seam**), `useWallet()` → `{ setCurrentTransaction }` (L175),
  `useCFMStrategy` (Pattern A), `txPending`, `pactQueryCache`.
  NOTE: does **NOT** import `usePatronSelectionDefaults` (no patron zone —
  Activate is payer-driven via CodexPrime Key #0).
- (c) `activateFunctions` (ouronet-core/interactions);
  `publicKeyFromPrivateKey,publicKeyFromExtendedKey`;
  `buildDeployStandardAccountPactCode`; `safeCreationTime`; `Pact`;
  ouronet-core/constants (`KADENA_NAMESPACE,STOA_AUTONOMIC_OURONETGASSTATION`);
  `KADENA_CHAIN_ID,KADENA_NETWORK`.

---

## 2. Shared cfm component inventory (transitive set used by the 7)

Used directly: ZbomLayout, FunctionInfoZone, PatronSpend, Zone2Wrapper,
SigningZone, inputs, AuthPathZone, governorSerialize. Transitive pulls below.

| cfm file | purpose | data-seam deps `[CITED]` |
|---|---|---|
| `ZbomLayout.tsx` | scrollable modal body shell + debouncer mount | `useAppSelector` (redux), `CfmScrollArea`, `ZbomDebouncer` (`@/components/debouncer`), `PactQueryTier` type |
| `FunctionInfoZone.tsx` | Zone-1 read-state + cost display, collapsible | `useSelector`/`RootState`; pure-core `mayComeWithDeimal`; pulls `IgnisCostDisplay`,`KadenaCostDisplay` (settings) |
| `PatronSpend.tsx` (`PatronZonePattern2`) | Zone-2 patron picker + IGNIS spend + auto-select | `useSelector`/`RootState`, `useWallet()`, `getIgnisBalance` (core), `analyzeGuard,buildCodexPubSet` (core), `InfoTooltip`, `formatEU` (`@/lib/utils`), ReactDOM portal |
| `Zone2Wrapper.tsx` | collapsible Zone-2 frame + meta header | `useSelector`/`RootState`, `FunctionMetaProp` (`@/constants/functionAnnotation`) |
| `SigningZone.tsx` | Zone-3 guard satisfaction + manual key entry | `useSelector`/`RootState`, `useWallet()`, `ManualKeyInput` (`@/components/ui`), core guard fns, `IOuroAccount` |
| `inputs.tsx` | StringEntry/Guard/Bool/NonKeyGuard/Amount inputs + Codemirror pact editor | `AddressBookPicker`, `StoicTagPicker`, `toast`, `describeKeyset`+`IDescribedKeyset`(core), `NonKeyGuardConstructor`(core), `CodeMirror`+`@codemirror/*`, `@/lang-pact`+`pact-theme`, `pactRead`(core) |
| `AuthPathZone.tsx` | Σ. smart-account auth-branch selector (sovereign/governor/account) | `useWallet()`, `ManualKeyInput`, core guard fns |
| `PatronZone.tsx` | `PatronIgnisBar`,`InsufficientIgnisAlert` presentational | `formatIgnisTrunc` (./format) — **pure UI** |
| `zones.tsx` | `ZONE,ZoneHeader,SignerRow,CapRow` primitives | `InfoTooltip` — **pure UI** |
| `format.ts` | `formatIgnisTrunc` wraps core `formatEU` | **pure** (core only) |
| `governorSerialize.ts` | serialize governor guard → input value | `detectGuardKind`+guard types from `settings/GuardTree` (**needs GuardTree port**), `NonKeyGuardConstructor`(core) — pure logic |
| `index.ts` | cfm barrel | re-export only |

Transitive non-cfm pulled BY cfm (must also port): `IgnisCostDisplay`,
`KadenaCostDisplay`, `settings/GuardTree` (for governorSerialize +
detectGuardKind/UserGuard types), `AddressBookPicker`, `StoicTagPicker`,
`@/components/debouncer` (ZbomDebouncer), `CfmScrollArea`, `@/lib/utils.formatEU`,
`@/constants/functionAnnotation`, `@/lang-pact` (Codemirror pact lang+theme).

**cfm files NOT used by the 7** (skip): `CollapsibleZone`, `InfoZoneWrapper`,
`InlineSigningCollapsible`, `ZbomExecuteZone`, `PositionCard`, `ResidentSpend`,
`PaymentKeySpend`, `UrStoaSigningSection` — these serve DEX/CFM modals not in
this port set. `[CITED]` (no import of them across the 7).

---

## 3. Leaf-component + hook inventory

| dep | path (OuronetUI) | purpose | class |
|---|---|---|---|
| `StoicTagDisplay` | `components/StoicTagDisplay.tsx` | render a StoicTag chip + copy | **pure UI** (lucide only) — but package already has `ui/StoicTagDisplay.tsx`, reconcile |
| `ManualKeyInput`/`PaymentKeyInput` | `components/ui/ManualKeyInput.tsx` | progressive private-key entry to satisfy guard | **pure UI** (`tryDerivePublicKey` core, `Input`) — package has `ui/zbom/ManualKeyInput.tsx` (different prop shape!) |
| `InfoTooltip` | `components/settings/InfoTooltip.tsx` | radix tooltip wrapper | **pure UI** (radix) |
| `characterSet` | `lib/dalos/characterSet.ts` | DALOS glyph filter + `MAX_STOIC_TAG_GLYPHS` | **pure** (no deps) — package has `ui/internal/dalosGlyphs.ts`, check parity |
| `usePatronSelectionDefaults` | `hooks/usePatronSelection.ts` | seed patronMode from uiSettings | **data-seam** (redux) — **package equivalent EXISTS** `zbom/patron/usePatronSelectionDefaults.ts` |
| `useEnsureCodexUnlocked` | `hooks/useEnsureCodexUnlocked.ts` | async unlock guard before execute | **data-seam** — thin wrapper over package `useCodexAuth`+`useCodex`; reimplement package-internally |
| `useCFMStrategy` | `lib/signing/useCFMStrategy.ts` | memoized `CodexSigningStrategy` | **data-seam** — it is ALREADY a shim over package `useSignTransaction`. Replace with `useSignTransaction({requestForeignKey}).strategy` |
| `@/ouro` types | `ouro.d.ts` | `IOuroAccount,IKadenaSeed,IKadenaWallet` | **data-seam (type)** → package `types/entities.ts` |
| `Modal` | `components/ui/Modal/Modal.tsx` | react-modal chrome (`isOpen,onClose,width,shouldCloseOnOverlayClick,shouldCloseOnEsc`) | **data-seam / GAP** — depends on `react-modal` (not a package dep). Use package `ui/internal/CodexModalShell.tsx` |
| `txPending` (toast-manager) | `lib/toast-manager.ts` | multi-step tx toast controller | **data-seam / GAP** — sonner-based, app-level. No package equivalent |
| `OuronetAddressHighlight` | `components/OuronetAddressHighlight.tsx` | highlight ouronet address glyphs | **pure UI** — package has `ui/internal/OuronetAddressHighlight.tsx` |

---

## 4. DATA-SEAM MAPPING TABLE  (the load-bearing deliverable)

| OuronetUI dep | Package equivalent | Status |
|---|---|---|
| `useCFMStrategy()` → `CodexSigningStrategy` | `useSignTransaction({ requestForeignKey }).strategy` (`hooks/useSignTransaction.ts`) | **EXISTS** `[VERIFIED]` |
| `useEnsureCodexUnlocked()` | compose `useCodexAuth().{getCurrentPassword,authenticate}` + `useCodex().uiSettings.passwordCacheMinutes` (port the 15-line hook into pkg) | **NEEDS-CREATING** (deps EXIST) `[VERIFIED]` |
| `usePatronSelectionDefaults()` | `zbom/patron/usePatronSelectionDefaults.ts` | **EXISTS** `[CITED]` (reads `useCodex().uiSettings`, store-backed) |
| `usePatronAutoSelect` (used inside PatronZonePattern2) | `zbom/patron/usePatronAutoSelect.ts` | **EXISTS** `[CITED]` |
| `useWallet().getKadenaKeyPairsByPublicKey(pub)` | `useGetKeypair()` → `(pub) => Promise<IKadenaKeypair>` (`hooks/useGetKeypair.ts`) | **EXISTS** `[VERIFIED]` — note: throws `CodexKeyMissingError` instead of returning null; rewire callers to try/catch instead of `if (kp)` |
| `useWallet().setCurrentTransaction(raw)` | **none** — package has no tx queue | **NO-EQUIVALENT-FLAG** `[CITED]` (see Gaps) |
| `useWallet().requestForeignKey` | `InternalCodexResolver` `requestForeignKey` option, passed via `useSignTransaction({requestForeignKey})` | **EXISTS as seam** `[VERIFIED]` — but no UI modal in pkg; default fail-fast |
| `useWallet().getCurrentPassword()` | `useCodexAuth().getCurrentPassword()` / `useRequestPassword()` | **EXISTS** `[VERIFIED]` |
| `useSelector(s => s.wallet.uiSettings.*)` (Activate) | `useCodex().uiSettings` (`hooks/useCodex.ts`) | **EXISTS** `[VERIFIED]` |
| `@/redux/store` `RootState`/`useAppSelector`/`useSelector` (cfm zones) | package Zustand store via `useCodexStore()` / `useCodex()` | **EXISTS** — every cfm `useSelector(RootState)` rewires to a store selector `[CITED]` |
| `@/components/ui/Modal` (react-modal) | `ui/internal/CodexModalShell.tsx` (`{title,subtitle,onClose,accent,children}`) | **EXISTS (different shape)** `[CITED]` — wrap clones in CodexModalShell, not `Modal isOpen` |
| `txPending(title)` toast controller | **none** | **NO-EQUIVALENT-FLAG** `[CITED]` (see Gaps) |
| `pactQueryCache.triggerPostTx()` | `zbom/debouncer/useZbomRefresh.ts` (post-tx refresh) + `useAccountChainData().refresh` | **PARTIAL** `[CITED]` — pkg uses a debouncer/refresh hook, not a global cache singleton |
| `@/ouro` (`IOuroAccount` etc.) | `types/entities.ts` (`IOuroAccount,IKadenaSeed`) | **EXISTS** `[VERIFIED]` — confirm `IKadenaWallet` alias exists in pkg types |
| `ManualKeyInput`/`PaymentKeyInput` | `ui/zbom/ManualKeyInput.tsx` (prop shape `{label,foreignKeys,resolved,neededMore,onResolve}`) | **EXISTS (diverged)** `[CITED]` — OuronetUI `ManualKeyInput` props differ; clone the OuronetUI one verbatim to a new file to preserve behavior |
| `StoicTagDisplay` | `ui/StoicTagDisplay.tsx` | **EXISTS** `[CITED]` — verify prop parity (`{tag,hideCopy}`) before reuse vs re-clone |
| `OuronetAddressHighlight` | `ui/internal/OuronetAddressHighlight.tsx` | **EXISTS** `[CITED]` |
| `characterSet` (dalos glyphs) | `ui/internal/dalosGlyphs.ts` | **EXISTS (verify parity)** `[CITED]` — confirm `filterToDalosGlyphs`+`MAX_STOIC_TAG_GLYPHS` present |
| `settings/GuardTree` (`detectGuardKind`, guard types) | `ui/internal/GuardTree.tsx` | **EXISTS (verify exports)** `[CITED]` — governorSerialize needs `detectGuardKind`+`UserGuard/CapabilityGuard/KeysetGuard/KeysetRefGuard` |
| `IgnisCostDisplay` / `KadenaCostDisplay` | `ui/zbom/CostRow.tsx` (simplified) | **PARTIAL** `[CITED]` — clone the two OuronetUI cost displays for faithful FunctionInfoZone |
| `AddressBookPicker` / `StoicTagPicker` (inputs.tsx) | `useAddressBook()` exists; no picker UI in pkg | **NEEDS-CREATING** `[CITED]` — port the picker components (data via `useAddressBook`) |
| `@/components/debouncer` (`ZbomDebouncer`) | `zbom/debouncer/{DebouncerCircle,useZbomRefresh,useZbomInfoRead}.ts` | **EXISTS** `[CITED]` — reconcile ZbomLayout's debouncer mount with pkg debouncer |
| `@/lib/utils.formatEU` | core `formatEU` (`@stoachain/stoa-core/pact`) | **EXISTS (use core)** `[CITED]` |
| `@/lang-pact` Codemirror pact lang/theme (inputs.tsx) | **none** | **NEEDS-CREATING / GAP** `[CITED]` — Codemirror pact editor for GuardEntryInput |
| core interactions/pact/guard/constants (group c) | identical subpath imports | **EXISTS (verbatim)** `[VERIFIED]` — pkg peer-deps same triplet |

---

## 5. GAPS / RISKS

1. **`setCurrentTransaction(raw)` — NO package equivalent.** `[CITED]`
   OuronetUI pushes the raw signed tx into a Context-backed transaction
   queue (`transaction-context.tsx`) that drives the global tx-status poller.
   The package has no tx queue. **Rewire decision needed**: either (a) emit a
   callback prop (`onTransactionSubmitted?(raw)`) the consumer wires to its own
   queue, or (b) drop it and rely on the debouncer refresh + requestKey return.
   Recommend (a) — keeps the modal faithful, lets OuronetUI re-supply its queue.

2. **`txPending(title)` toast controller — NO package equivalent.** `[CITED]`
   Sonner multi-step toast (`_tx.submitted/_tx.fail`). Package can't depend on
   sonner. **Rewire decision**: thread an optional `onStatus`/toast adapter prop,
   or inline a minimal no-op + return requestKey/error to the CodexModalShell's
   `ModalFeedback` (which already renders `{error, requestKey}` `[CITED]`).
   Recommend mapping `_tx.submitted/fail` → `ModalFeedback` state.

3. **`@/components/ui/Modal` (react-modal) — chrome mismatch.** `[CITED]`
   The 7 modals wrap content in `<Modal isOpen onClose width={600}
   shouldCloseOnOverlayClick={false} shouldCloseOnEsc={false}>`. Package has
   no react-modal dep; `CodexModalShell` (`{title,subtitle,onClose,accent}`)
   is the equivalent. **Risk**: CodexModalShell auto-renders a title/close
   header — the OuronetUI modals render their OWN header inside ZbomLayout.
   Decide: extend CodexModalShell with a `chromeless`/`bare` mode, or add a
   thin react-modal-free overlay matching OuronetUI's width/no-overlay-close.

4. **`pactQueryCache.triggerPostTx()` — partial.** `[CITED]` Global query-cache
   singleton invalidation. Package equivalent is the per-mount debouncer
   refresh (`useZbomRefresh`) + `useAccountChainData().refresh`. **Risk**: timing
   — OuronetUI fires a global post-tx sweep; the package must call the mounted
   tab's `refresh()` after submit. Wire the modal's success path to a
   `onSubmitted` → tab `refresh()`.

5. **`useCFMStrategy` `extraSigners`/`resolvedForeignKeys` execute options.**
   `[CITED]/[VERIFIED]` `strategy.execute({ build, guards, paymentKey,
   resolvedForeignKeys })` is supported by `InternalCodexResolver`
   (`requestForeignKey` + resolvedForeignKeys path). **Verify** the package
   `CodexSigningStrategy.execute` signature accepts the SAME option keys
   (`guards`, `paymentKey`, `resolvedForeignKeys`) — both consume the SAME
   `@stoachain/stoa-core/signing` `CodexSigningStrategy`, so the shape is
   identical. No `extraSigners` key seen in the 7 (Pattern-B modals build
   signer keys manually then call core interaction fns, bypassing strategy).

6. **Pattern-B keypair resolution behavior change.** `[CITED]/[VERIFIED]`
   OuronetUI `getKadenaKeyPairsByPublicKey(pub)` returns null on miss
   (`if (kp) keys.push(kp)`); package `useGetKeypair()` THROWS
   `CodexKeyMissingError`. **Rewire**: wrap each call in try/catch returning
   null to preserve the "skip missing key, fall through to manual" semantics.

7. **`ActivateStandardAccountModal` reads Redux directly** (`useSelector
   /RootState`, L23-24). `[CITED]` Strongest seam — map each selector to
   `useCodex()` fields. Confirm which uiSettings keys it reads (kadena-split
   receivers/amounts config) have package store equivalents.

8. **`inputs.tsx` Codemirror pact editor + AddressBook/StoicTag pickers.**
   `[CITED]` Heavy leaf deps (`@uiw/react-codemirror`, `@codemirror/*`,
   `@/lang-pact`). GuardEntryInput/NonKeyGuardEntryInput embed a live pact
   editor. **Risk**: large surface, new package deps. If the 7 modals only use
   `StringEntryInput`/`GuardEntryInput`/`BoolEntryInput`/`NonKeyGuardEntryInput`,
   port only those input variants + their editor; defer the rest.

---

## 6. RECOMMENDED PORT ORDER

**Wave 0 — confirm/reconcile existing package leaves** (avoid double-porting):
verify parity of `ui/StoicTagDisplay`, `ui/internal/OuronetAddressHighlight`,
`ui/internal/dalosGlyphs`, `ui/internal/GuardTree` exports, `types/entities`
(`IKadenaWallet` alias). Decide reuse-vs-reclone per #4.

**Wave 1 — pure-UI leaf foundation** (copy verbatim, no data layer):
`InfoTooltip`, OuronetUI-shape `ManualKeyInput`+`PaymentKeyInput` (new file,
preserve original props), `characterSet` parity, cfm `zones.tsx`,
`PatronZone.tsx`, `format.ts`, `IgnisCostDisplay`/`KadenaCostDisplay` clones,
`StoaChainBrand`, `Switch`/`Input` primitives.

**Wave 2 — data-seam hooks** (the rewire spine):
package-internal `useEnsureCodexUnlocked` (compose useCodexAuth+useCodex);
confirm `useSignTransaction`/`useGetKeypair`(try-catch wrapper)/
`usePatronSelectionDefaults`/`usePatronAutoSelect`. Decide #5.1 (`onTransactionSubmitted` prop) and #5.2 (toast→ModalFeedback) contracts NOW — every modal depends on them.

**Wave 3 — cfm zone components** (depend on Wave 1+2):
`ZbomLayout` (rewire useAppSelector→store, reconcile debouncer),
`FunctionInfoZone`, `Zone2Wrapper`, `SigningZone`, `PatronSpend`
(`PatronZonePattern2`), `AuthPathZone`, `inputs.tsx` (StringEntry/Guard/Bool/
NonKeyGuard only), `governorSerialize` (needs GuardTree). AddressBook/StoicTag
pickers + Codemirror per #8.

**Wave 4 — the 7 modals** (depend on Wave 1-3). Port order by complexity:
1. `RotateGuardModal` + `RotatePaymentKeyModal` (Pattern B, no patron-strategy
   coupling — simplest seam: just `useGetKeypair` try/catch + core interaction).
2. `RegisterStoicTagModal` + `ReleaseStoicTagModal` (Pattern A + StoicTag).
3. `RotateSovereignModal` + `RotateGovernorModal` (Pattern A + AuthPathZone /
   governorSerialize).
4. `ActivateStandardAccountModal` (heaviest Redux seam, no patron zone — do last).

**Wave 5 — rewire `OuronetAccountsTab.tsx`** to mount the 7 cloned modals the
OuroAccountList way. `[CITED]` Replace the single `<ZbomOperationModal
operation={...}>` (L411-418) with 7 conditional mounts keyed off the existing
`activeOpId` triggers (L268/291/303/304/326/341/390):
`activeOpId === "rotate-payment-key"` → `<RotatePaymentKeyModal open
onClose={()=>setActiveOpId(null)} account={account} accounts={accounts}
kadenaSeeds={seeds} kadenaAccounts={...} />`, etc. (mirror OuroAccountList
L892-951 JSX). Smart-only modals (sovereign/governor) gate on account prefix
as OuroAccountList does (L913/925 conditional). Then DELETE the scrapped
abstraction: `ui/zbom/ZbomOperationModal.tsx`, `zbom/operations/*` descriptors,
and the simplified `ui/zbom/{zones,SigningZone,PatronZone,AuthPathZone,
FunctionInfoZone,inputs,ManualKeyInput}.tsx` once the faithful clones land.

**Wave 6 — barrel + export reconciliation**: update `ui/zbom/index.ts` and
`zbom/index.ts` to export the 7 clones; remove `ZbomOperationModal` exports
from `ui/index.ts` (L63/L85). Typecheck.

---

## 7. DECISIONS LOCKED (supersedes §5 recommendations)

These are user-confirmed and OVERRIDE the "recommend (a)" fallbacks in §5.
Any implementer MUST follow these, not the §5 recommendations.

### 7.1 Golden rule — literal clone
Copy each OuronetUI source file **VERBATIM**, then apply ONLY these mechanical
transforms. Do NOT redesign, simplify, rename titles, or "improve" anything.
- **(T1) Import rewrites** per the §4 data-seam table (Redux/Context/useCFMStrategy
  → package Zustand store + package hooks). ESM: every relative import gets a
  `.js` extension (tsc `--module nodenext` build).
- **(T2) Data-seam swaps** per §4 (e.g. `useSelector(RootState)` → `useCodex()`
  selector; `getKadenaKeyPairsByPublicKey` → `useGetKeypair()` in try/catch).
- **(T3) Modal frame swap** per 7.4.
- **(T4) toast/tx swap** per 7.2.
Keep every `className` string **verbatim** (see 7.5). Keep titles verbatim
("Add StoicTag", NOT "Register StoicTag"). Keep § glyph inputs, cost rows,
Zone2 collapse, signing UI pixel-identical.

### 7.2 Toast + tx-queue — PORT THE TOAST SYSTEM (overrides §5 #1, #2, #4)
Do NOT thread `onTransactionSubmitted` callbacks or map to `ModalFeedback`.
Instead clone OuronetUI's toast system INTO the package so it owns multi-step
toasts end to end:
- Port `lib/toast-manager.ts` → `src/zbom/toast/toastManager.ts`
  (`toastStore`, `createMultiStepToast`, `txPending`, `onTxConfirmed`,
  `_pollConfirmation`). Rewire `pactQueryCache.triggerPostTx()` →
  the package post-tx refresh callback (7.3 tier-shim `triggerPostTx` +
  `useZbomRefresh.triggerRefresh()`).
- Port `components/ui/MultiStepToast.tsx` → `src/zbom/toast/MultiStepToastContainer.tsx`.
  Substitute `react-icons/pi` → `lucide-react` (PiCheck→Check, PiWarning→
  AlertTriangle, PiSpinnerGap→Loader2, PiCopy→Copy, PiX→X,
  PiArrowSquareOut→ExternalLink). Keep `createPortal` to body, fixed
  bottom-right, `EXPLORER_TX="https://explorer.stoachain.com/transactions/"`.
- `setCurrentTransaction(raw)` is REPLACED by the cloned toast's
  `_tx.submitted(requestKey, chainId)` polling path — NOT a callback prop.
  Mount `<MultiStepToastContainer/>` once inside the package CodexProvider tree.
- The 7 modals call `txPending(title)` exactly as OuronetUI does — verbatim.

### 7.3 Debouncer — PACKAGE OWNS A FAITHFUL CLONE (overrides §5 #4 partial)
Clone the EXACT bar (codex-lock oval + 7 tier circles), do NOT port the global
`pactQueryCache` scheduler:
- Port `lib/pact-query-tiers.ts` → `src/zbom/debouncer/pactQueryTiers.ts`
  (`TIER_CONFIGS,ALL_TIERS,getTierConfig/Interval/Color/Name`).
- Create a package-local `tierClock` singleton shim → provides per-tier
  `{queryCount,remaining,isFetching}` + subscribe, plus `triggerPostTx()`.
  Replaces `pactQueryCache.getTierState(tier)`.
- Port `hooks/useDebouncerState.ts` → reads the `tierClock` shim.
- Clone `components/debouncer/ZbomDebouncer.tsx` → `src/zbom/debouncer/ZbomDebouncer.tsx`:
  `ZbomCodexLockOval` countdown driven by the package password cache (REAL:
  `useCodexAuth().passwordCacheExpiresAt`, click-to-unlock via package unlock);
  7 `CompactTierCircle` driven by the `tierClock` shim (visually identical, self-
  contained). `DEFAULT_ZBOM_TIERS=['T1','T2','T3']`.
- `ZbomLayout` mounts it at top: `<div className="flex justify-center pb-2">
  <ZbomDebouncer activeTiers={...}/></div>` — verbatim. This is the "missing
  debounce from the upper part" the user reported.

### 7.4 Modal frame — chromeless overlay, NOT CodexModalShell auto-header
The 7 modals render their OWN header inside `ZbomLayout`. `CodexModalShell`
auto-renders a title/close header → would double up. Create a chromeless
`src/zbom/ui/ZbomModalFrame.tsx`: plain `position:fixed` overlay (no react-modal,
no framer-motion), `width:600`, NO overlay-click / NO esc close (match
OuronetUI `<Modal shouldCloseOnOverlayClick={false} shouldCloseOnEsc={false}>`),
dark dialog surface matching `_dialog.css`. The clones wrap content in
`<ZbomModalFrame open onClose ...>` exactly where OuronetUI used `<Modal>`.

### 7.5 CSS — KEEP TAILWIND CLASSES VERBATIM (RESOLVED 2026-06-01)
OuronetUI's Tailwind v4 uses `@config tailwind.config.cjs`; its `content` glob
did NOT scan `node_modules`, so package-only Tailwind classes (esp. arbitrary-
value / rare utilities) were never generated → the "looks totally different /
broken" symptom. **Fix applied:** added
`"./node_modules/@ouronet/ouronet-codex/dist/**/*.js"` to the OuronetUI
`tailwind.config.cjs` content array. THEREFORE:
- Keep every OuronetUI `className` string **verbatim** in the clones (do NOT
  convert to inline styles — inline can't express `hover:`/`dark:`/responsive,
  which would HARM fidelity).
- Custom GLOBAL classes (`btn-aura-tx`, `input-label-active`, `ghost-input`,
  `ghost-input-textarea`, `coil-modal-scroll`, `grid-dashboard-header`, etc.)
  live in OuronetUI `src/index.css` and load globally — clones reference them
  by name; do NOT re-port the CSS.
- Package-internal design tokens still ship via `dist/ui.css` (existing
  `copy:ui-css`). Other consumers (HUB) must likewise add the dist glob to
  their Tailwind content (document in package README).

### 7.6 Build / deploy discipline
- Build with `npm run build` (`tsc -p tsconfig.build.json` — stricter than
  vitest) inside `packages/ouronet-codex` after EACH wave; fix type errors
  before proceeding.
- Do NOT `git push` (commit locally only; user pushes via /wasp:cross-pollinate).
- After copying fresh dist into `OuronetUI/node_modules`, tell the user to
  restart Vite with `--force` (optimizeDeps prebundle is package.json-hash-keyed
  and won't see node_modules file mutations).
- Bumping the ouronet-codex pin requires updating OuronetUI footer
  (`integratedPackages.ts`) + changelog/version surfaces — not just package.json.

### 7.7 Dependency faithfulness (resolved 2026-06-01)
When a clone leaf depends on a library the package lacks, ADD that library as a
package dependency rather than substituting a lesser primitive — substitution is
what produced the "looks totally different" failure.
- `@radix-ui/react-tooltip` → add as package **dependency**. `InfoTooltip`
  renders a STYLED radix hover card (dark surface, border, arrow); the old
  `ui/zbom/zones.tsx` swapped it for a native `title` tooltip (OS-styled, plain)
  — NOT faithful. Clone `InfoTooltip` verbatim. Each InfoTooltip wraps its own
  `Tooltip.Provider`, so duplicate radix instances alongside the host are
  harmless. (react is already a peer dep.)
- Codemirror (`@uiw/react-codemirror`,`@codemirror/*`,`@lezer/*`) is only needed
  by `inputs.tsx` GuardEntryInput/NonKeyGuardEntryInput pact editors. Add those
  deps ONLY when porting `inputs.tsx` (Wave 3); confirm the 7 modals actually
  render a live pact editor before pulling the full set (some use plain
  textareas). Defer/measure.
  - **MEASURED + DECIDED 2026-06-02:** GuardEntryInput (RotateGuard, Activate) and
    NonKeyGuardEntryInput (RotateGovernor) DO render live CodeMirror Pact editors
    (`inputs.tsx:1303` `CM_EXTENSIONS = [pact(), lineWrapping, autocompletion(...)]`).
    User chose the **full CodeMirror + Lezer clone** (pixel-faithful) over a
    StreamLanguage approximation. Runtime deps added to the published package:
    `@uiw/react-codemirror`, `@codemirror/language`, `@codemirror/autocomplete`,
    `@codemirror/view`, `@codemirror/state`, `@lezer/highlight`, `@lezer/lr`,
    plus `sonner` (inputs.tsx copy-hint toast). **Lezer grammar build seam:**
    OuronetUI compiles `lang-pact/pact.grammar` via a Vite plugin; the package
    builds with `tsc` only, which can't process `.grammar`. So the parser is
    PRE-GENERATED once with `@lezer/generator` (devDep) into a committed
    `src/zbom/lang-pact/pact.parser.js` + hand-written `pact.parser.d.ts`, and the
    cloned `lang-pact/index.ts` imports `./pact.parser.js` instead of
    `./pact.grammar`. A `copy:pact-parser` step (like `copy:ui-css`) copies the
    generated `.js`/`.d.ts` into `dist/`. This preserves the EXACT Lezer parser
    behaviour (faithful) while staying tsc-buildable. The `.grammar` source is
    kept in-tree for reference + regeneration. This is a build-tooling adaptation,
    not a behavioural change.
- `react-dom` (createPortal) — already a peer dep; toast container + PatronSpend
  portal use it directly.
- **Wave 1 leaves forced these deps (added 2026-06-01):** cloning `Input`/
  `Switch`/`cn` verbatim pulls `clsx ^2.1.1`, `tailwind-merge ^2.6.0`, and
  `@radix-ui/react-switch ^1.1.3` as package **dependencies**. `cn` is the
  literal OuronetUI `lib/utils.ts` `twMerge(clsx(...))`; `Input` is the shadcn
  base whose theme-token classes resolve against the host's Tailwind vars; the
  modals' visible look comes from inline-style overrides on top.
- **Rules-of-hooks reorder (ManualKeyInput):** OuronetUI's original calls the
  `useCallback` AFTER the `if (neededMore <= 0) return null;` early return — a
  latent rules-of-hooks violation. The clone moves the early return BELOW the
  hook (behaviorally identical, fixes the conditional-hook order). This is a
  mechanical correctness fix, not a design change.

### 7.8 Target directory layout (clones live under `src/zbom/`)
Mirror OuronetUI structure under the package `zbom/` subtree; the OLD descriptor
abstraction under `src/ui/zbom/*` is DELETED in Wave 5.
- `src/zbom/cfm/` ← faithful clones of OuronetUI `components/cfm/*`
  (zones, PatronZone, format, ZbomLayout, FunctionInfoZone, Zone2Wrapper,
  SigningZone, PatronSpend, AuthPathZone, inputs, governorSerialize).
- `src/zbom/modals/` ← the 7 faithful `components/settings/*Modal.tsx` clones.
- `src/zbom/ui/` ← ZbomModalFrame (chromeless overlay), InfoTooltip,
  ManualKeyInput/PaymentKeyInput (OuronetUI-shape), IgnisCostDisplay/
  KadenaCostDisplay, AddressBookPicker/StoicTagPicker.
- `src/zbom/toast/` ← toastManager + MultiStepToastContainer.
- `src/zbom/debouncer/` ← (exists) + pactQueryTiers, tierClock, useDebouncerState,
  faithful ZbomDebouncer.
- `src/zbom/hooks/` ← useEnsureCodexUnlocked. (`useUnlockGuardedStrategy`
  DROPPED — see §7.9.)
- SHARED leaves already present → REUSE: `src/ui/StoicTagDisplay.tsx`,
  `src/ui/internal/{OuronetAddressHighlight,dalosGlyphs,GuardTree}`.
- Types: extend `src/types/entities.ts` (add `IKadenaWallet`, `WalletAccount`,
  `SeedType` if absent — match OuronetUI `ouro.d.ts` shapes verbatim).

### 7.9 `useUnlockGuardedStrategy` dropped (resolved 2026-06-01)
The Wave-2 plan listed a composed `useUnlockGuardedStrategy` (useSignTransaction
+ useEnsureCodexUnlocked). DROPPED. OuronetUI's modals do NOT have such a
wrapper — each modal calls `useCFMStrategy()` and `useEnsureCodexUnlocked()`
separately, then inlines `if (!(await ensureUnlocked())) return; await
strategy.execute(...)` in its execute handler. Introducing a package-only
combined hook would make the modal bodies diverge from the verbatim clone
(§7.1 golden rule). So the package mirrors OuronetUI exactly: modals call
`useSignTransaction()` (== useCFMStrategy) + `useEnsureCodexUnlocked()` directly.
No combined hook. This keeps every modal code-for-code.
