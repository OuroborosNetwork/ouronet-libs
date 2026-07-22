# 04 — `@ouronet/ouronet-codex` package gaps (ZBOM execution port)

Research-only survey of the current package surface (`@ouronet/ouronet-codex` @ **0.4.0**) ahead of porting the REAL ZBOM execution (debouncer, patron, signing, on-chain submit) from OuronetUI. All paths absolute.

---

## 1. The existing ZBOM shell — `src/ui/zbom/`

Phase-1 "shell only" port. **Layout/zones are real; everything wired to chain/signing is placeholder.**

| File | Status | Notes |
|------|--------|-------|
| `ZbomModal.tsx` | **REAL** | Popup chrome + ZbomLayout structure (backdrop, centered card, close X, fixed top section, scrollable zones, top/bottom execute zone). Pure presentational — no chain IO, no signing. |
| `zones.tsx` | **REAL** | `ZoneHeader`, `SignerRow`, `CapRow` ported 1:1 from `cfm/zones.tsx`. Pure render primitives. |
| `CollapsibleZone.tsx` | **REAL** render; **PLACEHOLDER** state seam | Default-open comes from static `ZONE_DEFAULT_OPEN[zoneIndex]` (a `uiSettings.zbomZoneN` read is explicitly deferred "to a later phase"). |
| `InfoZoneWrapper.tsx` | **REAL** render; **PLACEHOLDER** seam | ZONE 0 (INFO) collapsible. `defaultOpen` hard-coded `true` (Redux `zbomZone0` read deferred). |
| `format.ts` | **REAL** | `formatIgnisTrunc` via `@stoachain/stoa-core/pact` `formatEU`. |
| `tokens.ts` | **REAL** | `MONO`, per-zone `ZONE` color map, `ZONE_DEFAULT_OPEN` (0 open, 1-3 closed), `ZoneIndex`/`ZoneKind` types. |
| `ZbomShellDemo.tsx` | **PLACEHOLDER** | Demo modal: 4 zones rendered with italic `placeholder(...)` text only. Execute button disabled ("Execute (wired in Phase 7)"). No IO. Also exports `ZbomShellDemoButton`. |
| `index.ts` | barrel | Re-exports all of the above; re-exported again from `src/ui/index.ts`. |

### `ZbomModal` props (the shell API to compose against)
```ts
interface ZbomModalProps {
  isOpen, onClose,
  header: ReactNode,                       // title + subtitle
  executeButton: ZbomExecuteButtonProps,   // { canExecute, isProcessing, onClick, bgColor, textColor, content, processingContent? }
  children: ReactNode,                      // ZONE 0–3
  headerExtra?: ReactNode,                  // e.g. mode tabs
  debouncerSlot?: ReactNode,                // **EMPTY HOOK for Phase 2 debouncer**
  stepIndicator?: ReactNode,
  executePosition?: "top" | "bottom",       // default "top" (replaces Redux zbomExecutePosition)
  maxWidth?: number,                        // default 540
}
```
The header doc explicitly says operations (Rotate*/Activate/StoicTag/Spawn) compose this with ZONES 0–3 as children and wire `executeButton.onClick` → `useSignTransaction.execute`. `debouncerSlot` is the designated mount point for the ported debouncer.

**What exists vs. what to port:** shell + zone primitives + execute-button chrome exist. MISSING: the debouncer (simulation/gas indicator), ZONE 0 INFO content (Pact preview + IGNIS cost), ZONE 1 patron selector, ZONE 2 typed inputs, ZONE 3 signing summary, and the operation assemblies that wire it to `execute`.

---

## 2. Rotate modals — FUNCTIONAL, not stubs

`src/components/RotateGuardModal.tsx`, `RotatePaymentKeyModal.tsx`, `RotateSovereignModal.tsx` are **fully functional headless modals**. Each:
- builds Pact code via `@ouronet/ouronet-core/pact` (`buildRotateGuardPactCode` / `buildRotateKadenaPactCode` / `buildRotateSovereignPactCode`);
- assembles the `Pact.builder` (gas station sender, `safeCreationTime`, `GAS_PAYER` cap, guard signers, data slots `ks`/`ks-account`);
- dispatches via `useSignTransaction().execute({ build, guards, paymentKey })`;
- handles `submitting`/`lastError`/`lastRequestKey`, optimistic local mirror via `useOuroAccounts().updateAccount`, and `onSuccess(requestKey)`.
- Pattern: render-prop (`render`/`renderSubmitButton`) over unstyled default semantic HTML.

`src/ui/internal/RotateModals.tsx` — three **styled wrappers** (`StyledRotateGuardModal` etc.) that feed `CodexModalShell` + styled form into the headless modals' `render` prop. Real popups; signing engine unchanged.

