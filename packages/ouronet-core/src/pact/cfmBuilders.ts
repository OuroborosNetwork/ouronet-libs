/**
 * CFM Pact-code builders — string construction for every Pact function
 * the 23 OuronetUI CFM modals call.
 *
 * Background. Each CFM modal builds a Pact-code string like
 *   `(ouronet-ns.TS01-C2.ATS|C_Coil "<patron>" "<coiler>" "<ats>" "<rt>" <amount>)`
 * and hands it to `strategy.execute({ build })`. Historically these
 * strings lived inside the modal as a template literal — convenient
 * but impossible to test without rendering the React component, so
 * a typo (`C_Coyl`, missing quote, wrong namespace) only surfaced
 * when a user clicked the button and the chain rejected the tx.
 *
 * This module extracts each Pact-function-specific string builder
 * into a pure function. Modals import the builder and pass the
 * returned string to `Pact.builder.execution(...)`. Tests in
 * `tests/cfm-builders.test.ts` verify every builder produces the
 * exact expected shape for a canonical input set.
 *
 * No React, no @kadena/client, no crypto. Just string templating
 * with `formatDecimalForPact` for the amount fields. Works on
 * Node + browser + any JS environment.
 *
 * Naming convention. Each builder is `buildX_PactCode(params)`
 * where `X` is the Pact function name (C_Coil, C_Transfer, etc.).
 * Return type is always `string`.
 *
 * All Pact function names the ecosystem currently ships are covered.
 * When a new CFM modal lands, add its builder here + a test; don't
 * inline the Pact code in the modal.
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { formatDecimalForPact } from "@stoachain/stoa-core/pact";

// ─── TS01-C1 family (DPTF — Dynamic Pooled Token Functions) ──────────────────

/**
 * Transfer. The most-called CFM function across the UI — all 9
 * Transfer* modals emit this shape, differing only in token-id.
 *
 *   (ouronet-ns.TS01-C1.DPTF|C_Transfer
 *     <patron> <token-id> <sender> <receiver> <amount:decimal> <method:bool>)
 *
 * `method` is `false` for standard accounts and `true` for smart
 * accounts. `amount` is formatted to `x.y` decimal form.
 */
export function buildTransferPactCode(p: {
  patron:   string;
  tokenId:  string;
  sender:   string;
  receiver: string;
  amount:   string;
  method:   boolean;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C1.DPTF|C_Transfer "${p.patron}" "${p.tokenId}" "${p.sender}" "${p.receiver}" ${dec} ${p.method})`;
}

/**
 * Clear Ouroboros Dispo. Triggered when a resident has negative virtual
 * OURO; this zeroes the dispo by burning from the patron.
 *
 *   (ouronet-ns.TS01-C1.DPTF|C_ClearDispo <patron> <account>)
 */
export function buildClearDispoPactCode(p: {
  patron:  string;
  account: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C1.DPTF|C_ClearDispo "${p.patron}" "${p.account}")`;
}

// ─── TS01-C2.ORBR family (Ouroboros) ─────────────────────────────────────────

/**
 * Sublimate OURO → IGNIS. Patronless (gasless for the user —
 * STOA_AUTONOMIC_OURONETGASSTATION pays the chain gas). `target` is
 * usually the same as `client` (self-sublimate) but can be another
 * account for gift-style flows.
 *
 *   (ouronet-ns.TS01-C2.ORBR|C_Sublimate <client> <target> <amount:decimal>)
 */
export function buildSublimatePactCode(p: {
  client: string;
  target: string;
  amount: string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.ORBR|C_Sublimate "${p.client}" "${p.target}" ${dec})`;
}

/**
 * Compress IGNIS → OURO. Patronless, integer-valued amount only.
 * `formatDecimalForPact` still runs on the amount string because the
 * Pact `decimal` lexer rejects bare integers.
 *
 *   (ouronet-ns.TS01-C2.ORBR|C_Compress <client> <ignis-amount:decimal>)
 */
export function buildCompressPactCode(p: {
  client:      string;
  ignisAmount: string;
}): string {
  const dec = formatDecimalForPact(p.ignisAmount);
  return `(${KADENA_NAMESPACE}.TS01-C2.ORBR|C_Compress "${p.client}" ${dec})`;
}

// ─── TS01-C2.ATS family (Autostake Pools) ────────────────────────────────────

/**
 * Coil — deposit reward-token into an autostake pool.
 *
 *   (ouronet-ns.TS01-C2.ATS|C_Coil
 *     <patron> <coiler> <ats> <rt> <amount:decimal>)
 */
export function buildCoilPactCode(p: {
  patron:        string;
  coiler:        string;
  atsId:         string;
  rewardTokenId: string;
  amount:        string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Coil "${p.patron}" "${p.coiler}" "${p.atsId}" "${p.rewardTokenId}" ${dec})`;
}

/**
 * Curl — deposit reward-token through TWO autostake pools (e.g. OURO
 * through Auryndex + EliteAuryndex in one call).
 *
 *   (ouronet-ns.TS01-C2.ATS|C_Curl
 *     <patron> <curler> <ats1> <ats2> <rt> <amount:decimal>)
 */
export function buildCurlPactCode(p: {
  patron:        string;
  curler:        string;
  ats1Id:        string;
  ats2Id:        string;
  rewardTokenId: string;
  amount:        string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Curl "${p.patron}" "${p.curler}" "${p.ats1Id}" "${p.ats2Id}" "${p.rewardTokenId}" ${dec})`;
}

/**
 * Brumate — locked Curl. Same shape as Curl plus a `dayz` lock-period
 * integer.
 *
 *   (ouronet-ns.TS01-C2.ATS|C_Brumate
 *     <patron> <brumator> <ats1> <ats2> <rt> <amount:decimal> <dayz:integer>)
 */
export function buildBrumatePactCode(p: {
  patron:        string;
  brumator:      string;
  ats1Id:        string;
  ats2Id:        string;
  rewardTokenId: string;
  amount:        string;
  lockDays:      number;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Brumate "${p.patron}" "${p.brumator}" "${p.ats1Id}" "${p.ats2Id}" "${p.rewardTokenId}" ${dec} ${p.lockDays})`;
}

