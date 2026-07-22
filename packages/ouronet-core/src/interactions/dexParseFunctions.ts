/**
 * dexParseFunctions.ts
 * Pact response parsers and formatters for dex entities (cross-cutting helpers).
 */

import type {
  DecimalValue,
  SwapPoolData,
  PoolPreviewData,
  SwapLiquidityProviderItem,
  SwapLiquidityProviderItemPrecise,
  TrueFungibleLPEntry,
  TrueFungibleEntryData,
  OrtoFungibleEntryData,
  OrtoFungibleCategory,
  NonceData,
  URIType,
  URIData,
} from "./dexTypes.js";

// Utility functions to parse swap calculation results
export function parseSwapAmount(amountString: string): number {
  // Extract number from strings like "WSTOA-8Nh-JO8JO4F5 Output: 28.633136871920000000000000"
  const match = amountString.match(/:\s*([0-9.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse swap amount as string to preserve full decimal precision
 * @param amountString - String like "WSTOA-8Nh-JO8JO4F5 Output: 28.633136871920000000000000"
 * @returns The numeric value as a string with full precision
 */
export function parseSwapAmountPrecise(amountString: string): string {
  const match = amountString.match(/:\s*([0-9.]+)/);
  return match ? match[1] : "0";
}

export function parseSwapLiquidityProviders(providers: string[]): number {
  // Sum all liquidity provider fees from array like:
  // ["SSTOA-8Nh-JO8JO4F5 from Input to Liquidity Providers: 0.0000829749299355716637", "OURO-8Nh-JO8JO4F5 from Input to Liquidity Providers: 0.26312828657714566275"]
  return providers.reduce((total, providerString) => {
    const amount = parseSwapAmount(providerString);
    return total + amount;
  }, 0);
}

export function parseSwapLiquidityProvidersDetailed(providers: string[]): SwapLiquidityProviderItem[] {
  // Parse individual liquidity provider fees from array like:
  return providers.map((providerString) => {
    const amount = parseSwapAmount(providerString);
    // Extract token name from the beginning of the string (e.g., "SSTOA" from "SSTOA-8Nh-JO8JO4F5")
    const tokenMatch = providerString.match(/^([A-Z]+)/);
    const token = tokenMatch ? tokenMatch[1] : 'Unknown';

    return {
      token,
      amount
    };
  });
}

/**
 * Parse liquidity provider fees with full precision
 * @param providers - Array of provider strings from API
 * @returns Array of {token, amount} with amount as string for full precision
 */
export function parseSwapLiquidityProvidersDetailedPrecise(providers: string[]): SwapLiquidityProviderItemPrecise[] {
  return providers.map((providerString) => {
    const amount = parseSwapAmountPrecise(providerString);
    const tokenMatch = providerString.match(/^([A-Z]+)/);
    const token = tokenMatch ? tokenMatch[1] : 'Unknown';

    return {
      token,
      amount
    };
  });
}

/**
 * Parse decimal string to number for display
 */
export function parseDecimalValue(decimalValue: DecimalValue): number {
  return parseFloat(decimalValue.decimal);
}

/**
 * Parse decimal value as string to preserve full precision
 * @param decimalValue - DecimalValue object with decimal string
 * @returns The decimal value as a string with full precision
 */
export function parseDecimalValuePrecise(decimalValue: DecimalValue): string {
  return decimalValue.decimal;
}

/**
 * Format pool type for display
 */
export function formatPoolType(poolType: string, poolTypeWord: string): string {
  return `${poolType} (${poolTypeWord})`;
}

/**
 * Get total pool value in USD from a pool
 */
export function getPoolValueUSD(pool: SwapPoolData): string {
  return pool["tvl-in-$"];
}

/**
 * Get pool tokens summary
 */
export function getPoolTokensSummary(pool: SwapPoolData): {
  tokens: readonly string[];
  supplies: number[];
  totalTokens: number;
} {
  return {
    tokens: pool["pool-tokens"],
    supplies: pool["pool-token-supplies"].map(parseDecimalValue),
    totalTokens: pool["pool-tokens"].length,
  };
}

/**
 * Calculate total fees for pool
 */
export function getPoolFeeStructure(pool: SwapPoolData): {
  liquidFee: number;
  lpFee: number;
  specialFee: number;
  totalFee: number;
} {
  return {
    liquidFee: pool["liquid-fee"],
    lpFee: pool["lp-fee"],
    specialFee: pool["special-fee"],
    totalFee: pool["total-fee"],
  };
}

/**
 * Get special fee targets with proportions
 */
export function getSpecialFeeTargets(pool: SwapPoolData): {
  targets: readonly string[];
  shortTargets: readonly string[];
  proportions: readonly number[];
} {
  return {
    targets: pool["special-fee-targets"],
    shortTargets: pool["special-fee-targets-short"],
    proportions: pool["special-fee-targets-proportions"],
  };
}

/**
 * Get formatted pool values from enhanced preview data
 */
export function getFormattedPoolValues(pool: PoolPreviewData): {
  formattedPoolValue: string;
  formattedLpSupply: string;
  formattedLpValue: string;
  formattedTokenSupplies: readonly string[];
} {
  return {
    formattedPoolValue: pool["ft-pool-value-in-dwk"],
    formattedLpSupply: pool["ft-lp-supply"],
    formattedLpValue: pool["ft-lp-value-in-dwk"],
    formattedTokenSupplies: pool["ft-pool-token-supplies"],
  };
}

/**
 * Get pool weights and calculate percentages
 */
export function getPoolWeights(pool: PoolPreviewData): {
  weights: readonly number[];
  weightPercentages: string[];
  isBalanced: boolean;
} {
  const weights = pool["weigths"]; // Note: API has typo "weigths"
  const percentages = weights.map(w => `${(w * 100).toFixed(1)}%`);
  const isBalanced = weights.every(w => Math.abs(w - weights[0]) < 0.01);

  return {
    weights,
    weightPercentages: percentages,
    isBalanced,
  };
}

/**
 * Calculate pool composition data for charts/visualizations
 */
export function getPoolComposition(pool: PoolPreviewData): {
  tokens: readonly string[];
  supplies: number[];
  weights: readonly number[];
  compositions: Array<{
    token: string;
    supply: number;
    weight: number;
    percentage: string;
    formattedSupply: string;
  }>;
} {
  const tokens = pool["pool-tokens"];
  const supplies = pool["pool-token-supplies"].map(parseDecimalValue);
  const weights = pool["weigths"];
  const formattedSupplies = pool["ft-pool-token-supplies"];

  const compositions = tokens.map((token, index) => ({
    token: token.split('-')[0], // Clean token name
    supply: supplies[index],
    weight: weights[index],
    percentage: `${(weights[index] * 100).toFixed(1)}%`,
    formattedSupply: formattedSupplies[index],
  }));

  return {
    tokens,
    supplies,
    weights,
    compositions,
  };
}

/**
 * Local helper to resolve Pact decimal/int values to a numeric string.
 */
function parseLPDec(v: unknown): string {
  if (v == null) return "0";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "decimal" in v) return (v as any).decimal;
  if (typeof v === "object" && v !== null && "int" in v) return String((v as any).int);
  return String(v);
}

/**
 * Local helper to resolve Pact int/number values to JS number.
 */
function parseIntVal(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "int" in v) return v.int;
  return parseInt(String(v), 10) || 0;
}

export function formatLPEntry(entry: TrueFungibleLPEntry) {
  const walletSupply = parseLPDec(entry["wallet-supply"]);
  const totalSupply = parseLPDec(entry["dptf-supply"]);
  const walletStoa = parseLPDec(entry["wallet-worth-in-stoa"]);
  const walletUsd = typeof entry["wallet-worth-in-dollarz"] === "string"
    ? entry["wallet-worth-in-dollarz"]
    : parseLPDec(entry["wallet-worth-in-dollarz"]);
  const tokenStoa = parseLPDec(entry["token-worth-in-stoa"]);
  const tokenUsd = typeof entry["token-worth-in-dollarz"] === "string"
    ? entry["token-worth-in-dollarz"]
    : parseLPDec(entry["token-worth-in-dollarz"]);

  return { name: entry.t1, tokenId: entry.t2, walletSupply, totalSupply, walletStoa, walletUsd, tokenStoa, tokenUsd };
}

/**
 * Format a TrueFungibleEntry response into display-ready values.
 */
export function formatTFEntry(entry: TrueFungibleEntryData) {
  const walletSupply = parseLPDec(entry["wallet-supply"]);
  const totalSupply = parseLPDec(entry["dptf-supply"]);
  const walletStoa = parseLPDec(entry["wallet-worth-in-stoa"]);
  const walletUsd = typeof entry["wallet-worth-in-dollarz"] === "string"
    ? entry["wallet-worth-in-dollarz"]
    : parseLPDec(entry["wallet-worth-in-dollarz"]);
  const tokenStoa = parseLPDec(entry["token-worth-in-stoa"]);
  const tokenUsd = typeof entry["token-worth-in-dollarz"] === "string"
    ? entry["token-worth-in-dollarz"]
    : parseLPDec(entry["token-worth-in-dollarz"]);

  return { name: entry.t1, tokenId: entry.t2, walletSupply, totalSupply, walletStoa, walletUsd, tokenStoa, tokenUsd };
}

/**
 * Format an OrtoFungibleEntryData into display-ready values.
 * Same as formatTFEntry but includes wallet-nonces.
 */
export function formatOFEntry(entry: OrtoFungibleEntryData) {
  const walletSupply = parseLPDec(entry["wallet-supply"]);
  const totalSupply = parseLPDec(entry["dpof-supply"]);
  const walletStoa = parseLPDec(entry["wallet-worth-in-stoa"]);
  const walletUsd = typeof entry["wallet-worth-in-dollarz"] === "string"
    ? entry["wallet-worth-in-dollarz"]
    : parseLPDec(entry["wallet-worth-in-dollarz"]);
  const tokenStoa = parseLPDec(entry["token-worth-in-stoa"]);
  const tokenUsd = typeof entry["token-worth-in-dollarz"] === "string"
    ? entry["token-worth-in-dollarz"]
    : parseLPDec(entry["token-worth-in-dollarz"]);
  // wallet-nonces can be [0, 1, 2] or [{int: 0}, {int: 1}, {int: 2}] from chain
  const rawNonces = entry["wallet-nonces"] ?? [];
  const walletNonces = rawNonces.map((n: any) => parseIntVal(n));
  const walletNoncesNo = parseIntVal(entry["wallet-nonces-no"]);

  return { name: entry.t1, tokenId: entry.t2, walletSupply, totalSupply, walletStoa, walletUsd, tokenStoa, tokenUsd, walletNonces, walletNoncesNo };
}

/**
 * Classify a token ID into its category based on prefix.
 * Returns: "lp" | "frozen-lp" | "frozen" | "reserved" | "native"
 */
export function classifyTokenId(tokenId: string): "lp" | "frozen-lp" | "frozen" | "reserved" | "native" {
  // Frozen LP: F|S|, F|W|, F|P|
  if (/^F\|[SWP]\|/.test(tokenId)) return "frozen-lp";
  // LP: S|, W|, P|
  if (/^[SWP]\|/.test(tokenId)) return "lp";
  // Frozen: F|
  if (tokenId.startsWith("F|")) return "frozen";
  // Reserved: R|
  if (tokenId.startsWith("R|")) return "reserved";
  return "native";
}

/**
 * Classify an Orto Fungible token ID into one of 5 categories.
 *
 * Sleeping LP: Z|S|, Z|W|, Z|P|
 * Vesting:     V|
 * Sleeping:    Z| (but NOT Z|S|, Z|W|, Z|P|)
 * Hibernating: H|
 * Native:      everything else
 */
export function classifyOrtoFungibleId(tokenId: string): OrtoFungibleCategory {
  // Sleeping LP: Z|S|, Z|W|, Z|P| — must be checked BEFORE sleeping
  if (/^Z\|[SWP]\|/.test(tokenId)) return "sleeping-lp";
  // Vesting: V|
  if (tokenId.startsWith("V|")) return "vesting";
  // Sleeping: Z|
  if (tokenId.startsWith("Z|")) return "sleeping";
  // Hibernating: H|
  if (tokenId.startsWith("H|")) return "hibernating";
  return "native";
}

export function parseNonceData(raw: any): NonceData {
  const parseURIType = (t: any): URIType => ({
    image: !!t?.image, audio: !!t?.audio, video: !!t?.video,
    document: !!t?.document, archive: !!t?.archive, model: !!t?.model, exotic: !!t?.exotic,
  });
  const parseURIData = (d: any): URIData => ({
    image: d?.image ?? "", audio: d?.audio ?? "", video: d?.video ?? "",
    document: d?.document ?? "", archive: d?.archive ?? "", model: d?.model ?? "", exotic: d?.exotic ?? "",
  });
  const parseDecNonce = (v: any) => {
    if (typeof v === "number") return v;
    if (typeof v === "object" && v !== null) {
      if ("decimal" in v) return parseFloat(v.decimal) || 0;
      if ("int" in v) return parseFloat(v.int) || 0;
    }
    return parseFloat(String(v)) || 0;
  };
  return {
    royalty: parseDecNonce(raw?.royalty),
    ignis: parseDecNonce(raw?.ignis),
    name: raw?.name ?? "",
    description: raw?.description ?? "",
    "meta-data": {
      score: parseDecNonce(raw?.["meta-data"]?.score),
      composition: Array.isArray(raw?.["meta-data"]?.composition) ? raw["meta-data"].composition : [],
      "meta-data": raw?.["meta-data"]?.["meta-data"] ?? {},
    },
    "asset-type": parseURIType(raw?.["asset-type"]),
    "uri-primary": parseURIData(raw?.["uri-primary"]),
    "uri-secondary": parseURIData(raw?.["uri-secondary"]),
    "uri-tertiary": parseURIData(raw?.["uri-tertiary"]),
  };
}
