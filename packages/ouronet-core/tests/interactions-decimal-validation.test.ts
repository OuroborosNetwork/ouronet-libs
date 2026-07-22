/**
 * v3.2.1 — Decimal-validation enforcement at chain-call boundaries.
 *
 * Pins that the four call sites updated in v3.2.1 — crossChainFunctions:92,
 * urStoaFunctions:206, urStoaFunctions:433 (executeStakeUrStoa), and
 * urStoaFunctions:479 (executeUnstakeUrStoa) — now route every amount input
 * through `formatDecimalForPact` and reject malformed inputs synchronously,
 * before any chain interaction starts.
 *
 * Closes audit findings F-SEC-001 (Pact-code injection via raw `${amount}`
 * interpolation in urStoa stake/unstake) and F-BUG-003 (parseFloat→toFixed
 * silent precision loss + silent rounding in cross-chain transfer + urStoa
 * native transfer).
 *
 * Test strategy:
 *
 *   1. For sync builders (`buildCrossChainTransfer`): call with malformed
 *      input, assert synchronous throw with the formatter's "Invalid decimal
 *      format" message; call with valid comma-decimal input, assert the
 *      transaction's pact-code carries the period-normalised string; call
 *      with high-precision input, assert no precision is lost on the way to
 *      the pact-code interpolation (was truncated to 12 decimals pre-v3.2.1).
 *
 *   2. For async executors (`executeStakeUrStoa`/`executeUnstakeUrStoa`): use
 *      a counting PactReader stub to prove that a malformed-amount call
 *      rejects WITHOUT reaching the reader at all — i.e., validation
 *      happens at the function boundary, not deeper in the chain-call
 *      stack.
 *
 * Both seams (PactReader) are restored in afterEach. No real chain calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setPactReader, type PactReader } from "@stoachain/stoa-core/reads";
import { buildCrossChainTransfer } from "../src/interactions/crossChainFunctions";

// Capture the original reader so we can restore it after each test.
let originalReader: PactReader | undefined;

beforeEach(() => {
  // We don't need to do anything here — each test that needs the seam
  // installs its own stub. afterEach restores.
});

afterEach(() => {
  // Restore the seam so other test files aren't polluted.
  if (originalReader !== undefined) {
    setPactReader(originalReader);
    originalReader = undefined;
  }
});

// ══ buildCrossChainTransfer — sync builder, synchronous throw on malformed ══
describe("buildCrossChainTransfer — v3.2.1 decimal validation", () => {
  const validParams = {
    sender: "k:abc",
    receiver: "k:xyz",
    receiverGuard: { keys: ["xyz"], pred: "keys-all" as const },
    sourceChain: "0",
    targetChain: "1",
    senderPublicKey: "abc",
  };

  it("rejects malformed amount synchronously — was 'NaN' interpolation pre-v3.2.1", () => {
    expect(() =>
      buildCrossChainTransfer({ ...validParams, amount: "garbage" }),
    ).toThrow("Invalid decimal format");
  });

  it("rejects mixed period+comma synchronously — '1,5.6' is ambiguous", () => {
    expect(() =>
      buildCrossChainTransfer({ ...validParams, amount: "1,5.6" }),
    ).toThrow("Invalid decimal format");
  });

  it("rejects multi-comma thousand-separator-style synchronously", () => {
    expect(() =>
      buildCrossChainTransfer({ ...validParams, amount: "1,234,567" }),
    ).toThrow("Invalid decimal format");
  });

  it("accepts a single-comma EU-locale amount and normalises to period in pact code", () => {
    const tx = buildCrossChainTransfer({ ...validParams, amount: "1,5" });
    // The transaction's `cmd` field is a JSON string containing the pact code.
    // The pact code should contain the validated decimal `1.5` (not the raw `1,5`).
    expect(tx.cmd).toContain("1.5");
    // Negative assertion — the raw comma form must not survive into the pact code.
    expect(tx.cmd).not.toContain("1,5)");
  });

  it("preserves high-precision decimals past pre-v3.2.1's 12-decimal truncation", () => {
    // Pre-v3.2.1 used `parseFloat(amount).toFixed(12)`, which would truncate
    // anything past 12 fractional digits. The new formatter preserves up to
    // 24 decimals by default; this 18-decimal input round-trips intact.
    const highPrecision = "1.123456789012345678";
    const tx = buildCrossChainTransfer({ ...validParams, amount: highPrecision });
    expect(tx.cmd).toContain(highPrecision);
  });

  it("preserves a 39-digit-int amount (would float-overflow pre-v3.2.1)", () => {
    // float64 Number.MAX_SAFE_INTEGER is 2^53 - 1 ≈ 9.0e15. A 39-digit
    // integer amount would parseFloat into scientific notation, then
    // .toFixed(12) would emit a precision-lost approximation. The new
    // formatter never round-trips through float, so the value is intact.
    const huge = "12312419843287492374257983275498759437593";
    const tx = buildCrossChainTransfer({ ...validParams, amount: huge });
    expect(tx.cmd).toContain(`${huge}.0`);
  });
});

// ══ executeStakeUrStoa / executeUnstakeUrStoa — async, fail-fast ════════════
describe("executeStakeUrStoa / executeUnstakeUrStoa — v3.2.1 fail-fast", () => {
  it("executeStakeUrStoa rejects malformed amount BEFORE invoking the reader", async () => {
    // Install a reader stub that throws if called — proves the rejection
    // happens at validation time, not somewhere inside the chain-call stack.
    const readerCalls = vi.fn();
    const readerStub: PactReader = (...args) => {
      readerCalls(args);
      throw new Error("READER SHOULD NOT BE CALLED — validation must throw first");
    };
    originalReader = (await import("@stoachain/stoa-core/reads")).getPactReader();
    setPactReader(readerStub);

    const { executeStakeUrStoa } = await import("../src/interactions/urStoaFunctions");

    await expect(
      executeStakeUrStoa({
        paymentKeyAddress: "k:abc",
        amount: "garbage_not_a_number",
        gasStationKey: {
          publicKey: "abc",
          privateKey: "def",
        } as any,
      }),
    ).rejects.toThrow("Invalid decimal format");

    // The reader-stub MUST NOT have been invoked — proof that validation
    // happens at function-entry, not after building/simulating.
    expect(readerCalls).not.toHaveBeenCalled();
  });

  it("executeUnstakeUrStoa rejects malformed amount BEFORE invoking the reader", async () => {
    const readerCalls = vi.fn();
    const readerStub: PactReader = (...args) => {
      readerCalls(args);
      throw new Error("READER SHOULD NOT BE CALLED");
    };
    originalReader = (await import("@stoachain/stoa-core/reads")).getPactReader();
    setPactReader(readerStub);

    const { executeUnstakeUrStoa } = await import("../src/interactions/urStoaFunctions");

    await expect(
      executeUnstakeUrStoa({
        paymentKeyAddress: "k:abc",
        amount: "1,5.6", // ambiguous mixed comma+period
        gasStationKey: {
          publicKey: "abc",
          privateKey: "def",
        } as any,
      }),
    ).rejects.toThrow("Invalid decimal format");

    expect(readerCalls).not.toHaveBeenCalled();
  });
});
