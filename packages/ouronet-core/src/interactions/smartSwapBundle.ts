/**
 * smartSwapBundle.ts — build the `SmartSwapPathBundle` a SmartSwap needs.
 *
 * WHY THIS IS NOT OPTIONAL. There are two SmartSwap families on chain and only one of them
 * fits in a block. Measured on the worst case (6 hops, ~102 active pools, Liquid Boost on):
 *
 *     SWP|CC_SmartSwap… (self-searching, no bundle)   7,145,298 gas   3.57x OVER the ~2,000,000 ceiling
 *     SWP|C_SmartSwap…  (bundle-based, cold cache)      397,043 gas   0.20x — safely under
 *
 * So the `CC_` fallback is not a substitute; at scale it simply cannot be mined. The `C_`
 * family takes the route as an argument, and assembling it is this file's job.
 *
 * EVERY STEP HERE IS FREE. Steps 1-4 are `/local` dirty reads, not transactions. Only the
 * submission costs gas. That is what makes the "discovery happening, shown live" UX honest
 * rather than theatre — `onProgress` reports real work.
 *
 * THE BUNDLE CARRIES TOPOLOGY ONLY, NEVER AMOUNTS. The contract recomputes every figure from
 * live reserves and validates the route structurally before using it (rejects the BAR
 * sentinel, caps depth, verifies every hop with URC_EdgeConnects, pins the endpoints). A
 * hostile or stale bundle therefore cannot move value the wrong way; the worst it can do is
 * fail. That is the property that makes injecting a client-computed path safe at all.
 *
 * Recipe: HANDOFFS/HANDOFF-swp-smartswap-bundle-architecture.md §4.
 */
import { KADENA_NAMESPACE as NS } from "../constants/index.js";
import { pactRead } from "@stoachain/stoa-core/reads";

/** `[BAR]` in the nodes list means "no path exists anywhere". BAR is the pipe glyph. */
const BAR = "|";

export interface SwapRoute {
  nodes: string[];
  edges: string[];
}
export interface CachedPathOrMiss {
  nodes: string[];
  edges: string[];
  /** A HINT only. The contract never trusts it as write authority. */
  "is-new": boolean;
}
export interface TokenPathPair {
  "first-token": string;
  path: CachedPathOrMiss;
}
export interface SmartSwapPathBundle {
  "swap-route": SwapRoute;
  "boost-path": CachedPathOrMiss;
  "stoa-paths": TokenPathPair[];
}

export type BundleStage =
  | "route"          // the actual swap path -- never cached, amount-sensitive
  | "boost"          // output token -> DLK, for Liquid Boost burn valuation
  | "stoa-paths"     // each distinct pool's first token -> DWK, for per-pool pricing
  | "done";

export interface BundleProgress {
  stage: BundleStage;
  /** Human-readable, safe to render. */
  detail: string;
  /** 0..1, best effort -- the stoa-paths count is not known until the route is. */
  fraction: number;
}

async function readObj<T>(code: string, tier: string): Promise<T | null> {
  const r = (await pactRead(code, { tier } as never)) as
    { result?: { status?: string; data?: unknown } } | null;
  if (!r?.result || r.result.status === "failure") return null;
  return (r.result.data ?? null) as T | null;
}

const dec = (n: number) => (Number.isInteger(n) ? `${n}.0` : String(n));
const str = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** A path that exists? `[BAR]` is the contract's "nowhere" sentinel, not an empty list. */
export function pathExists(p: { nodes?: string[] } | null): boolean {
  return !!p?.nodes && p.nodes.length > 0 && !(p.nodes.length === 1 && p.nodes[0] === BAR);
}

/**
 * Resolve `from -> to`, cache first.
 *
 * The cache is consulted with `URC_ReadPathCache` and only traced on a miss, which is the
 * whole point of the shared cache: a cold lookup costs a BFS, a warm one costs a row read.
 * `is-new` records which happened, so the contract can register a genuinely new path.
 */
async function resolveCachedPath(from: string, to: string): Promise<CachedPathOrMiss> {
  if (from === to) {
    // The contract short-circuits an identical pair itself (URC_WorthDWK and friends), so the
    // honest bundle entry is the sentinel rather than a fabricated zero-hop path.
    return { nodes: [BAR], edges: [], "is-new": false };
  }
  const cached = await readObj<{ nodes: string[]; edges: string[] }>(
    `(${NS}.SWPT.URC_ReadPathCache ${str(from)} ${str(to)})`, "T5");
  if (pathExists(cached)) {
    return { nodes: cached!.nodes, edges: cached!.edges, "is-new": false };
  }
  // Miss -> trace. The discovery amount is irrelevant: this path is amount-AGNOSTIC and is
  // only used to price a residual slice at swap time, from fresh math.
  const traced = await readObj<{ nodes: string[]; edges: string[] }>(
    `(${NS}.SWPI.URC_HopperActiveShortest ${str(from)} ${str(to)} 1.0)`, "T7");
  if (!pathExists(traced)) return { nodes: [BAR], edges: [], "is-new": false };
  return { nodes: traced!.nodes, edges: traced!.edges, "is-new": true };
}

