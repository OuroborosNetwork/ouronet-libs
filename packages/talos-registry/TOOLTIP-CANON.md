# The pre-ZBOM tooltip canon

A pre-ZBOM tooltip answers one question: **what will this button actually execute, and what will
it cost?** Hovering a launcher should tell you before you commit to opening anything.

Two applications render it — OuronetUI and the Codex — and they were converging on it
independently, each rediscovering the same traps a few weeks apart. **This document is not the
canon.** `src/tooltip.ts` is. A document drifts from the code it describes and nobody finds out
until a user sees a wrong number, so the rules are shipped as an implementation:

```ts
import { tooltipModel, tooltipModels, signatureRows } from "@ouronet/talos-registry";

const m = tooltipModel("TS01-C1.DPTF|C_Transfer", { id: '"OURO-8Nh-JO8JO4F5"' });
// m.slots  -> every execution parameter, in order, with type, value and flags
// m.preview -> the INFO_ call, with ITS OWN parameter list
// m.kind    -> "ouronet" | "native"
```

This file explains **why** each rule exists. Every one is here because it was got wrong first.

---

## Rule 0 — this tooltip is for CHAINWEB calls only

It describes a **Pact call on a Chainweb chain**: what function, what arguments, what it costs. A
button that transacts on **Arweave**, or any other non-Chainweb chain, has none of those things in
this shape.

**Such a button gets no tooltip of this kind — not an empty one.** An empty panel reads as "the
price failed to load"; absence reads as "this is a different kind of thing", which is the truth.
If you want an affordance there, write a different one; do not stretch this model over it.

`chainOf(key)` returns `undefined` for anything this model cannot describe, and `tooltipModels()`
drops such keys rather than throwing. That is how a caller learns to render nothing.

## Rule 1 — show every execution parameter

All of them, always, in declared order.

`DPTF|C_Transfer` takes six arguments and its tooltip displayed five, because it was rendering
the **preview's** list:

```
execution   (patron executor executee id transfer-amount method)     6
preview     (patron id sender receiver transfer-amount)              5
```

Both lists were true. Showing one under a heading that named the other was not. A tooltip that
lists five rows for a six-parameter function is not a summary — it is a wrong answer, and it
teaches a call shape that will not work.

`tooltipModel().slots` is always exactly the entrypoint's own parameters. A test asserts this for
**all 423**, not for the one that was reported.

## Rule 2 — the arguments belong to the execution, the cost belongs to the preview

**410 of the 423 entrypoints have a preview whose parameter list differs from their own.** Only 13
match. Different names, different order, different arity.

So the two cannot share one numbered list, and the preview's values cannot be labelled with the
execution's names. That mislabelling was a real defect: it rendered `executor = <the pool id>`,
`swpair = true`, `toggle = MISSING` for a call that was entirely correct.

Render the execution's arguments as the numbered list. Mention the preview separately — its name,
its own parameter list, and the cost it returns.

**Bind by NAME, never by position.** Positional merging is silent: both values are strings, so an
executor's account lands in a token-id slot, type-checks, and prices a different question.
`tooltipModel(key, values)` merges by name and cannot do otherwise.

## Rule 3 — types go on their own row

```
(patron executor executee id transfer-amount method)
(string string string   string decimal         bool)
```

not

```
(patron:string executor:string executee:string id:string transfer-amount:decimal method:bool)
```

The inline form roughly doubles the width of the widest line in the panel, and the panel is
already the widest thing on screen when it opens. A parallel row costs one line.

`signatureRows(m)` returns `{ names, types }` as equal-length arrays for exactly this.

## Rule 4 — three worlds, and they must be distinguishable

`kind` is `"ouronet"`, `"stoa"` or `"kadena"`. Only the first is in this registry; the other two
are transcribed by hand in `STOA_SIGNATURES` and `KADENA_SIGNATURES`.

| | `ouronet` | `stoa` | `kadena` |
|---|---|---|---|
| what it is | the `ouronet-ns` surface | StoaChain's own `coin` | **Kadena mainnet's `coin`** |
| INFO_ preview | yes | **no** | **no** |
| IGNIS | collected | **none** | **none** |
| accounts | Ouronet glyph strings | `k:` `c:` `u:` `w:` | `k:` principals |
| gas | station pays | **station pays** | **a different chain's gas entirely** |

**`kadena` is not a variant of the other two.** Different chain, different gas, different balances;
nothing about Ouronet's gas station or IGNIS applies to it. Getting this wrong is worse than the
other confusions on this page, because a user who thinks a Kadena transfer is sponsored is wrong
about their own money.

