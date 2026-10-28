/**
 * @ouronet/talos-registry — the Ouronet callable surface, generated from the deployed contracts.
 *
 * A consumer supplies VALUES. It never types a function name, an argument order, or an arity.
 *
 * The registry is a BUNDLED SNAPSHOT, pinned at build time. That is deliberate: refreshing at
 * runtime would add a trust surface (whatever a node returns) and a failure mode (offline means
 * no registry) that a pinned artefact does not have. `surfaceHash` identifies exactly which
 * surface a build was compiled against.
 */
export { registry, surfaceHash, namespace, RegistryError,
         getEntrypoint, tryGetEntrypoint, getPreview,
         entrypointKeys, modules, entrypointsOfModule, resolveByName } from "./registry.js";
export { buildCall, buildPreviewCall, buildGhostCall } from "./build.js";
export type { BuildOptions } from "./build.js";
// CHAIN-NATIVE calls -- StoaChain's and Kadena's own `coin`, which the generated registry does
// not describe because it is not Ouronet's surface. Same by-name, by-declared-order contract.
export { buildNativeCall, nativeSignature, composeCalls } from "./native.js";
export { planCall, explainCall } from "./plan.js";
export type { CallPlan } from "./plan.js";
// MAY this call be split, and along which parameter -- and the splitter that does it. Kept here
// rather than in each consumer because the consuming app had four hand-rolled copies naming the
// parameters as string literals, and one call site with no cut at all.
export { splitPlan, splitCall, splitCallByCapacity } from "./split.js";
export type { SplitPlan } from "./split.js";
export { parseCapability, parseCapabilities, capabilityRecipe } from "./caps.js";
export type { ParsedCapability, CapabilityRecipe } from "./caps.js";
export { formatForType, formatDecimal, formatInteger, formatString, formatBool } from "./format.js";
// THE TOOLTIP CANON. Shared implementation rather than a shared document -- see TOOLTIP-CANON.md
// for why each rule exists, and `tooltip.ts` for the rules themselves.
export { tooltipModel, tooltipModels, signatureRows, chainOf, isOffRegistryKey,
         isNativeKey, isPlaceholder, PLACEHOLDER,
         CHAIN_PALETTE, CHAIN_LABEL, CONSUMERS,
         STOA_SIGNATURES, KADENA_SIGNATURES, NATIVE_SIGNATURES,
         paramRole, paramsByRole, unfilledFillable } from "./tooltip.js";
export type { TooltipModel, TooltipSlot, TooltipPreview, Chain,
              ConsumerIdentity, ParamRole } from "./tooltip.js";
export type * from "./types.js";
