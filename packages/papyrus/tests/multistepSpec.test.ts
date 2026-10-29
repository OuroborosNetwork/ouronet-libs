/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE MULTI-STEP DERIVATION — a spec with one field changed, and the identity that makes it safe
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `multistepSpecOf` re-points a spec at its defpact door rather than duplicating its field list.
 * That is only sound while the door's parameters match the single-shot's, which is a MEASUREMENT
 * of a published registry snapshot and NOT a contract — so the identity is asserted here for
 * every pair the registry declares, and the derivation re-checks it per call.
 *
 * WHAT IS *NOT* HERE: the consumer's own specs. `OuronetUI`'s suite asserts that every
 * add-liquidity mode the chain supports derives and that Fuel does not, against
 * `ADD_LIQUIDITY_VARIANTS` — facts about that app's spec table, which this package has no view
 * of and should not acquire one for a test.
 */
import { describe, expect, it } from "vitest";
import { multistepSpecOf, multistepProblemsFor, multistepParamMismatch }
  from "../src/multistepSpec.js";
import { allDefpactTwins, defpactDoorFor } from "../src/defpactTwin.js";
import { entrypointKeys, getEntrypoint } from "@ouronet/talos-registry";

const sig = (k: string) =>
  ((getEntrypoint(k) as unknown as { params?: Array<{ name: string; type: string }> }).params ?? [])
    .map(p => `${p.name}:${p.type}`).join(", ");

/** A minimal spec shaped like a consumer's, so the derivation is exercised without importing one. */
const specFor = (entrypoint: string) => ({ entrypoint, title: "Do It", txLabel: "Doing It" });

describe("the single-shot <-> defpact parameter identity", () => {
  it("holds for EVERY door the registry declares", () => {
    const twins = allDefpactTwins();
    expect(twins.length).toBeGreaterThan(0);
    for (const t of twins) {
      expect(t.preferInstead).toBeTruthy();
      // Name for name and type for type. If this breaks, a derived spec would send a call the
      // door does not declare — which the registry's formatter refuses, but at EXECUTE time.
      expect(sig(t.entrypoint)).toBe(sig(t.preferInstead as string));
    }
  });

  it("`defpactDoorFor` inverts `preferInstead` TOTALLY, including the doors with no `via`", () => {
    for (const t of allDefpactTwins()) {
      expect(defpactDoorFor(t.preferInstead as string)?.entrypoint).toBe(t.entrypoint);
    }
    // Inverting `partition.via` instead would reach only 8 of the 10 — the error the first
    // version of `defpactTwin.ts` made, and the one this direction must not repeat.
    const viaDeclared = new Set(
      entrypointKeys()
        .map(k => (getEntrypoint(k).execution as unknown as { partition?: { kind?: string; via?: string } })?.partition)
        .filter((p): p is { kind: string; via: string } => p?.kind === "architectural" && !!p.via)
        .map(p => p.via),
    );
    expect(viaDeclared.size).toBeLessThan(allDefpactTwins().length);
  });
});

describe("multistepSpecOf", () => {
  it("re-points the entrypoint and carries the defpact record", () => {
    const door = allDefpactTwins()[0]!;
    const d = multistepSpecOf(specFor(door.preferInstead as string));
    expect(d).not.toBeNull();
    expect(d!.spec.entrypoint).toBe(door.entrypoint);
    expect(d!.defpact.steps).toBe(door.steps);
  });

  it("PRESERVES EVERY OTHER FIELD BY REFERENCE, which is the whole safety property", () => {
    // A derivation that copied its source's nested objects would be a second spec that merely
    // started out identical. Identity of reference is what makes drift impossible rather than
    // unlikely.
    const fields = [{ param: "patron" }];
    const base = { ...specFor(allDefpactTwins()[0]!.preferInstead as string), fields };
    const d = multistepSpecOf(base)!;
    expect(d.spec.fields).toBe(fields);
  });

  it("CHANGES THE LABEL, because a toast must not report a multi-step run as submitted", () => {
    const door = allDefpactTwins()[0]!;
    const base = specFor(door.preferInstead as string);
    const d = multistepSpecOf(base)!;
    expect(d.spec.txLabel).not.toBe(base.txLabel);
    expect(d.spec.txLabel).toContain("multi-step");
    expect(d.spec.title).toContain(String(door.steps));
  });

  it("derives for every door the registry declares, and for nothing else", () => {
    for (const t of allDefpactTwins()) {
      expect(multistepSpecOf(specFor(t.preferInstead as string))).not.toBeNull();
      // Pointing at the DOOR already has no further multi-step form — the advice is not circular.
      expect(multistepSpecOf(specFor(t.entrypoint))).toBeNull();
    }
  });

  it("returns null for an ordinary entrypoint and for a nonexistent one", () => {
    expect(multistepSpecOf(specFor("TS01-C1.DPTF|C_Transfer"))).toBeNull();
    expect(multistepSpecOf(specFor("NOT-A-MODULE.NOT|A_Function"))).toBeNull();
  });

  it("HAS NO PARAMETER DISAGREEMENTS anywhere in the registry", () => {
    // The guard that turns a future registry change into a failing test rather than a refused
    // transaction — run over every declared pair, not over a fixture.
    const everySingleShot = allDefpactTwins().map(t => specFor(t.preferInstead as string));
    expect(multistepProblemsFor(everySingleShot)).toEqual([]);
  });

  it("the MISMATCH MESSAGE is tested on keys the registry does not know", () => {
    /**
     * The refusal branch inside `multistepSpecOf` is UNREACHABLE against the real registry: the
     * door is found by inverting `preferInstead`, so the single-shot key is known by
     * construction, and the suite above asserts no declared pair disagrees today.
     *
     * An unexercised refusal is indistinguishable from a missing one. So the comparison is a
     * function of two KEYS, and it is exercised with keys that do not exist — the same branch a
     * widened door would take, producing the same message a future mismatch would.
     */
    const why = multistepParamMismatch("NOPE.A|x", "ALSO-NOPE.B|y");
    expect(why).toBeTruthy();
    expect(why).toContain("parameter lists differ");
    expect(why).toContain("the door does not declare");

    // A real pair still reads as agreeing, so the function is not simply always refusing.
    const door = allDefpactTwins()[0]!;
    expect(multistepParamMismatch(door.preferInstead as string, door.entrypoint)).toBeNull();

    // One side known, one not — the half-unknown case, which `a === b` alone would pass if the
    // null checks were dropped (both sides would be `null` only when BOTH are unknown).
    expect(multistepParamMismatch(door.preferInstead as string, "NOPE.B|y")).toBeTruthy();
    expect(multistepParamMismatch("NOPE.A|x", door.entrypoint)).toBeTruthy();
  });
});