/**
 * Constrict — locked Coil. Same shape as Coil plus a `dayz` lock-period
 * integer.
 *
 *   (ouronet-ns.TS01-C2.ATS|C_Constrict
 *     <patron> <constricter> <ats> <rt> <amount:decimal> <dayz:integer>)
 */
export function buildConstrictPactCode(p: {
  patron:        string;
  constricter:   string;
  atsId:         string;
  rewardTokenId: string;
  amount:        string;
  lockDays:      number;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Constrict "${p.patron}" "${p.constricter}" "${p.atsId}" "${p.rewardTokenId}" ${dec} ${p.lockDays})`;
}

/**
 * Cold recovery — withdraw from an autostake pool with the full lockout
 * reward schedule.
 *
 *   (ouronet-ns.TS01-C2.ATS|C_ColdRecovery
 *     <patron> <recoverer> <ats> <ra:decimal>)
 */
export function buildColdRecoveryPactCode(p: {
  patron:    string;
  recoverer: string;
  atsId:     string;
  ra:        string;
}): string {
  const dec = formatDecimalForPact(p.ra);
  return `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_ColdRecovery "${p.patron}" "${p.recoverer}" "${p.atsId}" ${dec})`;
}

/**
 * Direct recovery — withdraw immediately with the smaller non-lockout
 * reward.
 *
 *   (ouronet-ns.TS01-C2.ATS|C_DirectRecovery
 *     <patron> <recoverer> <ats> <ra:decimal>)
 */
export function buildDirectRecoveryPactCode(p: {
  patron:    string;
  recoverer: string;
  atsId:     string;
  ra:        string;
}): string {
  const dec = formatDecimalForPact(p.ra);
  return `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_DirectRecovery "${p.patron}" "${p.recoverer}" "${p.atsId}" ${dec})`;
}

/**
 * Cull — harvest rewards from a single autostake pool position.
 *
 *   (ouronet-ns.TS01-C2.ATS|C_Cull <patron> <culler> <ats>)
 */
export function buildCullPactCode(p: {
  patron:  string;
  culler:  string;
  atsId:   string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C2.ATS|C_Cull "${p.patron}" "${p.culler}" "${p.atsId}")`;
}

// ─── TS01-C2.VST family (Virtual Stoa Tokens — GSTOA hibernation) ────────────

/**
 * Awake — wake a hibernated GSTOA nonce.
 *
 *   (ouronet-ns.TS01-C2.VST|C_Awake
 *     <patron> <awaker> <dpof> <nonce:integer>)
 */
export function buildAwakePactCode(p: {
  patron: string;
  awaker: string;
  dpof:   string;
  nonce:  number;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C2.VST|C_Awake "${p.patron}" "${p.awaker}" "${p.dpof}" ${p.nonce})`;
}

/**
 * Slumber — hibernate one or more GSTOA nonces. The `nonces` list is
 * rendered as Pact's `[n1 n2 n3]` integer-list literal.
 *
 *   (ouronet-ns.TS01-C2.VST|C_Slumber
 *     <patron> <merger> <dpof> <nonces:[integer]>)
 */
export function buildSlumberPactCode(p: {
  patron: string;
  merger: string;
  dpof:   string;
  nonces: number[];
}): string {
  const nonceList = `[${p.nonces.join(" ")}]`;
  return `(${KADENA_NAMESPACE}.TS01-C2.VST|C_Slumber "${p.patron}" "${p.merger}" "${p.dpof}" ${nonceList})`;
}

// ─── TS01-C2.LQD family (Wrap / Unwrap of native STOA + UrStoa) ──────────────

/**
 * Wrap STOA — convert native STOA → wSTOA. Payment key signs `coin.TRANSFER`
 * to LIQUIDPOT for the wrapped amount; patron + wrapper guards sign pure.
 *
 *   (ouronet-ns.TS01-C2.LQD|C_WrapStoa <patron> <wrapper> <amount:decimal>)
 *
 * `amount` is formatted via `formatDecimalForPact` (validates `/^\d+\.?\d*$/`
 * and pads decimal — closes the F-SEC-001 Pact-code injection vector by
 * making the field a clean numeric literal).
 */
export function buildWrapStoaPactCode(p: {
  patron:  string;
  wrapper: string;
  amount:  string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.LQD|C_WrapStoa "${p.patron}" "${p.wrapper}" ${dec})`;
}

/**
 * Wrap UrStoa — convert native UrStoa → wSTOA. Differs from WrapStoa in
 * the cap the payment key carries (`coin.UR|TRANSFER` instead of
 * `coin.TRANSFER`) — the Pact-code shape is otherwise structurally
 * identical, just a different function name on the same LQD module.
 *
 *   (ouronet-ns.TS01-C2.LQD|C_WrapUrStoa <patron> <wrapper> <amount:decimal>)
 */
