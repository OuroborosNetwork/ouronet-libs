import { calculateAutoGasLimit, stoaGasMeta } from "@stoachain/stoa-core/gas";
import {
  KADENA_CHAIN_ID,
  KADENA_NAMESPACE, STOA_AUTONOMIC_OURONETGASSTATION,
  KADENA_NETWORK,
} from "../constants/index.js";
import { formatDecimalForPact, safeCreationTime } from "@stoachain/stoa-core/pact";
import { Pact } from "@stoachain/kadena-stoic-legacy/client";
import { getFailoverClient } from "@stoachain/stoa-core/network";
import { pactRead } from "@stoachain/stoa-core/reads";
import { universalSignTransaction, fromKeypair, type IKadenaKeypair } from "@stoachain/stoa-core/signing";
import type { IOuroAccountKeypair } from "./ouroTypes.js";

// Brumate WSTOA to H|GSTOA (Hibernated Pension Kadena)
// (namespace.TS01-C2.ATS|C_Brumate patron:string brumate-account:string "SilverStoaPillar-O136CBn22ncY" "GoldenStoaPillar-O136CBn22ncY" "WSTOA-8Nh-JO8JO4F5" amount:decimal lock-days:integer)
export async function brumateWkdaToPkda(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  wkdaAmount: string,
  lockDays: number
) {
  const keysetName = `ks`;
  const decimalAmount = formatDecimalForPact(wkdaAmount);
  let gasLimit = 2_000_000;

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Brumate "${ouroAccount.address}" "${ouroAccount.address}" "SilverStoaPillar-O136CBn22ncY" "GoldenStoaPillar-O136CBn22ncY" "WSTOA-8Nh-JO8JO4F5" ${decimalAmount} ${lockDays})`)
      .addData(keysetName, {
        keys: [guard.publicKey],
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
      ])
      .addSigner(guard.publicKey)
      .createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);
  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);

  if (simulation.result.status === "failure") {
    const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
    throw new Error(`Simulation failed: ${errorMessage}`);
  }

  const requiredGas = simulation.gas;
  if (requiredGas && requiredGas > gasLimit) {
    gasLimit = calculateAutoGasLimit(requiredGas);
    transaction = buildTransaction(gasLimit);
  }

  const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(kadenaAccount),
    fromKeypair(guard),
  ]);
  const result = await submit(signedTransaction);

  return result;
}

// Constrict SSTOA to H|GSTOA (Hibernated Pension Kadena)
// (namespace.TS01-C2.ATS|C_Constrict patron:string constrictor:string "GoldenStoaPillar-O136CBn22ncY" "SSTOA-8Nh-JO8JO4F5" amount:decimal lock-days:integer)
export async function constrictLkdaToPkda(
  ouroAccount: IOuroAccountKeypair,
  kadenaAccount: IKadenaKeypair,
  guard: IKadenaKeypair,
  lkdaAmount: string,
  lockDays: number
) {
  const keysetName = `ks`;
  const decimalAmount = formatDecimalForPact(lkdaAmount);
  let gasLimit = 2_000_000;

  const buildTransaction = (gasLimitOverride?: number) => {
    return Pact.builder
      .execution(`(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Constrict "${ouroAccount.address}" "${ouroAccount.address}" "GoldenStoaPillar-O136CBn22ncY" "SSTOA-8Nh-JO8JO4F5" ${decimalAmount} ${lockDays})`)
      .addData(keysetName, {
        keys: [guard.publicKey],
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
      ])
      .addSigner(guard.publicKey)
      .createTransaction();
  };

  const { dirtyRead, submit } = getFailoverClient(KADENA_CHAIN_ID);
  let transaction = buildTransaction();
  const simulation = await dirtyRead(transaction);

  if (simulation.result.status === "failure") {
    const errorMessage = simulation.result.error?.message || "Transaction simulation failed";
    throw new Error(`Simulation failed: ${errorMessage}`);
  }

  const requiredGas = simulation.gas;
  if (requiredGas && requiredGas > gasLimit) {
    gasLimit = calculateAutoGasLimit(requiredGas);
    transaction = buildTransaction(gasLimit);
  }

  const signedTransaction: any = await universalSignTransaction(transaction, [
    fromKeypair(kadenaAccount),
    fromKeypair(guard),
  ]);
  const result = await submit(signedTransaction);

  return result;
}

/**
 * HIBERNATION FEE, read from the pool that charges it.
 *
 * WHAT THIS REPLACED, AND WHY IT MATTERED. This used to call
 * `DPL-UR.URC_0012_HibernateFee`, a function that has NEVER EXISTED in any Pact source in the
 * Ouronet repo -- not in DPL-UR before it was stubbed, and not in any commit in its history. So
 * every call was a RESOLUTION error, the `catch` below always fired, and the number the Brumate
 * and Constrict modals displayed was this file's hardcode. The comment on that fallback said
 * "function may not be deployed yet", which had been true for as long as the function existed.
 *
 * THE HARDCODE WAS NUMERICALLY RIGHT, WHICH IS WHY IT SURVIVED. Mainnet holds
 * peak = 120 promille and decay = 0.008 promille/day for GoldenStoaPillar, so
 * `max(120 - 0.008*d, 0) / 1000` IS `0.12 - 0.000008*d`. Nothing looked wrong because nothing
 * was wrong -- yet. `ATS|C_SetHibernationFees(patron, executor, ats, peak, decay)` lets the pool
 * owner change both, and on the day they do, every consumer of this function keeps returning
 * 12% and no test anywhere fails. A correct hardcode of a governable parameter is a bug with a
 * delayed trigger.
 *
 * THE FORMULA IS THE CHAIN'S, VERIFIED AGAINST IT. `ATS::URCx_RBT-Amount` computes
 * `(- php (* hd (dec dayz)))` clamped at zero, and `URC_RewardBearingTokenAmountsWithHibernation`
 * exposes the result. Measured on mainnet for 1,000,000 WSTOA into GoldenStoaPillar:
 *
 *   dayz=0    hibernation-fee 118,800.0  / first-input 990,000 = 120.00 promille
 *   dayz=365  hibernation-fee 115,909.2  / first-input 990,000 = 117.08 promille = 120 - 0.008*365
 *
 * Both are pinned as fixtures in `__tests__/pension-hibernate-fee.test.ts`, so the two-term
 * interpolation kept here is CHECKED against the chain's own arithmetic rather than trusted.
 *
 * NOTE THE DENOMINATOR: the hibernation promille applies to the amount AFTER the pool's royalty,
 * not to the deposit. At 10 promille royalty the true day-0 deduction is 1% + 11.88% = 12.88%,
 * and a UI showing only this number understates it. `getHibernationFeeBreakdown` returns both.
 *
 * ON FAILURE THIS THROWS. It deliberately no longer substitutes a local estimate: both callers
 * already catch and estimate, and a fallback one layer further down is invisible to the layer
 * that has to tell the user the figure is approximate.
 *
 * @param korIndexId - the ATS pool id, e.g. "GoldenStoaPillar-O136CBn22ncY"
 * @param lockDays   - days locked
 * @returns fee as a fraction of the post-royalty amount (0.12 = 12%)
 */
export async function getHibernateFee(
  korIndexId: string,
  lockDays: number
): Promise<number> {
  const { hibernationFraction } = await getHibernationFeeBreakdown(korIndexId, lockDays);
  return hibernationFraction;
}

export interface HibernationFeeBreakdown {
  /** `UR_Hibernate` -- when false the pool charges no hibernation fee at all. */
  readonly hibernateEnabled: boolean;
  /** `UR_PeakHibernatePromile` -- the day-zero rate, per thousand. */
  readonly peakPromille: number;
  /** `UR_HibernateDecay` -- promille shed per day locked. */
  readonly decayPromille: number;
  /** `max(peak - decay*days, 0)`, the chain's own clamp. */
  readonly hibernationPromille: number;
  /** Hibernation fee as a fraction OF THE POST-ROYALTY AMOUNT. */
  readonly hibernationFraction: number;
  /** `UR_Royalty` -- taken off the deposit BEFORE hibernation is applied. */
  readonly royaltyPromille: number;
  /**
   * Fraction of the ORIGINAL deposit that does not reach the vault: royalty, plus hibernation on
   * what is left. This is the number a user experiences, and it is strictly larger than
   * `hibernationFraction`.
   */
  readonly totalFraction: number;
}

/**
 * Every governed input to the hibernation fee, in ONE read.
 *
 * One round trip rather than four: the fee is recomputed on every keystroke of the lock-days
 * slider, and four reads per keystroke is how a slider starts to stutter.
 */
export async function getHibernationFeeBreakdown(
  korIndexId: string,
  lockDays: number
): Promise<HibernationFeeBreakdown> {
  const code = `(let ((a "${korIndexId}"))`
    + ` { "on": (${KADENA_NAMESPACE}.ATS.UR_Hibernate a)`
    + ` , "peak": (${KADENA_NAMESPACE}.ATS.UR_PeakHibernatePromile a)`
    + ` , "decay": (${KADENA_NAMESPACE}.ATS.UR_HibernateDecay a)`
    + ` , "royalty": (${KADENA_NAMESPACE}.ATS.UR_Royalty a) })`;

  const response = await pactRead(code, { tier: "T2" });

  if (!response || !response.result) {
    throw new Error("Failed to retrieve hibernation fee parameters");
  }
  if (response.result.status === "failure") {
    throw new Error(
      `Hibernation fee query failed: ${response.result.error?.message || "Unknown error"}`
    );
  }
  return deriveHibernationFee(response.result.data as any, lockDays);
}

/** A Pact decimal arrives as a bare number or as `{decimal: "…"}` once precision exceeds JS. */
function pactNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "decimal" in (v as any)) {
    return parseFloat(String((v as any).decimal));
  }
  return parseFloat(String(v));
}

/**
 * The derivation, split out so a test can drive it with values RECORDED FROM MAINNET instead of
 * reaching the network. Exported for that reason: an unexported formula is one no test can pin,
 * and an unpinned duplicate of a contract's arithmetic is exactly what this change set out to
 * remove.
 */
export function deriveHibernationFee(
  raw: { on?: unknown; peak?: unknown; decay?: unknown; royalty?: unknown },
  lockDays: number
): HibernationFeeBreakdown {
  const hibernateEnabled = raw.on === true;
  const peakPromille = pactNumber(raw.peak);
  const decayPromille = pactNumber(raw.decay);
  const royaltyPromille = pactNumber(raw.royalty);

  if (!Number.isFinite(peakPromille) || !Number.isFinite(decayPromille)) {
    throw new Error("Hibernation fee parameters are not numeric");
  }

  // The chain's clamp, not ours: `(if (<= raw 0.0) 0.0 raw)` in ATS::URCx_RBT-Amount.
  const hibernationPromille = hibernateEnabled
    ? Math.max(peakPromille - decayPromille * lockDays, 0)
    : 0;

  const hibernationFraction = hibernationPromille / 1000;
  const royaltyFraction = Number.isFinite(royaltyPromille) ? royaltyPromille / 1000 : 0;

  return {
    hibernateEnabled,
    peakPromille,
    decayPromille,
    hibernationPromille,
    hibernationFraction,
    royaltyPromille,
    // Royalty first, hibernation on the remainder -- the order ATS applies them in.
    totalFraction: royaltyFraction + (1 - royaltyFraction) * hibernationFraction,
  };
}
