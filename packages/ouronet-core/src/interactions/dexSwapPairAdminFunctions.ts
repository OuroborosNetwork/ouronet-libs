/**
 * dexSwapPairAdminFunctions.ts
 * Swap pair admin reads — module/principals/limits/management/branding (URC_0014-0015, BRD/DALOS reads).
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";

export async function describeModule(moduleName: string): Promise<string | null> {
  try {
    const fqn = moduleName.includes(".") ? moduleName : `${KADENA_NAMESPACE}.${moduleName}`;
    const response = await pactRead(`(describe-module "${fqn}")`, { tier: "T7" });
    if (response.result.status === "success") {
      const data = response.result.data as any;
      return data?.code || JSON.stringify(data);
    }
    return null;
  } catch (error) {
    getLogger().error("Error in describeModule:", error);
    return null;
  }
}

/** Fetch SWP principal tokens list */
export async function getSWPPrincipals(): Promise<string[]> {
  try {
    const res = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_Principals)`, { tier: "T7" });
    if (res.result.status === "failure") return [];
    return (Array.isArray(res.result.data) ? res.result.data : []) as string[];
  } catch (error) {
    getLogger().error("Error in getSWPPrincipals:", error);
    return [];
  }
}

/**
 * Fetch the current owner account of a SWP pair (Ouronet account string).
 *
 *   (ouronet-ns.SWP.UR_OwnerKonto <swpair>)
 *
 * Lightweight unprotected read — returns just the owner-konto string. Used
 * by the OuronetUI ChangeOwnership flow to decide which ghost address to
 * pre-fill in the new-owner field (must differ from the current owner so
 * the ghost-as-default execution path stays valid).
 */
export async function getSwpairOwnerKonto(swpair: string): Promise<string | null> {
  try {
    const res = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_OwnerKonto "${swpair}")`, { tier: "T5" });
    if (res.result.status === "failure") return null;
    const d = res.result.data;
    return d == null ? null : String(d);
  } catch (error) {
    getLogger().error("Error in getSwpairOwnerKonto:", error);
    return null;
  }
}

/**
 * Fetch the current `can-swap` (UI label "Swapping") flag for a SWP pair.
 *
 *   (ouronet-ns.SWP.UR_CanSwap <swpair>)
 *
 * Used by the OuronetUI ToggleSwapCapability flow to compute the
 * autonomous `toggle` argument (chain rejects same-value writes; only
 * allowed value is the inverse of current).
 */
export async function getSwpairCanSwap(swpair: string): Promise<boolean | null> {
  try {
    const res = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_CanSwap "${swpair}")`, { tier: "T5" });
    if (res.result.status === "failure") return null;
    const d = res.result.data;
    if (typeof d === "boolean") return d;
    if (d === "true") return true;
    if (d === "false") return false;
    return null;
  } catch (error) {
    getLogger().error("Error in getSwpairCanSwap:", error);
    return null;
  }
}

/**
 * Fetch the current `can-add` (UI label "Provisioning") flag for a SWP pair.
 *
 *   (ouronet-ns.SWP.UR_CanAdd <swpair>)
 *
 * Used by the OuronetUI ToggleAddLiquidity flow to compute the autonomous
 * `toggle` argument (same chain-rejects-same-value-writes constraint as
 * the other Toggle flows).
 */
export async function getSwpairCanAdd(swpair: string): Promise<boolean | null> {
  try {
    const res = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_CanAdd "${swpair}")`, { tier: "T5" });
    if (res.result.status === "failure") return null;
    const d = res.result.data;
    if (typeof d === "boolean") return d;
    if (d === "true") return true;
    if (d === "false") return false;
    return null;
  } catch (error) {
    getLogger().error("Error in getSwpairCanAdd:", error);
    return null;
  }
}

