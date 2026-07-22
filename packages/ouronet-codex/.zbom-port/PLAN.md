# PLAN — ZBOM Operations Port (waves)

Companion to `SPEC.md`. TDD per wave (vitest). Build must stay green after each wave.
Reference research in `.zbom-port/research/01..04`.

Each wave: (a) write/extend tests, (b) implement, (c) `npx vitest run <files>` green,
(d) `npm run build` green. Full deploy + localhost verify happens in Wave 8.

---

## Wave 1 — Settings + state foundation
**Goal:** ZBOM/patron settings are first-class + migrate cleanly.
- `src/types/entities.ts`: add to `UiSettings`: `zbomProfile?: "simple"|"basic"|"advanced"|"custom"`,
  `zbomZone0?..zbomZone3?: boolean`, `zbomExecutePosition?: "top"|"bottom"`. Change
  `patronSelectionMode` enum to `"wealthiest"|"prime"|"resident"`.
- `src/state/migrations.ts`: map legacy package patron values
  (`active-wallet`→`prime`, `manual`→`resident`); seed ZBOM defaults
  (`basic`, `true,false,false,false`, `top`) if absent. Bump store schema only if needed.
- `src/state/store.ts`: ensure `updateUiSettings` round-trips the new fields (already
  plain-merge; just confirm + add getters if a card needs them).
- Tests: migration test (old enum → new), defaults seeding, round-trip.
**Exit:** new fields typed + persisted + migrated; tests green; build green.

## Wave 2 — Operation descriptor model + builders
**Goal:** one typed descriptor per operation; Pact builders reused from core.
- New `src/zbom/operations/` (non-UI): `types.ts` (`ZbomOperation` descriptor:
  `id`, `title`, `accent`, `functionCode`, `infoRead`, `cost: "STOA"|"IGNIS"`,
  `patronless: boolean`, `smartOnly: boolean`, `buildTx(ctx)`, `caps(ctx)`,
  input schema). One file per op (`rotateGuard.ts`, `rotatePaymentKey.ts`,
  `rotateSovereign.ts`, `rotateGovernor.ts`, `registerStoicTag.ts`,
  `releaseStoicTag.ts`, `activateStandard.ts`) reusing `build*PactCode` from
  `@ouronet/ouronet-core` (Flavor-B path; for Flavor-A ops mirror the
  `interactions/*` build the existing modal already uses).
- Tests: each builder emits the expected Pact code string + function name (snapshot/contains).
**Exit:** 7 descriptors compile + build correct Pact; tests green.

## Wave 3 — Debouncer (package-local, behavior-faithful) [D3]
**Goal:** debounced INFO read → IGNIS cost + DebouncerCircle, over existing seam.
- New `src/zbom/debouncer/`: `useZbomInfoRead.ts` (debounced read of the op's INFO
  function via `pactRead`-backed interactions; returns `{ ignisNeed, isFree, status }`),
  `DebouncerCircle.tsx` (status indicator), `useZbomRefresh.ts` (post-tx refresh).
- Reuse the package's chain-read pattern (`useAccountChainData`); do NOT add a reader seam.
- Tests: debounce timing (fake timers), cost parse from `infoData.ignis["ignis-need"]`,
  free-vs-cost branch.
**Exit:** cost read works against a mocked reader; tests green.

## Wave 4 — INFO zone (ZONE 0)
- New `src/ui/zbom/FunctionInfoZone.tsx`: Pact preview + IGNIS cost (from Wave 3) +
  Free/cost badge, inside the existing `InfoZoneWrapper`.
- Tests: renders cost, renders Free badge for STOA-free, renders Pact code.
**Exit:** INFO zone renders real cost; tests green.

## Wave 5 — PATRON zone (ZONE 1)
- Port `usePatronSelectionDefaults` + `usePatronAutoSelect` reading package store
  (`useOuroAccounts`, IGNIS balances via interactions). Modes `wealthiest|prime|resident`
  + manual override; pick a codex-satisfiable patron, fallback on insufficient.
