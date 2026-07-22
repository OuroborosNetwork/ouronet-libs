/**
 * useGetKeypair — returns a stable async function (pub) => IKadenaKeypair.
 *
 * THE function that OuronetUI's wallet-context exposes today as
 * `getKadenaKeyPairsByPublicKey`. Internally delegates to a per-hook
 * InternalCodexResolver bound to the current store. Throws
 * CodexLockedError when the codex is locked and CodexKeyMissingError
 * when the pubkey isn't in the codex.
 *
 * The returned function is memoised against the store identity — stable
 * across renders, so consumers can pass it to useEffect deps without
 * triggering infinite loops.
 */

import { useMemo } from "react";
import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";
import { useCodexStore } from "../provider/index.js";
import { InternalCodexResolver } from "../resolver/InternalCodexResolver.js";

export type GetKeypairFn = (publicKey: string) => Promise<IKadenaKeypair>;

export function useGetKeypair(): GetKeypairFn {
  const store = useCodexStore();
  return useMemo(() => {
    const resolver = new InternalCodexResolver(store);
    return (publicKey: string) => resolver.getKeyPairByPublicKey(publicKey);
  }, [store]);
}
