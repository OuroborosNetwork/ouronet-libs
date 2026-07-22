/**
 * dexSwapPairExecuteFunctions.ts
 * Swap pair execution (single/multi pool, with/without slippage protection — TS01-C3 module).
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
import { getLogger } from "@stoachain/stoa-core/observability";
import type { SwapExecutionParams, SlippageBounds } from "./dexTypes.js";

/**
 * Fetch slippage bounds object for a swap via dirtyRead.
 * Must be called before executing a swap with slippage protection.
 */
export async function getSlippageBounds(
  swpair: string,
  inputIds: string[],
  inputAmounts: (string | number)[],
  outputId: string,
  slippage: number
): Promise<SlippageBounds> {
  try {
    const pactInputIds = `[${inputIds.map(id => `"${id}"`).join(' ')}]`;
    const pactInputAmounts = `[${inputAmounts.map(amount => {
      const amountStr = typeof amount === 'string' ? amount : amount.toString();
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    }).join(' ')}]`;
    const slippageStr = slippage.toString();
    const slippageDecimal = slippageStr.includes('.') ? slippageStr : `${slippageStr}.0`;

    const pactCode = `(${KADENA_NAMESPACE}.SWPU.UDC_SpawnSlippageBounds "${swpair}" ${pactInputIds} ${pactInputAmounts} "${outputId}" ${slippageDecimal})`;

    const response = await pactRead(pactCode, { tier: "T2" });

    if (!response || !response.result) {
      throw new Error("Failed to retrieve slippage bounds from the transaction.");
    }

    if (response.result.status === "failure") {
      throw new Error(`Slippage bounds query failed: ${response.result.error?.message || "Unknown error"}`);
    }

    return response.result.data as SlippageBounds;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred fetching slippage bounds");
  }
}

/**
 * Execute single swap with slippage protection
 */
