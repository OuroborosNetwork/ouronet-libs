/**
 * The SmartSwap route bundle.
 *
 * `SWP|C_SmartSwap…` takes the route as an argument because the self-searching `CC_` twin
 * measures 7,145,298 gas on the worst case -- 3.57x over the ~2,000,000 ceiling. So assembling
 * this correctly is what makes a multi-hop swap mineable, and the shape has to be exact.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { setPactReader, type PactReader } from "@stoachain/stoa-core/reads";
import { buildSmartSwapBundle, pathExists, bundleToPact } from "../src/interactions/smartSwapBundle.js";

const BAR = "|";
const ok = (data: unknown) => Promise.resolve({ result: { status: "success", data } } as any);

/** Records every Pact string the builder sends, so the ORDER and TARGETS can be asserted. */
function readerWith(overrides: Record<string, unknown>) {
  const seen: string[] = [];
  const r: PactReader = (code: string) => {
    seen.push(code);
    for (const [needle, data] of Object.entries(overrides)) {
      if (code.includes(needle)) return ok(data);
    }
    return ok(null);
  };
  return { reader: r, seen };
}

const HOPPER = { nodes: ["IN", "MID", "OUT"], edges: ["POOL-A", "POOL-B"], "output-values": [1] };

afterEach(() => vi.restoreAllMocks());

describe("pathExists", () => {
  it("treats the [BAR] sentinel as no path, not as a one-node path", () => {
    // The contract signals "nowhere" with [BAR], not with an empty list. Reading [BAR] as a
    // real path would submit a route whose only node is a pipe glyph.
    expect(pathExists({ nodes: [BAR] })).toBe(false);
    expect(pathExists({ nodes: [] })).toBe(false);
    expect(pathExists(null)).toBe(false);
    expect(pathExists({ nodes: ["A", "B"] })).toBe(true);
  });
});

