/**
 * dexTypes.ts
 * Cross-cutting interface and type-alias definitions for the DEX entity files.
 * Sole non-local re-export: IKadenaKeypair from @stoachain/stoa-core/signing.
 */

export type { IKadenaKeypair } from "@stoachain/stoa-core/signing";

import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";

// Interface definitions for keypair types
export interface IOuroAccountKeypair {
  readonly address: string;
  readonly publicKey: string;
  readonly privateKey?: string;
}

// Type definitions for DEX data structures
export interface DecimalValue {
  readonly decimal: string;
}

export interface SwapPoolData {
  readonly "liquid-fee": number;
  readonly "lp-fee": number;
  readonly "lp-supply": DecimalValue;
  readonly "special-fee": number;
  readonly "special-fee-targets-short": readonly string[];
  readonly "pool-value-in-dwk": DecimalValue;
  readonly "special-fee-targets": readonly string[];
  readonly "tvl-in-$": string;
  readonly "lp-value-in-$": string;
  readonly "pool-type": string;
  readonly "special-fee-targets-proportions": readonly number[];
  readonly "pool-type-word": string;
  readonly "pool-token-supplies": readonly DecimalValue[];
  readonly "lp-value-in-dwk": DecimalValue;
  readonly "total-fee": number;
  readonly "pool-tokens": readonly string[];
}

// Enhanced Pool Data with additional dashboard-specific fields
export interface PoolPreviewData {
  readonly "liquid-fee": number;
  readonly "lp-fee": number;
  readonly "lp-supply": DecimalValue;
  readonly "special-fee": number;
  readonly "special-fee-targets-short": readonly string[];
  readonly "pool-value-in-dwk": DecimalValue;
  readonly "special-fee-targets": readonly string[];
  readonly "tvl-in-$": string;
  readonly "lp-value-in-$": string;
  readonly "pool-type": string;
  readonly "special-fee-targets-proportions": readonly number[];
  readonly "pool-type-word": string;
  readonly "pool-token-supplies": readonly DecimalValue[];
  readonly "lp-value-in-dwk": DecimalValue;
  readonly "total-fee": number;
  readonly "pool-tokens": readonly string[];
  // Enhanced dashboard-specific fields
  readonly "ft-pool-value-in-dwk": string;        // Formatted pool value
  readonly "ft-lp-supply": string;                // Formatted LP supply
  readonly "ft-lp-value-in-dwk": string;          // Formatted LP value in DWK
  readonly "ft-pool-token-supplies": readonly string[];    // Formatted token supplies
  readonly "weigths": readonly number[];                   // Pool weights (note: typo in API "weigths")
}

// Internal Pool Dashboard Data - comprehensive pool statistics
export interface SwpairInternalDashboard {
  readonly "special-fee-target-proportions": readonly number[];
  readonly "primality": string;
  readonly "liquid-fee": number;
  readonly "lp-fee": number;
  readonly "lp-supply": DecimalValue;
  readonly "special-fee": number;
  readonly "ft-pool-value-in-dwk": string;
  readonly "special-fee-targets-short": readonly string[];
  readonly "pool-value-in-dwk": DecimalValue;
  readonly "special-fee-targets": readonly string[];
  readonly "tvl-in-$": string;
  readonly "fee-lockup": string;
  readonly "swapping-enabled": string;
  readonly "ft-lp-supply": string;
  readonly "genesis-supplies": readonly number[];
  readonly "liquidity-enabled": string;
  readonly "genesis-weights": readonly number[];
  readonly "lp-value-in-$": string;
  readonly "pool-type": string;
  readonly "amplifier": number;
  readonly "ft-genesis-supplies": readonly string[];
  readonly "pool-type-word": string;
  readonly "ft-lp-value-in-dwk": string;
  readonly "pool-token-supplies": readonly DecimalValue[];
  readonly "ft-pool-token-supplies": readonly string[];
  readonly "lp-value-in-dwk": DecimalValue;
  readonly "fee-unlocks": {
    readonly "int": number;
  };
  readonly "weigths": readonly number[];
  readonly "frozen-and-sleeping": string;
  readonly "total-fee": number;
  readonly "pool-tokens": readonly string[];
}

