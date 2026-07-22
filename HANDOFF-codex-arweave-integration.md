# HANDOFF — OuroNet Codex: Arweave Integration (Foreign-Chain Module #1)

> **What this is:** a build handoff for adding **Arweave** as the first *foreign
> blockchain* the Codex natively supports (keys, native AR transfers, permaweb
> uploads, upload library). This is a **Codex module upgrade** in
> `@ouronet/ouronet-codex` (+ a new framework-agnostic core package), NOT an
> OuronetUI-only change. It is the template for future chains (Bitcoin, …) under
> the planned **Caduceus** bridge (`caduceus.ancientholdings.eu`).
>
> **Where to work:** `D:/_Claude/OuroborosNetwork/_libs/ouronet-libs` (monorepo — holds
> `packages/ouronet-codex`, the triplet, and where a new `arweave-core` package
> would live). Consumers: OuronetUI (browser) + AncientHoldings hub (Node).
>
> **Status:** design agreed in discussion; a few decisions are still OPEN — see
> "§0 Decide first". Recommended next step is `/bee:discuss` in this repo, then
> `/bee:new-spec`.

---

## Why the Codex (not OuronetUI) — the settled reasoning

The Codex is the layer that already (a) **custodies keys and encrypts them at
rest**, (b) owns the **signing + unlock** flow, and (c) owns the **UI tabs** both
consumers render. OuronetUI serves its Codex *solely* through the
`@ouronet/ouronet-codex` package, and the **AncientHoldings hub** consumes the
same package. So:

- Embed Arweave in the Codex → **every consumer inherits it** (OuronetUI *and* the
  hub) with zero per-consumer wiring, and there's exactly one place holding the
  keys + doing the crypto.
- Embed it in OuronetUI → the capability **forks**, and the hub (where the Arweave
  "observer" almost certainly runs) never gets it.

Bitcoin later is the same shape — which is the whole reason to build a **generic
foreign-chain seam now** and register Arweave as implementation #1, rather than
bolting on a one-off.

---

## §0 — DECIDE FIRST (open architecture calls)

These shape everything below. Recommendations given; confirm/override before spec.

1. **Backup-codec version.** `packages/ouronet-core/src/codex/codec.ts` is
   **frozen at `"1.2"`** (`CodexExportV1_2`); `deserializeCodex` **hard-throws** on
   any `version !== "1.2"`. Arweave JWKs are keys the user **must not lose**, so
   they have to ride in the encrypted backup. → **Recommendation: introduce
   `"1.3"` with a forward-migration** (1.2 → 1.3 adds an optional `foreignKeys`
   block; 1.3 reader still accepts 1.2 payloads). This is the single most
   important correctness decision — get it wrong and users generate an AR
   address, back up, restore, and it's gone.

2. **Observer / shared gateway pool.** The build spec (below) reuses "the
   observer's gateway endpoint pool" and a `CONFIRM_DEPTH` concept. **What is the
   observer, and where does the pool live?** → **Recommendation: the gateway pool
   is a module in the new `arweave-core` package that BOTH the codex and the
   observer import** (one config-driven, rotating, backoff-ing pool — not two).
   Confirm what/where the observer is (separate spec? hub service?).

3. **Spec scope: wallet vs bridge.** This spec makes the Codex a **native
   multi-chain wallet** (holds AR keys, sends AR, uploads, keeps a library). That
   is distinct from **Caduceus the bridge** (moving value/attestations between
   Ouronet and Arweave). → **Recommendation: scope THIS spec to the wallet
   capability only; the bridge is a later spec built on top.**

4. **v1 key paths.** The spec puts mnemonic + EthAReum derivation behind
   default-OFF flags. → **Recommendation: ship v1 with the seedless JWK keyring
   only (Module A primary path); defer mnemonic + EthAReum** to keep the first
   spec tight. (Keep the flags in the design so they slot in later.)

