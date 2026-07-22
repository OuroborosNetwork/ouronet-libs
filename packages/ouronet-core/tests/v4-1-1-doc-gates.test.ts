/**
 * REQ-30 (T7.12 catch-up): cross-package doc-gates.
 * Asserts README.md Status block + CHANGELOG.md presence per package.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

const packages = ["ouronet-core", "ouronet-codex"];

describe("REQ-30: doc-gates — README + CHANGELOG", () => {
  for (const pkg of packages) {
    describe(`packages/${pkg}`, () => {
      it("README.md exists", () => {
        expect(existsSync(resolve(repoRoot, `packages/${pkg}/README.md`))).toBe(true);
      });

      it("README.md has a Status section", () => {
        const readme = readFileSync(resolve(repoRoot, `packages/${pkg}/README.md`), "utf8");
        expect(readme).toMatch(/##\s+Status|^Status:|##\s*\[?Current/im);
      });

      it("README.md cites a version (semver pattern)", () => {
        const readme = readFileSync(resolve(repoRoot, `packages/${pkg}/README.md`), "utf8");
        expect(readme).toMatch(/v?\d+\.\d+\.\d+/);
      });

      it("CHANGELOG.md exists", () => {
        expect(existsSync(resolve(repoRoot, `packages/${pkg}/CHANGELOG.md`))).toBe(true);
      });

      it("CHANGELOG.md has at least one ## version entry", () => {
        const changelog = readFileSync(resolve(repoRoot, `packages/${pkg}/CHANGELOG.md`), "utf8");
        expect(changelog).toMatch(/##\s+\[?\d+\.\d+\.\d+/);
      });
    });
  }
});