// Direct Swap Calculation Result
export interface SwapCalculationResult {
  readonly "output-amount": string; // "WSTOA-8Nh-JO8JO4F5 Output: 28.633136871920000000000000"
  readonly "to-liquidity-providers": readonly string[]; // ["SSTOA... from Input to Liquidity Providers: 0.0000829749299355716637", ...]
  readonly "to-liquid-boost": string; // "WSTOA-8Nh-JO8JO4F5 from Raw Output to Liquid Boost: 0.059911020479"
  readonly "to-special-targets": string; // "WSTOA-8Nh-JO8JO4F5 from Raw Output to Special Targets: 0.119822040958"
}

// Reverse Swap Calculation Result
export interface InverseSwapResult {
  readonly [key: string]: any; // Will define structure after seeing API response
}

// Capped Inverse Swap Result (75% supply limit)
export interface CappedInverseResult {
  readonly decimal: string;
}

// User Account Token Balances for a specific swap pair
export interface UserAccountSupplies {
  readonly [key: string]: any; // Will define structure after seeing API response
}

export interface SwapLiquidityProviderItem {
  readonly token: string;
  readonly amount: number;
}

export interface SwapLiquidityProviderItemPrecise {
  readonly token: string;
  readonly amount: string;
}

// Swap Execution Parameters
export interface SwapExecutionParams {
  readonly patronKeypair: IOuroAccountKeypair; // OURO account keypair for patron
  readonly kadenaKeypair: IKadenaKeypair; // Kadena account for gas payments
  readonly guardKeypair: IKadenaKeypair; // Guard keypair for the patron account
  readonly account: string; // User account address
  readonly swpair: string; // Pool ID
  readonly outputId: string; // Output token ID
}

/**
 * Slippage bounds object returned by SWPU.UDC_SpawnSlippageBounds
 */
export interface SlippageBounds {
  readonly "expected-output-amount": number;
  readonly "output-precision": number;
  readonly "slippage-percent": number;
}

/**
 * Return type for SmartSwap hopper preview
 */
export interface SmartSwapHopper {
  readonly "output-amount"?: any;
  readonly "best-output"?: any;
  readonly "output"?: any;
  readonly "hops"?: number | { readonly int: number };
  readonly "trace"?: readonly string[];
  readonly "nodes"?: readonly string[];
  readonly "edges"?: readonly string[];
  readonly [key: string]: any;
}

/**
 * Return type for SmartSwap slippage bounds
 */
export interface SmartSwapSlippageBounds {
  readonly "expected-output-amount": DecimalValue | number;
  readonly "output-precision": { readonly int: number } | number;
  readonly "slippage-percent": DecimalValue | number;
}

/**
 * SmartSwap execution params
 */
export interface SmartSwapExecutionParams {
  readonly patronKeypair: IOuroAccountKeypair;
  readonly kadenaKeypair: IKadenaKeypair;
  readonly guardKeypair: IKadenaKeypair;
  readonly account: string;
  readonly inputId: string;
  readonly inputAmount: string | number;
  readonly outputId: string;
  readonly slippage?: number;
}

/** Response shape from URC_0008b_TrueFungibleLPEntry */
export interface TrueFungibleLPEntry {
  readonly t1: string;
  readonly t2: string;
  readonly "wallet-supply": { readonly decimal: string } | number;
  readonly "dptf-supply": { readonly decimal: string } | number;
  readonly "wallet-worth-in-stoa": { readonly decimal: string } | number;
  readonly "wallet-worth-in-dollarz": string;
  readonly "token-worth-in-stoa": { readonly decimal: string } | number;
  readonly "token-worth-in-dollarz": string;
}

/**
 * Response shape from URC_0016_TruefungibleHeader
 */
