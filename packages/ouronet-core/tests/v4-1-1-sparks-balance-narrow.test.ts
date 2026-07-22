import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getSparksBalance } from "@ouronet/ouronet-core/interactions/ouroFunctions";
import { setPactReader, rawCalibratedDirtyRead, type PactReader } from "@stoachain/stoa-core/reads";

describe("REQ-16: getSparksBalance source annotation narrowed to Promise<any | null>", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "../../..");

  // TypeScript's structural type system collapses Promise<any | null> to Promise<any>
  // (any absorbs null). The reliable anchor for this REQ is the SOURCE-STRING regex on
  // the WRITTEN annotation, NOT a type-level expectTypeOf assertion.

  it("source regex: getSparksBalance declared as Promise<any | null> (RED gate)", () => {
    const file = readFileSync(resolve(repoRoot, "packages/ouronet-core/src/interactions/ouroMovieBoosterFunctions.ts"), "utf8");
    expect(file).toMatch(/export async function getSparksBalance\([^)]*\):\s*Promise<any\s*\|\s*null>/);
  });

  it("runtime null branch: returns null on failure status (existing behavior preserved)", async () => {
    // Stub setPactReader to return failure envelope
    const stub: PactReader = async (_pactCode, _opts) => ({
      result: { status: "failure", error: "test error" }
    } as any);
    setPactReader(stub);
    try {
      const out = await getSparksBalance("k:abc");
      expect(out).toBeNull();
    } finally {
      setPactReader(rawCalibratedDirtyRead);
    }
  });

  it("runtime success branch: returns response.result.data on success", async () => {
    const stub: PactReader = async (_pactCode, _opts) => ({
      result: { status: "success", data: 42 }
    } as any);
    setPactReader(stub);
    try {
      const out = await getSparksBalance("k:abc");
      expect(out).toBe(42);
    } finally {
      setPactReader(rawCalibratedDirtyRead);
    }
  });
});
