/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * IS THIS ENTRYPOINT A DEFPACT, AND HOW MANY STEPS?
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * CORRECTED 2026-10-29, WITHIN THE HOUR, AND THE FIRST VERSION FOUND 8 OF 10
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * This module shipped in 2.81.0 as a REVERSE INDEX over `partition.via`, on the finding that
 * `partitionOf("TS01-CP.SWP|C_AddStandardLiquidity")` is `null` while the single-shot twin
 * carries `{ kind: "architectural", steps: 3, via: … }`. That finding is true. The conclusion
 * drawn from it — that the single-shot is the only place a pact's length is recorded — was not,
 * and it was never checked, because I stopped looking at `execution.partition` the moment it
 * explained the `null`.
 *
 * **`execution.mode === "defpact"` AND `execution.steps` ARE ON THE DOOR ITSELF**, along with a
 * whole `execution.continuation` block spelling out the payload shape, and a `sponsorship` block
 * whose own words are *"Step 0 is sponsored; every later step is not."* — the owner's ruling,
 * already written down by the registry.
 *
 * Measured against `@ouronet/talos-registry@2.10.0`: **10 entrypoints have
 * `execution.mode === "defpact"`**, and only **8** are named by an `architectural` partition's
 * `via`. The two the reverse index could never see are `TS02-C3.MTX-AQP|2|CC_Inject` and
 * `TS02-C3.MTX-AQP|2|CC_SweepRevokeAnchor`, 2-step pacts whose single-shot twins carry no
 * partition at all.
 *
 * AND THE TEST PASSED, which is the part worth keeping. It asserted
 * `allDefpactTwins().length === (count of architectural partitions)` — so it compared the index
 * against the index's OWN FILTER rather than against the population being indexed. That is the
 * `_bandplan.py` error from `CLAUDE.md` in a different language: *"its entrypoint filter was
 * blind to every Talos function — it reported 89 entrypoints where there are 482"*, and the
 * successor tool repeated it one directory over. A test written against the implementation's
 * definition of its own scope cannot report that the scope is wrong.
 *
 * So: `execution` is the authority, and `partition.via` is kept only as a CROSS-CHECK. Where
 * both speak they must agree, and a disagreement is reported rather than resolved.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE DOOR AND NOT `concurrencyOf`
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * `concurrencyOf` reads `execution.partition`, which is a judgement about an operation's SPLIT:
 * *"this operation has a three-phase decomposition, reachable over there"*. It belongs on the
 * single-shot and it is correct there. What the engine needs before it can drive a run is a
 * different question — *"does THIS call open a pact, and how long is it"* — and the answer has
 * always been on the entrypoint being called.
 */
import { entrypointKeys, tryGetEntrypoint } from "@ouronet/talos-registry";
import { partitionOf } from "./partition.js";

export interface DefpactInfo {
  /** The entrypoint that OPENS the pact — the key a spec targets. */
  entrypoint: string;
  /** Steps INCLUDING step 0, from `execution.steps`. */
  steps: number;
  /** The defpact being driven, e.g. `MTX-SWP.MTX|C_AddLiquidity`. */
  pact: string | null;
  /** How many of its steps declare a rollback. `0` means a failure cannot be unwound. */
  rollbackSteps: number;
  /**
   * `false` when the registry says a better route exists.
   *
   * **MEASURED: ALL TEN DEFPACTS ARE `supported: false`, and they are the ONLY ten entrypoints
   * of 442 that declare the flag at all.** Each names a single-transaction `preferInstead` with
   * a byte-identical parameter list. The registry's reasoning, verbatim from the `MTX-AQP` pair:
   * *"Multi-step existed only for the old 150k block gas limit; at 2,000,000 the worst case
   * measures 415,419 gas (21%). Use the twin unless you…"*
   *
   * NOT A REFUSAL. The owner asked for the capability — *"we could in this case run from the
   * papyrus defpacts direct when asked (for example the defpacts variants of the SWP
   * functions)"* — and the existing `swp-pairs-proto` toggle calls itself a proof of concept.
   * But it means a surface offering one of these is offering a DEPRECATED route, and it should
   * say so rather than present it as an equal choice.
   */
  supported: boolean;
  /** The one-transaction entrypoint the registry names instead, when it names one. */
  preferInstead: string | null;
  /**
   * The single-shot whose `partition.via` names this door, or `null`. Two of the ten defpacts
   * have no such declaration, which is exactly what the first version of this module missed.
   */
  declaredBy: string | null;
  /** The registry's own words about the decomposition. */
  note: string | null;
}

export interface DefpactIndexProblem {
  entrypoint: string;
  kind: "conflicting-steps" | "missing-steps";
  detail: string;
}

interface Index {
  byEntrypoint: Map<string, DefpactInfo>;
  problems: DefpactIndexProblem[];
}

let CACHE: Index | null = null;

