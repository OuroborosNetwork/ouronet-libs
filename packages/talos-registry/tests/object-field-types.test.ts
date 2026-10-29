/**
 * A DECIMAL FIELD INSIDE AN OBJECT LITERAL — the one type JavaScript cannot carry on its own.
 *
 * `formatObject` renders an object's FIELDS through `formatLoose`, which has no declared type to
 * work from: the registry carries a parameter's type (`object{...VacateTfLeg}`) but not the named
 * schema's FIELD types. For every Pact type but one that is harmless. For `decimal` it is not,
 * because `100.0 === 100` in JavaScript — the trailing zero is gone before this package sees the
 * value, and Pact's decimal lexer refuses a bare integer in a decimal slot.
 *
 * The first test CHARACTERISES the defect rather than asserting it away: it is still the
 * behaviour for an untagged value, and must be, or every existing consumer changes meaning. The
 * rest exercise the opt-in that fixes it.
 */
import { describe, expect, it } from "vitest";
import {
  buildPreviewCall, formatForType, pactDecimal, pactInteger, RegistryError,
} from "../src/index.js";

const LEG = (balance: unknown) => ({
  "asset-id": "OURO-8Nh-JO8JO4F5",
  legs: [{ "owner-id": "a", "beneficiary-id": "b", balance }],
});

describe("an untagged decimal field", () => {
  /**
   * THE DEFECT, PINNED. Not a wish — the behaviour an existing caller gets today, which must not
   * change silently. A whole number renders as an integer; a fractional one renders correctly.
   * The intermittence is the whole hazard.
   */
  it("renders a whole number as an INTEGER, and a fraction correctly", () => {
    const whole = formatForType(LEG(100), "object{X.VacateTfLeg}");
    const fraction = formatForType(LEG(2.5), "object{X.VacateTfLeg}");
    expect(whole).toContain('"balance": 100');
    expect(whole).not.toContain('"balance": 100.0');
    expect(fraction).toContain('"balance": 2.5');
  });

  it("renders a whole-number decimal LIST as an integer list", () => {
    const o = formatForType({ amounts: [1, 2.5] }, "object{X.Y}");
    expect(o).toContain('"amounts": [1 2.5]');
  });
});

describe("pactDecimal", () => {
  it("renders a whole number with the point Pact requires", () => {
    expect(formatForType(LEG(pactDecimal(100)), "object{X.VacateTfLeg}"))
      .toContain('"balance": 100.0');
  });

  it("leaves a fractional value alone", () => {
    expect(formatForType(LEG(pactDecimal(2.5)), "object{X.VacateTfLeg}"))
      .toContain('"balance": 2.5');
  });

  /**
   * THE STRING FORM IS THE LOSSLESS ONE. Pact decimals carry up to 24 places; a JS `number` holds
   * about 15 significant digits. A value READ FROM THE CHAIN and handed back should travel as the
   * digits the chain sent, or the round trip quietly rounds it.
   */
  it("passes a chain-shaped decimal string through verbatim", () => {
    const exact = "16.800576521961000000000000";
    expect(formatForType(LEG(pactDecimal(exact)), "object{X.VacateTfLeg}"))
      .toContain(`"balance": ${exact}`);
  });

  it("adds the point to an integral string", () => {
    expect(formatForType(LEG(pactDecimal("100")), "object{X.VacateTfLeg}"))
      .toContain('"balance": 100.0');
  });

  it("works inside a nested list of objects", () => {
    const code = formatForType(
      [{ "asset-id": "N", legs: [{ nonces: [7], amounts: [pactDecimal(1)] }] }],
      "[object{X.VacateNonceLane}]");
    expect(code).toContain('"amounts": [1.0]');
    expect(code).toContain('"nonces": [7]');
  });

  it("refuses a value that is not a decimal at all", () => {
    expect(() => formatForType(LEG(pactDecimal("not-a-number" as never)),
      "object{X.VacateTfLeg}")).toThrow(RegistryError);
  });
});

describe("pactInteger", () => {
  it("renders a whole number unchanged", () => {
    expect(formatForType({ n: pactInteger(7) }, "object{X.Y}")).toContain('"n": 7');
  });

  /**
   * THE MIRROR DEFECT, TURNED INTO AN ERROR. Untagged, a fractional value in an integer field
   * renders as `2.5` and is refused by the chain after signing. Tagged, it is refused here, with
   * the value named.
   */
  it("refuses a fraction, which untagged would render as a decimal", () => {
    expect(formatForType({ n: 2.5 }, "object{X.Y}")).toContain('"n": 2.5');
    expect(() => formatForType({ n: pactInteger(2.5) }, "object{X.Y}")).toThrow(/integer/i);
  });
});

/**
 * THE CASE THAT MOTIVATED THIS, END TO END — the whole-pool vacate preview OuronetUI could not
 * build. Two legs, one whole balance and one fractional, plus a nonce lane whose `amounts` are
 * `[decimal]`. Untagged it renders two refusals; tagged it renders a call Pact accepts.
 */
describe("INFO_AQP-POOL|FullVacate", () => {
  const KEY = "TS02-C3.AQP-POOL|CC_FullVacate";
  const tfLane = (tag: boolean) => ({
    "asset-id": "OURO-8Nh-JO8JO4F5",
    legs: [
      { "owner-id": "a", "beneficiary-id": "b", balance: tag ? pactDecimal(100) : 100 },
      { "owner-id": "c", "beneficiary-id": "d", balance: tag ? pactDecimal(2.5) : 2.5 },
    ],
  });
  const collLane = (tag: boolean) => ({
    "asset-id": "DHB-8Nh-JO8JO4F5",
    legs: [{ "owner-id": "e", "beneficiary-id": "e", nonces: [7],
             amounts: [tag ? pactDecimal(1) : 1] }],
  });
  const args = (tag: boolean) => ({
    patron: "A", "pool-id": "P|x",
    "tf-lanes": [tfLane(tag)], "of-lanes": [],
    "coll-lanes": [collLane(tag)], "coll-son": false,
  });

  it("renders two integers into decimal slots when untagged", () => {
    const code = buildPreviewCall(KEY, args(false));
    expect(code).toContain('"balance": 100');
    expect(code).not.toContain('"balance": 100.0');
    expect(code).toContain('"amounts": [1]');
  });

  it("renders every decimal with its point when tagged", () => {
    const code = buildPreviewCall(KEY, args(true));
    expect(code).toContain('"balance": 100.0');
    expect(code).toContain('"balance": 2.5');
    expect(code).toContain('"amounts": [1.0]');
    // and the integer list is untouched -- a nonce is an integer and must stay one
    expect(code).toContain('"nonces": [7]');
  });
});
