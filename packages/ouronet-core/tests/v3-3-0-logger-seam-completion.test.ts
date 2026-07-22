/**
 * v3.3.0 logger-seam regression-lock for `@ouronet/ouronet-core`.
 *
 * Mirrors the test of the same name in `@stoachain/stoa-core/tests/` —
 * scans this package's `src/` for raw `console.*` call sites that
 * should route through `getLogger()` from the seam (located in
 * `@stoachain/stoa-core/observability`).
 *
 * Differences from the stoa-core sibling:
 *   - No SEAM_FILE special case here (the seam IS in stoa-core; this
 *     package only consumes it).
 *   - Scope is limited to `packages/ouronet-core/src/`.
 *
 * v4.0.0 (Phase 2 of the monorepo split): the regression-lock
 * promise — "no raw console.* call sites in src/ outside the seam's
 * default logger" — now spans BOTH packages. Each package owns the
 * lock for its own src/ tree.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function listTsFiles(dir: string): string[] {
  const acc: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      acc.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

function commentLineSet(source: string): Set<number> {
  const inComment = new Set<number>();
  const lines = source.split(/\r?\n/);
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (inBlock) {
      inComment.add(i);
      if (trimmed.includes("*/")) inBlock = false;
      continue;
    }
    if (trimmed.startsWith("/*")) {
      inComment.add(i);
      if (!trimmed.includes("*/")) inBlock = true;
      continue;
    }
    if (trimmed.startsWith("//")) {
      inComment.add(i);
      continue;
    }
    if (trimmed.startsWith("*")) {
      inComment.add(i);
      continue;
    }
  }
  return inComment;
}

describe("v3.3.0 logger-seam completion — ouronet-core regression lock", () => {
  it("no raw console.{log,info,group,groupEnd,debug,warn,error} call sites in this package's src/", () => {
    const srcDir = join(process.cwd(), "src");
    const files = listTsFiles(srcDir);

    const violations: Array<{ file: string; line: number; text: string }> = [];

    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      const comments = commentLineSet(source);
      const lines = source.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (comments.has(i)) continue;
        const m = lines[i].match(/console\.(log|info|group|groupEnd|debug|warn|error)\s*\(/);
        if (m) {
          violations.push({ file, line: i + 1, text: lines[i].trim() });
        }
      }
    }

    if (violations.length > 0) {
      console.error(
        `Found ${violations.length} raw console.* call site(s) in ouronet-core src/. ` +
          `Use \`getLogger()\` from \`@stoachain/stoa-core/observability\` instead.\n` +
          violations.map((v) => `  ${v.file}:${v.line}  ${v.text}`).join("\n"),
      );
    }
    expect(violations).toEqual([]);
  });
});
