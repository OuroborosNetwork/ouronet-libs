/**
 * `INFO_` COMES FIRST. THE MODULE NAME COMES SECOND.
 *
 * The deployed preview readers are named `INFO_<MODULE>|<Op>`:
 *
 *     INFO_SWP|AddLiquidity        INFO_CODEX|RegisterStoicTag
 *
 * NOT `<MODULE>|INFO_<Op>`. The two halves are easy to transpose because every OTHER function
 * in the system reads `<MODULE>|<Op>`, so the correct form is the one that looks wrong.
 *
 * This has now been fixed TWICE. 5.3.0 corrected 58 occurrences across 8 files; a 59th survived
 * in `ouroAccountFunctions.ts` and was found only by grepping the PUBLISHED tarball after
 * release. Both times the failure was silent in exactly the same way: the call returns
 * `{status: "failure", error: "Module ouronet-ns.X has no such member"}`, the helper swallows it
 * in a `catch` and returns `null`, and the UI renders a permanent "Awaiting computation..." with
 * Free/Free beside it. Nothing throws, nothing logs, no test fails — the preview just never
 * arrives, which is indistinguishable from a slow chain.
 *
 * That is why this is a STRUCTURAL test rather than a behavioural one. A behavioural test would
 * need a live chain to tell the two spellings apart, and the thing being prevented is a typo
 * that produces a syntactically valid, successfully-parsed, forever-null call.
 *
 * Verified against mainnet 2026-10-15:
 *   (ouronet-ns.CODEX.CODEX|INFO_RegisterStoicTag ...) -> "has no such member"
 *   (ouronet-ns.CODEX.INFO_CODEX|RegisterStoicTag ...) -> success
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/**
 * The transposition signature: a `|` immediately followed by `INFO_`. The CORRECT form never
 * produces this, because `INFO_` leads the identifier and the pipe falls after the module name.
 * Matching the defect rather than enumerating the right names means a NEW preview reader is
 * covered the day it is written, without an edit here.
 */
const TRANSPOSED = /\|INFO_/;

describe("INFO_ preview reader names", () => {
  it("no source file builds the transposed <MODULE>|INFO_<Op> form", () => {
    const offenders = walk(SRC)
      .map(f => ({ f, lines: readFileSync(f, "utf8").split("\n") }))
      .flatMap(({ f, lines }) =>
        lines
          .map((line, i) => ({ line, n: i + 1 }))
          .filter(({ line }) => TRANSPOSED.test(line))
          .map(({ line, n }) => `${f.replace(SRC, "src")}:${n}  ${line.trim().slice(0, 100)}`),
      );
    expect(offenders, `transposed INFO_ names (deployed form is INFO_<MODULE>|<Op>):\n${offenders.join("\n")}`)
      .toEqual([]);
  });

  it("the correct form is actually present, so the rule above cannot pass vacuously", () => {
    // A test asserting the ABSENCE of a pattern passes trivially if the feature is deleted.
    // This pins that real INFO_ calls exist to be got wrong.
    const all = walk(SRC).map(f => readFileSync(f, "utf8")).join("\n");
    const correct = all.match(/INFO_[A-Za-z-]+\|/g) ?? [];
    expect(correct.length).toBeGreaterThan(20);
  });

  it("recognises the exact pair that was wrong on mainnet", () => {
    expect(TRANSPOSED.test("CODEX.CODEX|INFO_RegisterStoicTag")).toBe(true);
    expect(TRANSPOSED.test("CODEX.INFO_CODEX|RegisterStoicTag")).toBe(false);
    expect(TRANSPOSED.test("SWP|INFO_AddLiquidity")).toBe(true);
    expect(TRANSPOSED.test("INFO_SWP|AddLiquidity")).toBe(false);
  });
});
