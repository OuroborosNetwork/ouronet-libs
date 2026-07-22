import {
  KADENA_CHAIN_ID,
  KADENA_NAMESPACE, STOA_AUTONOMIC_OURONETGASSTATION,
  KADENA_NETWORK,
} from "../constants/index.js";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import { getFailoverClient } from "@stoachain/stoa-core/network";
import { pactRead } from "@stoachain/stoa-core/reads";
import { formatDecimalForPact, safeCreationTime } from "@stoachain/stoa-core/pact";
import { universalSignTransaction, fromKeypair } from "@stoachain/stoa-core/signing";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
export type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
import type { IOuroAccountKeypair } from "./ouroTypes.js";
import { getLogger } from "@stoachain/stoa-core/observability";

// Generic coiling configuration
//
// v3.3.8 (closes audit finding F-API-016): the interface is now
// exported. Pre-v3.3.8 only `COIL_CONFIGS` was exported — consumers
// holding a `CoilConfig` value (e.g. from `COIL_CONFIGS.ouroToAuryn`)
// could USE it but couldn't TYPE-ANNOTATE a parameter or local with
// `CoilConfig` without re-declaring the shape. Now they can.
export interface CoilConfig {
  atsPair: string;
  sourceToken: string;
  targetToken: string;
  previewCommand: string;
}

// Per-targetTokenName regex memoization (closes audit finding F-PERF-003).
//
// `getCoilPreviewGeneric` previously compiled 8 RegExp objects per call (4 for
// the `pre-text` array, 4 for the `post-text` array fallback). Pre-v3.3.6:
//   ~1 call → 8 allocations. The patterns interpolate `targetTokenName` derived
// from `config.targetToken`, so they're not statically hoistable — but they ARE
// stable per-token (only 3 token suffixes are in use across `COIL_CONFIGS`:
// `AURYN`, `ELITEAURYN`, `SSTOA`). v3.3.6 lazily memoizes the 8 patterns per
// `targetTokenName` so subsequent calls with the same token reuse the cached
// `RegExp` instances. After the cache warms (one call per unique target
// token), the steady-state allocation cost is zero per call. `Map<string,
// CoilPatternSet>` handles arbitrary token names, not just the 3 in
// `COIL_CONFIGS`, so consumer-supplied custom configs benefit too.
interface CoilPatternSet {
  generates: readonly RegExp[];
  generating: readonly RegExp[];
}

const coilPatternCache = new Map<string, CoilPatternSet>();

function getCoilPatterns(targetTokenName: string): CoilPatternSet {
  const cached = coilPatternCache.get(targetTokenName);
  if (cached) return cached;

  const eliteHyphen = targetTokenName.replace("ELITE", "ELITE-");
  const eliteSpace = targetTokenName.replace("ELITE", "Elite ");
  const tail = targetTokenName.slice(-4);

  const built: CoilPatternSet = {
    generates: [
      new RegExp(`generates\\s+([\\d.]+)\\s+${targetTokenName}`, "i"),
      new RegExp(`generates\\s+([\\d.]+)\\s+${eliteHyphen}`, "i"),
      new RegExp(`generates\\s+([\\d.]+)\\s+${eliteSpace}`, "i"),
      new RegExp(`generates\\s+([\\d.]+)\\s+\\w*${tail}\\w*`, "i"),
    ],
    generating: [
      new RegExp(`generating\\s+([\\d.]+)\\s+${targetTokenName}`, "i"),
      new RegExp(`generating\\s+([\\d.]+)\\s+${eliteHyphen}`, "i"),
      new RegExp(`generating\\s+([\\d.]+)\\s+${eliteSpace}`, "i"),
      new RegExp(`generating\\s+([\\d.]+)\\s+\\w*${tail}\\w*`, "i"),
    ],
  };
  coilPatternCache.set(targetTokenName, built);
  return built;
}

// Coiling configurations for each token pair
export const COIL_CONFIGS = {
  ouroToAuryn: {
    atsPair: "Auryndex-O136CBn22ncY",
    sourceToken: "OURO-8Nh-JO8JO4F5", 
    targetToken: "AURYN-8Nh-JO8JO4F5",
    previewCommand: "Auryndex-O136CBn22ncY"
  },
  aurynToElite: {
    atsPair: "EliteAuryndex-O136CBn22ncY",
    sourceToken: "AURYN-8Nh-JO8JO4F5",
    targetToken: "ELITEAURYN-8Nh-JO8JO4F5", 
    previewCommand: "EliteAuryndex-O136CBn22ncY"
  },
  wkdaToLkda: {
    atsPair: "SilverStoaPillar-O136CBn22ncY",
    sourceToken: "WSTOA-8Nh-JO8JO4F5",
    targetToken: "SSTOA-8Nh-JO8JO4F5",
    previewCommand: "SilverStoaPillar-O136CBn22ncY"
  }
} as const;

