/**
 * Cross-package version-pin consistency.
 *
 * Reads each package's package.json + peer-deps and asserts the pins are
 * consistent. Comparison-based (not hardcoded version strings) so this test
 * survives future version bumps cleanly.
 *
 * Phase-4 reorg: the old atomic-triplet invariant (one shared version across
 * kadena-stoic-legacy + stoa-core + ouronet-core) is GONE. The chain-level
 * packages ship from stoa-js on their own line, and the two packages here carry
 * INDEPENDENT versions — ouronet-core on 4.x, ouronet-codex on 0.x. What still
 * must hold is that our pins onto the chain layer are exact and agree with each
 * other, so a consumer never resolves two different stoa-core copies.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("cross-package version-pin consistency", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..");

  const core = JSON.parse(readFileSync(resolve(repoRoot, "packages/ouronet-core/package.json"), "utf8"));
  const codex = JSON.parse(readFileSync(resolve(repoRoot, "packages/ouronet-codex/package.json"), "utf8"));
  const root = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));

  it("ouronet-core pins @stoachain/stoa-core and kadena-stoic-legacy EXACTLY", () => {
    for (const dep of ["@stoachain/stoa-core", "@stoachain/kadena-stoic-legacy"]) {
      const pin = core.peerDependencies?.[dep];
      expect(pin, `ouronet-core must peer-depend on ${dep}`).toBeDefined();
      expect(pin, `${dep} must be an exact pin`).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("ouronet-core's two @stoachain peer-deps are at the SAME version (they release atomically)", () => {
    expect(core.peerDependencies["@stoachain/stoa-core"]).toBe(
      core.peerDependencies["@stoachain/kadena-stoic-legacy"],
    );
  });

  it("the root devDependencies install exactly the versions ouronet-core peer-depends on", () => {
    for (const dep of ["@stoachain/stoa-core", "@stoachain/kadena-stoic-legacy"]) {
      expect(root.devDependencies?.[dep], `root must dev-install ${dep}`).toBe(
        core.peerDependencies[dep],
      );
    }
  });

  it("ouronet-codex's @ouronet/ouronet-core peer range admits the version in this workspace", () => {
    const range = codex.peerDependencies?.["@ouronet/ouronet-core"];
    expect(range).toBeDefined();
    // Ranges (>=X.Y.Z) are correct here: codex ships on its own line and must
    // tolerate a core that moves independently. Assert the range's floor does
    // not exceed the core version we actually build against.
    const floor = /(\d+)\.(\d+)\.(\d+)/.exec(range as string);
    expect(floor, `unparseable range ${range}`).not.toBeNull();
    const [, fMaj, fMin, fPat] = floor!.map(Number) as unknown as number[];
    const [cMaj, cMin, cPat] = (core.version as string).split(".").map(Number);
    const floorNum = fMaj * 1e6 + fMin * 1e3 + fPat;
    const coreNum = cMaj * 1e6 + cMin * 1e3 + cPat;
    expect(coreNum, `core ${core.version} is below codex's floor ${range}`).toBeGreaterThanOrEqual(floorNum);
  });

  it("the two packages carry independent version lines (codex 0.x, core 4.x)", () => {
    expect(core.version).toMatch(/^4\./);
    expect(codex.version).toMatch(/^0\./);
  });
});
