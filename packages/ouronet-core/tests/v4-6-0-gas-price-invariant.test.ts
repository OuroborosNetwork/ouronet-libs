/**
 * v4.6.0 — structural lock: EVERY `.setMeta({...})` in this package prices
 * against the live Yin floor, and the formula is never re-implemented locally.
 *
 * The sibling `v4-6-0-executor-gas-price.test.ts` proves the behaviour for a
 * sampled executor per file. This file closes the gap the sampling leaves: it
 * walks every `setMeta` object literal in `src/` — including branches the
 * sample does not drive, and including files added after this release — and
 * asserts each one spreads `stoaGasMeta(safeCreationTime())`.
 *
 * Why a source-level test rather than more mocks: the failure mode is silent.
 * An omitted `gasPrice` does not throw — the vendored client fills in
 * `1.0e-8` (the Yin genesis floor) and the transaction is built, signed, and
 * only then rejected by chainweb as underpriced. Nothing in a unit test would
 * notice unless it asserts on the absence itself. A new `setMeta` written the
 * old way must fail CI here.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, "..", "src");

function allSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return allSourceFiles(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** Extract the body of every `.setMeta({ ... })` object literal, brace-matched. */
function setMetaBodies(source: string): string[] {
  const bodies: string[] = [];
  const re = /\.setMeta\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const open = source.lastIndexOf("{", m.index + m[0].length);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          bodies.push(source.slice(open, i + 1));
          break;
        }
      }
    }
  }
  return bodies;
}

const files = allSourceFiles(srcRoot).map((path) => ({
  path,
  rel: relative(srcRoot, path),
  source: readFileSync(path, "utf8"),
}));

const withMeta = files
  .map((f) => ({ ...f, bodies: setMetaBodies(f.source) }))
  .filter((f) => f.bodies.length > 0);

describe("v4.6.0 — Yin gas pricing is universal across src/", () => {
  it("finds the setMeta sites at all (guards against a broken matcher)", () => {
    expect(withMeta.length).toBeGreaterThanOrEqual(18);
    expect(withMeta.reduce((n, f) => n + f.bodies.length, 0)).toBeGreaterThanOrEqual(38);
  });

  it("every setMeta object spreads stoaGasMeta(safeCreationTime())", () => {
    const offenders: string[] = [];
    for (const f of withMeta) {
      for (const [i, body] of f.bodies.entries()) {
        if (!body.includes("...stoaGasMeta(safeCreationTime())")) {
          offenders.push(`${f.rel} [setMeta #${i + 1}]`);
        }
      }
    }
    expect(offenders, "setMeta without the Yin price").toEqual([]);
  });

  it("no setMeta object also sets gasPrice or creationTime by hand", () => {
    // A literal key would silently win or lose against the spread depending on
    // ordering — the spread must be the only source of both fields.
    const offenders: string[] = [];
    for (const f of withMeta) {
      for (const [i, body] of f.bodies.entries()) {
        const stripped = body.replace(/\/\/.*$/gm, "");
        if (/\bgasPrice\s*:/.test(stripped) || /\bcreationTime\s*:/.test(stripped)) {
          offenders.push(`${f.rel} [setMeta #${i + 1}]`);
        }
      }
    }
    expect(offenders, "setMeta with a hand-written gasPrice/creationTime").toEqual([]);
  });

  it("every file that prices a transaction imports the canonical helper", () => {
    const offenders: string[] = [];
    for (const f of withMeta) {
      const importsHelper = /import \{[^}]*\bstoaGasMeta\b[^}]*\} from "@stoachain\/stoa-core\/gas"/s.test(f.source);
      const importsSkew = /import \{[^}]*\bsafeCreationTime\b[^}]*\} from "@stoachain\/stoa-core\/pact"/s.test(f.source);
      if (!importsHelper || !importsSkew) offenders.push(f.rel);
    }
    expect(offenders, "missing stoaGasMeta / safeCreationTime import").toEqual([]);
  });

  it("nobody re-implements the Yin formula locally (4.5.0's copy is retired)", () => {
    // The constants are the tell: genesis timestamp, tick interval, the cap,
    // and the padding conversion. All of them belong to stoa-core now.
    const forbidden: Array<[RegExp, string]> = [
      [/1771869600/, "Yin genesis timestamp"],
      [/10[_,]?800\b/, "3h tick interval"],
      [/400[_,]?000\b/, "400,000 ANU cap"],
      [/padStart\(12/, "ANU→STOA padding conversion"],
      [/\bminGasPriceAnu\b/, "local minGasPriceAnu"],
      [/\banuToStoaNumber\b/, "local anuToStoaNumber"],
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const code = f.source.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      for (const [re, what] of forbidden) {
        if (re.test(code)) offenders.push(`${f.rel}: ${what}`);
      }
    }
    expect(offenders, "local Yin re-implementation").toEqual([]);
  });
});
