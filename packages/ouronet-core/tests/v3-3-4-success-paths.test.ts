/**
 * v3.3.4 — success-path tests for the 13 v3.0.0 nullable-widened functions
 *           that previously had only RPC-failure-path coverage.
 *
 * Closes audit finding F-TEST-005 (MEDIUM, testing-auditor).
 *
 * Background
 * ----------
 * v3.0.0's "fabricated-fallbacks-removal" sweep widened 16 read-side
 * interaction functions from `Promise<T>` → `Promise<T | null>`,
 * replacing each fabricated sentinel (`1.0` / `8` / `0` / `"0"` /
 * `"N/A"`) with `null` on RPC failure. Every one of those 16 got a
 * null-path test asserting `expect(out).toBeNull()` when `pactRead`
 * threw or the chain returned a `failure` status. But the audit
 * found that **only 3 of the 16 had a paired success-path test** —
 * one for `getStoaPriceUSD` in `tests/interactions-pricing.test.ts`,
 * one for `getLPTypeInfo` per-flag granularity in
 * `tests/interactions-balance-cluster.test.ts`, and one for
 * `getUrStoaGuard`'s 3-state contract in the same file. The other 13
 * could not distinguish "always returns null" (silent regression)
 * from "returns null only on RPC failure" (correct contract). A
 * future bug that returned `null` unconditionally — e.g. a flipped
 * `if (response?.result?.status === "success")` to `!== "success"`
 * — would slip past the test suite, surface only at consumer
 * runtime, and be caught only by chain-side breakage.
 *
 * What this file locks (13 it-blocks across 6 describe groups):
 *
 *   1. Pricing-quartet (3 it-blocks — `getStoaPriceUSD` already
 *      covered): `getTokenDecimals` parses `{int: "12"}` → `12`;
 *      `getPoolTotalFee` parses `{decimal: "0.003"}` → `0.003`;
 *      `getDPTFMinMove` parses `{decimal: "0.0001"}` → `0.0001`.
 *   2. String-balance cluster (4 it-blocks — none previously
 *      covered): `getIgnisBalance`, `getAccountTokenSupply`,
 *      `getOuroDispoCapacity`, `getVirtualOuro` each unwrap a
 *      `{decimal: "..."}` payload to the underlying string via
 *      `mayComeWithDeimal`. Locks the contract that a successful
 *      read with a non-zero decimal returns the parsed string —
 *      NOT `null`, NOT `"0"` (which v2.x's fabricated sentinel
 *      collapsed both cases onto).
 *   3. urStoa pair (2 it-blocks — `getUrStoaGuard`'s 3-state lock
 *      already counts as success-path): `getUrStoaBalance` parses
 *      `{decimal: "42.5"}` → `42.5`; `checkCoinAccountExists`
 *      (urStoa flavour) returns `true` when chain data is `true`
 *      (i.e. urStoa account does NOT exist — the inverted-typeof
 *      Pact gymnastics in `urStoaFunctions.ts:567` are out of
 *      scope; the test locks the current return contract).
 *   4. validateLiquidity mixed-shape success (1 it-block): chain
 *      returns `[{decimal:"0.05"}, {decimal:"0.10"}]` → function
 *      returns `{valid: true, computed: "0.05", max: "0.10"}`. This
 *      is the ONLY one of the 16 widenings where the success path
 *      shape differs from the failure path shape — locks both keys
 *      populate AND `error` is absent (otherwise consumer can't
 *      tell "validation succeeded" from "RPC failed with error
 *      message").
 *   5. getMaxBuyMovieBooster (1 it-block): parses `{int: "5000"}`
 *      → `5000`. Locks Number.isFinite guard against fabricated
 *      `0` (which v2.x's sentinel collapsed sold-out and RPC-fail
 *      onto).
 *   6. Magic-string elimination (2 it-blocks): `getSWPSpawnLimit`
 *      parses `{decimal: "100"}` → `"100"`; `getSWPInactiveLimit`
 *      parses `{decimal: "10"}` → `"10"`. Locks v3.0.0's
 *      `"N/A"` → `null` BREAKING swap — a successful read returns
 *      the string value, NEVER the v2.x `"N/A"` sentinel.
 *
 * Strategy
 * --------
 * Same `setPactReader(...)` seam-mocking strategy as
 * `tests/interactions-pricing.test.ts:80-88` (the one
 * pre-v3.3.4 success-path test, used as the template for all 13
 * here): install a `successReader` that resolves to
 * `{ result: { status: "success", data: <stub> } }`, exercise the
 * SUT, assert the parsed non-null return value. After each test
 * the seam is restored to `rawCalibratedDirtyRead` via afterEach.
 *
 * Why a dedicated v3.3.4 file rather than appending to existing files
 * -------------------------------------------------------------------
 * Two reasons. (1) Audit-finding traceability — F-TEST-005 closure
 * lives in one greppable place, mirroring v3.3.2's
 * `tests/universal-sign.test.ts` (F-TEST-002) and v3.3.3's
 * `tests/partial-sig.test.ts` (new public surface) v3.3.x convention.
 * (2) The existing test files (`interactions-pricing.test.ts`,
 * `interactions-balance-cluster.test.ts`) document themselves as
 * Phase-1 / Phase-2 fabricated-fallback regression locks; appending
 * post-v3.0.0 audit-closure work to them would muddy the per-file
 * scope statement. The dedicated file keeps the v3.3.4 audit
 * citation visible to future contributors.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import {
  getDPTFMinMove,
  getIgnisBalance,
  getAccountTokenSupply,
  getOuroDispoCapacity,
  getVirtualOuro,
  getMaxBuyMovieBooster,
} from "../src/interactions/ouroFunctions";
import {
  getTokenDecimals,
  getPoolTotalFee,
  getSWPSpawnLimit,
  getSWPInactiveLimit,
} from "../src/interactions/dexFunctions";
import {
  getUrStoaBalance,
  checkCoinAccountExists,
} from "../src/interactions/urStoaFunctions";
import { validateLiquidity } from "../src/interactions/addLiquidityFunctions";

// ─── Stub builder ────────────────────────────────────────────────────────────

/**
 * Build a PactReader stub that always resolves to a Pact "success"
 * envelope wrapping the supplied data. Mirrors the inline pattern at
 * `tests/interactions-pricing.test.ts:80-88`.
 */
