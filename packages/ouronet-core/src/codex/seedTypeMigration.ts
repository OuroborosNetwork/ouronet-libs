/**
 * Seed-type migration — the naming layer between historical codex blobs
 * and the current canonical names.
 *
 * Background. Early OuronetUI wallets were written with `seedType: "legacy"`
 * (Chainweaver-derived WASM path) and `seedType: "new"` (Koala HD-wallet
 * nacl path). When ecko-wallet landed the third variant got a clean name
 * ("eckowallet"), but the existing "legacy" / "new" strings stayed live in
 * users' localStorage. Rather than break those codexes we migrate on load:
 * `legacy → chainweaver`, `new → koala`, everything else passes through.
 *
 * Canonical seed types are `"koala" | "chainweaver" | "eckowallet"`. The
 * migration is idempotent — applying it twice yields the same result.
 *
 * Moved out of OuronetUI's WalletStorage in Phase 4. It had no business
 * being there; it's a pure string-to-string mapping that every codex
 * consumer (UI + future HUB) needs.
 */

import { UnknownSeedTypeError } from "./errors.js";
import type { SeedType } from "@stoachain/stoa-core/wallet";

export type { SeedType } from "@stoachain/stoa-core/wallet";

/** The string you might find in a raw codex blob — includes legacy names. */
export type RawSeedType = SeedType | "legacy" | "new" | string;

const SEED_TYPE_MIGRATION: Record<string, SeedType> = {
  "legacy":      "chainweaver",
  "new":         "koala",
  "chainweaver": "chainweaver",
  "koala":       "koala",
  "eckowallet":  "eckowallet",
};

/**
 * Migrate a raw seed-type string from a v1.x codex into a canonical SeedType.
 *
 * Throws `UnknownSeedTypeError` if the input is not in the recognized migration
 * map — strict-by-default contract per REQ-12 (F-BUG-010, v4.1.1). Replaces the
 * pre-v4.1.1 silent `|| "koala"` fallback that could route unknown seed types
 * through koala derivation, masking codex-import drift.
 *
 * TEMPORARY "stoic" passthrough — investigated + added while wiring
 * `ouronet-codex`'s new Stoic seed path (see that package's
 * `types/entities.ts` SeedType and `CreateKadenaSeedModal.tsx`). Without
 * this, `LocalStorageCodexAdapter.loadKadenaSeedsWithMigration` — which
 * runs `migrateSeedType` on EVERY stored kadena seed on EVERY load, not
 * just legacy ones — would throw `UnknownSeedTypeError` on a stoic seed
 * and its `catch` clause would silently rewrite `seedType` to `"koala"`,
 * corrupting a real user's stoic account on next reload. "stoic" is
 * intentionally NOT added as a row to `SEED_TYPE_MIGRATION` (below) or to
 * the `SeedType` type itself, because both are locked by
 * `v4-1-1-seed-type-dedup.test.ts` / `v4-1-1-type-preservation.test.ts`
 * (REQ-12/REQ-13), which require `SeedType` to stay a byte-identical
 * re-export of `@stoachain/stoa-core/wallet`'s own (currently 3-literal)
 * union — that union doesn't have "stoic" yet either (not published; see
 * `ouronet-codex/src/wallet/stoicDalosBridge.ts` for the sibling gap).
 * The `as SeedType` cast below is a narrow, documented lie to the type
 * system for this one literal only. Remove this special-case (folding
 * "stoic" into SEED_TYPE_MIGRATION as a normal self-mapping row instead)
 * once stoa-core publishes a SeedType that includes "stoic" and the two
 * locked tests above are updated to match.
 *
 * @param rawType - The seed-type string from the v1.x codex envelope
 * @returns Canonical SeedType ("koala" | "chainweaver" | "eckowallet"), or
 *   the "stoic" passthrough described above
 * @throws UnknownSeedTypeError when rawType is not in SEED_TYPE_MIGRATION
 *   and isn't the "stoic" passthrough
 */
export function migrateSeedType(rawType: string): SeedType {
  if (rawType === "stoic") return rawType as SeedType;
  const result = SEED_TYPE_MIGRATION[rawType];
  if (result === undefined) {
    throw new UnknownSeedTypeError(
      `Unknown seed type: "${rawType}". Expected one of: ${Object.keys(SEED_TYPE_MIGRATION).join(", ")}`
    );
  }
  return result;
}