export async function executeSingleSwapWithSlippage(
  params: SwapExecutionParams & { inputId: string; inputAmount: string | number; slippage: number }
): Promise<any> {
  try {

    // Format numbers as decimals for Pact (preserve exact user input, just ensure decimal format)
    const inputAmountStr = typeof params.inputAmount === 'string' ? params.inputAmount : params.inputAmount.toString();
    const inputAmountDecimal = inputAmountStr.includes('.') ? inputAmountStr : `${inputAmountStr}.0`;

    // Fetch slippage bounds object from chain before executing
    const slippageBoundsObj = await getSlippageBounds(
      params.swpair,
      [params.inputId],
      [inputAmountDecimal],
      params.outputId,
      params.slippage
    );

    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_SingleSwapWithSlippage "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" "${params.inputId}" ${inputAmountDecimal} "${params.outputId}" (read-msg 'slippage-bounds))`;

    // Create keyset name for the guard (following OURO pattern)
    const keysetName = `ks`;

    let gasLimit = 100_000; // Default gas limit for swap execution (under block limit)

    // Build transaction function
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .addData('slippage-bounds', slippageBoundsObj as any)
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride || gasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

    // First do a simulation to check gas
    let transaction = buildTransaction();
    const simulation = await dirtyRead(transaction);



    // Check if simulation failed
    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Single swap execution failed: ${errorMessage}`);
    }

    // Apply adaptive gas limit from simulation
    const requiredGas = simulation.gas;
    if (requiredGas) {
      // Rebuild with adaptive gas limit
      gasLimit = calculateAutoGasLimit(requiredGas);

      transaction = buildTransaction(gasLimit);
    }

    // Sign the transaction with both keypairs
    const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(params.kadenaKeypair),
    fromKeypair(params.guardKeypair),
  ]);

    // Submit the signed transaction
    const result = await submit(signedTransaction);



    return result;

  } catch (error) {
    getLogger().error("Single Swap WITH Slippage Error:", error);
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Execute single swap without slippage protection
 */
export async function executeSingleSwapNoSlippage(
  params: SwapExecutionParams & { inputId: string; inputAmount: string | number }
): Promise<any> {
  try {


    // Format numbers as decimals for Pact (preserve exact user input, just ensure decimal format)
    const inputAmountStr = typeof params.inputAmount === 'string' ? params.inputAmount : params.inputAmount.toString();
    const inputAmountDecimal = inputAmountStr.includes('.') ? inputAmountStr : `${inputAmountStr}.0`;

    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_SingleSwapNoSlippage "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" "${params.inputId}" ${inputAmountDecimal} "${params.outputId}")`;



    // Create keyset name for the guard (following OURO pattern)
    const keysetName = `ks`;

    let gasLimit = 140_000; // Default gas limit for swap execution

    // Build transaction function
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride || gasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

    // First do a simulation to check gas
    let transaction = buildTransaction();
    const simulation = await dirtyRead(transaction);



    // Check if simulation failed
    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Single swap execution failed: ${errorMessage}`);
    }

    // Apply adaptive gas limit from simulation
    const requiredGas = simulation.gas;
    if (requiredGas) {
      // Rebuild with adaptive gas limit
      gasLimit = calculateAutoGasLimit(requiredGas);

      transaction = buildTransaction(gasLimit);
    }

    // Sign the transaction with both keypairs
    const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(params.kadenaKeypair),
    fromKeypair(params.guardKeypair),
  ]);

    // Submit the signed transaction
    const result = await submit(signedTransaction);

    return result;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Execute multi-token swap with slippage protection
 */
export async function executeMultiSwapWithSlippage(
  params: SwapExecutionParams & { inputIds: string[]; inputAmounts: (string | number)[]; slippage: number }
): Promise<any> {
  try {

    // Format arrays for Pact with decimals (preserve exact user input as strings)
    const pactInputIds = `[${params.inputIds.map(id => `"${id}"`).join(' ')}]`;
    const formattedAmounts = params.inputAmounts.map(amount => {
      const amountStr = typeof amount === 'string' ? amount : amount.toString();
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    });
    const pactInputAmounts = `[${formattedAmounts.join(' ')}]`;

    // Fetch slippage bounds object from chain before executing
    const slippageBoundsObj = await getSlippageBounds(
      params.swpair,
      params.inputIds,
      formattedAmounts,
      params.outputId,
      params.slippage
    );

    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_MultiSwapWithSlippage "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" ${pactInputIds} ${pactInputAmounts} "${params.outputId}" (read-msg 'slippage-bounds))`;

    // Create keyset name for the guard (following OURO pattern)
    const keysetName = `ks`;

    let gasLimit = 120_000; // Default gas limit for multi-swap execution (under block limit)

    // Build transaction function
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .addData('slippage-bounds', slippageBoundsObj as any)
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride || gasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

    // First do a simulation to check gas
    let transaction = buildTransaction();
    const simulation = await dirtyRead(transaction);


    // Check if simulation failed
    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Multi swap execution failed: ${errorMessage}`);
    }

    // Apply adaptive gas limit from simulation
    const requiredGas = simulation.gas;
    if (requiredGas) {
      // Rebuild with adaptive gas limit
      gasLimit = calculateAutoGasLimit(requiredGas);

      transaction = buildTransaction(gasLimit);
    }

    // Sign the transaction with both keypairs
    const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(params.kadenaKeypair),
    fromKeypair(params.guardKeypair),
  ]);

    // Submit the signed transaction
    const result = await submit(signedTransaction);


    return result;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

/**
 * Execute multi-token swap without slippage protection
 */
export async function executeMultiSwapNoSlippage(
  params: SwapExecutionParams & { inputIds: string[]; inputAmounts: (string | number)[] }
): Promise<any> {
  try {


    // Format arrays for Pact with decimals (preserve exact user input as strings)
    const pactInputIds = `[${params.inputIds.map(id => `"${id}"`).join(' ')}]`;
    const pactInputAmounts = `[${params.inputAmounts.map(amount => {
      const amountStr = typeof amount === 'string' ? amount : amount.toString();
      return amountStr.includes('.') ? amountStr : `${amountStr}.0`;
    }).join(' ')}]`;

    const pactCode = `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_MultiSwapNoSlippage "${params.patronKeypair.address}" "${params.account}" "${params.swpair}" ${pactInputIds} ${pactInputAmounts} "${params.outputId}")`;



    // Create keyset name for the guard (following OURO pattern)
    const keysetName = `ks`;

    let gasLimit = 120_000; // Default gas limit for multi-swap execution (under block limit)

    // Build transaction function
    const buildTransaction = (gasLimitOverride?: number) => {
      return Pact.builder
        .execution(pactCode)
        .addData(keysetName, {
          keys: [params.guardKeypair.publicKey],
          pred: "keys-all",
        })
        .setMeta({
          senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
          chainId: KADENA_CHAIN_ID,
          gasLimit: gasLimitOverride || gasLimit,
        })
        .setNetworkId(KADENA_NETWORK)
        .addSigner(params.kadenaKeypair.publicKey, (withCapability: any) => [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ])
        .addSigner(params.guardKeypair.publicKey)
        .createTransaction();
    };

    const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

    // First do a simulation to check gas
    let transaction = buildTransaction();
    const simulation = await dirtyRead(transaction);


    // Check if simulation failed
    if (simulation.result.status === "failure") {
      const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Multi swap execution failed: ${errorMessage}`);
    }

    // Apply adaptive gas limit from simulation
    const requiredGas = simulation.gas;
    if (requiredGas) {
      // Rebuild with adaptive gas limit
      gasLimit = calculateAutoGasLimit(requiredGas);

      transaction = buildTransaction(gasLimit);
    }

    // Sign the transaction with both keypairs
    const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(params.kadenaKeypair),
    fromKeypair(params.guardKeypair),
  ]);

    // Submit the signed transaction
    const result = await submit(signedTransaction);


    return result;

  } catch (error) {
    throw error instanceof Error ? error : new Error("Unknown error occurred");
  }
}