**Both chains call their contract `coin`.** StoaChain uses Ouronet-style names (`C_Transfer`,
`C_URV|Stake`); Kadena uses KIP-0002 kebab-case (`transfer`, `transfer-create`). Nothing collides
today, and `chainOf` **throws** rather than guesses if anything ever does — picking wrong would
describe a call on the wrong chain, which is the kind of wrong that looks right.

Note `coin.transfer-crosschain` is a **`defpact`** — a multi-step continuation. Worth saying out
loud in a renderer: its later steps are not sponsored by anybody.

**The sponsorship row is the one to get right.** An earlier version of this claimed a StoaChain
native call was not sponsored and that the signing account paid its own gas. Both false: every
native modal carries `GAS_PAYER` on the gas-station key and says so in its own header comment. The
claim had been *inferred* from "this is not an Ouronet operation", which says nothing about who
pays the host chain — and it was wrong in the direction that matters.

**That last row is the one to get right.** An earlier version of this claimed a native call was
not sponsored and that the signing account paid its own STOA gas. Both false: every native modal
carries `GAS_PAYER` on the gas-station key beside its own capability, and says so in its own
header comment. The claim had been *inferred* from "this is not an Ouronet operation", which says
nothing about who pays the host chain — and it was wrong in the direction that matters, telling a
user they were about to spend when they were not.

### The palette is canon — `CHAIN_PALETTE`

| chain | colour | |
|---|---|---|
| `ouronet` | `#3b82f6` | **blue** |
| `stoa` | `#ceac5f` | **gold** |
| `kadena` | `#22c55e` | **green** |

**This reverses the 1.4.0 position**, which said the palette was each app's business. The
reasoning then — that a package should not dictate colours inside someone else's design language —
was right about *decoration* and wrong about *this*. The colour encodes **which chain your money
is on**. Two apps teaching different meanings for the same colour is worse than neither using
colour at all, because a user believes whichever they learned first, and these two apps share
users.

`m.chainColor` and `m.chainLabel` are on the model so a renderer cannot quietly pick a different
one, and a test asserts every chain has both — if `Chain` ever gains a member without a colour,
that fails rather than rendering `undefined`, which CSS ignores and which therefore looks like
"no border rule" instead of a bug.

Colours were taken from what was already in use rather than invented: gold is OuronetUI's STOA
accent, blue its established `#3b82f6`, green its success green — unused on any tooltip surface
and therefore free to carry this meaning.

**Make the distinction run in every direction.** We coloured `stoa` gold and left `ouronet` on the
panel's ordinary grey, so it only existed one way: a reader who never hovered a native button
learned no rule at all, and gold read as "something is odd about this one" rather than as a
category. Every kind gets a colour *and* a label.

And **say what is missing** rather than leaving the cost panel empty — an empty panel reads as
"the price failed to load".

## Rule 4b — say who is rendering

Two applications draw this tooltip, and a Codex panel can open over an OuronetUI page. That is
exactly the case where "whose tooltip is this" is hardest to infer from chrome and most useful to
state.

**Carry a caller zone naming the consumer.** One line, its own accent:

```ts
tooltipModel(key, values, CONSUMERS.Codex)      // m.consumer -> { name, accent }
```

| consumer | accent | |
|---|---|---|
| `OuronetUI` | `#d2d3d4` | neutral |
| `Codex` | `#8b5cf6` | **violet** |

**Two axes, deliberately.** The border says *what you are looking at*; the caller zone says *who
is showing it to you*. A consumer accent is therefore never a chain colour, and a test asserts the
two sets do not intersect — the moment they do, the two meanings merge and both become unreadable.

`name` matches the `consumerName` each app already uses for its codex settings, so the workspace
has one spelling of "OuronetUI" rather than two.

Suggested footer, which is what OuronetUI ships:

```
no IGNIS — this is not an Ouronet operation
a StoaChain `coin` call, so nothing prices it. Gas is still sponsored.
```

Signatures are in `STOA_SIGNATURES` and `KADENA_SIGNATURES`, transcribed from the deployed
contracts with line numbers. Use them rather than typing your own.

## Rule 5 — a ghost is not data

Every parameter has a worked example. The shapes are real — read from mainnet — so you can see
that a swpair is a four-segment pipe-joined string and an account is a glyph string, not a `k:`
address. **They are not submittable**, and three cases need distinguishing:

- **`isPlaceholder`** — the generic `"example"`. 225 slots across 147 entrypoints, every one an
  entity id for something that **does not exist on chain** (`fvt-id`, `pool-id`, `score-id`,
  `anchor-id`). Mainnet holds zero anchors and zero scores today. A plausible fake id would return
  a confident price for something nobody owns, which is worse than an obvious gap. **Render it so
  it reads as a placeholder** — grey it, italicise it, anything but plain.
