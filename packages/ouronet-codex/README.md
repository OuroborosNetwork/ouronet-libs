# @ouronet/ouronet-codex

> Modular React Codex for the Ouronet ecosystem — drop-in `<CodexProvider>` + hooks + headless components giving any React consumer (OuronetUI, AncientHoldings hub, future apps) full 1:1 Codex functionality without re-implementing it.

> **Renamed.** This package was published as `@stoachain/ouronet-codex` through 0.5.6. The
> code, version line, and release history continue unbroken under the `@ouronet` scope —
> the published name now matches the organisation that owns it. The old name is deprecated
> on npm and points here. Migration is a rename and nothing else:
>
> ```diff
> - import { CodexProvider } from "@stoachain/ouronet-codex";
> + import { CodexProvider } from "@ouronet/ouronet-codex";
> ```

## Status

**`0.5.7` on public npmjs** — Released 2026-06-20. **Patch — the codex unlock window is now absolute, not sliding.** `useEnsureCodexUnlocked` re-authenticated on every call (including cache hits where the codex was already unlocked), so each operation silently reset the TTL and the "re-authenticate in X" countdown never elapsed while active. The gate now only (re)starts the window on a fresh locked → unlocked authentication; a routine cache hit leaves the countdown counting straight down from the original unlock. No API changes.

**`0.5.6` on public npmjs** — Released 2026-06-18. **Patch — Register / Release StoicTag now authorise Smart Ouronet Accounts (Σ.) correctly.** Both modals signed against the account's raw stored `guard`, which on a Smart account (whose on-chain auth is an `enforce-one` over account-guard / sovereign / governor) produced *"Ownership could not be verified!"*. They now mirror Rotate Sovereign / Governor: resolve the account guard (keyset-ref → plain keyset) + fetch the sovereign guard, render **AuthPathZone** to pick a satisfiable key-based branch, and pass the chosen branch keyset to `execute`. Standard (Ѻ.) accounts unchanged. No API changes.

**`0.5.5` on public npmjs** — Released 2026-06-11. **Patch — "View Seed Words" now prompts to unlock, and the revealed phrase can be hidden.** `SeedWordsTab`'s **View Seed Words** action no longer fails silently on a locked codex — it gates on `ensureCodexUnlocked()` (its error also renders outside the collapsed row's expanded block, so failures are visible), and a Hide (eye-off) button beside Copy collapses a revealed phrase. No API changes.

**`0.5.4` on public npmjs** — Released 2026-06-10. **Feature + fixes — Smart Account activation + operation-modal hardening.** Adds `ActivateSmartAccountModal` (`C_DeploySmartAccount`, with a sovereign input; manual-only) and dispatches Activate on `account.isSmart` (Σ. accounts previously wrongly opened the Standard modal). Both activation modals now preserve **keyset-ref guards** ("Use Existing Keyset" → `(keyset-ref-guard "<ref>")` instead of an expanded literal keyset). All 11 transaction modals (the two Activate + three Rotate, in `zbom/modals/*` and `components/*`) now **prompt for the codex password** (`ensureCodexUnlocked`) before signing instead of failing on a locked codex. Requires `@ouronet/ouronet-core` >= 4.3.5. See CHANGELOG.

**`0.5.3` on public npmjs** — Released 2026-06-10. **Patch — fixes missing transaction-status cards for the ZBOM operation modals.** The operation modals (Activate Standard Account, Rotate Payment Key / Guard / Sovereign / Governor, Register / Release StoicTag) push tx progress cards to the package's global `toastStore` via `txPending()`, but the renderer (`MultiStepToastContainer`) was never mounted — so a transaction would submit to chain yet show no feedback. `CodexProvider` now mounts it once (browser-only, self-portals bottom-right, renders nothing when empty). No API changes.

