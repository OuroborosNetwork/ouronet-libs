import { describe, expect, it } from "vitest";
import {
  buildCall, buildGhostCall, buildPreviewCall, capabilityRecipe, entrypointKeys,
  explainCall, formatDecimal, formatForType, getEntrypoint, parseCapability,
  planCall, registry, RegistryError, resolveByName, surfaceHash,
} from "../src/index.js";

describe("the snapshot", () => {
  it("was generated against the chain, not the repo alone", () => {
    // repo-only would describe what someone INTENDS to deploy, which is not a callable surface.
    expect(registry.generatedFrom).toBe("chain+repo");
    expect(registry.divergences).toHaveLength(0);
    expect(surfaceHash).toMatch(/^[0-9a-f]{16}$/);
  });
  it("carries a non-trivial surface", () => {
    expect(entrypointKeys().length).toBeGreaterThan(400);
  });
});

describe("buildCall rejects what Pact accepts silently", () => {
  const KEY = "TS01-C3.SWP|C_ChangeOwnership";

  it("builds the deployed 4-argument shape, in the deployed ORDER", () => {
    // The entity moved LAST when the sweep re-signed this. A count check alone would have
    // passed a transposed call.
    const code = buildCall(KEY, {
      patron: "p", executor: "e", executee: "n", swpair: "s",
    });
    expect(code).toBe(`(ouronet-ns.${KEY} "p" "e" "n" "s")`);
  });

  it("REFUSES a short call -- Pact would partially apply and yield a closure", () => {
    // This is the shipped bug: four arguments to a five-parameter reader returned
    // "Evaluation did not reduce to a value" rather than an arity error.
    expect(() => buildCall(KEY, { patron: "p", swpair: "s", executee: "n" }))
      .toThrow(/missing: executor/);
    expect(() => buildCall(KEY, { patron: "p", swpair: "s", executee: "n" }))
      .toThrow(/partially applies/);
  });

  it("refuses an argument the contract does not declare", () => {
    expect(() => buildCall(KEY, {
      patron: "p", executor: "e", executee: "n", swpair: "s", slippage: 1,
    })).toThrow(/unexpected: slippage/);
  });

  it("names near matches for a stale key instead of returning undefined", () => {
    expect(() => buildCall("TS01-C9.SWP|C_ChangeOwnership", {}))
      .toThrow(/The same function exists on: TS01-C3/);
  });
});

describe("Pact literal rendering", () => {
  it("never emits a bare integer in a decimal slot", () => {
    // Pact's decimal lexer rejects `5`; the amount must read `5.0`.
    expect(formatDecimal(5)).toBe("5.0");
    expect(formatForType(5, "decimal")).toBe("5.0");
    expect(formatForType(0, "decimal")).toBe("0.0");
  });
  it("does not emit exponent notation, which Pact cannot read", () => {
    expect(formatDecimal(1e-7)).not.toMatch(/e/i);
    expect(formatDecimal(1e-7)).toBe("0.0000001");
  });
  it("separates list elements with SPACES, not commas", () => {
    expect(formatForType([1, 2, 3], "[integer]")).toBe("[1 2 3]");
    expect(formatForType([1, 2], "[decimal]")).toBe("[1.0 2.0]");
  });
  it("passes glyph accounts through verbatim rather than \\u-escaping them", () => {
    // JSON.stringify would mangle every Ouronet account, which is a glyph string.
    const acct = "Σ.ъΦĞρλξäF";
    expect(formatForType(acct, "string")).toBe(`"${acct}"`);
  });
  it("renders a guard as a read-keyset reference, not a literal", () => {
    // The convention across Ouronet: the code carries (read-keyset "ks") and the keyset
    // itself travels in the transaction's data under that name.
    expect(formatForType({ readKeyset: "ks" }, "guard")).toBe(`(read-keyset "ks")`);
    expect(formatForType("ks", "guard")).toBe(`(read-keyset "ks")`);
  });
  it("refuses a raw keyset object, which would inline something Pact cannot read", () => {
    expect(() => formatForType({ keys: ["k"], pred: "keys-all" }, "guard"))
      .toThrow(/NAME of the data key/);
  });
});

describe("every entrypoint's ghost builds", () => {
  // 423 real assertions: the ghost dictionary must cover every declared type, and the
  // formatter must have a rule for each. A gap in either shows up here.
  it.each(entrypointKeys())("%s", (key) => {
    const { code, warning } = buildGhostCall(key);
    expect(code.startsWith(`(${registry.namespace}.${key} `)).toBe(true);
    expect(warning).toMatch(/NOT SUBMITTABLE/);
  });
});