/**
 * Fetch the current `can-change-owner` flag for a SWP pair (boolean).
 *
 *   (ouronet-ns.SWP.UR_CanChangeOwner <swpair>)
 *
 * Lightweight unprotected read. Used by the OuronetUI ModifyCanChangeOwner
 * flow to compute the only-allowed `new-boolean` argument (the chain
 * rejects same-value writes, so `new-boolean` is always the inverse of the
 * current value — autonomous, never user-typed).
 */
export async function getSwpairCanChangeOwner(swpair: string): Promise<boolean | null> {
  try {
    const res = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_CanChangeOwner "${swpair}")`, { tier: "T5" });
    if (res.result.status === "failure") return null;
    const d = res.result.data;
    if (typeof d === "boolean") return d;
    if (d === "true") return true;
    if (d === "false") return false;
    return null;
  } catch (error) {
    getLogger().error("Error in getSwpairCanChangeOwner:", error);
    return null;
  }
}

/** Fetch SWP spawn limit (WSTOA minimum to create a pool) */
export async function getSWPSpawnLimit(): Promise<string | null> {
  try {
    const res = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_SpawnLimit)`, { tier: "T7" });
    if (res.result.status === "failure") return null;
    const d = res.result.data;
    return d && typeof d === "object" && (d as any).decimal ? (d as any).decimal : (d != null ? String(d) : null);
  } catch (error) {
    getLogger().error("Error in getSWPSpawnLimit:", error);
    return null;
  }
}

/** Fetch SWP inactive limit (WSTOA below which swap auto-deactivates) */
export async function getSWPInactiveLimit(): Promise<string | null> {
  try {
    const res = await pactRead(`(${KADENA_NAMESPACE}.SWP.UR_InactiveLimit)`, { tier: "T7" });
    if (res.result.status === "failure") return null;
    const d = res.result.data;
    return d && typeof d === "object" && (d as any).decimal ? (d as any).decimal : (d != null ? String(d) : null);
  } catch (error) {
    getLogger().error("Error in getSWPInactiveLimit:", error);
    return null;
  }
}

/**
 * Fetch management pool settings for a specific swap pair
 * URC_0014_SwpairManagementPoolSettings
 */
export async function getSwpairManagementPoolSettings(swpair: string): Promise<any> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0014_SwpairManagementPoolSettings "${swpair}")`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve pool settings from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Pool settings query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data;
  } catch (err) {
    getLogger().error("URC_0014 failed:", err);
    return null;
  }
}

/**
 * URC_0015_SwpairManagementFeeSettings
 * Returns fee configuration for a SWP pair: lock state, fee breakdown,
 * special fee targets (up to 7), and max available target slots.
 */
export async function getSwpairManagementFeeSettings(swpair: string): Promise<any> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0015_SwpairManagementFeeSettings "${swpair}")`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve fee settings from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Fee settings query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data;
  } catch (err) {
    getLogger().error("URC_0015 failed:", err);
    return null;
  }
}

/**
 * DALOS.UR_UsagePrice — Get the price for a usage type (e.g. "blue" for blue flag branding)
 * Returns the price in STOA
 */
export async function getUsagePrice(usageType: string): Promise<number | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DALOS.UR_UsagePrice "${usageType}")`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (response?.result?.status === "success") {
      const d = response.result.data;
      return typeof d === "number" ? d : (typeof d === "object" && (d as any)?.decimal ? parseFloat((d as any).decimal) : null);
    }
    return null;
  } catch (err) {
    getLogger().error(`UR_UsagePrice(${usageType}) failed:`, err);
    return null;
  }
}

/**
 * BRD.UR_Branding — Fetch branding properties for an entity
 * @param entityId - SWP pair ID or LP token ID
 * @param pending - true for pending branding, false for live branding
 */
export async function getBranding(entityId: string, pending: boolean): Promise<any> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.BRD.UR_Branding "${entityId}" ${pending})`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve branding from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Branding query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data;
  } catch (err) {
    getLogger().error(`BRD.UR_Branding(${entityId}, ${pending}) failed:`, err);
    return null;
  }
}
