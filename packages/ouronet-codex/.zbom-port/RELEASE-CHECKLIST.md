# @ouronet/ouronet-codex — Release Readiness Checklist

**Target first publish:** `0.5.0` (under npm dist-tag `alpha`; `latest` promotion gated at `v1.0.0`)
**npm state:** latest → `0.1.0`; published = `[0.1.0, 0.2.0, 0.2.1]`; `0.3.x/0.4.0/0.5.0` never published
**Status:** 🚧 NOT READY — code construction still in progress (user directing remaining build work)
**Last updated:** 2026-06-07

> Living document. We update this as build items are added/completed. Do NOT publish until
> every box in sections A–C is checked and `/wasp:health` is green.

---

## A. Publish-pipeline wiring — ✅ DONE (2026-06-07)

- [x] `stoa-js/.github/workflows/publish.yml` integrates ouronet-codex (was already done — CODEX_VERSION
      detection, queue match, dedicated publish step with auto `--tag alpha` for 0.x). No CI change needed.
- [x] `stoa-js/.wasp/config.json` `lifecycle.packages` — 4th entry added (matches triplet shape).
- [x] `.wasp/cross-pollinate.yml` — added to repos[stoa-js].packages + 6 edges
      (4 peerDep IN: dalos-crypto + triplet; 2 dep OUT: OuronetUI, AncientHoldings).

## B. Pre-publish doc / ops items (known)

- [ ] **B1 — Docs describe DELETED code (High).** 0.5.0 CHANGELOG entry + README `## Status` prose
      advertise `ZbomOperationModal` + `./zbom` `ZBOM_OPERATIONS` registry as the public surface. That
      descriptor abstraction was DELETED in the clone rewrite. Shipped 0.5.0 actually has: the 7 verbatim
      clone modals (mounted internally by `OuronetAccountsTab`, NOT exported via barrel) + tabbed Codex
      settings (4 subtabs) + ZBOM/Gas settings cards. Rewrite the 0.5.0 CHANGELOG + README Status to
      describe what actually ships. (0.5.0 is unpublished, so editing its entry is allowed.)
- [ ] **B2 — README "Version history" missing `**v0.5.0**` line (Medium).** publish.yml doc-gate requires
      a per-version README history bullet. CHANGELOG top heading `## 0.5.0` and the Status block are fine.
      Add a `**v0.5.0**` bullet (and optionally note 0.3.x/0.4.0 were unpublished local dist drops).
- [ ] **B3 — Regenerate `.wasp/dep-graph.md`** (stale after the cross-pollinate.yml edit). `/wasp:health --fix`.
- [ ] **B4 — AncientHoldings pin drift.** It pins `@ouronet/ouronet-codex: ^0.2.0`; reconcile to the
      published version on first cascade ship (cross-pollinate handles the dep-pin bump).
- [ ] **B5 — Confirm dist-tag = `alpha`** at publish time (publish.yml auto-selects for `0.*` — just verify).
- [ ] **B6 — Peer-dep order.** ouronet-codex peer-deps the triplet `>=4.3.0`; ensure triplet `>=4.3.0`
      is on npm before/with the codex publish (it is at 4.3.x — verify at ship time).
- [ ] **B7 — `/wasp:health` green** across the workspace before tagging.

## C. Code construction TODOs — 🚧 OPEN (user dictating)

> The package is NOT finished. Items below are the remaining build work. The user will enumerate
> these; Claude appends each here as it's identified, and checks them off as completed.

> **SEQUENCING STRATEGY (user, 2026-06-07):** Finalize the missing FEATURES first. As each feature is
> brought to 1:1 parity with "My Codex," note the blockchain READ functions it requires. Once every
> feature is done, the read-function list is complete — and only THEN do we build the segregated
> debouncer entity (it depends on knowing the full read surface). So the debouncer item below is
> intentionally LAST.

