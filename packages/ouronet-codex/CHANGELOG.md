# Changelog

All notable changes to `@ouronet/ouronet-codex`.

## 0.5.7 — 2026-06-20

**Patch — the codex unlock window is now absolute, not sliding.** `useEnsureCodexUnlocked` (the gate every codex operation calls before signing/decrypting) called `authenticate()` on *every* invocation — including the cache-hit path where the codex was already unlocked and no password was entered. Each operation therefore silently reset the TTL to the full window, so the "re-authenticate in X" countdown never actually elapsed while the user was active, and an unlock could be extended indefinitely. The gate now snapshots the lock state before prompting and only (re)starts the window on a **fresh** authentication (locked → unlocked); a routine cache hit leaves the countdown untouched, so it counts straight down from the original unlock. The locked path is unchanged (`submitPasswordRequest()` still starts the window). No API changes. New regression test (`tests/ensure-codex-unlocked.test.tsx`) asserts a cache hit does not extend the TTL.

## 0.5.6 — 2026-06-18

**Patch — Register / Release StoicTag now authorise Smart Ouronet Accounts (Σ.) correctly.** Both modals passed the account's raw stored `guard` straight to `execute` as the ownership proof. For a Standard (Ѻ.) account that is correct, but a Smart account authorises via an `enforce-one` over three branches (account guard / sovereign guard / governor) — signing against the bare account guard produced *"Ownership could not be verified!"* on chain. Both modals now mirror the Rotate Sovereign / Rotate Governor flow for `account.isSmart`:

- Resolve the stored `account.guard` (an unresolved keyset-ref object) to a plain keyset via `getKadenaAccountGuard(account.address)`, and fetch the sovereign guard, so the **AuthPathZone** can classify each branch as key-based.
- Render `AuthPathZone` and require the user to pick a satisfiable **key-based** branch (account-guard or sovereign keyset-ref) before the button enables; the governor branch is non-key-based and unusable from this key-driven UI.
- Pass the chosen branch keyset (`authSelection.chosenKeyset`) as the account's auth guard to `execute` instead of the raw `account.guard`. Standard accounts are unchanged — they keep passing their single keyset directly.

No API changes; additive UI wiring only.

## 0.5.5 — 2026-06-11

**Patch — "View Seed Words" now prompts to unlock + the revealed phrase can be hidden.** In `SeedWordsTab`, the per-seed **View Seed Words** action (`handleView`) called `getCurrentPassword()` directly with no unlock prompt — on a locked codex that throws `CodexLockedError`, and the resulting error rendered only *inside* the expandable section, so on a collapsed row the click did nothing visible. It now gates on `ensureCodexUnlocked()` (matching the per-key reveal + Add-Key paths), and the row-level error renders outside the expanded block so it's always visible. Also adds an `IconHideBtn` (eye-off) beside the Copy button so a revealed seed phrase can be hidden again without re-opening the ⋮ menu. No API changes.

## 0.5.4 — 2026-06-10

**Feature + fixes — Smart Ouronet Account activation, and hardening across all operation modals.** Requires `@ouronet/ouronet-core` >= 4.3.5 (new `buildDeploySmartAccountPactCode` + `getDeploySmartAccountInfo`).

- **Activate Smart Ouronet Account (new):** `ActivateSmartAccountModal` deploys a Smart (Σ.) account via `C_DeploySmartAccount`. It clones the Standard activation flow plus a **sovereign** input (an existing Standard Ѻ. account; a Σ. sovereign is rejected). `OuronetAccountsTab` now dispatches on `account.isSmart` — Σ. accounts open the Smart modal, Ѻ. accounts the Standard one (previously Smart accounts wrongly opened the Standard modal). Smart activation is **manual-only** (no Auto toggle).
- **Keyset-ref guards preserved on activation:** both activation modals now pass the guard `mode`/`keysetRef` to the builder, so "Use Existing Keyset" binds `(keyset-ref-guard "<ref>")` on-chain instead of expanding the keyset into a literal inline keyset. (Fixes accounts created with a `keyset` guard when a `keyset-ref` was intended.)
- **Password prompt on every transaction:** the two Activate modals and the three Rotate modals (Payment Key / Guard / Sovereign), in both `zbom/modals/*` and the exported `components/*`, now call `ensureCodexUnlocked()` before signing. Previously they submitted with a locked codex and failed with "Codex is locked, operation getKeyPairByPublicKey…" instead of prompting. All 11 transaction-submitting modals are now gated.
- (Via ouronet-core 4.3.5) the patron IGNIS balance now reads fresh (tier T1), so it no longer shows a stale "Insufficient IGNIS" right after a transfer.

## 0.5.3 — 2026-06-10