// Generic coil preview function
export async function getCoilPreviewGeneric(
  amount: string,
  config: CoilConfig
): Promise<{
  targetAmount: number;
  fee: number;
  kadenaInfo: {
    text: string;
    discount: number;
    full: number;
    need: number;
  };
}> {
  try {
    const decimalAmount = formatDecimalForPact(amount);
    
    const executionString = `(${KADENA_NAMESPACE}.INFO-ONE.ATS|INFO_Coil "preview" "preview" "${config.atsPair}" "${config.sourceToken}" ${decimalAmount})`;
    
    const response = await pactRead(executionString, { tier: "T2" });
    
    if (!response?.result?.status || response.result.status !== "success") {
      throw new Error("Failed to get coil preview");
    }

    const data = response.result.data as any;
    
    // Extract target token amount from text arrays (like original getCoilPreview)
    let targetAmount = 0;
    const targetTokenName = config.targetToken.replace('-8Nh-JO8JO4F5', ''); // ELITEAURYN, SSTOA, etc
    
    // v3.3.6 (F-PERF-003): pull the 8 RegExp instances from the
    // per-targetTokenName memoization cache instead of compiling them
    // 8x per call. Behaviorally identical — same patterns, same order.
    const patterns = getCoilPatterns(targetTokenName);

    // Check pre-text array for target token amount
    if (data && data['pre-text']) {
      for (const text of data['pre-text']) {
        for (const pattern of patterns.generates) {
          const tokenMatch = text.match(pattern);
          if (tokenMatch) {
            targetAmount = parseFloat(tokenMatch[1]);
            break;
          }
        }
        if (targetAmount > 0) break;
      }
    }

    // Fallback: check post-text array
    if (!targetAmount && data && data['post-text']) {
      for (const text of data['post-text']) {
        for (const pattern of patterns.generating) {
          const tokenMatch = text.match(pattern);
          if (tokenMatch) {
            targetAmount = parseFloat(tokenMatch[1]);
            break;
          }
        }
        if (targetAmount > 0) break;
      }
    }
    
    // Final fallback: try parsing data[0] if no text match found
    if (!targetAmount && data && Array.isArray(data) && data.length > 0) {
      const fallbackAmount = parseFloat(data[0]);
      if (!isNaN(fallbackAmount) && fallbackAmount > 0) {
        targetAmount = fallbackAmount;
      }
    }
    
    const result = {
      targetAmount,
      fee: 0, // Like original, always 0
      kadenaInfo: {
        text: data?.kadena?.[`kadena-text`] || "Kadena fee information not available",
        discount: data?.kadena?.[`kadena-discount`] || 1,
        full: data?.kadena?.[`kadena-full`] || 0,
        need: data?.kadena?.[`kadena-need`] || 0,
      }
    };
    
    return result;
  } catch (error: any) {
    getLogger().error("Error getting coil preview:", error);
    throw error;
  }
}

// Generic coil transaction function
export async function coilTokensGeneric(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair, 
  guard: IKadenaKeypair,
  targetAccount: string,
  amount: string,
  config: CoilConfig
) {
  const keysetName = `ks`;
  
  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(amount);
  
  let gasLimit = 70_000; // Default gas limit

  // Coiling operation initiated
  
  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Coil "${ouroAccount.address}" "${targetAccount}" "${config.atsPair}" "${config.sourceToken}" ${decimalAmount})`)
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
  
  // Simulation completed successfully

  // Check if simulation failed
  if (simulation.result.status === "failure") {
    const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
    throw new Error(`Simulation failed: ${errorMessage}`);
  }

  // Check if we need to adjust gas limit
  const requiredGas = simulation.gas;
  if (requiredGas && requiredGas > gasLimit) {
    // Rebuild transaction with adjusted gas limit (20% buffer)
    gasLimit = Math.ceil(requiredGas * 1.2);
    // Gas limit adjusted based on simulation
    transaction = buildTransaction(gasLimit);
  }

  // Sign and submit the transaction
  const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(kadenaAccount),
    fromKeypair(guard),
  ]);

  // Submit the signed transaction
  const result = await submit(signedTransaction);

  return result;
}

// Specific functions for each coiling operation

// OURO → AURYN (backward compatibility)
export async function getCoilPreview(ouroAmount: string) {
  const result = await getCoilPreviewGeneric(ouroAmount, COIL_CONFIGS.ouroToAuryn);
  return {
    auryn: result.targetAmount,
    fee: result.fee,
    kadenaInfo: result.kadenaInfo
  };
}

export async function coilOuroToAuryn(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  targetAccount: string,
  ouroAmount: string
) {
  return coilTokensGeneric(ouroAccount, kadenaAccount, guard, targetAccount, ouroAmount, COIL_CONFIGS.ouroToAuryn);
}

// AURYN → Elite-AURYN
export async function getAurynCoilPreview(aurynAmount: string) {
  const result = await getCoilPreviewGeneric(aurynAmount, COIL_CONFIGS.aurynToElite);
  
  return {
    eliteAuryn: result.targetAmount,
    fee: result.fee,
    kadenaInfo: result.kadenaInfo
  };
}

export async function coilAurynToElite(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  targetAccount: string,
  aurynAmount: string
) {
  return coilTokensGeneric(ouroAccount, kadenaAccount, guard, targetAccount, aurynAmount, COIL_CONFIGS.aurynToElite);
}

// WSTOA → SSTOA
export async function getWkdaCoilPreview(wkdaAmount: string) {
  const result = await getCoilPreviewGeneric(wkdaAmount, COIL_CONFIGS.wkdaToLkda);
  
  return {
    lkda: result.targetAmount,
    fee: result.fee,
    kadenaInfo: result.kadenaInfo
  };
}

export async function coilWkdaToLkda(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  targetAccount: string,
  wkdaAmount: string
) {
  return coilTokensGeneric(ouroAccount, kadenaAccount, guard, targetAccount, wkdaAmount, COIL_CONFIGS.wkdaToLkda);
}
