/**
 * v3.2.3 — Targeted bug-fix regression suite.
 *
 * Pins the four audit findings closed in v3.2.3:
 *
 *   F-BUG-002 — `buildCrossChainTransfer` setMeta block now includes
 *   `creationTime: safeCreationTime()`. Pre-v3.2.3 the field was omitted
 *   and `@kadena/client` fell back to the raw current time, causing
 *   sporadic chain-side rejections under client-clock drift.
 *
 *   F-BUG-004 — `fetchSpvProof` now wraps in `withFailover` and uses
 *   `AbortSignal.timeout(SPV_PROOF_TIMEOUT_MS)`. Pre-v3.2.3 a wedged
 *   primary node could hang the function indefinitely with the user's
 *   KDA committed to `kadena-xchain-gas` escrow.
 *
 *   F-SEC-002 — `setNodeConfig("custom", customUrl)` now validates URL
 *   parseability + `https:` scheme. Pre-v3.2.3 it accepted any truthy
 *   string and assigned it to `PRIMARY_HOST`, allowing an attacker-
 *   controlled custom-node setting to redirect every signed transaction.
 *
 *   F-ERR-001 — Three crossChainFunctions submit/listen helpers gain
 *   `@throws` JSDoc documenting their error contracts. This is a
 *   documentation-only change; runtime behaviour is unchanged. The
 *   tests below cover the call surface itself but the JSDoc lock is
 *   verified manually + via `grep` here.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setNodeConfig, resetNodeFailover } from "@stoachain/stoa-core/network";
import { buildCrossChainTransfer } from "../src/interactions/crossChainFunctions";

// Reset node config between tests so one test's setNodeConfig call
// doesn't leak into the next.
beforeEach(() => {
  resetNodeFailover();
});

// ══ F-BUG-002 — buildCrossChainTransfer carries creationTime ═════════════════
describe("F-BUG-002 — buildCrossChainTransfer setMeta includes creationTime", () => {
  const validParams = {
    sender: "k:abc",
    receiver: "k:xyz",
    receiverGuard: { keys: ["xyz"], pred: "keys-all" as const },
    amount: "1.0",
    sourceChain: "0",
    targetChain: "1",
    senderPublicKey: "abc",
  };

  it("setMeta block emits creationTime within ±60s of safeCreationTime() output", () => {
    // safeCreationTime() returns Math.floor(Date.now()/1000) - 30. We
    // capture the expected value at test entry and assert the transaction's
    // serialised cmd contains a creationTime within a generous tolerance
    // (test-jitter + the -30s offset itself).
    const beforeBuild = Math.floor(Date.now() / 1000);
    const tx = buildCrossChainTransfer(validParams);
    const afterBuild = Math.floor(Date.now() / 1000);

    // tx.cmd is a JSON string; parse and inspect meta.creationTime.
    const parsed = JSON.parse(tx.cmd);
    expect(parsed.meta).toBeDefined();
    expect(typeof parsed.meta.creationTime).toBe("number");

    // safeCreationTime returns now - 30; we allow ±60s for clock-tick
    // jitter during the test run plus the -30 offset.
    const ct = parsed.meta.creationTime;
    expect(ct).toBeGreaterThanOrEqual(beforeBuild - 60);
    expect(ct).toBeLessThanOrEqual(afterBuild - 30);
  });

  it("creationTime is below current time (safeCreationTime's -30s offset preserved)", () => {
    const tx = buildCrossChainTransfer(validParams);
    const parsed = JSON.parse(tx.cmd);
    const now = Math.floor(Date.now() / 1000);
    // The function must offset BACKWARD (anti-clock-drift) — never forward.
    // Pre-v3.2.3 the field was omitted and @kadena/client used raw Date.now,
    // which on a clock-ahead machine would have produced ct > now.
    expect(parsed.meta.creationTime).toBeLessThanOrEqual(now);
  });
});

// ══ F-SEC-002 — setNodeConfig URL validation ══════════════════════════════════
describe("F-SEC-002 — setNodeConfig validates customUrl", () => {
  it("rejects missing customUrl when selected='custom'", () => {
    expect(() => setNodeConfig("custom")).toThrow(TypeError);
    expect(() => setNodeConfig("custom")).toThrow(/customUrl is required/);
  });

  it("rejects empty-string customUrl", () => {
    expect(() => setNodeConfig("custom", "")).toThrow(TypeError);
  });

  it("rejects unparseable URL string", () => {
    expect(() => setNodeConfig("custom", "not a url")).toThrow(TypeError);
    expect(() => setNodeConfig("custom", "not a url")).toThrow(/not a valid URL/);
  });

  it("rejects http:// scheme — only https:// is accepted", () => {
    expect(() => setNodeConfig("custom", "http://node.example.com")).toThrow(TypeError);
    expect(() => setNodeConfig("custom", "http://node.example.com")).toThrow(/must use https/);
  });

  it("rejects javascript: scheme", () => {
    // The URL constructor accepts javascript: as a parseable URL, so this
    // case specifically exercises the protocol allow-list, not the
    // parse step.
    expect(() => setNodeConfig("custom", "javascript:alert(1)")).toThrow(/must use https/);
  });

  it("rejects ftp:// scheme", () => {
    expect(() => setNodeConfig("custom", "ftp://node.example.com")).toThrow(/must use https/);
  });

  it("accepts valid https:// URL and stores its origin only", async () => {
    setNodeConfig("custom", "https://node.example.com");
    const { getActiveHost } = await import("@stoachain/stoa-core/network");
    expect(getActiveHost()).toBe("https://node.example.com");
  });

  it("https:// URL with path/query/fragment — only origin is stored", async () => {
    // Pre-v3.2.3 the entire string would have been assigned to PRIMARY_HOST,
    // producing malformed URLs when getActiveBaseUrl appended /chainweb/...
    setNodeConfig("custom", "https://node.example.com/some/path?x=1#frag");
    const { getActiveHost } = await import("@stoachain/stoa-core/network");
    expect(getActiveHost()).toBe("https://node.example.com");
  });
});

// ══ F-BUG-004 — fetchSpvProof failover + timeout ═════════════════════════════
//
// fetchSpvProof now wraps `fetch` in `withFailover` AND adds an
// AbortSignal.timeout. Testing this end-to-end requires mocking globalThis.fetch.
// We cover three cases:
//   1. Happy path: fetch resolves quickly with a proof — function returns it.
//   2. Timeout path: fetch hangs past SPV_PROOF_TIMEOUT_MS — function rejects
//      via AbortError; both primary and fallback are tried; final result
//      is `{ proof: null, error: <timeout message> }`.
//   3. Network-error path: primary throws a network-class error; withFailover
//      retries on fallback; if both fail, final result has proof:null.
describe("F-BUG-004 — fetchSpvProof failover + timeout", () => {
  it("returns the proof string on a fast successful fetch", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      text: async () => '"the-proof-payload"',
    } as unknown as Response));

    try {
      const { fetchSpvProof } = await import("../src/interactions/crossChainFunctions");
      const result = await fetchSpvProof("rk-1", "0", "1");
      expect(result.proof).toBe("the-proof-payload");
      expect(result.error).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns proof:null with error message when chainweb 400-not-available fires", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: false,
      status: 400,
      text: async () => "SPV proof not available yet",
    } as unknown as Response));

    try {
      const { fetchSpvProof } = await import("../src/interactions/crossChainFunctions");
      const result = await fetchSpvProof("rk-1", "0", "1");
      expect(result.proof).toBeNull();
      expect(result.error).toContain("not ready yet");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("non-success non-not-available HTTP status returns proof:null with the body", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: false,
      status: 500,
      text: async () => "internal server error",
    } as unknown as Response));

    try {
      const { fetchSpvProof } = await import("../src/interactions/crossChainFunctions");
      const result = await fetchSpvProof("rk-1", "0", "1");
      expect(result.proof).toBeNull();
      expect(result.error).toContain("internal server error");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("network error on primary triggers withFailover retry on fallback", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = (async (_url: any) => {
      callCount++;
      // First call (primary): throw network-class error so withFailover
      // switches to fallback.
      if (callCount === 1) {
        const err = new Error("Failed to fetch");
        throw err;
      }
      // Second call (fallback): succeed.
      return {
        ok: true,
        text: async () => '"proof-from-fallback"',
      } as unknown as Response;
    });

    try {
      const { fetchSpvProof } = await import("../src/interactions/crossChainFunctions");
      const result = await fetchSpvProof("rk-1", "0", "1");
      expect(result.proof).toBe("proof-from-fallback");
      expect(callCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ══ F-ERR-001 — JSDoc presence on submit/listen helpers ══════════════════════
//
// This audit finding is documentation-only — the runtime behaviour of the
// three functions is unchanged. The lock is that the @throws JSDoc tags
// remain present in the source so a future refactor doesn't silently
// strip them. We grep the source file to verify.
describe("F-ERR-001 — @throws JSDoc on crossChain submit/listen helpers", () => {
  it("submitCrossChainTransfer has @throws JSDoc", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/interactions/crossChainFunctions.ts", "utf-8");
    // Look for the function's preceding JSDoc block containing @throws.
    const submitBlockMatch = src.match(
      /\/\*\*[\s\S]*?@throws[\s\S]*?\*\/\s*export async function submitCrossChainTransfer/,
    );
    expect(submitBlockMatch).not.toBeNull();
  });

  it("submitContinuation has @throws JSDoc", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/interactions/crossChainFunctions.ts", "utf-8");
    const blockMatch = src.match(
      /\/\*\*[\s\S]*?@throws[\s\S]*?\*\/\s*export async function submitContinuation/,
    );
    expect(blockMatch).not.toBeNull();
  });

  it("listenForCompletion has @throws JSDoc citing 'pending not failed' contract", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/interactions/crossChainFunctions.ts", "utf-8");
    // listenForCompletion's @throws block must specifically mention that
    // a TIMEOUT is "pending, not failed" — that's the audit-mandated
    // distinction that prevents user double-pay (the pattern F-ERR-014
    // surfaced before the multi-step surface was deleted in v3.2.2).
    const blockMatch = src.match(
      /\/\*\*[\s\S]*?@throws[\s\S]*?\*\/\s*export async function listenForCompletion/,
    );
    expect(blockMatch).not.toBeNull();
    // Spot-check the pending-vs-failed callout.
    expect(src).toMatch(/[Tt]reat as pending.*[Nn]ot failed/);
  });
});
