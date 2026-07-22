/**
 * Regression guard for the frozen-keyset mutation bug fixed in v4.3.2.
 *
 * `resolveGuard` / `getKadenaAccountGuard` previously did
 *   `const ks = await readKeyset(...); if (ks) ks.keysetRef = "...";`
 * i.e. they mutated the object handed back by `readKeyset`. Under
 * OuronetUI's cache-aware pactReader that object is a SHARED, FROZEN
 * reference, so the in-place write threw
 *   TypeError: Cannot assign to read only property 'keysetRef'
 * which rejected the `Promise.all` inside wallet-context's
 * `syncOuroAccounts`, aborting the sync before the displayed account
 * list / counts were ever updated. Symptom downstream: newly-spawned
 * Ouronet accounts never appeared in the Codex list.
 *
 * The fix returns a shallow copy (`{ ...ks, keysetRef }`) instead of
 * mutating. This test installs a pactReader that returns a *frozen*
 * keyset object (reproducing the cache's frozen reference) and asserts:
 *   1. neither helper throws,
 *   2. the returned object carries the resolved `keysetRef`,
 *   3. the original frozen keyset is left untouched (no `keysetRef`).
 *
 * Pre-fix this file throws at the `.keysetRef =` assignment; post-fix it passes.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import {
  resolveGuard,
  getKadenaAccountGuard,
} from "../src/interactions/ouroAccountFunctions";

// The frozen keyset the "chain read" returns — stands in for the shared,
// frozen reference OuronetUI's cache hands back for repeated describe-keyset
// reads. Frozen so any in-place `.keysetRef =` write throws in strict mode.
const FROZEN_KEYSET = Object.freeze({ keys: ["pub-a", "pub-b"], pred: "keys-all" });

/**
 * Reader stub:
 *   - describe-keyset  → the frozen keyset (the object that must NOT be mutated)
 *   - UR_AccountGuard  → a guard carrying a {keysetref:{ns,ksn}} ref so
 *                        getKadenaAccountGuard takes its resolve-the-ref branch
 */
const frozenKeysetReader: PactReader = (pactCode) => {
  if (pactCode.includes("describe-keyset")) {
    return Promise.resolve({ result: { status: "success", data: FROZEN_KEYSET } });
  }
  if (pactCode.includes("UR_AccountGuard")) {
    return Promise.resolve({
      result: {
        status: "success",
        data: { keysetref: { ns: "ouronet-ns", ksn: "my-keyset" } },
      },
    });
  }
  return Promise.resolve({ result: { status: "success", data: null } });
};

beforeEach(() => {
  setPactReader(frozenKeysetReader);
});

afterEach(() => {
  setPactReader(rawCalibratedDirtyRead);
});

describe("resolveGuard / getKadenaAccountGuard do not mutate a frozen keyset (v4.3.2)", () => {
  it("resolveGuard resolves a keyset-ref without throwing on a frozen read result", async () => {
    const out = await resolveGuard({ keysetref: { ns: "ouronet-ns", ksn: "my-keyset" } });

    expect(out).not.toBeNull();
    expect(out.keys).toEqual(["pub-a", "pub-b"]);
    expect(out.pred).toBe("keys-all");
    expect(out.keysetRef).toBe("ouronet-ns.my-keyset");

    // The shared frozen source must be left exactly as it was.
    expect(out).not.toBe(FROZEN_KEYSET);
    expect("keysetRef" in FROZEN_KEYSET).toBe(false);
  });

  it("getKadenaAccountGuard resolves the account's keyset-ref without throwing on a frozen read result", async () => {
    const out = await getKadenaAccountGuard("Ѻ.some-account");

    expect(out).not.toBeNull();
    expect(out?.keys).toEqual(["pub-a", "pub-b"]);
    expect(out?.pred).toBe("keys-all");
    expect((out as { keysetRef?: string })?.keysetRef).toBe("ouronet-ns.my-keyset");

    expect(out).not.toBe(FROZEN_KEYSET);
    expect("keysetRef" in FROZEN_KEYSET).toBe(false);
  });
});
