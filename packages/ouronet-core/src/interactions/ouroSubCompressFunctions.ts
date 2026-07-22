/**
 * ouroSubCompressFunctions.ts
 * Sublimate (OURO -> IGNIS) and compress (IGNIS -> OURO) execution + preview/info reads.
 */

import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";
import {
  KADENA_CHAIN_ID,
  KADENA_NAMESPACE, STOA_AUTONOMIC_OURONETGASSTATION,
  KADENA_NETWORK,
} from "../constants/index.js";
import { safeCreationTime, formatDecimalForPact } from "@stoachain/stoa-core/pact";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import { getFailoverClient } from "@stoachain/stoa-core/network";
import { universalSignTransaction, fromKeypair } from "@stoachain/stoa-core/signing";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { createSigningError, createSimulationError, logDetailedError } from "@stoachain/stoa-core/errors";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type { IOuroAccountKeypair } from "./ouroTypes.js";

// Ouro to Ignis
// (namespace.T201-C2.ORBR|C_Sublimate client target ouro-amount)
export async function sublimateOuroToIgnis(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  targetAccount: string,
  ouroAmount: string
) {
  const keysetName = `ks`;

  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(ouroAmount);

  let gasLimit = 2_000_000; // Default gas limit

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.ORBR|C_Sublimate "${ouroAccount.address}" "${targetAccount}" ${decimalAmount})`)
      .addData(keysetName, {
        keys: [guard.publicKey],
        pred: "keys-all",
      })
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
        chainId: KADENA_CHAIN_ID,
        gasLimit: gasLimitOverride || gasLimit,
      })
      .setNetworkId(KADENA_NETWORK)
      .addSigner(kadenaAccount.publicKey, (withCapability: any) => [
        withCapability(
          `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
          "",
          { int: 0 },
          { decimal: "0.0" },
        ),
      ])
      .addSigner(guard.publicKey)
      .createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

  // First do a simulation to check gas
  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);

  // Check if simulation failed
  if (simulation.result.status === "failure") {
    const error = createSimulationError(
      "OURO to IGNIS sublimation",
      simulation.result,
      `Amount: ${decimalAmount} OURO → Target: ${targetAccount}`
    );
    logDetailedError(error);
    throw error;
  }

  // Check if we need to adjust gas limit
  const requiredGas = simulation.gas;
  if (requiredGas && requiredGas > gasLimit) {
    // Rebuild transaction with adjusted gas limit (20% buffer)
    gasLimit = calculateAutoGasLimit(requiredGas);
    transaction = buildTransaction(gasLimit);
  }

  // Sign the transaction with both keypairs
  try {
    const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(kadenaAccount),
    fromKeypair(guard),
  ]);

    // Submit the signed transaction
    const result = await submit(signedTransaction);

    return result;
  } catch (originalError) {
    const error = createSigningError(
      "OURO to IGNIS sublimation",
      originalError,
      `Signers: ${kadenaAccount.publicKey.slice(0, 8)}... (payer), ${guard.publicKey.slice(0, 8)}... (guard)`
    );
    logDetailedError(error);
    throw error;
  }
}

// Ignis to Ouro is mainly the same as sublimateOuroToIgnis but has no target
// ORBR|C_Compress:decimal (client:string ignis-amount:decimal)
export async function compressIgnisToOuro(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  ignisAmount: string
) {
  const keysetName = `ks`;

  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(ignisAmount);

  let gasLimit = 2_000_000; // Default gas limit

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.ORBR|C_Compress "${ouroAccount.address}" ${decimalAmount})`)
      .addData(keysetName, {
        keys: [guard.publicKey],
        pred: "keys-all",
      })
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
        chainId: KADENA_CHAIN_ID,
        gasLimit: gasLimitOverride || gasLimit,
      })
      .setNetworkId(KADENA_NETWORK)
      .addSigner(kadenaAccount.publicKey, (withCapability: any) => [
        withCapability(
          `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
          "",
          { int: 0 },
          { decimal: "0.0" },
        ),
      ])
      .addSigner(guard.publicKey)
      .createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

  // First do a simulation to check gas
  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);


  // Check if simulation failed
  if (simulation.result.status === "failure") {
    const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
    throw new Error(`Simulation failed: ${errorMessage}`);
  }

  // Check if we need to adjust gas limit
  const requiredGas = simulation.gas;
  if (requiredGas && requiredGas > gasLimit) {
    // Rebuild transaction with adjusted gas limit (20% buffer)
    gasLimit = calculateAutoGasLimit(requiredGas);
    transaction = buildTransaction(gasLimit);
  }

  // Sign the transaction with both keypairs
  const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(kadenaAccount),
    fromKeypair(guard),
  ]);

  // Submit the signed transaction
  const result = await submit(signedTransaction);

  return result;
}

// Get IGNIS generation preview for sublimation
// (namespace.OUROBOROS.URC_Sublimate ouro-amount)
export async function getSublimatPreview(
  ouroAmount: string
): Promise<{ ignis: number; fee: number } | null> {
  try {
    const decimalAmount = formatDecimalForPact(ouroAmount);

    const response = await pactRead(`(${KADENA_NAMESPACE}.OUROBOROS.URC_Sublimate (at 0 (${KADENA_NAMESPACE}.U|ATS.UC_PromilleSplit 10.0 ${decimalAmount} 24)))`, { tier: "T2" });

    if (!response || !response.result || response.result.status === "failure") {
      return null;
    }

    const data = response.result.data as any;
    return {
      ignis: data,
      fee: 0,
    };
  } catch (error) {
    getLogger().error("Error getting sublimate preview:", error);
    return null;
  }
}

// getCompressPreview
// (at 0 (ouronet-ns.OUROBOROS.URC_Compress ignis-amount))
export async function getCompressPreview(
  ignisAmount: string
): Promise<{ ouro: number; fee: number } | null> {
  try {
    const decimalAmount = formatDecimalForPact(ignisAmount);

    const response = await pactRead(`(at 0 (${KADENA_NAMESPACE}.OUROBOROS.URC_Compress ${decimalAmount}))`, { tier: "T2" });

    if (!response || !response.result || response.result.status === "failure") {
      return null;
    }

    const data = response.result.data as any;
    if (!data?.decimal) {
      return null;
    }

    return {
      ouro: parseFloat(data.decimal),
      fee: 0,
    };
  } catch (error) {
    getLogger().error("Error getting compress preview:", error);
    return null;
  }
}

/**
 * @deprecated Use `getSublimateInfo` from `@ouronet/ouronet-core/interactions/infoOneFunctions` instead.
 * This compat shim accepts the legacy (patron, resident, amount-as-string) signature and forwards to the canonical
 * (client, target, amount-as-number) form. Will be removed in v4.2.0.
 */
export async function getSublimateInfo(
  a: string,
  b: string,
  c: string | number
): Promise<any> {
  const { getSublimateInfo: canonical } = await import("./infoOneFunctions");
  return canonical(a, b, typeof c === "string" ? Number(c) : c);
}

export async function getCompressInfo(
  client: string,
  amount: string
): Promise<any | null> {
  try {
    const decimalAmount = formatDecimalForPact(amount);
    const pactCode = `(${KADENA_NAMESPACE}.INFO-ONE.ORBR|INFO_Compress "${client}" ${decimalAmount})`;
    const response = await pactRead(pactCode, { tier: "T2" });
    if (response?.result?.status === "success") return (response.result as any).data;
    return null;
  } catch (error) {
    getLogger().error("Error in getCompressInfo:", error);
    return null;
  }
}
