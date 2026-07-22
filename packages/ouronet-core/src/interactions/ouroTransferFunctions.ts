/**
 * ouroTransferFunctions.ts
 * Single-token DPTF transfer execution via TS01-C1.DPTF|C_Transfer.
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
import type { IOuroAccountKeypair } from "./ouroTypes.js";

// Single Token Transfer
// (namespace.TS01-C1.DPTF|C_Transfer patron id sender receiver transfer-amount method)
export async function transferToken(
  patronAccount: IOuroAccountKeypair, // The patron account (owner)
  tokenId: string, // Token ID
  senderAccount: string, // Sender Ouro address (usually same as patron)
  receiverAccount: string, // Receiver Ouro address
  transferAmount: string, // Amount to transfer
  method: boolean, // false for standard accounts, true for smart accounts
  kadenaAccount: IKadenaKeypair, // The kadena account (payer)
  guardAccount: IKadenaKeypair // The guard account from the Ouro account
) {
  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(transferAmount);

  let gasLimit = 2_000_000; // Default gas limit for transfer operation

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C1.DPTF|C_Transfer "${patronAccount.address}" "${tokenId}" "${senderAccount}" "${receiverAccount}" ${decimalAmount} ${method})`)
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
      .addSigner(guardAccount.publicKey)
      .createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

  // First do a simulation to check gas
  let transaction = buildTransaction();
  let simulation = await dirtyRead(transaction);


  // Check if simulation failed due to gas limit exceeded
  if (simulation.result.status === "failure") {
    const errorMessage = simulation.result.error?.message || "";

    // Check if it's a gas limit exceeded error
    if (errorMessage.includes("Gas limit") && errorMessage.includes("exceeded")) {
      // Extract the required gas from error message or use a higher limit
      const gasMatch = errorMessage.match(/exceeded:\s*(\d+)/);
      if (gasMatch) {
        const requiredGas = parseInt(gasMatch[1]);
        gasLimit = calculateAutoGasLimit(requiredGas); // 20% buffer

        // Rebuild and retry simulation with higher gas limit
        transaction = buildTransaction(gasLimit);
        simulation = await dirtyRead(transaction);

      } else {
        // If we can't extract exact gas, increase by 50%
        gasLimit = Math.ceil(gasLimit * 1.5);

        transaction = buildTransaction(gasLimit);
        simulation = await dirtyRead(transaction);
      }
    }

    // If still failing after retry, throw error
    if (simulation.result.status === "failure") {
      const finalErrorMessage = simulation.result.error?.message || "Transaction simulation failed";
      throw new Error(`Simulation failed: ${finalErrorMessage}`);
    }
  }

  // Check if we need to adjust gas limit further (normal case)
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
