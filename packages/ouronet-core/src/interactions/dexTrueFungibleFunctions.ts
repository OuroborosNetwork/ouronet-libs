/**
 * dexTrueFungibleFunctions.ts
 * True Fungible (TF) entity reads — LP entries, header, entries, native/frozen LP, button state, swpair lookup.
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type {
  TrueFungibleLPEntry,
  TrueFungibleHeaderData,
  TrueFungibleEntryData,
  TrueFungibleButtonState,
} from "./dexTypes.js";

export async function getTrueFungibleLPEntry(
  account: string,
  swpair: string,
  izNative: boolean,
): Promise<TrueFungibleLPEntry | null> {
  try {
    const boolStr = izNative ? "true" : "false";
    const pactCode = izNative
      ? `(${KADENA_NAMESPACE}.DPL-UR.URC_0008b_TrueFungibleLPEntry "${account}" "${swpair}" ${boolStr})`
      : `(try false (${KADENA_NAMESPACE}.DPL-UR.URC_0008b_TrueFungibleLPEntry "${account}" "${swpair}" ${boolStr}))`;

    const response = await pactRead(pactCode, { tier: "T2" });

    if (!response?.result || response.result.status === "failure") return null;

    const data = response.result.data;
    if (!izNative && (typeof data === "boolean" || (data as any) === false)) return null;
    if (!data || typeof data !== "object") return null;

    return data as TrueFungibleLPEntry;
  } catch (error) {
    getLogger().error("Error in getTrueFungibleLPEntry:", error);
    return null;
  }
}

export async function getLPEntries(
  account: string,
  swpair: string,
): Promise<{ native: TrueFungibleLPEntry | null; frozen: TrueFungibleLPEntry | null }> {
  const [native, frozen] = await Promise.all([
    getTrueFungibleLPEntry(account, swpair, true),
    getTrueFungibleLPEntry(account, swpair, false),
  ]);
  return { native, frozen };
}

/**
 * Fetch swap pairs owned by a specific Ouronet resident account.
 * Returns a list of swpair IDs that the account can manage.
 */
export async function getOwnedSwapPairs(account: string): Promise<string[]> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.SWP.URD_OwnedSwapPairs "${account}")`, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return [];

    const data = response.result.data;
    if (Array.isArray(data)) return data as string[];
    return [];
  } catch (error) {
    getLogger().error("Error in getOwnedSwapPairs:", error);
    return [];
  }
}

/**
 * Fetch True Fungible header data for an account.
 * Returns global TF count, held TF list/count, managed TF list/count.
 */
export async function getTrueFungibleHeader(
  account: string,
): Promise<TrueFungibleHeaderData | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0016_TruefungibleHeader "${account}")`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return null;
    const data = response.result.data;
    if (!data || typeof data !== "object") return null;
    return data as TrueFungibleHeaderData;
  } catch (err) {
    getLogger().error("URC_0016_TruefungibleHeader failed:", err);
    return null;
  }
}

/**
 * Batch-fetch TrueFungibleEntry data for multiple token IDs using the chain mapper function.
 * Works for Native, Frozen, and Reserved tokens (not LP).
 * Uses URC_0008a_TrueFungibleEntryMapper(account, dptfs:[string])
 */