5. **Keys vs Library persistence split.** → **Recommendation: keep the small,
   secret, must-be-backed-up KEYS in the codex store/snapshot (encrypted like
   `pureKeypairs`); keep the large, growable, rebuildable-from-chain LIBRARY in a
   separate IndexedDB (browser) / SQLite (Node) cache.** They are different
   persistence problems — don't put upload lists in the key backup.

---

## §1 — Architecture (agreed shape)

Mirror the existing Kadena layering. Kadena protocol logic is NOT in the React
package — it lives in the framework-agnostic triplet, and the codex orchestrates
over it. Do the same for Arweave:

| Layer | Kadena (today) | Arweave (build) |
|---|---|---|
| Framework-agnostic protocol (Node + browser, headless-testable) | `stoa-core` / `ouronet-core` | **NEW `@stoachain/arweave-core`** — keygen, `addressOf`, tx build/sign, gateway pool, Turbo upload, GraphQL rebuild |
| React orchestration (store, hooks, resolver, UI) | `ouronet-codex` | codex gains a foreign-chain **store slice + hooks + signer + UI tab** |

**Keep `arweave-js` / Turbo calls OUT of React components** — they go in
`arweave-core` so the hub can use them server-side (the observer) too.

### The foreign-chain seam (highest-leverage piece)

Define a generic contract so Bitcoin is an *adapter*, not a refactor:

```ts
interface ForeignChainAdapter {
  id: "arweave" | "bitcoin" | ...;
  generateKey(): Promise<ForeignKey>;         // Arweave: RSA JWK
  importKey(raw: unknown): Promise<ForeignKey>;
  addressOf(key: ForeignKey): string;         // Arweave: Base64URL(SHA-256(n)), 43 chars
  getBalance(address: string): Promise<bigint>; // base units (Winston)
  buildSend(p: { from: ForeignKey; to: string; amount: bigint }): Promise<UnsignedTx>;
  sign(tx: UnsignedTx, key: ForeignKey): Promise<SignedTx>;
  post(tx: SignedTx): Promise<string>;        // returns tx id
  // OPTIONAL capability — not every chain has it:
  upload?: ArweaveUploadCapability;           // permaweb; Bitcoin won't implement
}
```

A tiny **chain registry** holds the adapters; the codex UI's new **"Foreign
Chains"** section renders generically off the registry. **Do NOT over-fit the
seam to Arweave's upload/library** — that's an Arweave-only *extension*.

### Signing is a PARALLEL subsystem (not an extension of the Kadena resolver)

`packages/ouronet-codex/src/resolver/InternalCodexResolver.ts` returns an
`IKadenaKeypair` for `universalSignTransaction` (nacl/WASM). Arweave signing is
RSA-PSS + deephash over a JWK — **nothing in common**. Add a *sibling* foreign
signer path; do **not** shoehorn Arweave into `KeyResolver` /
`CodexSigningStrategy`.

---

## §2 — Concrete integration touchpoints (verified in-repo)

- **Store entities** — `packages/ouronet-codex/src/state/store.ts` currently holds
  `kadenaSeeds`, `pureKeypairs`, `ouroAccounts`, `addressBook`, `watchList`,
  `uiSettings`, `passwordCache`. **Add a new `foreignKeys` entity** (keyring of
  encrypted JWKs, each independent — never imply a shared seed). Add store
  actions mirroring the pureKeypairs actions.
- **Snapshot + adapters** — `packages/ouronet-codex/src/adapters/types.ts`
  (`CodexSnapshot`) + `LocalStorageCodexAdapter.ts` / `MemoryCodexAdapter.ts`.
  Extend the snapshot with `foreignKeys`; adapters persist bytes only (keys are
  already encrypted at the hook layer). **The Library gets its OWN store** (see
  §0.5) — do not cram it into `CodexSnapshot`.
