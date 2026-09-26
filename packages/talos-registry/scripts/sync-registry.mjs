// Copy the generated registry into the package, and REFUSE if it does not look generated.
//
// The registry is produced by REPL/tools/_registry.py in the Pact repo, which reads the CHAIN.
// This package bundles a snapshot rather than fetching at runtime -- a deliberate choice: a
// consumer that refreshes at runtime has a trust surface (whatever the node returns) and a
// failure mode (offline = no registry) that a pinned artefact does not.
//
// The checks below exist because a truncated or hand-edited copy would be worse than none:
// consumers would validate against it and get confident wrong answers.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.OURONET_REGISTRY_PATH
  ?? resolve(here, "../../../../../_onchain/Ouronet/Deploy/OURONET-REGISTRY.json");
const DST = resolve(here, "../src/data/registry.json");

let raw;
try {
  raw = readFileSync(SRC, "utf8");
} catch {
  console.error(`sync: cannot read ${SRC}\n` +
    `      Set OURONET_REGISTRY_PATH if the Pact repo lives elsewhere.`);
  process.exit(1);
}
const doc = JSON.parse(raw);

const problems = [];
if (!doc.entrypoints || Object.keys(doc.entrypoints).length === 0)
  problems.push("no entrypoints -- every downstream check would pass vacuously");
if (!doc.surfaceHash) problems.push("no surfaceHash -- consumers cannot pin what they built against");
if (doc.generatedFrom !== "chain+repo")
  problems.push(`generatedFrom is "${doc.generatedFrom}", not "chain+repo" -- this snapshot was ` +
                `built WITHOUT reading the chain, so it describes the repo's intent rather than ` +
                `what is callable. Run _registry.py --probe.`);
if ((doc.divergences ?? []).length)
  problems.push(`${doc.divergences.length} deployed/repo divergence(s) -- the sources have moved ` +
                `on from the chain; resolve before shipping a snapshot`);
if (problems.length) {
  console.error("sync REFUSED:\n" + problems.map(p => `  * ${p}`).join("\n"));
  process.exit(1);
}

const next = JSON.stringify(doc);
const n = Object.keys(doc.entrypoints).length;

// --check: is the BUNDLED snapshot still the one upstream produces?
//
// The drift this catches is the whole failure class the registry exists for, one level up: the
// Pact repo regenerates, this package is not re-synced, and consumers validate against a
// surface that no longer exists -- confidently, which is the dangerous part.
if (process.argv.includes("--check")) {
  let current = null;
  try { current = readFileSync(DST, "utf8"); } catch { /* absent */ }
  if (current === null) {
    console.error(`sync --check: no bundled snapshot at ${DST}. Run \`npm run sync\`.`);
    process.exit(1);
  }
  if (current !== next) {
    const mine = JSON.parse(current);
    console.error(
      `sync --check: the bundled snapshot is STALE.\n` +
      `  bundled:  surface ${mine.surfaceHash}  (${Object.keys(mine.entrypoints).length} entrypoints)\n` +
      `  upstream: surface ${doc.surfaceHash}  (${n} entrypoints)\n` +
      `  Run \`npm run build\` -- and bump the version, because the callable surface moved.`);
    process.exit(1);
  }
  console.log(`sync --check: current -- surface ${doc.surfaceHash}, ${n} entrypoints`);
  process.exit(0);
}

mkdirSync(dirname(DST), { recursive: true });
writeFileSync(DST, next);
console.log(`sync: ${n} entrypoints, ${Object.keys(doc.previews).length} previews, ` +
            `surface ${doc.surfaceHash}`);