export interface BuildBundleArgs {
  inputId: string;
  outputId: string;
  inputAmount: number;
  onProgress?: (p: BundleProgress) => void;
}

/**
 * Assemble a bundle, or null when no route exists.
 *
 * Null is a real answer: `URC_HopperActive` searches ACTIVE pools only, so a pair with no
 * live route returns the sentinel. Submitting anyway would be refused on chain, so it is
 * refused here where it costs nothing.
 */
export async function buildSmartSwapBundle(
  { inputId, outputId, inputAmount, onProgress }: BuildBundleArgs,
): Promise<SmartSwapPathBundle | null> {
  const say = (stage: BundleStage, detail: string, fraction: number) =>
    onProgress?.({ stage, detail, fraction });

  // 1 -- the swap route. NEVER cached: it is amount-sensitive, so a cached route could be a
  // worse split for this size. Re-derived every call, deliberately.
  say("route", `Searching routes ${inputId} → ${outputId}…`, 0.05);
  const hopper = await readObj<{ nodes: string[]; edges: string[] }>(
    `(${NS}.SWPI.URC_HopperActive ${str(inputId)} ${str(outputId)} ${dec(inputAmount)})`, "T7");
  if (!pathExists(hopper)) return null;
  const swapRoute: SwapRoute = { nodes: hopper!.nodes, edges: hopper!.edges };
  say("route", `Route found: ${swapRoute.edges.length} hop(s)`, 0.35);

  // 2 -- boost path: the swap's OUTPUT token to DLK (Silver Stoa), for Liquid Boost burn
  // valuation. DLK and DWK are DIFFERENT tokens and conflating them was a real bug in the
  // contract's own doc comments; DLK here, DWK in step 3.
  say("boost", "Resolving Liquid Boost valuation path…", 0.45);
  const dlk = await readObj<string>(`(${NS}.DALOS.UR_SilverStoaID)`, "T5");
  const boostPath = dlk
    ? await resolveCachedPath(outputId, dlk)
    : { nodes: [BAR], edges: [], "is-new": false };
  // A boost path that does not resolve is NOT a failure. It is validated on chain with the
  // same 7-node cap as the swap route, and an over-long one simply means boost does not get
  // pumped this round -- a graceful degrade that costs nothing extra.

  // 3 -- stoa-paths: each DISTINCT pool's first token to DWK (Wrapped Stoa), deduped by
  // first-token rather than one per pool. That dedup is where the largest chunk of the
  // original gas crisis lived: redundant per-pool searching was 56.9% of the worst case.
  say("stoa-paths", "Pricing pools…", 0.6);
  const dwk = await readObj<string>(`(${NS}.DALOS.UR_WrappedStoaID)`, "T5");
  const firstTokens: string[] = [];
  for (const pool of [...new Set(swapRoute.edges)]) {
    const toks = await readObj<string[]>(`(${NS}.SWP.UR_PoolTokens ${str(pool)})`, "T5");
    const first = toks?.[0];
    if (first && !firstTokens.includes(first)) firstTokens.push(first);
  }
  const stoaPaths: TokenPathPair[] = [];
  for (let i = 0; i < firstTokens.length; i++) {
    const t = firstTokens[i]!;
    say("stoa-paths", `Pricing ${t} (${i + 1}/${firstTokens.length})…`,
        0.6 + 0.35 * ((i + 1) / Math.max(1, firstTokens.length)));
    stoaPaths.push({ "first-token": t, path: dwk ? await resolveCachedPath(t, dwk)
                                                 : { nodes: [BAR], edges: [], "is-new": false } });
  }

  say("done", "Route assembled", 1);
  return { "swap-route": swapRoute, "boost-path": boostPath, "stoa-paths": stoaPaths };
}

/** Render a bundle as a Pact object literal for inlining into transaction code. */
export function bundleToPact(b: SmartSwapPathBundle): string {
  const list = (xs: string[]) => `[${xs.map(str).join(" ")}]`;
  const path = (p: CachedPathOrMiss) =>
    `{ "nodes": ${list(p.nodes)}, "edges": ${list(p.edges)}, "is-new": ${p["is-new"]} }`;
  const pairs = b["stoa-paths"]
    .map(p => `{ "first-token": ${str(p["first-token"])}, "path": ${path(p.path)} }`)
    .join(", ");
  return `{ "swap-route": { "nodes": ${list(b["swap-route"].nodes)}, ` +
         `"edges": ${list(b["swap-route"].edges)} }, ` +
         `"boost-path": ${path(b["boost-path"])}, "stoa-paths": [${pairs}] }`;
}