describe("buildSmartSwapBundle", () => {
  it("returns null when no ACTIVE route exists, rather than a bundle that will be refused", async () => {
    const { reader } = readerWith({ URC_HopperActive: { nodes: [BAR], edges: [] } });
    setPactReader(reader);
    expect(await buildSmartSwapBundle({ inputId: "IN", outputId: "OUT", inputAmount: 1 }))
      .toBeNull();
  });

  it("targets DLK for the boost path and DWK for stoa-paths -- they are DIFFERENT tokens", async () => {
    // The handoff records conflating these as a real bug found while tracing URC_PoolValue.
    // Silver Stoa prices the Liquid Boost burn; Wrapped Stoa prices the pools.
    const { reader, seen } = readerWith({
      URC_HopperActive: HOPPER,
      URC_ReadPathCache: { nodes: [BAR], edges: [], "topology-version": 1 },
      URC_HopperActiveShortest: { nodes: ["X", "Y"], edges: ["E"] },
      UR_PoolTokens: ["FIRST", "OTHER"],
      UR_SilverStoaID: "SSTOA",
      UR_WrappedStoaID: "WSTOA",
    });
    setPactReader(reader);
    const b = await buildSmartSwapBundle({ inputId: "IN", outputId: "OUT", inputAmount: 1 });
    expect(b).not.toBeNull();

    const cacheReads = seen.filter(c => c.includes("URC_ReadPathCache"));
    // boost: OUT -> SSTOA
    expect(cacheReads.some(c => c.includes('"OUT" "SSTOA"'))).toBe(true);
    // stoa: FIRST -> WSTOA
    expect(cacheReads.some(c => c.includes('"FIRST" "WSTOA"'))).toBe(true);
    // and NEVER the other way round
    expect(cacheReads.some(c => c.includes('"OUT" "WSTOA"'))).toBe(false);
  });

  it("dedupes stoa-paths by FIRST TOKEN, not one entry per pool", async () => {
    // Redundant per-pool searching was 56.9% of the original 102-pool worst case. Two pools
    // sharing a first token must produce ONE entry.
    const { reader } = readerWith({
      URC_HopperActive: HOPPER,               // two pools: POOL-A, POOL-B
      URC_ReadPathCache: { nodes: ["A", "B"], edges: ["E"], "topology-version": 1 },
      UR_PoolTokens: ["SHARED", "OTHER"],     // both pools report the SAME first token
      UR_SilverStoaID: "SSTOA",
      UR_WrappedStoaID: "WSTOA",
    });
    setPactReader(reader);
    const b = await buildSmartSwapBundle({ inputId: "IN", outputId: "OUT", inputAmount: 1 });
    expect(b!["stoa-paths"]).toHaveLength(1);
    expect(b!["stoa-paths"][0]!["first-token"]).toBe("SHARED");
  });

  it("marks a cache HIT as is-new false and a traced MISS as true", async () => {
    const hit = readerWith({
      URC_HopperActive: HOPPER,
      URC_ReadPathCache: { nodes: ["A", "B"], edges: ["E"], "topology-version": 1 },
      UR_PoolTokens: ["FIRST", "OTHER"], UR_SilverStoaID: "SSTOA", UR_WrappedStoaID: "WSTOA",
    });
    setPactReader(hit.reader);
    const warm = await buildSmartSwapBundle({ inputId: "IN", outputId: "OUT", inputAmount: 1 });
    expect(warm!["boost-path"]["is-new"]).toBe(false);

    const miss = readerWith({
      URC_HopperActive: HOPPER,
      URC_ReadPathCache: { nodes: [BAR], edges: [], "topology-version": 1 },
      URC_HopperActiveShortest: { nodes: ["A", "B"], edges: ["E"] },
      UR_PoolTokens: ["FIRST", "OTHER"], UR_SilverStoaID: "SSTOA", UR_WrappedStoaID: "WSTOA",
    });
    setPactReader(miss.reader);
    const cold = await buildSmartSwapBundle({ inputId: "IN", outputId: "OUT", inputAmount: 1 });
    expect(cold!["boost-path"]["is-new"]).toBe(true);
  });

  it("never caches the swap route itself -- it is amount-sensitive", async () => {
    const { reader, seen } = readerWith({
      URC_HopperActive: HOPPER,
      URC_ReadPathCache: { nodes: ["A", "B"], edges: ["E"], "topology-version": 1 },
      UR_PoolTokens: ["FIRST", "OTHER"], UR_SilverStoaID: "SSTOA", UR_WrappedStoaID: "WSTOA",
    });
    setPactReader(reader);
    await buildSmartSwapBundle({ inputId: "IN", outputId: "OUT", inputAmount: 7 });
    // the route read carries the AMOUNT, and no cache read is made for IN->OUT
    expect(seen.some(c => c.includes("URC_HopperActive") && c.includes("7.0"))).toBe(true);
    expect(seen.some(c => c.includes("URC_ReadPathCache") && c.includes('"IN" "OUT"'))).toBe(false);
  });

  it("reports progress, and every reported step is a free read", async () => {
    const { reader } = readerWith({
      URC_HopperActive: HOPPER,
      URC_ReadPathCache: { nodes: ["A", "B"], edges: ["E"], "topology-version": 1 },
      UR_PoolTokens: ["FIRST", "OTHER"], UR_SilverStoaID: "SSTOA", UR_WrappedStoaID: "WSTOA",
    });
    setPactReader(reader);
    const seenStages: string[] = [];
    await buildSmartSwapBundle({
      inputId: "IN", outputId: "OUT", inputAmount: 1,
      onProgress: (p) => seenStages.push(p.stage),
    });
    expect(seenStages[0]).toBe("route");
    expect(seenStages).toContain("boost");
    expect(seenStages[seenStages.length - 1]).toBe("done");
  });

  it("renders a bundle as a Pact object literal with space-separated lists", async () => {
    const b = {
      "swap-route": { nodes: ["A", "B"], edges: ["E"] },
      "boost-path": { nodes: ["A", "C"], edges: ["F"], "is-new": true },
      "stoa-paths": [{ "first-token": "T", path: { nodes: [BAR], edges: [], "is-new": false } }],
    };
    const pact = bundleToPact(b);
    expect(pact).toContain('"nodes": ["A" "B"]');     // spaces, not commas
    expect(pact).toContain('"is-new": true');
    expect(pact).toContain('"first-token": "T"');
  });
});
