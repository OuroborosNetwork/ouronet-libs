/**
 * REQ-05 (T7.10 catch-up): Package-metadata coverage. Locks the published-surface
 * invariants that the v4.1.0 hotfixes proved load-bearing (workflow detection,
 * version parity, repository URL, license).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-05: @ouronet/ouronet-core package metadata invariants", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgJsonPath = resolve(here, "..", "package.json");
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));

  it("name matches expected scoped name", () => {
    expect(pkg.name).toBe("@ouronet/ouronet-core");
  });

  it("version is valid semver shape", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("repository.url is a github.com OuroborosNetwork URL", () => {
    const url = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
    expect(url).toBeDefined();
    expect(url).toMatch(/github\.com[/:]OuroborosNetwork\//);
  });

  it("publishConfig.access is 'public'", () => {
    expect(pkg.publishConfig).toBeDefined();
    expect(pkg.publishConfig.access).toBe("public");
  });

  it("engines.node specifies major version >= 20", () => {
    expect(pkg.engines).toBeDefined();
    expect(pkg.engines.node).toBeDefined();
    const major = parseInt(String(pkg.engines.node).replace(/^[>=~^]+\s*/, "").split(".")[0], 10);
    expect(major).toBeGreaterThanOrEqual(20);
  });

  it("sideEffects is declared as false", () => {
    expect(pkg.sideEffects).toBe(false);
  });

  it("license is a non-empty string", () => {
    expect(typeof pkg.license).toBe("string");
    expect(pkg.license.length).toBeGreaterThan(0);
  });
});
