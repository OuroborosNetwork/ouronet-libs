# `@ouronet/papyrus`

The **Papyrus Engine** — how an Ouronet transaction is described, priced, split, signed and
reported. One engine, shared by OuronetUI and Codex.

```
hover hint → Papyrus (price · simulate · lock in · split) → sign → submit → toast
```

## Status

`0.1.1` on public npmjs — the first slice, and deliberately a small one.

**v0.1.1** makes the batch planner reachable. `planBatchesVerified` — the function that does
the *verifying* in "plan, fit, verify and split" — shipped inside `dist/batch.js` in v0.1.0 and
was left off the hand-curated index, while the two types that exist only to describe its
argument and its result *were* exported. Because `exports` admits `.` alone, that made it
unreachable by any path rather than merely undocumented, and the first consumer to wire the
package found out by failing to import the planner its three batched flows are built on.
`tests/surface.test.ts` now compares the index against every module's actual exports, so the
curation may reorder and annotate freely and may not omit.

**v0.1.0** carries only what has **zero host couplings today**, measured rather than assumed: the
**vocabulary** (the three members of the family and the engine's own version — a file with no
imports at all) and the **batch planner** (plan, fit, verify and split a multi-transaction run;
538 lines importing nothing but `@stoachain/stoa-core`).

The rest of the engine still reaches into its host for a wallet context, a query cache, redux and
a toast library, across ~8,800 lines in nine files. Lifting those before inverting them would not
*move* the engine, it would **copy** it, and a copy is the thing this package exists to end: the
engine was implemented three times across two repositories before this, and nobody noticed for a
year because nothing on screen said which one you were in. `PAPYRUS_ENGINE_SPEC.md` §4.3 measures
each coupling; P2 inverts them in place where the consuming test suite can prove behaviour is
unchanged, and P3 lifts what P2 has freed.

*(An earlier wording here counted "about ten touchpoints". That number was retired on 2026-10-28:
it counted call sites of four named facilities and missed react, host components and every
transitive edge, which made four of the nine files read as portable when none of them are. §4.3
is now measured by a test rather than by eye.)*

So the honest description of v0.1.0 is **the parts that were already portable, plus the name** —
and the name matters more than it sounds. `PAPYRUS_VERSION` is what a Papyrus badge renders, so
publishing it is what makes that badge report a real artefact instead of a local constant.

## The three members

| member | what it is |
|---|---|
| **Papyrus Page** | a discrete sheet presented for signing — zones, inputs, the cost rectangle |
| **Papyrus Roll** | the same instrument unrolled down the page, beside the panel that feeds it |
| **Papyrus Leaf** | a live reading: real dirty reads discovering the transaction rather than asking you to type it |

The asymmetry that makes the distinction worth drawing: **a Leaf with no price yet is working; a
Page with no price has a failed preview.** A user who cannot tell the forms apart cannot tell
those states apart either.

## What is in it

```ts
import { PAPYRUS_VERSION, PAPYRUS_COPY, type PapyrusKind } from "@ouronet/papyrus";
import { planBatchesVerified, planStakeBatches } from "@ouronet/papyrus";
import { fitGasModel, perBatchPerNonce } from "@ouronet/papyrus";
```

**The batch planner plans by MEASUREMENT, not by division.** The requirement it implements,
stated by the owner: *"it should split in that many amounts such that each remains AFTER ITS
SIMULATION under 1.9 million"*. Dividing a count by a guessed per-item cost produces batches that
look right and are refused; `fitGasModel` fits the chain's own behaviour from measured `/local`
samples, and `verified` is true only when the returned plan's **largest** batch was measured under
the ceiling — not a nearby batch sampled on the way.

`perBatchPerNonce` splits a per-nonce argument so a batch's Nth slice carries the Nth values. It
is separate from the batching itself because getting it wrong is silent: a positional array of the
wrong length is refused by the contract, which is the loud failure, but an array of the right
length holding the wrong values is a withdrawal of the wrong amounts.

## Peer dependency

`@stoachain/stoa-core` (>= 4.2.0), for `calculateAutoGasLimit` and the active gas limit. It is a
peer rather than a dependency so the consumer's single copy is the one in play — the gas ceiling
has to be the same number everywhere or two parts of one screen disagree about what fits.

## License

Apache-2.0