**Key:** these modals already prove the full execute path end-to-end (build → simulate/gas → resolve → sign → submit). They are the reference for how a ZBOM operation should call `execute`. They do NOT yet use `ZbomModal` chrome / zones — that is the port's job (re-skin Rotate* onto ZbomModal with ZONES 0–3).

---

## 3. State / settings gap — `UiSettings`

`src/types/entities.ts` `UiSettings` (and `DEFAULT_UI_SETTINGS`) currently first-class:
- `passwordCacheMinutes`, `selectedNode` (`node1|node2|custom`), `customNodeUrl`, `customNodeGasLimit`, `experimentalCurvesEnabled`
- `patronSelectionMode: "wealthiest" | "active-wallet" | "manual"`  ← **TYPE MISMATCH** (see below)
- `legacyKoalaSigning: boolean`  ← present in package
- `[extra: string]: unknown` escape hatch — lets OuronetUI stash any DEX/ZBOM keys without a typed field. Store action `updateUiSettings` (store.ts ~L1497) is a plain `{...prev, ...patch}` merge + persist — already round-trips unknown keys.

### Source of truth — OuronetUI `walletsSlice.ts` (lines 28–64)
`legacyKoalaSigning` is a **TOP-LEVEL** `IWalletState` field in OuronetUI (line 28), NOT inside `uiSettings`. The package folded it INTO `uiSettings` — acceptable but note the relocation. OuronetUI `uiSettings` object contains:
```
infoZoneOpen, poolFeeUnit, zbomProfile, zbomZone0..3, patronSelectionMode,
passwordCacheMinutes, zbomExecutePosition, poolMockupMode, poolMockSleeping,
poolMockFreezing, simStoicTagEnabled, simStoicTagValue, selectedNode,
customNodeUrl, customNodeGasLimit, experimentalCurvesEnabled
```

### Fields NOT yet first-class in the package (ZBOM/patron-related, to add)
| Field | OuronetUI type | Package status |
|-------|----------------|----------------|
| `zbomProfile` | `"simple" \| "basic" \| "advanced" \| "custom"` (default `"basic"`) | **MISSING** — comment in entities.ts wrongly calls it "OuronetUI-specific, stays in app state"; the port needs it. |
| `zbomZone0` / `zbomZone1` / `zbomZone2` / `zbomZone3` | `boolean` (defaults `true,false,false,false`) | **MISSING** — currently the static `ZONE_DEFAULT_OPEN`; CollapsibleZone/InfoZoneWrapper want to read these. |
| `zbomExecutePosition` | `"top" \| "bottom"` (default `"top"`) | **MISSING** — currently the `executePosition` prop default. |
| `patronSelectionMode` | **`"wealthiest" \| "prime" \| "resident"`** | **VALUE MISMATCH** — package has `"wealthiest" \| "active-wallet" \| "manual"`. Reconcile the union before patron-zone port (these are different vocabularies). |

`legacyKoalaSigning`: already in package `UiSettings`; only the OuronetUI relocation (top-level → uiSettings) to be aware of.
DEX/pool/sim fields (`infoZoneOpen`, `poolFeeUnit`, `poolMockupMode`, `poolMock*`, `simStoicTag*`) stay OuronetUI-only via `[extra]`.

---

## 4. Signing surface — `useSignTransaction` + resolver seam (ALREADY IN PACKAGE)

