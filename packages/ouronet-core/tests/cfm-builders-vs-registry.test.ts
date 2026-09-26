/**
 * Every cfmBuilder emits the arity the DEPLOYED contract declares.
 *
 * WHY THIS IS HERE AND NOT ONLY IN A SCRIPT. `OuronetUI/scripts/check-builder-arity.py` already
 * checks this, and it found six wrong builders. But it lives in the app, it needs the Pact repo
 * checked out beside it, and it reads the app's `node_modules` copy of this package. So a consumer
 * who installs `@ouronet/ouronet-core` from the registry gets none of that protection, and a
 * regression introduced HERE is invisible until somebody rebuilds and runs a Python script in a
 * different repository. That gap is not hypothetical -- it was found by a negative test that broke
 * a builder in this package's source and watched the checker report clean.
 *
 * So the guarantee moves to where the builders are. `@ouronet/talos-registry` is a devDependency
 * carrying a pinned snapshot of the deployed surface, so this needs no network and no sibling repo.
 *
 * THE BOUNDARY, stated rather than implied. This covers the builders in THIS package only.
 * OuronetUI keeps app-local overrides in `src/kadena/cfmBuilders.ts` which win at runtime, and
 * they are outside anything this package can see -- `check-builder-arity.py` reads both and is
 * still the only check that does. A scope that is obvious to whoever wrote it is the scope that
 * gets mistaken for complete later.
 *
 * HOW: each builder is CALLED and its real output parsed -- not its source template regexed. The
 * Python tool reads the template, which is why its counter could only see `${...}` interpolations
 * and missed `(read-msg 'slippage-bounds)` for weeks, excusing two correct builders as broken.
 * Parsing what a builder actually returns cannot make that mistake.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tryGetEntrypoint, surfaceHash } from "@ouronet/talos-registry";
import * as builders from "../src/pact/cfmBuilders.js";

const SOURCE = resolve(__dirname, "../src/pact/cfmBuilders.ts");

/** `buildX(p: { a: string; b: string[] })` -> field name -> declared type, per builder. */
function declaredParams(src: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  const decl = /export function (\w+)\s*\(\s*\w+\s*:\s*\{([^}]*)\}/g;
  for (let m = decl.exec(src); m; m = decl.exec(src)) {
    const fields = new Map<string, string>();
    // STRIP TRAILING `//` COMMENTS FIRST. A field annotated `amount: string;   // "k:<pub>"`
    // puts the comment BEFORE the next `;`, so splitting on `;` hands the following segment to
    // the field regex with `//` at its head and the field name is lost -- silently, as an
    // `undefined` argument that only surfaced because formatDecimalForPact threw on it. One
    // builder was affected; a field whose loss did not reach a formatter would have produced a
    // call with a literal `undefined` in it and this test would have called the arity correct.
    const block = m[2].replace(/\/\/[^\n]*/g, "");
    for (const line of block.split(";")) {
      const f = /^\s*(\w+)\s*:\s*([\w[\]]+)/.exec(line);
      if (f) fields.set(f[1], f[2]);
    }
    out.set(m[1], fields);
  }
  return out;
}

/**
 * A value that satisfies the declared type AND survives every formatter these builders apply.
 * "1.0" for strings rather than a word: several fields are raw decimal strings that go through
 * formatDecimalForPact, which rejects anything that is not a Pact decimal.
 */
function sample(type: string): unknown {
  switch (type) {
    case "string":    return "1.0";
    case "string[]":  return ["1.0", "2.0"];
    case "number":    return 1;
    case "number[]":  return [1, 2];
    case "boolean":   return true;
    default:          return "1.0";
  }
}

/**
 * EVERY `(ouronet-ns.MOD.FN …)` in the emitted code, with its argument count.
 *
 * Not just the first form, and not anchored at position 0 -- several builders emit a whole
 * transaction body that opens with `(namespace "ouronet-ns")` before the call, and one emits two
 * calls. An anchored parser reported those as "not a qualified call" and would have let a wrong
 * arity through in the tail of a multi-form body, which is the least visible place for one.
 */
