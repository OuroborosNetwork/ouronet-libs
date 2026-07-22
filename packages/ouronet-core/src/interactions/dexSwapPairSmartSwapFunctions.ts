/**
 * dexSwapPairSmartSwapFunctions.ts
 * Smart-swap routing and multi-hop execution (URC_Hopper, SWPU.UDC_SpawnSmartSwapSlippageBounds, TS01-C3 SmartSwap).
 */

import {
  KADENA_CHAIN_ID,
  KADENA_NAMESPACE,
  STOA_AUTONOMIC_OURONETGASSTATION,
  KADENA_NETWORK,
} from "../constants/index.js";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import { getFailoverClient } from "@stoachain/stoa-core/network";
import { universalSignTransaction, fromKeypair } from "@stoachain/stoa-core/signing";
import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";
import { pactRead } from "@stoachain/stoa-core/reads";
import { safeCreationTime } from "@stoachain/stoa-core/pact";
import type {
  SmartSwapHopper,
  SmartSwapSlippageBounds,
  SmartSwapExecutionParams,
} from "./dexTypes.js";

/**
 * Fetch all tokens available across all pools via SWP.URC_AllPoolTokens
 */
export async function getAllPoolTokens(): Promise<string[]> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.SWP.URC_AllPoolTokens)`, { tier: "T7" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve pool tokens from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Pool tokens query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    const data = response.result.data;
    return Array.isArray(data) ? (data as string[]) : [];
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Preview a smart swap via SWPI.URC_Hopper
 */
export async function getSmartSwapHopper(
  inputId: string,
  outputId: string,
  inputAmount: string | number
): Promise<SmartSwapHopper | null> {
  try {
    const amountStr = typeof inputAmount === "string" ? inputAmount : inputAmount.toString();
    const amountDecimal = amountStr.includes(".") ? amountStr : `${amountStr}.0`;

    const pactCode = `(${KADENA_NAMESPACE}.SWPI.URC_Hopper "${inputId}" "${outputId}" ${amountDecimal})`;

    const response = await pactRead(pactCode, { tier: "T2" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve smart swap hopper from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Smart swap hopper query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data as SmartSwapHopper;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Get slippage bounds for a smart swap via SWPU.UDC_SpawnSmartSwapSlippageBounds
 */
export async function getSmartSwapSlippageBounds(
  inputId: string,
  inputAmount: string | number,
  outputId: string,
  slippage: number
): Promise<SmartSwapSlippageBounds> {
  try {
    const amountStr = typeof inputAmount === "string" ? inputAmount : inputAmount.toString();
    const amountDecimal = amountStr.includes(".") ? amountStr : `${amountStr}.0`;
    const slippageStr = slippage.toString();
    const slippageDecimal = slippageStr.includes(".") ? slippageStr : `${slippageStr}.0`;

    const pactCode = `(${KADENA_NAMESPACE}.SWPU.UDC_SpawnSmartSwapSlippageBounds "${inputId}" ${amountDecimal} "${outputId}" ${slippageDecimal})`;

    const response = await pactRead(pactCode, { tier: "T2" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve smart swap slippage bounds.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Smart swap slippage bounds failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data as SmartSwapSlippageBounds;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Execute a smart swap with slippage protection
 */
export async function executeSmartSwapWithSlippage(
  params: SmartSwapExecutionParams
): Promise<any> {
  try {
    const amountStr = typeof params.inputAmount === "string" ? params.inputAmount : params.inputAmount.toString();
    const amountDecimal = amountStr.includes(".") ? amountStr : `${amountStr}.0`;
    const slippage = params.slippage ?? 5;

    // Fetch slippage bounds before executing
    const slippageObj = await getSmartSwapSlippageBounds(
      params.inputId,
      amountDecimal,
      params.outputId,
      slippage
    );

    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_SmartSwapWithSlippage "${params.patronKeypair.address}" "${params.account}" "${params.inputId}" ${amountDecimal} "${params.outputId}" (read-msg 'slippage-bounds))`;

    const gasLimit = 1_500_000;

    const buildTx = (gasLimitOverride?: number) =>
      Pact.builder
        .execution(pactCode)
        .addData("ks", {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .addData("slippage-bounds", slippageObj as any)
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride ?? gasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" }
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

    const simulation = await dirtyRead(buildTx());
    if (simulation.result.status === "failure") {
      throw new Error(`Smart swap simulation failed: ${simulation.result.error?.message || "Unknown error"}`);
    }

    const finalGas = simulation.gas ? calculateAutoGasLimit(simulation.gas) : gasLimit;
    const tx = buildTx(finalGas);

    const signedTx: any = await universalSignTransaction(tx, [
      fromKeypair(params.kadenaKeypair),
      fromKeypair(params.guardKeypair),
    ]);
    return await submit(signedTx);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Execute a smart swap without slippage protection
 */
export async function executeSmartSwapNoSlippage(
  params: SmartSwapExecutionParams
): Promise<any> {
  try {
    const amountStr = typeof params.inputAmount === "string" ? params.inputAmount : params.inputAmount.toString();
    const amountDecimal = amountStr.includes(".") ? amountStr : `${amountStr}.0`;

    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_SmartSwapNoSlippage "${params.patronKeypair.address}" "${params.account}" "${params.inputId}" ${amountDecimal} "${params.outputId}")`;

    const gasLimit = 1_500_000;

    const buildTx = (gasLimitOverride?: number) =>
      Pact.builder
        .execution(pactCode)
        .addData("ks", {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride ?? gasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" }
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

    const simulation = await dirtyRead(buildTx());
    if (simulation.result.status === "failure") {
      throw new Error(`Smart swap simulation failed: ${simulation.result.error?.message || "Unknown error"}`);
    }

    const finalGas = simulation.gas ? calculateAutoGasLimit(simulation.gas) : gasLimit;
    const tx = buildTx(finalGas);

    const signedTx: any = await universalSignTransaction(tx, [
      fromKeypair(params.kadenaKeypair),
      fromKeypair(params.guardKeypair),
    ]);
    return await submit(signedTx);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}
