/**
 * dexSwapPairCalcFunctions.ts
 * Swap pair calculation reads (URC_0006-0011 swap math, decimals, total fee).
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type {
  SwapCalculationResult,
  InverseSwapResult,
  CappedInverseResult,
  UserAccountSupplies,
} from "./dexTypes.js";

/**
 * Calculate direct swap output amounts
 *
 * Returns null on RPC failure (catch-and-return-null contract, v4.2.0).
 */
export async function calculateDirectSwap(
  account: string,
  swpair: string,
  inputIds: string[],
  inputAmounts: string[] | number[],
  outputId: string
): Promise<SwapCalculationResult | null> {
  try {

    // Format arrays for Pact with proper decimal formatting - keep as strings to preserve precision
    const pactInputIds = `[${inputIds.map(id => `"${id}"`).join(' ')}]`;
    const pactInputAmounts = `[${inputAmounts.map(amount => {
      const amountStr = typeof amount === 'string' ? amount : amount.toString();
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    }).join(' ')}]`;

    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0006_Swap "${account}" "${swpair}" ${pactInputIds} ${pactInputAmounts} "${outputId}")`;




    const response = await pactRead(pactCode, { tier: "T2" });


    if (!response || !response.result) {
      throw new Error("Failed to retrieve direct swap calculation from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Direct swap calculation failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;

    return data as SwapCalculationResult;

  } catch (error) {
    getLogger().error("Error in calculateDirectSwap:", error);
    return null;
  }
}

/**
 * Calculate reverse swap input amounts (user specifies desired output)
 *
 * Returns null on RPC failure (catch-and-return-null contract, v4.2.0).
 */
export async function calculateInverseSwap(
  account: string,
  swpair: string,
  outputId: string,
  outputAmount: number,
  inputId: string
): Promise<InverseSwapResult | null> {
  try {

    // Format outputAmount as decimal for Pact (e.g., 1 → "1.0")
    const outputAmountDecimal = outputAmount.toString().includes('.') ? outputAmount.toString() : `${outputAmount}.0`;

    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0007_InverseSwap "${account}" "${swpair}" "${outputId}" ${outputAmountDecimal} "${inputId}")`;

    const response = await pactRead(pactCode, { tier: "T2" });


    if (!response || !response.result) {
      throw new Error("Failed to retrieve inverse swap calculation from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Inverse swap calculation failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;

    return data as InverseSwapResult;

  } catch (error) {
    getLogger().error("Error in calculateInverseSwap:", error);
    return null;
  }
}

/**
 * URC_0006b — Direct swap calculation, returns numeric output amount directly
 *
 * Returns null on RPC failure (catch-and-return-null contract, v4.2.0).
 */
export async function calculateDirectSwapB(
  account: string,
  swpair: string,
  inputIds: string[],
  inputAmounts: string[] | number[],
  outputId: string
): Promise<{ decimal: string } | number | null> {
  try {
    const pactInputIds = `[${inputIds.map(id => `"${id}"`).join(' ')}]`;
    const pactInputAmounts = `[${inputAmounts.map(a => {
      const s = typeof a === 'string' ? a : a.toString();
      return s.includes('.') ? s : `${s}.0`;
    }).join(' ')}]`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0006b_DirectSwap "${account}" "${swpair}" ${pactInputIds} ${pactInputAmounts} "${outputId}")`;
    const response = await pactRead(pactCode, { tier: "T2" });
    if (!response?.result) throw new Error("No response");
    if (response.result.status === "failure") throw new Error(response.result.error?.message ?? "Failed");
    return response.result.data as any;
  } catch (error) {
    getLogger().error("Error in calculateDirectSwapB:", error);
    return null;
  }
}

/**
 * URC_0007b — Inverse swap calculation, returns numeric input amount directly
 *
 * Returns null on RPC failure (catch-and-return-null contract, v4.2.0).
 */
export async function calculateInverseSwapB(
  account: string,
  swpair: string,
  outputId: string,
  outputAmount: number,
  inputId: string
): Promise<{ decimal: string } | number | null> {
  try {
    const outDecimal = outputAmount.toString().includes('.') ? outputAmount.toString() : `${outputAmount}.0`;
    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0007b_InverseSwap "${account}" "${swpair}" "${outputId}" ${outDecimal} "${inputId}")`;
    const response = await pactRead(pactCode, { tier: "T2" });
    if (!response?.result) throw new Error("No response");
    if (response.result.status === "failure") throw new Error(response.result.error?.message ?? "Failed");
    return response.result.data as any;
  } catch (error) {
    getLogger().error("Error in calculateInverseSwapB:", error);
    return null;
  }
}

