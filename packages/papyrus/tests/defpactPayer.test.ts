import { describe, it, expect } from "vitest";
import {
  defpactPayerVerdict, ASSUMED_STEP_GAS,
} from "../src/defpactPayer.js";

/**
 * WHO PAYS FOR A DEFPACT'S CONTINUATIONS — owner ruling, 2026-10-29.
 *
 * *"the payment key of the currently selected Ouronet Account … The user has to be warned about
 * this that his payment key must contain sufficient stoa otherwise his continuations may not
 * happen and the execution may end up stranded."*
 *
 * The ruling asks for a WARNING. These tests also pin a REFUSAL, and the reason is not caution:
 * `MTX-SWP` pacts are PERISHABLE — the middle step enforces the pool has not moved since step 0 —
 * so a user who cannot pay step 1 does not wait, they lose the operation. Two liquidity additions
 * stranded that way on 2026-10-15.
 */

const GAS_PRICE = 1e-8;
const base = { paymentKeyAddr: "k:" + "a".repeat(64), paymentKeyStoa: 100, steps: 3,
               gasPrice: GAS_PRICE };

describe("the warning is always present", () => {
  it("names the payer, the gas station's limit, and the consequence", () => {
    const v = defpactPayerVerdict(base);
    // THREE THINGS, because any one alone is misleading: who pays, why the usual payer cannot,
    // and what happens if the key runs dry. "You pay for this" without "and it cannot be
    // restarted" understates it to the point of being wrong.
    expect(v.warning).toMatch(/PAYMENT KEY/);
    expect(v.warning).toMatch(/gas station cannot fund a continuation/);
    expect(v.warning).toMatch(/cannot be restarted|left unfinished/);
  });

  it("is given even when the run is permitted", () => {
    // A warning only shown on refusal is a warning nobody who proceeds ever reads.
    expect(defpactPayerVerdict(base).blocked).toBeNull();
    expect(defpactPayerVerdict(base).warning.length).toBeGreaterThan(80);
  });
});

describe("the refusal", () => {
  it("blocks a key that cannot cover the continuations, naming both figures", () => {
    const v = defpactPayerVerdict({ ...base, paymentKeyStoa: 0.000001 });
    expect(v.blocked).toMatch(/0\.0000/);                 // what the key holds
    expect(v.blocked).toMatch(/2 continuation steps/);    // 3 steps => 2 continuations
    expect(v.blocked).toMatch(/strand/);
  });

  it("counts CONTINUATIONS, not steps — step 0 is gas-station funded", () => {
    /**
     * The asymmetry is the whole hazard and an off-by-one here would misprice every run.
     * `ouronet-ns.TS` is a whitelisted first form, so the station funds step 0 exactly as it
     * funds any other Talos call; only 1..N-1 fall to the user.
     */
    const three = defpactPayerVerdict({ ...base, steps: 3 }).estimatedStoa!;
    const two   = defpactPayerVerdict({ ...base, steps: 2 }).estimatedStoa!;
    expect(three / two).toBeCloseTo(2, 6);                // 2 continuations vs 1
    // A single-step "pact" needs no continuation at all.
    expect(defpactPayerVerdict({ ...base, steps: 1 }).estimatedStoa).toBeNull();
  });

  it("prefers a MEASURED step cost over the assumed floor", () => {
    const assumed  = defpactPayerVerdict(base).estimatedStoa!;
    const measured = defpactPayerVerdict({ ...base, measuredStepGas: 50_000 }).estimatedStoa!;
    expect(assumed).toBeCloseTo(2 * ASSUMED_STEP_GAS * GAS_PRICE, 12);
    expect(measured).toBeCloseTo(2 * 50_000 * GAS_PRICE, 12);
    expect(measured).toBeLessThan(assumed);
  });

  it("waits rather than guessing while either input is still resolving", () => {
    // Neither unknown may read as "you cannot afford this" — that would refuse a funded user
    // for a reason that is about the UI rather than about them.
    expect(defpactPayerVerdict({ ...base, paymentKeyAddr: null }).blocked)
      .toMatch(/Resolving/);
    expect(defpactPayerVerdict({ ...base, paymentKeyStoa: null }).blocked)
      .toMatch(/Reading/);
    for (const v of [{ ...base, paymentKeyAddr: null }, { ...base, paymentKeyStoa: null }])
      expect(defpactPayerVerdict(v).blocked).not.toMatch(/strand/);
  });

  it("does not refuse when the step count is unknown — it has nothing to compare", () => {
    /**
     * A registry without a `steps` figure means the partition did not declare one. Refusing on
     * that would turn missing METADATA into a refusal about the user's BALANCE, which is a lie
     * about whose problem it is. The warning still shows.
     */
    const v = defpactPayerVerdict({ ...base, steps: null, paymentKeyStoa: 0 });
    expect(v.blocked).toBeNull();
    expect(v.estimatedStoa).toBeNull();
    expect(v.warning).toMatch(/PAYMENT KEY/);
  });

  it("permits a key that exactly covers the estimate", () => {
    // A boundary that refuses what it computes as sufficient would be incoherent.
    const need = defpactPayerVerdict(base).estimatedStoa!;
    expect(defpactPayerVerdict({ ...base, paymentKeyStoa: need }).blocked).toBeNull();
    expect(defpactPayerVerdict({ ...base, paymentKeyStoa: need * 0.999 }).blocked)
      .toMatch(/strand/);
  });
});
