# ZBOM / Debouncer Execution Core — Architecture Map

Research for the 1:1 port into `@ouronet/ouronet-codex`. **Read-only** survey of the
OuronetUI transaction-execution subsystem. All paths are absolute; line refs are to the
files as they exist at survey time.

---

## 1. What the "debouncer" IS (conceptually)

The **debouncer is NOT a per-call `setTimeout`**. It is a *single global read scheduler*
— one shared clock per refresh tier — that every on-chain read in the app subscribes to.
It solves three problems at once: (a) **batching** — N components watching the same
`pactCode` collapse to one network call; (b) **predictable refresh cadence** — instead of
random per-component spinners, every read is filed into one of 7 tiers (`T1`–`T7`) that
each fire on their own schedule; (c) **post-tx propagation** — after a submit, a fast tier
fires and cascades invalidation down to slow tiers so balances refresh in seconds, not
minutes.

The conceptual overview is authored in
`D:\_Claude\StoaOuronet\OuronetUI\src\routes\logged-in\debouncer-info.tsx` (the in-app
tutorial). Key statement (lines 140-144): **T2/T3/T4 are "one-shot"** (fire once, re-arm
only on trigger), **T5/T6/T7 are "continuous"** (cycle forever while mounted).

### Data flow: button → read → cost estimate → execute

Trace from the canonical modal
`D:\_Claude\StoaOuronet\OuronetUI\src\components\CoilCFMModal.tsx`:

1. **User types amount** → `infoPactCode` memo (CoilCFMModal.tsx:150-154) builds an
   `INFO_*` Pact-code string (e.g. `(...INFO-ONE.ATS|INFO_Coil <patron> <coiler> <ats> <rt> <amount>)`).
2. **`useT2Read(infoPactCode, amount)`** (line 156) debounces the keystroke through the
   T2 tier and returns `{ data, loading, error }`.
3. **Cost estimate** is read straight out of `infoData` — `ignisCost = infoData?.ignis?.["ignis-need"]`
   (line 101), `insufficientIgnis` (line 103). These drive `canExecute` (line 165) and the
   Execute button colour/label.
4. **Execute** (`handleExecute`, lines 170-220): builds the *execution* Pact code via a
   core builder (`buildCoilPactCode`), hands a `build()` closure to
   `strategy.execute({ build, guards, paymentKey })`. The strategy runs simulate → gas-calibrate
   → resolve keys → sign → submit. On success it calls `pactQueryCache.triggerPostTx()`
   (line 211) to kick the T4→T5/6/7 cascade.

So the read-side (cost estimate via T2) and the write-side (strategy.execute) are
**two distinct subsystems** glued in the modal. The debouncer/tier cache owns the read
side; the `CodexSigningStrategy` (separate seam, see §6) owns the write side.

---

## 2. State machine / lifecycle

There are **two layers of state**: the singleton `PactQueryCache` (the real machine) and
`useDebouncerState` (a thin React mirror for the UI).

### 2a. `PactQueryCache` tier clocks — the real state machine
`D:\_Claude\StoaOuronet\OuronetUI\src\lib\pact-query-cache.ts`

Per-tier `TierClock` (lines 52-57):
```ts
interface TierClock {
  lastTickAt: number;      // ts of last batch fetch (0 = never started, 1 = "force next tick")
  isFetching: boolean;     // batch in-flight
  manuallyActive: boolean; // pulse mode (T1 visual flash, no real query)
  paused: boolean;         // one-shot tier already fired; won't re-fire until resetTier
}
```

Per-query `CacheEntry` status is a 4-state enum (line 22):
`'fresh' | 'stale' | 'fetching' | 'error'`.

**Scheduler** (`tick()`, lines 80-112) runs every 1000ms. For each tier with `interval>0`:
skip if `isFetching` or `paused`; skip if no watched queries; if `lastTickAt===0` start the
clock without fetching; if `elapsed >= interval` call `refreshTier()`.

