/**
 * ouroCoilFunctions.ts
 * OURO-specific coil/curl execution + verbatim tail-block re-exports of the broader
 * coil/pension/info-one preview surface (locked here because the original tail-block
 * comment "Export new coiling functions for AURYN and WSTOA" places them in the coil domain).
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
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type { IOuroAccountKeypair } from "./ouroTypes.js";

// Get AURYN generation preview for coiling OURO
export async function getCoilPreview(
  ouroAmount: string
): Promise<{
  auryn: number;
  fee: number;
  kadenaInfo: {
    text: string;
    discount: number;
    full: number;
    need: number;
  };
  ignisInfo: {
    text: string;
    discount: number;
    full: number;
    need: number;
  };
  preText: string[];
  postText: string[];
} | null> {
  try {
    const decimalAmount = formatDecimalForPact(ouroAmount);

    const response = await pactRead(`(${KADENA_NAMESPACE}.INFO-ONE.ATS|INFO_Coil "preview" "preview" "Auryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" ${decimalAmount})`, { tier: "T2" });

    if (!response || !response.result || response.result.status === "failure") {
      // v3.3.0 (closes part of F-LOGGER-SEAM-001): routed through getLogger().warn
      // — failure context is operationally useful, kept at warn-level so
      // structured-logger consumers (HUB pino, OuronetUI Sentry) capture it.
      getLogger().warn("Coil preview failed:", response?.result);
      return null;
    }

    const data = response.result.data as any;
    // v3.3.0: removed `console.log("Coil preview response data:", data)`
    // — pure debug-only data dump on the success path, no operational
    // value beyond developer trace. Matches the F-LOGGER-SEAM-001
    // validator's "should be removed" classification for debug-leak sites.

    // Extract AURYN amount from text arrays
    let aurynAmount = 0;

    // Check pre-text array for AURYN amount
    if (data && data['pre-text']) {
      for (const text of data['pre-text']) {
        const aurynMatch = text.match(/generates\s+([\d.]+)\s+AURYN/);
        if (aurynMatch) {
          aurynAmount = parseFloat(aurynMatch[1]);
          break;
        }
      }
    }

    // Fallback: check post-text array
    if (!aurynAmount && data && data['post-text']) {
      for (const text of data['post-text']) {
        const aurynMatch = text.match(/generating\s+([\d.]+)\s+AURYN/);
        if (aurynMatch) {
          aurynAmount = parseFloat(aurynMatch[1]);
          break;
        }
      }
    }

    // Return rich data structure
    return {
      auryn: aurynAmount,
      fee: 0,
      kadenaInfo: {
        text: data?.kadena?.[`kadena-text`] || "Kadena fee information not available",
        discount: data?.kadena?.[`kadena-discount`] || 1,
        full: data?.kadena?.[`kadena-full`] || 0,
        need: data?.kadena?.[`kadena-need`] || 0,
      },
      ignisInfo: {
        text: data?.ignis?.[`ignis-text`] || "IGNIS fee information not available",
        discount: data?.ignis?.[`ignis-discount`] || 1,
        full: data?.ignis?.[`ignis-full`] || 0,
        need: data?.ignis?.[`ignis-need`] || 0,
      },
      preText: data?.[`pre-text`] || [],
      postText: data?.[`post-text`] || [],
    };
  } catch (error) {
    getLogger().error("Error getting coil preview:", error);
    return null;
  }
}

// Curl OURO to Elite AURYN
// (namespace.TS01-C2.ATS|C_Curl patron:string curler:string "Auryndex-O136CBn22ncY" "EliteAuryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" amount:decimal)
export async function curlOuroToEliteAuryn(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  targetAccount: string, // The account that will receive the Elite AURYN (same as patron per client explanation)
  ouroAmount: string
) {
  const keysetName = `ks`;

  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(ouroAmount);

  let gasLimit = 2_000_000; // Default gas limit


  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Curl "${ouroAccount.address}" "${targetAccount}" "Auryndex-O136CBn22ncY" "EliteAuryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" ${decimalAmount})`)
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

// Export new coiling functions for AURYN and WSTOA
export {
  getAurynCoilPreview,
  coilAurynToElite,
  getWkdaCoilPreview,
  coilWkdaToLkda,
  COIL_CONFIGS
} from "./coilFunctions.js";

// Export pension functions for WSTOA and SSTOA
export {
  brumateWkdaToPkda,
  constrictLkdaToPkda
} from "./pensionFunctions.js";

// Export INFO-ONE preview functions
export {
  getTransferPreview,
  getCoilPreviewInfo,
  getCurlPreviewInfo,
  getBrumatePreviewInfo,
  getConstrictPreviewInfo,
  parseTransferPreview,
  type TransferPreviewData
} from "./infoOneFunctions.js";

// Coil OURO to AURYN
// (namespace.TS01-C2.ATS|C_Coil patron:string coiler:string "Auryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" amount:decimal)
export async function coilOuroToAuryn(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  targetAccount: string, // The account that will receive the AURYN
  ouroAmount: string
) {
  const keysetName = `ks`;

  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(ouroAmount);

  let gasLimit = 2_000_000; // Default gas limit


  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Coil "${ouroAccount.address}" "${targetAccount}" "Auryndex-O136CBn22ncY" "OURO-8Nh-JO8JO4F5" ${decimalAmount})`)
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
