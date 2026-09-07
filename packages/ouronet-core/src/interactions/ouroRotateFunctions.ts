/**
 * ouroRotateFunctions.ts
 * Kadena payment-key rotation for Ouronet accounts (multi-signer flow).
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
import type { IKeyset } from "@stoachain/stoa-core/guard";
import { createSimulationError, logDetailedError } from "@stoachain/stoa-core/errors";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";

/**
 * Yin Engine — StoaChain's time-varying minimum gas price.
 *
 * TEMPORARY LOCAL COPY, identical to the one in `crossChainFunctions.ts`
 * (v4.5.0). Both belong in `@stoachain/stoa-core/gas` long-term — that package
 * still exposes only the static `GAS_PRICE_MIN_ANU = 10_000`, which is the
 * genesis floor and has been stale since 2026-02-23. Delete every copy in the
 * same change that consumes the chain-generic version.
 *
 * The floor starts at 10,000 ANU at genesis and rises by 1 ANU every 3 hours,
 * capped at 400,000 ANU. Source of truth: `UC_MinimumGasPriceANU` in
 * `pact/stoa-coin/new-coin.pact` (evaluated against `(at "block-time"
 * (chain-data))` on-chain — creationTime is a close client-side proxy for it).
 *
 * This applies to gas-station-paid transactions too: `DALOS.GAS_PAYER` decides
 * WHO pays, not HOW LITTLE. The chain-wide "gasPrice must be >= the live
 * floor" rule is checked before the payer guard ever runs, so a transaction
 * left at the client's `1.0e-8` default is rejected as underpriced no matter
 * how well-funded the Ouronet Gas Station is.
 */
const YIN_GENESIS_TIME_S = 1771869600; // 2026-02-23T18:00:00Z — tick 0
const YIN_GENESIS_MIN_GAS_ANU = 10_000;
const YIN_MAX_GAS_ANU = 400_000;
const YIN_GAS_PRICE_INTERVAL_S = 10_800; // 3 h per tick

function minGasPriceAnu(creationTimeS: number): number {
  const elapsed = creationTimeS - YIN_GENESIS_TIME_S;
  const ticks = elapsed <= 0 ? 0 : Math.floor(elapsed / YIN_GAS_PRICE_INTERVAL_S);
  return Math.min(YIN_GENESIS_MIN_GAS_ANU + ticks, YIN_MAX_GAS_ANU);
}

/** Built by string padding, never float division — avoids exponential notation / precision loss. */
function anuToStoaNumber(anu: number): number {
  return Number("0." + String(anu).padStart(12, "0"));
}

/**
 * One clock read: the `creationTime` to stamp and the `gasPrice` derived
 * FROM THAT EXACT VALUE, so the two can never disagree.
 */
function stoaGasMeta(): { creationTime: number; gasPrice: number } {
  const creationTime = safeCreationTime();
  return { creationTime, gasPrice: anuToStoaNumber(minGasPriceAnu(creationTime)) };
}

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
        // `stoaGasMeta()` supplies both `creationTime` (via `safeCreationTime()`)
        // and the `gasPrice` derived from that exact value, per the Yin Engine
        // (see the module-level comment above). Pre-4.5.1 this set only
        // `creationTime`, leaving `gasPrice` at the vendored client's
        // `1.0e-8` default — the genesis floor — so every payment-key rotation
        // submitted after the floor's first tick was rejected as underpriced.
        ...stoaGasMeta(),
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