export async function getTrueFungibleEntries(
  account: string,
  tokenIds: string[],
): Promise<(TrueFungibleEntryData | null)[]> {
  if (tokenIds.length === 0) return [];
  try {
    const listItems = tokenIds.map(id => `"${id}"`).join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0008a_TrueFungibleEntryMapper "${account}" [${listItems}])`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return tokenIds.map(() => null);
    const data = response.result.data;
    if (!Array.isArray(data)) return tokenIds.map(() => null);

    return data.map((item: any) => {
      if (!item || typeof item !== "object" || item === false) return null;
      return item as TrueFungibleEntryData;
    });
  } catch (err) {
    getLogger().error("URC_0008a_TrueFungibleEntryMapper failed:", err);
    return tokenIds.map(() => null);
  }
}

/**
 * Batch-fetch Native LP entry data using the chain mapper function.
 * Uses URC_0008b_TrueFungibleNativeLPMapper(account, lp-ids:[string])
 * Accepts LP token IDs directly — chain resolves swpairs internally.
 */
export async function getNativeLPEntries(
  account: string,
  lpIds: string[],
): Promise<(TrueFungibleLPEntry | null)[]> {
  if (lpIds.length === 0) return [];
  try {
    const listItems = lpIds.map(id => `"${id}"`).join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0008b_TrueFungibleNativeLPMapper "${account}" [${listItems}])`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return lpIds.map(() => null);
    const data = response.result.data;
    if (!Array.isArray(data)) return lpIds.map(() => null);

    return data.map((item: any) => {
      if (!item || typeof item !== "object" || item === false) return null;
      return item as TrueFungibleLPEntry;
    });
  } catch (err) {
    getLogger().error("URC_0008b_TrueFungibleNativeLPMapper failed:", err);
    return lpIds.map(() => null);
  }
}

/**
 * Batch-fetch Frozen LP entry data using the chain mapper function.
 * Uses URC_0008b_TrueFungibleFrozenLPMapper(account, lp-ids:[string])
 * Accepts LP token IDs directly — chain resolves swpairs internally.
 */
export async function getFrozenLPEntries(
  account: string,
  lpIds: string[],
): Promise<(TrueFungibleLPEntry | null)[]> {
  if (lpIds.length === 0) return [];
  try {
    const listItems = lpIds.map(id => `"${id}"`).join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0008b_TrueFungibleFrozenLPMapper "${account}" [${listItems}])`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return lpIds.map(() => null);
    const data = response.result.data;
    if (!Array.isArray(data)) return lpIds.map(() => null);

    return data.map((item: any) => {
      if (!item || typeof item !== "object" || item === false) return null;
      return item as TrueFungibleLPEntry;
    });
  } catch (err) {
    getLogger().error("URC_0008b_TrueFungibleFrozenLPMapper failed:", err);
    return lpIds.map(() => null);
  }
}

/**
 * Get the SWP-Pair ID from an LP token ID.
 * Uses SWP.UR_GetLpSwpair on chain.
 */
export async function getSwpairFromLpId(lpId: string): Promise<string | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.SWP.UR_GetLpSwpair "${lpId}")`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return null;
    const data = response.result.data;
    if (typeof data !== "string") return null;
    return data;
  } catch (error) {
    getLogger().error("Error in getSwpairFromLpId:", error);
    return null;
  }
}

/**
 * Batch-fetch SWP-Pair IDs for multiple LP token IDs using a single Pact (map ...) call.
 */
export async function getSwpairsFromLpIds(lpIds: string[]): Promise<(string | null)[]> {
  if (lpIds.length === 0) return [];
  try {
    const listItems = lpIds.map(id => `"${id}"`).join(" ");
    const pactCode = `(map (lambda (lid:string) (try "" (${KADENA_NAMESPACE}.SWP.UR_GetLpSwpair lid))) [${listItems}])`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return lpIds.map(() => null);
    const data = response.result.data;
    if (!Array.isArray(data)) return lpIds.map(() => null);
    return data.map((v: any) => (typeof v === "string" && v !== "" ? v : null));
  } catch (error) {
    getLogger().error("Error in getSwpairsFromLpIds:", error);
    return lpIds.map(() => null);
  }
}

/**
 * Fetch button enable/disable state for a specific token held by an account.
 * Uses URC_0017_TruefungibleButton(account, dptf)
 */
export async function getTrueFungibleButtonState(
  account: string,
  dptfId: string,
): Promise<TrueFungibleButtonState | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0017_TruefungibleButton "${account}" "${dptfId}")`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return null;
    const data = response.result.data;
    if (!data || typeof data !== "object") return null;
    return data as TrueFungibleButtonState;
  } catch (err) {
    getLogger().error("URC_0017_TruefungibleButton failed:", err);
    return null;
  }
}
