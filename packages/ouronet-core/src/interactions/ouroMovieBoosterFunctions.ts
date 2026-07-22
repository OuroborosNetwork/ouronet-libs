/**
 * ouroMovieBoosterFunctions.ts
 * Sparks balance / movie-booster purchase / firestarter execution + max-buy probe.
 */

import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";
import {
  KADENA_CHAIN_ID,
  KADENA_NAMESPACE, STOA_AUTONOMIC_OURONETGASSTATION,
  KADENA_NETWORK,
} from "../constants/index.js";
import { safeCreationTime } from "@stoachain/stoa-core/pact";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import { getFailoverClient } from "@stoachain/stoa-core/network";
import { universalSignTransaction, fromKeypair } from "@stoachain/stoa-core/signing";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type { IOuroAccountKeypair } from "./ouroTypes.js";

// (ouronet-ns.MB.URC_TotalMBCost sparks)
export async function getTotalMBCost(sparks: number): Promise<string | null> {
  try {
    const integerSparks = Math.floor(sparks);

    const response = await pactRead(`(${KADENA_NAMESPACE}.MB.URC_TotalMBCost ${integerSparks})`, { tier: "T5" });

    if (!response || !response.result || response.result.status === "failure") {
      return null;
    }

    return (response.result.data as any);
  } catch (error) {
    getLogger().error("Error getting total MB cost:", error);
    return null;
  }
}

// (ouronet-ns.MB.C_MovieBoosterBuyer patron:string buyer:string mb-amount:integer iz-native:bool)
export async function movieBoosterBuy(
  patronAccount: IOuroAccountKeypair, // The patron account (owner)
  buyerAccount: string, // Buyer Ouro address (usually same as patron)
  mbAmount: number, // Amount of SPARK tokens to buy (integer)
  isNative: boolean, // true for KDA, false for WSTOA
  kadenaAccount: IKadenaKeypair, // The kadena account (payer)
  guardAccount: IKadenaKeypair // The guard account from the Ouro account
) {
  const keysetName = `ks`;

  // Ensure amount is integer
  const integerAmount = Math.floor(mbAmount);
  const kadenaCost = await getTotalMBCost(integerAmount);

  let gasLimit = 2_000_000; // Default gas limit for movie booster buy

  const buildTransaction = (gasLimitOverride?: number) => {
    const txBuilder = Pact.builder
      .execution(`(${KADENA_NAMESPACE}.MB.C_MovieBoosterBuyer "${patronAccount.address}" "${buyerAccount}" ${integerAmount} ${isNative})`)
      .addData(keysetName, {
        keys: [guardAccount.publicKey],
        pred: "keys-all",
      })
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
        chainId: KADENA_CHAIN_ID,
        gasLimit: gasLimitOverride || gasLimit,
      })
      .setNetworkId(KADENA_NETWORK)
      .addSigner(kadenaAccount.publicKey, (withCapability: any) => {
        const capabilities: any[] = [
          withCapability(
            `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
            "",
            { int: 0 },
            { decimal: "0.0" },
          ),
        ];

        // If paying with native KDA, add coin.TRANSFER capability
        if (isNative) {
          // We'll need to calculate the KDA amount based on SPARK price
          // For now, we'll use a placeholder that will be replaced after simulation
          capabilities.push(
            withCapability(
              "coin.TRANSFER",
              `k:${kadenaAccount.publicKey}`,
              STOA_AUTONOMIC_OURONETGASSTATION,
              { decimal: `${kadenaCost}` } // This will be updated after simulation
            )
          );
        }

        return capabilities;
      })
      .addSigner(guardAccount.publicKey);

    return txBuilder.createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

  // First do a simulation to check gas and get the actual KDA amount if native
  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);


  // Check if simulation failed
  if (simulation.result.status === "failure") {
    const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
    throw new Error(`Simulation failed: ${errorMessage}`);
  }

  if (isNative && simulation.result.data) {

    if (kadenaCost && parseFloat(kadenaCost) <= 0) {
      throw new Error("Invalid KDA amount required for purchase");
    }

    // Rebuild transaction with correct KDA amount
    transaction = Pact.builder
      .execution(`(${KADENA_NAMESPACE}.MB.C_MovieBoosterBuyer "${patronAccount.address}" "${buyerAccount}" ${integerAmount} ${isNative})`)
      .addData(keysetName, {
        keys: [guardAccount.publicKey],
        pred: "keys-all",
      })
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
        chainId: KADENA_CHAIN_ID,
        gasLimit: gasLimit,
      })
      .setNetworkId(KADENA_NETWORK)
      .addSigner(kadenaAccount.publicKey, (withCapability: any) => [
        withCapability(
          `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
          "",
          { int: 0 },
          { decimal: "0.0" },
        ),
        withCapability(
          "coin.TRANSFER",
          `k:${kadenaAccount.publicKey}`,
          STOA_AUTONOMIC_OURONETGASSTATION,
          { decimal: `${kadenaCost}` }
        ),
      ])
      .addSigner(guardAccount.publicKey)
      .createTransaction();
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
    fromKeypair(guardAccount),
  ]);

  // Submit the signed transaction
  const result = await submit(signedTransaction);

  return result;
}

export async function getMaxBuyMovieBooster(
  account: string,
  native: boolean
): Promise<number | null> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.MB.URC_GetMaxBuy "${account}" ${native})`, { tier: "T5" });

    if (!response || !response.result || response.result.status === "failure") {
      return null;
    }

    const data = response.result.data as any;
    const value = Number(data?.int);
    return Number.isFinite(value) ? value : null;
  } catch (error) {
    getLogger().error("Error getting max buy for movie booster:", error);
    return null;
  }
}


export async function getSparksBalance(account: string): Promise<any | null> {
  try {
    const response = await pactRead(`(${KADENA_NAMESPACE}.MB.UR_Sparks "${account}")`, { tier: "T5" });

    if (!response || !response.result || response.result.status === "failure") {
      return null;
    }

    return response.result.data as any;
  } catch (error) {
    getLogger().error("Error getting sparks balance:", error);
    return null;
  }
}

// (ouronet-ns.TS01-C2.SWP|C_Firestarter ouro-account:string)
export async function firestarter(
  ouroAccount: IOuroAccountKeypair, // Ouro account that will receive the IGNIS
  kadenaAccount: IKadenaKeypair, // The kadena account that will transfer KDA
  guardAccount: IKadenaKeypair // The guard account from the Ouro account
) {
  const keysetName = `ks`;

  // Fixed amount of 10 KDA
  const kdaAmount = "10.0";

  let gasLimit = 2_000_000; // Default gas limit for firestarter operation

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C3.SWP|C_Firestarter "${ouroAccount.address}")`)
      .addData(keysetName, {
        keys: [guardAccount.publicKey],
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
        withCapability(
          "coin.TRANSFER",
          `k:${kadenaAccount.publicKey}`,
          STOA_AUTONOMIC_OURONETGASSTATION,
          { decimal: kdaAmount }
        ),
      ])
      .addSigner(guardAccount.publicKey)
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
    fromKeypair(guardAccount),
  ]);

  // Submit the signed transaction
  const result = await submit(signedTransaction);

  return result;
}