**Patch — fixes missing transaction-status cards for the ZBOM operation modals.** The ported operation modals (Activate Standard Account, Rotate Payment Key / Guard / Sovereign / Governor, Register / Release StoicTag) push their tx progress cards to the package's global `toastStore` via `txPending()`. But the host that renders that store — `MultiStepToastContainer` — was never exported and never mounted anywhere, so a transaction would **submit to chain yet render no feedback at all** ("nothing happened" / no status card). `CodexProvider` now mounts `MultiStepToastContainer` once (browser-only; it self-portals to the bottom-right and renders nothing when the store is empty), so every consumer gets the tx cards for free with no extra wiring. No API changes; purely additive.

## 0.5.2 — 2026-06-10

**Patch — fixes Chainweaver (BIP32-Ed25519) private-key handling in two places, and makes imported extended keys signable.**

- **Seed-key reveal showed the wrong private key.** `SeedWordsTab.revealPrivateKey` dumped the library's raw 128-byte key buffer (`[scalar | publicKey | chainCode]`) hex-encoded, with the scalar still **XOR-scrambled against the codex password** (Cardano `cardanoMemoryCombine`, an in-memory safety layer). The result was a 256-hex value whose key bytes were wrong — e.g. `k:d8d5628…` revealed `403ff6…‖d8d5628…(pubkey)‖0500adde…(chainCode)` instead of the canonical `88aa38f…`. The exported key is **password-agnostic**, so the reveal now re-derives Chainweaver / Ecko keys with an **empty** wallet password (plaintext scalar) and returns the first 64 bytes (`kL‖kR`, 128 hex) — byte-for-byte matching Chainweaver / kadenakeys.io exports. Koala (plain Ed25519, 64 hex) is unchanged.
- **Pure Keys rejected the Chainweaver format.** The Import form (`PureKeypairsTab` → Import subtab; also the headless `AddPureKeypairForm`) hardcoded a 64-hex-only check and re-derived via the plain-Ed25519 `publicKeyFromPrivateKey`, so a pasted 128-hex extended key was rejected. Both now accept **64 or 128 hex** and validate via `tryDerivePublicKey` (64 → plain Ed25519, 128 → BIP32-Ed25519 `kL·B`), so an extended key whose public half matches passes the paste-both-halves check.
- **Imported 128-hex keys can now SIGN.** `InternalCodexResolver` detects an extended (128-hex) pure key and repackages it into the encrypted-blob + password shape the WASM extended-key signer consumes — reconstructing `[kL‖kR | pubKey | 0…]` and re-scrambling via the library's own `kadenaChangePassword` — so it routes through the **same** `universalSignTransaction` Chainweaver path that seed-derived accounts use. No custom BIP32 math (the hd-wallet library owns the extended-key format); the produced signature is byte-identical to the genuine seed-derived signature. nacl/`"foreign"` continues to handle 64-hex plain keys.

No API changes; all additive at the package level. New tests cover the extended-key reveal format, 128-hex form acceptance, and an end-to-end Ed25519 verify of a signature produced from an imported Chainweaver key.

## 0.5.1 — 2026-06-08

