/**
 * dexOrtoFungibleFunctions.ts
 * Orto Fungible (OF) entity reads — header, entries, sleeping-LP, nonces supplies/metadata, button state, hibernating.
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type {
  OrtoFungibleHeaderData,
  OrtoFungibleEntryData,
  OrtofungibleButtonState,
  HibernatingNonceData,
} from "./dexTypes.js";

/**
 * Fetch Orto Fungible header data for an account.
 * Returns global OF count + nonces, held OF list/count, managed OF list/count.
 */
export async function getOrtoFungibleHeader(
  account: string,
): Promise<OrtoFungibleHeaderData | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0018_OrtofungibleHeader "${account}")`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return null;
    const data = response.result.data;
    if (!data || typeof data !== "object") return null;
    return data as OrtoFungibleHeaderData;
  } catch (err) {
    getLogger().error("URC_0018_OrtofungibleHeader failed:", err);
    return null;
  }
}

/**
 * Batch-fetch OrtoFungibleEntry data for Native/Vesting/Sleeping/Hibernating tokens.
 * Uses URC_0009a_OrtoFungibleEntryMapper(account, dpofs:[string])
 */
export async function getOrtoFungibleEntries(
  account: string,
  tokenIds: string[],
): Promise<(OrtoFungibleEntryData | null)[]> {
  if (tokenIds.length === 0) return [];
  try {
    const listItems = tokenIds.map(id => `"${id}"`).join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0009a_OrtoFungibleEntryMapper "${account}" [${listItems}])`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return tokenIds.map(() => null);
    const data = response.result.data;
    if (!Array.isArray(data)) return tokenIds.map(() => null);

    return data.map((item: any) => {
      if (!item || typeof item !== "object" || item === false) return null;
      return item as OrtoFungibleEntryData;
    });
  } catch (err) {
    getLogger().error("URC_0009a_OrtoFungibleEntryMapper failed:", err);
    return tokenIds.map(() => null);
  }
}

/**
 * Batch-fetch Sleeping LP Orto Fungible data.
 * Uses URC_0009b_OrtoFungibleSleepingLPMapper(account, lp-ids:[string])
 */
export async function getOrtoFungibleSleepingLPEntries(
  account: string,
  lpIds: string[],
): Promise<(OrtoFungibleEntryData | null)[]> {
  if (lpIds.length === 0) return [];
  try {
    const listItems = lpIds.map(id => `"${id}"`).join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0009b_OrtoFungibleSleepingLPMapper "${account}" [${listItems}])`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return lpIds.map(() => null);
    const data = response.result.data;
    if (!Array.isArray(data)) return lpIds.map(() => null);

    return data.map((item: any) => {
      if (!item || typeof item !== "object" || item === false) return null;
      return item as OrtoFungibleEntryData;
    });
  } catch (err) {
    getLogger().error("URC_0009b_OrtoFungibleSleepingLPMapper failed:", err);
    return lpIds.map(() => null);
  }
}

/**
 * Fetch supplies for specific nonces of an Orto Fungible.
 * Returns a list of decimal strings (one per nonce, in order).
 */
export async function getOrtoFungibleNoncesSupplies(
  dpofId: string,
  nonces: number[],
): Promise<string[]> {
  if (nonces.length === 0) return [];
  try {
    const nonceList = nonces.join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPOF.UR_NoncesSupplies "${dpofId}" [${nonceList}])`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return nonces.map(() => "0");
    const data = response.result.data;
    if (!Array.isArray(data)) return nonces.map(() => "0");

    return data.map((item: any) => {
      if (item === null || item === undefined) return "0";
      if (typeof item === "object" && "decimal" in item) return String(item.decimal);
      return String(item);
    });
  } catch (err) {
    getLogger().error("DPOF.UR_NoncesSupplies failed:", err);
    return nonces.map(() => "0");
  }
}

/**
 * Fetch metadata for specific nonces of an Orto Fungible.
 * Returns array of metadata objects (one per nonce).
 * Each nonce's metadata is itself an array of objects [object].
 */
export async function getOrtoFungibleNoncesMetaDatas(
  dpofId: string,
  nonces: number[],
): Promise<(any[] | null)[]> {
  if (nonces.length === 0) return [];
  try {
    const nonceList = nonces.join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPOF.UR_NoncesMetaDatas "${dpofId}" [${nonceList}])`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return nonces.map(() => null);
    const data = response.result.data;
    if (!Array.isArray(data)) return nonces.map(() => null);

    return data.map((item: any) => {
      if (!item || !Array.isArray(item)) return item ? [item] : null;
      return item;
    });
  } catch (err) {
    getLogger().error("DPOF.UR_NoncesMetaDatas failed:", err);
    return nonces.map(() => null);
  }
}

export async function getOrtofungibleButtonState(
  account: string,
  dpofId: string,
  selectedNonces: number[],
): Promise<OrtofungibleButtonState | null> {
  try {
    const nonceList = `[${selectedNonces.join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0019_OrtofungibleButton "${account}" "${dpofId}" ${nonceList})`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return null;
    const data = response.result.data;
    if (!data || typeof data !== "object") return null;
    return data as OrtofungibleButtonState;
  } catch (err) {
    getLogger().error("URC_0019_OrtofungibleButton failed:", err);
    return null;
  }
}

export async function getHibernatingNonceData(
  dpofId: string,
  nonce: number,
): Promise<HibernatingNonceData | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0020_HibernatingNonceData "${dpofId}" ${nonce})`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response?.result || response.result.status === "failure") return null;
    const data = response.result.data;
    if (!data || typeof data !== "object") return null;
    return data as HibernatingNonceData;
  } catch (err) {
    getLogger().error("URC_0020_HibernatingNonceData failed:", err);
    return null;
  }
}
