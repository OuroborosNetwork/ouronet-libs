/**
 * v3.3.8 — documentation/deprecation cleanup pass regression locks
 * (ouronet-core slice).
 *
 * Closes the audit-finding subset that lives in ouronet-core code:
 *
 *   F-API-016 — `CoilConfig` interface used by the exported
 *               `COIL_CONFIGS` constant was itself NOT exported.
 *               Fix: added `export`. Locked at T1 below.
 *
 * The stoa-core regression-lock subset (F-ARCH-011 normalizeKeysetRef
 * barrel-reach + F-ARCH-012 dalos/account.ts quote-style) was split
 * out at v4.0.0 to live alongside its SUT in
 * `packages/stoa-core/tests/v3-3-8-doc-cleanup.test.ts`.
 *
 * F-API-015 (stale JSDoc) and F-SEC-005/F-ARCH-014 (`@deprecated`
 * marker on KADENA_BASE_URL — Ouronet-side, scheduled for deletion
 * in v4.0.0 Phase 3) are pure JSDoc changes with no runtime surface.
 * The CHANGELOG entry is the audit trail.
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import { CoilConfig, COIL_CONFIGS } from "../src/interactions/coilFunctions";

// ══ T1 (F-API-016) ══════════════════════════════════════════════════════════
describe("v3.3.8 — F-API-016 CoilConfig type export regression-lock", () => {
  it("CoilConfig is exported as a type from `@ouronet/ouronet-core/interactions/coilFunctions`", () => {
    // The import line above resolves CoilConfig as a type. If the
    // `export` keyword on the interface is dropped, TS errors out
    // at typecheck time (the test file fails to compile). Runtime
    // assertion is just belt-and-suspenders that the COIL_CONFIGS
    // values still match the shape — exercises the type by usage.
    const sample: CoilConfig = COIL_CONFIGS.ouroToAuryn;
    expectTypeOf<CoilConfig>().toEqualTypeOf<{
      atsPair: string;
      sourceToken: string;
      targetToken: string;
      previewCommand: string;
    }>();
    expect(typeof sample.atsPair).toBe("string");
    expect(typeof sample.sourceToken).toBe("string");
    expect(typeof sample.targetToken).toBe("string");
    expect(typeof sample.previewCommand).toBe("string");
  });
});