describe("ambiguity is refused, not guessed", () => {
  it("resolves a unique bare name", () => {
    expect(resolveByName("DPTF|C_Transfer")).toBe("TS01-C1.DPTF|C_Transfer");
  });
  it("refuses a name that resolves to two modules with different execution modes", () => {
    // Guessing is silent both ways: a defpact treated as direct sits half-finished; a direct
    // call treated as a defpact has no pact to continue.
    expect(() => resolveByName("SWP|C_AddFrozenLiquidity"))
      .toThrow(/ambiguous.*TS01-C3.*TS01-CP|ambiguous/s);
  });
});

describe("execution plans carry the facts that live in different keys", () => {
  it("marks a cursor pager as strictly ordered", () => {
    const p = planCall("TS02-C3.AQP-FVT|CCp_SweepRecomputeChunk");
    expect(p.mode).toBe("indirect-sequential");
    expect(p.transactions).toBe("many-sequential");
    expect(p.warnings.join(" ")).toMatch(/STRICTLY ORDERED/);
  });
  it("marks a fed slice as parallel-safe", () => {
    const p = planCall("TS02-C2.DPNF|Cp_WipeSlice");
    expect(p.mode).toBe("indirect-parallel");
    expect(p.warnings.join(" ")).toMatch(/Order-independent/);
  });
  it("says continuations are not gas-sponsored", () => {
    const p = planCall("TS01-CP.SWP|C_IssueStandardPool");
    expect(p.mode).toBe("defpact");
    expect(p.sponsored).toBe("step-0-only");
    expect(p.warnings.join(" ")).toMatch(/NOT GAS-SPONSORED/);
    expect(p.preferInstead).toBe("TS01-C3.SWP|C_IssueStandard");
  });
  it("refuses to build an unsupported route without an explicit opt-in", () => {
    expect(() => buildCall("TS01-CP.SWP|C_IssueStandardPool", {} as never))
      .toThrow(/not the supported route/);
  });
  it("explains a call as text", () => {
    expect(explainCall("TS01-C1.DPTF|C_Transfer")).toMatch(/DPTF\|C_Transfer/);
  });
});

describe("capabilities", () => {
  it("names the reader that computes them, on the SALE module", () => {
    const r = capabilityRecipe("TS02-CPAD.SPARK|C_BuySparks");
    expect(r?.reader).toBe("DEMIPAD-SPARK.URC_Acquire");
    // the reader's `amount` is the entrypoint's `sparks-amount` -- a rename, not a gap
    expect(r?.argsFrom["amount"]).toBe("sparks-amount");
  });
  it("is null when GAS_PAYER alone suffices", () => {
    expect(capabilityRecipe("TS01-C1.DPTF|C_Transfer")).toBeNull();
  });
  it("parses the angle-bracket wrapping the contract emits", () => {
    const c = parseCapability(`<(coin.TRANSFER "alice" "c:pool" 9.595000000000)>`);
    expect(c.name).toBe("coin.TRANSFER");
    expect(c.args).toEqual(["alice", "c:pool", { decimal: "9.595000000000" }]);
  });
  it("refuses a shape it does not recognise rather than silently dropping a leg", () => {
    expect(() => parseCapability("coin.TRANSFER alice bob 1.0")).toThrow(RegistryError);
  });
});

describe("ownership tells you whose key to ready", () => {
  it("distinguishes an entity from an account", () => {
    const own = getEntrypoint("TS01-C3.SWP|C_ToggleSwapCapability").ownership;
    const byReader = own.requires!.find(c => c.via === "reader");
    // `swpair` is a POOL ID. The account is what UR_OwnerKonto returns for it.
    expect(byReader?.subject).toBe("swpair");
    expect(byReader?.account).toMatch(/owner of/);
  });
  it("marks a conditional enforce as conditional", () => {
    const own = getEntrypoint("TS01-C1.DPTF|C_Transfer").ownership;
    const patron = own.requires!.find(c => c.account === "patron");
    // UEV_Patron enforces the patron's key only when self-paying; the gas station signs
    // on the sponsored path.
    expect(patron?.when).toBe("CONDITIONAL");
  });
});

describe("previews", () => {
  it("builds the cost preview, which lives on a different module", () => {
    const code = buildPreviewCall("TS01-C1.DPTF|C_ClearDispo", { patron: "p", account: "a" });
    expect(code).toBe(`(ouronet-ns.INFO-ONE.INFO_DPTF|ClearDispo "p" "a")`);
  });
  it("every entrypoint has one", () => {
    const without = entrypointKeys().filter(k => !getEntrypoint(k).preview);
    expect(without).toEqual([]);
  });
});
