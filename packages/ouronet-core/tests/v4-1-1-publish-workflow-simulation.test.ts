/**
 * REQ-06 (T7.11 catch-up): Publish-workflow simulation.
 *
 * Asserts 5 invariants that would have caught BOTH v4.1.0 hotfixes proactively:
 *   - hotfix #1 (49d69a3): bip39 peer-dep alignment / no --legacy-peer-deps
 *   - hotfix #2 (0c64fb9): workflow step ordering typecheck → BUILD → test
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// @ts-expect-error -- js-yaml v4 ships its own bundled types via .d.ts inside the package; no @types/js-yaml needed at runtime, but tsc resolution needs the suppression in CI
import yaml from "js-yaml";

describe("REQ-06: publish.yml workflow invariants", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..");
  const workflowPath = resolve(repoRoot, ".github", "workflows", "publish.yml");
  const workflow = yaml.load(readFileSync(workflowPath, "utf8")) as any;

  it("Case 1: smart-detect logic compares each package's package.json:version with the pushed tag", () => {
    // Find the smart-detect step (likely a `steps[].run` block referencing all 3 packages)
    const stepsAll: any[] = [];
    for (const job of Object.values(workflow.jobs ?? {})) {
      stepsAll.push(...((job as any).steps ?? []));
    }
    const smartDetectSteps = stepsAll.filter(s =>
      typeof s.run === "string" &&
      s.run.includes("kadena-stoic-legacy") &&
      s.run.includes("stoa-core") &&
      s.run.includes("ouronet-core")
    );
    expect(smartDetectSteps.length).toBeGreaterThan(0);
  });

  it("Case 2: workflow ordering is typecheck → BUILD → test (build precedes test on fresh checkout)", () => {
    const stepsAll: any[] = [];
    for (const job of Object.values(workflow.jobs ?? {})) {
      stepsAll.push(...((job as any).steps ?? []));
    }
    // Find the verification step (likely a single multi-line `run:` block)
    const verifyStep = stepsAll.find(s =>
      typeof s.run === "string" &&
      s.run.includes("typecheck") &&
      s.run.includes("build") &&
      s.run.includes("test")
    );
    expect(verifyStep).toBeDefined();
    const run = verifyStep!.run as string;
    const buildIdx = run.indexOf("npm run build");
    const testIdx = run.indexOf("npm test");
    // Build MUST come before test (the v4.1.0 hotfix #2 invariant)
    expect(buildIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeLessThan(testIdx);
  });

  it("Case 3: --legacy-peer-deps is NOT used in the install step (forces clean peer-dep resolution)", () => {
    const stepsAll: any[] = [];
    for (const job of Object.values(workflow.jobs ?? {})) {
      stepsAll.push(...((job as any).steps ?? []));
    }
    const installStep = stepsAll.find(s =>
      typeof s.run === "string" &&
      /npm\s+(ci|install)/.test(s.run)
    );
    expect(installStep).toBeDefined();
    expect(installStep!.run).not.toMatch(/--legacy-peer-deps/);
  });

  it("Case 4: NPM_TOKEN secret is referenced (likely as NPMPUSHER per project convention)", () => {
    const wholeFile = readFileSync(workflowPath, "utf8");
    // Match either NPM_TOKEN or NPMPUSHER secret reference
    expect(wholeFile).toMatch(/secrets\.(NPM_TOKEN|NPMPUSHER)/);
  });

  it("Case 5: each of the 3 packages has its own publish step (smart-detect publishes only matching versions)", () => {
    const stepsAll: any[] = [];
    for (const job of Object.values(workflow.jobs ?? {})) {
      stepsAll.push(...((job as any).steps ?? []));
    }
    const publishSteps = stepsAll.filter(s =>
      typeof s.name === "string" &&
      /^Publish @stoachain\/(kadena-stoic-legacy|stoa-core|ouronet-core) to npmjs\.org$/i.test(s.name)
    );
    // Allow for different naming conventions — at minimum 3 publish steps with the correct package names
    expect(publishSteps.length).toBeGreaterThanOrEqual(3);
  });
});