**Tab parity tracker (1:1 clone of My Codex):**
- [x] **Ouronet Accounts tab** — finalized (7 ZBOM modals + full expanded breakdown).
- [x] **Seed Words tab** — DONE (2026-06-07). 1:1 clone of My Codex `SeedWordsList`: Create New Seed
      button → `CreateKadenaSeedModal` (generate/restore, koala-24/chainweaver-12/eckowallet-12, Key #0
      preview, derives Key #0+#1); expandable rows; per-key Copy + Delete (Prime Key #0 delete disabled);
      Add Consecutive Key (gap-fill index) + Add Key at Position (dup-guarded). Derivation via
      `KadenaWalletBuilder.createWalletPairFromMnemonic` after `smartDecrypt(seed.secret)`; persists via
      `updateSeed({...seed,accounts})`. Verified live via Chrome extension (10 keys, 1 disabled delete).
      **READ FUNCTIONS USED: NONE** — seeds/keys are local codex data, derivation is local crypto. Adds
      nothing to the debouncer read-registry.
- [x] **Pure Key Pairs tab** — DONE (2026-06-07; upgraded, NOT a clone). 3 subtabs:
      **List** (public key only + password-gated View-Private-Key reveal + copy; protected
      CodexGuard/Duo keys delete-disabled), **Generate** (`genKeyPair()` → show pub+priv +
      save-warning → encrypt + store), **Import** (paste pub+priv, validated by
      `publicKeyFromPrivateKey` re-derivation + 64-hex check, mismatch rejected before store).
      New reusable `PrivateKeyReveal` (masked •, view-toggle gated, copy-while-masked).
      **+ cross-cutting (1a):** every **Seed Words key row** now has a View-Private-Key reveal —
      re-derives `createWalletPairFromMnemonic(...).secretKey` on demand (never stored).
      Verified live via extension (subtabs, generate pub+priv, import mismatch detection).
      **READ FUNCTIONS USED: NONE** — all local crypto (genKeyPair / derive / encrypt). Adds
      nothing to the debouncer read-registry.
- [x] **Stoa Accounts tab** — DONE (2026-06-07). Full 1:1 rebuild of My Codex "Stoa Accounts" WITH live
      per-chain balances (the old stub was a chain-IO-light projection). Surface: "Total Addresses N"
      header (custom rhombus mark) + live-read status pill + Refresh; **Codex Accounts (N) / Watched
      Accounts (N)** sub-tab toggle; codex side = per-seed collapsible groups (Prime Codex Seed / Seed #N /
      Pure Key Pairs) of `k:<publicKey>` address rows (prefix badge, truncated addr, Key #N sublabel, STOA
      total + "over N chains", copy + Stoa-explorer); expand → "Stoa Balance" line (URC_0028) + the
      per-chain (0–9) coin-balance grid. Watched side = add/label/remove arbitrary k:/u:/c:/w: addresses via
      the codex watch-list, read identically. Live read hook `useStoaChainBalances` (per-chain
      `coin.get-balance` batched map/try + URC_0028 best-effort), routed through the `pactRead` seam.
      Typecheck 0 / 3 tests rewritten to new contract (pass) / build green / deployed. Verified live via
      extension: 44 codex addresses, real balances (row 697.997 STOA "over 2 chains", Stoa Balance 685.997,
      Chain 0 = 685.997 / Chain 1 = 12.0 / Chains 2–9 = 0.0).
      **READ FUNCTIONS USED (2, both already in the 15-fn registry list):**
        • `coin.get-balance` (Pact native, per chain 0–9) — per-chain balance grid + row total.
          NOTE: not currently in the canonical 15 — it's a `coin` native, not an `ouronet-ns` read; add it
          to `readRegistry.ts` as entry 16 (tier T5, powers the Stoa per-chain grid).
        • `ouronet-ns.DPL-UR.URC_0028_StoaAccountSelectorMapper` (getStoaAccountSelectorData) — already #2
          in the registry list; powers the "Stoa Balance" summary line.
- [x] **Address Book tab** — DONE (2026-06-07). Brought to full 3-subsection parity with My Codex's
      Address Book (was a 2-subsection port that intentionally omitted StoicTags). Now: **Ouronet** (blue,
      Ѻ. validation), **StoaChain™** (gold, k:/c:/w:/u: validation), **StoicTags** (green) — per-type accent
      pills, per-type validation + duplicate guard + inline error, copy/explorer(stoa)/delete icon controls,
      inline rename. **StoicTags subsection:** stores the BARE tag name (`§` stripped on save), displays it
      with the `§` sigil, copies `§tag`, and **resolves on-chain** via `getStoicTagSelectorData` (URC_0027b,
      batch over the visible tags) showing bound-account `→ Ѻ.…` / "Released — no bound account" /
      "Not registered on chain". Widened `AddressBookEntry.type` to include `"stoic-tag"` (the codex store
      array persists it as-is; no new store). The URC_0027b read is instrumented through `codexClock`, so it
      **flips from "declared" to reachable/live** in the Read Functions page when the StoicTags tab is opened
      (registry updated: 13 reachable + 3 declared now). Typecheck 0 / 6 Address Book tests (5 + 1 new
      StoicTag) / 515 suite green / OuronetUI typecheck clean. Verified live: 3 subsections render; StoicTags
      shows its tag-name form + empty state.
      **READ FUNCTIONS USED: URC_0027b** (getStoicTagSelectorData) — the StoicTags on-chain resolution.

- [x] **CodexID last-3 glyphs visible** — each half's last-3 (accent-colored) were being
      clipped off the right edge: `text-align:right` + `overflow:hidden` keeps the START
      visible and clips the END when text overflows, so the white middle glyphs showed at
      the visible edge. Fixed `CodexIdField` right portion to a flex container with
      `justify-content:flex-end` + inner nowrap span, so overflow clips the START and the
      colored tail stays visible. Verified live via browser DOM inspection (both halves).
- [x] **Tab logos + per-tab accent colors** (2026-06-07). Distinct lucide/custom mark per tab with a
      brand colour on the icon strokes: Ouronet=Atom/blue (#3b82f6), Seed Words=Sprout/green (#22c55e),
      Pure Key Pairs=KeySquare/purple (#a78bfa), Stoa Accounts=custom `StoaDiamond` = the ❖ glyph (outer
      diamond split by an X into four petals: `M6.75 6.75 L17.25 17.25 M17.25 6.75 L6.75 17.25`)/gold (#ceac5f), Address Book=BookOpen/white (#e8e8ea). Selected tile fills the accent and
      flips the icon to near-black. Verified live via extension (all 5 icon colours match).
- [x] **CodexUI self-contained read-health / debouncer entity** — DONE (2026-06-07). Built as a real
      seam-monitor (user-chosen depth), self-contained, verified live. The four pillars:
      • **A. `readRegistry.ts`** (src/zbom/debouncer/) — 16-entry source of truth: id, canonical
        `namespace.module.name`, helper, subpath, tier, what-it-powers, kind. Unit-tested (unique ids +
        canonical, defined tiers).
      • **B. `codexClock.ts`** — REAL monitor (replaces the cosmetic free-running `tierClock`, which now
        aliases it). `report(id,{chainId?},fn)` wraps every CodexUI read: marks the tier fetching →
        fresh/error + settle timestamp, keyed by registry id (+chain). Exposes `getTierState`
        (real queryCount/isFetching/“time-since-last-refresh” ring), `getQueriesByTier` (tooltip rows),
        `getReadStatus` (per-id live status), `subscribe`, `triggerPostTx`. Instrumented at the seam:
        `useAccountChainData` (URC_0027), `useStoaChainBalances` (URC_0028 + per-chain coin.get-balance),
        and `useZbomInfoRead` (optional `readId`). 7 monitor tests pass.
      • **C. `CodexDebouncerPanel.tsx`** — faithful port of OuronetUI `MainDebouncer` (2×4 medallion grid +
        countdown rings + fetching spinners + scrollable active-reads tooltips + Codex-lock cell), driven
        by codexClock, self-contained (package auth/store, no Redux/OuronetUI imports). Exported from
        `./ui` + `./zbom`. Optional `onInfo` ? button.
      • **D. Settings subpages** — new **Debouncer** subtab (live panel + tier explainer ported from
        `/app/debouncer`) + **Read Functions** subtab (the 16-entry registry with live ✓/✗ status). Wired
        into `CodexSettingsSection` (now 6 subtabs).
      **OuronetUI seam:** panel mounted right-aligned on the “Codex UI / Codex UI Settings” switcher line
      (`codex-ui.tsx`); the ? button deep-links to the Debouncer settings subpage; the host header
      `MainDebouncer` is dimmed (opacity 0.3, “Paused…” title, pointer-events off) on `/app/codex-ui`
      (`main-layout.tsx`) so only the CodexUI’s debouncer is “in effect” there.
      **Verified live via extension:** panel renders the 8-cell grid; T5 lights up from real URC_0027
      reads (tooltip: “Active reads (1): ● DPL-UR.URC_0027_AccountSelectorMapper”, ring counts down 30s and
      resets on re-read) while all other tiers stay correctly idle; host debouncer dimmed; both settings
      subpages render; Read Functions shows the live tally. Package build + 514 tests green;
      OuronetUI typecheck clean.
      **Read-coverage follow-up (2026-06-07):** instrumented the remaining reachable reads so every badge
      is truthful — the 7 ZBOM INFO cost reads now report via a `readId` prop on the shared
      `FunctionInfoZone` (one component + 7 modal props); the patron IGNIS (`UR_AccountSupply`) + sovereign
      guard (`UR_AccountGuard`) reads report via a `monitoredReads.ts` wrapper swapped into 8 call sites.
      The 4 reads no current UI flow performs (`URC_0027b`, `URC_0027c`, `UR_AccountKadena`, `describe-keyset`)
      are flagged `reachable:false` and render as **“declared”** (distinct from “idle”) so the page is honest:
      **12 reachable** (go live when their flow runs) **+ 4 declared**. Verified live: opening **Release
      StoicTag** lit T2 orange (its INFO read reported) — the exact case that was previously silent.

  ~~Original design notes (superseded by the DONE summary above):~~

  **Context (verified by research):** OuronetUI's debouncer and the package's debouncer are ALREADY
  decoupled — separate instances, no shared state, zero OuronetUI imports in `src/zbom/debouncer/*`.
  So "decouple" is essentially done. The real gaps to make the CodexUI's debouncer a *complete portable
  entity*:
    (i) only the SMALL inline ZBOM bar exists — no full header-style panel like OuronetUI's `MainDebouncer`;
    (ii) the package `tierClock` is COSMETIC (free-running wall-clock, `queryCount` hardcoded to 1, wired
         to nothing) — it animates but monitors no real read;
    (iii) no read-function registry — only a single-entry `CODEX_CHAIN_READ_FUNCTIONS` (URC_0027) in
          `src/ui/internal/useAccountChainData.ts`.

  **Decisions (user, 2026-06-07):**
    - Full debouncer panel location → **header band at the TOP of the CodexUI page** (extra surface,
      mirrors OuronetUI placement; above the CodexID).
    - Debouncer depth → **real MONITOR**: every Codex read reports start/done/error into the package
      clock; panel + rings reflect actual in-flight reads, last-read time, and health. (Not a full
      scheduler — reads keep firing as they do; the clock observes them.)

  **Build pillars:**
    - **A. `readRegistry.ts`** — one enumerated module = single source of truth for the 15 reads below
      (canonical `namespace.module.full-name`, JS helper, import subpath, tier, what-it-powers, live status).
    - **B. Make the clock a real monitor** — instrument the read seam so each Codex read reports
      start/done/error into `tierClock` keyed by registry entry + tier (replace the hardcoded `queryCount`).
    - **C. `CodexDebouncerPanel`** — port OuronetUI `MainDebouncer` (2×4 tier-medallion grid + countdown
      rings + generalized codex-lock cell) into the package, self-contained (no Redux, read-fn injected,
      lock cell props-driven). Mount as a header band at the top of the CodexUI page (consumer: codex-ui.tsx).
    - **D. Settings "Read Functions" card** — lists the 15 registry entries (exact canonical name +
      what each powers + live ✓/✗) so an operator sees the CodexUI's on-chain read dependencies.

  **The 16 Codex read functions (canonical, `|` pipes are real Pact identifier chars):**
    1. `ouronet-ns.DPL-UR.URC_0027_AccountSelectorMapper` — activation/guards/payment-key+balance/pubkey/sovereign/governor/StoicTag (getAccountSelectorData)
    2. `ouronet-ns.DPL-UR.URC_0028_StoaAccountSelectorMapper` — Stoa k:/c: accounts (getStoaAccountSelectorData)
    3. `ouronet-ns.DPL-UR.URC_0027b_StoicTagSelectorMapper` — batch StoicTag status (getStoicTagSelectorData)
    4. `ouronet-ns.DPL-UR.URC_0027c_StoicTagSelectorSingle` — single StoicTag (getStoicTagInfo)
    5. `ouronet-ns.DPTF.UR_AccountSupply` (IGNIS token id) — IGNIS balance / patron selection (getIgnisBalance)
    6. `ouronet-ns.DALOS.UR_AccountGuard` — sovereign guard, auth path (getKadenaAccountGuard)
    7. `ouronet-ns.DALOS.UR_AccountKadena` — k:/c: payment address resolution (getKadenaAccountOwner)
    8. `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_DeployStandardAccount` — Activate cost (getDeployStandardAccountInfo)
    9. `ouronet-ns.CODEX.CODEX|INFO_RegisterStoicTag` — Add StoicTag cost (getRegisterStoicTagInfo)
    10. `ouronet-ns.CODEX.CODEX|INFO_ReleaseStoicTag` — Release StoicTag cost (inline)
    11. `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateGovernor` — Rotate Governor cost (inline)
    12. `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateSovereign` — Rotate Sovereign cost (inline)
    13. `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateGuard` — Rotate Guard cost (inline)
    14. `ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateKadena` — Rotate Payment Key cost (inline)
    15. `describe-keyset` (Pact native, no namespace) — keyset-ref guard expansion (readKeyset/resolveGuard)
    16. `coin.get-balance` (Pact native, `coin` module, per chain 0–9, tier T5) — Stoa Accounts per-chain
        balance grid + row total (added 2026-06-07 with the Stoa Accounts rebuild; the first non-`ouronet-ns`
        protocol read in the Codex display path besides `describe-keyset`).
    Helpers live in `@ouronet/ouronet-core/interactions/{ouroAccountFunctions,ouroBalanceFunctions,activateFunctions}`.
    (Out of scope: URC_0029/URC_0001/UR_GAP/etc — Dashboard reads, not Codex display path.)

- [x] **Add-key derivation progress indicator** (new feature, 2026-06-07; beyond My Codex parity).
      Adding a key (Add Consecutive / Add at Position) runs CPU-heavy BIP39/Chainweaver derivation that
      blocks the main thread, causing a visible click→appear gap. Added a staged animated indicator
      (`DerivingBar`): "Unlocking codex… → Decrypting seed… → Deriving keypair… → Saving key…" with a
      sweep bar + spinner. Key detail: both animations are COMPOSITOR-driven (transform: translateX /
      rotate) so they keep moving while the derivation blocks JS; each stage label is painted via a
      double-rAF yield BEFORE its heavy step. Replaces the add-buttons row while deriving. Typecheck +
      9 seed tests + build green; deployed.

- [x] **Fix: seed-key private key showed encrypted blob, not raw hex** (2026-06-07). The Seed Words
      key-row "View Private Key" returned `createWalletPairFromMnemonic(...).secretKey`, which is the
      @kadena/hd-wallet AES-encrypted blob (base64, `…==`) — NOT the raw key kadenakeys.io shows. Fixed:
      decrypt it via `binToHex(await KadenaWalletBuilder.decrypt(password, secretKey))` → raw 64-hex.
      Proven by a node repro: derived priv == `f0232c…` (exact kadenakeys.io match) for the test mnemonic.
- [x] **Pure Key Pairs rows made expandable (Ouronet-Accounts style)** (2026-06-07). List rows now show a
      collapsed header (chevron + icon avatar + label + protected badge); expanding reveals the public key,
      the View-Private-Key reveal, and the delete control. Verified live via extension.
- [x] **Half-split key geometry (shared `KeyFieldsHalves`)** (2026-06-07). New two-column layout used by
      BOTH Seed Words key rows AND Pure Key Pairs entries: left = public key (+ copy), right = private key
      blurred (+ Show toggle + copy), row-level delete. Keys render in FULL when they fit, ellipsis-truncate
      only when the column is too narrow (CSS overflow). Private side stays masked+blurred until Show
      (decrypt-on-demand — avoids running the heavy seed-key derivation for keys never revealed). Replaced
      the old single-line + separate-reveal layout; removed PrivateKeyReveal.tsx. Verified live (public 64ch
      full, private blur(3.5px), Show btn, 2 copy btns).
- [ ] _(awaiting next user input — to be filled in)_

## D. Publish execution (only after A–C complete)

- [ ] Final build + full test suite green (`npm run build`, `npx vitest run`) in the package.
- [ ] Deploy fresh dist into OuronetUI/AncientHoldings node_modules for a last manual smoke test.
- [ ] Commit all package + config changes.
- [ ] Publish via `/wasp:cross-pollinate` (or push tag `v0.5.0`) — user-initiated, explicit consent.
- [ ] Verify `@ouronet/ouronet-codex@0.5.0` live on npm under `alpha`; GitHub Release created.
- [ ] Bump OuronetUI + AncientHoldings pins to the published version; update OuronetUI version surfaces
      (integratedPackages.ts footer + changelog.ts/version.ts) per the update-UI-version-surfaces rule.
