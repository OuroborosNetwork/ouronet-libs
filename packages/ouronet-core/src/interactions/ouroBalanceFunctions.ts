/**
 * ouroBalanceFunctions.ts
 * IGNIS / DPTF / OURO-dispo / virtual-OURO balance reads.
 * All four functions use catch-return-null per the v3.0.0 fabricated-fallbacks-removal contract.
 */

import { KADENA_NAMESPACE, TOKEN_ID_IGNIS } from "../constants/index.js";
import { mayComeWithDeimal } from "@stoachain/stoa-core/pact";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";

export const IGNIS_TOKEN_ID = TOKEN_ID_IGNIS;

/**
 * Get IGNIS (GAS) balance for an Ouronet account.
 * Uses DPTF.UR_AccountSupply with the IGNIS token ID.
 *
 * Returns the balance as a decimal string on success, or `null` when the
 * RPC call fails or the chain returns a non-success status. Consumers must
 * distinguish "no balance" (legitimate `"0"` from chain) from "RPC failure"
 * (`null`) — see v3.0.0 fabricated-fallbacks-removal.
 */
// All catch blocks below route via getLogger().error(...) from ../observability (F-CORE-019, v2.3.0)
export async function getIgnisBalance(account: string): Promise<string | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPTF.UR_AccountSupply "${IGNIS_TOKEN_ID}" "${account}")`;
    // T1, not T5 — this is a BALANCE read (the canonical tier mapping puts
    // balance reads at T1: high churn, very short TTL). At T5 the patron IGNIS
    // balance stayed stale right after a transfer, falsely blocking spends with
    // "Insufficient IGNIS" until a hard refresh.
    const response = await pactRead(pactCode, { tier: "T1" });

    if (response?.result?.status === "success") {
      return String(mayComeWithDeimal((response.result as any).data));
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getIgnisBalance:", error);
    return null;
  }
}

/**
 * Fetch DPTF token balance for any account via DPTF.UR_AccountSupply
 * (ouronet-ns.DPTF.UR_AccountSupply <token-id> <account>)
 *
 * Returns the balance as a decimal string on success, or `null` when the
 * RPC call fails or the chain returns a non-success status (v3.0.0).
 */
export async function getAccountTokenSupply(tokenId: string, account: string): Promise<string | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPTF.UR_AccountSupply "${tokenId}" "${account}")`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (response?.result?.status === "success") {
      return String(mayComeWithDeimal((response.result as any).data));
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getAccountTokenSupply:", error);
    return null;
  }
}

/**
 * Fetch OURO dispo capacity for an account -- how far it may overspend against its native
 * Elite-Auryn.
 *
 * REPOINTED 2026-09-26. This named `DALOS.UR_DISPOSupply`, which does not exist and never has:
 * DALOS declares `UR_DispoType` / `UR_DispoTDP` / `UR_DispoTDS`, all ZERO-ARG treasury
 * parameters, and nothing per-account. So every call was a resolution error caught by the
 * `catch` and reported as `null` -- indistinguishable, to a caller, from an account with no
 * capacity. It had zero callers, which is the only reason that never showed.
 *
 * The real reader is `O-UI-THREE.URC_Dispo`, verified on mainnet. It returns the whole dispo
 * card; `ouro-dispo-capacity-hover` is the raw number and `ouro-dispo-capacity` its formatted
 * string. This takes the RAW one -- a programmatic caller that wanted "0.0000" could format it,
 * while one handed the formatted string cannot get the precision back.
 *
 * Returns the capacity as a decimal string on success, or `null` when the RPC call fails or the
 * chain returns a non-success status (v3.0.0).
 */
export async function getOuroDispoCapacity(account: string): Promise<string | null> {
  try {
    const pactCode = `(at "ouro-dispo-capacity-hover"`
      + ` (${KADENA_NAMESPACE}.O-UI-THREE.URC_Dispo "${account}"))`;
    const response = await pactRead(pactCode, { tier: "T5" });

    if (response?.result?.status === "success") {
      return String(mayComeWithDeimal((response.result as any).data));
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getOuroDispoCapacity:", error);
    return null;
  }
}

/**
 * Fetch Virtual OURO balance for an account
 * (ouronet-ns.TFT.URC_VirtualOuro <account>)
 *
 * Returns the virtual balance as a decimal string on success, or `null` when
 * the RPC call fails or the chain returns a non-success status (v3.0.0).
 */
export async function getVirtualOuro(account: string): Promise<string | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.TFT.URC_VirtualOuro "${account}")`;
    const response = await pactRead(pactCode, { tier: "T5" });
    if (response?.result?.status === "success") {
      return String(mayComeWithDeimal((response.result as any).data));
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getVirtualOuro:", error);
    return null;
  }
}
