# @ouronet/talos-registry

The Ouronet callable surface, generated from the **deployed** contracts.

A consumer supplies **values**. It never types a function name, an argument order, or an arity.

```ts
import { buildCall, planCall, explainCall } from "@ouronet/talos-registry";

buildCall("TS01-C1.DPTF|C_Transfer", {
  patron: "Σ.…", executor: "Σ.…", executee: "Σ.…",
  id: "OURO-8Nh-JO8JO4F5", "transfer-amount": 1, method: false,
});
// (ouronet-ns.TS01-C1.DPTF|C_Transfer "Σ.…" "Σ.…" "Σ.…" "OURO-8Nh-JO8JO4F5" 1.0 false)
```

Note `1` became `1.0`. Pact's decimal lexer rejects a bare integer in a decimal slot, and that
is the least interesting thing this package stops you getting wrong.

**This build:** 423 entrypoints, 428 previews, surface `9091592ba15520f4`, generated against mainnet.
Every figure in this file is asserted by `tests/readme.test.ts` against the bundled snapshot, so
a stale number fails the suite rather than misleading a reader.

---

## Why it exists

Every consumer bug that led to this was a hand-written Pact template that drifted from the
contract, and **none of them failed loudly**:

- **A missing module member is a RESOLUTION error.** `try` cannot catch it, so consumers render
  it as a default. Thirty-four stale names made Awake and Slumber report "no hibernated nonces"
  against three live ones — it looked like missing data, not a broken call.
- **A short call is not rejected.** Pact **partially applies** and yields a closure. A launchpad
  read passing four arguments to a five-parameter reader returned *"Evaluation did not reduce to
  a value"*; the capabilities came back null and the purchase silently could not be funded.
- **An argument can move without the count changing.** `SWP|C_ChangeOwnership` kept four
  parameters and moved the pool id to last. No arity check catches that.

`buildCall` takes arguments **by name** and renders them in the contract's declared order, so
both classes are impossible.

---

## What an entry knows

Nine things, for all 423 entrypoints:

| | |
|---|---|
| **shape** | parameters in order, with declared types, and the return type when one is declared |
| **preview** | the `INFO_` reader that prices the call — it lives on a *different module* |
| **ownership** | whose key the caller must sign for, marked `ALWAYS` or `CONDITIONAL` |
| **provenance** | deployed vs repo-only, module hash, and any deployed/repo divergence |
| **capabilities** | the reader that computes required `coin.TRANSFER` caps, and how to map its arguments |
| **sponsorship** | whether the gas station pays — and for a `defpact`, that it pays for step 0 only |
| **formula** | same field: the capability reader *is* the formula, because the amounts cannot be derived client-side |
| **ghost** | a worked example for every parameter, shapes read from mainnet |
| **execution** | how it runs — below |

### Execution modes

| mode | n | meaning |
|---|---|---|
| `direct` | 396 | the inputs suffice |
| `defpact` | 10 | multi-transaction by **continuation** |
| `indirect-parallel` | 9 | a preflight cut into slices — order-independent, fire together |
| `indirect-single` | 5 | one transaction, but a preflight supplies an argument |
| `indirect-sequential` | 3 | a preflight reports progress; each call advances a **stored cursor** |

The last two both wear the `p` suffix in Pact and **only one is parallel**. Firing a cursor
pager's pages concurrently races its own counter. `planCall()` says which you have.

---

## Three things that surprise people

**Continuations are not gas-sponsored.** Chainweb injects `exec-code` only for `exec` payloads.
`DALOS.GAS_PAYER` binds it *eagerly*, so on a `cont` it raises before any check runs. Step 0 is
sponsored; the **customer account** pays every later step. All ten `defpact` entrypoints have a
single-transaction twin with a byte-identical parameter list — `preferInstead` names it, and
`buildCall` refuses the defpact route unless you pass `{ allowUnsupported: true }`.

**An entity id is not an account.** `swpair` is a pool id; nobody holds its key. The account is
whatever `UR_OwnerKonto` returns for it. `ownership.requires[].via` says `"parameter"` or
`"reader"`, and never conflates them.

**Four names resolve to two modules.** `SWP|C_AddFrozenLiquidity` and three siblings exist on
both `TS01-C3` (direct) and `TS01-CP` (defpact), with identical signatures. `resolveByName()`
**refuses** rather than guessing — picking wrong is silent in both directions.

---

## API

