/**
 * CFM Pact-code builder tests — Tier 1, Group A from the testing
 * strategy doc. One test per builder, verifying the exact Pact-code
 * string shape a canonical input produces.
 *
 * These catch:
 *   - Pact function-name typos (C_Coyl vs C_Coil, missing underscore)
 *   - Namespace drift (ouronet-ns hardcoded correctly)
 *   - Module + function separator (| vs :)
 *   - Argument ORDER (swapping patron + resident = silent on-chain failure)
 *   - Quoting (strings quoted, decimals/ints bare)
 *   - Decimal formatting (amount "5" → "5.0", not "5")
 *
 * Every CFM modal in OuronetUI now imports its builder from here
 * instead of inlining the template literal. If you're adding a new
 * CFM function, add its builder + test together.
 */

import { describe, it, expect } from "vitest";
import {
  buildTransferPactCode,
  buildClearDispoPactCode,
  buildSublimatePactCode,
  buildCompressPactCode,
  buildCoilPactCode,
  buildCurlPactCode,
  buildBrumatePactCode,
  buildConstrictPactCode,
  buildColdRecoveryPactCode,
  buildDirectRecoveryPactCode,
  buildCullPactCode,
  buildAwakePactCode,
  buildSlumberPactCode,
  buildFirestarterPactCode,
  buildChangeOwnershipPactCode,
  buildModifyCanChangeOwnerPactCode,
  buildModifyWeightsPactCode,
  buildToggleSwapCapabilityPactCode,
  buildToggleAddLiquidityPactCode,
  buildWrapStoaPactCode,
  buildWrapUrStoaPactCode,
  buildUnwrapStoaPactCode,
  buildUnwrapStoaWithCreateAccountPactCode,
  buildUnwrapUrStoaPactCode,
  buildUnwrapUrStoaWithCreateAccountPactCode,
  buildStakeUrStoaPactCode,
  buildUnstakeUrStoaPactCode,
  buildCollectUrStoaPactCode,
  buildCollectUrStoaWithCreateAccountPactCode,
  buildNativeUrTransferPactCode,
  buildNativeUrTransmitPactCode,
  buildNativeUrTransferAnewPactCode,
  buildNativeUrTransmitAnewPactCode,
  buildDeployStandardAccountPactCode,
  buildDeploySmartAccountPactCode,
  buildAddLiquidityPactCode,
  buildRemoveLiquidityPactCode,
  buildSingleSwapWithSlippagePactCode,
  buildSingleSwapNoSlippagePactCode,
  buildMultiSwapWithSlippagePactCode,
  buildMultiSwapNoSlippagePactCode,
  buildCreateSetPactCode,
  buildCreateSetNFTPactCode,
  buildRotateSovereignPactCode,
  buildRotateGovernorPactCode,
  buildNonKeyGuardExpr,
  buildReleaseStoicTagPactCode,
  buildRegisterStoicTagPactCode,
  buildRotateGuardPactCode,
  buildRotateKadenaPactCode,
} from "../src/pact/cfmBuilders";

// ─── Canonical fixture values (used across many tests) ──────────────────────

const PATRON   = "ouro:PATRON-A";
const RESIDENT = "ouro:RESIDENT-B";
const SENDER   = RESIDENT;
const RECEIVER = "ouro:RECEIVER-C";
const ATS_A    = "Auryndex-O136CBn22ncY";
const ATS_B    = "EliteAuryndex-O136CBn22ncY";
const RT       = "OURO";          // reward-token id
const TOKEN    = "GSTOA-xyz";     // generic token-id for Transfer
const DPOF     = "H|GSTOA-xyz";

// ─── TS01-C1.DPTF — Transfer + ClearDispo ───────────────────────────────────

