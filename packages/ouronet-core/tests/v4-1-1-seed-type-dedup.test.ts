import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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

  it("canonical SeedType lives at packages/stoa-core/src/wallet/types.ts", () => {
    const file = readFileSync(resolve(repoRoot, "packages/stoa-core/src/wallet/types.ts"), "utf8");
    expect(file).toMatch(/export type SeedType\s*=/);
  });
});
