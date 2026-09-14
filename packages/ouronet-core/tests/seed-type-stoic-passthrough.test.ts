/**
 * "stoic" passthrough — regression coverage for a real bug found while
 * wiring ouronet-codex's new Stoic seed path (see that package's
 * `types/entities.ts` SeedType + `CreateKadenaSeedModal.tsx`).
 *
 * `LocalStorageCodexAdapter.loadKadenaSeedsWithMigration` (ouronet-codex)
 * runs `migrateSeedType` on EVERY stored kadena seed on EVERY load, not
 * just legacy ones, and its catch-clause silently rewrites an unrecognized
 * seedType to "koala". Before this passthrough, a stoic seed would hit
 * that fallback on the very next codex reload — a stoic account would
 * silently start being treated (and mis-derived) as koala. This locks the
 * fix without touching the REQ-12/REQ-13-locked `SeedType` type or
 * `SEED_TYPE_MIGRATION` table (see `seedTypeMigration.ts`'s "stoic"
 * passthrough comment for the full reasoning).
 */
import { describe, it, expect } from "vitest";
import { migrateSeedType } from "../src/codex";

describe('migrateSeedType — "stoic" passthrough (temporary, pre-stoa-core-publish)', () => {
  it('returns "stoic" unchanged instead of throwing or falling back', () => {
    expect(migrateSeedType("stoic")).toBe("stoic");
  });

  it("is idempotent", () => {
    const once = migrateSeedType("stoic");
    const twice = migrateSeedType(once);
    expect(twice).toBe("stoic");
  });
});
