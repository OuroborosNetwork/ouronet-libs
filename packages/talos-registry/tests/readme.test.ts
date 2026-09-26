import { describe, expect, it } from "vitest";
import {
  buildCall, capabilityRecipe, entrypointKeys, getEntrypoint, registry, resolveByName,
} from "../src/index.js";
import { readFileSync } from "node:fs";

/**
 * The README makes claims with NUMBERS in them, and shows code. Both rot silently.
 *
 * A doc that has drifted from the package is worse than no doc: it is the thing a consumer
 * trusts instead of reading the types.
 */
const RAW = readFileSync(new URL("../README.md", import.meta.url), "utf8");
// Whitespace-normalised: a figure must be QUOTED correctly, but prose is free to wrap wherever
// it reads best. Asserting against the raw text makes the suite fail on a reflow, which trains
// people to reflow the test instead of checking the number.
const README = RAW.replace(/\s+/g, " ");

describe("the README's code actually runs", () => {
  it("the DPTF|C_Transfer example builds, and 1 becomes 1.0", () => {
    const code = buildCall("TS01-C1.DPTF|C_Transfer", {
      patron: "P", executor: "E", executee: "X",
      id: "OURO-8Nh-JO8JO4F5", "transfer-amount": 1, method: false,
    });
    expect(code).toBe(
      `(ouronet-ns.TS01-C1.DPTF|C_Transfer "P" "E" "X" "OURO-8Nh-JO8JO4F5" 1.0 false)`,
    );
  });

  it("the launchpad example's parameter names are the real ones", () => {
    const recipe = capabilityRecipe("TS02-CPAD.SPARK|C_BuySparks")!;
    expect(recipe.reader).toBe("DEMIPAD-SPARK.URC_Acquire");
    // the reader call shown in the README
    expect(recipe.readerParams.map(p => p.name).sort())
      .toEqual(["amount", "buyer", "iz-native", "slippage"]);
    // the entrypoint call shown in the README
    expect(getEntrypoint("TS02-CPAD.SPARK|C_BuySparks").params.map(p => p.name))
      .toEqual(["patron", "buyer", "sparks-amount", "iz-native", "max-cost"]);
  });

  it("resolveByName really does refuse the four ambiguous names", () => {
    for (const fn of ["SWP|C_AddFrozenLiquidity", "SWP|C_AddGlacialLiquidity",
                      "SWP|C_AddIcedLiquidity", "SWP|C_AddSleepingLiquidity"]) {
      expect(() => resolveByName(fn)).toThrow(/ambiguous/);
    }
    expect(Object.keys(registry.nameCollisions).sort()).toEqual([
      "SWP|C_AddFrozenLiquidity", "SWP|C_AddGlacialLiquidity",
      "SWP|C_AddIcedLiquidity", "SWP|C_AddSleepingLiquidity",
    ]);
  });
});

describe("the README's figures match the snapshot", () => {
  const counts = entrypointKeys().reduce<Record<string, number>>((a, k) => {
    const m = getEntrypoint(k).execution.mode;
    a[m] = (a[m] ?? 0) + 1;
    return a;
  }, {});

  it.each([
    ["direct", counts["direct"]],
    ["defpact", counts["defpact"]],
    ["indirect-parallel", counts["indirect-parallel"]],
    ["indirect-single", counts["indirect-single"]],
    ["indirect-sequential", counts["indirect-sequential"]],
  ])("%s count is quoted correctly", (mode, n) => {
    // the table row: | `mode` | n | ...
    const row = new RegExp("\\|\\s*`" + mode + "`\\s*\\|\\s*(\\d+)\\s*\\|");
    const m = README.match(row);
    expect(m, `no README table row for ${mode}`).toBeTruthy();
    expect(Number(m![1])).toBe(n);
  });

  it("quotes the entrypoint and preview totals", () => {
    expect(README).toContain(`all ${entrypointKeys().length} entrypoints`);
    expect(README).toContain(`${Object.keys(registry.previews).length} previews`);
  });

  it("quotes the surface hash this build was compiled against", () => {
    expect(README).toContain(registry.surfaceHash);
  });

  it("quotes the ghost slot totals", () => {
    const slots = entrypointKeys().reduce((n, k) => n + getEntrypoint(k).params.length, 0);
    const names = new Set(entrypointKeys().flatMap(k => getEntrypoint(k).params.map(p => p.name)));
    expect(README).toContain(`${slots.toLocaleString("en-US")} slots`);
    expect(README).toContain(`${names.size} distinct names`);
  });
});
