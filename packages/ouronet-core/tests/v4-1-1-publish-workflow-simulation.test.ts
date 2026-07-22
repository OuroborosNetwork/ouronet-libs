/**
 * REQ-06 (T7.11 catch-up): Publish-workflow simulation.
 *
 * Asserts the invariants that would have caught BOTH v4.1.0 hotfixes
 * proactively:
 *   - hotfix #1 (49d69a3): bip39 peer-dep alignment / no --legacy-peer-deps
 *   - hotfix #2 (0c64fb9): workflow step ordering typecheck → BUILD → test
 *
 * Rescoped in the Phase-4 reorg: this repo publishes the two @ouronet packages,
 * and the chain-level packages ship from stoa-js, which keeps its own copy of
 * these checks. The two packages here carry INDEPENDENT version lines, so one
 * tag normally publishes one package — hence a publish step PER package rather
 * than an all-publish-together assertion.
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

  const allSteps = (): any[] => {
    const steps: any[] = [];
    for (const job of Object.values(workflow.jobs ?? {})) {
      steps.push(...((job as any).steps ?? []));
    }
    return steps;
  };

  it("Case 1: smart-detect logic compares each package's package.json:version with the pushed tag", () => {
    const smartDetectSteps = allSteps().filter(
      (s) =>
        typeof s.run === "string" &&
        s.run.includes("ouronet-core") &&
        s.run.includes("ouronet-codex") &&
        s.run.includes("package.json"),
    );
    expect(smartDetectSteps.length).toBeGreaterThan(0);
  });

  it("Case 2: workflow ordering is typecheck → BUILD → test (build precedes test on fresh checkout)", () => {
    const verifyStep = allSteps().find(
      (s) =>
        typeof s.run === "string" &&
        s.run.includes("typecheck") &&
        s.run.includes("build") &&
        s.run.includes("test"),
    );
    expect(verifyStep).toBeDefined();
    const run = verifyStep!.run as string;
    const buildIdx = run.indexOf("npm run build");
    const testIdx = run.indexOf("npm test");
    expect(buildIdx).toBeGreaterThan(-1);
    expect(testIdx).toBeGreaterThan(-1);
    expect(buildIdx).toBeLessThan(testIdx);
  });

  it("Case 3: --legacy-peer-deps is NOT used in the install step (forces clean peer-dep resolution)", () => {
    const installStep = allSteps().find(
      (s) => typeof s.run === "string" && /npm\s+(ci|install)/.test(s.run),
    );
    expect(installStep).toBeDefined();
    expect(installStep!.run).not.toMatch(/--legacy-peer-deps/);
  });

  it("Case 4: the NPM_PUBLISHER secret is referenced", () => {
    const wholeFile = readFileSync(workflowPath, "utf8");
    expect(wholeFile).toMatch(/secrets\.NPM_PUBLISHER/);
  });

  it("Case 5: each of the 2 packages has its own publish step", () => {
    const publishSteps = allSteps().filter(
      (s) =>
        typeof s.name === "string" &&
        /^Publish @ouronet\/(ouronet-core|ouronet-codex)$/i.test(s.name),
    );
    expect(publishSteps.length).toBe(2);
  });

  it("Case 6: registry lines cover both the scope we publish and the scope we install", () => {
    const wholeFile = readFileSync(workflowPath, "utf8");
    // @ouronet is what this repo publishes; @stoachain is what it installs.
    expect(wholeFile).toMatch(/@ouronet:registry=https:\/\/registry\.npmjs\.org/);
    expect(wholeFile).toMatch(/@stoachain:registry=https:\/\/registry\.npmjs\.org/);
  });
});