describe("buildTransferPactCode", () => {
  it("emits the canonical 6-arg C_Transfer shape", () => {
    expect(
      buildTransferPactCode({
        patron: PATRON, tokenId: TOKEN, sender: SENDER,
        receiver: RECEIVER, amount: "5", method: false,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DPTF|C_Transfer "${PATRON}" "${TOKEN}" "${SENDER}" "${RECEIVER}" 5.0 false)`,
    );
  });

  it("formats integer amounts with .0 suffix (Pact decimal lexer)", () => {
    const code = buildTransferPactCode({
      patron: PATRON, tokenId: TOKEN, sender: SENDER,
      receiver: RECEIVER, amount: "1000", method: false,
    });
    expect(code).toContain(" 1000.0 ");
  });

  it("preserves fractional amounts verbatim", () => {
    const code = buildTransferPactCode({
      patron: PATRON, tokenId: TOKEN, sender: SENDER,
      receiver: RECEIVER, amount: "3.14159", method: false,
    });
    expect(code).toContain(" 3.14159 ");
  });

  it("emits method=true for smart-account flows", () => {
    const code = buildTransferPactCode({
      patron: PATRON, tokenId: TOKEN, sender: SENDER,
      receiver: RECEIVER, amount: "1", method: true,
    });
    expect(code).toMatch(/ true\)$/);
  });
});

describe("buildClearDispoPactCode", () => {
  it("emits the 2-arg C_ClearDispo shape", () => {
    expect(
      buildClearDispoPactCode({ patron: PATRON, account: RESIDENT }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DPTF|C_ClearDispo "${PATRON}" "${RESIDENT}")`,
    );
  });
});

// ─── TS01-C2.ORBR — Sublimate + Compress ────────────────────────────────────

describe("buildSublimatePactCode", () => {
  it("emits the 3-arg C_Sublimate shape", () => {
    expect(
      buildSublimatePactCode({ client: RESIDENT, target: RESIDENT, amount: "1" }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ORBR|C_Sublimate "${RESIDENT}" "${RESIDENT}" 1.0)`,
    );
  });

  it("supports gift-style where client !== target", () => {
    const code = buildSublimatePactCode({ client: RESIDENT, target: RECEIVER, amount: "2.5" });
    expect(code).toContain(`"${RESIDENT}" "${RECEIVER}"`);
  });
});

describe("buildCompressPactCode", () => {
  it("emits the 2-arg C_Compress shape with .0-formatted integer amount", () => {
    expect(
      buildCompressPactCode({ client: RESIDENT, ignisAmount: "5" }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ORBR|C_Compress "${RESIDENT}" 5.0)`,
    );
  });
});

// ─── TS01-C2.ATS — autostake pool (Coil/Curl/Brumate/Constrict/...) ─────────

describe("buildCoilPactCode", () => {
  it("emits the 5-arg C_Coil shape", () => {
    expect(
      buildCoilPactCode({
        patron: PATRON, coiler: RESIDENT, atsId: ATS_A,
        rewardTokenId: RT, amount: "100",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_Coil "${PATRON}" "${RESIDENT}" "${ATS_A}" "${RT}" 100.0)`,
    );
  });
});

describe("buildCurlPactCode", () => {
  it("emits the 6-arg C_Curl shape (two ats ids)", () => {
    expect(
      buildCurlPactCode({
        patron: PATRON, curler: RESIDENT, ats1Id: ATS_A, ats2Id: ATS_B,
        rewardTokenId: RT, amount: "50",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_Curl "${PATRON}" "${RESIDENT}" "${ATS_A}" "${ATS_B}" "${RT}" 50.0)`,
    );
  });

  it("preserves ats1/ats2 order (swapping them IS a bug)", () => {
    const code = buildCurlPactCode({
      patron: PATRON, curler: RESIDENT, ats1Id: "POOL-FIRST", ats2Id: "POOL-SECOND",
      rewardTokenId: RT, amount: "1",
    });
    // "POOL-FIRST" must appear before "POOL-SECOND" in the string.
    const first  = code.indexOf("POOL-FIRST");
    const second = code.indexOf("POOL-SECOND");
    expect(first).toBeLessThan(second);
    expect(first).toBeGreaterThanOrEqual(0);
  });
});

describe("buildBrumatePactCode", () => {
  it("emits the 7-arg C_Brumate shape (Curl + dayz)", () => {
    expect(
      buildBrumatePactCode({
        patron: PATRON, brumator: RESIDENT, ats1Id: ATS_A, ats2Id: ATS_B,
        rewardTokenId: RT, amount: "10", lockDays: 365,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_Brumate "${PATRON}" "${RESIDENT}" "${ATS_A}" "${ATS_B}" "${RT}" 10.0 365)`,
    );
  });

  it("dayz is emitted as a bare integer (not a decimal)", () => {
    const code = buildBrumatePactCode({
      patron: PATRON, brumator: RESIDENT, ats1Id: ATS_A, ats2Id: ATS_B,
      rewardTokenId: RT, amount: "1", lockDays: 7,
    });
    // last-arg before closing paren is just `7`, not `7.0`
    expect(code).toMatch(/ 7\)$/);
  });
});

describe("buildConstrictPactCode", () => {
  it("emits the 6-arg C_Constrict shape (Coil + dayz)", () => {
    expect(
      buildConstrictPactCode({
        patron: PATRON, constricter: RESIDENT, atsId: ATS_A,
        rewardTokenId: RT, amount: "20", lockDays: 30,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_Constrict "${PATRON}" "${RESIDENT}" "${ATS_A}" "${RT}" 20.0 30)`,
    );
  });
});

describe("buildColdRecoveryPactCode", () => {
  it("emits the 4-arg C_ColdRecovery shape", () => {
    expect(
      buildColdRecoveryPactCode({
        patron: PATRON, recoverer: RESIDENT, atsId: ATS_A, ra: "5",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_ColdRecovery "${PATRON}" "${RESIDENT}" "${ATS_A}" 5.0)`,
    );
  });
});

describe("buildDirectRecoveryPactCode", () => {
  it("emits the 4-arg C_DirectRecovery shape (same params as Cold, different fn name)", () => {
    const cold = buildColdRecoveryPactCode({
      patron: PATRON, recoverer: RESIDENT, atsId: ATS_A, ra: "5",
    });
    const direct = buildDirectRecoveryPactCode({
      patron: PATRON, recoverer: RESIDENT, atsId: ATS_A, ra: "5",
    });
    // Only the function name differs.
    expect(direct).toBe(cold.replace("C_ColdRecovery", "C_DirectRecovery"));
  });
});

describe("buildCullPactCode", () => {
  it("emits the 3-arg C_Cull shape (no amount, just patron/culler/ats)", () => {
    expect(
      buildCullPactCode({ patron: PATRON, culler: RESIDENT, atsId: ATS_A }),
    ).toBe(
      `(ouronet-ns.TS01-C2.ATS|C_Cull "${PATRON}" "${RESIDENT}" "${ATS_A}")`,
    );
  });
});

// ─── TS01-C2.VST — Awake + Slumber (GSTOA hibernation) ──────────────────────

describe("buildAwakePactCode", () => {
  it("emits the 4-arg C_Awake shape with integer nonce", () => {
    expect(
      buildAwakePactCode({
        patron: PATRON, awaker: RESIDENT, dpof: DPOF, nonce: 42,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C2.VST|C_Awake "${PATRON}" "${RESIDENT}" "${DPOF}" 42)`,
    );
  });
});

describe("buildSlumberPactCode", () => {
  it("emits the 4-arg C_Slumber shape with [nonce list]", () => {
    expect(
      buildSlumberPactCode({
        patron: PATRON, merger: RESIDENT, dpof: DPOF, nonces: [1, 2, 3],
      }),
    ).toBe(
      `(ouronet-ns.TS01-C2.VST|C_Slumber "${PATRON}" "${RESIDENT}" "${DPOF}" [1 2 3])`,
    );
  });

  it("single-item list renders [N], not N", () => {
    const code = buildSlumberPactCode({
      patron: PATRON, merger: RESIDENT, dpof: DPOF, nonces: [7],
    });
    expect(code).toContain("[7]");
  });

  it("empty list renders []", () => {
    const code = buildSlumberPactCode({
      patron: PATRON, merger: RESIDENT, dpof: DPOF, nonces: [],
    });
    expect(code).toContain("[]");
  });
});

// ─── TS01-C3.SWP — Firestarter, ChangeOwnership ─────────────────────────────

describe("buildFirestarterPactCode", () => {
  it("emits the 1-arg C_Firestarter shape", () => {
    expect(
      buildFirestarterPactCode({ firestarter: RESIDENT }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_Firestarter "${RESIDENT}")`,
    );
  });
});

describe("buildWrapStoaPactCode", () => {
  const WRAPPER = "ouro:WRAPPER-W";

  it("emits the canonical 3-arg C_WrapStoa shape", () => {
    expect(
      buildWrapStoaPactCode({ patron: PATRON, wrapper: WRAPPER, amount: "5" }),
    ).toBe(
      `(ouronet-ns.TS01-C2.LQD|C_WrapStoa "${PATRON}" "${WRAPPER}" 5.0)`,
    );
  });

  it("uses the LQD module + TS01-C2 namespace + C_WrapStoa function", () => {
    const code = buildWrapStoaPactCode({ patron: "p", wrapper: "w", amount: "1" });
    expect(code).toContain(".TS01-C2.LQD|C_WrapStoa ");
    // Argument ORDER guard — patron then wrapper.
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"w"`));
  });

  it("formats amount via formatDecimalForPact (pads integers)", () => {
    const code = buildWrapStoaPactCode({ patron: "p", wrapper: "w", amount: "10" });
    expect(code).toContain(" 10.0)");
  });
});

describe("buildWrapUrStoaPactCode", () => {
  const WRAPPER = "ouro:WRAPPER-W";

  it("emits the canonical 3-arg C_WrapUrStoa shape", () => {
    expect(
      buildWrapUrStoaPactCode({ patron: PATRON, wrapper: WRAPPER, amount: "5" }),
    ).toBe(
      `(ouronet-ns.TS01-C2.LQD|C_WrapUrStoa "${PATRON}" "${WRAPPER}" 5.0)`,
    );
  });

  it("uses the LQD module + TS01-C2 namespace + C_WrapUrStoa function (not C_WrapStoa)", () => {
    const code = buildWrapUrStoaPactCode({ patron: "p", wrapper: "w", amount: "1" });
    expect(code).toContain(".TS01-C2.LQD|C_WrapUrStoa ");
    expect(code).not.toContain("C_WrapStoa ");
    // Argument ORDER guard — patron then wrapper.
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"w"`));
  });
});

// ─── Unwrap (LQD) — simple + composite-with-create-account ──────────────────

describe("buildUnwrapStoaPactCode", () => {
  const UNWRAPPER = "ouro:UNWRAPPER-U";

  it("emits the canonical 3-arg C_UnwrapStoa shape", () => {
    expect(
      buildUnwrapStoaPactCode({ patron: PATRON, unwrapper: UNWRAPPER, amount: "10" }),
    ).toBe(
      `(ouronet-ns.TS01-C2.LQD|C_UnwrapStoa "${PATRON}" "${UNWRAPPER}" 10.0)`,
    );
  });

  it("uses the LQD module + C_UnwrapStoa function (not C_WrapStoa, not the composite shape)", () => {
    const code = buildUnwrapStoaPactCode({ patron: "p", unwrapper: "u", amount: "1" });
    expect(code).toContain(".TS01-C2.LQD|C_UnwrapStoa ");
    expect(code).not.toContain("C_WrapStoa ");
    expect(code).not.toContain("C_CreateAccount");
    expect(code).not.toContain("read-keyset");
    expect(code).not.toContain("namespace");
  });
});

describe("buildUnwrapStoaWithCreateAccountPactCode", () => {
  const UNWRAPPER = "ouro:UNWRAPPER-U";

  it("emits the composite create-account + unwrap shape", () => {
    const code = buildUnwrapStoaWithCreateAccountPactCode({
      patron: PATRON, unwrapper: UNWRAPPER, amount: "10",
    });
    // Must contain the namespace setter, the IGNIS.C_Collect call, the let
    // binding, the create-account call, the unwrap call, and the read-keyset
    // reference (call site is responsible for the addData("ks", ...)).
    expect(code).toContain(`(namespace "ouronet-ns")`);
    expect(code).toContain(`(IGNIS.C_Collect "${PATRON}" (IGNIS.UDC_CustomCodeCumulator))`);
    expect(code).toContain(`(wp:string "${UNWRAPPER}")`);
    expect(code).toContain(`(target:string (DALOS.UR_AccountKadena wp))`);
    expect(code).toContain(`(coin.C_CreateAccount target (read-keyset "ks"))`);
    expect(code).toContain(`(TS01-C2.LQD|C_UnwrapStoa "${PATRON}" "${UNWRAPPER}" 10.0)`);
  });

  it("create-account precedes the unwrap in the let body (account must exist BEFORE the unwrap pushes STOA to it)", () => {
    const code = buildUnwrapStoaWithCreateAccountPactCode({ patron: "p", unwrapper: "u", amount: "1" });
    const create = code.indexOf("C_CreateAccount");
    const unwrap = code.indexOf("C_UnwrapStoa");
    expect(create).toBeLessThan(unwrap);
    expect(create).toBeGreaterThanOrEqual(0);
  });
});

describe("buildUnwrapUrStoaPactCode", () => {
  const UNWRAPPER = "ouro:UNWRAPPER-U";

  it("emits the canonical 3-arg C_UnwrapUrStoa shape", () => {
    expect(
      buildUnwrapUrStoaPactCode({ patron: PATRON, unwrapper: UNWRAPPER, amount: "10" }),
    ).toBe(
      `(ouronet-ns.TS01-C2.LQD|C_UnwrapUrStoa "${PATRON}" "${UNWRAPPER}" 10.0)`,
    );
  });

  it("uses the UR variant (C_UnwrapUrStoa, not C_UnwrapStoa)", () => {
    const code = buildUnwrapUrStoaPactCode({ patron: "p", unwrapper: "u", amount: "1" });
    expect(code).toContain("C_UnwrapUrStoa ");
    // Word-boundary check: should NOT contain bare C_UnwrapStoa (the non-UR variant)
    expect(code).not.toMatch(/C_UnwrapStoa\b/);
  });
});

describe("buildUnwrapUrStoaWithCreateAccountPactCode", () => {
  it("emits the composite shape using coin.C_UR|CreateAccount (NOT coin.C_CreateAccount — UR variant)", () => {
    const code = buildUnwrapUrStoaWithCreateAccountPactCode({
      patron: "p", unwrapper: "u", amount: "1",
    });
    expect(code).toContain(`(coin.C_UR|CreateAccount target (read-keyset "ks"))`);
    // Must NOT use the non-UR create-account — that's for the STOA variant.
    expect(code).not.toContain(`(coin.C_CreateAccount `);
    expect(code).toContain(`(TS01-C2.LQD|C_UnwrapUrStoa `);
  });
});

describe("buildStakeUrStoaPactCode", () => {
  const PK = "k:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  it("emits the canonical 2-arg coin.C_URV|Stake shape", () => {
    expect(
      buildStakeUrStoaPactCode({ paymentKeyAddress: PK, amount: "100" }),
    ).toBe(
      `(coin.C_URV|Stake "${PK}" 100.0)`,
    );
  });

  it("uses the coin module (NOT ouronet-ns) and C_URV|Stake function", () => {
    const code = buildStakeUrStoaPactCode({ paymentKeyAddress: "k:00", amount: "1" });
    expect(code.startsWith("(coin.C_URV|Stake ")).toBe(true);
    expect(code).not.toContain("ouronet-ns");
  });

  it("formats amount via formatDecimalForPact", () => {
    const code = buildStakeUrStoaPactCode({ paymentKeyAddress: "k:00", amount: "5" });
    expect(code).toContain(" 5.0)");
  });
});

describe("buildUnstakeUrStoaPactCode", () => {
  const PK = "k:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  it("emits the canonical 2-arg coin.C_URV|Unstake shape", () => {
    expect(
      buildUnstakeUrStoaPactCode({ paymentKeyAddress: PK, amount: "100" }),
    ).toBe(
      `(coin.C_URV|Unstake "${PK}" 100.0)`,
    );
  });

  it("uses the coin module + Unstake (NOT Stake) function name", () => {
    const code = buildUnstakeUrStoaPactCode({ paymentKeyAddress: "k:00", amount: "1" });
    expect(code.startsWith("(coin.C_URV|Unstake ")).toBe(true);
    expect(code).not.toContain("C_URV|Stake ");
  });
});

describe("buildCollectUrStoaPactCode", () => {
  const PK = "k:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  it("emits the canonical 1-arg coin.C_URV|Collect shape", () => {
    expect(buildCollectUrStoaPactCode({ paymentKeyAddress: PK })).toBe(
      `(coin.C_URV|Collect "${PK}")`,
    );
  });

  it("uses the coin module (NOT ouronet-ns)", () => {
    const code = buildCollectUrStoaPactCode({ paymentKeyAddress: "k:00" });
    expect(code).not.toContain("ouronet-ns");
    expect(code.startsWith("(coin.C_URV|Collect ")).toBe(true);
  });
});

describe("buildCollectUrStoaWithCreateAccountPactCode", () => {
  const PK = "k:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

  it("emits a 2-call composite — C_CreateAccount followed by C_URV|Collect", () => {
    const code = buildCollectUrStoaWithCreateAccountPactCode({ paymentKeyAddress: PK });
    expect(code).toContain(`(coin.C_CreateAccount "${PK}" (read-keyset "ks"))`);
    expect(code).toContain(`(coin.C_URV|Collect "${PK}")`);
    // Create-account MUST come before collect.
    expect(code.indexOf("C_CreateAccount")).toBeLessThan(code.indexOf("C_URV|Collect"));
  });

  it("references the 'ks' keyset literal (consumer must addData('ks', {...}))", () => {
    const code = buildCollectUrStoaWithCreateAccountPactCode({ paymentKeyAddress: "k:00" });
    expect(code).toContain(`(read-keyset "ks")`);
  });
});

describe("buildNativeUrTransferPactCode", () => {
  it("emits the 3-arg coin.C_UR|Transfer shape (receiver exists, Transfer family)", () => {
    expect(
      buildNativeUrTransferPactCode({
        sender: "k:sender", receiver: "k:receiver", amount: "10",
      }),
    ).toBe(
      `(coin.C_UR|Transfer "k:sender" "k:receiver" 10.0)`,
    );
  });

  it("uses the coin module (NOT ouronet-ns)", () => {
    const code = buildNativeUrTransferPactCode({
      sender: "s", receiver: "r", amount: "1",
    });
    expect(code).not.toContain("ouronet-ns");
    expect(code.startsWith("(coin.C_UR|Transfer ")).toBe(true);
  });
});

describe("buildNativeUrTransmitPactCode", () => {
  it("emits the 3-arg coin.C_UR|Transmit shape (receiver exists, Transmit family)", () => {
    expect(
      buildNativeUrTransmitPactCode({
        sender: "k:sender", receiver: "k:receiver", amount: "10",
      }),
    ).toBe(
      `(coin.C_UR|Transmit "k:sender" "k:receiver" 10.0)`,
    );
  });

  it("differs from Transfer only by function name (same args)", () => {
    const transfer = buildNativeUrTransferPactCode({ sender: "s", receiver: "r", amount: "1" });
    const transmit = buildNativeUrTransmitPactCode({ sender: "s", receiver: "r", amount: "1" });
    expect(transmit).toBe(transfer.replace("C_UR|Transfer", "C_UR|Transmit"));
  });
});

describe("buildNativeUrTransferAnewPactCode", () => {
  it("emits the 4-arg coin.C_UR|TransferAnew shape with (read-keyset 'ks')", () => {
    expect(
      buildNativeUrTransferAnewPactCode({
        sender: "k:sender", receiver: "k:receiver", amount: "10",
      }),
    ).toBe(
      `(coin.C_UR|TransferAnew "k:sender" "k:receiver" (read-keyset "ks") 10.0)`,
    );
  });

  it("references the 'ks' keyset literal (consumer must addData('ks', {...}))", () => {
    const code = buildNativeUrTransferAnewPactCode({
      sender: "s", receiver: "r", amount: "1",
    });
    expect(code).toContain(`(read-keyset "ks")`);
  });
});

describe("buildNativeUrTransmitAnewPactCode", () => {
  it("emits the 4-arg coin.C_UR|TransmitAnew shape with (read-keyset 'ks')", () => {
    expect(
      buildNativeUrTransmitAnewPactCode({
        sender: "k:sender", receiver: "k:receiver", amount: "10",
      }),
    ).toBe(
      `(coin.C_UR|TransmitAnew "k:sender" "k:receiver" (read-keyset "ks") 10.0)`,
    );
  });

  it("differs from TransferAnew only by function name (same args)", () => {
    const xfer = buildNativeUrTransferAnewPactCode({ sender: "s", receiver: "r", amount: "1" });
    const xmit = buildNativeUrTransmitAnewPactCode({ sender: "s", receiver: "r", amount: "1" });
    expect(xmit).toBe(xfer.replace("C_UR|TransferAnew", "C_UR|TransmitAnew"));
  });
});

describe("buildDeployStandardAccountPactCode", () => {
  it("emits the canonical 4-arg C_DeployStandardAccount shape with (read-keyset 'ks')", () => {
    expect(
      buildDeployStandardAccountPactCode({
        account:       "Ѻ.NEW-ACCT",
        kadenaAddress: "k:abc123",
        publicKey:     "deadbeef",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_DeployStandardAccount "Ѻ.NEW-ACCT" (read-keyset "ks") "k:abc123" "deadbeef")`,
    );
  });

  it("uses the DALOS module + TS01-C1 namespace + C_DeployStandardAccount function", () => {
    const code = buildDeployStandardAccountPactCode({
      account: "a", kadenaAddress: "k", publicKey: "p",
    });
    expect(code).toContain(".TS01-C1.DALOS|C_DeployStandardAccount ");
  });

  it("references the 'ks' keyset literal in the 2nd argument position", () => {
    const code = buildDeployStandardAccountPactCode({
      account: "a", kadenaAddress: "k", publicKey: "p",
    });
    // Account comes first, then ks reference, then kadena, then public.
    expect(code.indexOf(`"a"`)).toBeLessThan(code.indexOf(`(read-keyset "ks")`));
    expect(code.indexOf(`(read-keyset "ks")`)).toBeLessThan(code.indexOf(`"k"`));
    expect(code.indexOf(`"k"`)).toBeLessThan(code.indexOf(`"p"`));
  });
});

describe("buildDeploySmartAccountPactCode", () => {
  it("emits the canonical 5-arg C_DeploySmartAccount shape with sovereign before public", () => {
    expect(
      buildDeploySmartAccountPactCode({
        account:       "Σ.NEW-SMART",
        kadenaAddress: "k:abc123",
        sovereign:     "Ѻ.SOVEREIGN-ACCT",
        publicKey:     "deadbeef",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_DeploySmartAccount "Σ.NEW-SMART" (read-keyset "ks") "k:abc123" "Ѻ.SOVEREIGN-ACCT" "deadbeef")`,
    );
  });

  it("uses the DALOS module + TS01-C1 namespace + C_DeploySmartAccount function", () => {
    const code = buildDeploySmartAccountPactCode({
      account: "a", kadenaAddress: "k", sovereign: "s", publicKey: "p",
    });
    expect(code).toContain(".TS01-C1.DALOS|C_DeploySmartAccount ");
  });

  it("orders args account → (read-keyset 'ks') → kadena → sovereign → public", () => {
    const code = buildDeploySmartAccountPactCode({
      account: "a", kadenaAddress: "k", sovereign: "s", publicKey: "p",
    });
    expect(code.indexOf(`"a"`)).toBeLessThan(code.indexOf(`(read-keyset "ks")`));
    expect(code.indexOf(`(read-keyset "ks")`)).toBeLessThan(code.indexOf(`"k"`));
    expect(code.indexOf(`"k"`)).toBeLessThan(code.indexOf(`"s"`));
    expect(code.indexOf(`"s"`)).toBeLessThan(code.indexOf(`"p"`));
  });

  it("differs from Standard only by the C_DeploySmart fn name + the extra sovereign arg", () => {
    const smart = buildDeploySmartAccountPactCode({
      account: "X", kadenaAddress: "k:K", sovereign: "Ѻ.S", publicKey: "P",
    });
    expect(smart).toContain("C_DeploySmartAccount");
    expect(smart).not.toContain("C_DeployStandardAccount");
    expect(smart).toContain(`"Ѻ.S"`); // sovereign present
  });
});

describe("deploy builders — keyset-ref vs direct keyset guard", () => {
  it("Standard 'existing' mode emits a keyset-ref-guard, NOT (read-keyset ks)", () => {
    const code = buildDeployStandardAccountPactCode({
      account: "Ѻ.A", kadenaAddress: "k:K", publicKey: "P",
      mode: "existing", keysetRef: "ouronet-ns.dh_sc_aqp-keyset",
    });
    expect(code).toContain(`(keyset-ref-guard "ouronet-ns.dh_sc_aqp-keyset")`);
    expect(code).not.toContain(`(read-keyset "ks")`);
  });

  it("Smart 'existing' mode emits a keyset-ref-guard before the kadena arg", () => {
    const code = buildDeploySmartAccountPactCode({
      account: "Σ.A", kadenaAddress: "k:K", sovereign: "Ѻ.S", publicKey: "P",
      mode: "existing", keysetRef: "ouronet-ns.dh_sc_aqp-keyset",
    });
    expect(code).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_DeploySmartAccount "Σ.A" (keyset-ref-guard "ouronet-ns.dh_sc_aqp-keyset") "k:K" "Ѻ.S" "P")`,
    );
  });

  it("'define' mode (and the default) still emits (read-keyset ks)", () => {
    expect(buildDeployStandardAccountPactCode({
      account: "a", kadenaAddress: "k", publicKey: "p", mode: "define",
    })).toContain(`(read-keyset "ks")`);
    // default (no mode) is backward-compatible:
    expect(buildDeploySmartAccountPactCode({
      account: "a", kadenaAddress: "k", sovereign: "s", publicKey: "p",
    })).toContain(`(read-keyset "ks")`);
  });
});

describe("buildAddLiquidityPactCode", () => {
  const SWPAIR = "swp:OURO-WSTOA-pair-1";

  it("emits the canonical 4-arg C_AddLiquidity shape with bracketed amounts list", () => {
    expect(
      buildAddLiquidityPactCode({
        patron:       PATRON,
        account:      RESIDENT,
        swpair:       SWPAIR,
        inputAmounts: ["100", "50"],
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_AddLiquidity "${PATRON}" "${RESIDENT}" "${SWPAIR}" [100.0 50.0])`,
    );
  });

  it("pads integer amounts with .0 inside the list", () => {
    const code = buildAddLiquidityPactCode({
      patron: "a", account: "b", swpair: "s", inputAmounts: ["10", "20"],
    });
    expect(code).toContain(" [10.0 20.0])");
  });

  it("preserves fractional amounts verbatim", () => {
    const code = buildAddLiquidityPactCode({
      patron: "a", account: "b", swpair: "s", inputAmounts: ["1.5", "2.25"],
    });
    expect(code).toContain(" [1.5 2.25])");
  });
});

describe("buildRemoveLiquidityPactCode", () => {
  const SWPAIR = "swp:OURO-WSTOA-pair-1";

  it("emits the canonical 4-arg C_RemoveLiquidity shape (single lp-amount, not list)", () => {
    expect(
      buildRemoveLiquidityPactCode({
        patron:   PATRON,
        account:  RESIDENT,
        swpair:   SWPAIR,
        lpAmount: "5",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_RemoveLiquidity "${PATRON}" "${RESIDENT}" "${SWPAIR}" 5.0)`,
    );
  });

  it("argument ORDER — patron → account → swpair → lp-amount", () => {
    const code = buildRemoveLiquidityPactCode({
      patron: "p", account: "a", swpair: "s", lpAmount: "1",
    });
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"a"`));
    expect(code.indexOf(`"a"`)).toBeLessThan(code.indexOf(`"s"`));
  });
});

describe("buildSingleSwapWithSlippagePactCode", () => {
  it("emits the canonical 6-arg shape with (read-msg 'slippage-bounds)", () => {
    expect(
      buildSingleSwapWithSlippagePactCode({
        patron: PATRON, account: RESIDENT, swpair: "swpair-1",
        inputId: "OURO", inputAmount: "10", outputId: "WSTOA",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_SingleSwapWithSlippage "${PATRON}" "${RESIDENT}" "swpair-1" "OURO" 10.0 "WSTOA" (read-msg 'slippage-bounds))`,
    );
  });

  it("argument ORDER — input then amount then output (NOT input → output → amount)", () => {
    const code = buildSingleSwapWithSlippagePactCode({
      patron: "p", account: "a", swpair: "s",
      inputId: "I", inputAmount: "1", outputId: "O",
    });
    const iIdx = code.indexOf(`"I"`);
    const oIdx = code.indexOf(`"O"`);
    const amtIdx = code.indexOf(" 1.0 ");
    expect(iIdx).toBeLessThan(amtIdx);
    expect(amtIdx).toBeLessThan(oIdx);
  });
});

describe("buildSingleSwapNoSlippagePactCode", () => {
  it("emits the canonical 6-arg shape WITHOUT (read-msg 'slippage-bounds)", () => {
    expect(
      buildSingleSwapNoSlippagePactCode({
        patron: PATRON, account: RESIDENT, swpair: "swpair-1",
        inputId: "OURO", inputAmount: "10", outputId: "WSTOA",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_SingleSwapNoSlippage "${PATRON}" "${RESIDENT}" "swpair-1" "OURO" 10.0 "WSTOA")`,
    );
  });

  it("does NOT reference slippage-bounds (NoSlippage variant)", () => {
    const code = buildSingleSwapNoSlippagePactCode({
      patron: "p", account: "a", swpair: "s",
      inputId: "I", inputAmount: "1", outputId: "O",
    });
    expect(code).not.toContain("slippage-bounds");
    expect(code).not.toContain("read-msg");
  });
});

describe("buildMultiSwapWithSlippagePactCode", () => {
  it("emits the canonical 6-arg shape with [string list] inputs and amounts", () => {
    expect(
      buildMultiSwapWithSlippagePactCode({
        patron: PATRON, account: RESIDENT, swpair: "swpair-1",
        inputIds: ["OURO", "IGNIS"], inputAmounts: ["10", "5"], outputId: "WSTOA",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_MultiSwapWithSlippage "${PATRON}" "${RESIDENT}" "swpair-1" ["OURO" "IGNIS"] [10.0 5.0] "WSTOA" (read-msg 'slippage-bounds))`,
    );
  });

  it("renders inputIds as a bracketed quoted-string list", () => {
    const code = buildMultiSwapWithSlippagePactCode({
      patron: "p", account: "a", swpair: "s",
      inputIds: ["X", "Y"], inputAmounts: ["1", "2"], outputId: "O",
    });
    expect(code).toContain(`["X" "Y"]`);
    expect(code).toContain(` [1.0 2.0] `);
  });
});

describe("buildMultiSwapNoSlippagePactCode", () => {
  it("emits the canonical 6-arg shape with [string list] inputs and amounts, no slippage-bounds", () => {
    expect(
      buildMultiSwapNoSlippagePactCode({
        patron: PATRON, account: RESIDENT, swpair: "swpair-1",
        inputIds: ["OURO", "IGNIS"], inputAmounts: ["10", "5"], outputId: "WSTOA",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_MultiSwapNoSlippage "${PATRON}" "${RESIDENT}" "swpair-1" ["OURO" "IGNIS"] [10.0 5.0] "WSTOA")`,
    );
  });

  it("does NOT reference slippage-bounds (NoSlippage variant)", () => {
    const code = buildMultiSwapNoSlippagePactCode({
      patron: "p", account: "a", swpair: "s",
      inputIds: ["X"], inputAmounts: ["1"], outputId: "O",
    });
    expect(code).not.toContain("slippage-bounds");
  });
});

describe("buildCreateSetPactCode", () => {
  it("emits the canonical 6-arg C_Make shape (SFT — semi-fungible) with nonces list + integer set-class + integer how-many-sets", () => {
    expect(
      buildCreateSetPactCode({
        patron: PATRON, account: RESIDENT, tokenId: "TKN-xyz",
        nonces: [1, 2, 3], setClass: 7, howManySets: 2,
      }),
    ).toBe(
      `(ouronet-ns.TS02-C1.DPSF|C_Make "${PATRON}" "${RESIDENT}" "TKN-xyz" [1 2 3] 7 2)`,
    );
  });

  it("uses the DPSF module + TS02-C1 namespace + C_Make function (semi-fungible variant)", () => {
    const code = buildCreateSetPactCode({
      patron: "p", account: "a", tokenId: "t",
      nonces: [1], setClass: 1, howManySets: 1,
    });
    expect(code).toContain(".TS02-C1.DPSF|C_Make ");
  });

  it("nonces are emitted as bare integers in a bracketed list (no .0 padding)", () => {
    const code = buildCreateSetPactCode({
      patron: "p", account: "a", tokenId: "t",
      nonces: [10, 20], setClass: 1, howManySets: 1,
    });
    expect(code).toContain("[10 20]");
    expect(code).not.toContain("10.0");
  });
});

describe("buildCreateSetNFTPactCode", () => {
  it("emits the canonical 5-arg C_Make shape (NFT — non-fungible) without how-many-sets", () => {
    expect(
      buildCreateSetNFTPactCode({
        patron: PATRON, account: RESIDENT, tokenId: "TKN-xyz",
        nonces: [1, 2, 3], setClass: 7,
      }),
    ).toBe(
      `(ouronet-ns.TS02-C2.DPNF|C_Make "${PATRON}" "${RESIDENT}" "TKN-xyz" [1 2 3] 7)`,
    );
  });

  it("uses the DPNF module + TS02-C2 namespace (non-fungible variant, NOT DPSF)", () => {
    const code = buildCreateSetNFTPactCode({
      patron: "p", account: "a", tokenId: "t", nonces: [1], setClass: 1,
    });
    expect(code).toContain(".TS02-C2.DPNF|C_Make ");
    expect(code).not.toContain("TS02-C1.DPSF");
  });
});

describe("buildChangeOwnershipPactCode", () => {
  const SWPAIR    = "swp:OURO-GSTOA-W-pair-123";
  const NEW_OWNER = "ouro:NEW-OWNER-D";

  it("emits the canonical 3-arg C_ChangeOwnership shape", () => {
    expect(
      buildChangeOwnershipPactCode({
        patron:   PATRON,
        swpair:   SWPAIR,
        newOwner: NEW_OWNER,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_ChangeOwnership "${PATRON}" "${SWPAIR}" "${NEW_OWNER}")`,
    );
  });

  it("uses the SWP module + TS01-C3 namespace + C_ChangeOwnership function", () => {
    const code = buildChangeOwnershipPactCode({
      patron: "p", swpair: "s", newOwner: "n",
    });
    expect(code).toContain(".TS01-C3.SWP|C_ChangeOwnership ");
    // Argument ORDER guard — patron → swpair → new-owner.
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"s"`));
    expect(code.indexOf(`"s"`)).toBeLessThan(code.indexOf(`"n"`));
  });
});

describe("buildModifyWeightsPactCode", () => {
  const SWPAIR = "swp:OURO-GSTOA-W-pair-123";

  it("emits the canonical 3-arg C_ModifyWeights shape with a [decimal] list literal", () => {
    expect(
      buildModifyWeightsPactCode({
        patron:     PATRON,
        swpair:     SWPAIR,
        newWeights: ["0.5", "0.3", "0.2"],
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_ModifyWeights "${PATRON}" "${SWPAIR}" [0.5 0.3 0.2])`,
    );
  });

  it("pads integer-form weights to x.0 (Pact decimal lexer rejects bare integers)", () => {
    const code = buildModifyWeightsPactCode({
      patron: "p", swpair: "s", newWeights: ["1"],
    });
    expect(code).toContain("[1.0]");
  });

  it("preserves 4-decimal precision weights verbatim", () => {
    const code = buildModifyWeightsPactCode({
      patron: "p", swpair: "s", newWeights: ["0.3333", "0.3333", "0.3334"],
    });
    expect(code).toContain("[0.3333 0.3333 0.3334]");
  });

  it("uses the SWP module + TS01-C3 namespace + C_ModifyWeights function", () => {
    const code = buildModifyWeightsPactCode({
      patron: "p", swpair: "s", newWeights: ["0.5", "0.5"],
    });
    expect(code).toContain(".TS01-C3.SWP|C_ModifyWeights ");
    // Argument ORDER guard — patron → swpair → weights-list.
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"s"`));
    expect(code.indexOf(`"s"`)).toBeLessThan(code.indexOf("["));
  });
});

describe("buildToggleSwapCapabilityPactCode", () => {
  const SWPAIR = "swp:OURO-GSTOA-W-pair-123";

  it("emits the canonical 3-arg C_ToggleSwapCapability shape (toggle=true)", () => {
    expect(
      buildToggleSwapCapabilityPactCode({ patron: PATRON, swpair: SWPAIR, toggle: true }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_ToggleSwapCapability "${PATRON}" "${SWPAIR}" true)`,
    );
  });

  it("emits bare `false` (Pact bool literal, not quoted)", () => {
    const code = buildToggleSwapCapabilityPactCode({ patron: "p", swpair: "s", toggle: false });
    expect(code).toMatch(/ false\)$/);
    expect(code).not.toContain(`"false"`);
  });

  it("uses the SWP module + TS01-C3 namespace + C_ToggleSwapCapability function", () => {
    const code = buildToggleSwapCapabilityPactCode({ patron: "p", swpair: "s", toggle: true });
    expect(code).toContain(".TS01-C3.SWP|C_ToggleSwapCapability ");
    // Distinct from C_ToggleAddLiquidity — guard against accidental shared-source typo
    expect(code).not.toContain("C_ToggleAddLiquidity");
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"s"`));
    expect(code.indexOf(`"s"`)).toBeLessThan(code.indexOf(" true"));
  });
});

describe("buildToggleAddLiquidityPactCode", () => {
  const SWPAIR = "swp:OURO-GSTOA-W-pair-123";

  it("emits the canonical 3-arg C_ToggleAddLiquidity shape (toggle=true)", () => {
    expect(
      buildToggleAddLiquidityPactCode({ patron: PATRON, swpair: SWPAIR, toggle: true }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_ToggleAddLiquidity "${PATRON}" "${SWPAIR}" true)`,
    );
  });

  it("uses the SWP module + TS01-C3 namespace + C_ToggleAddLiquidity function (NOT C_ToggleSwapCapability)", () => {
    const code = buildToggleAddLiquidityPactCode({ patron: "p", swpair: "s", toggle: false });
    expect(code).toContain(".TS01-C3.SWP|C_ToggleAddLiquidity ");
    expect(code).not.toContain("C_ToggleSwapCapability");
    expect(code).toMatch(/ false\)$/);
  });
});

describe("buildModifyCanChangeOwnerPactCode", () => {
  const SWPAIR = "swp:OURO-GSTOA-W-pair-123";

  it("emits the canonical 3-arg C_ModifyCanChangeOwner shape (new-boolean=true)", () => {
    expect(
      buildModifyCanChangeOwnerPactCode({
        patron:     PATRON,
        swpair:     SWPAIR,
        newBoolean: true,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C3.SWP|C_ModifyCanChangeOwner "${PATRON}" "${SWPAIR}" true)`,
    );
  });

  it("emits bare `false` (Pact bool literal — NOT quoted as a string)", () => {
    const code = buildModifyCanChangeOwnerPactCode({
      patron: "p", swpair: "s", newBoolean: false,
    });
    // The boolean must NOT be wrapped in quotes — Pact's bool type is the
    // unquoted token `true` / `false`. Quoting it would make it a string,
    // which the chain would reject as a type mismatch.
    expect(code).toMatch(/ false\)$/);
    expect(code).not.toContain(`"false"`);
  });

  it("uses the SWP module + TS01-C3 namespace + C_ModifyCanChangeOwner function", () => {
    const code = buildModifyCanChangeOwnerPactCode({
      patron: "p", swpair: "s", newBoolean: true,
    });
    expect(code).toContain(".TS01-C3.SWP|C_ModifyCanChangeOwner ");
    // Argument ORDER guard — patron → swpair → new-boolean.
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"s"`));
    expect(code.indexOf(`"s"`)).toBeLessThan(code.indexOf(" true"));
  });
});

// ─── Defensive amount validation (regression guards) ───────────────────────
// Builders that take a decimal-typed `amount` route the raw string through
// `formatDecimalForPact`, which throws "Invalid decimal format" for any
// input that doesn't match /^\d+\.?\d*$/. These guards lock that contract
// in from the builder's perspective so a future "performance" refactor
// can't silently bypass the format check and let "abc" reach the chain
// (where it would surface as a confusing JSON-decode error rather than a
// caller-side TypeError). Two representative builders are covered — one
// from the TS01-C1.DPTF family (Transfer) and one from the TS01-C2.ATS
// family (Coil) — to catch the most likely bypass routes.

describe("cfm-builders — defensive amount validation (REQ-12)", () => {
  it("buildTransferPactCode throws on a non-numeric amount", () => {
    expect(() =>
      buildTransferPactCode({
        patron: PATRON, tokenId: TOKEN, sender: SENDER,
        receiver: RECEIVER, amount: "abc", method: false,
      }),
    ).toThrow(/Invalid decimal format/);
  });

  it("buildCoilPactCode throws on a non-numeric amount", () => {
    expect(() =>
      buildCoilPactCode({
        patron: PATRON, coiler: RESIDENT, atsId: ATS_A,
        rewardTokenId: RT, amount: "abc",
      }),
    ).toThrow(/Invalid decimal format/);
  });
});

// ─── Cross-cutting: every builder emits a non-empty string that starts
// with "(ouronet-ns." and ends with ")". This catches someone forgetting
// the parens or the namespace prefix entirely.

describe("every builder produces a valid Pact call shape", () => {
  const samples = [
    () => buildTransferPactCode({ patron: "a", tokenId: "t", sender: "s", receiver: "r", amount: "1", method: false }),
    () => buildClearDispoPactCode({ patron: "a", account: "b" }),
    () => buildSublimatePactCode({ client: "a", target: "b", amount: "1" }),
    () => buildCompressPactCode({ client: "a", ignisAmount: "1" }),
    () => buildCoilPactCode({ patron: "a", coiler: "b", atsId: "ats", rewardTokenId: "rt", amount: "1" }),
    () => buildCurlPactCode({ patron: "a", curler: "b", ats1Id: "ats1", ats2Id: "ats2", rewardTokenId: "rt", amount: "1" }),
    () => buildBrumatePactCode({ patron: "a", brumator: "b", ats1Id: "ats1", ats2Id: "ats2", rewardTokenId: "rt", amount: "1", lockDays: 1 }),
    () => buildConstrictPactCode({ patron: "a", constricter: "b", atsId: "ats", rewardTokenId: "rt", amount: "1", lockDays: 1 }),
    () => buildColdRecoveryPactCode({ patron: "a", recoverer: "b", atsId: "ats", ra: "1" }),
    () => buildDirectRecoveryPactCode({ patron: "a", recoverer: "b", atsId: "ats", ra: "1" }),
    () => buildCullPactCode({ patron: "a", culler: "b", atsId: "ats" }),
    () => buildAwakePactCode({ patron: "a", awaker: "b", dpof: "d", nonce: 1 }),
    () => buildSlumberPactCode({ patron: "a", merger: "b", dpof: "d", nonces: [1] }),
    () => buildFirestarterPactCode({ firestarter: "a" }),
    () => buildChangeOwnershipPactCode({ patron: "a", swpair: "b", newOwner: "c" }),
    () => buildWrapStoaPactCode({ patron: "a", wrapper: "b", amount: "1" }),
    () => buildWrapUrStoaPactCode({ patron: "a", wrapper: "b", amount: "1" }),
    () => buildUnwrapStoaPactCode({ patron: "a", unwrapper: "b", amount: "1" }),
    () => buildUnwrapUrStoaPactCode({ patron: "a", unwrapper: "b", amount: "1" }),
    () => buildRotateSovereignPactCode({ patron: "a", account: "b", newSovereign: "c" }),
    () => buildRotateGovernorPactCode({ patron: "a", account: "b", governorExpr: "(create-user-guard (m.f))" }),
    () => buildReleaseStoicTagPactCode({ patron: "a", tagName: "b" }),
    () => buildRegisterStoicTagPactCode({ patron: "a", tagName: "b", accountAddress: "c" }),
    () => buildDeployStandardAccountPactCode({ account: "a", kadenaAddress: "k", publicKey: "p" }),
    () => buildAddLiquidityPactCode({ patron: "a", account: "b", swpair: "s", inputAmounts: ["1"] }),
    () => buildRemoveLiquidityPactCode({ patron: "a", account: "b", swpair: "s", lpAmount: "1" }),
    () => buildSingleSwapWithSlippagePactCode({ patron: "a", account: "b", swpair: "s", inputId: "i", inputAmount: "1", outputId: "o" }),
    () => buildSingleSwapNoSlippagePactCode({ patron: "a", account: "b", swpair: "s", inputId: "i", inputAmount: "1", outputId: "o" }),
    () => buildMultiSwapWithSlippagePactCode({ patron: "a", account: "b", swpair: "s", inputIds: ["i"], inputAmounts: ["1"], outputId: "o" }),
    () => buildMultiSwapNoSlippagePactCode({ patron: "a", account: "b", swpair: "s", inputIds: ["i"], inputAmounts: ["1"], outputId: "o" }),
    () => buildCreateSetPactCode({ patron: "a", account: "b", tokenId: "t", nonces: [1], setClass: 1, howManySets: 1 }),
    () => buildCreateSetNFTPactCode({ patron: "a", account: "b", tokenId: "t", nonces: [1], setClass: 1 }),
  ];

  it.each(samples.map((fn, i) => [i, fn]))("sample %i: starts with (ouronet-ns. and ends with )", (_i, fn) => {
    const code = (fn as () => string)();
    expect(code.startsWith("(ouronet-ns.")).toBe(true);
    expect(code.endsWith(")")).toBe(true);
    expect(code.length).toBeGreaterThan(20);
  });
});

// ─── TS01-C1.DALOS — RotateSovereign (Smart-account auth-path mutation) ─────

describe("buildRotateSovereignPactCode", () => {
  it("emits the canonical 3-arg C_RotateSovereign shape", () => {
    expect(
      buildRotateSovereignPactCode({
        patron:       PATRON,
        account:      "Σ.SMART-ACCT",
        newSovereign: "Ѻ.NEW-SOV",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_RotateSovereign "${PATRON}" "Σ.SMART-ACCT" "Ѻ.NEW-SOV")`,
    );
  });

  it("uses the DALOS module + TS01-C1 namespace + C_RotateSovereign function", () => {
    const code = buildRotateSovereignPactCode({
      patron: "p", account: "Σ.a", newSovereign: "Ѻ.s",
    });
    expect(code).toContain(".TS01-C1.DALOS|C_RotateSovereign ");
    // Argument ORDER guard — flipping account / new-sovereign would
    // produce a chain-side error that's hard to debug from logs.
    expect(code.indexOf(`"Σ.a"`)).toBeLessThan(code.indexOf(`"Ѻ.s"`));
  });

  it("preserves the standard / smart prefix characters byte-for-byte", () => {
    const code = buildRotateSovereignPactCode({
      patron: "Ѻ.PATRON", account: "Σ.SMART", newSovereign: "Ѻ.NEW",
    });
    expect(code).toContain(`"Ѻ.PATRON"`);
    expect(code).toContain(`"Σ.SMART"`);
    expect(code).toContain(`"Ѻ.NEW"`);
  });
});

describe("buildRotateGovernorPactCode (v4.3.3)", () => {
  it("emits the canonical 3-arg C_RotateGovernor shape with an inline guard expression", () => {
    expect(
      buildRotateGovernorPactCode({
        patron:       PATRON,
        account:      "Σ.SMART-ACCT",
        governorExpr: "(create-user-guard (ouronet-ns.U|G.UEV_Any [ (create-capability-guard ouronet-ns.TFT.P|DALOS|REMOTE-GOV) ]))",
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_RotateGovernor "${PATRON}" "Σ.SMART-ACCT" (create-user-guard (ouronet-ns.U|G.UEV_Any [ (create-capability-guard ouronet-ns.TFT.P|DALOS|REMOTE-GOV) ])))`,
    );
  });

  it("interpolates the governor expression bare — NOT quoted as a string", () => {
    const code = buildRotateGovernorPactCode({
      patron: "p", account: "Σ.a", governorExpr: `(create-module-guard "g")`,
    });
    expect(code).toContain(".TS01-C1.DALOS|C_RotateGovernor ");
    // The guard expression must appear as live Pact code, not a string literal.
    expect(code).toContain(`(create-module-guard "g")`);
    expect(code).not.toContain(`"(create-module-guard`);
    // Argument ORDER guard — patron before account before governor.
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"Σ.a"`));
    expect(code.indexOf(`"Σ.a"`)).toBeLessThan(code.indexOf("create-module-guard"));
  });

  it("preserves the standard / smart prefix characters byte-for-byte", () => {
    const code = buildRotateGovernorPactCode({
      patron: "Ѻ.PATRON", account: "Σ.SMART", governorExpr: `(create-pact-guard "x")`,
    });
    expect(code).toContain(`"Ѻ.PATRON"`);
    expect(code).toContain(`"Σ.SMART"`);
  });
});

describe("buildNonKeyGuardExpr (v4.3.3)", () => {
  it("wraps a user-guard body in the create-user-guard constructor", () => {
    expect(
      buildNonKeyGuardExpr({
        constructor: "create-user-guard",
        body: "(ouronet-ns.U|G.UEV_Any [ (create-capability-guard ouronet-ns.TFT.P|REMOTE-GOV) ])",
      }),
    ).toBe(
      "(create-user-guard (ouronet-ns.U|G.UEV_Any [ (create-capability-guard ouronet-ns.TFT.P|REMOTE-GOV) ]))",
    );
  });

  it("wraps each of the five non-key constructors verbatim with a single space before the body", () => {
    const constructors = [
      "create-user-guard",
      "create-capability-guard",
      "create-capability-pact-guard",
      "create-module-guard",
      "create-pact-guard",
    ] as const;
    for (const c of constructors) {
      expect(buildNonKeyGuardExpr({ constructor: c, body: "X" })).toBe(`(${c} X)`);
    }
  });

  it("composes with buildRotateGovernorPactCode to form the full governor expression", () => {
    const governorExpr = buildNonKeyGuardExpr({
      constructor: "create-module-guard",
      body: `"ouronet-ns.TFT.REMOTE-GOV"`,
    });
    expect(
      buildRotateGovernorPactCode({ patron: PATRON, account: "Σ.SMART", governorExpr }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_RotateGovernor "${PATRON}" "Σ.SMART" (create-module-guard "ouronet-ns.TFT.REMOTE-GOV"))`,
    );
  });
});

describe("buildReleaseStoicTagPactCode (v4.3.3)", () => {
  it("emits the canonical 2-arg C_ReleaseStoicTag shape", () => {
    expect(
      buildReleaseStoicTagPactCode({ patron: PATRON, tagName: "AncientHodler" }),
    ).toBe(
      `(ouronet-ns.TS01-C4.CODEX|C_ReleaseStoicTag "${PATRON}" "AncientHodler")`,
    );
  });

  it("uses the TS01-C4.CODEX module + C_ReleaseStoicTag function, patron before tag", () => {
    const code = buildReleaseStoicTagPactCode({ patron: "p", tagName: "t" });
    expect(code).toContain(".TS01-C4.CODEX|C_ReleaseStoicTag ");
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"t"`));
  });

  it("passes the tag name through verbatim (DALOS glyphs, no § sigil)", () => {
    const code = buildReleaseStoicTagPactCode({ patron: "Ѻ.PATRON", tagName: "Σ₳ΦДжΞ" });
    expect(code).toContain(`"Σ₳ΦДжΞ"`);
    expect(code).not.toContain("§");
  });
});

describe("buildRegisterStoicTagPactCode (v4.3.3)", () => {
  it("emits the canonical 3-arg C_RegisterStoicTag shape", () => {
    expect(
      buildRegisterStoicTagPactCode({ patron: PATRON, tagName: "AncientHodler", accountAddress: "Ѻ.ACCT" }),
    ).toBe(
      `(ouronet-ns.TS01-C4.CODEX|C_RegisterStoicTag "${PATRON}" "AncientHodler" "Ѻ.ACCT")`,
    );
  });

  it("uses TS01-C4.CODEX|C_RegisterStoicTag, args in order patron → tag → account", () => {
    const code = buildRegisterStoicTagPactCode({ patron: "p", tagName: "t", accountAddress: "Ѻ.a" });
    expect(code).toContain(".TS01-C4.CODEX|C_RegisterStoicTag ");
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"t"`));
    expect(code.indexOf(`"t"`)).toBeLessThan(code.indexOf(`"Ѻ.a"`));
  });

  it("passes the tag name through verbatim (DALOS glyphs, no § sigil)", () => {
    const code = buildRegisterStoicTagPactCode({ patron: "p", tagName: "Σ₳ΦДжΞ", accountAddress: "Ѻ.a" });
    expect(code).toContain(`"Σ₳ΦДжΞ"`);
    expect(code).not.toContain("§");
  });
});