function successReader(data: unknown): PactReader {
  return () =>
    Promise.resolve({ result: { status: "success", data } } as any);
}

beforeEach(() => {
  // No default — each test sets its own success reader. afterEach restores
  // the canonical reader so cross-file tests aren't polluted.
});

afterEach(() => {
  setPactReader(rawCalibratedDirtyRead);
});

// ══ 1. Pricing-quartet (3 of 4 — `getStoaPriceUSD` already covered) ═════════
describe("v3.3.4 success-paths — pricing-quartet (REQ-01..REQ-04)", () => {
  it("getTokenDecimals parses an int payload to a finite number", async () => {
    setPactReader(successReader({ int: "12" }));
    const out = await getTokenDecimals("OURO");
    expect(out).toBe(12);
  });

  it("getPoolTotalFee parses a decimal payload to a finite number", async () => {
    setPactReader(successReader({ decimal: "0.003" }));
    const out = await getPoolTotalFee("test-pair");
    expect(out).toBe(0.003);
  });

  it("getDPTFMinMove parses a decimal payload to a finite number", async () => {
    setPactReader(successReader({ decimal: "0.0001" }));
    const out = await getDPTFMinMove("OURO");
    expect(out).toBe(0.0001);
  });
});

// ══ 2. String-balance cluster (4 of 4 — none previously covered) ════════════
describe("v3.3.4 success-paths — string-balance cluster (REQ-05)", () => {
  it("getIgnisBalance unwraps {decimal:'...'} to the underlying string", async () => {
    setPactReader(successReader({ decimal: "100.5" }));
    const out = await getIgnisBalance("k:abc");
    expect(out).toBe("100.5");
  });

  it("getAccountTokenSupply unwraps {decimal:'...'} to the underlying string", async () => {
    setPactReader(successReader({ decimal: "5000.0" }));
    const out = await getAccountTokenSupply("token-id", "k:abc");
    expect(out).toBe("5000.0");
  });

  it("getOuroDispoCapacity unwraps {decimal:'...'} to the underlying string", async () => {
    setPactReader(successReader({ decimal: "250" }));
    const out = await getOuroDispoCapacity("k:abc");
    expect(out).toBe("250");
  });

  it("getVirtualOuro unwraps {decimal:'...'} to the underlying string", async () => {
    setPactReader(successReader({ decimal: "75.25" }));
    const out = await getVirtualOuro("k:abc");
    expect(out).toBe("75.25");
  });
});