/** The `execution` block, read defensively — its type is not exported by the package. */
function executionOf(key: string): Record<string, unknown> | null {
  const e = tryGetEntrypoint(key);
  const ex = (e as { execution?: unknown } | null)?.execution;
  return ex && typeof ex === "object" ? ex as Record<string, unknown> : null;
}

function build(): Index {
  const byEntrypoint = new Map<string, DefpactInfo>();
  const problems: DefpactIndexProblem[] = [];

  // The cross-check index: which single-shot, if any, declares each door and with what length.
  const declaredVia = new Map<string, { from: string; steps: number | undefined }>();
  for (const key of entrypointKeys()) {
    const part = partitionOf(key);
    if (part?.kind === "architectural" && part.via) {
      declaredVia.set(part.via, { from: key, steps: part.steps });
    }
  }

  for (const key of entrypointKeys()) {
    const ex = executionOf(key);
    if (!ex || ex.mode !== "defpact") continue;

    const steps = ex.steps;
    if (typeof steps !== "number" || steps < 2) {
      problems.push({
        entrypoint: key,
        kind: "missing-steps",
        detail: `${key} is declared \`mode: "defpact"\` with no usable step count `
          + `(${JSON.stringify(steps)}). A pact cannot be driven without one, and a surface that `
          + `opened it would strand the operation.`,
      });
      continue;
    }

    const via = declaredVia.get(key);
    if (via && typeof via.steps === "number" && via.steps !== steps) {
      // REPORTED, NOT RESOLVED. The two halves of the registry disagree about how long this pact
      // is, and no client can guess which is right — a step too few leaves the pact unfinished
      // while reporting success, which is unrecoverable once an `MTX-SWP` pool moves.
      problems.push({
        entrypoint: key,
        kind: "conflicting-steps",
        detail: `${key} declares ${steps} steps while ${via.from}'s partition says `
          + `${via.steps} for the same pact.`,
      });
      continue;
    }

    byEntrypoint.set(key, {
      entrypoint: key,
      steps,
      pact: typeof ex.pact === "string" ? ex.pact : null,
      rollbackSteps: typeof ex.rollbackSteps === "number" ? ex.rollbackSteps : 0,
      /**
       * ABSENT MEANS SUPPORTED, and this default is UNEXERCISED by the current registry — all
       * ten declare the flag explicitly, so `!== false` and `=== true` are indistinguishable
       * today and a mutant swapping them survives. Recorded rather than quietly tightened:
       * `=== true` would mark a FUTURE defpact that simply omits the flag as deprecated, and a
       * surface would then steer users away from a route that is fine. The failure direction of
       * the two defaults is not symmetric, so the safe one is kept even unexercised.
       */
      supported: ex.supported !== false,
      preferInstead: typeof ex.preferInstead === "string" ? ex.preferInstead : null,
      declaredBy: via?.from ?? null,
      note: typeof ex.note === "string" ? ex.note : null,
    });
  }

  return { byEntrypoint, problems };
}

function index(): Index {
  // Built once. The registry is a frozen snapshot inside a published package, so there is
  // nothing for it to drift against during a session.
  return (CACHE ??= build());
}

/** The pact record for an entrypoint, or `null` if calling it opens no pact. */
export function defpactTwinOf(entrypoint: string): DefpactInfo | null {
  return index().byEntrypoint.get(entrypoint) ?? null;
}

/**
 * Step count including step 0, or `null` for a non-defpact. `null` is the engine's signal to
 * behave exactly as it always has — the facility is OPT-IN BY FACT, not by a flag on a spec,
 * for the same reason `hasPatron` reads the field list: a flag and the registry can disagree,
 * and the one that would be believed is the flag.
 */
export function defpactStepsOf(entrypoint: string): number | null {
  return defpactTwinOf(entrypoint)?.steps ?? null;
}

/** Every defpact the registry declares. For tests and for the audit surface. */
export function allDefpactTwins(): DefpactInfo[] {
  return [...index().byEntrypoint.values()]
    .sort((a, b) => a.entrypoint.localeCompare(b.entrypoint));
}

/**
 * THE DOOR FOR A ONE-TRANSACTION ENTRYPOINT, found by INVERTING the registry's own
 * `preferInstead` relation. `null` when the registry names no multi-step form.
 *
 * This is the direction a UI actually asks in: a page holds the single-shot spec it already
 * renders and wants the defpact variant of it. Inverting `preferInstead` rather than
 * `partition.via` matters — every one of the ten doors carries `preferInstead`, while only eight
 * are named by a `via`, so the `via` direction would silently lose the two `MTX-AQP` pacts for a
 * second time.
 */
export function defpactDoorFor(singleShot: string): DefpactInfo | null {
  for (const info of index().byEntrypoint.values()) {
    if (info.preferInstead === singleShot) return info;
  }
  return null;
}

/** Registry contradictions found while indexing. Asserted EMPTY by the test suite. */
export function defpactIndexProblems(): DefpactIndexProblem[] {
  return index().problems;
}

/** Test seam: drop the memo so a stubbed registry can be re-indexed. */
export function __resetDefpactIndex(): void {
  CACHE = null;
}
