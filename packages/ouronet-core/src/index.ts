/**
 * `@ouronet/ouronet-core` — Ouronet protocol business logic on top of
 * `@stoachain/stoa-core`.
 *
 * This root entry is intentionally near-empty. Consumers MUST reach
 * the domain layers through subpath exports, which the package.json
 * `exports` field enumerates:
 *
 *   import { ... } from "@ouronet/ouronet-core/codex";
 *   import { ... } from "@ouronet/ouronet-core/interactions";
 *   import { COIL_CONFIGS } from "@ouronet/ouronet-core/interactions/coilFunctions";
 *   // ... etc.
 *
 * Chain-generic infrastructure (signing, wallet, crypto, network, gas,
 * guard, reads, observability, dalos, errors) lives in
 * `@stoachain/stoa-core` and is consumed via its subpaths.
 */
export {};
