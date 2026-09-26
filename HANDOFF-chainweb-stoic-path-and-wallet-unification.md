# HANDOFF — Chainweb wallet-type unification + the Stoic path + native send capability

> **What this is:** three related items. (1) Chainweaver and EckoWallet are,
> at the crypto level, the exact same thing — this handoff unifies them
> into one presented option instead of two. (2) A new fourth option — the
> "Stoic path" — lets a user derive a real Chainweb `k:` account from the
> SAME DALOS seed words they already use for their Ouronet identity, with
> no separate 12/24-word Kadena mnemonic at all. (3) An **open question**
> (Part 3, below) about whether Codex can construct and send Stoa and
> Arweave transactions *natively* — headlessly, without a human clicking a
> button in OuronetUI — which a future autonomous bridge Constructor
> (Caduceus) will need. This part is genuinely unresolved; it needs the
> Codex agent's own investigation, not just this handoff's say-so.
>
> **Where to work — two repos, both need touching:**
> - `StoaChain/_infra/stoa-js/packages/stoa-core` — the actual derivation
>   dispatcher (`KadenaWalletBuilder.ts`) and the vendored Kadena crypto
>   (`kadena-stoic-legacy`). This is where the unification and the new
>   derivation path both actually live.
> - `OuroborosNetwork/_libs/ouronet-libs/packages/ouronet-codex` — the
>   UI/state consumer of `stoa-core`'s wallet builder (types, the seed-type
>   selector, wallet-spawn modals). This is where the *presented* option
>   count changes from 3 to 3-but-different (see below) and the new option
>   gets wired into the UI.
>
> **Status:** design settled, verified against real, independently-read
> source code (not assumed) — see "How we know this" below. The new
> `@ouronet/dalos-crypto` capability this depends on is real, tested,
> cross-language-verified, and shipping as `v4.5.1` (**not** `v4.5.0` —
> that tag failed its CI lint gate before `npm publish` ever ran, a
> single Biome formatting violation, no functional issue; `4.5.1` is a
> same-day patch that fixed it and is the real first published version of
> this work; `v4.5.0` will never exist on the npm registry). **Blocking
> prerequisite: confirm `@ouronet/dalos-crypto@^4.5.1` is actually live on
> npm before starting** — if `npm view @ouronet/dalos-crypto version`
> still shows `4.4.0`, wait, don't start against local/unpublished code.

---

## Part 1 — Unify Chainweaver and EckoWallet

### How we know this

Read the actual derivation dispatcher directly, not inferred from naming:

`stoa-core/src/wallet/KadenaWalletBuilder.ts`:

```ts
static async createWalletPairFromMnemonic(password, mnemonic, index, seedType: SeedType = "koala") {
  switch (seedType) {
    case "chainweaver":
    case "eckowallet": {                    // <-- IDENTICAL case, same code
      if (!kadenaCheckMnemonic(mnemonic)) throw ...
      const chainweaverSeed = await kadenaMnemonicToRootKeypair(password, mnemonic);
      const wallet = await kadenaGenKeypair(password, chainweaverSeed, index);
      return { publicKey: wallet.publicKey, secretKey: wallet.secretKey };
    }
    case "koala":
    default: { /* different derivation entirely — BIP39 + SLIP-0010 + m'/44'/626'/index' */ }
  }
}
```