export function buildWrapUrStoaPactCode(p: {
  patron:  string;
  wrapper: string;
  amount:  string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.LQD|C_WrapUrStoa "${p.patron}" "${p.wrapper}" ${dec})`;
}

// ─── Unwrap (LQD) — simple + composite-with-account-creation ──────────────────
//
// Two-shape builders. The simple shape runs when the user's target k:account
// already exists on the native chain. The composite shape runs when the
// target is a brand-new k: account that has to be coin-created in the same
// atomic Pact expression as the unwrap — needed because the unwrap PUSHES
// native STOA / UrStoa to the target, which must exist or the transfer
// aborts. The composite shape requires the call site to additionally
// `addData("ks", { keys: [<targetPubkey>], pred: "keys-all" })` so the
// embedded `(read-keyset "ks")` resolves at chain time.
//
// Cap structure (signed via the gas-station signer, NOT the patron):
//   - UnwrapStoa:    GAS_PAYER + coin.TRANSFER(LIQUIDPOT, target, amount)
//                    — the LIQUIDPOT releases native STOA to the target.
//   - UnwrapUrStoa:  GAS_PAYER only — no `coin.TRANSFER` needed because the
//                    unwrap happens entirely inside the Ouronet UrStoa
//                    module (DPTF → DPTF, no native-coin movement).
//
// Patron + unwrapper-account guards sign pure (no caps). In strategy.execute
// terms: `guards: [patronGuard, unwrapperGuard]`, `paymentKey: null`,
// build closure picks the right Pact-code shape based on a `targetExists`
// flag, and (when composite) sets `addData("ks", ...)` on the builder
// before `createTransaction()`.

/**
 * Unwrap STOA — convert wSTOA → native STOA (target k:account already exists).
 *
 *   (ouronet-ns.TS01-C2.LQD|C_UnwrapStoa <patron> <unwrapper> <amount:decimal>)
 */
export function buildUnwrapStoaPactCode(p: {
  patron:    string;
  unwrapper: string;
  amount:    string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.LQD|C_UnwrapStoa "${p.patron}" "${p.unwrapper}" ${dec})`;
}

/**
 * Unwrap STOA — composite shape that creates the target k:account inline
 * (via `coin.C_CreateAccount`) then executes the unwrap, all in one atomic
 * Pact expression. Call site MUST `addData("ks", { keys: [<targetPubkey>],
 * pred: "keys-all" })` on the builder so the embedded `(read-keyset "ks")`
 * resolves at chain time.
 *
 * Composite shape (multi-line for readability — emitted as one string):
 *
 *   (namespace "ouronet-ns")
 *   (IGNIS.C_Collect <patron> (IGNIS.UDC_CustomCodeCumulator))
 *   (let
 *     ((wp:string <unwrapper>) (target:string (DALOS.UR_AccountKadena wp)))
 *     [(coin.C_CreateAccount target (read-keyset "ks"))
 *      (TS01-C2.LQD|C_UnwrapStoa <patron> <unwrapper> <amount>)])
 */