- **Key-at-rest + unlock** — reuse `smartEncrypt`/`smartDecrypt`
  (`@stoachain/stoa-core/crypto`) and the existing unlock gate
  `packages/ouronet-codex/src/zbom/hooks/useEnsureCodexUnlocked.ts` (note: the
  unlock window is **absolute, not sliding** — see the
  `codex-unlock-window-absolute` behaviour). Arweave JWKs encrypt/decrypt through
  the **same** codex password + cache. Never log or transmit JWK/private fields.
- **Backup codec** — `packages/ouronet-core/src/codex/codec.ts` (see §0.1).
- **UI** — new top-level **"Foreign Chains"** tab in the codex tab set (pattern:
  `packages/ouronet-codex/src/ui/tabs/OuronetAccountsTab.tsx` /
  `StoaAccountsTab.tsx`). It auto-surfaces in OuronetUI + hub because they render
  the package's `CodexTabs`. Arweave sub-surface: keyring, per-address balance,
  Send AR, Upload, Library.

### Packaging weight (important)

The hub consumes this package in Node; `arweave-js` + Turbo SDK + polyfills are
heavy. **Make foreign-chain support tree-shakeable / lazy** — e.g. a subpath
export `@ouronet/ouronet-codex/foreign/arweave` and/or dynamic import of the
heavy deps — so consumers not using Arweave don't pay for it.

### Cross-cutting

- **Bundler polyfills**: Turbo/arweave-js need `buffer`/`process`/`crypto`
  polyfills under Vite (OuronetUI is Vite 6). Decide where they live (consumer
  vite config vs codex-provided) and document it.
- **RSA keygen is slow** — run it in a **Web Worker** with UI progress; the spec
  notes the delay.
- **Uploads are PERMANENT and PUBLIC** — warn users; if privacy is needed,
  client-side encrypt before upload and manage those keys separately.
- **Units**: centralize Winston↔AR (1 AR = 1e12 Winston); **store Winston, display
  AR.**

### Release / ceremony implications (this repo uses wasp cross-pollinate)

- New `@stoachain/arweave-core` package → **add it to the wasp workspace dep
  graph** (`.wasp/cross-pollinate.yml`) before publishing.
- If the codec changes (§0.1) → `ouronet-core` changes → **triplet lockstep bump**
  (atomic-triplet invariant: all three bump together).
- `ouronet-codex` minor bump; then OuronetUI pin bumps (footer
  `integratedPackages.ts` + changelog + version-pin tests + `generate:inventory`).
- Follow the README Status + `**vX.Y.Z**` history + CHANGELOG doc gates per
  published package.

---

## §3 — BUILD SPEC (the original prompt, verbatim)

ROLE: Extend the OuroNet UI "codex" to support Arweave as a first-class chain:
manage addresses, send native AR, upload data to the permaweb, and keep a local
library of uploaded data for reuse. TypeScript, works in browser + Node. Reuse
the observer's gateway endpoint pool for all reads.

BACKGROUND FACTS THE IMPLEMENTATION MUST RESPECT
- Native wallet = an RSA JWK (fields: kty,n,e,d,p,q,dp,dq,qi). The JWK IS the
  private key. Address = Base64URL(SHA-256(n)), 43 chars.
- Default account creation is SEEDLESS: generate an RSA JWK directly
  (arweave.wallets.generate()); no mnemonic exists unless added.
- Mnemonics are NON-NATIVE and NOT reliably deterministic across libraries. One
  BIP39 phrase => one RSA key => one address; there is NO HD path yielding many
  addresses from one seed. Multiple addresses = multiple keyfiles.
- AR amounts are in Winston: 1 AR = 1_000_000_000_000 Winston.
- Transacting and uploading both go through gateways/bundlers; NO self-run node
  is required for either.

MODULE A — KEYS & ADDRESSES
- Primary path (REQUIRED): generate/import raw JWK keyfiles. Provide generate(),
  importKeyfile(json), exportKeyfile(), and addressOf(jwk) =
  Base64URL(SHA-256(n)).
