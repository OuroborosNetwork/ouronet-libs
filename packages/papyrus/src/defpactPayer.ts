/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHO PAYS FOR A DEFPACT'S CONTINUATION STEPS — owner ruling, 2026-10-29
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * Verbatim: *"who pays for the continuation of the defpacts: the answer is the payment key of the
 * currently selected Ouronet Account which was selected when triggering the defpact multistep
 * transaction. The user has to be warned about this that his payment key must contain sufficient
 * stoa otherwise his continuations may not happen and the execution may end up stranded."*
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE GAS STATION CANNOT DO IT — the constraint that forced the ruling
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * `DALOS.GAS_PAYER` binds, eagerly and in one `let`:
 *
 *     (iz-single:bool (contains "exec-code" (read-msg)))
 *     (exec-lines:[string] (at "exec-code" (read-msg)))
 *
 * so the `at` RAISES on a message without that key — and a `cont` payload has none. Pinned as
 * tested behaviour in `DALOS-ADMIN.repl <<DALOS-G2e>>`: *"Pinned AS IT BEHAVES so a fix has to
 * update this line deliberately."*
 *
 * **STEP 0 IS STILL FREE.** It is an `exec` carrying code, and `ouronet-ns.TS` is a whitelisted
 * first form, so the station funds it exactly as it funds any other Talos call. Only steps
 * 1..N-1 fall to the user. That asymmetry is the whole hazard: the expensive, irreversible part
 * of the operation starts gasless and finishes on the user's own STOA.
 *
 * `stoa-xchain-gas` is NOT an alternative, and `lib/pact/continuation.ts` measured why: its guard
 * accepts a `cont` payload happily but caps the transaction at **850 gas**, calibrated for a
 * single `coin.transfer-crosschain` credit. An `MTX-SWP` step mints LP and moves tokens across
 * several accounts.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A REFUSAL AND NOT ONLY A WARNING
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * The ruling asks for a warning. A warning alone is not enough here, and the reason is specific
 * rather than cautious: **`MTX-SWP` pacts are PERISHABLE.** The middle step opens with
 * `(enforce (= prev-pool-state current-pool-state) …)` — the pact snapshots the pool at step 0
 * and refuses to continue against a pool that has since moved. So a user who cannot pay for step
 * 1 does not merely wait; the window closes and the pact is stranded for good.
 *
 * That already happened: two liquidity additions stranded on 2026-10-15 by a caller that opened
 * the door and never continued.
 *
 * So the balance is CHECKED BEFORE STEP 0, and an insufficient one refuses the whole run. A user
 * who cannot finish must not be allowed to start — the one state worse than "you cannot do this"
 * is "you half-did this and cannot undo it".
 */

/** What the engine needs to decide, kept free of React so it can be asserted directly. */
export interface DefpactPayerInput {
  /** The resident's wrapper payment key address, or `null` while it resolves. */
  paymentKeyAddr: string | null;
  /** That key's native STOA balance, or `null` while it is being read. */
  paymentKeyStoa: number | null;
  /** How many steps the pact has, from the registry's `partition.steps`. */
  steps: number | null;
  /** Measured gas for ONE step, when a simulation has produced it. */
  measuredStepGas?: number | null;
  /** StoaChain gas price, so a gas figure becomes a STOA figure. */
  gasPrice: number;
}

export interface DefpactPayerVerdict {
  /** A refusal, or `null` when the run may start. Shaped for facility #12's `blocked`. */
  blocked: string | null;
  /** The warning to show whenever a multistep run is OFFERED, refusal or not. */
  warning: string;
  /** What the continuations are estimated to cost in STOA, when that is knowable. */
  estimatedStoa: number | null;
}

/**
 * A FLOOR, NOT A FORECAST. Used only when nothing has been simulated yet, and deliberately
 * generous: the point is to catch an EMPTY or nearly-empty payment key before step 0, not to
 * price the run. A real figure replaces it the moment `measuredStepGas` arrives.
 *
 * Chosen as the observed order of magnitude for an `MTX-SWP` step rather than invented — the
 * add-liquidity single-shot measures in the hundreds of thousands of gas, and a defpact step
 * does a comparable amount of work.
 */
export const ASSUMED_STEP_GAS = 400_000;

export function defpactPayerVerdict(i: DefpactPayerInput): DefpactPayerVerdict {
  const continuations = i.steps !== null && i.steps > 1 ? i.steps - 1 : null;

  const warning =
    "The first step is gas-free, but every step after it is paid by THIS ACCOUNT'S PAYMENT KEY "
    + "in native STOA — the gas station cannot fund a continuation. If the key runs out partway, "
    + "the remaining steps cannot be sent and this operation will be left unfinished, and it "
    + "cannot be restarted: the pact refuses to continue once the pool has moved.";

  const perStep = i.measuredStepGas ?? ASSUMED_STEP_GAS;
  const estimatedStoa = continuations === null
    ? null
    : continuations * perStep * i.gasPrice;

  // ORDERED SO THE MOST ACTIONABLE REASON WINS. "Your key has no STOA" is something the user can
  // fix; "we are still reading your balance" is something they wait for.
  const blocked =
    i.paymentKeyAddr === null
      ? "Resolving this account's payment key — it pays for the continuation steps."
      : i.paymentKeyStoa === null
        ? "Reading the payment key's STOA balance — it pays for the continuation steps."
        : estimatedStoa !== null && i.paymentKeyStoa < estimatedStoa
          ? `This run needs about ${estimatedStoa.toFixed(4)} STOA on the payment key to finish `
            + `its ${continuations} continuation step${continuations === 1 ? "" : "s"}, and the `
            + `key holds ${i.paymentKeyStoa.toFixed(4)}. Starting it would strand the operation `
            + `partway, and a stranded pact cannot be resumed once the pool moves.`
          : null;

  return { blocked, warning, estimatedStoa };
}