export interface TrueFungibleHeaderData {
  readonly "total-true-fungible-number": number | { readonly int: number };
  readonly "held-tf": readonly string[];
  readonly "held-tf-number": number | { readonly int: number };
  readonly "mngd-tf": readonly string[];
  readonly "mngd-tf-number": number | { readonly int: number };
}

/**
 * Response shape from URC_0008a_TrueFungibleEntry (Native/Frozen/Reserved tokens)
 */
export interface TrueFungibleEntryData {
  readonly t1: string;          // display name
  readonly t2: string;          // token ID
  readonly "wallet-supply": { readonly decimal: string } | number;
  readonly "dptf-supply": { readonly decimal: string } | number;
  readonly "wallet-worth-in-stoa": { readonly decimal: string } | number;
  readonly "wallet-worth-in-dollarz": string;
  readonly "token-worth-in-stoa": { readonly decimal: string } | number;
  readonly "token-worth-in-dollarz": string;
}

/**
 * Response shape from URC_0017_TruefungibleButton
 * Boolean per action key — true = button enabled, false = disabled.
 * where-* keys provide target pool info for coil/curl/constrict/brumate.
 */
export interface TrueFungibleButtonState {
  readonly mint: boolean;
  readonly burn: boolean;
  readonly wipe: boolean;
  readonly unfold: boolean;
  readonly freeze: boolean;
  readonly reserve: boolean;
  readonly vest: boolean;
  readonly sleep: boolean;
  readonly hibernate: boolean;
  readonly coil: boolean;
  readonly curl: boolean;
  readonly constrict: boolean;
  readonly brumate: boolean;
  readonly recover: boolean;
  readonly sublimate: boolean;
  readonly compress: boolean;
  readonly transmute: boolean;
  readonly unwrap: boolean;
  readonly transfer: boolean;
  readonly "where-coil"?: any;
  readonly "where-curl"?: any;
  readonly "where-constrict"?: any;
  readonly "where-brumate"?: any;
}

export interface OrtoFungibleHeaderData {
  readonly "total-orto-fungible-number": number | { readonly int: number };
  readonly "total-orto-fungible-nonces": number | { readonly int: number };
  readonly "held-of": readonly string[];
  readonly "held-of-number": number | { readonly int: number };
  readonly "mngd-of": readonly string[];
  readonly "mngd-of-number": number | { readonly int: number };
}

/**
 * OrtoFungible token category, classified from the token-id prefix:
 * Sleeping LP: Z|S|, Z|W|, Z|P|
 * Vesting:     V|
 * Sleeping:    Z| (but NOT Z|S|, Z|W|, Z|P|)
 * Hibernating: H|
 * Native:      everything else
 */
export type OrtoFungibleCategory = "native" | "vesting" | "sleeping" | "hibernating" | "sleeping-lp";

/**
 * Response shape from URC_0009a_OrtoFungibleEntryMapper
 * Same as TrueFungibleEntryData but with extra "wallet-nonces" field.
 */
export interface OrtoFungibleEntryData {
  readonly t1: string;          // display name
  readonly t2: string;          // token ID
  readonly "wallet-supply": { readonly decimal: string } | number;
  readonly "dpof-supply": { readonly decimal: string } | number;
  readonly "wallet-worth-in-stoa": { readonly decimal: string } | number;
  readonly "wallet-worth-in-dollarz": string;
  readonly "token-worth-in-stoa": { readonly decimal: string } | number;
  readonly "token-worth-in-dollarz": string;
  readonly "wallet-nonces": readonly number[];               // list of nonce integers
  readonly "wallet-nonces-no": number | { readonly int: number }; // count of nonces
}

/**
 * Hibernating nonce data — custom metadata for hibernating tokens.
 * Returns: { dptf-id, nonce-supply, mint-time, release-time, hibernating-fee-promile, remainder, hibernating-fee }
 */
export interface HibernatingNonceData {
  readonly "dptf-id": string;
  readonly "nonce-supply": { readonly decimal: string } | number;
  readonly "mint-time": string; // Pact time
  readonly "release-time": string; // Pact time
  readonly "hibernating-fee-promile": { readonly decimal: string } | number;
  readonly "remainder": { readonly decimal: string } | number;
  readonly "hibernating-fee": { readonly decimal: string } | number;
}