describe("buildRotateGuardPactCode (v4.3.0)", () => {
  it("emits the define-mode shape with (read-keyset \"ks\")", () => {
    expect(
      buildRotateGuardPactCode({
        patron: PATRON,
        account: "Ѻ.ACCT",
        mode: "define",
        safe: true,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_RotateGuard "${PATRON}" "Ѻ.ACCT" (read-keyset "ks") true)`,
    );
  });

  it("emits the existing-mode shape with (keyset-ref-guard \"<ref>\")", () => {
    expect(
      buildRotateGuardPactCode({
        patron: PATRON,
        account: "Ѻ.ACCT",
        mode: "existing",
        keysetRef: "ouronet-ns.dh_sc_dpdc-keyset",
        safe: false,
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_RotateGuard "${PATRON}" "Ѻ.ACCT" (keyset-ref-guard "ouronet-ns.dh_sc_dpdc-keyset") false)`,
    );
  });

  it("emits empty keyset-ref when existing mode is given without a ref (defensive fallback)", () => {
    // The runtime contract is "callers must supply keysetRef in existing
    // mode", but we don't throw here — we let Pact dirtyRead surface the
    // error so the caller sees a chain-level failure with the offending
    // string visible. Defensive empty-string keeps the syntax valid
    // (parseable Pact) rather than emitting an undefined-laden expression.
    const code = buildRotateGuardPactCode({
      patron: "p",
      account: "a",
      mode: "existing",
      safe: true,
    });
    expect(code).toContain(`(keyset-ref-guard "")`);
  });

  it("uses the DALOS module + TS01-C1 namespace + C_RotateGuard function", () => {
    const code = buildRotateGuardPactCode({
      patron: "p",
      account: "a",
      mode: "define",
      safe: true,
    });
    expect(code).toContain(".TS01-C1.DALOS|C_RotateGuard ");
    // Argument ORDER guard — flipping patron and account would silently
    // misroute the rotation on chain.
    expect(code.indexOf(`"p"`)).toBeLessThan(code.indexOf(`"a"`));
  });

  it("safe boolean is emitted as bare true/false (not a string)", () => {
    const code = buildRotateGuardPactCode({
      patron: "p",
      account: "a",
      mode: "define",
      safe: false,
    });
    // Bare false at end, never quoted — Pact bool literal, not a string.
    expect(code).toMatch(/\) false\)$/);
    expect(code).not.toContain(`"false"`);
  });
});

