/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFPACT INDEX — asserted against the DEPLOYED registry, not against the index's own filter
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `defpactTwin.ts` answers "does calling this open a pact, and how long is it". Getting it wrong
 * is unrecoverable: a step count one too low leaves the pact one step short while the UI reports
 * success, and an `MTX-SWP` pact cannot be resumed once the pool moves.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * THE PREVIOUS VERSION OF THIS FILE PASSED WHILE THE INDEX MISSED TWO OF TEN DEFPACTS
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * It asserted `allDefpactTwins().length === (count of architectural partitions)`. The index was
 * BUILT from architectural partitions, so that compared the implementation against its own
 * definition of its own scope — which it satisfies by construction. The two 2-step `MTX-AQP`
 * pacts have no partition anywhere and were invisible to both.
 *
 * This is `CLAUDE.md`'s `_bandplan.py` lesson in a different language: *"its entrypoint filter
 * was blind to every Talos function — it reported 89 entrypoints where there are 482"*, and the
 * successor tool repeated it one directory over. **The population is counted with a predicate
 * the index does not use** — `execution.mode === "defpact"`, read straight off the package.
 */
import { describe, it, expect } from "vitest";
import {
  defpactTwinOf, defpactStepsOf, allDefpactTwins, defpactIndexProblems,
} from "../src/defpactTwin.js";
import { entrypointKeys, getEntrypoint } from "@ouronet/talos-registry";

/** The population, counted independently of the index. */
const DEFPACT_KEYS = entrypointKeys()
  .filter(k => (getEntrypoint(k).execution as any)?.mode === "defpact");

/** The 8 doors a single-shot's `partition.via` happens to name. A SUBSET, and that is the point. */
const VIA_DECLARED = new Set(
  entrypointKeys()
    .map(k => (getEntrypoint(k).execution as any)?.partition)
    .filter((p: any) => p?.kind === "architectural" && p.via)
    .map((p: any) => p.via as string),
);

describe("the defpact index", () => {
  it("finds EVERY entrypoint whose execution mode is defpact", () => {
    expect(DEFPACT_KEYS.length).toBeGreaterThan(0);
    expect(allDefpactTwins().map(t => t.entrypoint).sort())
      .toEqual([...DEFPACT_KEYS].sort());
  });

  it("THE `via` SET IS A STRICT SUBSET — the fact the first version got wrong", () => {
    // If this ever stops being true the reverse-index shortcut becomes tempting again, and the
    // comment explaining why it is wrong would no longer be backed by anything.
    expect(VIA_DECLARED.size).toBeGreaterThan(0);
    expect(VIA_DECLARED.size).toBeLessThan(DEFPACT_KEYS.length);
    const invisible = DEFPACT_KEYS.filter(k => !VIA_DECLARED.has(k));
    expect(invisible.length).toBeGreaterThan(0);
    // And every one of them IS indexed now.
    for (const k of invisible) expect(defpactTwinOf(k)).not.toBeNull();
  });

  it("HAS NO CONTRADICTIONS — no missing step counts, and no door disagreeing with its partition", () => {
    // A conflict is reported rather than resolved precisely so this assertion can exist. If it
    // fails, the two halves of the registry disagree about a pact's length and no client can
    // guess which is right.
    expect(defpactIndexProblems()).toEqual([]);
  });

  it("agrees with the registry field by field, for every pact", () => {
    for (const t of allDefpactTwins()) {
      const ex = getEntrypoint(t.entrypoint).execution as any;
      expect(t.steps).toBe(ex.steps);
      expect(defpactStepsOf(t.entrypoint)).toBe(ex.steps);
      expect(t.pact).toBe(ex.pact ?? null);
      expect(t.rollbackSteps).toBe(ex.rollbackSteps ?? 0);
      expect(t.preferInstead).toBe(ex.preferInstead ?? null);
      // ABSENT MEANS SUPPORTED. Reading "we were not told" as unsupported would mark eight of
      // the ten wrongly, and the two that really are unsupported say so explicitly.
      expect(t.supported).toBe(ex.supported !== false);
    }
  });

  it("every pact has at least 2 steps, so there is always a continuation to drive", () => {
    for (const t of allDefpactTwins()) expect(t.steps).toBeGreaterThanOrEqual(2);
  });

  it("EVERY defpact is `supported: false`, and each names a reachable single-shot instead", () => {
    /**
     * The surprising measured fact, and the reason this is asserted as "all" rather than "some":
     * the ten defpacts are the ONLY ten entrypoints of 442 that declare `supported` at all, and
     * every one declares it FALSE. The registry's own reasoning, verbatim from the `MTX-AQP`
     * pair: *"Multi-step existed only for the old 150k block gas limit; at 2,000,000 the worst
     * case measures 415,419 gas (21%)."*
     *
     * A surface offering one of these is offering a DEPRECATED route. If a defpact ever becomes
     * the supported path this test should fail, because that is a decision worth noticing rather
     * than a number that drifts.
     */
    const all = allDefpactTwins();
    expect(all.filter(t => !t.supported).length).toBe(all.length);
    for (const t of all) {
      expect(t.preferInstead).toBeTruthy();
      // The named alternative must EXIST — a deprecation notice pointing nowhere is worse than
      // none, because a surface would render a dead key as the recommendation.
      expect(() => getEntrypoint(t.preferInstead as string)).not.toThrow();
      // …and it must not itself be a defpact, or the advice is circular.
      expect(defpactTwinOf(t.preferInstead as string)).toBeNull();
    }
  });

  it("records the declaring single-shot where one exists, and null where none does", () => {
    for (const t of allDefpactTwins()) {
      if (VIA_DECLARED.has(t.entrypoint)) {
        expect(t.declaredBy).toBeTruthy();
        const part = (getEntrypoint(t.declaredBy as string).execution as any).partition;
        expect(part.via).toBe(t.entrypoint);
        expect(part.steps).toBe(t.steps);
        // The declaring entrypoint is the ONE-TRANSACTION form. Treating it as a door would
        // send a continuation against an atomic transaction.
        expect(defpactTwinOf(t.declaredBy as string)).toBeNull();
      } else {
        expect(t.declaredBy).toBeNull();
      }
    }
  });

  it("THE MODULE-PREFIX SHORTCUT IS WRONG, and the registry proves it", () => {
    // `"TS01-C3." -> "TS01-CP."` is the tempting rule for finding a door from a single-shot. At
    // least one door's FUNCTION NAME differs from its single-shot's, so the rule yields a key
    // that does not exist and `getEntrypoint` throws — at the moment a user presses execute.
    const renamed = allDefpactTwins().filter(t => {
      if (!t.declaredBy) return false;
      return t.entrypoint.split(".").slice(1).join(".")
          !== t.declaredBy.split(".").slice(1).join(".");
    });
    expect(renamed.length).toBeGreaterThan(0);
  });

  it("returns null for an ordinary entrypoint and for a nonexistent one", () => {
    expect(defpactStepsOf("TS01-C1.DPTF|C_Transfer")).toBeNull();
    expect(defpactStepsOf("NOT-A-MODULE.NOT|A_Function")).toBeNull();
  });
});
