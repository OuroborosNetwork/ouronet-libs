/**
 * Ouronet-specific protocol constants — the `ouronet-ns` Pact namespace,
 * the protocol-level autonomic accounts, the canonical token list.
 *
 * Lives in `@ouronet/ouronet-core/constants`. Pulled in by every
 * `interactions/*` file that constructs `${KADENA_NAMESPACE}.<module>.*`
 * Pact code, plus by the cfmBuilders Pact-code string assembler.
 *
 * Chain-generic constants (`KADENA_NETWORK`, `KADENA_CHAIN_ID`,
 * `getPactUrl`, `getSpvUrl`, `STOA_CHAIN_COUNT`, `STOA_CHAINS`,
 * `KADENA_CHAINS`) live in `@stoachain/stoa-core/constants` — they're
 * re-exported here for backwards-compatibility with internal imports
 * from `../constants` and pre-v4 consumer imports from
 * `@ouronet/ouronet-core/constants`. Public-API consumers SHOULD
 * import them from `@stoachain/stoa-core/constants` directly to make
 * the chain-generic vs Ouronet-specific boundary explicit.
 */

// Chain-generic re-exports (canonical home: @stoachain/stoa-core/constants)
export {
  KADENA_NETWORK,
  KADENA_CHAIN_ID,
  STOA_CHAIN_COUNT,
  STOA_CHAINS,
  KADENA_CHAINS,
  getPactUrl,
  getSpvUrl,
} from "@stoachain/stoa-core/constants";

/**
 * The Pact module namespace prefix for every Ouronet smart contract.
 * Every interaction file builds Pact code as `${KADENA_NAMESPACE}.<module>.*`.
 */
export const KADENA_NAMESPACE = "ouronet-ns";

// ─── Stoa Autonomic Accounts ───────────────────────────────────────────────
// Canonical names for all protocol-level Stoa accounts.
// Always reference these — never hardcode the address strings directly.

/** Ouroboros protocol account (staking/rewards engine) */
export const STOA_AUTONOMIC_OUROBOROS = "c:XM-pkmuB5XUQlp87ZYSbfKt8qzmHY6O2EHAzMRVBt3k";

/** LiquidPot account (native STOA vault — source of unwrapped tokens) */
export const STOA_AUTONOMIC_LIQUIDPOT = "c:ZNfuj3iZI83n7MUSKGuoXoSxFg1cyMxCzB3szUHVvrI";

/** Ouronet Gas Station (pays Kadena gas fees for all transactions) */
export const STOA_AUTONOMIC_OURONETGASSTATION = "c:iQQFWj6gWtpGEzhM_O5ekW1QtnQQy55R8BRPGhj_0FU";

// v4.0.0: removed deprecated aliases.
//   - `KADENA_BASE_URL` and `PACT_URL` (pinned to node2; use the failover
//     accessors `getPactUrl(chainId)` / `getSpvUrl(chainId)` from
//     `@stoachain/stoa-core/constants` instead — they delegate to the
//     v2.1.0 failover layer)
//   - `GAS_STATION` and `NATIVE_TOKEN_VAULT` (use the canonical
//     `STOA_AUTONOMIC_*` names above directly).

export const MAIN_TOKENS = [
  { id: "AURYN-8Nh-JO8JO4F5", name: "AURYN" },
  {
    id: "ELITEAURYN-8Nh-JO8JO4F5",
    name: "ELITEAURYN",
  },
  {
    id: "SSTOA-8Nh-JO8JO4F5",
    name: "SSTOA",
  },
  {
    id: "OURO-8Nh-JO8JO4F5",
    name: "OURO",
  },
  {
    id: "VST-8Nh-JO8JO4F5",
    name: "VST",
  },
];