**Patch — fixes a crash when expanding an Ouronet Account whose payment key holds a balance.** `OuronetAccountsTab` rendered the on-chain `payment-key-balance` directly, but Pact returns decimals as `{ decimal: "…" }` objects — rendering one as a React child throws *"Objects are not valid as a React child"* (#31) and blanks the whole CodexUI page. The value is now coerced through a `decimalToDisplay` helper (inner string for `{ decimal }`, passthrough for number/string, `null` → hidden) before render. No API changes. (The Stoa Accounts tab already coerced balances; this was the one unguarded render.)

## 0.5.0 — 2026-06-08

**Feature release — the complete drop-in CodexUI.** Brings the package to 1:1 functional *and* visual parity with OuronetUI's "My Codex", delivered as a single portable React surface any consumer can mount. With this release OuronetUI retires its legacy My Codex page entirely and serves its Codex **solely** through this package.

### What's new

- **Drop-in CodexUI tabs** (`./ui`) — the full account-management surface, each a standalone export and bundled under `CodexTabs` inside the `CodexUiRoot` token scope:
  - `OuronetAccountsTab` — Standard/Smart accounts with the CodexPrime invariant, on-chain overlay (StoicTag / sovereign / governor), and the seven per-account operation modals (below).
  - `StoaAccountsTab`, `SeedWordsTab` (prime-pinned, then alphabetically sorted), `PureKeypairsTab`, `AddressBookTab` (Ouronet / Stoa / StoicTags subsections).
- **CodexUI settings** (`CodexSettingsSection`) — Operations, Debouncer, Read Functions, Security, Identity & Backup, and Advanced subpages.
- **Segregated per-codex debouncer** (`CodexDebouncerPanel`, `./zbom/debouncer` → `codexClock`) — a real seam-monitor that observes the package's *own* reads (a registry of read functions with per-tier state), independent of any host debouncer.
- **Observational CodexID** (`ObservationalCodexIdDisplay` + settings) — preview a Codex Identity from two APOLLO halves plus a Pure-Key guard, rendered through the same guard-detection engine (`GuardTree`) the accounts use; the chosen entities become non-deletable PRIME entities.
- **The seven per-account operation modals** — Activate Standard, Rotate Payment Key / Guard / Sovereign (smart) / Governor (smart), Register / Release StoicTag — ported code-for-code from OuronetUI and wired directly into each `OuronetAccountsTab` row (debouncer INFO read, patron auto-select, signing preview, and execute glue included).
- **Package-local CFM/ZBOM infrastructure** (`./zbom`) — `useZbomInfoRead` + cost parsers, `usePatronAutoSelect`, `SigningZone`, `useZbomExecute`, and the shared CFM zone components.
- New store settings: `zbomZone0..3`, `zbomExecutePosition`, `patronSelectionMode`, plus the observational-CodexID config.

### Integration

OuronetUI mounts `CodexTabs` + `CodexSettingsSection` on a single `/app/codex-ui` route — its sole Codex surface. An interim `ZbomOperationModal` host (a descriptor-driven single-modal design explored mid-development) was **dropped during reconciliation** in favor of the seven verbatim-cloned modals, which reproduce My Codex behavior exactly.

### Compatibility

Additive at the package level — every prior export keeps its signature. The new public surface is the `./ui` tabs + settings + CodexID + debouncer, plus the `./zbom` CFM/operation infrastructure.

> Note: the `0.3.x`/`0.4.0` local increments (drop-in `./ui` tabs, Codex Identity / CodexGuard, Spawn Standard/Smart flow) shipped into consumers via local dist drops and were not separately published; this `0.5.0` is the first published CHANGELOG entry since `0.2.1`.

## 0.2.1 — 2026-05-27

**Bugfix release** — fixes a packaging bug introduced in v0.1.0 that prevented Node ESM consumers from dynamic-importing any subpath of the package. Reported by the AncientHoldings hub team's Caduceus.1 integration; documented at `AncientHoldings/.bee/discussions/2026-05-27-ouronet-codex-packaging-bug.md`.

### The bug

`dist/**/*.js` re-exported from relative paths WITHOUT the `.js` extension — e.g. `dist/types/index.js:9` had `export { DEFAULT_UI_SETTINGS } from "./entities";`. Under Node 22+ strict ESM resolution, this throws `ERR_MODULE_NOT_FOUND` at the moment of import resolution. TypeScript can resolve extensionless relative paths (it knows about both `.ts` and `.js`), so the source compiled fine, but the emitted JavaScript failed in real Node environments.

Static imports via bundlers (Vite, Next.js, webpack) worked because the bundlers resolve missing extensions. Only `await import('@ouronet/ouronet-codex/...')` from a strict ESM context exposed the bug — which is exactly what the AH hub's `lib/codex-vault.ts::getDefaultUiSettings()` was doing.

### The fix

Updated every relative import in `src/**/*.ts(x)` to include the `.js` extension. Per TypeScript's recommended ESM pattern, the source `.ts` file references the emitted `.js` filename:

```typescript
// Before (v0.1.0, v0.2.0 — broken under Node ESM):
import { DEFAULT_UI_SETTINGS } from "../types/entities";

// After (v0.2.1):
import { DEFAULT_UI_SETTINGS } from "../types/entities.js";
```

35 source files updated, 121 imports rewritten. The same fix was applied to directory-style imports (`from "../provider"` → `from "../provider/index.js"`).

### Verification

- TypeScript typecheck: clean (no regressions)
- Test suite: 161/161 passing (unchanged from v0.2.0)
- Smoke test: `await import('@ouronet/ouronet-codex/types')` now succeeds in a strict ESM context (Node 22+, `type: "module"`)
- Other advertised subpaths (`/adapters`, `/hooks`, `/provider`, `/components`, `/errors`, `/resolver`) also resolve correctly (they fail in our minimal smoke test only due to peer-deps absent in the sandbox — not the extension bug)

### No API changes

Every v0.2.0 export keeps its signature. Consumers can `npm update` and drop any local workarounds; no source change needed in the consumer.

### Broader workspace note (NOT fixed in this release)

The same extensionless-relative-import pattern exists in `@stoachain/stoa-core` and `@stoachain/kadena-stoic-legacy` dist output. They didn't surface because no consumer was dynamic-importing them — they're always statically imported via Next.js / Vite bundling, where the bundler resolves extensions. A coordinated v4.3.1 atomic-triplet bump should apply the same fix there. Tracked separately; not a blocker for any current consumer.

### Recommendations

- AH hub's Caduceus.1 work — `npm update @ouronet/ouronet-codex` after this publishes. The hub's deliberate-no-workaround position is now resolved upstream.
- Future regression prevention: add a CI smoke-test step that runs `node --input-type=module -e "import('@ouronet/ouronet-codex/<each-subpath>')"` for every advertised subpath. Listed as v0.3.0 candidate work in the v0.3.0 design doc.

## 0.2.0 — 2026-05-26

**Structural Prime invariants** — closes the last gap between OuronetUI's
hand-orchestrated `saveWallet()` and what the package enforces by default.
v0.1.0 partially implemented the CodexPrime ouro account but left the
Prime Codex Seed unprotected and the seed↔account linkage implicit; v0.2.0
makes both structural guarantees of every codex, enforced by the package
regardless of how a consumer chooses to install entities.

See [`docs/v0.2.0-design.md`](./docs/v0.2.0-design.md) for the full design
contract.

### Added

- **`IKadenaSeed.isPrime`** field. The Prime Codex Seed is structurally
  unremovable — `deleteKadenaSeed` throws `CodexPrimeSeedProtectedError`
  when called on `isPrime: true`. Symmetric to the existing
  `IOuroAccount.isPrime` (spec §B1, v0.1.0).
- **`CodexPrimeSeedProtectedError`** error class — structured error with
  `seedId` field. Exported from `@ouronet/ouronet-codex/errors`.
- **`CodexKickstartError`** error class — discriminated by `reason`:
  `"already-kickstarted"`, `"smart-account-not-allowed"`, `"id-conflict"`.
  Thrown by `kickstartCodex` / `recoverCodexFromMnemonic` pre-flight guards
  and by the tightened `addKadenaSeed` / `addOuroAccount` id-conflict checks.
- **`IOuroAccount.parentSeedId`** field. Causal identity binding — set by
  `kickstartCodex` to the prime seed's id, so CodexPrime is "the ouro
  derived from the prime seed" (causal), not "the first ouro added"
  (positional). Undefined for pure-keypair-derived accounts.
- **`kickstartCodex(args)`** action — atomically install the Prime Codex
  Seed + CodexPrime ouro account on an empty codex. Pre-flight: refuses
  if codex already has seeds, refuses if ouro is a Smart account. Sets
  `isPrime: true` on both + `parentSeedId` linkage. Auto-activates both.
- **`recoverCodexFromMnemonic(args)`** action — same shape as kickstart
  but for the recovery flow. Allows non-empty codex iff the existing
  prime ids match (idempotent re-install). Preserves unrelated non-prime
  entities (additional seeds, pure keypairs, address book). Does NOT
  auto-activate (caller decides).
- **`KickstartArgs` / `KickstartResult`** types exported from
  `@ouronet/ouronet-codex/state` (and via `useCodexLifecycle`).
- **`useCodexLifecycle()`** hook — exposes `kickstart` + `recover`.
  Single integration point for consumers wiring the package's "first
  codex creation" flow.
- **Legacy codex migration** in `actions.init(adapter)` — when a
  pre-v0.2.0 snapshot loads (≥1 seed but none flagged `isPrime`), the
  first seed is auto-flagged eagerly and the flag is persisted via
  `adapter.saveKadenaSeeds`. The ouro half of the migration is deferred
  to `authenticate(password)` because matching an ouro to a seed
  requires decrypting the ouro's secret — caller can wire this via a
  derive callback if/when surfaced.

### Changed

- **`addKadenaSeed`** — gained two guards: (1) auto-flags `isPrime: true`
  on the very first seed in an empty codex (backward compat with
  consumer code that doesn't yet use `kickstartCodex`); (2) if caller
  passes `isPrime: true` explicitly when a prime already exists, throws
  `CodexKickstartError("id-conflict")`. Also auto-activates the seed if
  no active is set (parity with `addOuroAccount`'s existing behavior).
- **`deleteKadenaSeed`** — gained two behaviors: (1) refuses on
  `isPrime: true` seeds with `CodexPrimeSeedProtectedError`; (2)
  cascade-deletes ouro accounts whose `parentSeedId` matches the seed
  being deleted. Cascade defensively skips prime ouros (so the
  CodexPrime invariant is never violated even via legacy data oddities).
- **`addOuroAccount`** — gained two behaviors: (1) id-conflict guard on
  explicit `isPrime: true` when a prime ouro already exists; (2)
  validates `parentSeedId` against existing seeds — drops the field
  (with `console.warn`) if no matching seed exists, guarding against
  typos.
- **`activeOuroAccountId`** — now defensively re-pointed when
  `deleteKadenaSeed`'s cascade removes the currently-active ouro.

### Migration guide (v0.1.0 → v0.2.0)

For consumers (OuronetUI, AncientHoldings):

- **No breaking changes.** Every v0.1.0 export keeps its signature; new
  surface is additive.
- The **preferred path** for creating a new codex is now
  `useCodexLifecycle().kickstart(args)` instead of separate
  `addKadenaSeed` + `addOuroAccount` calls. This guarantees the prime
  invariants without consumer-side discipline.
- Existing localStorage codexes from v0.1.0 migrate automatically on
  next load — the first kadena seed gets `isPrime: true` eagerly. No
  user-visible action required.
- Backup/restore files (v1.2 wire format) carry the new fields as
  additional properties; v0.1.0 parsers ignore them (additive JSON).
  Importing a legacy backup into v0.2.0 triggers the same migration
  via the underlying `init()` call.

### Tests

- 161 specs total (143 pre-existing + 18 new in `state-store.test.ts`):
  Prime Codex Seed protection, kickstart pre-flight guards, recover
  semantics (empty / idempotent / id-conflict / preserve-unrelated),
  parentSeedId validation, legacy codex auto-migration.
- Two existing tests adjusted to reflect the new auto-prime-first-seed
  behavior (`deleteKadenaSeed`/`deleteSeed` tests now exercise the
  non-prime path against `s2` instead of `s1`).

## 0.1.0 — 2026-05-25

**INITIAL RELEASE** — modular React Codex extracted from OuronetUI as a portable package any React consumer can drop in. Replaces the failed Caduceus-era custom integration attempt with a single canonical Codex any consumer (OuronetUI, AncientHoldings hub, future apps) shares.

Tracking under [`stoa-js/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md`](../../.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md). Per-phase deliverables get logged here as they land.

### Phase 2 — Scaffold (2026-05-24)

- New monorepo sibling at `packages/ouronet-codex/` matching the structural conventions of `packages/ouronet-core/` (subpath-export model, `tsconfig.json` + `tsconfig.build.json` split, vitest with monorepo source-resolution aliases, near-empty `src/index.ts` root entry).
- `package.json` declares 8 subpath exports (`/provider`, `/hooks`, `/components`, `/adapters`, `/resolver`, `/errors`, `/types`, `/google-drive`).
- Peer-deps: `react@^18 || ^19`, `@stoachain/{kadena-stoic-legacy, stoa-core, ouronet-core}@>=4.2.2`. Single regular-dep: `zustand@^5` (internal state container; invisible to consumers).
- TypeScript config adds `jsx: "react-jsx"` (vs the existing 3 packages' no-JSX configs).
- Vitest environment switched to `jsdom` (vs `node` in the existing 3 packages) since components and hooks will need a DOM at test time.
- Empty barrel stubs for each subpath with doc-comments pointing to the relevant spec section, so the import graph is well-formed from day one even before implementation lands.

### Phase 3 — Adapters (2026-05-24)

- `CodexAdapter` interface in `src/adapters/types.ts` — pluggable storage contract (loadAll/saveAll + per-entity convenience writes + touch + UI-settings sidecar + clearAll). Async throughout to accommodate network/file backends.
- `MemoryCodexAdapter` — in-memory implementation for SSR / Next.js server / tests. Uses `structuredClone` for defensive copies so callers cannot mutate persisted snapshots.
- `LocalStorageCodexAdapter` — browser default ported from OuronetUI's `src/kadena/wallet/LocalStorageCodexAdapter.ts`, including the v1.0.9 fix that emits `pureKeypairs` in the export and the per-entry seed-type migration with try/catch fallback to "koala".
- Address-book legacy fallback path preserved (some early codices stored addressBook at the persist-root rather than under the codex key).
- 36 contract tests parameterized to run against both Memory + LocalStorage adapters, asserting identical observable semantics.

### Phase 4 — State store (2026-05-24)

- Zustand store factory at `src/state/store.ts` (~320 LOC) covering the full §6 state model: hydration (ready / initError), auth (locked / passwordCache), codex content (kadenaSeeds / pureKeypairs / ouroAccounts / addressBook / watchList / uiSettings), runtime (active wallet/account, dirty bit, schema version, last-updated metadata), and a namespaced `actions` object with the full CRUD per entity.
- CodexPrime auto-flag on the first added ouro account (spec §B1); `deleteOuroAccount` throws `CodexPrimeProtectedError` on `isPrime: true` (spec §B2).
- Auto-active first wallet/account on `init()` for sensible defaults; clears active when the active entity is deleted.
- `persistAndTouch` helper centralises adapter write + dirty-bit + lastUpdatedAt update so every mutator stays one-liner clean.
- Password cache uses `cache.expiresAt <= Date.now()` (inclusive) so TTL=0 means immediate expiry.
- `_internal_requireUnlocked` exported for Phase 5 hooks that need to gate on unlock state from outside the store.
- 27 action tests covering every CRUD operation, CodexPrime protection, auth flows, active-selection management, meta operations, and reset.

### Phase 5 — Hooks + resolver + provider stub (2026-05-25)

- `InternalCodexResolver` (in `src/resolver/`) — implements `KeyResolver` from `@stoachain/stoa-core/signing` against the internal Zustand store. Replaces OuronetUI's `ReduxCodexResolver`. Three methods: `listCodexPubs` (sync set built from kadenaSeeds + pureKeypairs), `getKeyPairByPublicKey` (auth-gated, decrypts pure keypairs via `smartDecrypt` or re-derives from seed via `KadenaWalletBuilder` + `kadenaDecrypt`, returns `IKadenaKeypair` ready for `universalSignTransaction`), `requestForeignKey` (default-throws `CodexKeyMissingError`; consumers wire a modal callback via constructor options). Emits the structured `CodexKeyMissingError` introduced in OuronetUI v1.0.9 with the same self-diagnostic wording — every consumer now gets the same message.
- `<CodexProvider>` stub (in `src/provider/`) — minimal per-mount store + React Context plumbing. Required `adapter` prop, optional `deviceVariant` prop, fire-and-forget init on mount. Phase 7 will add `passwordCacheMinutes`, `onCodexDirty`, `signingClient`, `initialUiSettings`, auto-rendered `<PasswordModal>`, and SSR-safe placeholder shell.
- `useCodexStore()` internal hook — exposed only to the package's own hooks subpath; consumers go through the typed hooks below.
- **Hooks (`src/hooks/`)** — 11 React hooks:
  - `useCodex()` — high-level read of all codex state (ready/locked/dirty + content + meta).
  - `useActiveWallet()` — active kadena seed + ouro account, IDs + resolved entities + setters.
  - `useGetKeypair()` — stable async `(pub) => Promise<IKadenaKeypair>`. Throws `CodexLockedError` / `CodexKeyMissingError` to match resolver contract.
  - `useSignTransaction()` — replaces OuronetUI's `useCFMStrategy`. Composes `InternalCodexResolver` + `createClient(getPactUrl(KADENA_CHAIN_ID))` into a memoised `CodexSigningStrategy`. Re-memoised on `selectedNode + customNodeUrl` change so node switching takes effect immediately on next `execute()` call (same invalidation rule OuronetUI uses today). Accepts optional `requestForeignKey` callback for foreign-key signing.
  - `useCodexAuth()` — `{ isLocked, authenticate, lock, getCurrentPassword, passwordCacheExpiresAt }`.
  - `useKadenaSeeds()` / `usePureKeypairs()` / `useOuroAccounts()` / `useAddressBook()` / `useWatchList()` — per-entity CRUD wrappers around the store actions. `useWatchList()` is a Phase 5 addition beyond spec §5.2 (store actions for watchlist already existed; skipping the hook would leave 1:1 parity broken).
  - `useCodexBackup()` — `downloadAsJson` (browser `<a>.click` save), `importFromFile(File)`, `exportForCloud()`, `importFromCloud(json)`, `isDirty`, `clearDirty`. On-disk format is the v1.2 codex file plus `pureKeypairs` (OuronetUI v1.0.9 extension). Imports tolerate the absence of `pureKeypairs` so pre-v1.0.9 backups still restore. The hook bypasses `ouronet-core/codex`'s frozen v1.2 codec to allow the augmented format; codec stays a strict v1.2 wire-format reader for purists.
- **Tests (63 new)** — `resolver-internal.test.ts` (14), `provider.test.tsx` (4), `hooks.test.tsx` (~25 across all hooks, with real-crypto roundtrips kept in the resolver suite to avoid duplication). Combined with the prior phases: **101 specs total in the ouronet-codex package, all passing.**

### Phase 6a — Headless components (non-rotation) + password-prompt mechanism (2026-05-25)

Sub-phase split from Phase 6 — the 5 components that don't touch ouronet-core's
Pact builders. Phase 6b lands the 3 rotation modals after the atomic-triplet
bump to 4.3.0 adds the missing `buildRotateGuardPactCode` and
`buildRotatePaymentKeyPactCode` (only `buildRotateSovereignPactCode` exists today).
Phase 6 spec scope was deliberately not "all 4" — `<RotateGovernorModal>` was
deferred post-OuronetUI-migration per locked decision: chain has the Pact
function but no UI surface ships it yet.

State store extensions:
- `pendingPasswordRequest` slice (single nullable, dedup-to-one-modal contract).
- `actions.requestPassword()` returns `Promise<string>`. Concurrent calls
  share a single outstanding request (the dedup fans out resolve/reject
  to every waiting caller).
- `actions.submitPasswordRequest(pw)` calls `authenticate` then resolves
  the awaiting promise.
- `actions.cancelPasswordRequest()` rejects with `CodexLockedError`.

Hook additions:
- `useRequestPassword()` — fast-path resolves immediately when unlocked;
  otherwise triggers the modal-driven prompt via the store action above.
  Stable function identity, safe in useEffect deps.

Components (`src/components/`):
- `<PasswordModal>` — observes `pendingPasswordRequest`; renders nothing
  when null. Default markup is semantic `<div role="dialog">` + `<form>` +
  `<input type="password">` + submit/cancel. Full theming via `className` +
  per-slot render-props (renderTitle / renderSubmitButton / renderCancelButton)
  or whole-component `render` prop override.
- `<BackupRestorePanel>` — wraps `useCodexBackup`. Default markup shows
  download + restore-from-file buttons + header (with dirty-state badge).
  File-restore drives a hidden `<input type="file">` via programmatic click.
  Errors surface via an `<p role="alert">`. Render-prop slots for every
  element + a `downloadFilename` prop.
- `<AddPureKeypairForm>` — pastes a 64-hex private key, derives pub via
  `tryDerivePublicKey`, validates (length + hex-only), prompts for password
  via `useRequestPassword`, encrypts with `smartEncrypt`, persists through
  `usePureKeypairs.addKeypair`. Live derivedPublicKey preview + structured
  validation message + onSuccess callback.
- `<ActiveWalletPicker>` — two `<select>` dropdowns (kadena seeds + ouro
  accounts) wired to `useActiveWallet`. `hideKadenaSeedPicker` /
  `hideOuroAccountPicker` props for consumers that only surface one. Per-item
  render-prop slots for full option markup override.
- `<CodexInfoPanel>` — read-only stats panel. Default markup is a semantic
  `<dl>` showing status (ready/locked/dirty), per-entity counts, schema
  version, last-updated. Whole-component `render` prop for custom layouts.

Tests (+18) in `tests/components.test.tsx` — one describe per component
covering default markup, render-prop overrides, and underlying hook
integration. Plus `<PasswordModal>` round-trip tests (request → submit
resolves promise + hides; cancel rejects with CodexLockedError) and
`useRequestPassword` dedup test.

Workspace test totals after Phase 6a:
  kadena-stoic-legacy   55
  ouronet-codex        119 (was 101; +18 in Phase 6a)
  ouronet-core         788
  stoa-core            653
  total              1,615 passing, no regressions

Typecheck clean across all 4 packages.

### Phase 6b — Headless rotation modals + triplet bump 4.2.2 → 4.3.0 (2026-05-25)

Sub-phase 6b — the 3 rotation modals + the atomic-triplet bump that
adds the Pact builders they consume.

Atomic triplet bumped 4.2.2 → 4.3.0:
- `@ouronet/ouronet-core` adds `buildRotateGuardPactCode` (define/existing
  modes) + `buildRotateKadenaPactCode` to `src/pact/cfmBuilders.ts`. 9 new
  tests in `cfm-builders.test.ts`.
- `@stoachain/kadena-stoic-legacy` + `@stoachain/stoa-core` bumped in
  lockstep per the triplet invariant — functionally identical to 4.2.2.
- ouronet-codex peer-dep ranges bumped to `>=4.3.0` (the rotation modals
  require the new builders).

`<RotateGovernorModal>` deferred post-OuronetUI-migration per spec
locked decision — chain exposes `C_RotateGovernor` but no UI surface
ships it yet.

Components (`src/components/`):
- `<RotateGuardModal>` — two-mode form (define new keys + predicate, or
  reference existing keyset). Builds via `buildRotateGuardPactCode`,
  attaches keyset data slot in define mode, adds new-guard signers in
  define mode, dispatches through `useSignTransaction.execute`.
  Optimistically updates the codex's local guard mirror on success.
- `<RotatePaymentKeyModal>` — single-input form (new 64-hex payment key).
  Validates hex format. Builds via `buildRotateKadenaPactCode`, attaches
  patron + account guard data slots (matches the chain's
  `(read-keyset "ks")` / `(read-keyset "ks-account")` reads).
- `<RotateSovereignModal>` — Smart Account (Σ.) only. Single-input form
  (new sovereign address). Builds via the pre-existing
  `buildRotateSovereignPactCode`. Warns + disables submit on
  non-smart accounts (defense-in-depth — consumer should normally
  gate `isOpen` on `account.isSmart`).

All three:
- Accept `account` + `patron` props (default to active ouro account
  + same-account-as-patron).
- Expose `render` prop for full markup override + `renderSubmitButton`
  slot.
- Reset form state on every re-open.
- `isOpen` gating returns `null` when closed.
- Capture submit errors in local state; surface via default `<p role="alert">`
  or via render-prop's `lastError`.

Tests (+13) in `tests/rotation-modals.test.tsx`:
- isOpen=false renders nothing
- Default markup renders correctly under each modal
- Form validation gates the submit button
- Mode-switching toggles the right inputs (RotateGuard)
- render-prop receives full args bag
- Cancel button calls onClose
- Non-smart accounts trigger the alert + disable submit (RotateSovereign)

The actual submit-side wiring (build closure → strategy.execute → chain)
is verified implicitly: cfm-builders tests assert the emitted Pact code
string for each builder; useSignTransaction tests verify strategy
construction; Phase 9 OuronetUI migration is the end-to-end signal.

Workspace test totals after Phase 6b:
  kadena-stoic-legacy   55
  ouronet-codex        132 (was 119; +13 in Phase 6b)
  ouronet-core         797 (was 788; +9 from new builder tests)
  stoa-core            653
  total              1,637 passing, no regressions

Typecheck clean across all 4 packages.

### Phase 7 — CodexProvider full §5.1 surface (2026-05-25)

Fleshes the Phase 5 stub into the complete provider documented in
spec §5.1. Adds 4 new props + a SSR-safe shell + a second internal
context for the signingClient override:

- **`passwordCacheMinutes`** — TTL in minutes for the unlocked password
  cache. Applied on FRESH boot (when `schemaVersion === 0` after
  `adapter.loadAll()`). A previously-persisted
  `uiSettings.passwordCacheMinutes` overrides this on subsequent
  boots — the prop is the first-boot default, not a force-override.
- **`initialUiSettings`** — `Partial<UiSettings>` overlay applied
  on fresh boot only. Lets consumers ship custom defaults
  (e.g. `{ selectedNode: "node1" }` for a test environment) without
  fighting persisted user preferences.
- **`onCodexDirty`** — callback fired when the codex transitions from
  clean (`dirty: false`) to dirty (`dirty: true`). Subscribed via
  `store.subscribe()` so the callback fires on the EDGE only, not on
  every mutation while already dirty, and not on the initial clean
  state.
- **`signingClient`** — optional pre-configured `PactClient` override.
  When provided, `useSignTransaction` uses it instead of constructing
  one from `createClient(getPactUrl(KADENA_CHAIN_ID))`. Use cases:
  consumer routes Pact calls through a CF-worker proxy (production),
  test environments want a mock client, custom failover semantics.
  Exposed to the package's hooks via a new
  `useSigningClientOverride()` internal hook.

SSR-safe shell:
- `typeof window === "undefined"` check inside the init effect → adapter
  calls skipped on the server. Children still render, so consumers can
  ship a working SSR shell that hydrates on the client. No-op stub
  on the server with `MemoryCodexAdapter` is the recommended pattern
  per the spec.

Internals:
- Two contexts (store + signingClient). Splitting them keeps
  `useSignTransaction`'s lazy-construct fallback clean (returns null
  when no override, rather than forcing every hook to subscribe to
  client-related re-renders).
- Callback refs (`onCodexDirtyRef`, `passwordCacheMinutesRef`,
  `initialUiSettingsRef`) so consumers can pass fresh closures every
  render without re-running the init effect.

`useSignTransaction` updated to consume the override via
`useSigningClientOverride` — backward-compatible: when no override is
present (Phase 5/6 behaviour), still lazy-constructs the default
client and rebuilds on `selectedNode + customNodeUrl` change.

Tests (+11) in `tests/provider.test.tsx`:
- passwordCacheMinutes seeds on fresh boot
- passwordCacheMinutes does NOT override persisted value on re-boot
- initialUiSettings applies on fresh boot
- initialUiSettings does NOT override persisted settings on re-boot
- onCodexDirty fires on clean→dirty transition
- onCodexDirty does NOT fire on initial clean state
- onCodexDirty fires only on the EDGE (once per transition)
- useSigningClientOverride returns null without override
- useSigningClientOverride returns the supplied client
- useSigningClientOverride returns null outside any provider (no throw)
- SSR-safe shell renders children without crashing

Workspace test totals after Phase 7:
  kadena-stoic-legacy   55
  ouronet-codex        143 (was 132; +11 in Phase 7)
  ouronet-core         797
  stoa-core            653
  total              1,648 passing, no regressions

Typecheck clean across all 4 packages.

### Upcoming phases (per spec)

- Phase 8 — Publish v0.1.0 to npm with `alpha` dist-tag (plus triplet
  v4.3.0 published from the same release).
- Phases 9 + 10 — OuronetUI + AncientHoldings migration; API gaps surface
  as v0.x revisions before v1.0.0.
- Post-migration: `<RotateGovernorModal>` + `buildRotateGovernorPactCode`
  land once OuronetUI implements the UI surface.

See the spec doc for the full phase breakdown and acceptance criteria.
