/**
 * A FAILED TRANSACTION IS CHARGED ITS LIMIT, NOT ITS COST.
 *
 * Reported from the field 2026-10-15: every failing transaction burnt the full 2,000,000 gas,
 * not the ~170,000 a 145,633-gas operation calibrates to.
 *
 * The cause was one comparison. Every two-pass site simulated, then rebuilt the transaction
 * with a calibrated limit — but only `if (requiredGas > gasLimit)`. With a starting limit of
 * 2_000_000, which IS the node ceiling, a simulation can never exceed it and still succeed, so
 * the branch was unreachable and `calculateAutoGasLimit` was dead code at 12 of the 14 sites
 * that had this shape. The transaction shipped at the ceiling every time.
 *
 * It is invisible while transactions succeed, because a SUCCEEDING transaction is charged what
 * it uses. Only a failure reveals the limit, and then it costs ~12x.
 *
 * These assert over the SOURCE because the defect is structural — a condition that is never
 * true — and no unit test of a passing call can observe an unreachable branch. The property is
 * "no site gates calibration on exceeding its own starting limit", which is checkable exactly
 * where it is violated.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { calculateAutoGasLimit } from "@stoachain/stoa-core/gas";

const DIR = join(__dirname, "..", "src", "interactions");
const FILES = readdirSync(DIR).filter(f => f.endsWith(".ts"));

/** Source with `//` line comments stripped, so prose describing the old bug cannot satisfy — or
 *  trip — an assertion about executable code. */
function code(file: string): string {
  return readFileSync(join(DIR, file), "utf8")
    .split("\n")
    .filter(l => !l.trim().startsWith("//"))
    .join("\n");
}

describe("gas limit calibration", () => {
  it("no site gates the rebuild on exceeding its own starting limit", () => {
    const offenders = FILES.filter(f => /requiredGas\s*(&&[^)]*)?>\s*(gasLimit|defaultGasLimit)/.test(code(f)));
    expect(offenders, `these would ship at their starting limit: ${offenders.join(", ")}`).toEqual([]);
  });

  it("every file that simulates for gas also calibrates from the result", () => {
    // A file could "pass" the test above by deleting the rebuild entirely, which would be worse
    // — it would ship at the default with no calibration at all.
    for (const f of FILES) {
      const src = code(f);
      if (!/const requiredGas\s*=\s*simulation\.gas/.test(src)) continue;
      expect(src, `${f} reads simulation.gas but never calibrates`).toMatch(/calculateAutoGasLimit\(/);
      expect(src, `${f} calibrates but never rebuilds`).toMatch(/buildTransaction\(/);
    }
  });

  it("calibration lowers a limit well below the ceiling", () => {
    // The actual field case: 145,633 measured. x1.10 + 10,000 flat in the 100k-500k band.
    expect(calculateAutoGasLimit(145_633)).toBe(170_197);
    expect(calculateAutoGasLimit(145_633)).toBeLessThan(2_000_000);
  });

  it("still raises a limit when the operation is genuinely expensive", () => {
    // Calibrating DOWN must not break calibrating UP — a site starting at 70_000 (coilFunctions)
    // and measuring 120_000 must still end above its start.
    expect(calculateAutoGasLimit(120_000)).toBeGreaterThan(70_000);
  });

  it("never exceeds the node ceiling, so lowering cannot become raising past the limit", () => {
    expect(calculateAutoGasLimit(1_999_999)).toBeLessThanOrEqual(2_000_000);
    expect(calculateAutoGasLimit(5_000_000)).toBeLessThanOrEqual(2_000_000);
  });

  it("keeps a cushion over the measurement, because a dirty read under-reports", () => {
    // A signed transaction pays for capabilities, the gas-payer coin.TRANSFER and keyset reads
    // that a /local read does not fully charge. Calibrating to the bare measurement would turn
    // this fix into out-of-gas failures, which cost the limit too.
    for (const g of [1_000, 20_000, 145_633, 400_000, 900_000]) {
      expect(calculateAutoGasLimit(g), `cushion at ${g}`).toBeGreaterThan(g);
    }
  });
});