`src/hooks/useSignTransaction.ts` — the package's replacement for OuronetUI's `useCFMStrategy`.
```ts
useSignTransaction(options?: { requestForeignKey? }): {
  strategy: CodexSigningStrategy,          // from @stoachain/stoa-core/signing
  execute: CodexSigningStrategy["execute"],// bound; { build, guards, paymentKey } → { requestKey, raw }
  sign:    CodexSigningStrategy["sign"],   // bound
}
```
- Composes `InternalCodexResolver(store)` + a `PactClient` (`createClient(getPactUrl(KADENA_CHAIN_ID))`, or the provider's `signingClient` override).
- Memoised on `store`, `uiSettings.selectedNode`, `uiSettings.customNodeUrl`, `requestForeignKey`, `clientOverride` — so node switches rebuild the client.

`src/resolver/InternalCodexResolver.ts` — implements stoa-core `KeyResolver` (replaces `ReduxCodexResolver`). Three methods: `listCodexPubs()`, `getKeyPairByPublicKey(pub)` (auth-gated → `CodexLockedError`; pure-keypair + derived-seed paths; `CodexKeyMissingError`), `requestForeignKey(pub)` (fail-fast default, wireable to a modal). Reads the Zustand store fresh on every call.

**This is the seam the ported ZBOM execution plugs into — unchanged.** The Rotate* modals already exercise it; the ZBOM operations should do the same `execute({ build, guards, paymentKey })` call.

---

## 5. Subpath exports + build conventions

`package.json` @ **0.4.0**, `"type": "module"`, ESM-only, `sideEffects: false`.
Subpath exports map: `.`, `./adapters`, `./provider`, `./hooks`, `./components`, `./resolver`, `./errors`, `./codex-identity`, **`./ui`**, **`./ui.css`**, `./types`, `./google-drive`. Each `→ dist/<dir>/index.{js,d.ts}`.

- **Barrels:** every dir under `src/` has an `index.ts`; `./ui` barrel = `src/ui/index.ts` which re-exports the ZBOM surface from `./zbom/index.js` (ZbomModal, CollapsibleZone, InfoZoneWrapper, ZoneHeader, SignerRow, CapRow, ZONE, ZONE_DEFAULT_OPEN, formatIgnisTrunc, ZbomShellDemo(+Button) + types). **New ZBOM exports must be added here AND in `src/ui/zbom/index.ts`.**
- **Imports use explicit `.js`** extensions (NodeNext ESM): e.g. `import { ZbomModal } from "./ZbomModal.js"`.
- **Build:** `npm run build` = `tsc -p tsconfig.build.json && npm run copy:ui-css`. `tsconfig.build.json` emits to `dist/`, `rootDir: src`, excludes tests. `copy:ui-css` copies `src/ui/tokens.css → dist/ui.css` (the only non-tsc artifact; CSS is a build artifact, NOT a JS import — consumers `import "@ouronet/ouronet-codex/ui.css"`).
- **Deploy convention (per MEMORY):** triplet is a published peer-dep, but local dev copies the built `dist/` into `OuronetUI/node_modules/@ouronet/ouronet-codex/`. Currently installed there = **0.4.0** (UI `package.json` pin still `^0.3.0`). After copying a fresh dist, Vite must be restarted with `--force` (optimizeDeps prebundle is hash-keyed off package.json, won't see node_modules mutation). Publish requires version bump + CHANGELOG entry + README Status/history lines.
- **Peer deps:** `@stoachain/{kadena-stoic-legacy,stoa-core,ouronet-core} >=4.3.0`, `@ouronet/dalos-crypto >=4.0.0`, `@noble/curves 1.9.7`, `react ^18||^19`, `lucide-react >=0.400.0`. Only runtime dep: `zustand ^5`.

---

## 6. Provider / store seam + chain-read seam

`src/provider/CodexProvider.tsx` — per-mount Zustand store via `useRef(createCodexStore())`, exposed through **two** React contexts:
- `CodexStoreContext` → `useCodexStore()` (every hook reads/subscribes here).
- `SigningClientContext` → `useSigningClientOverride()` (optional `PactClient` override; only `useSignTransaction` consumes it).
Init effect (browser-only, SSR-safe) calls `actions.init(adapter, deviceVariant)` then applies first-boot `initialUiSettings`/`passwordCacheMinutes` overlay. Adapter is the only injected backend.

**Chain-read seam — there is NO package-local `pactRead`/`setPactReader`/`BalanceResolver`.** Grep confirms zero hits in `src/` (those seams live in `@stoachain/stoa-core/reads` + `@stoachain/stoa-core/wallet`, configured by the consumer at boot — OuronetUI wires its cache-aware reader). The package READS chain via that already-configured seam transitively:
- `src/ui/internal/useAccountChainData.ts` calls `getAccountSelectorData` (`@ouronet/ouronet-core/interactions/ouroAccountFunctions` → `ouronet-ns.DPL-UR.URC_0027_AccountSelectorMapper`), which routes through the consumer's `pactRead`. Exports `CODEX_CHAIN_READ_FUNCTIONS` for a read-deps drawer. Filters to DALOS (Ѻ./Σ.) addresses only.

**Implication for the port:** the ZBOM debouncer / ZONE-0 IGNIS-cost / patron-balance reads should use the SAME pattern — call an `@ouronet/ouronet-core/interactions/*` helper (or `pactRead` indirectly), NOT introduce a new reader injection. The consumer's `setPactReader` is already the seam. If patron-selection needs balances, check whether a `BalanceResolver`-backed path or an existing interactions helper covers it before adding anything.

---

## Summary of gaps to close in the port
1. **Debouncer** (simulation/gas live indicator) → mount in `ZbomModal.debouncerSlot`.
2. **ZONE 0–3 real content** (INFO/Pact-preview/IGNIS, patron selector, typed inputs, signing summary) → replace `ZbomShellDemo` placeholders.
3. **Wire zones to `useSignTransaction.execute`** following the Rotate* modal pattern (already proven).
4. **Promote `UiSettings` fields:** `zbomProfile`, `zbomZone0..3`, `zbomExecutePosition`, and **reconcile `patronSelectionMode` union** (`wealthiest|prime|resident` vs current `wealthiest|active-wallet|manual`). `legacyKoalaSigning` already present.
5. Chain reads go through existing `@ouronet/ouronet-core/interactions/*` + consumer `pactRead`; **no new reader seam**.