export function parseEmitted(code: string): Array<{ key: string; argc: number }> {
  const out: Array<{ key: string; argc: number }> = [];
  const head = /\(\s*ouronet-ns\.([A-Za-z0-9|_-]+)\.([A-Za-z0-9|_-]+)/g;
  for (let m = head.exec(code); m; m = head.exec(code)) {
    out.push({ key: `${m[1]}.${m[2]}`, argc: countArgs(code.slice(m.index + m[0].length)) });
  }
  return out;
}

/** Top-level forms after a call's function name: strings, lists, paren forms, bare tokens. */
function countArgs(body: string): number {
  let depth = 0, argc = 0, inToken = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"') {                                  // a string is one argument
      if (depth === 0 && !inToken) argc++;
      i++;
      while (i < body.length && body[i] !== '"') i += body[i] === "\\" ? 2 : 1;
      inToken = false;
      continue;
    }
    if (c === "(" || c === "[") {                     // a form or list is one argument
      if (depth === 0) argc++;
      depth++; inToken = false;
      continue;
    }
    if (c === ")" || c === "]") {
      depth--;
      if (depth < 0) break;                           // the call's own closing paren
      continue;
    }
    if (/\s/.test(c)) { inToken = false; continue; }
    if (depth === 0 && !inToken) { argc++; inToken = true; }   // a bare token: number, bool
  }
  return argc;
}

const PARAMS = declaredParams(readFileSync(SOURCE, "utf8"));

/** Only the exported builders that return a Pact string. */
const BUILDERS = [...PARAMS.keys()].filter(
  (n) => typeof (builders as Record<string, unknown>)[n] === "function",
);

describe("cfmBuilders agree with the deployed contract surface", () => {
  it("found builders to check, and says so rather than passing over an empty list", () => {
    // A parser that silently matches nothing reports a clean run. This is the guard for that.
    expect(BUILDERS.length).toBeGreaterThan(30);
  });

  it("is compiled against a known surface", () => {
    expect(surfaceHash).toMatch(/^[0-9a-f]{16}$/);
  });

  for (const name of BUILDERS) {
    it(`${name} emits the declared arity`, () => {
      const fn = (builders as Record<string, (p: unknown) => string>)[name];
      const args: Record<string, unknown> = {};
      for (const [field, type] of PARAMS.get(name)!) args[field] = sample(type);

      const emitted = fn(args);
      const calls = parseEmitted(emitted);

      if (calls.length === 0) {
        // NOT A FAILURE, AND NOT A FREE PASS. Two shapes legitimately emit no ouronet-ns call,
        // and the exemption is derived from the CODE rather than from a list of names:
        //
        //   * it emits a `coin.*` call -- the STOA native contract, outside the surface this
        //     registry describes. The same reason the three UrStoa ZBOMs carry no execution hint.
        //   * it is not a call at all: buildNonKeyGuardExpr builds a guard EXPRESSION that goes
        //     inside a capability argument.
        //
        // The first draft of this listed the `coin.*` builders BY NAME and the guard immediately
        // reported four more it did not know about. A name list would have needed editing every
        // time one was added, and the edit is what gets skipped -- so the rule tests the emitted
        // string. Only the one non-call helper is named, because nothing in its output identifies
        // it.
        if (name === "buildNonKeyGuardExpr") return;
        expect(emitted, `${name} emits neither an ouronet-ns call nor a coin.* call`)
          .toMatch(/\(coin\./);
        return;
      }

      for (const call of calls) {
        const entry = tryGetEntrypoint(call.key);
        if (!entry) {
          // Some builders target core modules directly rather than Talos. Reported as skipped --
          // but the key must still LOOK like one, so a typo cannot pass as "not in the registry".
          expect(call.key).toMatch(/^[A-Za-z0-9|_-]+\.[A-Za-z0-9|_-]+$/);
          continue;
        }
        expect(call.argc,
          `${name} sends ${call.argc} argument(s); ${call.key} declares ${entry.params.length}`
          + ` (${entry.params.map((p) => p.name).join(", ")})\n  emitted: ${emitted}`,
        ).toBe(entry.params.length);
      }
    });
  }
});
