/**
 * REQ-30 (T7.12 catch-up): MIGRATION-v4.1.md doc-validity check.
 * Validates the v4.1.x migration guide structure.
 *
 * Cross-phase dependency: the v4.1.1 appendix is produced by Phase 8 T8.11.
 * This test currently has an `it.todo` placeholder for that — Phase 8 flips it
 * to `it(...)` per cross-plan F-002 fix.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-30: MIGRATION-v4.1.md doc validity", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..");
  const migrationPath = resolve(repoRoot, "MIGRATION-v4.1.md");

  it("MIGRATION-v4.1.md exists at repo root", () => {
    expect(existsSync(migrationPath)).toBe(true);
  });

  it("MIGRATION-v4.1.md has v4.1.0 section", () => {
    const doc = readFileSync(migrationPath, "utf8");
    // The original v4.1.0 section is well-established
    expect(doc).toMatch(/v4\.1\.0|4\.1\.0/);
  });

  it("MIGRATION-v4.1.md contains a v4.1.1 appendix section", () => {
    const doc = readFileSync(migrationPath, "utf8");
    expect(doc).toMatch(/##\s+What's new in v?4\.?1\.?1/i);
  });
});
