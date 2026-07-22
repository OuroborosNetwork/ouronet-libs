/**
 * v4.1.0 regression-lock spec: zero `@kadena/*` imports in ouronet-core.
 *
 * Phase 5 of the v4.1 spec swept every `@kadena/*` import in
 * `packages/ouronet-core/src/` onto the `@stoachain/kadena-stoic-legacy/*`
 * shim layer (T5.1) and dropped `@kadena/*` from peerDependencies (T5.3).
 * This spec walks the source + test trees at runtime and fails the suite if
 * a future change reintroduces a direct `@kadena/*` import — locking the
 * boundary so consumers continue to receive the legacy shim, not the
 * upstream packages.
 *
 * Forbidden statement-level patterns (line-start anchored):
 *   import X from "@kadena/Y"        — named/default/namespace ESM import
 *   import "@kadena/Y"               — bare side-effect import
 *   export ... from "@kadena/Y"      — re-export
 *   vi.mock("@kadena/Y", ...)        — vitest mock targeting upstream module
 *   require("@kadena/Y")             — CJS-style require (legacy guard)
 *
 * Allowed (deliberately not flagged):
 *   - The literal string `@kadena` inside JSDoc, line comments, fixture data,
 *     mnemonic passwords, or commit messages embedded in the source. These
 *     are documentation/data, not module resolution. The line-start anchor on
 *     each pattern keeps them out of the match set.
 *   - Commented-out `// import { … } from "@kadena/…"` lines anywhere in
 *     source. The leading `//` makes them comments, not import statements;
 *     the line-start anchor naturally exempts them (the `^\s*` allows leading
 *     whitespace but not the `//` comment marker between whitespace and
 *     `import`). The original `ouroFunctions.ts:114` reference no longer
 *     exists post-Phase-2 (the file is now a thin re-export shim); the
 *     convention is preserved across the split entity files.
 *
 * Excluded from the walk:
 *   - This file itself (matched by basename) — would otherwise match its own
 *     pattern strings.
 *   - `node_modules/` and `dist/` — vendored or built artifacts, not source.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const OURONET_CORE_ROOT = resolve(here, "..");
const SCAN_DIRS = ["src", "tests"] as const;
const SELF = "v4-1-0-no-kadena-imports.test.ts";

const FORBIDDEN: ReadonlyArray<RegExp> = [
  /^\s*import\s+[^"']*?from\s+["']@kadena\//,
  /^\s*import\s+["']@kadena\//,
  /^\s*export\s+[^"']*?from\s+["']@kadena\//,
  /^\s*vi\.mock\(\s*["']@kadena\//,
  /^\s*(?:const|let|var)?\s*[^=]*?=?\s*require\(\s*["']@kadena\//,
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(full, files);
    } else if (stat.isFile() && full.endsWith(".ts")) {
      if (basename(full) === SELF) continue;
      files.push(full);
    }
  }
  return files;
}

function relPath(absolute: string): string {
  return absolute
    .replace(OURONET_CORE_ROOT, "")
    .replace(/\\/g, "/")
    .replace(/^\//, "");
}

describe("v4.1.0 regression: no @kadena/* imports in ouronet-core", () => {
  for (const dirName of SCAN_DIRS) {
    const fullDir = resolve(OURONET_CORE_ROOT, dirName);
    const files = walk(fullDir);

    it(`scans at least one .ts file under ${dirName}/`, () => {
      expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
      const rel = relPath(file);
      it(`${rel} contains no @kadena/* import statements`, () => {
        const content = readFileSync(file, "utf8");
        const lines = content.split("\n");
        const violations: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          for (const pattern of FORBIDDEN) {
            if (pattern.test(line)) {
              violations.push(
                `${rel}:${i + 1} matches ${pattern.source} -> ${line.trim()}`,
              );
            }
          }
        }
        expect(violations).toEqual([]);
      });
    }
  }

  it("self-exclusion: this test file is correctly excluded from its own walk", () => {
    // The SELF constant should be set to this test file's basename.
    // The walk should never include this file in its iteration.
    // We test this by recreating the walk WITHOUT the SELF skip and verifying
    // that this very file IS visible in the walk results (proving SELF would
    // have skipped it correctly).

    const thisFile = basename(fileURLToPath(import.meta.url));

    // Confirm SELF constant matches this file
    expect(thisFile).toBe(SELF);

    // Confirm the walk WOULD have encountered this file if SELF wasn't excluded
    // (re-walk the tests dir to ensure this file is on disk and would be picked up)
    const testsDir = here;
    const allTsFiles = readdirSync(testsDir).filter(f => f.endsWith(".ts"));
    expect(allTsFiles).toContain(SELF);
  });
});
