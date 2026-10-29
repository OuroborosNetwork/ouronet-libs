/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE MULTI-STEP VARIANT OF A SPEC — DERIVED, not written a second time
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `swp-pairs-proto`'s multistep toggle needs five specs aimed at `TS01-CP` doors. Writing them
 * by hand would mean five more field lists to keep in step with five that already exist — and
 * this migration has found four duplicated surfaces so far, none of which any check could see.
 *
 * **MEASURED: EVERY DEFPACT DOOR'S PARAMETER LIST IS IDENTICAL TO ITS SINGLE-SHOT TWIN'S.** All
 * ten, name for name and type for type, checked against `@ouronet/talos-registry@2.10.0`. The
 * registry says so itself about the `MTX-AQP` pair — *"performs the same operation in ONE
 * transaction with a BYTE-IDENTICAL parameter list"* — and it holds for the eight SWP doors too.
 *
 * So the multi-step variant of a spec is the spec with ONE FIELD CHANGED. That is a derivation,
 * and a derivation cannot drift from its source.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * THE IDENTITY IS VERIFIED PER CALL, NOT ASSUMED ONCE
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * "Identical today" is a measurement of a published snapshot, not a contract. A door that gained
 * a parameter would make every derived spec send a call one argument short — and because the
 * engine builds its `values` from `spec.fields`, the registry's own formatter would refuse the
 * call rather than mis-send it. A refusal at execute time is still the wrong place to learn it.
 *
 * So the derivation CHECKS the two parameter lists and returns `null` on any disagreement, which
 * a surface renders as "no multi-step form" rather than as a broken button. Disagreements are
 * also collected for `multistep-spec.test.ts` to assert empty, so the next registry change that
 * breaks the identity fails a test instead of a transaction.
 */
import { tryGetEntrypoint } from "@ouronet/talos-registry";
import { defpactDoorFor, type DefpactInfo } from "./defpactTwin.js";

/** The minimum a spec must expose to be re-pointed. Structural, so `OpSpec` need not be imported. */
export interface RepointableSpec {
  entrypoint: string;
  title: string;
  txLabel: string;
}

export interface MultistepDerivation<T extends RepointableSpec> {
  spec: T;
  defpact: DefpactInfo;
}

function paramSig(key: string): string | null {
  const e = tryGetEntrypoint(key);
  if (!e) return null;
  return ((e as { params?: Array<{ name: string; type: string }> }).params ?? [])
    .map(p => `${p.name}:${p.type}`).join(", ");
}

/**
 * WHY TWO ENTRYPOINTS CANNOT SHARE A SPEC, or `null` when they can.
 *
 * SPLIT OUT OF `multistepSpecOf` SO IT CAN BE EXERCISED. Inside that function the refusal branch
 * is unreachable against the real registry — the door is found by inverting `preferInstead`, so
 * the single-shot key is known by construction, and the suite separately asserts that no declared
 * pair disagrees today. An unexercised refusal is indistinguishable from a missing one, and this
 * repository has been caught by exactly that shape before (a guard whose only test could pass
 * with the guard deleted).
 *
 * As a function of two KEYS it is reachable with keys the registry does not know, which is the
 * same branch a widened door would take — so the message a future mismatch produces is the
 * message this is tested on.
 */
export function multistepParamMismatch(singleShot: string, door: string): string | null {
  const a = paramSig(singleShot);
  const b = paramSig(door);
  if (a !== null && b !== null && a === b) return null;
  return `parameter lists differ — single-shot (${a}) vs door (${b}). The derived spec `
    + `would send a call the door does not declare.`;
}

/** Why a spec has no derivable multi-step form, when the registry declares a door for it. */
export interface MultistepProblem {
  singleShot: string;
  door: string;
  detail: string;
}

/**
 * The multi-step form of `spec`, or `null` when the registry declares none — or declares one
 * whose parameters no longer match.
 *
 * TITLE AND LABEL ARE CHANGED, and that is not decoration. A toast reading "Add Liquidity
 * submitted" for a three-step run that has completed one step is the exact report that let two
 * additions be lost; the label has to say which form is running.
 */
export function multistepSpecOf<T extends RepointableSpec>(
  spec: T, problems?: MultistepProblem[],
): MultistepDerivation<T> | null {
  const door = defpactDoorFor(spec.entrypoint);
  if (!door) return null;

  const mismatch = multistepParamMismatch(spec.entrypoint, door.entrypoint);
  if (mismatch !== null) {
    problems?.push({ singleShot: spec.entrypoint, door: door.entrypoint, detail: mismatch });
    return null;
  }

  return {
    defpact: door,
    spec: {
      ...spec,
      entrypoint: door.entrypoint,
      title: `${spec.title} — ${door.steps} steps`,
      txLabel: `${spec.txLabel} (multi-step)`,
    },
  };
}

/** Every derivation the registry supports, for a set of single-shot specs. For tests. */
export function multistepProblemsFor(specs: RepointableSpec[]): MultistepProblem[] {
  const problems: MultistepProblem[] = [];
  for (const s of specs) multistepSpecOf(s, problems);
  return problems;
}
