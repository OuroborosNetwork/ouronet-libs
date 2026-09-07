/**
 * ouroRotateFunctions.ts
 * Kadena payment-key rotation for Ouronet accounts (multi-signer flow).
 */

import { calculateAutoGasLimit, stoaGasMeta } from "@stoachain/stoa-core/gas";
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
import type { IKeyset } from "@stoachain/stoa-core/guard";
import { createSimulationError, logDetailedError } from "@stoachain/stoa-core/errors";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";

/**
 * Query RotateKadena info object from the chain.
 * (ouronet-ns.INFO-ZERO.DALOS-INFO|URC_RotateKadena <patron> <account>)
 */
export async function getRotateKadenaInfo(
  patron: string,
  account: string
): Promise<any | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.INFO-ZERO.DALOS-INFO|URC_RotateKadena "${patron}" "${account}")`;
    const response = await pactRead(pactCode, { tier: "T3" });

    if (response?.result?.status === "success") {
      return (response.result as any).data;
    }
    return null;
  } catch (error) {
    getLogger().error("Error getting RotateKadena info:", error);
    return null;
  }
}

/**
 * Rotate Payment Key (Kadena Ledger) for an Ouronet account.
 * (ouronet-ns.TS01-C1.DALOS|C_RotateKadena patron account newPaymentKey)
 *
 * Requires two signers:
 * 1. patronKadenaKey — key from patron's guard (pays IGNIS, has GAS_PAYER cap)
 * 2. accountGuardKey — key from the target account's guard (ownership proof)
 *
 * If patron == account, these may be the same key, requiring only 1 signer.
 */
export async function rotateKadenaPaymentKey(
  patronAddress: string,
  accountAddress: string,
  newPaymentKey: string,
  gasStationKey: IKadenaKeypair,
  patronGuardKeys: IKadenaKeypair[],
  accountGuardKeys: IKadenaKeypair[],
  patronGuard: IKeyset | null,
  accountGuard: IKeyset | null,
) {
  let gasLimit = 2_000_000;

  // Collect all unique signers: gasStation + patronGuard + accountGuard
  const allSigners: IKadenaKeypair[] = [gasStationKey];
  const addedPubs = new Set<string>([gasStationKey.publicKey]);
  for (const k of [...patronGuardKeys, ...accountGuardKeys]) {
    if (!addedPubs.has(k.publicKey)) {
      allSigners.push(k);
      addedPubs.add(k.publicKey);
    }
  }

  const buildTransaction = (gasLimitOverride?: number) => {
    let builder = Pact.builder
      .execution(
        `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_RotateKadena "${patronAddress}" "${accountAddress}" "${newPaymentKey}")`
      );

    // Add keyset data for patron guard
    if (patronGuard) {
      builder = builder.addData("ks", {
        keys: patronGuard.keys,
        pred: patronGuard.pred,
      });
    }

    // Add keyset data for account guard (if different from patron)
    if (accountGuard && accountAddress !== patronAddress) {
      builder = builder.addData("ks-account", {
        keys: accountGuard.keys,
        pred: accountGuard.pred,
      });
    }

    builder = builder
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        chainId: KADENA_CHAIN_ID,
        gasLimit: gasLimitOverride || gasLimit,
        // One clock read for both fields: `stoaGasMeta` (the canonical Yin
        // Engine in `@stoachain/stoa-core/gas`) prices the transaction against
        // the very `creationTime` it stamps, so a tick crossing between two
        // separate reads can never underprice it. `safeCreationTime()` keeps
        // this package's -30s skew (F-BUG-002) and the price follows it.
        // Pre-4.5.1 only `creationTime` was set and `gasPrice` fell back to
        // the client's `1.0e-8` default — the genesis floor — so every
        // payment-key rotation after the first tick was rejected as underpriced.
        ...stoaGasMeta(safeCreationTime()),
      })
      .setNetworkId(KADENA_NETWORK)
      // Gas Station key: GAS_PAYER capability (SEPARATE from guard keys)
      .addSigner(gasStationKey.publicKey, (withCapability: any) => [
        withCapability(
          `${KADENA_NAMESPACE}.DALOS.GAS_PAYER`,
          "",
          { int: 0 },
          { decimal: "0.0" }
        ),
      ]);

    // Patron guard signers — pure signing (ownership)
    const addedSignerPubs = new Set<string>([gasStationKey.publicKey]);
    for (const k of patronGuardKeys) {
      if (!addedSignerPubs.has(k.publicKey)) {
        builder = builder.addSigner(k.publicKey);
        addedSignerPubs.add(k.publicKey);
      }
    }

    // Account guard signers — pure signing (ownership)
    for (const k of accountGuardKeys) {
      if (!addedSignerPubs.has(k.publicKey)) {
        builder = builder.addSigner(k.publicKey);
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
      "Rotate Payment Key",
      simulation.result,
      `Patron: ${patronAddress} | Account: ${accountAddress} | New Key: ${newPaymentKey}`
    );
    logDetailedError(error);
    throw error;
  }

  const requiredGas = simulation.gas;
  if (requiredGas) {
    gasLimit = calculateAutoGasLimit(requiredGas);
    transaction = buildTransaction(gasLimit);
  }

  const signedTransaction: any = await universalSignTransaction(
    transaction,
    allSigners.map((s) => fromKeypair(s))
  );

  return await submit(signedTransaction);
}
