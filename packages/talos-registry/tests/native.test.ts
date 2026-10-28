/**
 * FACILITY #4 — the chain-native builder.
 *
 * These assertions are written against the SHIPPED hand-written templates they replace
 * (`@ouronet/ouronet-core`'s `buildStakeUrStoaPactCode` and friends), byte for byte, because the
 * point of moving a builder is that the call does not change. A refactor that quietly changes
 * the emitted Pact is not a refactor.
 */
import { describe, expect, it } from "vitest";
import { buildCall, buildNativeCall, composeCalls, nativeSignature, RegistryError } from "../src/index.js";

describe("buildNativeCall", () => {
  it("emits exactly what the hand-written UrStoa templates emit", () => {
    // `(coin.C_URV|Stake "${p.paymentKeyAddress}" ${dec})` — ouronet-core cfmBuilders.js:332
    expect(buildNativeCall("coin.C_URV|Stake", { account: "k:aa", "urstoa-amount": 1.5 }))
      .toBe('(coin.C_URV|Stake "k:aa" 1.5)');
    expect(buildNativeCall("coin.C_URV|Unstake", { account: "k:aa", "urstoa-amount": 2 }))
      .toBe('(coin.C_URV|Unstake "k:aa" 2.0)');
    expect(buildNativeCall("coin.C_URV|Collect", { account: "k:aa" }))
      .toBe('(coin.C_URV|Collect "k:aa")');
  });

  it("renders a bare integer amount as a DECIMAL literal", () => {
    // Pact's lexer will not coerce `2` into a decimal slot. This is the oldest defect in the
    // formatter's ledger (F-SEC-001) and the reason a native builder belongs here rather than
    // in a template that has to remember it.
    expect(buildNativeCall("coin.C_Transfer", { sender: "a", receiver: "b", amount: 5 }))
      .toBe('(coin.C_Transfer "a" "b" 5.0)');
  });

  it("prefixes NO namespace — the native contract is root", () => {
    expect(buildNativeCall("coin.C_URV|Collect", { account: "k:aa" })).not.toMatch(/ouronet-ns/);
  });

  it("renders a guard as (read-keyset \"name\"), in its declared position", () => {
    // Third of four. A positional caller that swapped guard and amount would be building a
    // transfer OF a guard, which is why arguments are by name here as in `buildCall`.
    expect(buildNativeCall("coin.C_TransferAnew",
      { sender: "a", receiver: "b", "receiver-guard": { readKeyset: "ks" }, amount: 1 }))
      .toBe('(coin.C_TransferAnew "a" "b" (read-keyset "ks") 1.0)');
  });

  it("renders in the CONTRACT's declared order, not the order the caller typed", () => {
    /**
     * A SURVIVING MUTANT WROTE THIS TEST. Replacing `params.map` with
     * `Object.keys(args).map` — rendering in whatever order the caller happened to type —
     * passed every other assertion in this file, because each of them supplies its arguments
     * in declared order. That is the transposition defect this package exists to prevent, and
     * it was undetectable until one object was written out of order on purpose.
     *
     * The failure it would cause is not an arity error: `(coin.C_Transfer 1.0 "a" "b")` has
     * three arguments and is refused by the TYPE, if at all. For `C_URV|Stake` an account and
     * an amount of the wrong order fails loudly; for a same-typed pair it would not.
     */
    const outOfOrder = { amount: 1, receiver: "b", sender: "a" };
    expect(Object.keys(outOfOrder)).toEqual(["amount", "receiver", "sender"]);
    expect(buildNativeCall("coin.C_Transfer", outOfOrder)).toBe('(coin.C_Transfer "a" "b" 1.0)');
  });

  it("builds Kadena's contract too, and does not confuse it with StoaChain's", () => {
    expect(buildNativeCall("coin.transfer", { sender: "a", receiver: "b", amount: 1 }))
      .toBe('(coin.transfer "a" "b" 1.0)');
    // Both chains call their contract `coin`; the names do not collide TODAY and nothing here
    // resolves by guessing.
    expect(nativeSignature("coin.transfer")).toEqual(
      [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]]);
    expect(nativeSignature("TS01-C1.DPTF|C_Transfer")).toBeUndefined();
  });

  it("refuses a short call, naming what is missing and why it is dangerous", () => {
    expect(() => buildNativeCall("coin.C_URV|Stake", { account: "k:aa" }))
      .toThrow(/missing: urstoa-amount/);
    expect(() => buildNativeCall("coin.C_URV|Stake", { account: "k:aa" }))
      .toThrow(/partially applies/);
  });

  it("refuses an argument the contract does not declare", () => {
    expect(() => buildNativeCall("coin.C_URV|Collect", { account: "k:aa", patron: "k:bb" }))
      .toThrow(/unexpected: patron/);
  });

  it("sends an Ouronet key back to buildCall, and vice versa", () => {
    expect(() => buildNativeCall("TS01-C1.DPTF|C_Transfer", {}))
      .toThrow(/is an Ouronet entrypoint.*Use buildCall/s);
    expect(() => buildCall("coin.C_URV|Stake", { account: "k:aa", "urstoa-amount": 1 }))
      .toThrow(/CHAIN-NATIVE call.*Use buildNativeCall/s);
    // The prefix stays, so a caller matching on it still matches.
    expect(() => buildCall("coin.C_URV|Stake", {})).toThrow(/Unknown entrypoint/);
  });

  it("refuses a key neither surface describes", () => {
    expect(() => buildNativeCall("arweave.upload", {})).toThrow(RegistryError);
  });
});

describe("composeCalls", () => {
  it("joins calls in the order given, one per line", () => {
    const create = buildNativeCall("coin.create-account",
      { account: "k:aa", guard: { readKeyset: "ks" } });
    const collect = buildNativeCall("coin.C_URV|Collect", { account: "k:aa" });
    expect(composeCalls([create, collect]))
      .toBe('(coin.create-account "k:aa" (read-keyset "ks"))\n(coin.C_URV|Collect "k:aa")');
  });

  it("refuses an empty composite", () => {
    expect(() => composeCalls([])).toThrow(RegistryError);
  });
});
