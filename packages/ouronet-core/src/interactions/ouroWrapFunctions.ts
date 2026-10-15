/**
 * ouroWrapFunctions.ts
 * KDA wrap/unwrap and unwrap-stoa execution + supporting reads.
 */

import { calculateAutoGasLimit, stoaGasMeta } from "@stoachain/stoa-core/gas";
import {
  KADENA_CHAIN_ID,
  KADENA_NAMESPACE, STOA_AUTONOMIC_OURONETGASSTATION, STOA_AUTONOMIC_LIQUIDPOT,
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
import type { IOuroAccountKeypair, UnwrapStoaParams } from "./ouroTypes.js";

// Wrap Kadena
// (defun LQD|C_WrapStoa (patron:string wrapper:string amount:decimal))
// patron is current ouro account public key | wrapper by default is the same but can also be a different ouro account public key amount should be decimal
// as keys we need to use the ouro account kadena_ledger that has the capability coin.TRANSFER and the value of the amount. STOA_AUTONOMIC_OURONETGASSTATION
export async function wrapKadena(
  patronAccount: IOuroAccountKeypair,
  wrapperAccount: string, // Ouro address that will receive the wrapped KDA
  kadenaAccount: IKadenaKeypair, // The kadena account that will transfer KDA
  guardAccount: IKadenaKeypair, // The guard account from the Ouro account
  amount: string
) {
  const keysetName = `ks`;

  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(amount);

  let gasLimit = 2_000_000; // Default gas limit for wrap operation

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.LQD|C_WrapStoa "${patronAccount.address}" "${wrapperAccount}" ${decimalAmount})`)
      .addData(keysetName, {
        keys: [guardAccount.publicKey],
        pred: "keys-all",
      })
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        ...stoaGasMeta(safeCreationTime()),
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
          STOA_AUTONOMIC_LIQUIDPOT,
          { decimal: decimalAmount }
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

  // CALIBRATE IN BOTH DIRECTIONS, NOT JUST UPWARD.
  //
  // This read `requiredGas > gasLimit`, so the rebuild fired ONLY when the simulated cost
  // EXCEEDED the starting limit. With a starting limit of 2_000_000 -- the node ceiling, which
  // a simulation can never exceed and still succeed -- the condition was unreachable and
  // `calculateAutoGasLimit` was dead code. Every such transaction shipped at the full ceiling.
  //
  // That is only invisible while transactions succeed. A SUCCEEDING transaction is charged what
  // it USES; a FAILING one is charged its LIMIT. So the entire 2M was burnt on every failure,
  // instead of the ~170k a 145k operation calibrates to -- reported from the field 2026-10-15.
  //
  // Calibrating down is safe by construction: `calculateAutoGasLimit` is purpose-built for it,
  // applying a tiered multiplier plus a flat cushion (x1.10 + 10k in the 100k-500k band)
  // precisely because a dirty read under-reports a signed transaction's real cost, and it
  // clamps to the node limit and a minimum floor at both ends. Eighteen other call sites in
  // this package already use it unconditionally.
  const requiredGas = simulation.gas;
  if (requiredGas) {
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

// unwrap Kadena
// (ouronet-ns.TS01-C2.LQD|C_UnwrapStoa patron unwrapper amount)
export async function unwrapKadena(
  patronAccount: IOuroAccountKeypair, // Ouro account that owns the WSTOA
  unwrapperAccount: string, // Ouro address that will receive the unwrapped KDA
  kadenaAccount: IKadenaKeypair, // The kadena account (payer)
  guardAccount: IKadenaKeypair, // The guard account from the Ouro account
  amount: string
) {
  // Ensure amount is formatted as decimal
  const decimalAmount = formatDecimalForPact(amount);

  let gasLimit = 2_000_000; // Default gas limit for unwrap operation

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.LQD|C_UnwrapStoa "${patronAccount.address}" "${unwrapperAccount}" ${decimalAmount})`)
      .setMeta({
        senderAccount: STOA_AUTONOMIC_OURONETGASSTATION,
        ...stoaGasMeta(safeCreationTime()),
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
          STOA_AUTONOMIC_LIQUIDPOT,
          `k:${kadenaAccount.publicKey}`,
          { decimal: decimalAmount }
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

  // CALIBRATE IN BOTH DIRECTIONS, NOT JUST UPWARD.
  //
  // This read `requiredGas > gasLimit`, so the rebuild fired ONLY when the simulated cost
  // EXCEEDED the starting limit. With a starting limit of 2_000_000 -- the node ceiling, which
  // a simulation can never exceed and still succeed -- the condition was unreachable and
  // `calculateAutoGasLimit` was dead code. Every such transaction shipped at the full ceiling.
  //
  // That is only invisible while transactions succeed. A SUCCEEDING transaction is charged what
  // it USES; a FAILING one is charged its LIMIT. So the entire 2M was burnt on every failure,
  // instead of the ~170k a 145k operation calibrates to -- reported from the field 2026-10-15.
  //
  // Calibrating down is safe by construction: `calculateAutoGasLimit` is purpose-built for it,
  // applying a tiered multiplier plus a flat cushion (x1.10 + 10k in the 100k-500k band)
  // precisely because a dirty read under-reports a signed transaction's real cost, and it
  // clamps to the node limit and a minimum floor at both ends. Eighteen other call sites in
  // this package already use it unconditionally.
  const requiredGas = simulation.gas;
  if (requiredGas) {
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

/**
 * Resolve the target Kadena address for an Ouronet unwrapper account.
 * (ouronet-ns.DALOS.UR_AccountKadena <unwrapper>)
 */
export async function getUnwrapStoaTarget(unwrapper: string): Promise<string | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DALOS.UR_AccountKadena "${unwrapper}")`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (response?.result?.status === "success") {
      return String((response.result as any).data);
    }
    return null;
  } catch (error) {
    getLogger().error("Error resolving UnwrapStoa target:", error);
    return null;
  }
}

export async function getUnwrapStoaInfo(
  patron: string,
  unwrapper: string,
  amount: string
): Promise<any | null> {
  try {
    const decimalAmount = formatDecimalForPact(amount);
    const pactCode = `(${KADENA_NAMESPACE}.INFO-ONE.INFO_LIQUID|UnwrapStoa "${patron}" "${unwrapper}" ${decimalAmount})`;
    const response = await pactRead(pactCode, { tier: "T2" });
    if (response?.result?.status === "success") {
      return (response.result as any).data;
    }
    return null;
  } catch (error) {
    getLogger().error("Error getting UnwrapStoa info:", error);
    return null;
  }
}

// ─── executeUnwrapStoa ────────────────────────────────────────────────────────
// Handles both execution cases for UnwrapStoa:
//   Case 2 — target exists → simple unwrap
//   Case 1 — target is new k: account → create account + unwrap
// Adaptive gas: simulate first, then rebuild with calculateAutoGasLimit.

export async function executeUnwrapStoa(params: UnwrapStoaParams): Promise<any> {
  const {
    patronAddress, unwrapperAddress, amount, numAmount,
    targetAddress, targetExists,
    gasStationKey, patronGuardKeys, accountGuardKeys,
  } = params;

  // All unique signers (gas station first, then guard keys de-duped)
  const allSigners: IKadenaKeypair[] = [gasStationKey];
  const addedPubs = new Set<string>([gasStationKey.publicKey]);
  for (const k of [...patronGuardKeys, ...accountGuardKeys]) {
    if (!addedPubs.has(k.publicKey)) { allSigners.push(k); addedPubs.add(k.publicKey); }
  }

  let gasLimit = 2_000_000;

  const buildTransaction = (gasLimitOverride?: number) => {
    const effectiveGasLimit = gasLimitOverride ?? gasLimit;

    let builder = targetExists
      // Case 2 — target exists: simple unwrap
      ? Pact.builder.execution(
          `(${KADENA_NAMESPACE}.TS01-C2.LQD|C_UnwrapStoa "${patronAddress}" "${unwrapperAddress}" ${amount})`
        )
      // Case 1 — new k: account: create + unwrap
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
            `    (coin.C_CreateAccount target (read-keyset "ks"))\n` +
            `    (TS01-C2.LQD|C_UnwrapStoa "${patronAddress}" "${unwrapperAddress}" ${amount})\n` +
            `  ]\n` +
            `)`
          )
          .addData("ks", {
            keys: [targetAddress.slice(2)], // k:<pubkey> → strip "k:"
            pred: "keys-all",
          });

    builder = builder
      .setMeta({ senderAccount: STOA_AUTONOMIC_OURONETGASSTATION, chainId: KADENA_CHAIN_ID, ...stoaGasMeta(safeCreationTime()),
        gasLimit: effectiveGasLimit })
      .setNetworkId(KADENA_NETWORK)
      // Gas Station: GAS_PAYER + coin.TRANSFER
      .addSigner(gasStationKey.publicKey, (w: any) => [
        w(`${KADENA_NAMESPACE}.DALOS.GAS_PAYER`, "", { int: 0 }, { decimal: "0.0" }),
        w("coin.TRANSFER", STOA_AUTONOMIC_LIQUIDPOT, targetAddress, { decimal: String(numAmount) }),
      ]);

    // Patron + account guard keys: pure signers
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

  // 1. Simulate with 2M (network max)
  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);

  if (simulation.result.status === "failure") {
    const error = createSimulationError(
      "Unwrap STOA",
      simulation.result,
      `Patron: ${patronAddress} | Unwrapper: ${unwrapperAddress} | Target: ${targetAddress} | Amount: ${amount}`
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
  const signed: any = await universalSignTransaction(
    transaction,
    allSigners.map((s) => fromKeypair(s)),
  );

  return await submit(signed);
}
