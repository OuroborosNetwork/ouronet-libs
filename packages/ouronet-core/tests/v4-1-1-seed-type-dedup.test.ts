import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { SeedType as StoaSeedType } from "@stoachain/stoa-core/wallet";
import type { SeedType as OuronetSeedType } from "@ouronet/ouronet-core/codex";

describe("REQ-13: SeedType single canonical declaration", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../..");

  it("RED: source-side regex confirms ouronet-core does NOT re-declare SeedType (uses re-export form)", () => {
    const file = readFileSync(resolve(repoRoot, "packages/ouronet-core/src/codex/seedTypeMigration.ts"), "utf8");
    // After dedup, the file should contain `export type { SeedType }` re-export, NOT a `type SeedType =` literal declaration
    expect(file).toMatch(/export type \{ SeedType.*\} from .@stoachain\/stoa-core\/wallet./);
    // Confirm the literal-declaration form is gone
    expect(file).not.toMatch(/^export type SeedType =/m);
  });

  it("the two SeedType types from different packages are structurally compatible (assignable both ways)", () => {
    // TypeScript-level check via compile-time assertion
    type AssertEq<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
    type Result = AssertEq<StoaSeedType, OuronetSeedType>;
    const ok: Result = true;
    expect(ok).toBe(true);
  });

  // The canonical declaration now lives across a published package boundary, in
  // stoa-js. We assert it through the INSTALLED dependency's type declarations
  // rather than a sibling source path — that is the same surface a consumer
  // sees, so it stays honest about what we actually depend on. stoa-js locks
  // the source-side half in its own tests/v4-1-1-seed-type-canonical.test.ts.
  it("canonical SeedType is declared by the installed @stoachain/stoa-core", () => {
    const dts = resolve(repoRoot, "node_modules/@stoachain/stoa-core/dist/wallet/types.d.ts");
    expect(existsSync(dts), `expected stoa-core type declarations at ${dts}`).toBe(true);
    expect(readFileSync(dts, "utf8")).toMatch(/(export )?(declare )?type SeedType\s*=/);
  });
});
