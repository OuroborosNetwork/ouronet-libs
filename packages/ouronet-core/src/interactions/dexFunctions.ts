/**
 * dexFunctions.ts
 *
 * Thin re-export shim for backward compat (Phase 1 of v4.2.0).
 *
 * The original 2663-line god file was split along Ouronet's locked seven-entity
 * taxonomy. Real logic now lives in entity-oriented files: dexSwapPair*Functions
 * (calc, execute, smart-swap, dashboard, admin), dexTrueFungibleFunctions,
 * dexOrtoFungibleFunctions, dexCollectablesFunctions, dexAcquisitionPoolFunctions,
 * dexParseFunctions, dexTypes. Every original symbol is reachable via this shim.
 */

export * from "./dexTypes.js";
export * from "./dexParseFunctions.js";
export * from "./dexSwapPairCalcFunctions.js";
export * from "./dexSwapPairExecuteFunctions.js";
export * from "./dexSwapPairSmartSwapFunctions.js";
export * from "./dexSwapPairDashboardFunctions.js";
export * from "./dexSwapPairAdminFunctions.js";
export * from "./dexTrueFungibleFunctions.js";
export * from "./dexOrtoFungibleFunctions.js";
export * from "./dexCollectablesFunctions.js";
export * from "./dexAcquisitionPoolFunctions.js";
export * from "./addLiquidityFunctions.js";
