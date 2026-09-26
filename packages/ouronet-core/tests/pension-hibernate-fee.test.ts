/**
 * The hibernation fee, pinned against the chain's own arithmetic.
 *
 * `getHibernateFee` used to call `DPL-UR.URC_0012_HibernateFee`, which has never existed in any
 * Pact source in the Ouronet repo -- `git log -S` over the whole history finds it zero times.
 * Every call was a resolution error, and every figure the Brumate and Constrict modals displayed
 * came from a hardcode in the `catch`.
 *
 * THE HARDCODE WAS NUMERICALLY CORRECT, which is exactly why it survived review. Mainnet holds
 * peak = 120 promille and decay = 0.008 promille/day, so `0.12 - 0.000008*d` was the right
 * answer. So the risk this file guards is not "is the formula right today" but "does it still
 * agree with the chain once the chain's parameters move" -- and `ATS|C_SetHibernationFees` makes
 * that a live entrypoint, not a hypothetical.
 *
 * The fixtures are RECORDED MAINNET OUTPUT from `ATS::URC_RewardBearingTokenAmountsWithHibernation`,
 * measured 2026-09-26. They are the contract's own answer to the question, not a restatement of
 * ours in test form.
 */
import { describe, expect, it } from "vitest";
import { deriveHibernationFee } from "../src/interactions/pensionFunctions";

/** `UR_Hibernate` / `UR_PeakHibernatePromile` / `UR_HibernateDecay` / `UR_Royalty`, mainnet. */
const GOLDEN_STOA_PILLAR = { on: true, peak: 120, decay: 0.008, royalty: 10 };

/**
 * `(ouronet-ns.ATS.URC_RewardBearingTokenAmountsWithHibernation
 *    "GoldenStoaPillar-O136CBn22ncY" "WSTOA-8Nh-JO8JO4F5" 1000000.0 <dayz>)` -- verbatim.
 *
 * NOTE THE DENOMINATOR. The oracle is `hibernation-fee / first-input-amount`, not
 * `/ primal-input-amount`: ATS takes the pool's royalty off the deposit and charges hibernation
 * on what is left. Dividing by the deposit gives 118.8 against a peak of 120 and reads as a 1%
 * rounding error rather than as the royalty it actually is -- which is how a fee breakdown ends
 * up quietly understating itself.
 */
const CHAIN_ORACLE = [
  { dayz: 0,   hibernationFee: 118800.0, firstInputAmount: 990000.0, royaltyFee: 10000.0 },
  { dayz: 365, hibernationFee: 115909.2, firstInputAmount: 990000.0, royaltyFee: 10000.0 },
];

describe("hibernation fee agrees with the chain that charges it", () => {
  for (const o of CHAIN_ORACLE) {
    it(`reproduces mainnet's promille at dayz=${o.dayz}`, () => {
      const chainPromille = (o.hibernationFee / o.firstInputAmount) * 1000;
      expect(deriveHibernationFee(GOLDEN_STOA_PILLAR, o.dayz).hibernationPromille)
        .toBeCloseTo(chainPromille, 9);
    });
  }

  it("surfaces the royalty the fee display omits", () => {
    const o = CHAIN_ORACLE[0];
    const ours = deriveHibernationFee(GOLDEN_STOA_PILLAR, o.dayz);
    expect(ours.royaltyPromille).toBeCloseTo((o.royaltyFee / 1000000.0) * 1000, 9);
    // What the user actually loses: 1% royalty, then 11.88% of the remaining 99%.
    expect(ours.totalFraction).toBeCloseTo((o.royaltyFee + o.hibernationFee) / 1000000.0, 9);
    // ...strictly more than the single number the modals show.
    expect(ours.totalFraction).toBeGreaterThan(ours.hibernationFraction);
  });
});

describe("the parameters are the chain's, not ours", () => {
  it("follows peak and decay when the pool owner retunes them", () => {
    const retuned = { on: true, peak: 60, decay: 0.004, royalty: 10 };
    expect(deriveHibernationFee(retuned, 0).hibernationPromille).toBe(60);
    expect(deriveHibernationFee(retuned, 365).hibernationPromille).toBeCloseTo(58.54, 9);
    // The retired hardcode's answer for the same pool and the same day, for contrast:
    expect(0.12 - 0.000008 * 365).toBeCloseTo(0.11708, 9);
  });

  it("applies the chain's clamp rather than going negative", () => {
    // ATS::URCx_RBT-Amount: (if (<= raw 0.0) 0.0 raw). 120 / 0.008 = 15000 days to zero.
    expect(deriveHibernationFee(GOLDEN_STOA_PILLAR, 15000).hibernationPromille).toBe(0);
    expect(deriveHibernationFee(GOLDEN_STOA_PILLAR, 99999).hibernationPromille).toBe(0);
  });

  it("charges nothing when the pool has hibernation switched off", () => {
    // ATS branches on UR_Hibernate before computing any hibernation fee at all.
    const off = { ...GOLDEN_STOA_PILLAR, on: false };
    expect(deriveHibernationFee(off, 0).hibernationPromille).toBe(0);
    expect(deriveHibernationFee(off, 0).hibernationFraction).toBe(0);
    // The royalty is NOT conditional on hibernation, so it still applies.
    expect(deriveHibernationFee(off, 0).totalFraction).toBeCloseTo(0.01, 9);
  });

  it("accepts a Pact decimal in either wire shape", () => {
    const wrapped = { on: true, peak: { decimal: "120.0" }, decay: { decimal: "0.008" },
                      royalty: { decimal: "10.0" } };
    expect(deriveHibernationFee(wrapped, 365).hibernationPromille).toBeCloseTo(117.08, 9);
  });

  it("refuses non-numeric parameters instead of returning NaN", () => {
    expect(() => deriveHibernationFee({ on: true, peak: "x", decay: 1 }, 0))
      .toThrow(/not numeric/);
  });
});
