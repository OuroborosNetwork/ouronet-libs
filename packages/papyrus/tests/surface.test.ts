/**
 * THE CURATED RE-EXPORT MUST NOT SILENTLY DROP A SYMBOL.
 *
 * `index.ts` lists what the package exposes BY HAND, with commentary grouping the names by what
 * they are for. That curation is worth keeping — it is the only place a reader learns the shape
 * of the surface — but a hand-kept list of an evolving module is a list that falls behind, and
 * the failure is silent in the worst way: `exports` in `package.json` admits `.` only, so a
 * symbol missing from `index.ts` is not merely undocumented, it is UNREACHABLE. No consumer can
 * import it by any path.
 *
 * That already happened. v0.1.0 shipped `planBatchesVerified` inside `dist/batch.js` and left it
 * off the index, while exporting `ProbeOutcome` and `VerifiedBatchPlan` — the two types that
 * exist ONLY to describe that function's argument and result. So the surface advertised a
 * signature whose function could not be called, and the first consumer to wire the package found
 * out by failing to import the planner its three batched flows are built on.
 *
 * This test is the thing that makes the hand-kept list safe: the index may REORDER and ANNOTATE
 * freely, and may not OMIT. Values are checked by importing both modules and comparing runtime
 * keys — no string matching, nothing to fool. Types have no runtime presence, so they are
 * compared as name sets parsed from the sources with comments stripped first, because a name
 * mentioned in prose is not a name exported.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

import * as index from "../src/index.js";
import * as kind from "../src/kind.js";
import * as batch from "../src/batch.js";
// v0.2.0's modules. ADDED TO THE LISTS BELOW TOO — a module imported here but left out of
// `MODULES` would be checked by nothing, which is the same silence this suite exists to end.
import * as partition from "../src/partition.js";
import * as concurrency from "../src/concurrency.js";
import * as defpactPayer from "../src/defpactPayer.js";
import * as defpactTwin from "../src/defpactTwin.js";
import * as multistepSpec from "../src/multistepSpec.js";

/**
 * THE ONE LIST, so adding a module cannot half-happen. Before v0.2.0 the module set was spelled
 * THREE times — the imports, the runtime loop and the type loop — and five new modules would have
 * meant three places to remember. `MODULES` is now the single statement of what this package
 * contains, and `every src module is covered` below asserts it against the directory.
 */
const MODULES: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ["kind.ts", kind],
  ["batch.ts", batch],
  ["partition.ts", partition],
  ["concurrency.ts", concurrency],
  ["defpactPayer.ts", defpactPayer],
  ["defpactTwin.ts", defpactTwin],
  ["multistepSpec.ts", multistepSpec],
];

const read = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

/** Block and line comments removed, so prose can neither satisfy nor break an assertion. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** `export type X =` / `export interface X {` — the declarations with no runtime footprint. */
const declaredTypes = (src: string): string[] =>
  [...stripComments(src).matchAll(/^export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/gm)]
    .map(m => m[1]!);

/** Every identifier inside `export { ... } from "..."`, with any `type ` qualifier dropped. */
const reExported = (src: string): string[] =>
  [...stripComments(src).matchAll(/export\s*\{([\s\S]*?)\}\s*from\s*["'][^"']+["']/g)]
    .flatMap(m => m[1]!.split(","))
    .map(s => s.trim().replace(/^type\s+/, ""))
    .filter(Boolean);

describe("every runtime export of every module is reachable from the index", () => {
  for (const [name, mod] of MODULES) {
    it(`${name}`, () => {
      const missing = Object.keys(mod).filter(k => !(k in index));
      expect(missing, `${name} exports unreachable through the package entry point`).toEqual([]);
    });
  }

  it("and the index adds nothing of its own that no module provides", () => {
    const provided = new Set(MODULES.flatMap(([, m]) => Object.keys(m)));
    expect(Object.keys(index).filter(k => !provided.has(k))).toEqual([]);
  });

  it("EVERY module in src/ is covered by this suite", () => {
    /**
     * The guard on the guard. `MODULES` is hand-kept, so a new file could be added to `src/`,
     * exported from the index, and checked by nothing — the index would be correct and this
     * suite would be silently narrower than the package. Compared against the DIRECTORY, which
     * is the one source neither list can fall behind.
     */
    const onDisk = readdirSync(new URL("../src/", import.meta.url))
      .filter(f => f.endsWith(".ts") && f !== "index.ts")
      .sort();
    expect(MODULES.map(([n]) => n).sort(), "tests/surface.test.ts does not cover every src module")
      .toEqual(onDisk);
  });
});

describe("every exported TYPE is listed in the index too", () => {
  const listed = new Set(reExported(read("index.ts")));

  for (const [file] of MODULES) {
    it(`${file}`, () => {
      const types = declaredTypes(read(file));
      // A module with no exported types would make this test vacuously green, so say so.
      expect(types.length, `${file} declares no exported types — has it been rewritten?`)
        .toBeGreaterThan(0);
      expect(types.filter(t => !listed.has(t)), `types missing from index.ts`).toEqual([]);
    });
  }

  it("names the planner that v0.1.0 dropped", () => {
    // The specific regression, pinned by name rather than by the general rule above, because
    // this one shipped and a consumer hit it.
    expect(listed.has("planBatchesVerified")).toBe(true);
    expect(typeof index.planBatchesVerified).toBe("function");
  });
});
