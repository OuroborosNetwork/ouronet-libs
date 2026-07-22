# 03 — Patron + Signing subsystems (ZBOM port research)

Scope: map the OuronetUI PATRON zone + SIGNING zone, and the seam to the
`@ouronet/ouronet-codex` package's existing signing surface (Phase 9).
RESEARCH ONLY.

---

## A) PATRON subsystem

### Files

| File | Role |
|------|------|
| `OuronetUI/src/components/cfm/PatronZone.tsx` | Two presentational atoms only: `PatronIgnisBar`, `InsufficientIgnisAlert`. **Not** the selector. Pure props, no Redux/context. |
| `OuronetUI/src/components/cfm/PatronSpend.tsx` | `PatronZonePattern2` — the full Zone-1 block: 3-way selector (Prime/Resident/Custom) + portal dropdown + address rect + autonomic IGNIS cost. Has its OWN inline auto-select (highest-IGNIS) effect. |
| `OuronetUI/src/hooks/usePatronSelection.ts` | `usePatronSelectionDefaults()` — single Redux read → `{ initialPatronMode, autoSelectBestPatron, setting }`. |
| `OuronetUI/src/hooks/usePatronAutoSelect.ts` | `usePatronAutoSelect()` — full state machine: select-by-setting, fetch IGNIS, fallback chain, user-override tracking, `checkFallback(ignisCost)`. The richer of the two. |

### Patron modes — TWO distinct vocabularies (KEY DISCREPANCY)

- **OuronetUI `patronSelectionMode` setting** = `"wealthiest" | "prime" | "resident"` (Redux `wallet.uiSettings.patronSelectionMode`, default `"wealthiest"`).
- **Patron *selector* UI mode** (`patronMode`) = `"prime" | "resident" | "custom"` — the 3-way toggle. "custom" is a runtime selector state, not a persisted setting.
- **Package `UiSettings.patronSelectionMode`** (`stoa-js/.../ouronet-codex/src/types/entities.ts:214`) = `"wealthiest" | "active-wallet" | "manual"`. **Does NOT match OuronetUI.** `prime`→(no equiv), `resident`→`active-wallet`, `custom`→`manual`-ish. **Porting must reconcile this enum** (rename or map).

### Selection logic (usePatronAutoSelect, the canonical one)

1. Map setting → candidate: `wealthiest` (sort eligible accounts by IGNIS desc, first whose guard is satisfiable by codex via `analyzeGuard`/`buildCodexPubSet`), `prime` (accounts[0]), `resident` (active wallet).
2. Eligible = `!isSmart && isActive !== false`.
3. `checkFallback(ignisCost)` (called once cost is known): if chosen patron IGNIS < cost → fall back to wealthiest; if wealthiest also < cost → stay + `noViablePatron = true` (red). User manual pick sets `userOverrideRef` → fallback suppressed.

### How patron feeds gas + signing
- The chosen `patronAccount.address` is the **payer** baked into the Pact code by the core builder (`buildXPactCode({ patron, ... })`), with gas fronted by the gas station (`STOA_AUTONOMIC_OURONETGASSTATION` + `DALOS.GAS_PAYER` cap).
- Patron's **guard** is pushed into the signing zone's `guards` array (`SigningZone.patronAccount` → `analyzeGuard` → keys must pure-sign). So patron selection directly determines one of the keysets passed to `strategy.execute({ guards: [patronGuard, residentGuard] })`.

### Patron external deps
- Redux: `useSelector(RootState)` for `wallet.uiSettings.patronSelectionMode` / `zbomZone1`.
- Context: `useWallet()` (`@/context/wallet-context`) for `ouro`, `ouroWalletData`, `kadena`(seeds), `kadenaAccounts`.
- `@ouronet/ouronet-core/interactions/ouroBalanceFunctions` → `getIgnisBalance`.
- `@stoachain/stoa-core/guard` → `analyzeGuard`, `buildCodexPubSet`. *(Note: PatronSpend.tsx line 20 imports from `@stoachain/stoa-core/guard` — CLAUDE.md aliases these as stoa-core; both names appear in repo. The active triplet is stoa-core.)*
- Local types: `IOuroAccount` from `@/ouro.d`.

---

## B) SIGNING subsystem

### OuronetUI signing lib + zones