```ts
// lookup
getEntrypoint(key)            // throws, and names near matches, on a stale key
resolveByName(fn)             // refuses an ambiguous bare name
entrypointKeys() / modules() / entrypointsOfModule(m)
registry / surfaceHash / namespace

// build — checked against the deployed signature
buildCall(key, argsByName, opts?)
buildPreviewCall(key, argsByName, opts?)
buildGhostCall(key)           // the worked example. Illustrative, never submittable.

// plan
planCall(key)   -> CallPlan   // preflight, capabilities, signers, tx count, warnings
explainCall(key) -> string    // the same, as text

// capabilities
capabilityRecipe(key)         // null when GAS_PAYER alone suffices
parseCapabilities(strings)    // <(coin.TRANSFER "a" "b" 1.0)> -> signer args

// rendering
formatForType(value, declaredType)
```

### A launchpad buy, end to end

```ts
const KEY = "TS02-CPAD.SPARK|C_BuySparks";
const recipe = capabilityRecipe(KEY)!;        // DEMIPAD-SPARK.URC_Acquire

const raw  = await pactRead(buildCall(recipe.reader, {
  buyer, amount: sparks, "iz-native": true, slippage: 1.0,
}));
const caps = parseCapabilities(raw);          // attach to the PAYER signer

const code = buildCall(KEY, {
  patron, buyer, "sparks-amount": sparks, "iz-native": true, "max-cost": maxCost,
});
```

Call the reader. **Do not recompute the amounts** — they depend on live price, the
native/wrapped split and a slippage pad, and a self-derived figure signs a capability the
contract will not match.

---

## The snapshot is pinned, deliberately

The registry is **bundled at build time**, not fetched at runtime. Refreshing live would add a
trust surface (whatever a node returns) and a failure mode (offline means no registry) that a
pinned artefact does not have. `surfaceHash` identifies exactly which surface a build was
compiled against.

`npm run sync` copies it from the Pact repo and **refuses** a snapshot that was not generated
against the chain, or that carries deployed/repo divergences — a truncated or repo-only copy
would be worse than none, because consumers would validate against it and get confident wrong
answers.

Regenerate upstream with `python3 REPL/tools/_registry.py --probe`, then `npm run build` here.

## Ghost values

Every parameter has a worked example. They are keyed by **parameter name**, then by type, then
derived from the contract's own `defschema` — 423 entrypoints share 2,182 slots but only 276
distinct names, and four of those cover half of them. Authoring per entrypoint would mean
writing the same account into 416 `patron` slots by hand.

Every id was read from **mainnet**, so the *shape* is real: you can see that a swpair is a
four-segment pipe-joined string and an account is a glyph string, not a `k:` address.

**They are not submittable.** The accounts are not yours to sign for, and an amount of `1.0` is
a placeholder. A preflight-fed parameter is `null` with a note naming the read — the registry
will not invent a value it has just told you cannot be constructed.

## The tooltip canon

`TOOLTIP-CANON.md` and `tooltipModel()` are the shared rules for rendering a pre-ZBOM tooltip —
what to show, in what order, and which of it may be prefilled. They are shipped as an
implementation rather than a document because a document drifts from the code it describes:

```ts
import { tooltipModel, signatureRows } from "@ouronet/talos-registry";
const m = tooltipModel("TS01-C1.DPTF|C_Transfer", { id: '"OURO-8Nh-JO8JO4F5"' });
// m.slots -> EVERY execution parameter, in order, with type, value and flags
// m.preview -> the INFO_ call with ITS OWN parameter list
// m.kind -> "ouronet" | "native"   (native renders gold, has no cost section)
```

Six rules, each there because it was got wrong first — most recently a six-parameter transfer
whose tooltip showed five arguments, because it was rendering the preview's list under the
execution's heading. Read the canon before building one.

### Where a ghost may be used — `ghost.use`

A ghost is not equally safe on every surface, and a single value cannot say so. Entries whose
usage is **restricted** carry a `use` block, keyed by parameter name:

```jsonc
"ghost": {
  "args": { "new-guard": { "readKeyset": "ks" } },
  "use":  { "new-guard": { "zbom": false, "display": "(read-keyset \"ks\")" } }
}
```

| key | meaning |
|---|---|
| `zbom` | may this be **prefilled into an input** that can reach a signed transaction? |
| `tooltip` | may this be **rendered** where nothing is submitted? |
| `display` | render *this string* instead of the value |

**Both flags default to `true`, and the block appears only when something is restricted** — 6 of
423 entrypoints today, every one of them guard-taking. A `use` block on all 2,182 slots would be
noise consumers learn to skip, and the one entry that matters would be invisible inside it.

The case that forced the split is `guard`. A guard **cannot be prefilled** — nobody may hand a
user a keyset and ask them to sign under it — so `zbom` is `false`. But a tooltip showing the
guard slot empty teaches the wrong call shape, so `tooltip` stays `true` and `display` renders
the Pact form the caller actually writes. That is a value which is **correct to show and wrong
to submit**, which is exactly what one tag cannot express.

**Read `use` before prefilling anything.** An absent parameter is unrestricted.
