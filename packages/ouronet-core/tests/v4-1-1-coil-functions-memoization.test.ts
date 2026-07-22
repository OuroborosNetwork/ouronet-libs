import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-19: coilFunctions per-token regex memoization (closed v3.3.6 f886541)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../..");
  const file = readFileSync(resolve(repoRoot, "packages/ouronet-core/src/interactions/coilFunctions.ts"), "utf8");

  it("coilPatternCache Map declared at module scope", () => {
    expect(file).toMatch(/const coilPatternCache\s*=\s*new Map/);
  });

  it("getCoilPatterns has cache-hit early-return", () => {
    expect(file).toMatch(/coilPatternCache\.has|coilPatternCache\.get/);
  });

  it("function uses targetTokenName as cache key (per-token, not global)", () => {
    expect(file).toMatch(/coilPatternCache\.set\([^,]*targetTokenName/);
  });
});