**`refreshTier`** (lines 115-176): mark entries `fetching` → fire all reads in parallel via
`rawCalibratedDirtyRead` (dedup against `pendingPromises`) → on settle set `fresh`/`error`.
Then the **one-shot vs continuous branch** (lines 165-174): `interval <= 10000ms`
(T2/T3/T4) → set `paused=true` (won't re-fire); else (T5/T6/T7) → reset `lastTickAt=now`
(re-arm for next cycle).

**Trigger transitions:**
- `resetTier(tier)` (386-394): `lastTickAt=now, isFetching=false, paused=false` — used by
  T2 on every keystroke.
- `invalidate(tier?)` (340-363): `lastTickAt=1, paused=false`, mark entries `stale` — forces
  re-fetch on next tick. Cascades to all tiers at-or-below via `isTierAtOrBelow`.
- `pulseTier(tier, 'cache-hit'|'cache-miss')` (397-420): purely visual flash for T1 instant
  reads (no real network fetch).
- `triggerPostTx()` (422-477): the **post-tx cascade**. Registers a temp T4 watcher with a
  `(post-tx-propagation)` marker, resets T4 clock (`paused=false` — comment at 444-448 warns
  this is critical: without it only the *first* tx of a session cascades). After T4's 10s
  window, removes the watcher and resets T5/T6/T7 to `lastTickAt=1` + marks them `stale`.

**Watch lifecycle** (lines 190-227): `watch(pactCode, tier, opts)` registers a `Symbol`
token in a per-key `Set`, ensures a cache entry, returns an unwatch closure. A tier only
fetches queries that `hasWatchers()`.

### 2b. `useDebouncerState` — React mirror
`D:\_Claude\StoaOuronet\OuronetUI\src\hooks\useDebouncerState.ts`

Pure read-model. `TierState` shape (lines 10-18): `{ tier, name, activeCount,
nextRefreshIn, isFetching, isActive, totalQueries }`. `DebouncerState` (20-25):
`{ tiers, totalActiveQueries, totalFetching, lastUpdated }`. It polls
`pactQueryCache.getTierState(tier)` every `updateInterval=200ms` (78-82) AND subscribes to
cache notifications (73-76). Derived hooks: `useTierState`, `useIsAnyTierFetching`,
`useActiveTierCounts`, `useNextRefreshTime`. **No write authority** — it only reflects the
singleton.

### 2c. `useT2Read` — the per-input one-shot read hook
`D:\_Claude\StoaOuronet\OuronetUI\src\hooks\useT2Read.ts`

Signature `useT2Read(pactCode: string|null, inputKey?: string): { data, loading, error }`.
Branches on whether the change was a **user keystroke** vs an **auto/ghost change**
(line 52: `isUserKeystroke = inputKey changed`):
- **keystroke** → `pactQueryCache.watch(pactCode,'T2')` + `resetTier('T2')` → debounced
  T2 fetch; old info stays visible until T2 fires (55-59).
- **auto/mount** → check cache: hit → `pulseTier('T1','cache-hit')` + use cached;
  miss → `pulseTier('T1','cache-miss')` + immediate `rawCalibratedDirtyRead` (62-86).
- Effect 2 (96-121) subscribes to the cache and pushes `fetching`/`fresh`/`error` into
  local React state. Unwraps `data.result.data ?? data.result ?? data`.

---

## 3. `useT2Read` + tiered cache external deps

The whole read path funnels into **`rawCalibratedDirtyRead`**, which lives in **core**, not
the app:

- `D:\_Claude\StoaOuronet\OuronetUI\src\kadena\calibratedRead.ts` is a thin browser wrapper.
  Line 11: `import { rawCalibratedDirtyRead } from "@stoachain/stoa-core/reads"`. It re-exports
  the raw reader and adds a cache-aware `calibratedDirtyRead()` (37-58) that delegates to
  `pactQueryCache.query` (default tier T5) and falls back to raw on cache error.
- **Network reader + node failover live entirely in core** —
  `D:\_Claude\StoaOuronet\stoa-js\packages\stoa-core\src\reads\rawCalibratedRead.ts`.
  It imports `Pact, createClient` from `@stoachain/kadena-stoic-legacy/client`,
  `getActivePactUrl, withFailover, runWithTimeout` from `../network`, and
  `createTimeoutError` from `../errors`. Failover (node2→node1) is **global state inside
  core** (`stoa-core/src/network/nodeFailover.ts`), not something the UI debouncer owns.
  Default read timeout 15s; read sim-gas ceiling 10M.
- The **pluggable reader seam**:
  `D:\_Claude\StoaOuronet\stoa-js\packages\stoa-core\src\reads\pactReader.ts` defines
  `setPactReader(fn)` / `pactRead(...)`. At boot OuronetUI calls
  `setPactReader(calibratedDirtyRead)` so core's `interactions/*` reads route through the
  app's cache; server consumers leave the default raw reader. **This is the single seam
  that lets the cache be injected.**

**Redux?** The cache + `useT2Read` themselves do **NOT** touch Redux. The only Redux
coupling in the debouncer *components* is `passwordCacheMinutes` and various `uiSettings`
(see §6). The cache singleton is framework-agnostic except for its one import of
`KADENA_CHAIN_ID` from `@stoachain/stoa-core/constants` (pact-query-cache.ts:14, used only
for the composite cache-key suffix).

---

## 4. `zbomProfiles` + `zbom-inventory`

These are **metadata/config only** — neither drives execution.

### `zbomProfiles.ts`
`D:\_Claude\StoaOuronet\OuronetUI\src\lib\zbomProfiles.ts`. Pure functions, zero deps.
Defines the **4 zone-expansion presets**: `ZbomProfile = "simple"|"basic"|"advanced"|"custom"`
(line 13) and `ZbomZoneExpansion = { zone0Info, zone1Patron, zone2Inputs, zone3Signing }`
(15-20). `getZbomExpansion(profile, custom?)` (32-45) resolves a profile to booleans;
`detectProfile(z0..z3)` (51-56) reverse-maps. The 4 zones (INFO/PATRON/INPUTS/SIGNING) are
the structural contract the layout enforces. Zone 2 has special collapse behavior
(autonomous fields hide, free user-input fields stay — comment lines 8-10).

### `zbom-inventory.ts`
`D:\_Claude\StoaOuronet\OuronetUI\src\constants\zbom-inventory.ts`. A static **catalog**, NOT
per-operation execution metadata. `ZbomEntry = { file, name, type, category, notes? }`
(7-13) where `type = "popup"|"inline"|"atypical"`. 27 entries listing every CFM/ZBOM modal
(Coil, Brumate, Transfer*, Swap, AddLiquidity, cross-chain, …). Used for reference/bulk
updates only — there is **no per-operation `{ functionName, zones, costTier }` record here.**

### Where per-operation metadata actually lives
The function-name + cost-tier + zone wiring is **inlined in each modal**, not in a registry.
In `CoilCFMModal.tsx`: the execution fn string `ouronet-ns.TS01-C2.ATS|C_Coil` and INFO fn
`ouronet-ns.INFO-ONE.ATS|INFO_Coil` are literals (lines 4-5, 153, 230); the cost tier is
implicit (INFO read uses T2 via `useT2Read`); per-input metadata (`functionMeta` with
`locations`, `name`, `description`, `icon`, `addedInVersion`) is passed inline to
`Zone2Wrapper` (lines 307-315). **PORT NOTE:** to make operations data-driven in the
package, this scattered per-modal metadata would need to be lifted into a typed
per-operation descriptor (function name + INFO function + cost tier + zone config).

---

## 5. ZbomLayout / zones component contract + Execute gating

### `ZbomLayout`
`D:\_Claude\StoaOuronet\OuronetUI\src\components\cfm\ZbomLayout.tsx`. The single source of
truth for modal chrome. Props (`ZbomLayoutProps`, 58-69):
```ts
{ header: ReactNode;
  executeButton: ZbomExecuteButtonProps;
  children: ReactNode;        // the 4 zones
  headerExtra?: ReactNode;
  activeTiers?: PactQueryTier[]; // defaults to ['T1','T2','T3'] (line 103) }
```
`ZbomExecuteButtonProps` (44-56): `{ canExecute, isProcessing, onClick, bgColor, textColor,
content, processingContent? }`. Renders the `<ZbomDebouncer activeTiers={...}>` bar at top
(115), the header, then the Execute button either above or below the scroll area depending
on Redux `uiSettings.zbomExecutePosition` (106, default `"top"`). **Execute gating is
entirely caller-driven**: the button's `disabled={!btn.canExecute || btn.isProcessing}`
and `onClick={btn.canExecute ? btn.onClick : undefined}` (ExecuteZone, 91-93). The layout
makes **no decision** about whether execution is allowed — the modal computes `canExecute`
(in Coil: `numAmount>0 && patronAccount && !isProcessing && !insufficientIgnis`).

### `ZbomExecuteZone`
`...\cfm\ZbomExecuteZone.tsx`. A standalone variant of the execute button that
self-hides unless `uiSettings.zbomExecutePosition === position` (line 29). Props
`{ position, canExecute, isProcessing, onClick, children, bgColor?, textColor? }`. Same
gating logic. (Layout has its own inline `ExecuteZone`; this file is the modular form used
by inline ZBOMs.)

### `CollapsibleZone` / `InfoZoneWrapper`
`...\cfm\CollapsibleZone.tsx`: generic zone wrapper. Props (32-53): `{ zoneIndex:0|1|2|3,
label, subLabel?, color, bg?, border?, loading?, children, collapsedContent?, alwaysMount? }`.
Reads its default open-state from Redux `uiSettings.zbomZone{0..3}` (67-71) via `useSelector`.
`alwaysMount` (display:none vs unmount) preserves child `useEffect`s when collapsed (needed
for autoSelectBestPatron). `collapsedContent` is the Zone-2 "free fields only" path.
`InfoZoneWrapper.tsx` is a specialized gold-styled Zone-0 with the same Redux `zbomZone0`
default (line 26); props `{ label?, pactCall?, children, loading?, hasData? }`.

### `zones.tsx` / `format.ts`
`...\cfm\zones.tsx`: pure presentational tokens + rows — `ZONE` color map (14-19,
info/patron/inputs/signing), `ZoneHeader`, `SignerRow` (guard threshold display:
`found/threshold needed (total)`), `CapRow` (capability display). Imports only `lucide-react`
+ `InfoTooltip` — **no business logic.** `...\cfm\format.ts`: one helper `formatIgnisTrunc`
that wraps `formatEU` from `@stoachain/stoa-core/pact` (line 6).

---

## 6. EXTERNAL DEPENDENCIES — the seams that must be injected when porting

This is the load-bearing section for the port. Grouped by source.

### A. Redux (`@/redux/store`, `react-redux`) — UI-settings + wallet state
Used by the **debouncer/zone components**, not the cache core:
- `ZbomLayout.tsx:39,106` — `useAppSelector(s.wallet.uiSettings.zbomExecutePosition)`.
- `ZbomExecuteZone.tsx:1,27` — same setting.
- `CollapsibleZone.tsx:13,69` — `useSelector(s.wallet.uiSettings.zbomZone0..3)`,
  typed against `RootState` from `@/redux/store`.
- `InfoZoneWrapper.tsx:8,26` — `s.wallet.uiSettings.zbomZone0`.
- `ZbomDebouncer.tsx:12,76` + `MainDebouncer.tsx:18,229` —
  `s.wallet.uiSettings.passwordCacheMinutes`.
- `store.ts` shows the persisted shape: `{ app, wallet }`, with all ZBOM settings under
  `wallet.uiSettings` (`zbomZone0-3`, `zbomExecutePosition`, `passwordCacheMinutes`,
  `selectedNode`, …). redux-persist v5, migrations are additive-only.
> **SEAM:** every `useAppSelector`/`useSelector(s.wallet.uiSettings.*)` must become an
> injected settings provider (context or props). The package cannot assume a Redux store
> with this exact shape. Candidate: a `ZbomSettingsContext` exposing
> `{ zoneExpansion, executePosition, passwordCacheMinutes }`.

### B. Wallet context (`@/context/wallet-context`)
- `ZbomDebouncer.tsx:11` + `MainDebouncer.tsx:17` — `useWallet()` →
  `{ passwordCachedAt, getCurrentPassword }` (codex lock oval / cell).
- `CoilCFMModal.tsx:18,62` — `useWallet()` → `{ ouro, ouroWalletData, setCurrentTransaction }`.
- wallet-context surface (from `wallet-context.tsx`): `getCurrentPassword(forceSet?)`,
  `passwordCachedAt:number`, `signTransaction(...)`, `setCurrentTransaction` (alias of
  `addTransaction`), the codex accounts (`ouro`, `ouroWalletData`). Internally it composes
  codex hooks (`useCodexAuth`, `useSignTransaction`).
> **SEAM:** the codex-lock UI needs `{ passwordCachedAt, getCurrentPassword }` and the modal
> needs accounts + `setCurrentTransaction`. Note `@ouronet/ouronet-codex` *already* ships
> `useCodexAuth`/`useRequestPassword`/`useSignTransaction`/`CodexProvider` (see
> `stoa-js/packages/ouronet-codex/src/hooks/`), so the password-cache + signing side of the
> seam likely binds to the codex package's own provider rather than OuronetUI's
> wallet-context.

### C. Signing strategy (`@/lib/signing/useCFMStrategy`)
- `CoilCFMModal.tsx:43,65` — `const strategy = useCFMStrategy()`; the write-side engine.
  `strategy.execute({ build, guards, paymentKey })` runs simulate→gas→resolve→sign→submit.
- Per OuronetUI CLAUDE.md, `useCFMStrategy` composes `ReduxCodexResolver` (a `KeyResolver`
  impl over wallet-context + walletsSlice) + `createClient(PACT_URL)` into a
  `CodexSigningStrategy` from `@stoachain/stoa-core/signing`.
> **SEAM:** `KeyResolver` + `PactClient` are already core interfaces (`stoa-core/signing/types`);
> the *resolver implementation* is app-specific (Redux-backed). The package must accept a
> strategy (or resolver) by injection, NOT import `ReduxCodexResolver`.

### D. `@stoachain/*` core packages (the published triplet) — keep as deps
- `@stoachain/stoa-core/reads` → `rawCalibratedDirtyRead` (calibratedRead.ts:11) — **the
  read engine.** Brings node failover + timeout + `@kadena/client` transitively.
- `@stoachain/stoa-core/constants` → `KADENA_CHAIN_ID, KADENA_NETWORK` (pact-query-cache.ts:14,
  CoilCFMModal.tsx:34).
- `@stoachain/stoa-core/pact` → `formatDecimalForPact, safeCreationTime, formatEU`
  (CoilCFMModal.tsx:41, format.ts:6).
- `@stoachain/stoa-core/signing` → `CodexSigningStrategy` (via useCFMStrategy).
- `@ouronet/ouronet-core/constants` → `KADENA_NAMESPACE, STOA_AUTONOMIC_OURONETGASSTATION,
  TOKEN_ID_OURO` (CoilCFMModal.tsx:35-39).
- `@ouronet/ouronet-core/pact` → `buildCoilPactCode` (and sibling builders)
  (CoilCFMModal.tsx:40).
- `@ouronet/ouronet-core/interactions/ouroBalanceFunctions` → `getIgnisBalance,
  getVirtualOuro` (CoilCFMModal.tsx:44) — these go through `pactRead` → the configured reader.
- `@stoachain/kadena-stoic-legacy/client` → `Pact` builder (CoilCFMModal.tsx:42).
> **These are the legitimate package deps** — the port keeps importing from the triplet.
> The seam concern is only the *reader injection* (`setPactReader`) and *strategy injection*.

### E. `@kadena/client` (vendored as `@stoachain/kadena-stoic-legacy/client`)
Never imported directly. Reaches the core only through `Pact.builder` (modal build closure)
and inside `rawCalibratedDirtyRead`. No direct seam work — flows through D.

### F. App-internal UI deps (must be ported or stubbed)
Per-modal: `@/components/ui/Modal`, `@/components/cfm/{PatronSpend, SigningZone, Zone2Wrapper,
ResidentSpend, inputs}`, `@/components/settings/{IgnisCostDisplay, KadenaCostDisplay,
InfoTooltip}`, `@/hooks/usePatronSelection`, `@/lib/toast-manager` (`txPending`), `sonner`
(toast), `lucide-react`, `@/ouro.d` types (`IOuroAccount`). The debouncer components also
self-inject a CSS `@keyframes debouncerSpin` at module load (DebouncerCircle.tsx:10-23) —
browser-only, guarded by `typeof document !== 'undefined'`.

### Circular-dependency note
`calibratedRead.ts` ↔ `pact-query-cache.ts` is a real cycle, broken at runtime via dynamic
`import("@/lib/pact-query-cache")` (calibratedRead.ts:23-29). The cache imports the raw
reader statically; the cache-aware wrapper imports the cache lazily. **Preserve this** when
moving files — a naive static import re-introduces the cycle.

---

## Port-relevant summary of seams (what must become injectable)

| Seam | Current source | Inject as |
|---|---|---|
| UI settings (zone expansion, execute position, pw-cache mins) | `useAppSelector(s.wallet.uiSettings.*)` | settings provider/context |
| Password cache + unlock | `useWallet().{passwordCachedAt,getCurrentPassword}` | codex package provider (already exists) |
| Accounts + tx queue | `useWallet().{ouro,ouroWalletData,setCurrentTransaction}` | codex/account provider |
| Signing engine | `useCFMStrategy()` (Redux-backed resolver) | `CodexSigningStrategy` by prop/context |
| Read engine / cache | `setPactReader(calibratedDirtyRead)` at boot | already a core seam; package wires it |
| Per-operation metadata | inlined literals in each modal | new typed operation descriptor |
| Pact builders / constants / interactions | `@stoachain/*` triplet | keep as package deps |