- Optional mnemonic support (BEHIND A FLAG, default OFF): if enabled, pin EXACTLY
  ONE deterministic derivation implementation, version it, store which impl
  produced each address, and warn users the phrase only restores within this
  codex. Do NOT claim BIP44/multi-account derivation. Show the RSA-keygen delay
  in the UI.
- Optional EthAReum path (BEHIND A FLAG): derive an Arweave JWK from an
  Ethereum/Solana wallet signature + user password, for users who already hold an
  EVM/SVM wallet. One-way link only.
- Multiple addresses in the codex = a keyring of independent JWKs, each stored
  separately. Never imply they share a seed.

MODULE B — SIGNING & NATIVE AR TRANSFERS
- Build:  arweave.createTransaction({ target, quantity }, jwk) — quantity is a
  Winston string.
- Sign:   arweave.transactions.sign(tx, jwk)  (RSA-PSS + deephash).
- Post:   arweave.transactions.post(tx) to a gateway from the pool; retry/rotate
  endpoints on failure.
- Balances via gateway (returned in Winston); convert for display.
- Confirmation status via tx/{id}/status; reuse the observer's CONFIRM_DEPTH
  concept for "final" vs "pending" in the UI.

MODULE C — DATA UPLOAD (permaweb)
- Primary: @ardrive/turbo-sdk.
    const signer = new ArweaveSigner(jwk);
    const turbo  = TurboFactory.authenticated({ signer });
    turbo.upload({ data, dataItemOpts: { tags:[...] } })  // or uploadFile
  Turbo bundles ANS-104 items, gives fast finality, and can be funded with AR via
  turbo.topUpWithTokens (token:"arweave", Winston units) or with Turbo Credits.
- Fallback: base-layer data tx via arweave-js with chunked uploader (getUploader)
  for large files, posted through a gateway.
- REQUIRED tagging schema on every upload (this powers the library):
    App-Name       = OURONET_CODEX_APP_TAG
    Content-Type   = <mime>
    Codex-Item-Id  = <uuid you assign>
    Codex-Owner    = <uploader 43-char address>
    plus any app metadata (title, kind, version).
- Return + persist the resulting Arweave tx id (data item id).
- No self-run node needed; uploads go through Turbo/gateway.

MODULE D — LIBRARY (per-account list of upload links)

PURPOSE: For each codex account, keep a list of everything it has uploaded and
the link to access it — so the user can come back later, see their uploads, and
open the files.

UPLOAD → LINK
- Single file: upload returns a txId. Link = https://<gateway>/<txId>.
- Many files as ONE link (e.g. a GB of photos): upload them under a PATH MANIFEST
  (arweave/paths) — Turbo can upload a folder and emit the manifest. The manifest
  txId is the shareable link:
    Folder link:  https://<gateway>/<manifestTxId>/
    Each file:    https://<gateway>/<manifestTxId>/<filename>
- <gateway> comes from the shared endpoint pool (default arweave.net); the same
  txId resolves on ANY Arweave gateway, so store the bare txId and render the URL
  with whichever gateway is healthy.

LIBRARY ENTRY (persist locally: IndexedDB in browser / SQLite in Node)
  LibraryEntry {
    codexItemId:   string,   // uuid you assign
    ownerAddress:  string,   // 43-char account address
    kind:          "file" | "manifest",
    arweaveTxId:   string,   // the link target (file or manifest id)
    fileName?:     string,   // for single files
    files?:        { name:string, path:string }[],  // for manifests
    contentType:   string,
    sizeBytes:     number,
    tags:          {name:string,value:string}[],
    uploadedAt:    ISO8601,
    status:        "pending" | "final",
    confirmations: number
  }
  Derived getter: url(entry, gateway) =>
    kind==="manifest" ? `${gateway}/${txId}/` : `${gateway}/${txId}`

