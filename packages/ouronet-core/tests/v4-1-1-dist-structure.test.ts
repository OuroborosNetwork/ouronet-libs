/**
 * REQ-28 (T7.3): ouronet-core dist/ structure validity.
 * Validates post-build artifacts exist and exports map resolves to real files.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-28: ouronet-core dist/ structure", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgRoot = resolve(here, "..");

  const distExists = existsSync(resolve(pkgRoot, "dist"));

  it("dist/ directory exists post-build", () => {
    expect(distExists).toBe(true);
  });

  it.skipIf(!distExists)("package.json `main` path resolves to a real file in dist/", () => {
    const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
    if (pkg.main) {
      expect(existsSync(resolve(pkgRoot, pkg.main))).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  it.skipIf(!distExists)("package.json `module` path resolves (if declared)", () => {
    const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
    if (pkg.module) {
      expect(existsSync(resolve(pkgRoot, pkg.module))).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  it.skipIf(!distExists)("package.json `types` path resolves (if declared)", () => {
    const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
    if (pkg.types) {
      expect(existsSync(resolve(pkgRoot, pkg.types))).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });

  it.skipIf(!distExists)("package.json `exports` map paths all resolve", () => {
    const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));
    if (!pkg.exports) {
      expect(true).toBe(true);
      return;
    }
    const checked: string[] = [];
    function checkExportEntry(entry: any, key: string) {
      if (typeof entry === "string") {
        // Skip wildcards — they're glob patterns
        if (entry.includes("*")) return;
        const fullPath = resolve(pkgRoot, entry);
        const exists = existsSync(fullPath);
        if (!exists) checked.push(`${key} -> ${entry} (MISSING)`);
        else checked.push(`${key} -> ${entry} (OK)`);
      } else if (typeof entry === "object" && entry !== null) {
        for (const [cond, val] of Object.entries(entry)) {
          checkExportEntry(val, `${key}.${cond}`);
        }
      }
    }
    for (const [key, value] of Object.entries(pkg.exports)) {
      checkExportEntry(value, key);
    }
    const missing = checked.filter(c => c.includes("MISSING"));
    expect(missing, `Missing export paths:\n${missing.join("\n")}`).toEqual([]);
  });
});