**`0.5.2` on public npmjs** — Released 2026-06-10. **Patch — fixes Chainweaver (BIP32-Ed25519) private-key handling and makes imported extended keys signable.** The seed-key reveal previously dumped the raw 128-byte key buffer with its scalar still XOR-scrambled against the codex password, producing a wrong 256-hex value; it now re-derives Chainweaver / Ecko keys with an empty wallet password and returns the canonical 128-hex `kL‖kR` matching Chainweaver / kadenakeys.io exports (Koala 64-hex unchanged). the Pure Keys Import form (`PureKeypairsTab`, and the headless `AddPureKeypairForm`) now accepts 64 **or** 128 hex (was 64-only, validated via `tryDerivePublicKey`), and `InternalCodexResolver` routes an imported 128-hex extended key through the WASM extended-key signer (`universalSignTransaction`'s Chainweaver path) — no custom BIP32 math, signature byte-identical to the seed-derived path. No API changes.

**`0.5.1` on public npmjs** — Released 2026-06-08. **Patch — fixes a crash when expanding an Ouronet Account whose payment key holds a balance.** Pact returns decimals as `{ decimal: "…" }` objects; `OuronetAccountsTab` rendered the on-chain `payment-key-balance` raw, which throws React error #31 ("Objects are not valid as a React child") and blanks the page. It is now coerced through a `decimalToDisplay` helper before render. No API changes.

**`0.5.0` on public npmjs** — Released 2026-06-08. **Feature release — the complete drop-in CodexUI**, bringing the package to 1:1 functional *and* visual parity with OuronetUI's "My Codex" as a single portable React surface. Ships the full `./ui` tab set under `CodexTabs` / `CodexUiRoot` — `OuronetAccountsTab`, `StoaAccountsTab`, `SeedWordsTab`, `PureKeypairsTab`, `AddressBookTab` — plus `CodexSettingsSection` (Operations / Debouncer / Read Functions / Security / Identity & Backup / Advanced), a segregated per-codex debouncer (`CodexDebouncerPanel`, `codexClock` seam-monitor), the observational CodexID surface (`ObservationalCodexIdDisplay`, rendered through the shared `GuardTree` engine), and the seven per-account operation modals (Activate Standard, Rotate Payment Key / Guard / Sovereign / Governor, Register / Release StoicTag) ported code-for-code and wired into each `OuronetAccountsTab` row with debouncer / patron / signing / execute glue. **OuronetUI retires its legacy My Codex page entirely and serves its Codex solely through this package.** An interim `ZbomOperationModal` host explored mid-development was dropped during reconciliation in favor of the seven verbatim-cloned modals. Additive at the package level — every prior export keeps its signature. The `0.3.x`/`0.4.0` increments shipped to consumers via local dist drops and were not separately published. See CHANGELOG for full details.

**`0.2.1` on public npmjs** (alpha track) — Released 2026-05-27. **Bugfix release** — fixes a packaging bug present since v0.1.0 where `dist/**/*.js` re-exported from relative paths without `.js` extensions, causing `ERR_MODULE_NOT_FOUND` under Node 22+ strict ESM (any consumer doing `await import('@ouronet/ouronet-codex/...')` would crash). Static-import consumers (Vite, Next.js bundlers) were unaffected. AncientHoldings hub's Caduceus.1 integration surfaced + diagnosed it. Tests + typecheck unchanged from v0.2.0 (161 specs pass). No API changes; consumers can `npm update` and drop workarounds. See CHANGELOG for full details.

**`0.2.0` on public npmjs** (alpha track) — Released 2026-05-26. Structural Prime invariants: every codex now has an unremovable Prime Codex Seed (`IKadenaSeed.isPrime`) AND CodexPrime Standard Ouronet Account (`isPrime` + `parentSeedId` linkage). New `kickstartCodex` action atomically installs both from caller-supplied derived entities; new `recoverCodexFromMnemonic` action handles the recovery path. `useCodexLifecycle()` hook is the single integration point. Backward-compatible: every v0.1.0 export keeps its signature, additive only. Pre-v0.2.0 codexes auto-migrate on next `init()` (eager seed-flag). New errors: `CodexPrimeSeedProtectedError`, `CodexKickstartError`. Test count: **161 specs pass** (added 18 in state-store.test.ts). See `docs/v0.2.0-design.md` for the full contract. Peer-deps the v4.2-line atomic triplet at `>=4.3.0` (`@stoachain/kadena-stoic-legacy`, `@stoachain/stoa-core`, `@ouronet/ouronet-core`). Single regular dep on `zustand@^5` (internal state container; invisible to consumers — consumers do NOT need Redux). v0.x ships under the npm `alpha` dist-tag — `npm install @ouronet/ouronet-codex` without an explicit version pulls only when the consumer opts in via `@alpha`. Promotion to `latest` happens at v1.0.0, after both OuronetUI and AncientHoldings have integrated cleanly. Public surface: `/provider` (`<CodexProvider>`), `/hooks` (13 React hooks — added `useCodexLifecycle` in v0.2.0), `/components` (8 headless components — 5 non-rotation + 3 rotation), `/adapters` (CodexAdapter interface + LocalStorageCodexAdapter + MemoryCodexAdapter), `/resolver` (InternalCodexResolver implementing stoa-core's KeyResolver), `/errors` (8 typed CodexError subclasses — added `CodexPrimeSeedProtectedError` + `CodexKickstartError` in v0.2.0), `/types` (entity types), `/google-drive` (opt-in cloud-backup subpath — scaffold only, full impl in a later 0.x).

## Why this exists

Before `@ouronet/ouronet-codex`, the Codex — encrypted multi-wallet store + signing + auth + key-resolution surface — existed only inside OuronetUI as ~5k LOC of React + Redux + localStorage glue. The only portable pieces in `@ouronet/ouronet-core` (`PlaintextCodex`, `serializeCodex`, `CodexSigningStrategy`, `smartEncrypt`/`smartDecrypt`) were primitives — they didn't give a consumer a working Codex out of the box.

When **AncientHoldings** needed Codex-equivalent functionality, the team attempted a from-scratch re-implementation. That attempt failed: duplicated logic, drifted out of sync, never reached UX parity. The lesson is structural — the Codex must be **one canonical package any consumer can drop in**, not a recipe each consumer reimplements.

## Architecture

```
@ouronet/ouronet-core           framework-agnostic primitives
   ├─ /codex                     PlaintextCodex, V1.2 codec
   ├─ /signing                   KeyResolver interface, CodexSigningStrategy
   ├─ /crypto                    smartEncrypt / smartDecrypt
   └─ /interactions/*            chain reads + writes

@ouronet/ouronet-codex          ← this package: React orchestration over the above
   ├─ /provider                  <CodexProvider>
   ├─ /hooks                     useCodex, useActiveWallet, useSignTransaction, ...
   ├─ /components                headless <PasswordModal>, <RotateGuardModal>, ...
   ├─ /adapters                  LocalStorageCodexAdapter, MemoryCodexAdapter
   ├─ /resolver                  InternalCodexResolver
   ├─ /errors                    typed CodexError subclasses
   └─ /google-drive              opt-in cloud sync (separate subpath)
```

`ouronet-codex` peer-deps the v4.2-line atomic triplet (ksl + stoa-core + ouronet-core) at `>=4.3.0`; consumers install both alongside React.

## Install

```bash
npm install @ouronet/ouronet-codex \
            @ouronet/ouronet-core \
            @stoachain/stoa-core \
            @stoachain/kadena-stoic-legacy \
            react react-dom
```

(if you're already consuming the triplet for non-codex purposes, only `@ouronet/ouronet-codex` is new)

## Quick start

```tsx
import { CodexProvider } from "@ouronet/ouronet-codex/provider";
import { LocalStorageCodexAdapter } from "@ouronet/ouronet-codex/adapters";
import { PasswordModal } from "@ouronet/ouronet-codex/components";

function App() {
  return (
    <CodexProvider adapter={new LocalStorageCodexAdapter()}>
      <YourApp />
      <PasswordModal />
    </CodexProvider>
  );
}
```

```tsx
import { useSignTransaction } from "@ouronet/ouronet-codex/hooks";
import { buildSomePactCode } from "@ouronet/ouronet-core/pact";

function YourComponent() {
  const { execute } = useSignTransaction();

  const handleClick = async () => {
    const { requestKey } = await execute({
      build: ({ gasLimit, capsKeyPub, guardPubs }) => /* build Pact transaction */,
      guards: [/* keysets to sign with */],
      paymentKey: null,
    });
    console.log("submitted:", requestKey);
  };

  return <button onClick={handleClick}>Sign + submit</button>;
}
```

Full API + integration patterns: see [the spec doc](https://github.com/StoaChain/stoa-js/blob/main/.bee/specs/2026-05-24-ouronet-codex-modular-package/spec.md) until a real `INTEGRATION-GUIDE.md` lands (planned for v0.2.x).

## Version history

**v0.5.7** — Patch. The codex unlock window is now absolute, not sliding. `useEnsureCodexUnlocked` re-authenticated on every call (including cache hits), silently resetting the TTL each operation so the "re-authenticate in X" countdown never elapsed while active. It now only (re)starts the window on a fresh locked → unlocked authentication; a cache hit leaves the countdown counting down from the original unlock. No API changes; new regression test.

**v0.5.6** — Patch. Register / Release StoicTag now authorise **Smart Ouronet Accounts (Σ.)** correctly. Both modals signed against the account's raw stored `guard`, producing *"Ownership could not be verified!"* on a Smart account (whose on-chain auth is an `enforce-one` over account-guard / sovereign / governor). They now mirror Rotate Sovereign / Governor: resolve the account guard (keyset-ref → plain keyset) + fetch the sovereign guard, render **AuthPathZone** to pick a satisfiable key-based branch, and pass the chosen branch keyset to `execute`. Standard (Ѻ.) accounts unchanged. No API changes.

**v0.5.5** — Patch. `SeedWordsTab` **View Seed Words** now prompts for the codex password when locked (was a silent no-op on a collapsed row — `handleView` skipped the unlock gate, and its error rendered only inside the expanded block) and gained a Hide (eye-off) button beside Copy for the revealed phrase. No API changes.

**v0.5.4** — Feature + fixes. Smart Ouronet Account activation (`ActivateSmartAccountModal` → `C_DeploySmartAccount`, sovereign input, manual-only); Activate now dispatches on `account.isSmart`. Both activation modals preserve keyset-ref guards ("Use Existing Keyset" → `(keyset-ref-guard …)`). All 11 transaction modals (2 Activate + 3 Rotate, in `zbom/modals/*` and `components/*`) prompt for the codex password before signing. Requires ouronet-core >= 4.3.5.

**v0.5.3** — Patch. Fixes missing tx-status cards for the ZBOM operation modals: the modals push to the package's global `toastStore` via `txPending()`, but the renderer `MultiStepToastContainer` was never mounted — so a tx submitted to chain with no visible feedback. `CodexProvider` now mounts it once (browser-only, bottom-right portal). No API changes.

**v0.5.2** — Patch. Fixes Chainweaver (BIP32-Ed25519) private-key handling: the seed-key reveal returned the raw 128-byte buffer with a password-scrambled scalar (wrong 256-hex value) and now returns the canonical 128-hex `kL‖kR` export (empty-password re-derivation; Koala 64-hex unchanged). `AddPureKeypairForm` accepts 64 or 128 hex, and `InternalCodexResolver` routes imported 128-hex extended keys through the WASM extended-key signer so they can sign (no custom BIP32 math; signature identical to the seed path). No API changes.

**v0.5.1** — Patch. Fixes a crash (React error #31) when expanding an Ouronet Account whose payment key holds a balance: `OuronetAccountsTab` rendered the on-chain `payment-key-balance` `{ decimal }` object raw; it is now coerced via `decimalToDisplay` before render. No API changes.

**v0.5.0** — Feature release: the complete drop-in CodexUI. Ships the full `./ui` tab set (Ouronet/Stoa Accounts, Seed Words, Pure Key Pairs, Address Book) under `CodexTabs` / `CodexUiRoot`, `CodexSettingsSection`, a segregated per-codex debouncer (`CodexDebouncerPanel` + the `codexClock` seam-monitor), the observational CodexID (`ObservationalCodexIdDisplay`, rendered through the shared `GuardTree` engine), and the seven per-account operation modals (Activate Standard, Rotate Payment Key / Guard / Sovereign / Governor, Register / Release StoicTag) wired into each `OuronetAccountsTab` row. OuronetUI retires its legacy My Codex page and serves its Codex solely through this package. An interim `ZbomOperationModal` host explored mid-development was dropped in favor of the seven verbatim modals. Additive — every prior export keeps its signature. Published to the npm `latest` dist-tag. The `0.3.x`/`0.4.0` increments shipped via local dist drops and were not separately published. See CHANGELOG.

**v0.2.1** — Bugfix release. Fixed extensionless relative imports in emitted `dist/**/*.js` (35 source files updated, 121 imports rewritten). Resolves `ERR_MODULE_NOT_FOUND` for Node ESM dynamic-import consumers. 161 specs still pass; no API changes; backward-compatible with v0.2.0 consumers. Reported by AncientHoldings hub Caduceus.1 work. See CHANGELOG entry for the full diagnosis.

**v0.2.0** — Structural Prime invariants. Added `IKadenaSeed.isPrime` + `IOuroAccount.parentSeedId` (causal seed↔account linkage). Added `kickstartCodex` + `recoverCodexFromMnemonic` actions on the store, exposed via the new `useCodexLifecycle()` hook. Added `CodexPrimeSeedProtectedError` + `CodexKickstartError` error classes. Tightened `addKadenaSeed` (auto-prime first + id-conflict guard) + `deleteKadenaSeed` (prime protection + cascade-delete linked ouro accounts) + `addOuroAccount` (parentSeedId validation). Legacy pre-v0.2.0 codexes auto-migrate on `init()` (eager seed-flag; ouro half deferred to authentication). Two existing tests adjusted for the new auto-prime-first-seed behavior. 161 specs pass (+18). Backward-compat preserved — every v0.1.0 export keeps its signature. See `packages/ouronet-codex/docs/v0.2.0-design.md` for the design lock.

**v0.1.0** — initial alpha release. Peer-deps the v4.3.0 atomic triplet. Ships the full Phase 2-7 surface from the spec: scaffold (Phase 2), adapters (Phase 3 — `CodexAdapter` interface + `LocalStorageCodexAdapter` + `MemoryCodexAdapter`, with 36 contract tests parameterized across both implementations), Zustand state store (Phase 4 — `CodexStore` with namespaced actions, CodexPrime protection, 27 action tests), hooks + resolver + provider stub (Phase 5 — 11 hooks: `useCodex`, `useActiveWallet`, `useGetKeypair`, `useSignTransaction`, `useCodexAuth`, `useKadenaSeeds`, `usePureKeypairs`, `useOuroAccounts`, `useAddressBook`, `useWatchList`, `useCodexBackup`; `InternalCodexResolver` implementing stoa-core's `KeyResolver`; minimal provider stub), 5 non-rotation headless components (Phase 6a — `<PasswordModal>` with promise-returning prompt mechanism, `<BackupRestorePanel>`, `<AddPureKeypairForm>`, `<ActiveWalletPicker>`, `<CodexInfoPanel>`), 3 rotation modals (Phase 6b — `<RotateGuardModal>`, `<RotatePaymentKeyModal>`, `<RotateSovereignModal>`; the 4th `<RotateGovernorModal>` is deferred post-OuronetUI-migration), provider full §5.1 surface (Phase 7 — `passwordCacheMinutes` + `initialUiSettings` + `onCodexDirty` + `signingClient` override + SSR-safe shell). **143 specs pass.** Published with npm `alpha` dist-tag. Acceptance for v1.0.0 (latest tag) is OuronetUI's clean migration (Phase 9 of the spec) + AncientHoldings's clean integration (Phase 10); API gaps surface as v0.x revisions before v1.0.0.

## License

UNLICENSED — internal StoaChain ecosystem use.