| File | Role |
|------|------|
| `OuronetUI/src/lib/signing/useCFMStrategy.ts` | **Phase-9d shim** (53→3 lines). Now a thin wrapper over the package's `useSignTransaction`. Returns a `CodexSigningStrategy` whose `execute` is wrapped to prompt-unlock (`getCurrentPassword` + `authenticate`) before delegating. `ReduxCodexResolver.ts` referenced in CLAUDE.md no longer exists on disk (glob shows only `useCFMStrategy.ts` under `lib/signing/`). |
| `OuronetUI/src/components/cfm/SigningZone.tsx` | **Zone 3 — SIGNING.** Computes pure signers + auto-CAPS *for display*. Uses `analyzeGuard`, `buildCodexPubSet`, `selectCapsSigningKey` from stoa-core/guard. Tabs: "Signing (Pure)" + "CAPS". Renders `ManualKeyInput` for unresolved foreign keys. Props: `patronAccount`, `accountAccount`, `additionalGuards[]`, `extraCaps[]`, `kadenaNeed/Receivers/Amounts`. Purely presentational/analytical — it does NOT execute. |
| `OuronetUI/src/components/cfm/InlineSigningCollapsible.tsx` | Dumb collapsible wrapper (reads `zbomZone3`) for modals doing inline signing instead of `SigningZone`. Props: `children`, `summary`. |
| `OuronetUI/src/components/cfm/AuthPathZone.tsx` | **Smart-account (Σ.) auth picker.** `enforce-one` over Account Guard / Sovereign Guard (governor dropped from key-driven UI). Uses `analyzeSmartAccountAuthPaths`, `buildCodexPubSet` from stoa-core/guard. Emits `AuthPathSelection { branchIndex, branch, chosenKeyset, satisfied, impossibleViaZbom }`. **The OR-of-branches → single chosen keyset is resolved HERE**, then parent passes `chosenKeyset` into `execute({ guards: [patron, chosenKeyset] })`. |

### The package's existing signing surface (ALREADY PORTED — Phase 9)