describe("buildRotateKadenaPactCode (v4.3.0)", () => {
  it("emits the canonical 3-arg C_RotateKadena shape", () => {
    expect(
      buildRotateKadenaPactCode({
        patron: PATRON,
        account: "Ѻ.ACCT",
        newPaymentKey: "f".repeat(64),
      }),
    ).toBe(
      `(ouronet-ns.TS01-C1.DALOS|C_RotateKadena "${PATRON}" "Ѻ.ACCT" "${"f".repeat(64)}")`,
    );
  });

  it("uses the DALOS module + TS01-C1 namespace + C_RotateKadena function name", () => {
    const code = buildRotateKadenaPactCode({
      patron: "p",
      account: "a",
      newPaymentKey: "k",
    });
    // Builder is named *RotatePaymentKey* in user-facing surfaces but the
    // on-chain Pact function is C_RotateKadena (kadena-ledger payment key).
    expect(code).toContain(".TS01-C1.DALOS|C_RotateKadena ");
  });

  it("argument ORDER is patron, account, newPaymentKey", () => {
    const code = buildRotateKadenaPactCode({
      patron: "PP",
      account: "AA",
      newPaymentKey: "KK",
    });
    expect(code.indexOf(`"PP"`)).toBeLessThan(code.indexOf(`"AA"`));
    expect(code.indexOf(`"AA"`)).toBeLessThan(code.indexOf(`"KK"`));
  });

  it("preserves the standard / smart prefix characters byte-for-byte", () => {
    const code = buildRotateKadenaPactCode({
      patron: "Ѻ.P",
      account: "Σ.A",
      newPaymentKey: "0".repeat(64),
    });
    expect(code).toContain(`"Ѻ.P"`);
    expect(code).toContain(`"Σ.A"`);
  });
});
