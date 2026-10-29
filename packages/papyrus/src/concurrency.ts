import type { PartitionMeta } from "./partition.js";

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOW A MULTI-TRANSACTION OPERATION MAY BE RUN — the Papyrus's third verdict
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Owner ruling, 2026-10-28, verbatim: *"The papyrus needs to show/distinguish for multi tx, if
 * its paralelizable would show paralle, if it's sequential it should show sequential free (no
 * defpacts) or sequential constraint (defpacts)."*
 *
 * The engine already told the user TWO things about a split — how many transactions, and whether
 * the split was ours to make. It did not say the thing that decides what a user may actually DO
 * with those transactions: whether they may be fired at once, or must land one after another.
 * Before this, a 22-batch bulk transfer and a 7-round nonce merge both rendered as
 * *"at least N transactions"*, which is true of both and useful for neither.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * THE THREE KINDS, AND THE REGISTRY'S OWN WORDS FOR WHY
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * This is a reading of `execution.partition`, not a new judgement. Measured on
 * `@ouronet/talos-registry@2.9.0`: of 442 entrypoints, **36 carry a partition** — 22
 * `list`/`partition`, 4 `list`/`reduction`, 2 `cursor`, 8 `architectural`.
 *
 * **PARALLEL** — `list` + `partition`. The registry argues it for `DPOF|C_BulkTransfer`:
 * *"Each leg of a bulk/multi transfer is an independent debit-credit against a distinct
 * recipient (or a distinct token), so the union of two batches moves exactly what one call would.
 * The sender's total is checked per call, which splitting cannot evade."* Order-independent, so
 * the batches may be fired concurrently. This is `CLAUDE.md`'s **fed-slice** shape.
 *
 * **SEQUENTIAL FREE** — `cursor`, and `list` + `reduction`. Ordered, and NO defpact is involved.
 * Two different causes, same consequence:
 *   - a `cursor` pager *"takes a size, computes its own window from stored progress"*, so batch
 *     N+1's window is decided by batch N having landed. The registry is explicit that
 *     *"A DEFPACT IS THE WRONG TOOL HERE"*.
 *   - a `reduction` does not complete the operation per batch, it SHRINKS it — `VST|C_Merge`:
 *     *"860 nonces at 123 per call leaves 7, which are merged again"*, and *"the next round's
 *     nonce ids do not exist until this one lands"*. You cannot even NAME the next call's
 *     arguments before the previous one settles.
 *
 * **SEQUENTIAL CONSTRAINED** — `architectural`. Ordered AND carried by a defpact, so the steps
 * are a continuation rather than separate transactions: *"3 ORDERED PHASES intrinsic to itself,
 * each depending on what the previous one left behind. That is continuation state, so a defpact
 * is the only expression of it."* The constraint is not just order — a defpact's step count is
 * FIXED by its definition, and a later step can only be reached by continuing the pact id the
 * first one returned.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * THE DEFAULT IS SEQUENTIAL, AND THAT ASYMMETRY IS DELIBERATE
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * Every unrecognised or under-specified shape classifies as `sequential-free`, never `parallel`.
 * The two errors are not equal: calling a parallel op sequential costs wall-clock time, while
 * calling a SEQUENTIAL op parallel invites firing N transactions at once against an operation
 * whose batch N+1 depends on batch N. For a `reduction` that means sending calls whose arguments
 * are nonce ids that do not exist yet.
 *
 * So `parallel` is returned only on positive evidence — `kind: "list"` AND
 * `shape: "partition"` — and `concurrency-of.test.ts` asserts that a `list` with no shape, or an
 * unknown kind, does NOT read as parallel.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * IT IS IN THE PACKAGE NOW — v0.2.0
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * Written in OuronetUI on 2026-10-28 with a header saying it belonged here and was not here yet,
 * because `PartitionMeta` lived in a host hook and the package is consumed PUBLISHED rather than
 * linked. `PartitionMeta` moved with it (`partition.ts`), so this file's only import is now a
 * sibling and the host imports BOTH from here. That is the move the note promised, made once
 * rather than left as a duplicate in two places.
 */
export type Concurrency =
  /** One transaction. Nothing to order and nothing to parallelise. */
  | "single"
  /** Independent slices of one argument. May be fired concurrently. */
  | "parallel"
  /** Must land in order, but no defpact — each piece is a free-standing transaction. */
  | "sequential-free"
  /** Must land in order AND is carried by a defpact: a continuation, not separate transactions. */
  | "sequential-constrained";

export interface ConcurrencyVerdict {
  kind: Concurrency;
  /** What the Papyrus shows — short enough to sit on the gas line. */
  label: string;
  /** Why, in one sentence, for the tooltip. */
  why: string;
}

/**
 * CLASSIFY. `null` means the operation carries no partition judgement at all, which for a
 * SINGLE-transaction operation is the correct and complete answer — most of the 442 entrypoints
 * are in that state and nothing is missing.
 *
 * Note that `single` here is about the SHAPE of the operation, not about whether this particular
 * argument set fits: an op with a `list` partition whose list holds one element still reads as
 * `parallel`, because what is being described is how its pieces relate, not how many there are.
 * The transaction COUNT is `lock.state.transactions`, and the two answer different questions.
 */
export function concurrencyOf(part: PartitionMeta | null | undefined): ConcurrencyVerdict {
  if (!part) {
    return {
      kind: "single",
      label: "single transaction",
      why: "This operation carries no split: it runs as one transaction.",
    };
  }

  if (part.kind === "architectural") {
    return {
      kind: "sequential-constrained",
      label: "sequential · constrained",
      why: `Ordered phases carried by a defpact${part.via ? ` (${part.via})` : ""}: each step `
        + "continues the pact the first one opened, so the steps cannot be sent independently "
        + "and their number is fixed by the pact's definition.",
    };
  }

  if (part.kind === "list" && part.shape === "partition") {
    return {
      kind: "parallel",
      label: "parallel",
      why: "Each batch is an independent slice of "
        + `${part.axis ? `\`${part.axis}\`` : "the list"}, so the union of the batches does `
        + "exactly what one call would and they may be sent concurrently.",
    };
  }

  if (part.kind === "cursor") {
    return {
      kind: "sequential-free",
      label: "sequential · free",
      why: "A pager: each call computes its own window from progress stored on chain, so the "
        + "next one cannot be built until this one lands. No defpact is involved.",
    };
  }

  if (part.kind === "list" && part.shape === "reduction") {
    return {
      kind: "sequential-free",
      label: "sequential · free",
      why: "Each round REDUCES the work rather than completing a share of it, and the next "
        + "round's arguments do not exist until this one settles. No defpact is involved.",
    };
  }

  /**
   * THE CONSERVATIVE FALL-THROUGH. Reached by a `list` with no `shape`, or by a `kind` added to
   * the registry after this was written. Both are "we do not know how these pieces relate", and
   * the safe reading of that is SEQUENTIAL — see the asymmetry note above.
   */
  return {
    kind: "sequential-free",
    label: "sequential · free",
    why: "This split's pieces are not declared independent, so they are treated as ordered. "
      + "No defpact is involved.",
  };
}