- **`isPreflightFed`** — the argument is the *output of a read*, not user input. The registry
  refuses to invent one and so must you. `execution.preflight` names the read.
- **`prefillable: false`** — a guard. See rule 6.

**Do not fire the preview read when any argument is a placeholder.** The answer is a foregone
refusal, and a read per hover is latency the user pays for a known-no. `m.shouldRead` is already
false in that case.

## Rule 6 — a guard may be shown and must not be prefilled

Six entrypoints take a `guard`, and five are account operations:

```
DALOS|C_DeploySmartAccount · DALOS|C_DeployStandardAccount · DALOS|C_RotateGovernor
DALOS|C_RotateGuard · CODEX|C_RotateCodexGuard · AQP-DSA|C_SetOracleAuth
```

A ghost carries two use tags, both defaulting true, emitted only where something is restricted:

```jsonc
"use": { "new-guard": { "zbom": false, "display": "(read-keyset \"ks\")" } }
```

- **`zbom: false`** — never prefill it into an input that can reach a signed transaction. You do
  not hand someone a keyset and ask them to sign under it.
- **`display`** — render *this* instead of the value. The submittable form and the readable form
  differ: `{"readKeyset": "ks"}` is a transaction-data key NAME, and `(read-keyset "ks")` is what
  a caller actually writes.

A value that is **correct to show and wrong to submit** is precisely what one tag cannot express,
which is why there are two. `tooltipModel` applies both for you.

---

## Placement and behaviour

Not expressible in the model, so they are stated here and they are not optional.

**On the LAUNCHER, never on the ZBOM's execute button.** Owner ruling. Inside a ZBOM the
information is already on the page — the input zone lists every parameter with its declared type,
the INFO panel shows the cost — and a tooltip there draws *over* the modal it annotates. The
tooltip exists to tell you what a button will do **before** you commit to opening it.

**Anchor the edge NEAREST the button.** Placed above, pin the bottom and grow upward; placed
below, pin the top and grow down. Either way the edge beside the button never moves. Pinning the
top in both orientations — from an assumed height — makes every content change move the bottom
edge, so a cycling panel grows and shrinks *away* from the button, which is the direction nobody
is looking.

**Cycle at 10 seconds** when a button fronts several executions. One window, a depletion bar, a
dot per variant. The transaction toaster's ~3s is the wrong model to copy: a toast is glanced at,
this panel is read — an entrypoint, a parameter list, six arguments and a live cost. Restart at
the first variant on every hover; a panel resuming mid-cycle describes an operation you did not
just point at. Cycle in the order the ZBOM presents, so the first thing hovered is the first thing
met.

**Use pointer events.** `onMouseLeave` fires when the cursor crosses onto a child in some engines;
`pointerleave` does not.

**A flickering tooltip is usually a REMOUNT.** If a button component is declared *inside* another
component's body, every render creates a new component type and React unmounts the whole subtree,
destroying the open state. Hoist to module scope.

**Key the preview effect on the rendered CALL STRING**, not on a values object. An inline literal
gives a new object identity every render; keying on it re-fires the read, which sets state, which
re-renders — forever.

**Fail open.** An unknown key renders the children alone. A tooltip is an affordance; taking a
page down because a hint has no data is a worse bug than the missing hint.

**Elide long values in the middle, keeping head AND tail.** An Ouronet account is 162 glyphs;
three in one call makes a tooltip taller than the card it annotates. `"OURO-8Nh…JO4F5"` identifies
a value where a truncated prefix does not. Keep the quotes *outside* the elision — a reader has to
be able to tell a Pact string from a bare decimal — and put the full value on `title`.

## Enforce it, do not remember it

The rule is about a **class**: every button that opens a ZBOM. Classes are where hand-checking
fails. OuronetUI's guard walks every page, finds every ZBOM-opening launcher and fails on a naked
one — it was written after the Define buttons were missed once, and it had to be widened after
three whole toolbars shipped bare while it read a single file and claimed the class.

Two things such a guard must get right: model **both** coverage forms (a textual wrap, or an
`entrypoint=` on a component that wraps internally), and exclude `onClose` handlers, which close a
ZBOM rather than open one.

---

## Sources

- `src/tooltip.ts` — the canon itself; `tests/tooltip.test.ts` enforces all six rules
- 410-of-423 preview divergence, 225 placeholder slots: recomputed from the bundled registry
- The sponsorship correction: owner, 2026-09-27
