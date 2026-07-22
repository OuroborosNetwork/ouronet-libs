# SPEC — ZBOM Operations Port into `@ouronet/ouronet-codex`

Status: ACTIVE · Target version: **0.5.0** · Author: autonomous session 2026-06-01

## 1. Goal

Bring the Codex transaction buttons in the package's CodexUI to **1:1 functional
parity** with OuronetUI's "My Codex" (the legacy `settings.tsx` → `OuroAccountList.tsx`
surface). Every codex-management on-chain operation must execute through the full
**ZBOM** flow — the popup with collapsible zones (INFO / PATRON / INPUTS / SIGNING),
a debounced IGNIS-cost read, patron selection, auth-path resolution for Smart
accounts, and signing — exactly as the app does today, but self-contained in the
package (Zustand store, no Redux, no app `wallet-context`).

## 2. The operations (exhaustive — 7)

Reachable from the per-account rows in the Ouronet Accounts tab (+ Activate):

| # | Operation            | Pact function (`ouronet-ns....`)        | Cost  | Patron | Smart-only | Notes |
|---|----------------------|------------------------------------------|-------|--------|-----------|-------|
| 1 | Activate Standard Acct | `TS01-C1.DALOS\|C_DeployStandardAccount` | STOA  | NO (patronless) | no | bespoke inline signing/caps + Auto toggle |
| 2 | Rotate Payment Key   | `TS01-C1.DALOS\|C_RotateKadena`          | IGNIS | yes    | no        | Flavor-A signing |
| 3 | Rotate Guard         | `TS01-C1.DALOS\|C_RotateGuard`           | IGNIS | yes    | no        | Flavor-A; define/existing keyset |
| 4 | Add/Register StoicTag| `TS01-C4.CODEX\|C_RegisterStoicTag`      | STOA  | yes    | no        | needs `k:` payment key in codex |
| 5 | Release StoicTag     | `TS01-C4.CODEX\|C_ReleaseStoicTag`       | IGNIS | yes    | no        | gated on tag present |
| 6 | Rotate Sovereign     | `TS01-C1.DALOS\|C_RotateSovereign`       | IGNIS | yes    | **yes**   | AuthPathZone enforce-one |
| 7 | Rotate Governor      | `TS01-C1.DALOS\|C_RotateGovernor`        | IGNIS | yes    | **yes**   | AuthPathZone + non-key-guard authoring |

**Out of scope:** "Register CodexID" — does not exist as a ZBOM modal (CodexID is
observational-only). Token/swap ZBOM modals (Transfer/Coil/Swap/Liquidity…) live
outside My Codex and are NOT part of this port.

## 3. Current package state (baseline)

- **Signing path already ported (Phase 9):** `useSignTransaction()` →
  `{ strategy, execute, sign }`, `execute({ build, guards, paymentKey }) → { requestKey, raw }`,
  backed by `InternalCodexResolver` (Zustand `KeyResolver`) + `PactClient`
  (provider `signingClient` override). **Unchanged by this port.**
- **Working but simplified modals:** `src/components/Rotate{Guard,PaymentKey,Sovereign}Modal.tsx`
  (headless render-prop) + `src/ui/internal/RotateModals.tsx` (CodexModalShell chrome).
  They build Pact + call `execute`. They do NOT use ZBOM chrome / debouncer / patron / auth-path.
- **ZBOM shell exists (layout-real, IO-placeholder):** `src/ui/zbom/` — `ZbomModal`
  (real chrome, `debouncerSlot` + `executeButton`/`executePosition` props),
  `CollapsibleZone`, `InfoZoneWrapper`, `zones.tsx` (`ZoneHeader`/`SignerRow`/`CapRow`),
  `tokens.ts`, `format.ts`. `ZbomShellDemo` is pure placeholder.
- **Stubbed buttons** in `OuronetAccountsTab.tsx`: Release StoicTag, Add StoicTag,
  Rotate Governor, Activate (empty `onClick` with `v0.3.2:` comments).
- **Chain-read seam:** package reads chain via `@ouronet/ouronet-core/interactions/*`
  helpers that route through the **consumer's** already-configured `pactRead`
  (`setPactReader`). Reference: `src/ui/internal/useAccountChainData.ts`. **No new
  reader injection** — the port follows this same pattern.

## 4. Key design decisions (judgment calls, codified)

> Per project rule "no silent judgment calls", each non-trivial choice is recorded
> here BEFORE implementation.

- **D1 — Version 0.5.0.** New feature subsystem (whole ZBOM execution) + a settings
  enum reconcile. Minor bump (0.4.0 is only consumed locally, so the enum change is
  not a published-breakage concern). NOT 0.4.1 (too large for a patch).
