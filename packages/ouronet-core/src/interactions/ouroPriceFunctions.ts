/**
 * ouroPriceFunctions.ts
 * Price oracle (STOA/USD), coin-account existence probe, DPTF issue/min-move reads.
 * All four functions follow the v3.0.0 nullable contract — return null on RPC failure or non-finite value.
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { mayComeWithDeimal } from "@stoachain/stoa-core/pact";
import { pactRead } from "@stoachain/stoa-core/reads";
import { getLogger } from "@stoachain/stoa-core/observability";

/**
 * Read the live STOA/USD price from the on-chain KDA-PID oracle.
 *
 * Returns `null` when the oracle is unreachable, the chain call returns a
 * non-success status, or the decoded value is not a finite number. Callers
 * are expected to handle the nullable contract explicitly — no fabricated
 * fallback price is ever returned.
 */
export async function getStoaPriceUSD(options?: { skipTempWatcher?: boolean }): Promise<number | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.U|CT.UR|KDA-PID)`;
    const response = await pactRead(pactCode, { tier: "T6", skipTempWatcher: options?.skipTempWatcher });
    if (response?.result?.status === "success") {
      const value = Number(mayComeWithDeimal((response.result as any).data));
      return Number.isFinite(value) ? value : null;
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getStoaPriceUSD:", error);
    return null;
  }
}

/**
 * Check if a coin account exists.
 * (try false (coin.get-balance <address>))
 * Returns: true = exists, false = doesn't exist, null = error
 */
export async function checkCoinAccountExists(address: string): Promise<boolean | null> {
  try {
    const pactCode = `(try false (coin.get-balance "${address}"))`;
    const response = await pactRead(pactCode, { tier: "T3" });
    const data = (response?.result as any)?.data;
    if (data === false || data === "false") return false;
    if (typeof data === "number" || (data && typeof data === "object" && "decimal" in data)) return true;
    return false;
  } catch (error) {
    getLogger().error("Error checking coin account:", error);
    return null;
  }
}

/**
 * Get INFO for UnwrapStoa function.
 * (ouronet-ns.INFO-ONE.LIQUID|INFO_UnwrapStoa <patron> <unwrapper> <amount:decimal>)
 */
export async function getDPTFIssueInfo(
  patron: string,
  resident: string,
  tokens: string[]
): Promise<any | null> {
  try {
    const tokenList = tokens.map(t => `"${t}"`).join(" ");
    const pactCode = `(${KADENA_NAMESPACE}.INFO-ONE.DPTF|INFO_Issue "${patron}" "${resident}" [${tokenList}])`;
    const response = await pactRead(pactCode, { tier: "T2" });
    if (response?.result?.status === "success") return (response.result as any).data;
    return null;
  } catch (error) {
    getLogger().error("Error in getDPTFIssueInfo:", error);
    return null;
  }
}

/**
 * Fetch the minimum transfer amount for a DPTF token.
 * (ouronet-ns.DPTF.UR_MinMove <token-id>) → decimal
 *
 * Returns null when the chain read returns a non-success status, when the
 * outer call throws, or when the decoded value is not a finite number.
 * Callers must handle the nullable contract explicitly — no fabricated
 * sentinel (previously `0`) is ever returned, since `0` is also a valid
 * legitimate min-move and would mask read failures.
 */
export async function getDPTFMinMove(tokenId: string): Promise<number | null> {
  try {
    const pactCode = `(${KADENA_NAMESPACE}.DPTF.UR_MinMove "${tokenId}")`;
    const response = await pactRead(pactCode, { tier: "T7" });
    if (response?.result?.status === "success") {
      const value = parseFloat(String(mayComeWithDeimal((response.result as any).data)));
      return Number.isFinite(value) ? value : null;
    }
    return null;
  } catch (error) {
    getLogger().error("Error in getDPTFMinMove:", error);
    return null;
  }
}