Same wordlist (standard BIP39 English, just sourced from a different npm
package than Koala's), same derivation (Cardano's legacy BIP32-Ed25519
scheme via the vendored `kadena-crypto.cjs`), same code path — confirmed
independently against a third-party tool
([`Eucalyptus-Labs/KadenaKeys`](https://github.com/Eucalyptus-Labs/KadenaKeys))
which doesn't even have a separate Chainweaver implementation file — its
own "Chainweaver" UI option routes straight to its `derive_ecko.dart`.
They have never been two things. They're presented as two options today
purely because `SeedType` (`ouronet-codex/src/types/entities.ts`) lists
`"chainweaver" | "eckowallet"` as two string literals and the UI
(`SpawnAccountModal.tsx`, `CreateKadenaSeedModal.tsx`) offers both as
separate dropdown entries.

### What to actually do

**Do not delete either string from `SeedType`** — existing stored accounts
may already record `seedType: "chainweaver"` or `"eckowallet"`, and both
must keep working for recovery. Instead:

1. In the UI (`SpawnAccountModal.tsx` / `CreateKadenaSeedModal.tsx`),
   present **one** option — something like "Chainweaver / EckoWallet
   (12-word)" — instead of two dropdown entries. Internally it can emit
   either string (pick one, e.g. always `"chainweaver"`) since the
   dispatcher already treats them identically.
2. Update the UI copy that currently implies they're different (e.g. "12-word
   mnemonic using Kadena's native Chainweaver wordlist" — misleading; it's
   the same BIP39 English list Koala uses, only the *derivation* differs,
   and that's identical between Chainweaver and Ecko). Say plainly: "same
   derivation as EckoWallet — they've always been the same wallet
   underneath."
3. Leave `KadenaWalletBuilder.ts`'s `switch` exactly as is — the shared
   `case "chainweaver": case "eckowallet":` block is already correct
   or fixing bugs.

---

## Part 2 — Add the Stoic path

### What it is

`@ouronet/dalos-crypto@^4.5.1` ships a new subpath,
`@ouronet/dalos-crypto/chainweb`, that derives a real, standards-compliant
Ed25519 keypair — and therefore a real Chainweb `k:` account — from the
**same DALOS seed bitstring** that already produces a user's Ouronet EC
identity (and, via `/rsa4096`, their Arweave address). No new mnemonic, no
new dictionary to type or back up. Full design:
`DALOS_Crypto/docs/CHAINWEB_STOIC_PATH.md`.

```ts
import { generateFromBitStringAtIndex } from '@ouronet/dalos-crypto/chainweb';

const result = generateFromBitStringAtIndex(dalosSeedBitString, index);
// result.privateKey : Uint8Array(32)  -- Ed25519 seed, RFC 8032
// result.publicKey  : Uint8Array(32)
// result.address    : "k:" + lowercase-hex(publicKey) -- a real k: account
```

`index` gives infinitely many independent Chainweb accounts from one seed
— `index=0` is the default/primary account, any other index is directly
reachable without generating the ones before it (same shape as
`rsa4096`'s indexed/batch/ranges generation, which Codex's Arweave module
already consumes — see `HANDOFF-codex-arweave-integration.md` if you need
that pattern refreshed).

### Where the seed bitstring comes from

`ouronet-codex` already has this — it's the same bitstring
`deriveDoubleApollo` (`src/codex-identity/derivation.ts`) consumes for the
DALOS-native EC path. Confirm at implementation time whether that function
exposes the raw bitstring for reuse or only returns already-EC-shaped
output (the equivalent Arweave handoff flagged this exact gap for
`codex-ouronet`'s Apollo derivation — check whether it was fixed since, or
whether this module needs to derive the bitstring independently via
`seedWordsToBitString` from `@ouronet/dalos-crypto/gen1`, same as the
Arweave handoff's §3 already describes).

### What to add, concretely

1. **A fourth `SeedType` value**, e.g. `"stoic"` — added to `ouronet-codex/src/types/entities.ts`'s union, alongside `"koala" | "chainweaver" | "eckowallet"`.
2. **A new branch in `KadenaWalletBuilder.ts`'s dispatcher** for `case "stoic":` — not a mnemonic-checking branch like the other three (there's no separate mnemonic to validate; the seed words already went through DALOS's own `ValidateSeedWords`/`seedWordsToBitString` pipeline upstream). This branch calls `@ouronet/dalos-crypto/chainweb`'s `generateFromBitStringAtIndex` directly on the already-derived DALOS bitstring.
3. **UI**: a fourth option in the wallet-type selector — something like "Stoic (use my existing Ouronet seed)" — explicitly distinct from the other three in its own framing: this one doesn't ask for a *new* mnemonic at all, it reuses whatever seed words the user already entered for their Ouronet identity. Worth a short explanatory note in the UI copy along the lines of "this account is tied to your existing Ouronet seed — the same words that produce your `Ѻ.`/`Σ.` address and Arweave address also produce this Chainweb account."
4. **Indexing UI**, if desired: since `generateFromBitStringAtIndex` supports infinite positions, consider whether the wallet-spawn flow should expose "generate account #N" the same way the Arweave module already does (see the earlier `HANDOFF-rsa4096-skip-populated-indices.md`-style pattern for "skip already-populated positions" if building multi-account support here too — same shape, same library convention).

### Testing

`DALOS_Crypto/testvectors/v4_chainweb_ed25519.json` is the frozen,
cross-language-verified corpus (Go ↔ TypeScript already confirmed
byte-identical for every vector). Once wired up, feed one of that corpus's
`input_bitstring` values through the new code path and assert the output
`address` matches the corpus's `address` field exactly — same
independent-verification pattern the Arweave handoff's §5 already
established for `rsa4096`.

### Explicitly out of scope for this handoff

- A fixed-dictionary "Stoic wordlist" (a *new* curated 2048-word BIP39-shaped
  list, usable the way Koala's English list is, for a fresh Kadena-only
  wallet with no DALOS identity involved) — discussed as a possible future
  option in `docs/CHAINWEB_STOIC_PATH.md`, not built, not part of this
  handoff. What ships here is the seed-*reuse* path only.
- Any change to Koala's own derivation or UI — untouched.
- Watch-only / non-hardened key derivation — the underlying library
  (`@ouronet/dalos-crypto/chainweb`) uses SLIP-10-style Ed25519, which
  structurally cannot support it. Not a gap in this handoff; a property of
  the chosen derivation family.

---

## Part 3 — OPEN QUESTION: can Codex send Stoa and Arweave transactions natively, without a human in OuronetUI?

**This section is a genuine open question for you (the Codex agent) to
investigate and answer, not a settled requirement.** A quick check from
this end (grep across `ouronet-codex` and `stoa-core`) did not turn up a
clear answer either way — flagging that honestly rather than guessing.

### The actual problem, in the requester's own words

> "The codex can do itself transactions related to codex account
> transactions (Ouronet accounts), but I need it to do on its own send
> transactions of Stoa, as well as Arweave, so that a Constructor — the
> bridge — can operate on its own transactions for the bridge to work.
> Needs to be able to send and receive transactions, which I think the
> Codex is responsible for this, but triggered via its Khronoton package,
> but the Codex is the one constructing them. The reason I'm asking this
> is because on OuronetUI there is no path to send Stoa from Codex
> directly — only from buttons on OuronetUI."

In plain terms: today, sending a Stoa (Chainweb) transaction appears to
happen because a human clicks a button in OuronetUI, which presumably
calls down into Codex/`stoa-core` to actually construct and sign it. What's
unclear is whether that "construct + sign + send" capability is exposed as
a **standalone, headless, directly-callable Codex API** — something a
different consumer (not OuronetUI, not a human) could call on its own —
or whether it's currently entangled with OuronetUI's own button-handler
code in a way that makes it OuronetUI-only in practice.

This matters specifically because of **Caduceus**, the planned autonomous
bridge Constructor: a bridge has to send and receive transactions on its
own, continuously, with no human present to click anything. If the only
way to trigger a Stoa send today is "a person presses a button in a web
UI," Caduceus cannot function — it needs Codex itself to expose a callable
"send this transaction" entry point.

### What to actually investigate and answer

1. **Trace the real call path for a Stoa send today.** Start from
   whatever OuronetUI button currently triggers a transfer, and follow it
   down through `ouronet-codex` into `stoa-core`. At what point does UI
   code end and reusable, headless-callable Codex/`stoa-core` code begin?
   Is there already a function like `sendStoaTransaction(...)` exported
   from `ouronet-codex`'s or `stoa-core`'s public API that a non-UI
   consumer could import and call directly today — or does the actual
   send logic live inside a React component / button handler in
   OuronetUI itself, with no equivalent headless entry point?
2. **If a headless entry point already exists** (the requester's own
   guess is "Stoa could be done right now") — confirm it, document
   exactly what it is and where, and report that back plainly. This may
   turn out to be less work than it looks: exposing an already-existing
   internal function might be enough.
3. **If it doesn't exist** — scope what it would take to add one,
   mirroring the pattern already established for Kadena identity/signing
   in `codex-ouronet` (see the architecture note referenced in the
   earlier Arweave handoff: Codex is one of three chain-agnostic
   Constructors — Pythia = reads, Codex = signing, Khronoton =
   scheduling — and every Automaton/Daimon is composed from them rather
   than reimplementing signing itself).
4. **Find (or rule out) Khronoton.** A repo-wide grep this session found
   "Khronoton" mentioned in Pythia-ledger-flush handoffs and in
   OuronetUI's own server code — **not** obviously as a Codex-owned
   scheduling package anywhere checked. Confirm whether a Khronoton
   package actually exists as the requester's own mental model describes
   it (Codex constructs, Khronoton triggers/schedules), or whether that
   architecture is aspirational/not yet built, or whether it exists under
   a different name/location than assumed here. Report back precisely —
   this is exactly the kind of thing worth verifying against real code
   rather than repeating the requester's framing uncritically.
5. **Arweave is explicitly a separate, later step — do not try to do it
   in the same pass as Stoa.** As of this handoff, only Arweave **address
   generation** has been built (the deterministic RSA-4096 keygen work
   covered in the earlier `HANDOFF-codex-arweave-integration.md` and
   `HANDOFF-rsa4096-skip-populated-indices.md`). Sending/uploading is not
   wired up yet from Codex's own seeded keys, even though the underlying
   `arweave-core` package already has real `sendTransfer()`/`uploadData()`
   functions (see the Arweave handoff's own notes on this) — the gap is
   connecting those to the seeded key-generation path this session built,
   not building send capability from scratch. Answer the Stoa question
   first; treat Arweave's native-send question as a distinct, explicitly
   later follow-up, not something to solve in the same commit.

### What "done" looks like for this part

Not necessarily new code — possibly just a clear, verified answer:
"Yes, `X` in `stoa-core` already does this, here's how to call it
headlessly" or "No, this needs building; here's the scope." Either answer
is useful. Guessing or assuming either way is not.
