import { describe, it, expect } from "vitest";
import { concurrencyOf, type Concurrency } from "../src/concurrency.js";
import { partitionOf } from "../src/partition.js";
import { registry } from "@ouronet/talos-registry";

/**
 * THE THREE VERDICTS THE PAPYRUS NOW SHOWS — owner ruling 2026-10-28.
 *
 * *"if its paralelizable would show paralle, if it's sequential it should show sequential free
 * (no defpacts) or sequential constraint (defpacts)."*
 *
 * DRIVEN OFF THE REAL REGISTRY, not fixtures. A classifier of registry data tested only against
 * hand-written `PartitionMeta` objects proves it handles the shapes I imagined — which is the
 * mistake that made the migration matrix wrong four times. Every entrypoint that carries a
 * partition is classified here, and the counts are asserted, so a registry release that adds a
 * shape this function does not know about fails rather than falling through silently.
 */

type Entry = { execution?: { partition?: { kind?: string; shape?: string } } };
const ENTRYPOINTS = (registry as unknown as { entrypoints: Record<string, Entry> }).entrypoints;

const withPartition = Object.entries(ENTRYPOINTS)
  .filter(([, e]) => !!e.execution?.partition);

describe("the registry's partitions, classified", () => {
  it("the population is what was measured — so a release that changes it is visible", () => {
    // 2.9.0: 442 entrypoints, 36 carrying a partition. If these move, the mapping below has to
    // be re-read against the new data rather than assumed to still hold.
    expect(Object.keys(ENTRYPOINTS).length).toBe(442);
    expect(withPartition.length).toBe(36);
  });

  it("classifies every partitioned entrypoint, with no fall-through to the default", () => {
    /**
     * THE FALL-THROUGH IS THE POINT OF THIS TEST. `concurrencyOf` deliberately answers
     * `sequential-free` for anything it does not recognise, which is the safe reading — but it
     * means an unrecognised shape is INDISTINGUISHABLE from a real `cursor` in the output. So
     * recognition is asserted structurally here: every entry must match one of the four known
     * (kind, shape) pairs.
     */
    const KNOWN = new Set([
      "list/partition", "list/reduction", "cursor/undefined", "architectural/undefined",
    ]);
    const unknown = withPartition
      .map(([k, e]) => [k, `${e.execution!.partition!.kind}/${e.execution!.partition!.shape}`])
      .filter(([, sig]) => !KNOWN.has(sig as string));
    expect(unknown, "an unrecognised partition shape reads as `sequential-free` by default — "
      + "which is SAFE but silent. Read the new shape and give it an explicit branch.")
      .toEqual([]);
  });

  it("maps the four shapes onto the three verdicts, by count", () => {
    const tally = new Map<Concurrency, number>();
    for (const [key] of withPartition) {
      const v = concurrencyOf(partitionOf(key));
      tally.set(v.kind, (tally.get(v.kind) ?? 0) + 1);
    }
    // 22 list/partition → parallel; 4 reduction + 2 cursor → sequential-free; 8 defpacts.
    expect(Object.fromEntries(tally)).toEqual({
      "parallel": 22,
      "sequential-free": 6,
      "sequential-constrained": 8,
    });
  });

  it("the eight constrained ones are exactly the defpact-routed SWP operations", () => {
    const constrained = withPartition
      .map(([k]) => [k, concurrencyOf(partitionOf(k)).kind] as const)
      .filter(([, k]) => k === "sequential-constrained")
      .map(([k]) => k)
      .sort();
    // NAMES TAKEN FROM THE REGISTRY, not from the defpact twins. The first draft of this list
    // was written from the `TS01-CP.*` side and three of eight were wrong — `C_AddLiquidity`
    // is not `C_AddStandardLiquidity`, `C_IssueStable` is not `C_IssueStablePool`. The
    // `architectural` partition is declared on the SINGLE-SHOT entrypoint, and its `via` names
    // the pact twin; the two families are spelled differently and only one is indexed here.
    expect(constrained).toEqual([
      "TS01-C3.SWP|C_AddFrozenLiquidity",
      "TS01-C3.SWP|C_AddGlacialLiquidity",
      "TS01-C3.SWP|C_AddIcedLiquidity",
      "TS01-C3.SWP|C_AddLiquidity",
      "TS01-C3.SWP|C_AddSleepingLiquidity",
      "TS01-C3.SWP|C_IssueStable",
      "TS01-C3.SWP|C_IssueStandard",
      "TS01-C3.SWP|C_IssueWeighted",
    ]);
  });
});