- **D2 — Patron enum reconcile → adopt OuronetUI vocabulary.** OuronetUI persists
  `patronSelectionMode: "wealthiest" | "prime" | "resident"` (default `wealthiest`).
  The package currently ships `"wealthiest" | "active-wallet" | "manual"`. For 1:1
  parity the package adopts **`"wealthiest" | "prime" | "resident"`**. A migration
  maps the old package values (`active-wallet`→`prime`, `manual`→`resident`) so any
  persisted 0.4.0 codex still loads.
- **D3 — Debouncer scope: reproduce behavior, not the global singleton.** OuronetUI's
  debouncer is an app-wide T1–T7 read scheduler (`pact-query-cache.ts`) with a
  circular-dep gotcha. We port a **package-local debouncer** that reproduces the
  modal-relevant UX faithfully: a debounced INFO read (IGNIS cost / Free badge), the
  `DebouncerCircle` status indicator, and a post-tx refresh — all routed through the
  package's existing `pactRead`-backed interactions seam. We do NOT drag the global
  singleton into the package. User-facing behavior is identical.
- **D4 — New typed operation descriptor.** OuronetUI inlines per-op metadata
  (function name, INFO function, cost tier, zones) per modal. The port introduces one
  typed `ZbomOperation` descriptor per op (function code, INFO read, cost kind
  STOA/IGNIS, patronless flag, smart-only flag, input schema, builder, caps) so the
  7 ops share one `ZbomModal` host instead of 7 bespoke modals.
- **D5 — Settings are first-class.** Add `zbomProfile`, `zbomZone0..3`,
  `zbomExecutePosition` to the package `UiSettings` type + store, sourced from
  OuronetUI `walletsSlice.ts` defaults (`zbomProfile:"basic"`, zones
  `true,false,false,false`, execute `"top"`). The `[extra]` hatch already round-trips
  unknown keys, but these become typed for the ZBOM Settings card.
- **D6 — Keep the existing simplified modals working at every step.** The real
  ZbomModal host is built alongside; buttons switch over per-operation only once the
  host renders + executes that op correctly. Build stays green wave-to-wave.

## 5. External-dependency seams (what gets injected vs reused)

| Concern        | OuronetUI source          | Package target |
|----------------|---------------------------|----------------|
| Settings       | Redux `wallet.uiSettings` | package store `uiSettings` (`useCodex`) |
| Auth / unlock  | `wallet-context`          | `useCodexAuth` / `useSignTransaction` (already there) |
| Signing engine | `useCFMStrategy` + `ReduxCodexResolver` | `useSignTransaction` + `InternalCodexResolver` (already there) |
| Chain reads    | `pact-query-cache` / `useT2Read` | package-local debouncer over `pactRead`-backed `interactions/*` (D3) |
| Accounts/keys  | Redux `wallet.*`          | `useOuroAccounts` / `useKadenaSeeds` / `usePureKeypairs` |
| Patron select  | `usePatronAutoSelect`/`Defaults` | ported, reading package store |

Preserve: (a) `useCFMStrategy` forces prompt-unlock before signing — keep that in the
ported execute path; (b) foreign-key signing needs a `requestForeignKey` callback —
the package resolver fail-fasts without it (acceptable; codex keys are local).

## 6. Acceptance criteria

1. All 7 operations open a **ZbomModal** (collapsible INFO/PATRON/INPUTS/SIGNING +
   execute) — Activate is patronless (no PATRON zone), Sovereign/Governor show
   AuthPathZone.
2. INFO zone shows the Pact preview + a debounced **IGNIS cost** (or STOA Free/cost
   badge), matching My Codex.
3. PATRON zone offers the 3 modes (`wealthiest`/`prime`/`resident`) + manual override,
   auto-selecting a codex-satisfiable patron.
4. SIGNING zone lists signer rows + caps; Smart ops resolve the enforce-one branch.
5. Execute signs via the existing `useSignTransaction` path and returns a requestKey;
   the prompt-unlock-before-sign behavior is preserved.
6. Settings: a ZBOM Settings card controls `zbomProfile` / zone defaults / execute
   position; persisted 0.4.0 codices migrate cleanly (D2).
7. Package builds clean (`npm run build`), package tests pass, OuronetUI typechecks,
   dist deploys into `OuronetUI/node_modules`, dev server runs with the new modals
   live on localhost.
8. Version 0.5.0: `package.json` + `CHANGELOG.md` + README Status/history; OuronetUI
   footer `integratedPackages.ts` + update log bumped when the pin moves.

## 7. Risks

- **R1 (high): debouncer fidelity.** Mitigated by D3 (reproduce UX over existing seam).
- **R2 (med): AuthPathZone (Smart enforce-one).** Most complex UI; isolate to its own
  wave; Sovereign/Governor depend on it.
- **R3 (med): scope vs time.** Sequenced so the build is green after each wave and a
  working vertical slice (Rotate Guard through real ZbomModal) lands first; remaining
  ops fan out from the proven host.
