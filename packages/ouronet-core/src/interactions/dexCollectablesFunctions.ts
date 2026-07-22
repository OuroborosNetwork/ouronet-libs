/**
 * dexCollectablesFunctions.ts
 * Collectables (Semi + Non Fungibles) entity reads — header, entries, nonce data, sets, filters, button state.
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import { parseNonceData } from "./dexParseFunctions.js";
import type {
  CollectablesHeaderData,
  CollectableEntryData,
  NonceData,
  SetDefinition,
  CollectablesButtonState,
} from "./dexTypes.js";

export async function getCollectablesHeader(
  account: string,
): Promise<CollectablesHeaderData | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0021_CollectablesHeader "${account}")`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return null;
    const data = (response.result as any).data;
    if (!data || typeof data !== "object") return null;
    return data as CollectablesHeaderData;
  } catch (err) {
    getLogger().error("URC_0021_CollectablesHeader failed:", err);
    return null;
  }
}

export async function getSemifungibleEntries(
  account: string,
  dpdcIds: string[],
): Promise<(CollectableEntryData | null)[]> {
  try {
    const idList = `[${dpdcIds.map(id => `"${id}"`).join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0022a_SemifungibleEntryMapper "${account}" ${idList})`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return dpdcIds.map(() => null);
    const data = (response.result as any).data;
    if (!Array.isArray(data)) return dpdcIds.map(() => null);
    return data as CollectableEntryData[];
  } catch (err) {
    getLogger().error("URC_0022a_SemifungibleEntryMapper failed:", err);
    return dpdcIds.map(() => null);
  }
}

export async function getNonfungibleEntries(
  account: string,
  dpdcIds: string[],
): Promise<(CollectableEntryData | null)[]> {
  try {
    const idList = `[${dpdcIds.map(id => `"${id}"`).join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0022a_NonfungibleEntryMapper "${account}" ${idList})`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return dpdcIds.map(() => null);
    const data = (response.result as any).data;
    if (!Array.isArray(data)) return dpdcIds.map(() => null);
    return data as CollectableEntryData[];
  } catch (err) {
    getLogger().error("URC_0022a_NonfungibleEntryMapper failed:", err);
    return dpdcIds.map(() => null);
  }
}

export async function getCollectableNonceData(
  dpdcId: string,
  isSFT: boolean,
  nonces: number[]
): Promise<NonceData[]> {
  if (nonces.length === 0) return [];
  const nonceList = nonces.join(" ");
  const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0023_CollectablesNonceData "${dpdcId}" ${isSFT} [${nonceList}])`;
  try {
    const response = await pactRead(pactCode, { tier: "T5" });
    const data = (response as any)?.result?.data;
    if (Array.isArray(data)) return data.map(parseNonceData);
    return [];
  } catch (e) {
    getLogger().error("URC_0023 fetch error:", e);
    return [];
  }
}

export async function getCollectableNonceSupply(
  dpdcId: string,
  isSFT: boolean,
  nonce: number
): Promise<number> {
  const pactCode = `(${KADENA_NAMESPACE}.DPDC.UR_NonceSupply "${dpdcId}" ${isSFT} ${nonce})`;
  try {
    const response = await pactRead(pactCode, { tier: "T5" });
    const data = (response as any)?.result?.data;
    if (typeof data === "number") return data;
    if (typeof data === "object" && data !== null) {
      if ("decimal" in data) return parseFloat(data.decimal) || 0;
      if ("int" in data) return parseFloat(data.int) || 0;
    }
    return 0;
  } catch (e) {
    getLogger().error("UR_NonceSupply fetch error:", e);
    return 0;
  }
}

/**
 * Batched per-account per-nonce supplies (DPDC.UR_AccountNoncesSupplies).
 * Replaces the per-nonce UR_NonceSupply loop with a single read for N nonces.
 */