export interface OrtofungibleButtonState {
  readonly transfer: boolean;
  readonly transmit: boolean;
  readonly redeem: boolean;
  readonly "reverse-hrbt": boolean;
  readonly unvest: boolean;
  readonly unsleep: boolean;
  readonly merge: boolean;
  readonly awake: boolean;
  readonly slumber: boolean;
  readonly wipe: boolean;
  readonly burn: boolean;
  readonly mint: boolean;
  readonly "add-quantity": boolean;
  readonly [key: string]: boolean;
}

export interface CollectablesHeaderData {
  readonly "total-semi-fungible-number": number | { readonly int: number };
  readonly "total-semi-fungible-nonces": number | { readonly int: number };
  readonly "held-sf": readonly string[];
  readonly "held-sf-number": number | { readonly int: number };
  readonly "mngd-sf": readonly string[];
  readonly "mngd-sf-no": number | { readonly int: number };
  readonly "total-non-fungible-number": number | { readonly int: number };
  readonly "total-non-fungible-nonces": number | { readonly int: number };
  readonly "held-nf": readonly string[];
  readonly "held-nf-number": number | { readonly int: number };
  readonly "mngd-nf": readonly string[];
  readonly "mngd-nf-no": number | { readonly int: number };
}

export interface CollectableNonceEntry {
  readonly nonce: number | { readonly int: number };
  readonly supply: number | { readonly decimal: string } | { readonly int: number };
}

export interface CollectableEntryData {
  readonly t1: string;   // name
  readonly t2: string;   // dpdc-id
  readonly "wallet-nonces": readonly CollectableNonceEntry[];
  readonly "wallet-nonces-no": number | { readonly int: number };
}

export interface NonceMetaData {
  readonly score: number;
  readonly composition: readonly number[];
  readonly "meta-data": Readonly<Record<string, any>>;
}

export interface URIType {
  readonly image: boolean;
  readonly audio: boolean;
  readonly video: boolean;
  readonly document: boolean;
  readonly archive: boolean;
  readonly model: boolean;
  readonly exotic: boolean;
}

export interface URIData {
  readonly image: string;
  readonly audio: string;
  readonly video: string;
  readonly document: string;
  readonly archive: string;
  readonly model: string;
  readonly exotic: string;
}

export interface NonceData {
  readonly royalty: number;
  readonly ignis: number;
  readonly name: string;
  readonly description: string;
  readonly "meta-data": NonceMetaData;
  readonly "asset-type": URIType;
  readonly "uri-primary": URIData;
  readonly "uri-secondary": URIData;
  readonly "uri-tertiary": URIData;
}

export interface SetAllowedNonceForPosition {
  readonly "allowed-nonces": readonly number[] | ReadonlyArray<number | { readonly int: number }>;
}

export interface SetAllowedClassForPosition {
  readonly "allowed-sclass": number | { readonly int: number };
}

export interface SetDefinition {
  readonly "set-class": number | { readonly int: number };
  readonly "set-name": string;
  readonly "set-score-multiplier": number | { readonly decimal: string };
  readonly "nonce-of-set": number | { readonly int: number };
  readonly "iz-active": boolean;
  readonly "primordial": boolean;
  readonly "composite": boolean;
  readonly "primordial-set-definition": readonly SetAllowedNonceForPosition[];
  readonly "composite-set-definition": readonly SetAllowedClassForPosition[];
  readonly "nonce-data": any;
  readonly "split-data": any;
}

export interface CollectablesButtonState {
  readonly morph: boolean;
  readonly "add-quantity": boolean;
  readonly burn: boolean;
  readonly respawn: boolean;
  readonly wipe: boolean;
  readonly fuse: boolean;
  readonly split: boolean;
  readonly "break-set": boolean;
  readonly transfer: boolean;
  readonly [key: string]: boolean;
}