- New `src/ui/zbom/PatronZone.tsx` (3-mode selector + chosen patron + spend).
- Tests: mode selection, auto-pick wealthiest-satisfiable, manual override, fallback.
**Exit:** patron zone selects a patron whose guard is codex-satisfiable; tests green.

## Wave 6 — INPUTS zone (ZONE 2) incl. AuthPathZone [R2]
- New `src/ui/zbom/inputs/`: per-op typed inputs (reuse existing Rotate modal field
  UIs where present): keyset define/existing + predicate (Guard), payment key
  (PaymentKey), new sovereign addr (Sovereign), `NonKeyGuardEntryInput` + governor
  (Governor), StoicTag name (Register), confirm (Release), activate inputs.
- New `src/ui/zbom/AuthPathZone.tsx`: Smart enforce-one branch picker (account guard /
  sovereign guard) → `chosenKeyset`. Drop governor branch (matches app).
- Tests: each input validates; AuthPathZone resolves a chosen keyset for a Smart acct.
**Exit:** inputs + auth-path produce a valid `buildTx`/`guards` context; tests green.

## Wave 7 — SIGNING zone (ZONE 3) + execute glue
- New `src/ui/zbom/SigningZone.tsx` (signer rows + caps, reusing `zones.tsx`
  SignerRow/CapRow) + `InlineSigningCollapsible` behavior.
- `useZbomExecute.ts`: assembles `{ build, guards: [patron, accountOrChosen], paymentKey }`
  from zones → `useSignTransaction().execute`; preserves prompt-unlock-before-sign.
- Tests: execute builds the right guards array (Standard: [patron, accountGuard];
  Smart: [patron, chosenKeyset]); calls `execute`; surfaces requestKey + errors.
**Exit:** execute path returns requestKey against a mocked PactClient; tests green.

## Wave 8 — Assemble ZbomModal host + wire all 7 + deploy
- New `src/ui/zbom/ZbomOperationModal.tsx`: hosts ZONE 0–3 from a `ZbomOperation`
  descriptor inside the real `ZbomModal` chrome; honors `zbomZone*`/`zbomExecutePosition`.
- Replace `ZbomShellDemo` usage; wire `OuronetAccountsTab.tsx` buttons (Guard, Payment,
  Sovereign → swap from Styled* to host; Governor, Add/Release StoicTag, Activate →
  new). Export host + descriptors via `src/ui/zbom/index.ts` + `src/ui/index.ts`.
- Vertical-slice first: Rotate Guard through the host end-to-end, then fan out.
- `npm run build`; deploy dist into `OuronetUI/node_modules`; restart Vite `--force`;
  verify modals open + cost reads + execute path on localhost (best-effort given
  auth-gated SPA — at minimum no console errors, zones render).
**Exit:** all 7 buttons open the real ZbomModal; build green; deployed + running.

## Wave 9 — Version + docs + integration surfaces
- `package.json` → 0.5.0; `CHANGELOG.md` top entry; README Status + history line.
- OuronetUI: bump the `@ouronet/ouronet-codex` pin reference in
  `src/constants/integratedPackages.ts` (footer) + update log (`changelog.ts`/`version.ts`)
  per project rule; `npm run generate:inventory` if annotated modals changed.
- Leave changes UNCOMMITTED (user pushes via /wasp:cross-pollinate).
**Exit:** versioned + documented; ready for user review/push.

---

### Sequencing notes
- Waves 1→2→3 are foundational and mostly independent of UI — can move fast.
- Wave 6 (AuthPathZone) is the risk; if it slows, ship the 5 non-Smart ops through
  the host first (Activate, Payment, Guard, Register, Release) and land Sovereign/
  Governor last.
- Keep `git`-free; do not push. Deploy = copy dist + Vite `--force`.
