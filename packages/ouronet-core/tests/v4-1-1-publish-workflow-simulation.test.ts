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

  /**
   * INVERTED 2026-10-14, when the workflow moved to OIDC Trusted Publishing.
   *
   * This used to assert that `secrets.NPM_PUBLISHER` WAS referenced. Under
   * trusted publishing npmjs.com trusts this repository and workflow FILENAME
   * directly, so a long-lived token is not merely unnecessary, it is the thing
   * being eliminated -- the previous one expired and silently broke publishing.
   * The invariant worth pinning is therefore the opposite one: no publish token
   * is reachable from this workflow at all.
   *
   * `secrets.GITHUB_TOKEN` / `RELEASE_TOKEN` are deliberately NOT matched here:
   * they create the GitHub Release, and have no npm publishing power.
   */
  it("Case 4: no long-lived npm publish token is referenced (trusted publishing)", () => {
    const wholeFile = readFileSync(workflowPath, "utf8");
    const tokenRefs = wholeFile.match(/secrets\.(NPM_\w+|\w*NPM_TOKEN\w*)/g) ?? [];
    expect(tokenRefs, `workflow still reaches for an npm token: ${tokenRefs.join(", ")}`)
      .toEqual([]);
  });

  /**
   * The two things that make OIDC actually work, both easy to drop by accident.
   * `id-token: write` is what lets the runner mint the OIDC token at all, and
   * npm must be >= 11.5.1 to exchange it -- `setup-node` still ships 10.x with
   * Node 22, so without an explicit upgrade npm falls back to looking for a
   * token and fails with a 404 that reads like a missing package.
   */
  it("Case 4b: OIDC is actually usable — id-token permission and an npm upgrade", () => {
    const wholeFile = readFileSync(workflowPath, "utf8");
    expect(wholeFile).toMatch(/id-token:\s*write/);
    const upgrade = allSteps().find(
      (s) => typeof s.run === "string" && /npm\s+install\s+-g\s+npm@/.test(s.run),
    );
    expect(upgrade, "no `npm install -g npm@...` step — OIDC needs npm >= 11.5.1").toBeDefined();
  });

  // 2 -> 3 on 2026-10-14: talos-registry joined the workflow. It had been in the
  // repo for a while and was published BY HAND, which is how 2.2.1 came to exist
  // locally and never reach npm. The old regex named the two packages it knew, so
  // it kept passing at 2 while silently not covering the third.
  it("Case 5: each of the 3 packages has its own publish step", () => {
    const publishSteps = allSteps().filter(
      (s) =>
        typeof s.name === "string" &&
        /^Publish @ouronet\/(ouronet-core|ouronet-codex|talos-registry)$/i.test(s.name),
    );
    expect(publishSteps.length).toBe(3);
  });

  /**
   * REPLACED 2026-10-14. This used to assert the hand-written `.npmrc` carried a
   * registry line for each scope. That file is gone with the token, and the lines
   * were never load-bearing anyway -- both scopes live on the default public
   * registry, which is what npm resolves to with no config at all.
   *
   * What IS worth pinning is how each package goes out: `--access public` (a
   * scoped package defaults to RESTRICTED, and a restricted publish is a silent
   * paywall on a package meant for external consumers) and `--provenance` (the
   * signed attestation linking the tarball back to this workflow run).
   */
  it("Case 6: every publish is public and carries provenance", () => {
    const publishSteps = allSteps().filter(
      (s) => typeof s.name === "string" && /^Publish @ouronet\//i.test(s.name),
    );
    expect(publishSteps.length).toBeGreaterThan(0);
    for (const s of publishSteps) {
      expect(s.run, `${s.name} is missing --access public`).toMatch(/--access public/);
      expect(s.run, `${s.name} is missing --provenance`).toMatch(/--provenance/);
    }
  });
});
