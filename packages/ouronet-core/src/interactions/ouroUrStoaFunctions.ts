/**
 * ouroUrStoaFunctions.ts
 * UrStoa account-existence probe, unwrap-info read, and unwrap execution (parallel to UnwrapStoa).
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
import { createSimulationError, logDetailedError } from "@stoachain/stoa-core/errors";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";
import type { UnwrapUrStoaParams } from "./ouroTypes.js";

// ─── Unwrap UrStoa ────────────────────────────────────────────────────────────

/**
 * Check if an account exists in the UrStoa table.
 * (if (= (typeof (try false (coin.UR_UR|Balance "<address>"))) "bool") false true)
 */
export async function checkUrStoaAccountExists(address: string): Promise<boolean | null> {
  try {
    const pactCode = `(if (= (typeof (try false (coin.UR_UR|Balance "${address}"))) "bool") false true)`;
    const response = await pactRead(pactCode, { tier: "T3" });
    const data = (response?.result as any)?.data;
    if (data === true) return true;
    if (data === false) return false;
    return null;
  } catch (error) {
    getLogger().error("Error checking UrStoa account:", error);
    return null;
  }
}

/**
 * Get INFO for UnwrapUrStoa function.
 * (ouronet-ns.INFO-ONE.LIQUID|INFO_UnwrapUrStoa <patron> <wrapper> <amount:decimal>)
 */
export async function getUnwrapUrStoaInfo(
  patron: string,
  wrapper: string,
  amount: string,
): Promise<any | null> {
  try {
    const decimalAmount = formatDecimalForPact(amount);
    const pactCode = `(${KADENA_NAMESPACE}.INFO-ONE.LIQUID|INFO_UnwrapUrStoa "${patron}" "${wrapper}" ${decimalAmount})`;
    const response = await pactRead(pactCode, { tier: "T2" });
    if (response?.result?.status === "success") {
      return (response.result as any).data;
    }
    return null;
  } catch (error) {
    getLogger().error("Error getting UnwrapUrStoa info:", error);
    return null;
  }
}

// ─── executeUnwrapUrStoa ──────────────────────────────────────────────────────
// Handles both cases:
//   target exists → simple unwrap via C_UnwrapUrStoa
//   target new k: → create UrStoa account + unwrap

export async function executeUnwrapUrStoa(params: UnwrapUrStoaParams): Promise<any> {
  const {
    patronAddress, unwrapperAddress, amount,
    targetAddress, targetExists,
    gasStationKey, patronGuardKeys, accountGuardKeys,
  } = params;

  const allSigners: IKadenaKeypair[] = [gasStationKey];
  const addedPubs = new Set<string>([gasStationKey.publicKey]);
  for (const k of [...patronGuardKeys, ...accountGuardKeys]) {
    if (!addedPubs.has(k.publicKey)) { allSigners.push(k); addedPubs.add(k.publicKey); }
  }

  let gasLimit = 2_000_000;

  const buildTransaction = (gasLimitOverride?: number) => {
    const effectiveGasLimit = gasLimitOverride ?? gasLimit;

    let builder = targetExists
      ? Pact.builder.execution(
          `(${KADENA_NAMESPACE}.TS01-C2.LQD|C_UnwrapUrStoa "${patronAddress}" "${unwrapperAddress}" ${amount})`
        )
      : Pact.builder
          .execution(
            `(namespace "${KADENA_NAMESPACE}")\n` +
            `(IGNIS.C_Collect "${patronAddress}" (IGNIS.UDC_CustomCodeCumulator))\n` +
            `(let\n` +
            `  (\n` +
            `    (wp:string "${unwrapperAddress}")\n` +
            `    (target:string (DALOS.UR_AccountKadena wp))\n` +
            `  )\n` +
            `  [\n` +
            `    (coin.C_UR|CreateAccount target (read-keyset "ks"))\n` +
            `    (TS01-C2.LQD|C_UnwrapUrStoa "${patronAddress}" "${unwrapperAddress}" ${amount})\n` +
            `  ]\n` +
            `)`
          )
          .addData("ks", {
            keys: [targetAddress.slice(2)],
            pred: "keys-all",
          });

    builder = builder
      .setMeta({ senderAccount: STOA_AUTONOMIC_OURONETGASSTATION, chainId: KADENA_CHAIN_ID, creationTime: safeCreationTime(),
        gasLimit: effectiveGasLimit })
      .setNetworkId(KADENA_NETWORK)
      .addSigner(gasStationKey.publicKey, (w: any) => [
        w(`${KADENA_NAMESPACE}.DALOS.GAS_PAYER`, "", { int: 0 }, { decimal: "0.0" }),
      ]);

    const addedSignerPubs = new Set<string>([gasStationKey.publicKey]);
    for (const k of [...patronGuardKeys, ...accountGuardKeys]) {
      if (!addedSignerPubs.has(k.publicKey)) {
        builder = (builder as any).addSigner(k.publicKey);
        addedSignerPubs.add(k.publicKey);
      }
    }

    return builder.createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);

  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);

  if (simulation.result.status === "failure") {
    const error = createSimulationError(
      "Unwrap UrStoa",
      simulation.result,
      `Patron: ${patronAddress} | Unwrapper: ${unwrapperAddress} | Target: ${targetAddress} | Amount: ${amount}`
    );
    logDetailedError(error);
    throw error;
  }

  const requiredGas = simulation.gas;
  if (requiredGas) {
    gasLimit = calculateAutoGasLimit(requiredGas);
    transaction = buildTransaction(gasLimit);
  }

  const signed: any = await universalSignTransaction(
    transaction,
    allSigners.map((s) => fromKeypair(s)),
  );

  return await submit(signed);
}
