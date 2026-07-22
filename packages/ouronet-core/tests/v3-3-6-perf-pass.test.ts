/**
 * v3.3.6 — performance pass regression locks.
 *
 * Closes audit findings F-PERF-008 (MEDIUM, tree-shaking guarantee),
 * F-PERF-003 (MEDIUM, regex hoisting), F-PERF-004 (MEDIUM,
 * parallelize sequential awaits).
 *
 * The three changes:
 *
 *   F-PERF-008 — Added `"sideEffects": false` to `package.json`. This
 *                lets downstream bundlers (OuronetUI's webpack/Vite,
 *                AncientHolder HUB's tsc) prune unused barrel imports
 *                from the 16-subpath exports map. Single biggest
 *                tree-shaking win per the audit. Safe because every
 *                seam in the package (`setPactReader`, `setLogger`,
 *                `setNodeConfig`) is consumer-invoked at boot — none
 *                runs at module top-level — verified by grepping
 *                src/ for top-level callable statements (zero matches)
 *                during release prep.
 *
 *   F-PERF-003 — Memoized 8 `RegExp` allocations per call in
 *                `coilFunctions.getCoilPreviewGeneric` to a per-
 *                `targetTokenName` cache. The audit's suggested fix
 *                ("hoist each regex to a module-level const") doesn't
 *                literally apply because the patterns interpolate
 *                `targetTokenName` from `config.targetToken` — but
 *                the cache form achieves the same outcome: subsequent
 *                calls with the same token reuse the compiled
 *                instances (zero per-call allocation in the
 *                steady state).
 *
 *   F-PERF-004 — Parallelized `ouroFunctions.getOuronetKdaDetails`
 *                from sequential `await getKadenaAccountOwner()` →
 *                `await getKadenaAccountGuard()` to a single
 *                `Promise.all([owner, guard])`. Both reads probe
 *                independent on-chain functions
 *                (`DALOS.UR_AccountKadena` vs `DALOS.UR_AccountGuard`)
 *                with no causal dependency, so happy-path latency
 *                halves (~2 sequential RPCs → ~1 parallel RPC).
 *
 * What this file locks (2 it-blocks across 2 describe groups)
 * -----------------------------------------------------------
 *
 *   T1 (F-PERF-008): `package.json` MUST declare `sideEffects: false`.
 *      The audit's tree-shaking guarantee rests on this single field;
 *      a future package.json edit that accidentally removes it would
 *      regress consumer bundle sizes silently — the test makes
 *      that regression class fail loudly in CI.
 *
 *   T2 (F-PERF-004): `getOuronetKdaDetails` MUST invoke `pactRead`
 *      exactly twice per call (once for `UR_AccountKadena`, once for
 *      `UR_AccountGuard`). A future refactor that accidentally drops
 *      one of the reads (e.g. only awaits `owner`, not `guard`) would
 *      silently produce wrong data — the test counts the seam-stub
 *      invocations and dispatches different payloads by Pact code
 *      pattern so we can prove BOTH reads happened (not just two
 *      copies of the same one).
 *
 * F-PERF-003 (regex memoization) is NOT directly locked here because
 * the cache is module-internal and not exported. Behavioral
 * regression coverage already lives in v3.3.5's
 * `tests/v3-3-5-smoke.test.ts` which exercises
 * `getCoilPreviewGeneric` with the OURO→AURYN config and asserts
 * the parsed `targetAmount`. If the memoization refactor broke
 * pattern compilation OR matching, the v3.3.5 smoke test would fail
 * — and currently it passes (672/672 in v3.3.5; 674/674 expected
 * after this v3.3.6 file lands).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import pkg from "../package.json" with { type: "json" };
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import { getOuronetKdaDetails } from "../src/interactions/ouroFunctions";
import { getLogger, setLogger, type Logger } from "@stoachain/stoa-core/observability";

let defaultLogger: Logger;

beforeEach(() => {
  defaultLogger = getLogger();
});

afterEach(() => {
  setLogger(defaultLogger);
  setPactReader(rawCalibratedDirtyRead);
  vi.restoreAllMocks();
});

// ══ F-PERF-008 ═══════════════════════════════════════════════════════════════
describe("v3.3.6 — F-PERF-008 sideEffects regression-lock", () => {
  it("package.json declares `sideEffects: false` for tree-shaking", () => {
    // Strict equality with literal `false` (not just `!sideEffects`) — a
    // future change that drops the field entirely OR sets it to `true`
    // OR sets it to a string/array would all fail this check, surfacing
    // the regression at CI time before consumers see degraded bundle
    // sizes.
    expect(pkg.sideEffects).toBe(false);
  });
});

// ══ F-PERF-004 ═══════════════════════════════════════════════════════════════
describe("v3.3.6 — F-PERF-004 getOuronetKdaDetails parallelization regression-lock", () => {
  it("invokes pactRead exactly twice per call, dispatching to BOTH UR_AccountKadena and UR_AccountGuard", async () => {
    // Counting reader that dispatches the appropriate stub payload
    // based on which Pact function is being called. By matching on the
    // `UR_AccountKadena` and `UR_AccountGuard` substrings, we prove
    // BOTH reads happened (not just two invocations of the same one)
    // — the load-bearing assertion against a regression that
    // accidentally drops one of the reads.
    const calls: string[] = [];
    const dispatchingReader: PactReader = (pactCode: string) => {
      calls.push(pactCode);
      if (pactCode.includes("UR_AccountKadena")) {
        return Promise.resolve({
          result: { status: "success", data: "k:owner-pubkey-stub" },
        } as any);
      }
      if (pactCode.includes("UR_AccountGuard")) {
        return Promise.resolve({
          result: { status: "success", data: { keys: ["k:guard-stub"], pred: "keys-all" } },
        } as any);
      }
      return Promise.resolve({ result: { status: "success", data: null } } as any);
    };
    setPactReader(dispatchingReader);

    const out = await getOuronetKdaDetails("k:test-account");

    // Both reads issued — the regression-lock invariant.
    expect(calls).toHaveLength(2);
    expect(calls.some((c) => c.includes("UR_AccountKadena"))).toBe(true);
    expect(calls.some((c) => c.includes("UR_AccountGuard"))).toBe(true);

    // Returned shape preserved — Promise.all parallelization preserves
    // the original sequential-await contract: { isActive, owner, guard }
    // with `isActive: owner !== null` semantics.
    expect(out).toEqual({
      isActive: true,
      owner: "k:owner-pubkey-stub",
      guard: { keys: ["k:guard-stub"], pred: "keys-all" },
    });
  });
});
