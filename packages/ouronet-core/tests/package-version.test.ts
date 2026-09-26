import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import pkg from "../package.json" with { type: "json" };

/**
 * The version was pinned to a literal here, which meant every release edited a test to say
 * what the release already said. That is not an invariant, it is a second place to forget.
 *
 * What IS an invariant: the package version and the newest CHANGELOG heading must agree. A
 * bump with no entry is an unexplained release; an entry with no bump is a release that never
 * shipped. Either way the two disagreeing is the bug worth catching.
 */
const CHANGELOG = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const newestEntry = CHANGELOG.match(/^## (\d+\.\d+\.\d+)/m)?.[1];

describe("@ouronet/ouronet-core package.json version", () => {
  it("matches the newest CHANGELOG entry", () => {
    expect(newestEntry, "no `## X.Y.Z` heading found in CHANGELOG.md").toBeDefined();
    expect(pkg.version).toBe(newestEntry);
  });

  it("is a valid semver MAJOR.MINOR.PATCH triplet", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("declares the canonical package name", () => {
    expect(pkg.name).toBe("@ouronet/ouronet-core");
  });
});
