/**
 * activateFunctions.ts
 * Info + execute functions for C_DeployStandardAccount (Activate Standard Ouronet Account).
 */

import {
  KADENA_NAMESPACE, KADENA_CHAIN_ID, KADENA_NETWORK,
  STOA_AUTONOMIC_OURONETGASSTATION,
} from "../constants/index.js";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import { getFailoverClient } from "@stoachain/stoa-core/network";
import { pactRead } from "@stoachain/stoa-core/reads";
import { universalSignTransaction, fromKeypair } from "@stoachain/stoa-core/signing";
import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";
import { createSimulationError, logDetailedError } from "@stoachain/stoa-core/errors";
import { getLogger } from "@stoachain/stoa-core/observability";
import { safeCreationTime } from "@stoachain/stoa-core/pact";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
export type { IKadenaKeypair } from "@stoachain/stoa-core/signing";

export interface DeployStandardAccountInfo {
  ignis: {
    "ignis-need":      number;
    "ignis-full"?:     number;
    "ignis-discount"?: number;
    "ignis-text"?:     string;
  };
  kadena: {
    "kadena-need"?:    number;
    "kadena-full":     number;
    "kadena-targets":  string[];
    "kadena-split":    number[];
    "kadena-text"?:    string;
  };
  "pre-text"?:  string | string[];
  "post-text"?: string | string[];
}

export interface DeployStandardAccountFullInfo {
  info:      DeployStandardAccountInfo;
  receivers: string[];  // resolved via DALOS.UR_AccountKadena for each kadena-target
}

// ─── Info ─────────────────────────────────────────────────────────────────────

/**
 * Fetches info for C_DeployStandardAccount.
 * Also resolves the 4 receiver addresses from kadena-targets via DALOS.UR_AccountKadena.
 * Single network call combining both.
 */
/**
 * Fetches ONLY the INFO response (no receiver resolution).
 * Used by FunctionInfoZone — simpler, won't fail if kadena-targets resolution has issues.
 */
export async function getDeployStandardAccountInfoOnly(
  account: string,
): Promise<any | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.INFO-ZERO.DALOS-INFO|URC_DeployStandardAccount "${account}")`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (response?.result?.status === "success") return (response.result as any).data;
    return null;
  } catch (error) {
    getLogger().error("Error in getDeployStandardAccountInfoOnly:", error);
    return null;
  }
}

export async function getDeployStandardAccountInfo(
  account: string,
): Promise<DeployStandardAccountFullInfo | null> {
  try {
    const pactCode =
      `(let*` +
      `  ((info (${KADENA_NAMESPACE}.INFO-ZERO.DALOS-INFO|URC_DeployStandardAccount "${account}"))` +
      `   (receivers (map (${KADENA_NAMESPACE}.DALOS.UR_AccountKadena) (at "kadena-targets" (at "kadena" info))))` +
      `)` +
      `{ "info": info, "receivers": receivers })`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (response?.result?.status === "success") {
      const data = (response.result as any).data;
      return { info: data.info, receivers: data.receivers };
    }
    return null;
  } catch (error) {
    getLogger().error("Error fetching DeployStandardAccount info:", error);
    return null;
  }
}

// ─── Smart account info ─────────────────────────────────────────────────────
// C_DeploySmartAccount is identical to the Standard deploy except for one extra
// `sovereign` arg in the execute, and a different INFO function name. The INFO
// response shape is the same (ignis + kadena cost + receivers), so we reuse the
// Standard info types.

export type DeploySmartAccountInfo = DeployStandardAccountInfo;
export type DeploySmartAccountFullInfo = DeployStandardAccountFullInfo;

/** Fetches ONLY the INFO response for C_DeploySmartAccount (no receiver
 *  resolution). Mirror of {@link getDeployStandardAccountInfoOnly}. */
export async function getDeploySmartAccountInfoOnly(
  account: string,
): Promise<any | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.INFO-ZERO.DALOS-INFO|URC_DeploySmartAccount "${account}")`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (response?.result?.status === "success") return (response.result as any).data;
    return null;
  } catch (error) {
    getLogger().error("Error in getDeploySmartAccountInfoOnly:", error);
    return null;
  }
}

/** Fetches INFO + resolves the receiver addresses for C_DeploySmartAccount.
 *  Mirror of {@link getDeployStandardAccountInfo}. */
