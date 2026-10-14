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
  // PINNED TO WHAT NPM'S TRUSTED PUBLISHER SAYS, which is `publish.yml`.
  //
  // This pin has now been wrong in BOTH directions, and the reason is worth
  // keeping. The connection first read `publish.yaml`, so this file was renamed
  // to match; the connection was then deleted and recreated as `publish.yml`,
  // so the rename became the mismatch. Two parties each adjusting to the other's
  // last known state is not a race condition in software, it is one in process.
  //
  // The claim npm matches is the full workflow ref:
  //   OuroborosNetwork/ouronet-libs/.github/workflows/publish.yml@refs/tags/vX.Y.Z
  // A mismatch is refused with "OIDC token exchange error - package not found",
  // which names neither the file nor the mismatch.
  //
  // CHANGE THIS ONLY TOGETHER WITH THE CONNECTION, never on its own.
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
   * INVERTED 2026-10-14 when the workflow moved to OIDC Trusted Publishing, then
   * LOOSENED the same day -- and the loosening is the interesting half.
   *
   * It first asserted the NPM_PUBLISHER secret WAS referenced. Under trusted
   * publishing a long-lived token is the thing being eliminated, so it became
   * "no npm token is reachable at all". That held until npm's own bootstrap loop
   * turned up: a trusted-publisher connection sits in "Pending validation" until
   * a publish validates it, and the OIDC exchange refuses to authorise a publish
   * while it is unvalidated --
   *
   *   POST /-/npm/v1/oidc/token/exchange/package/@ouronet%2ftalos-registry -> 404
   *   "OIDC token exchange error - package not found"
   *
   * -- so exactly one token-authenticated publish is needed to break it.
   *
   * A flat ban would have been a test that is right in principle and blocks the
   * only route to the state it describes. What is worth pinning is not the
   * ABSENCE of a token but its SUBORDINATION: OIDC must be attempted first, and a
   * token may only run after that attempt has failed. That property survives the
   * bootstrap, and it is the one that would actually be violated by someone
   * quietly putting the token back in front because it is easier.
   *
   * Delete the secret once the connection validates; this test stays either way.
   */
  it("Case 4: OIDC is attempted before any token-authenticated publish", () => {
    for (const s of allSteps()) {
      if (typeof s.name !== "string" || !/^Publish @ouronet\//i.test(s.name)) continue;
      const script = String(s.run ?? "");
      const publishes = [...script.matchAll(/npm publish[^\n]*/g)].map(m => m[0]);
      if (publishes.length === 0) continue;
      // The FIRST publish in a step must be the unauthenticated (OIDC) one.
      expect(publishes[0], `${s.name}: the first publish must not carry a token`)
        .not.toMatch(/--userconfig|_authToken/);
      // Any token-bearing publish must come after it, never instead of it.
      const tokenIdx = publishes.findIndex(p => /--userconfig/.test(p));
      if (tokenIdx !== -1) {
        expect(tokenIdx, `${s.name}: a token publish must not precede the OIDC attempt`)
          .toBeGreaterThan(0);
      }
    }
  });

  /**
   * The token, where one exists at all, must never reach a file the repository
   * keeps. The bootstrap fallback writes its .npmrc under RUNNER_TEMP and removes
   * it; an earlier version of this workflow wrote `.npmrc` into the checkout root,
   * which is one `npm pack` away from shipping a credential inside a tarball.
   */
  it("Case 4c: no step writes an .npmrc into the working tree", () => {
    const whole = readFileSync(workflowPath, "utf8");
    expect(whole).not.toMatch(/cat\s*>\s*\.npmrc/);
    expect(whole).not.toMatch(/>\s*\$\{\{?\s*github\.workspace/);
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
  /**
   * `--provenance` REQUIRES A MATCHING `repository.url`, and the registry only
   * says so at the very end -- after the tarball is built and uploaded:
   *
   *   422 Unprocessable Entity - PUT .../@ouronet%2ftalos-registry
   *   Error verifying sigstore provenance bundle: Failed to validate repository
   *   information: package.json: "repository.url" is "", expected to match
   *   "https://github.com/OuroborosNetwork/ouronet-libs" from provenance
   *
   * talos-registry had no `repository` field at all, and nothing noticed for
   * five releases because every one of them was published BY HAND -- a manual
   * publish without `--provenance` never runs this check. The moment it joined
   * the workflow, which publishes with provenance like its siblings, it failed.
   *
   * Checked here rather than in each package because the property is a relation
   * between the workflow's flags and every package it publishes: add a fourth
   * package without a repository field and this fails before CI does.
   */
  it("Case 5b: every package published with --provenance declares its repository", () => {
    const EXPECTED = "https://github.com/OuroborosNetwork/ouronet-libs";
    for (const s of allSteps()) {
      if (typeof s.name !== "string") continue;
      const m = s.name.match(/^Publish @ouronet\/(.+)$/i);
      if (!m || !/--provenance/.test(String(s.run ?? ""))) continue;
      const dir = m[1] === "talos-registry" ? "talos-registry" : m[1];
      const pkg = JSON.parse(
        readFileSync(resolve(repoRoot, "packages", dir, "package.json"), "utf8"));
      const url = pkg.repository?.url ?? "";
      expect(url, `${s.name} publishes with --provenance but declares no repository.url`)
        .not.toBe("");
      expect(url.replace(/^git\+/, "").replace(/\.git$/, ""),
        `${s.name}: repository.url must match the provenance origin`).toBe(EXPECTED);
    }
  });

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