export async function getAccountNoncesSupplies(
  account: string,
  dpdcId: string,
  isSFT: boolean,
  nonces: number[],
): Promise<number[]> {
  if (nonces.length === 0) return [];
  try {
    const nonceList = nonces.join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.DPDC.UR_AccountNoncesSupplies "${account}" "${dpdcId}" ${isSFT} [${nonceList}])`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return nonces.map(() => 0);
    const data = (response.result as any).data;
    if (!Array.isArray(data)) return nonces.map(() => 0);
    return data.map((n: any) => {
      if (typeof n === "number") return n;
      if (typeof n === "object" && n !== null) {
        if ("decimal" in n) return parseFloat(n.decimal) || 0;
        if ("int" in n) return parseFloat(n.int) || 0;
      }
      return parseFloat(String(n)) || 0;
    });
  } catch (err) {
    getLogger().error("DPDC.UR_AccountNoncesSupplies failed:", err);
    return nonces.map(() => 0);
  }
}

export async function getCollectableSets(
  dpdcId: string,
  isSFT: boolean,
): Promise<SetDefinition[]> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0024_SetReader "${dpdcId}" ${isSFT})`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return [];
    const data = (response.result as any).data;
    if (!Array.isArray(data)) return [];
    return data as SetDefinition[];
  } catch (err) {
    getLogger().error("URC_0024_SetReader failed:", err);
    return [];
  }
}

/**
 * Filter wallet nonces by nonce class for composite set positions.
 * Returns only the nonces that match the given class.
 */
export async function filterNoncesByClass(
  dpdcId: string,
  isSFT: boolean,
  nonces: number[],
  nonceClass: number,
): Promise<number[]> {
  if (nonces.length === 0) return [];
  try {
    const nonceList = `[${nonces.join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0025_FilterNoncesByClass "${dpdcId}" ${isSFT} ${nonceList} ${nonceClass})`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return [];
    const data = (response.result as any).data;
    if (!Array.isArray(data)) return [];
    return data.map((n: any) => {
      if (typeof n === "number") return n;
      if (typeof n === "object" && n !== null && "int" in n) return n.int;
      return parseInt(String(n), 10) || 0;
    }).filter((n: number) => n > 0);
  } catch (err) {
    getLogger().error("URC_0025_FilterNoncesByClass failed:", err);
    return [];
  }
}

/**
 * Batched filter-nonces-by-classes (URC_0025a_FilterNoncesByClasses).
 * One network call returns one filtered nonce list per class, in order.
 * Replaces N per-position calls to filterNoncesByClass.
 */
export async function filterNoncesByClasses(
  dpdcId: string,
  isSFT: boolean,
  nonces: number[],
  nonceClasses: number[],
): Promise<number[][]> {
  if (nonceClasses.length === 0) return [];
  if (nonces.length === 0) return nonceClasses.map(() => []);
  try {
    const nonceList = `[${nonces.join(" ")}]`;
    const classList = `[${nonceClasses.join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0025a_FilterNoncesByClasses "${dpdcId}" ${isSFT} ${nonceList} ${classList})`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return nonceClasses.map(() => []);
    const data = (response.result as any).data;
    if (!Array.isArray(data)) return nonceClasses.map(() => []);
    return data.map((row: any) => {
      if (!Array.isArray(row)) return [];
      return row.map((n: any) => {
        if (typeof n === "number") return n;
        if (typeof n === "object" && n !== null && "int" in n) return n.int;
        return parseInt(String(n), 10) || 0;
      }).filter((n: number) => n > 0);
    });
  } catch (err) {
    getLogger().error("URC_0025a_FilterNoncesByClasses failed:", err);
    return nonceClasses.map(() => []);
  }
}

export async function getCollectablesButtonState(
  account: string,
  dpdcId: string,
  isSFT: boolean,
  selectedNonces: number[],
): Promise<CollectablesButtonState | null> {
  try {
    const nonceList = `[${selectedNonces.join(" ")}]`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0026_CollectablesButtons "${account}" "${dpdcId}" ${isSFT} ${nonceList})`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (!response?.result || response.result.status === "failure") return null;
    const data = (response.result as any).data;
    if (!data || typeof data !== "object") return null;
    return data as CollectablesButtonState;
  } catch (err) {
    getLogger().error("URC_0026_CollectablesButtons failed:", err);
    return null;
  }
}