// ══ 3. urStoa pair (2 of 3 — `getUrStoaGuard` 3-state already locked) ═══════
describe("v3.3.4 success-paths — urStoa pair (REQ-07)", () => {
  it("getUrStoaBalance parses {decimal:'...'} to a finite number", async () => {
    setPactReader(successReader({ decimal: "42.5" }));
    const out = await getUrStoaBalance("k:abc");
    expect(out).toBe(42.5);
  });

  it("checkCoinAccountExists (urStoa) returns true when chain data is true", async () => {
    // NB: urStoaFunctions.ts:567's Pact gymnastics inverts the semantics
    // (data===true means "account does NOT exist" in chain terms because
    // the inner `try false` short-circuits when `coin.UR_Balance` lookup
    // fails, and the outer `(if (= (typeof ...) "bool") false true)`
    // evaluates true ↔ a `false` typeof bool was returned, i.e. account
    // missing). What this test locks is the FUNCTION-level contract:
    // when chain returns `data: true`, the function returns `true` (NOT
    // `null`), distinguishable from an RPC-failure-returned `null`.
    setPactReader(successReader(true));
    const out = await checkCoinAccountExists("k:abc");
    expect(out).toBe(true);
  });
});

// ══ 4. validateLiquidity mixed-shape success (REQ-08) ═══════════════════════
describe("v3.3.4 success-paths — validateLiquidity mixed-shape", () => {
  it("validateLiquidity returns {valid:true, computed, max} on a 2-element decimal payload", async () => {
    setPactReader(
      successReader([{ decimal: "0.05" }, { decimal: "0.10" }]),
    );
    const out = await validateLiquidity("swpair", ["10", "20"]);

    expect(out.valid).toBe(true);
    expect(out.computed).toBe("0.05");
    expect(out.max).toBe("0.10");
    // The mixed-shape contract — `error` field is RESERVED for the catch
    // path and MUST be absent on success. A consumer's `if (out.error)`
    // branch routes to RPC-failure UI; if a success path leaked an error
    // field, that branch would mis-fire and show RPC-failure UI for a
    // valid liquidity check. v3.0.0 REQ-08 locked-decision: error is
    // mutually exclusive with valid:true.
    expect(out.error).toBeUndefined();
  });
});

// ══ 5. getMaxBuyMovieBooster (REQ-08) ═══════════════════════════════════════
describe("v3.3.4 success-paths — getMaxBuyMovieBooster", () => {
  it("getMaxBuyMovieBooster parses an int payload to a finite number", async () => {
    setPactReader(successReader({ int: "5000" }));
    const out = await getMaxBuyMovieBooster("k:abc", true);
    expect(out).toBe(5000);
  });
});

// ══ 6. Magic-string elimination (REQ-09) ════════════════════════════════════
describe("v3.3.4 success-paths — magic-string elimination", () => {
  it("getSWPSpawnLimit returns the decimal string on success (NEVER the v2.x 'N/A' sentinel)", async () => {
    setPactReader(successReader({ decimal: "100" }));
    const out = await getSWPSpawnLimit();
    expect(out).toBe("100");
    // Belt-and-suspenders: the v3.0.0 BREAKING swap eliminated "N/A".
    // A regression that re-introduced it would still satisfy
    // `expect(out).toBe("100")` only if the stub data leaked through
    // unchanged — but a defensive assertion proves the literal sentinel
    // is gone from the success path.
    expect(out).not.toBe("N/A");
  });

  it("getSWPInactiveLimit returns the decimal string on success (NEVER the v2.x 'N/A' sentinel)", async () => {
    setPactReader(successReader({ decimal: "10" }));
    const out = await getSWPInactiveLimit();
    expect(out).toBe("10");
    expect(out).not.toBe("N/A");
  });
});