describe("the classification refuses to guess PARALLEL", () => {
  /**
   * THE ASYMMETRY. Calling a parallel op sequential costs wall-clock time; calling a SEQUENTIAL
   * op parallel invites firing N transactions at once against an operation whose batch N+1
   * depends on batch N — and for a `reduction` that means sending calls whose arguments are
   * nonce ids that do not exist yet. So `parallel` requires positive evidence.
   */
  const notParallel = (p: unknown, why: string) =>
    expect(concurrencyOf(p as never).kind, why).not.toBe("parallel");

  it("needs BOTH kind:list and shape:partition", () => {
    notParallel({ kind: "list", reason: "x" }, "a list with no declared shape");
    notParallel({ kind: "list", shape: "reduction", reason: "x" }, "a reduction");
    notParallel({ kind: "cursor", reason: "x" }, "a pager");
    notParallel({ kind: "architectural", steps: 3, reason: "x" }, "a defpact");
    notParallel({ kind: "something-new", shape: "partition", reason: "x" }, "an unknown kind");
    // And the one positive case, so the test is not vacuously satisfied by always-false.
    expect(concurrencyOf({ kind: "list", shape: "partition", axis: "xs", reason: "x" } as never)
      .kind).toBe("parallel");
  });

  it("no partition at all is SINGLE, not a split of unknown shape", () => {
    // Most of the 442 entrypoints are here, and it is a complete answer rather than a gap.
    for (const p of [null, undefined])
      expect(concurrencyOf(p).kind).toBe("single");
  });
});

describe("each verdict says the defpact word, or does not", () => {
  it("only the constrained verdict mentions a defpact", () => {
    // The owner's distinction is precisely "no defpacts" vs "defpacts", so the WORD carries the
    // meaning and must appear on exactly one side of it.
    const v = (p: unknown) => concurrencyOf(p as never);
    expect(v({ kind: "architectural", steps: 3, via: "TS01-CP.X|Y", reason: "" }).why)
      .toMatch(/defpact/);
    for (const p of [{ kind: "cursor", reason: "" },
                     { kind: "list", shape: "reduction", reason: "" },
                     { kind: "list", shape: "partition", reason: "" }])
      expect(v(p).why, JSON.stringify(p)).toMatch(/No defpact is involved\.|independent slice/);
  });

  it("the labels are the owner's three words", () => {
    const label = (p: unknown) => concurrencyOf(p as never).label;
    expect(label({ kind: "list", shape: "partition", reason: "" })).toBe("parallel");
    expect(label({ kind: "cursor", reason: "" })).toBe("sequential · free");
    expect(label({ kind: "architectural", steps: 2, reason: "" })).toBe("sequential · constrained");
  });
});

/**
 * THE HOST-RENDER BLOCK STAYED IN OURONETUI, and deliberately.
 *
 * The original of this file carried a fourth `describe` asserting that `RegistryOpCFMModal`
 * actually renders this verdict — because a facility that is built, unit-tested and never
 * rendered is a shape this migration already produced once (the `blocked` prop existed for a
 * day before anything passed it).
 *
 * That assertion is about a FILE IN THE CONSUMER, so it cannot move here: this package has no
 * `src/components/`, and a test reading `process.cwd()` would silently pass over a missing file
 * or fail for a reason that has nothing to do with the classifier. It lives on in
 * `OuronetUI/src/__tests__/concurrency-of.test.ts`, which now contains only that block.
 *
 * So the split is by WHO OWNS THE FACT, not by convenience: the classifier's behaviour is the
 * package's, and whether a surface shows it is the surface's.
 */
