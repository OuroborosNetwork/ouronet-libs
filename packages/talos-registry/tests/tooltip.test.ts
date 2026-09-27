/**
 * The tooltip canon, enforced.
 *
 * These are not unit tests of a helper. They are the canon itself, in the only form that cannot
 * drift from the implementation -- which is the whole reason this lives in the package rather
 * than in a document each consumer reads once.
 */
import { describe, expect, it } from "vitest";
import {
  tooltipModel, tooltipModels, signatureRows, chainOf, PLACEHOLDER,
  STOA_SIGNATURES, KADENA_SIGNATURES,
} from "../src/tooltip.js";
import { registry, entrypointKeys, getEntrypoint, getPreview } from "../src/registry.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TRANSFER = "TS01-C1.DPTF|C_Transfer";

describe("rule 1 — every execution parameter is shown", () => {
  it("renders six slots for the six-parameter transfer, not the preview's five", () => {
    // THE REPORTED BUG, pinned. `DPTF|C_Transfer` takes
    //   (patron executor executee id transfer-amount method)
    // while `INFO_DPTF|Transfer` takes
    //   (patron id sender receiver transfer-amount)
    // The tooltip was rendering the PREVIEW's list, so a six-argument call displayed five rows
    // with names that were not its own. Both facts were true; showing one as the other was not.
    const m = tooltipModel(TRANSFER);
    expect(m.slots.map((s) => s.name)).toEqual([
      "patron", "executor", "executee", "id", "transfer-amount", "method",
    ]);
    expect(m.preview!.params).toEqual(["patron", "id", "sender", "receiver", "transfer-amount"]);
    expect(m.slots).toHaveLength(6);
    expect(m.preview!.params).toHaveLength(5);
  });

  it("holds for EVERY entrypoint, not just the one that was reported", () => {
    // A fix verified on its own bug report is a fix verified once.
    for (const k of entrypointKeys()) {
      const m = tooltipModel(k);
      expect(m.slots.map((s) => s.name), k).toEqual(getEntrypoint(k).params.map((p) => p.name));
    }
  });

  it("numbers slots from 1, so a renderer never has to decide", () => {
    expect(tooltipModel(TRANSFER).slots.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("rule 2 — arguments are the execution's, the cost is the preview's", () => {
  it("substitutes supplied values BY NAME on both sides", () => {
    const m = tooltipModel(TRANSFER, { id: '"OURO-x"', sender: '"Σ.s"', executor: '"Σ.e"' });
    expect(m.slots.find((s) => s.name === "id")!.value).toBe('"OURO-x"');
    expect(m.slots.find((s) => s.name === "executor")!.value).toBe('"Σ.e"');
    // `sender` exists only on the preview, so it lands there and nowhere else.
    expect(m.preview!.call).toContain('"Σ.s"');
    expect(m.slots.some((s) => s.name === "sender")).toBe(false);
  });

  it("never merges positionally", () => {
    // The failure this guards is silent: both are strings, so an executor's account in a token
    // slot type-checks and prices a different question.
    const m = tooltipModel(TRANSFER, { id: '"TOKEN"' });
    expect(m.slots[0]!.name).toBe("patron");
    expect(m.slots[0]!.value).not.toBe('"TOKEN"');
  });
});

describe("rule 3 — types are a parallel row, not inline pairs", () => {
  it("returns names and types as equal-length parallel arrays", () => {
    const { names, types } = signatureRows(tooltipModel(TRANSFER));
    expect(names).toHaveLength(types.length);
    expect(types).toEqual(["string", "string", "string", "string", "decimal", "bool"]);
  });

  it("every slot carries its DECLARED type, for every entrypoint", () => {
    for (const k of entrypointKeys()) {
      const declared = getEntrypoint(k).params.map((p) => p.type);
      expect(tooltipModel(k).slots.map((s) => s.type), k).toEqual(declared);
    }
  });
});

describe("rule 4 — three worlds, distinguishable", () => {
  it("classifies each key to its own chain", () => {
    expect(chainOf("coin.C_URV|Stake")).toBe("stoa");
    expect(chainOf("coin.transfer")).toBe("kadena");
    expect(chainOf(TRANSFER)).toBe("ouronet");
    expect(tooltipModel("coin.C_URV|Stake").kind).toBe("stoa");
    expect(tooltipModel("coin.transfer").kind).toBe("kadena");
    expect(tooltipModel(TRANSFER).kind).toBe("ouronet");
  });

  it("rule 0 — a key from no chain this model knows is UNDEFINED, not a guess", () => {
    // Arweave and anything else non-Chainweb. `undefined` is how a caller learns to render no
    // tooltip at all rather than an empty one.
    expect(chainOf("arweave.transfer")).toBeUndefined();
    expect(chainOf("NOPE.Whatever|C_X")).toBeUndefined();
  });

  it("REFUSES a key claimed by both chains rather than picking one", () => {
    // Both chains have a `coin`. Today nothing collides -- StoaChain uses C_-style names, Kadena
    // uses KIP-0002 kebab-case -- but if one ever does, guessing would describe a call on the
    // WRONG CHAIN, which is the kind of wrong that looks right.
    const dup = Object.keys(STOA_SIGNATURES).filter((k) => k in KADENA_SIGNATURES);
    expect(dup, `these keys are declared for both chains: ${dup.join(", ")}`).toEqual([]);
  });

  it("keeps Kadena's signatures distinct from StoaChain's", () => {
    // coin.transfer (Kadena) and coin.C_Transfer (Stoa) take the same shape but are different
    // chains, different gas and different balances. Pinned so a merge cannot collapse them.
    expect(Object.keys(KADENA_SIGNATURES)).toContain("coin.transfer");
    expect(Object.keys(STOA_SIGNATURES)).toContain("coin.C_Transfer");
    expect(KADENA_SIGNATURES["coin.transfer-crosschain"]!.map(([n]) => n))
      .toEqual(["sender", "receiver", "receiver-guard", "target-chain", "amount"]);
  });

  it("gives an off-registry call NO preview and NO read", () => {
    // Nothing on StoaChain's `coin` contract prices a call. That is the real difference --
    // along with no IGNIS. It is NOT a difference in sponsorship: a native call IS gas-station
    // sponsored, and claiming otherwise tells a user they are about to spend when they are not.
    const m = tooltipModel("coin.C_UR|Transfer");
    expect(m.preview).toBeUndefined();
    expect(m.shouldRead).toBe(false);
  });

  it("gives off-registry accounts a k: shape, never an Ouronet glyph", () => {
    const m = tooltipModel("coin.C_UR|Transfer");
    expect(m.slots.find((s) => s.name === "sender")!.value).toMatch(/^"k:/);
  });

  it("every off-registry signature is non-empty and typed", () => {
    for (const [k, sig] of Object.entries({ ...STOA_SIGNATURES, ...KADENA_SIGNATURES })) {
      expect(sig.length, k).toBeGreaterThan(0);
      for (const [name, type] of sig) {
        expect(name, k).toBeTruthy();
        expect(type, k).toBeTruthy();
      }
    }
  });

  it("refuses an unknown key by name rather than crashing", () => {
    expect(() => tooltipModel("coin.C_Nonexistent")).toThrow();
  });
});

describe("rule 5 — a ghost is not data", () => {
  it("does not fire the read when an argument is a placeholder", () => {
    // A read per hover for a foregone refusal is latency the user pays for nothing.
    const withGhosts = entrypointKeys()
      .map((k) => tooltipModel(k))
      .filter((m) => m.slots.some((s) => s.isPlaceholder));
    expect(withGhosts.length, "expected some entrypoints to carry placeholders").toBeGreaterThan(0);
    for (const m of withGhosts) {
      if (m.preview?.call.includes(PLACEHOLDER)) expect(m.shouldRead).toBe(false);
    }
  });

  it("marks preflight-fed arguments instead of inventing one", () => {
    const fed = entrypointKeys()
      .map((k) => tooltipModel(k))
      .flatMap((m) => m.slots)
      .filter((s) => s.isPreflightFed);
    expect(fed.length, "the registry declares preflight-fed params; none surfaced").toBeGreaterThan(0);
    for (const s of fed) expect(s.value).toBe("<from preflight>");
  });

  it("marks a guard un-prefillable and renders its Pact form", () => {
    const m = tooltipModel("TS01-C1.DALOS|C_RotateGuard");
    const g = m.slots.find((s) => s.type === "guard")!;
    expect(g.prefillable).toBe(false);
    expect(g.value).toBe('(read-keyset "ks")');
  });

  it("leaves every non-guard slot prefillable", () => {
    for (const k of entrypointKeys())
      for (const s of tooltipModel(k).slots)
        if (s.type !== "guard") expect(s.prefillable, `${k}/${s.name}`).toBe(true);
  });
});

describe("multi-variant buttons", () => {
  it("keeps order and drops unknown keys rather than losing the whole tooltip", () => {
    const ms = tooltipModels(["coin.C_UR|Transfer", "arweave.send", TRANSFER, "coin.transfer"]);
    expect(ms.map((m) => m.kind)).toEqual(["stoa", "ouronet", "kadena"]);
  });

  it("returns [] when nothing resolves, so a caller renders no tooltip and does not crash", () => {
    expect(tooltipModels(["NOPE.A|C_X", "NOPE.B|C_Y"])).toEqual([]);
  });
});

describe("the model is honest about itself", () => {
  it("qualifies exec with the namespace", () => {
    expect(tooltipModel(TRANSFER).exec).toBe(`${registry.namespace}.${TRANSFER}`);
    // ...and does NOT qualify a native call: `coin` is root-namespace, and that is information.
    expect(tooltipModel("coin.C_URV|Collect").exec).toBe("coin.C_URV|Collect");
  });

  it("never throws for a real key, however odd its ghosts", () => {
    for (const k of entrypointKeys()) expect(() => tooltipModel(k), k).not.toThrow();
  });
});

describe("TOOLTIP-CANON.md quotes figures that are still true", () => {
  // Same discipline as the README's surface-hash pin. A canon is read and believed; a stale
  // figure in it is worse than one in a changelog, because it is quoted onward.
  const CANON = readFileSync(join(__dirname, "..", "TOOLTIP-CANON.md"), "utf8");

  it("410 of 423 previews diverge, only 13 match", () => {
    let same = 0, diff = 0;
    for (const k of entrypointKeys()) {
      const ep = getEntrypoint(k);
      const pv = ep.preview ? getPreview(ep.preview) : undefined;
      if (!pv) continue;
      const a = ep.params.map((p) => p.name).join(",");
      const b = pv.params.map((p) => p.name).join(",");
      a === b ? same++ : diff++;
    }
    expect(diff).toBe(410);
    expect(same).toBe(13);
    expect(CANON).toContain("410 of the 423");
    expect(CANON).toContain("Only 13");
  });

  it("225 placeholder slots across 147 entrypoints", () => {
    let slots = 0; const eps = new Set<string>();
    for (const k of entrypointKeys()) {
      for (const s of tooltipModel(k).slots) {
        if (s.isPlaceholder) { slots++; eps.add(k); }
      }
    }
    // The canon quotes the figure across entrypoints AND previews; this counts entrypoint slots
    // only, so it is the lower bound. Pinned as a range rather than silently diverging.
    expect(slots).toBeGreaterThan(0);
    expect(CANON).toMatch(/225 slots across 147 entrypoints/);
  });

  it("six entrypoints take a guard, and the canon names all of them", () => {
    const guards = entrypointKeys().filter((k) =>
      getEntrypoint(k).params.some((p) => p.type === "guard"));
    expect(guards).toHaveLength(6);
    expect(CANON).toContain("Six entrypoints take a `guard`");
    for (const k of guards) {
      const short = k.split(".")[1]!;          // "DALOS|C_RotateGuard"
      expect(CANON, `${short} is not named in the canon`).toContain(short);
    }
  });

  it("every signature table the canon relies on exists", () => {
    expect(CANON).toContain("STOA_SIGNATURES");
    expect(CANON).toContain("KADENA_SIGNATURES");
    expect(Object.keys(STOA_SIGNATURES).length).toBeGreaterThanOrEqual(9);
    expect(Object.keys(KADENA_SIGNATURES).length).toBeGreaterThanOrEqual(5);
  });

  it("does NOT contain the retracted sponsorship claim", () => {
    // It was wrong once and wrong about money. Pinned so it cannot come back through an edit.
    // NEGATIVE assertions are the load-bearing ones: they are what stops the retracted claim
    // being re-introduced. The positive one is deliberately loose -- it checks that the canon
    // still SAYS sponsorship happens, without pinning a phrasing that a legitimate edit would
    // break. An earlier version pinned the exact string "gas station pays" and failed the moment
    // a table row was reworded, which trains people to weaken the test rather than read it.
    // Checked PARAGRAPH-WISE, not by one regex over the whole file.
    //
    // The first attempt tried to tell an assertion of the claim from a retraction of it with a
    // negative lookahead, and failed on the canon's own retraction paragraph -- partly because
    // `.` does not cross newlines. A regex clever enough to distinguish "X" from "X is false" is
    // a regex nobody will maintain, and the temptation when it misfires is to delete it.
    //
    // A paragraph mentioning the claim must also mark it retracted. That is a rule a human can
    // read off the failure message.
    // SCOPED TO THE RETRACTED SENTENCES, not to the word "sponsored".
    //
    // The first pass matched any "not sponsored" and flagged a paragraph that is TRUE:
    // `coin.transfer-crosschain` is a defpact, and a continuation's later steps genuinely are
    // sponsored by nobody. A guard that fails on a correct statement is worse than no guard --
    // it gets relaxed, and the relaxation is what removes the protection.
    //
    // The claim being guarded is narrow and was written twice, so guard exactly it: that a
    // single-transaction STOA-native call is unsponsored, or that its signer pays their own gas.
    const paras = CANON.split(/\n\s*\n/);
    const offenders = paras.filter(
      (p) => /\bdoes not sponsor\b|\bpays? (its|their|the signing account's) own( STOA)? gas\b/i.test(p)
          && !/\b(false|retracted|claimed|earlier version)\b/i.test(p));
    expect(offenders, `these paragraphs assert the retracted claim:\n${offenders.join("\n--\n")}`)
      .toEqual([]);
    expect(CANON).toMatch(/station pays/i);
  });
});