| Package file | Provides |
|--------------|----------|
| `src/hooks/useSignTransaction.ts` | `useSignTransaction({ requestForeignKey? })` → `{ strategy, execute, sign }`. Composes `InternalCodexResolver(store)` + `createClient(getPactUrl(KADENA_CHAIN_ID))` (or provider's `signingClient` override) into a `CodexSigningStrategy`. Memoised on store/selectedNode/customNodeUrl/clientOverride. **This is the direct replacement for `useCFMStrategy`'s old body.** |
| `src/resolver/InternalCodexResolver.ts` | `KeyResolver` impl reading the package's **Zustand** store (replaces the old Redux `ReduxCodexResolver`). 3 methods: `listCodexPubs`, `getKeyPairByPublicKey` (auth-gated via `passwordCache`, throws `CodexLockedError`/`CodexKeyMissingError`), `requestForeignKey` (fail-fast or delegate). |
| `src/resolver/index.ts` | Re-exports resolver + `KeyResolver`/`IKadenaKeypair` types from stoa-core/signing. |
| `src/hooks/useCodexAuth.ts` | `authenticate(pw, ttl)`, `lock`, `getCurrentPassword`, `isLocked`, `passwordCacheExpiresAt`. |
| `src/hooks/useCodex.ts` | Whole-codex read incl. `uiSettings` (carries `patronSelectionMode`, `passwordCacheMinutes`). |
| `src/hooks/useCodexGuard.ts` | Active CodexGuard pub/encrypted-priv + generate/rotate. |
| `src/provider/index.ts` | `CodexProvider`, `useCodexStore`, `useSigningClientOverride`. |

### Core signing contract (`@stoachain/stoa-core/signing/types.ts`)
- `CodexSigningStrategy implements SigningStrategy`. `execute({ build({gasLimit,capsKeyPub,guardPubs}), guards: IKeyset[], paymentKey?, resolvedForeignKeys?, extraSigners? }) → { requestKey, raw }`.
- Pipeline: simulate → calibrate gas → analyzeGuard per guard → `selectCapsSigningKey` (GAS_PAYER) → `universalSignTransaction` → submit.
- `KeyResolver` (3 methods) + `PactClient` (`dirtyRead`/`submit`) are the seam interfaces. `IKeyset = { keys, pred }`.
- **Strategy is AND-over-`guards`**; smart-account OR-of-branches is resolved UI-side (AuthPathZone) — confirmed in stoa-core/guard/`smartAccountAuth.ts` header and ouronet-core CLAUDE.md.

### Smart-account auth (`@stoachain/stoa-core/guard/smartAccountAuth.ts`)
- `classifyGuardKind`, `extractKeysetFromGuard`, `analyzeSmartAccountAuthPaths(guards, codexPubs, resolvedKeys)` → `SmartAccountAuthPaths` (branch list w/ `which`/`kind`/`keyBased`/`analysis`). `GuardKind`, `IKeyset` exported. Already exists in the triplet — AuthPathZone consumes it directly.

---

## THE SEAM (patron/signing UI ⇄ package strategy)

```
PATRON zone           SIGNING zone / AuthPathZone        package
─────────             ────────────────────────────        ───────
patronAccount  ─────►  guards: IKeyset[] (patron+account ─► CodexSigningStrategy
(mode→address)         or [patron, chosenKeyset])           .execute({ build, guards })
                                                              │
                       useSignTransaction()  ◄────────────────┘ (InternalCodexResolver
                       (already in package)                      + PactClient, Zustand)
```

- The patron/signing **UI components are NOT yet in the package** (only the headless strategy + resolver + hooks are). `grep` for `SigningZone|PatronZone|AuthPathZone|PatronZonePattern2|usePatronAutoSelect` in the package = **zero hits**. Only `patronSelectionMode` (a settings *type*) exists.
- The package has ZBOM *shell* scaffolding (`src/ui/zbom/`): `ZbomModal`, `CollapsibleZone`, `InfoZoneWrapper`, `ZoneHeader/SignerRow/CapRow` (ported 1:1 from cfm/zones.tsx), `tokens.ts` (ZONE palette incl. `patron`/`signing`), `ZbomShellDemo` with **placeholders** for ZONE 1 (Patron, "Phase 4") and ZONE 3 (Signing, "Phase 6"). So the visual frame exists; the live patron selector + signing analysis bodies do not.

### Already ported vs. must port

**Already in package (Phase 9 + ZBOM shell):**
- Signing strategy/execute pipeline (`useSignTransaction`, `InternalCodexResolver`, `CodexSigningStrategy` via stoa-core).
- Auth/unlock (`useCodexAuth`), codex reads (`useCodex`), guard rotate (`useCodexGuard`).
- ZBOM modal chrome + zone collapsibles + `SignerRow`/`CapRow` primitives + ZONE tokens.
- `patronSelectionMode` settings field (but wrong enum — see below).
- stoa-core primitives `analyzeGuard`, `buildCodexPubSet`, `selectCapsSigningKey`, `analyzeSmartAccountAuthPaths` (consumed, not re-implemented).

**Must port:**
- **PATRON:** `PatronZonePattern2` selector + portal dropdown; `usePatronAutoSelect` state machine (IGNIS fetch, wealthiest, fallback, override) + `usePatronSelectionDefaults`; `PatronIgnisBar`/`InsufficientIgnisAlert`. Replace `useWallet()` (`ouro`/`ouroWalletData`/`kadenaSeeds`/`kadenaAccounts`) with package store (`useCodex`/`useOuroAccounts`/`useActiveWallet`/`useKadenaSeeds`); replace `useSelector(uiSettings.patronSelectionMode)` with `useCodex().uiSettings`.
- **SIGNING:** `SigningZone` (analysis/display), `AuthPathZone` (smart-account picker), `InlineSigningCollapsible`. Same context→store swap. `ManualKeyInput` dependency must be ported or re-provided.
- **Reconcile the patron-mode enum** between OuronetUI (`wealthiest|prime|resident`) and package (`wealthiest|active-wallet|manual`) — currently incompatible.
- **`IOuroAccount` type** (`@/ouro.d`) must map to the package's `OuroAccount`/`entities.ts` shape (uses `.guard`, `.isSmart`, `.isActive`, `.address`, `.name`, `.sovereign`).

### Watch-outs
- `useCFMStrategy` wraps `execute` to force prompt-unlock (`getCurrentPassword`+`authenticate`) — porting consumers must preserve this unlock-on-execute guard or wire it into `CodexProvider`.
- Patron auto-select and signing analysis both call `getIgnisBalance` / `analyzeGuard` independently — duplicate chain reads; a ported version may want to share.
- Foreign-key signing flows through `options.requestForeignKey` → `<ForeignKeySignModal>` in OuronetUI; the package's resolver fail-fasts unless the provider wires a callback.