/**
 * Get maximum output amount for reverse swap (75% of token supply in pool)
 *
 * Returns null on RPC failure (catch-and-return-null contract, v4.2.0).
 */
export async function getCappedInverseAmount(
  swpair: string,
  outputId: string
): Promise<CappedInverseResult | null> {
  try {

    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0008_CappedInverse "${swpair}" "${outputId}")`;

    const response = await pactRead(pactCode, { tier: "T5" });


    if (!response || !response.result) {
      throw new Error("Failed to retrieve capped inverse amount from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Capped inverse query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;

    return data as CappedInverseResult;

  } catch (error) {
    getLogger().error("Error in getCappedInverseAmount:", error);
    return null;
  }
}

/**
 * Get user's token balances for all tokens in a specific swap pair
 *
 * Returns null on RPC failure (catch-and-return-null contract, v4.2.0).
 */
export async function getUserAccountSupplies(
  account: string,
  swpair: string
): Promise<UserAccountSupplies | null> {
  try {

    const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0011_AccountSuppliesForSwpair "${account}" "${swpair}")`;


    const response = await pactRead(pactCode, { tier: "T5" });



    if (!response || !response.result) {
      throw new Error("Failed to retrieve user account supplies from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`User account supplies query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;

    return data as UserAccountSupplies;

  } catch (error) {
    getLogger().error("Error in getUserAccountSupplies:", error);
    return null;
  }
}

/**
 * Fetch decimal precision for a DPTF token via DPTF.UR_Decimals
 * Returns the number of decimal places (e.g. 12 for high-precision tokens)
 */
export async function getTokenDecimals(tokenId: string): Promise<number | null> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.DPTF.UR_Decimals "${tokenId}")`, { tier: "T7" });
    if (!response || !response.result || response.result.status === "failure") {
      return null;
    }
    const data = response.result.data;
    if (typeof data === "number") {
      return Number.isFinite(data) ? data : null;
    }
    if (data && typeof data === "object") {
      if ("int" in data) {
        const n = parseInt((data as any).int, 10);
        return Number.isFinite(n) ? n : null;
      }
      if ("decimal" in data) {
        const n = parseInt((data as any).decimal, 10);
        return Number.isFinite(n) ? n : null;
      }
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getTokenDecimals:", error);
    return null;
  }
}

/**
 * Local helper to resolve Pact decimal/int/number values to JS number
 */
function resolvePactDecimalLocal(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "object") {
    if ("decimal" in val) return parseFloat(val.decimal);
    if ("int" in val) return parseInt(val.int, 10);
  }
  return parseFloat(String(val));
}

/**
 * Fetch total fee for a swap pair pool via SWP.URC_PoolTotalFee
 * Returns fee as a decimal fraction (e.g. 0.003 = 0.3%)
 */
export async function getPoolTotalFee(swpair: string): Promise<number | null> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.SWP.URC_PoolTotalFee "${swpair}")`, { tier: "T5" });
    if (response?.result?.status === "success") {
      const value = resolvePactDecimalLocal(response.result.data);
      return Number.isFinite(value) ? value : null;
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getPoolTotalFee:", error);
    return null;
  }
}
