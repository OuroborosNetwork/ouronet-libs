import { describe, it, expect } from "vitest";
import { buildCall } from "../src/index";

/**
 * FACILITY #16 — an object argument passed as `(read-msg 'name)`.
 *
 * Added 2026-10-28 because `SwapInterface`'s two WITH-slippage variants could not be expressed
 * at all. `slippage-bounds` is `object{SwapperUsageV4.Slippage}`:
 *
 *     expected-output-amount:decimal
 *     output-precision:integer
 *     slippage-percent:decimal
 *
 * and object FIELDS are rendered by `formatLoose`, which is documented as best-effort because
 * the registry carries a parameter's type but not the named schema's field types. So a
 * whole-number decimal rendered as a Pact INTEGER, and JavaScript cannot express the difference
 * (`5.0 === 5`).
 *
 * The deeper reason is provenance: a `Slippage` is built BY THE CHAIN
 * (`SWPU.UDC_SpawnSlippageBounds`) and handed straight back, so the transaction's `data` returns
 * the chain its own JSON instead of re-serialising it through a JS formatter.
 */

const SWAP = "TS01-C3.SWP|C_SingleSwapWithSlippage";
const BASE = {
  patron: "Σ.p", executor: "Σ.e", swpair: "SW1",
  "input-id": "A", "input-amount": 1.5, "output-id": "B",
};

describe("an object argument may be a transaction-data reference", () => {
  it("renders a string as (read-msg 'name)", () => {
    expect(buildCall(SWAP, { ...BASE, "slippage-bounds": "slippage-bounds" }))
      .toBe(`(ouronet-ns.${SWAP} "Σ.p" "Σ.e" "SW1" "A" 1.5 "B" (read-msg 'slippage-bounds))`);
  });

  it("accepts the explicit { readMsg } form, like { readKeyset } for guards", () => {
    expect(buildCall(SWAP, { ...BASE, "slippage-bounds": { readMsg: "sb" } }))
      .toContain("(read-msg 'sb)");
  });

  it("STILL renders a real object inline — the one existing consumer is untouched", () => {
    /**
     * `C_UpdateSpecialFeeTargets` passes `[object{SwapperV5.FeeSplit}]`, whose schema is
     * `{target:string, value:integer}` — no decimal, so inline rendering is correct for it and
     * must not change. This facility is ADDITIVE precisely so that spec needs no edit.
     */
    const out = buildCall("TS01-C3.SWP|C_UpdateSpecialFeeTargets", {
      patron: "Σ.p", executor: "Σ.e", swpair: "SW1",
      targets: [{ target: "Σ.a", value: 40 }, { target: "Σ.b", value: 60 }],
    });
    expect(out).toContain('{ "target": "Σ.a", "value": 40 }');
    expect(out, "an inline object must not become a read-msg").not.toContain("read-msg");
  });

  it("refuses a value that is neither an object nor a data-key name", () => {
    // The message must name BOTH ways out, or it sends the reader to inline an object that
    // cannot be rendered correctly.
    expect(() => buildCall(SWAP, { ...BASE, "slippage-bounds": 5 }))
      .toThrow(/Expected an object .* or the NAME of a transaction-data key/);
  });

  it("the data-key name is NOT quoted — `(read-msg 'x)`, not `(read-msg \"x\")`", () => {
    /**
     * Both parse in Pact, and the deployed templates use the symbol form. Matching them exactly
     * means a migrated call is byte-comparable with the template it replaces, which is how this
     * sweep has been catching its own mistakes.
     */
    const out = buildCall(SWAP, { ...BASE, "slippage-bounds": "sb" });
    expect(out).toContain("(read-msg 'sb)");
    expect(out).not.toContain('(read-msg "sb")');
  });
});