export async function getDeploySmartAccountInfo(
  account: string,
): Promise<DeploySmartAccountFullInfo | null> {
  try {
    const pactCode =
      `(let*` +
      `  ((info (${KADENA_NAMESPACE}.INFO-ZERO.DALOS-INFO|URC_DeploySmartAccount "${account}"))` +
      `   (receivers (map (${KADENA_NAMESPACE}.DALOS.UR_AccountKadena) (at "kadena-targets" (at "kadena" info))))` +
      `)` +
      `{ "info": info, "receivers": receivers })`;

    const response = await pactRead(pactCode, { tier: "T5" });

    if (response?.result?.status === "success") {
      const data = (response.result as any).data;
      return { info: data.info, receivers: data.receivers };
    }
    return null;
  } catch (error) {
    getLogger().error("Error fetching DeploySmartAccount info:", error);
    return null;
  }
}

// ─── Execute ──────────────────────────────────────────────────────────────────

export interface DeployStandardAccountParams {
  /** INPUT I  — Ouronet account address to activate */
  account:       string;
  /** INPUT II — guard keyset keys (pub keys, 64 hex chars each) */
  guardKeys:     string[];
  /** INPUT II — guard predicate */
  guardPred:     string;
  /** INPUT III — k: Stoa account that sends the 4 coin.TRANSFER payments */
  kadenaAddress: string;
  /** INPUT IV — Ouronet account public key */
  publicKey:     string;
  /** 4 receiver addresses (from info kadena-targets → UR_AccountKadena) */
  receivers:     string[];
  /** 4 transfer amounts (from info kadena-split) */
  amounts:       number[];
  /** CodexPrime Key #0 — signs GAS_PAYER + 4× coin.TRANSFER */
  gasPayerKey:   IKadenaKeypair;
  /** Guard keyset signer keys (pure signers, de-duped with gasPayerKey) */
  guardSignerKeys: IKadenaKeypair[];
}

export async function executeDeployStandardAccount(
  params: DeployStandardAccountParams,
): Promise<any> {
  const {
    account, guardKeys, guardPred,
    kadenaAddress, publicKey,
    receivers, amounts,
    gasPayerKey, guardSignerKeys,
  } = params;

  const pactCode =
    `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_DeployStandardAccount` +
    ` "${account}"` +
    ` (read-keyset "ks")` +
    ` "${kadenaAddress}"` +
    ` "${publicKey}"` +
    `)`;

  let gasLimit = 2_000_000;

  const buildTransaction = (gasLimitOverride?: number) => {
    const effectiveGasLimit = gasLimitOverride ?? gasLimit;

    let builder = Pact.builder
      .execution(pactCode)
      .addData("ks", { keys: guardKeys, pred: guardPred })
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        creationTime: safeCreationTime(),
        chainId:       KADENA_CHAIN_ID,
        gasLimit:      effectiveGasLimit,
      })
      .setNetworkId(KADENA_NETWORK)
      // CodexPrime Key #0: GAS_PAYER + 4× coin.TRANSFER
      .addSigner(gasPayerKey.publicKey, (w: any) => [
        w(`${KADENA_NAMESPACE}.DALOS.GAS_PAYER`, "", { int: 0 }, { decimal: "0.0" }),
        ...receivers.map((receiver, i) =>
          w("coin.TRANSFER", kadenaAddress, receiver, { decimal: String(amounts[i]) })
        ),
      ]);

    // Guard keys — pure signers (skip if already added as gasPayerKey)
    const addedPubs = new Set<string>([gasPayerKey.publicKey]);
    for (const k of guardSignerKeys) {
      if (!addedPubs.has(k.publicKey)) {
        builder = (builder as any).addSigner(k.publicKey);
        addedPubs.add(k.publicKey);
      }
    }

    return builder.createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

  // 1. Simulate with 2M (network max)
  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);

  if (simulation.result.status === "failure") {
    const error = createSimulationError(
      "Activate Standard Account",
      simulation.result,
      `Account: ${account} | Kadena: ${kadenaAddress}`,
    );
    logDetailedError(error);
    throw error;
  }

  // 2. Adaptive gas: rebuild with calibrated limit
  const requiredGas = simulation.gas;
  if (requiredGas) {
    gasLimit = calculateAutoGasLimit(requiredGas);
    transaction = buildTransaction(gasLimit);
  }

  // 3. Sign & submit
  const allSigners: IKadenaKeypair[] = [gasPayerKey];
  const seenPubs = new Set<string>([gasPayerKey.publicKey]);
  for (const k of guardSignerKeys) {
    if (!seenPubs.has(k.publicKey)) { allSigners.push(k); seenPubs.add(k.publicKey); }
  }

  const signed: any = await universalSignTransaction(
    transaction,
    allSigners.map((s) => fromKeypair(s)),
  );

  return await submit(signed);
}