BEHAVIOUR
- On every upload (Module C), append a LibraryEntry immediately with status
  "pending"; poll tx/{id}/status until confirmations reach the final depth, then
  flip to "final".
- list(ownerAddress): return that account's uploads, newest first, each with its
  ready-to-open link.
- open(codexItemId): resolve the link with a healthy gateway.
- Optional REBUILD-FROM-CHAIN (self-heal if local store is lost): query GraphQL
  (arweave.net + Goldsky) for
    tags: [{App-Name: OURONET_CODEX_APP_TAG}, {Codex-Owner: <ownerAddress>}]
  and reconstruct entries from the returned txIds/tags. The on-chain tag index is
  the source of truth; the local list is a cache.
- OPTIONAL friendly name: an ArNS name can point at a manifest so the link is
  human-readable instead of a raw txId (nice-to-have).

REQUIREMENT
- Tag every upload with App-Name = OURONET_CODEX_APP_TAG, Codex-Owner =
  <ownerAddress>, Codex-Item-Id = <uuid> so the rebuild-from-chain path works. No
  self-run node needed — reads via gateways/GraphQL, uploads via Turbo.

CROSS-CUTTING
- Gateway abstraction: single pooled client shared with the observer;
  config-driven endpoint list; automatic rotation/backoff.
- Security: never log or transmit JWK/private fields; encrypt keys at rest; keep
  signing local; treat uploads as PERMANENT and PUBLIC (warn users; if privacy is
  needed, client-side encrypt before upload and manage keys separately).
- Units: centralize Winston<->AR conversion; store Winston, display AR.

REQUIREMENTS / DEPS
  arweave (arweave-js), @ardrive/turbo-sdk, a GraphQL/HTTP client, local KV/DB
  (IndexedDB or SQLite). Node 18+ for Node targets; provide crypto/buffer/process
  polyfills for web bundlers (Vite/Webpack) as Turbo requires them.

---

## §4 — Acceptance criteria (prompt + discussion additions)

From the prompt:
- Generate + import JWK, derive correct 43-char address.
- Send AR (Winston-correct) and see it reach final depth.
- Upload data with the required tag schema; get a tx id back.
- Library survives a wiped local store by reconciling from GraphQL.
- All reads/writes work on public gateways with no self-run node; switching to a
  self-run gateway is a config change only.

Added from this discussion (architecture-quality gates):
- **Backup round-trips Arweave keys**: generate an AR address → export codex
  backup → wipe → restore → same address, key still signs. (Depends on §0.1.)
- **Generic seam proven**: the "Foreign Chains" UI + registry render Arweave with
  no Arweave-specific branches in the generic layer; a stub second adapter
  registers without touching the generic code.
- **Tree-shake proven**: a consumer that doesn't import the Arweave subpath does
  NOT pull `arweave-js`/Turbo into its bundle.
- **Signing isolation**: Arweave signing does not touch the Kadena
  `KeyResolver`/`CodexSigningStrategy` path.

---

## §5 — Suggested execution order

1. Resolve §0 (esp. codec version + observer/gateway ownership).
2. `/bee:discuss` in `ouronet-libs` with this handoff → grounded discussion notes.
3. `/bee:new-spec` → phases. Rough phase shape:
   - P1 `arweave-core`: gateway pool + units + keys/address (Module A primary) + headless tests.
   - P2 `arweave-core`: native AR build/sign/post + balances/confirmations (Module B).
   - P3 codex store slice `foreignKeys` + encryption-at-rest + backup codec (§0.1) + adapters.
   - P4 `arweave-core` uploads (Module C) + Library store + rebuild-from-chain (Module D).
   - P5 codex UI "Foreign Chains" → Arweave surface (keyring, send, upload, library) + tree-shake/lazy.
   - P6 consumer wiring (OuronetUI pins, footer/changelog, hub) + release ceremony.