export function buildUnwrapStoaWithCreateAccountPactCode(p: {
  patron:    string;
  unwrapper: string;
  amount:    string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return (
    `(namespace "${KADENA_NAMESPACE}")\n` +
    `(IGNIS.C_Collect "${p.patron}" (IGNIS.UDC_CustomCodeCumulator))\n` +
    `(let\n` +
    `  (\n` +
    `    (wp:string "${p.unwrapper}")\n` +
    `    (target:string (DALOS.UR_AccountKadena wp))\n` +
    `  )\n` +
    `  [\n` +
    `    (coin.C_CreateAccount target (read-keyset "ks"))\n` +
    `    (TS01-C2.LQD|C_UnwrapStoa "${p.patron}" "${p.unwrapper}" ${dec})\n` +
    `  ]\n` +
    `)`
  );
}

/**
 * Unwrap UrStoa — convert wURSTOA → native UrStoa (target k:account already exists).
 *
 *   (ouronet-ns.TS01-C2.LQD|C_UnwrapUrStoa <patron> <unwrapper> <amount:decimal>)
 */
export function buildUnwrapUrStoaPactCode(p: {
  patron:    string;
  unwrapper: string;
  amount:    string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(${KADENA_NAMESPACE}.TS01-C2.LQD|C_UnwrapUrStoa "${p.patron}" "${p.unwrapper}" ${dec})`;
}

/**
 * Unwrap UrStoa — composite shape that creates the target k:account via
 * `coin.C_UR|CreateAccount` (NOT `coin.C_CreateAccount` — UR is a separate
 * coin-module variant for UrStoa accounts) then executes the unwrap.
 * Same `addData("ks", ...)` requirement as `buildUnwrapStoaWithCreateAccountPactCode`.
 */
export function buildUnwrapUrStoaWithCreateAccountPactCode(p: {
  patron:    string;
  unwrapper: string;
  amount:    string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return (
    `(namespace "${KADENA_NAMESPACE}")\n` +
    `(IGNIS.C_Collect "${p.patron}" (IGNIS.UDC_CustomCodeCumulator))\n` +
    `(let\n` +
    `  (\n` +
    `    (wp:string "${p.unwrapper}")\n` +
    `    (target:string (DALOS.UR_AccountKadena wp))\n` +
    `  )\n` +
    `  [\n` +
    `    (coin.C_UR|CreateAccount target (read-keyset "ks"))\n` +
    `    (TS01-C2.LQD|C_UnwrapUrStoa "${p.patron}" "${p.unwrapper}" ${dec})\n` +
    `  ]\n` +
    `)`
  );
}

// ─── coin.C_URV family (StoaChain native UrStoa stake / unstake / collect) ───
//
// These are PURE StoaChain coin-module operations — no patron, no Ouronet
// account. The signer is the user's PAYMENT KEY, which carries both the
// `ouronet-ns.DALOS.GAS_PAYER` cap (so the user pays no gas — Ouronet gas
// station eats it) AND the `coin.URV|<OP>` cap that authorises the stake /
// unstake on that payment-key account. In strategy.execute() terms the build
// closure is: empty guards, `paymentKey` = the payment-key pub, capsKeyPub
// (selected by `selectCapsSigningKey` as the payment key when no guards
// compete for it) carries both caps as a single signer.

/**
 * Stake UrStoa — locks native UrStoa on the user's payment-key account.
 *
 *   (coin.C_URV|Stake <payment-key-account:string> <amount:decimal>)
 */
export function buildStakeUrStoaPactCode(p: {
  paymentKeyAddress: string;   // "k:<pub>"
  amount:            string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(coin.C_URV|Stake "${p.paymentKeyAddress}" ${dec})`;
}

/**
 * Unstake UrStoa — releases native UrStoa from the user's payment-key
 * stake back to the user's payment-key spendable balance. Symmetric to
 * Stake; the payment key carries `coin.URV|UNSTAKE` (NOT `STAKE`).
 *
 *   (coin.C_URV|Unstake <payment-key-account:string> <amount:decimal>)
 */
export function buildUnstakeUrStoaPactCode(p: {
  paymentKeyAddress: string;
  amount:            string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(coin.C_URV|Unstake "${p.paymentKeyAddress}" ${dec})`;
}

/**
 * Collect UrStoa — harvests accrued STOA earnings from the UrStoa Vault to
 * the user's payment-key coin account. Simple path: the payment-key coin
 * account already exists; the payment key carries `coin.URV|COLLECT`.
 *
 *   (coin.C_URV|Collect <payment-key-account:string>)
 *
 * For the case where the payment-key coin account does NOT yet exist,
 * see `buildCollectUrStoaWithCreateAccountPactCode` below — it builds the
 * 2-call composite that creates the account first and then collects.
 */
export function buildCollectUrStoaPactCode(p: {
  paymentKeyAddress: string;
}): string {
  return `(coin.C_URV|Collect "${p.paymentKeyAddress}")`;
}

/**
 * Collect UrStoa with account-creation — used when the payment-key coin
 * account doesn't yet exist on chain. Emits a 2-call composite Pact body:
 * the create-account call followed by the collect call. The keyset for
 * the new account is read from the "ks" data slot — the consumer is
 * responsible for `.addData("ks", { keys: [pubkey], pred: "keys-all" })`
 * on the transaction builder.
 *
 *   (coin.C_CreateAccount <payment-key> (read-keyset "ks"))
 *   (coin.C_URV|Collect    <payment-key>)
 *
 * Capability set on the build closure is identical to the simple path:
 * GAS_PAYER + `coin.URV|COLLECT` on the payment key. The composite is
 * a Pact-side ordering only — both calls execute in a single transaction.
 */
export function buildCollectUrStoaWithCreateAccountPactCode(p: {
  paymentKeyAddress: string;
}): string {
  return `(coin.C_CreateAccount "${p.paymentKeyAddress}" (read-keyset "ks"))\n(coin.C_URV|Collect "${p.paymentKeyAddress}")`;
}

// ─── coin.C_UR family (StoaChain native UrStoa transfer / transmit) ──────────
//
// Four Pact-code shapes, selected at runtime by `(receiverExists, isTransferFamily)`:
//
//   receiverExists  isTransferFamily  → builder
//   ──────────────  ────────────────  ────────────────────────────────────────
//   true            true              buildNativeUrTransferPactCode
//   true            false             buildNativeUrTransmitPactCode
//   false           true              buildNativeUrTransferAnewPactCode
//   false           false             buildNativeUrTransmitAnewPactCode
//
// The Anew variants take a 4th `(read-keyset "ks")` argument — the
// consumer MUST `addData("ks", { keys: [receiverPubKey], pred: "keys-all" })`
// on the transaction builder. The non-Anew variants take 3 args (no keyset).
//
// All four are signed by the payment key carrying `coin.UR|TRANSFER`
// (Transfer family) or just `coin.UR` (Transmit family) — the capability
// shape differs between families but the Pact-code shape only differs
// in the function name.

/**
 * Native UR Transfer — receiver-exists + Transfer-family branch.
 *
 *   (coin.C_UR|Transfer <sender> <receiver> <amount:decimal>)
 */
export function buildNativeUrTransferPactCode(p: {
  sender:   string;
  receiver: string;
  amount:   string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(coin.C_UR|Transfer "${p.sender}" "${p.receiver}" ${dec})`;
}

/**
 * Native UR Transmit — receiver-exists + Transmit-family branch.
 *
 *   (coin.C_UR|Transmit <sender> <receiver> <amount:decimal>)
 */
export function buildNativeUrTransmitPactCode(p: {
  sender:   string;
  receiver: string;
  amount:   string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(coin.C_UR|Transmit "${p.sender}" "${p.receiver}" ${dec})`;
}

/**
 * Native UR TransferAnew — receiver-does-not-exist + Transfer-family branch.
 * Reads the receiver keyset from the "ks" data slot; consumer must
 * `addData("ks", { keys: [receiverPubKey], pred: "keys-all" })`.
 *
 *   (coin.C_UR|TransferAnew <sender> <receiver> (read-keyset "ks") <amount:decimal>)
 */
export function buildNativeUrTransferAnewPactCode(p: {
  sender:   string;
  receiver: string;
  amount:   string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(coin.C_UR|TransferAnew "${p.sender}" "${p.receiver}" (read-keyset "ks") ${dec})`;
}

/**
 * Native UR TransmitAnew — receiver-does-not-exist + Transmit-family branch.
 * Same keyset contract as TransferAnew.
 *
 *   (coin.C_UR|TransmitAnew <sender> <receiver> (read-keyset "ks") <amount:decimal>)
 */
export function buildNativeUrTransmitAnewPactCode(p: {
  sender:   string;
  receiver: string;
  amount:   string;
}): string {
  const dec = formatDecimalForPact(p.amount);
  return `(coin.C_UR|TransmitAnew "${p.sender}" "${p.receiver}" (read-keyset "ks") ${dec})`;
}

// ─── TS01-C3.SWP family (Swap — Firestarter, ChangeOwnership) ────────────────

/**
 * Firestarter — wrap 10 native STOA → 10 wSTOA. One-time, gasless for
 * the user, payment key signs coin.TRANSFER.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_Firestarter <firestarter>)
 */
export function buildFirestarterPactCode(p: {
  firestarter: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_Firestarter "${p.firestarter}")`;
}

/**
 * ChangeOwnership — transfer ownership of an existing SWP-pair (liquidity
 * pool) from its current pool-owner to a new Ouronet account. Gated by
 * the pool's `can-change-owner` flag (must be true) and signed by the
 * patron + current pool-owner guards.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_ChangeOwnership
 *     <patron> <swpair> <new-owner>)
 */
export function buildChangeOwnershipPactCode(p: {
  patron:   string;
  swpair:   string;
  newOwner: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_ChangeOwnership "${p.patron}" "${p.swpair}" "${p.newOwner}")`;
}

/**
 * ModifyWeights — set new token weight ratios on a Weighted SWP-pair.
 * Weighted pools only (pool-type "W"). The new weights array length MUST
 * match the pool's token count, each value MUST be a decimal ≤4 fractional
 * digits, and the SUM MUST equal 1 exactly. UI enforces those constraints;
 * the chain enforces them again as a defense.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_ModifyWeights
 *     <patron> <swpair> <new-weights:[decimal]>)
 *
 * Pact list literal format: `[w1 w2 w3]` — space-separated, square-bracketed,
 * each value formatted via `formatDecimalForPact` (closes F-SEC-001 the
 * same way scalar amounts do).
 */
export function buildModifyWeightsPactCode(p: {
  patron:     string;
  swpair:     string;
  newWeights: string[];   // raw decimal strings; builder formats each
}): string {
  const weightList = `[${p.newWeights.map(w => formatDecimalForPact(w)).join(" ")}]`;
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_ModifyWeights "${p.patron}" "${p.swpair}" ${weightList})`;
}

/**
 * ToggleSwapCapability — flip the SWP-pair's swap-enabled flag (UI label
 * "Swapping"). Boolean MUST be the inverse of `UR_CanSwap` (chain rejects
 * same-value writes). Patron + current pool-owner guards sign pure.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_ToggleSwapCapability <patron> <swpair> <toggle:bool>)
 */
export function buildToggleSwapCapabilityPactCode(p: {
  patron: string;
  swpair: string;
  toggle: boolean;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_ToggleSwapCapability "${p.patron}" "${p.swpair}" ${p.toggle})`;
}

/**
 * ToggleAddLiquidity — flip the SWP-pair's add-liquidity-enabled flag
 * (UI label "Provisioning"). Boolean MUST be the inverse of `UR_CanAdd`
 * (chain rejects same-value writes). Patron + current pool-owner guards
 * sign pure.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_ToggleAddLiquidity <patron> <swpair> <toggle:bool>)
 */
export function buildToggleAddLiquidityPactCode(p: {
  patron: string;
  swpair: string;
  toggle: boolean;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_ToggleAddLiquidity "${p.patron}" "${p.swpair}" ${p.toggle})`;
}

/**
 * ModifyCanChangeOwner — flip the `can-change-owner` flag on a SWP-pair.
 * Signed by the patron + current pool-owner guards. The `newBoolean` arg
 * MUST be the inverse of the on-chain current value (the modal computes
 * it automatically; user does not type it). The chain rejects same-value
 * writes, so the new boolean is effectively the only allowed value.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_ModifyCanChangeOwner
 *     <patron> <swpair> <new-boolean:bool>)
 */
export function buildModifyCanChangeOwnerPactCode(p: {
  patron:     string;
  swpair:     string;
  newBoolean: boolean;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_ModifyCanChangeOwner "${p.patron}" "${p.swpair}" ${p.newBoolean})`;
}

// ─── TS01-C3.SWP family — liquidity-pool ops (Add / Remove / Fuel) ───────────
//
// `inputAmounts` is rendered as `[a1 a2 a3]` decimal-list literal — each
// amount routed through `formatDecimalForPact` so an integer "5" becomes
// "5.0" (Pact decimal lexer rejects bare integers in the decimal slot).
// AddLiquidity emits the full TS01-C3 path; the four "special" variants
// (Iced / Glacial / Frozen / Sleeping under TS01-CP.SWP) live in
// `addLiquidityFunctions.executeSpecialAddLiquidity` and are not yet
// surfaced by `AddLiquidityInterface.tsx` — builders for those will be
// added when their modals come online.

/**
 * Add Liquidity — deposit input-amounts into the SWP-pair pool in exchange
 * for LP tokens. `inputAmounts` is a per-pool-token decimal vector.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_AddLiquidity
 *     <patron> <account> <swpair> <inputAmounts:[decimal]>)
 */
export function buildAddLiquidityPactCode(p: {
  patron:       string;
  account:      string;
  swpair:       string;
  inputAmounts: string[];
}): string {
  const decimals = p.inputAmounts.map(a => formatDecimalForPact(a));
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_AddLiquidity "${p.patron}" "${p.account}" "${p.swpair}" [${decimals.join(" ")}])`;
}

/**
 * Remove Liquidity (Unfold) — burn LP tokens to recover the underlying
 * pool tokens in proportion to the burned LP share. Single `lpAmount`
 * decimal (not a list).
 *
 *   (ouronet-ns.TS01-C3.SWP|C_RemoveLiquidity
 *     <patron> <account> <swpair> <lp-amount:decimal>)
 */
export function buildRemoveLiquidityPactCode(p: {
  patron:   string;
  account:  string;
  swpair:   string;
  lpAmount: string;
}): string {
  const dec = formatDecimalForPact(p.lpAmount);
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_RemoveLiquidity "${p.patron}" "${p.account}" "${p.swpair}" ${dec})`;
}

// ─── TS01-C3.SWP family — swap ops (Single/Multi × With/No Slippage) ─────────
//
// Four shape variants; the modal picks one per click based on
// (1-vs-N inputs, slippage toggle):
//
//   Single + With → C_SingleSwapWithSlippage   (takes (read-msg 'slippage-bounds))
//   Single + No   → C_SingleSwapNoSlippage     (no slippage arg)
//   Multi  + With → C_MultiSwapWithSlippage    ([inputIds] [amounts] + slippage)
//   Multi  + No   → C_MultiSwapNoSlippage      ([inputIds] [amounts], no slippage)
//
// The two slippage variants pull `slippage-bounds` from the message data
// — the consumer must `.addData("slippage-bounds", boundsObj)` on the
// transaction builder; the bounds object itself is fetched separately
// via `getSlippageBounds(...)` before signing.

/**
 * Single-input swap WITH slippage protection.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_SingleSwapWithSlippage
 *     <patron> <account> <swpair> <inputId> <inputAmount:decimal> <outputId> (read-msg 'slippage-bounds))
 */
export function buildSingleSwapWithSlippagePactCode(p: {
  patron:      string;
  account:     string;
  swpair:      string;
  inputId:     string;
  inputAmount: string;
  outputId:    string;
}): string {
  const dec = formatDecimalForPact(p.inputAmount);
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_SingleSwapWithSlippage "${p.patron}" "${p.account}" "${p.swpair}" "${p.inputId}" ${dec} "${p.outputId}" (read-msg 'slippage-bounds))`;
}

/**
 * Single-input swap WITHOUT slippage protection.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_SingleSwapNoSlippage
 *     <patron> <account> <swpair> <inputId> <inputAmount:decimal> <outputId>)
 */
export function buildSingleSwapNoSlippagePactCode(p: {
  patron:      string;
  account:     string;
  swpair:      string;
  inputId:     string;
  inputAmount: string;
  outputId:    string;
}): string {
  const dec = formatDecimalForPact(p.inputAmount);
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_SingleSwapNoSlippage "${p.patron}" "${p.account}" "${p.swpair}" "${p.inputId}" ${dec} "${p.outputId}")`;
}

/**
 * Multi-input swap WITH slippage protection. `inputIds` and `inputAmounts`
 * are parallel arrays; each amount applies to the same-position id.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_MultiSwapWithSlippage
 *     <patron> <account> <swpair> <inputIds:[string]> <inputAmounts:[decimal]> <outputId> (read-msg 'slippage-bounds))
 */
export function buildMultiSwapWithSlippagePactCode(p: {
  patron:       string;
  account:      string;
  swpair:       string;
  inputIds:     string[];
  inputAmounts: string[];
  outputId:     string;
}): string {
  const idList  = `[${p.inputIds.map(id => `"${id}"`).join(" ")}]`;
  const amtList = `[${p.inputAmounts.map(a => formatDecimalForPact(a)).join(" ")}]`;
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_MultiSwapWithSlippage "${p.patron}" "${p.account}" "${p.swpair}" ${idList} ${amtList} "${p.outputId}" (read-msg 'slippage-bounds))`;
}

/**
 * Multi-input swap WITHOUT slippage protection.
 *
 *   (ouronet-ns.TS01-C3.SWP|C_MultiSwapNoSlippage
 *     <patron> <account> <swpair> <inputIds:[string]> <inputAmounts:[decimal]> <outputId>)
 */
export function buildMultiSwapNoSlippagePactCode(p: {
  patron:       string;
  account:      string;
  swpair:       string;
  inputIds:     string[];
  inputAmounts: string[];
  outputId:     string;
}): string {
  const idList  = `[${p.inputIds.map(id => `"${id}"`).join(" ")}]`;
  const amtList = `[${p.inputAmounts.map(a => formatDecimalForPact(a)).join(" ")}]`;
  return `(${KADENA_NAMESPACE}.TS01-C3.SWP|C_MultiSwapNoSlippage "${p.patron}" "${p.account}" "${p.swpair}" ${idList} ${amtList} "${p.outputId}")`;
}

// ─── TS02-Cx.DPSF/DPNF family (Token-Set creation) ───────────────────────────
//
// Two C_Make variants — SFT (semi-fungible, DPSF, TS02-C1) takes a
// `how-many-sets` integer; NFT (non-fungible, DPNF, TS02-C2) always
// creates exactly one set so the arg is omitted. Both take a nonces
// integer-list `[n1 n2 n3]` and an integer set-class. The nonces are
// emitted as bare integers — NOT decimals (no .0 padding).

/**
 * Create Set (SFT — semi-fungible). Bundles selected DPSF nonces into
 * `howManySets` sets of class `setClass`.
 *
 *   (ouronet-ns.TS02-C1.DPSF|C_Make
 *     <patron> <account> <id> <nonces:[integer]> <set-class:integer> <how-many-sets:integer>)
 */
export function buildCreateSetPactCode(p: {
  patron:      string;
  account:     string;
  tokenId:     string;
  nonces:      number[];
  setClass:    number;
  howManySets: number;
}): string {
  const noncesStr = `[${p.nonces.join(" ")}]`;
  return `(${KADENA_NAMESPACE}.TS02-C1.DPSF|C_Make "${p.patron}" "${p.account}" "${p.tokenId}" ${noncesStr} ${p.setClass} ${p.howManySets})`;
}

/**
 * Create Set (NFT — non-fungible). Bundles selected DPNF nonces into a
 * single set of class `setClass`. No `how-many-sets` parameter — NFT
 * sets are always 1×.
 *
 *   (ouronet-ns.TS02-C2.DPNF|C_Make
 *     <patron> <account> <id> <nonces:[integer]> <set-class:integer>)
 */
export function buildCreateSetNFTPactCode(p: {
  patron:   string;
  account:  string;
  tokenId:  string;
  nonces:   number[];
  setClass: number;
}): string {
  const noncesStr = `[${p.nonces.join(" ")}]`;
  return `(${KADENA_NAMESPACE}.TS02-C2.DPNF|C_Make "${p.patron}" "${p.account}" "${p.tokenId}" ${noncesStr} ${p.setClass})`;
}

// ─── TS01-C1.DALOS family (Smart Ouronet Account mutations) ──────────────────

/**
 * Rotate Sovereign — change the sovereign account that has primary
 * authority over a Smart Ouronet Account (Σ. prefix).
 *
 * Smart-account auth is `enforce-one` over three branches:
 *   (a) the Smart account's own guard,
 *   (b) the current sovereign account's guard,
 *   (c) the Smart account's governor.
 * Any one branch satisfying its predicate authorises the rotation.
 *
 *   (ouronet-ns.TS01-C1.DALOS|C_RotateSovereign
 *     <patron> <account> <new-sovereign>)
 *
 * `account` is the Σ. Smart account being modified. `new-sovereign`
 * must be an existing Standard Ouronet Account (Ѻ. prefix); the chain
 * rejects Σ. → Σ. rotations because Smart accounts cannot be
 * sovereigns themselves.
 *
 * Added in v1.6.0.
 */
export function buildRotateSovereignPactCode(p: {
  patron:       string;
  account:      string;
  newSovereign: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_RotateSovereign "${p.patron}" "${p.account}" "${p.newSovereign}")`;
}

/**
 * Rotate the GOVERNOR of a Smart Ouronet Account (Σ. prefix).
 *
 *   (ouronet-ns.TS01-C1.DALOS|C_RotateGovernor <patron> <account> <governor-expr>)
 *
 * Unlike the account GUARD — which the chain now restricts to key-based
 * guards (keyset / keyset-ref) — the governor slot is restricted to
 * NON-key-based guards (user / capability / module / pact). The
 * `governorExpr` is therefore a complete inline guard-construction
 * expression authored by the consumer, e.g.
 *
 *   (create-user-guard (ouronet-ns.U|G.UEV_Any [ (create-capability-guard ...) ... ]))
 *
 * Because the guard is inline (not read from a data slot), there is NO
 * `.addData("ks", …)` payload — contrast `buildRotateGuardPactCode`'s
 * "define" mode. The builder ONLY interpolates the expression; producing
 * a syntactically valid, non-key-based `governorExpr` is the caller's
 * responsibility (the chain rejects key-based governors).
 *
 * Added in v4.3.3.
 */
export function buildRotateGovernorPactCode(p: {
  patron:       string;
  account:      string;
  /** Complete inline guard-construction expression. Non-key-based only. */
  governorExpr: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_RotateGovernor "${p.patron}" "${p.account}" ${p.governorExpr})`;
}

/**
 * The five Pact built-in constructors that produce a NON-key-based guard.
 * These are the only guard kinds the chain accepts in a governor slot
 * (the account GUARD slot is the inverse — key-based only).
 */
export type NonKeyGuardConstructor =
  | "create-user-guard"
  | "create-capability-guard"
  | "create-capability-pact-guard"
  | "create-module-guard"
  | "create-pact-guard";

/**
 * Wrap a guard `body` expression in one of the five non-key-based guard
 * constructors, producing the inline `governorExpr` that
 * {@link buildRotateGovernorPactCode} interpolates:
 *
 *   buildNonKeyGuardExpr({ constructor: "create-user-guard",
 *                          body: "(ns.UG.UEV_Any (create-capability-guard ...))" })
 *   → "(create-user-guard (ns.UG.UEV_Any (create-capability-guard ...)))"
 *
 * `body` is the complete argument expression the constructor receives
 * (parens / brackets / quotes already included — for `create-module-guard`
 * and `create-pact-guard` that is a quoted name string `"name"`). The
 * builder does NOT validate or quote `body`; producing a syntactically
 * valid argument is the caller's responsibility.
 *
 * Added in v4.3.3.
 */
export function buildNonKeyGuardExpr(p: {
  constructor: NonKeyGuardConstructor;
  body:        string;
}): string {
  return `(${p.constructor} ${p.body})`;
}

// ─── TS01-C4.CODEX family (StoicTag registry) ────────────────────────────────

/**
 * Release the StoicTag currently bound to an Ouronet account.
 *
 *   (ouronet-ns.TS01-C4.CODEX|C_ReleaseStoicTag <patron> <tag-name>)
 *
 * `tag-name` is the BARE on-chain name (no § sigil — the sigil is a UI-only
 * marker). The chain resolves the account the tag is bound to and enforces
 * that account's ownership, so the consumer MUST sign with the bound account's
 * guard (in addition to the patron). The only cost is IGNIS, 1 per glyph of the
 * tag name; the amount is surfaced by `INFO_ReleaseStoicTag`.
 *
 * Added in v4.3.3.
 */
export function buildReleaseStoicTagPactCode(p: {
  patron:  string;
  tagName: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C4.CODEX|C_ReleaseStoicTag "${p.patron}" "${p.tagName}")`;
}

/**
 * Register (claim) a StoicTag for an Ouronet account.
 *
 *   (ouronet-ns.TS01-C4.CODEX|C_RegisterStoicTag <patron> <tag-name> <account-address>)
 *
 * `tag-name` is the BARE on-chain name (DALOS glyphs only, no § sigil).
 * `account-address` is the Ouronet account the tag is being applied to.
 *
 * This costs NATIVE STOA (1 per glyph, less the account's Elite-tier discount),
 * paid by the patron's payment key and split 10/20/30/40 across the protocol
 * receivers returned by `INFO_RegisterStoicTag`. The consumer MUST therefore
 * sign the payment key with `GAS_PAYER` + one `coin.TRANSFER` per split
 * receiver — otherwise the chain rejects the transaction.
 *
 * Added in v4.3.3.
 */
export function buildRegisterStoicTagPactCode(p: {
  patron:         string;
  tagName:        string;
  accountAddress: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C4.CODEX|C_RegisterStoicTag "${p.patron}" "${p.tagName}" "${p.accountAddress}")`;
}

/**
 * Rotate the GUARD (ownership keyset) of an Ouronet account.
 *
 *   (ouronet-ns.TS01-C1.DALOS|C_RotateGuard <patron> <account> <guard-expr> <safe>)
 *
 * The guard-expr is one of two shapes, switched by `mode`:
 *   - "define"   → `(read-keyset "ks")`        Consumer MUST also call
 *                                              `.addData("ks", { keys, pred })`
 *                                              on the transaction builder so
 *                                              the chain can read the keyset.
 *   - "existing" → `(keyset-ref-guard "<ref>")` References an on-chain
 *                                              registered keyset; no addData
 *                                              call is needed.
 *
 * The `safe` flag (boolean) is the chain-side "are you sure?" gate — when
 * `true` it enforces extra invariants on the new guard (e.g. that at least
 * one key in the new keyset is held by the account holder). Define mode
 * is always safe; existing mode lets the user opt-in/out.
 *
 * Added in v4.3.0.
 */
export function buildRotateGuardPactCode(p: {
  patron:    string;
  account:   string;
  mode:      "define" | "existing";
  /** Required when `mode === "existing"`. */
  keysetRef?: string;
  safe:      boolean;
}): string {
  const guardExpr =
    p.mode === "define"
      ? `(read-keyset "ks")`
      : `(keyset-ref-guard "${p.keysetRef ?? ""}")`;
  return `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_RotateGuard "${p.patron}" "${p.account}" ${guardExpr} ${p.safe})`;
}

/**
 * Rotate the Kadena Ledger payment key (= "payment key") of an Ouronet
 * account.
 *
 *   (ouronet-ns.TS01-C1.DALOS|C_RotateKadena <patron> <account> <new-payment-key>)
 *
 * Why "RotateKadena" not "RotatePaymentKey": the on-chain Pact function is
 * `C_RotateKadena` — the kadena-ledger payment key is what the on-chain
 * naming refers to. The builder name mirrors the Pact function for grep-
 * ability with chain logs; UI surfaces (e.g. ouronet-codex's
 * `<RotatePaymentKeyModal>`) use the more user-friendly "Payment Key".
 *
 * The consumer is responsible for `.addData("ks", { keys: patronGuard.keys,
 * pred: patronGuard.pred })` and (when patron ≠ account)
 * `.addData("ks-account", { keys: accountGuard.keys, pred: accountGuard.pred })`
 * on the transaction builder. This builder ONLY emits the Pact code.
 *
 * Added in v4.3.0.
 */
export function buildRotateKadenaPactCode(p: {
  patron:        string;
  account:       string;
  newPaymentKey: string;
}): string {
  return `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_RotateKadena "${p.patron}" "${p.account}" "${p.newPaymentKey}")`;
}

/**
 * Deploy / activate Standard Ouronet Account. Patronless function — the
 * Pact code does NOT take a patron argument; the deploying CodexPrime
 * Key #0 pays gas and signs the 4× coin.TRANSFER caps that fund the
 * receivers. The guard for the new account is read from the "ks" data
 * slot — consumer must `.addData("ks", { keys: <guardKeys>, pred: <guardPred> })`
 * on the transaction builder.
 *
 *   (ouronet-ns.TS01-C1.DALOS|C_DeployStandardAccount
 *     <account> (read-keyset "ks") <kadena-address> <public-key>)
 *
 * The 4 coin.TRANSFER capabilities one per kadena-split receiver are NOT
 * part of the Pact code — they're attached at signer level on the
 * gas-payer key, with the receiver list + amount list derived from the
 * INFO call's `kadena-targets` / `kadena-split` fields.
 */
export function buildDeployStandardAccountPactCode(p: {
  account:       string;
  kadenaAddress: string;
  publicKey:     string;
  /** Guard binding (default "define"). Mirrors buildRotateGuardPactCode:
   *   - "define"   → `(read-keyset "ks")` — consumer MUST `.addData("ks", …)`.
   *   - "existing" → `(keyset-ref-guard "<ref>")` — references an on-chain
   *                  named keyset; NO ks payload needed. Preserves the
   *                  keyset-ref guard type instead of expanding it to a
   *                  literal keyset. */
  mode?:      "define" | "existing";
  /** Required when `mode === "existing"`. */
  keysetRef?: string;
}): string {
  const guardExpr =
    p.mode === "existing"
      ? `(keyset-ref-guard "${p.keysetRef ?? ""}")`
      : `(read-keyset "ks")`;
  return `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_DeployStandardAccount "${p.account}" ${guardExpr} "${p.kadenaAddress}" "${p.publicKey}")`;
}

/**
 * Build the Pact code for C_DeploySmartAccount — Activate a Smart (Σ.) Ouronet
 * Account.
 *
 * On-chain signature (positional):
 *   (ouronet-ns.TS01-C1.DALOS|C_DeploySmartAccount
 *     <account> <guard:guard> <kadena> <sovereign> <public>)
 *
 * Identical to the Standard deploy except for ONE extra positional arg —
 * `sovereign` — inserted between `kadena` and `public`. The `guard` arg is the
 * account keyset, passed the same way as Standard via `(read-keyset "ks")`
 * (the consumer attaches the keyset with `addData("ks", { keys, pred })`).
 *
 * `sovereign` is an EXISTING Standard (Ѻ.) Ouronet account that holds the new
 * Smart account's sovereignty — the chain rejects Σ.→Σ. (a smart account can't
 * be its own sovereign).
 *
 * Signers/caps are identical to the Standard deploy: the gas-payer (CodexPrime
 * Key #0) carries DALOS.GAS_PAYER + N coin.TRANSFER (one per `kadena-split`
 * receiver from the INFO call), and the account keyset signs pure. None of that
 * is in the Pact code — it's attached at signer level, exactly as Standard.
 */
export function buildDeploySmartAccountPactCode(p: {
  account:       string;
  kadenaAddress: string;
  sovereign:     string;
  publicKey:     string;
  /** Guard binding (default "define") — see buildDeployStandardAccountPactCode.
   *   - "define"   → `(read-keyset "ks")` (consumer adds the ks payload).
   *   - "existing" → `(keyset-ref-guard "<ref>")` (named on-chain keyset). */
  mode?:      "define" | "existing";
  /** Required when `mode === "existing"`. */
  keysetRef?: string;
}): string {
  const guardExpr =
    p.mode === "existing"
      ? `(keyset-ref-guard "${p.keysetRef ?? ""}")`
      : `(read-keyset "ks")`;
  return `(${KADENA_NAMESPACE}.TS01-C1.DALOS|C_DeploySmartAccount "${p.account}" ${guardExpr} "${p.kadenaAddress}" "${p.sovereign}" "${p.publicKey}")`;
}
