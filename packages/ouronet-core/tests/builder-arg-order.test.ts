/**
 * EVERY BUILDER'S ARGUMENT ORDER, AGAINST THE DEPLOYED SIGNATURE.
 *
 * `check-builder-arity.py` compares argument COUNT, and on 2026-10-16 that proved to be the
 * wrong question. `buildTransferPactCode` emitted six arguments where the chain wanted six --
 * but with the token id in the `executor` slot and the receiver in the `id` slot, because the
 * sovereign `patron`/`executor`/`executee` canon sweep had moved the signature underneath it.
 * Counting cannot see a rotation. Every true-fungible transfer in the app was broken for as
 * long as nobody tried one.
 *
 * It hid unusually well, which is why a count-based guard was not enough on its own:
 *   - arity matched, so the existing check passed;
 *   - the INFO preview has a DIFFERENT signature that did not move, so the cost preview
 *     rendered fine and only the signed execution failed;
 *   - the chain's error named a TABLE ("No value found in ... DPTF|PropertiesTable for key:
 *     <account>"), which reads as a missing token rather than a misplaced argument.
 *
 * So this asserts POSITION BY NAME. For each builder it extracts the emitted call, splits the
 * arguments at paren/bracket depth zero, and checks each slot it can confidently name against
 * the registry's own parameter list.
 *
 * ONLY CONFIDENTLY-NAMED SLOTS ARE COMPARED, deliberately. `ALIAS` maps the builder's own
 * parameter names onto the chain's; a slot whose name is not in it (a bare list, a `read-msg`,
 * a local like `dec`) is skipped rather than guessed at. A guard that invents a mapping would
 * fail on correct code, get an exemption, and then be ignored.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "../src/pact/cfmBuilders.ts"), "utf8");
const REGISTRY = JSON.parse(
  readFileSync(join(HERE, "../../talos-registry/src/data/registry.json"), "utf8"),
) as { entrypoints: Record<string, { params: { name: string }[] }> };

/** Builder parameter name -> the chain parameter it is meant to fill. */
const ALIAS: Record<string, string> = {
  patron: "patron",
  tokenId: "id", id: "id", assetId: "id",
  sender: "executor", executor: "executor", account: "executor",
  receiver: "executee", executee: "executee", beneficiary: "executee",
  method: "method",
};

/** Split a Pact argument list at depth zero — a bracketed list or `(read-msg ...)` is ONE arg. */
function splitArgs(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (/\s/.test(ch) && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

interface Builder { fn: string; key: string; args: string[]; chain: string[] }

function builders(): Builder[] {
  const out: Builder[] = [];
  for (const m of SRC.matchAll(/export function (build\w+)\(([\s\S]*?)\): string \{([\s\S]*?)\n\}/g)) {
    const [, fn, , body] = m;
    const call = body.match(/\$\{KADENA_NAMESPACE\}\.(TS[0-9]{2}-[A-Z0-9]+)\.([A-Za-z0-9|_]+)([\s\S]*?)\)`/);
    if (!call) continue;
    const key = `${call[1]}.${call[2]}`;
    const entry = REGISTRY.entrypoints[key];
    if (!entry) continue;
    out.push({ fn, key, args: splitArgs(call[3]), chain: entry.params.map(p => p.name) });
  }
  return out;
}

describe("CFM builders match the DEPLOYED signature", () => {
  const all = builders();

  it("finds builders to check at all — a vacuous pass is the failure mode here", () => {
    // Earlier versions of this scan matched nothing and reported a clean sweep. An empty
    // result set is indistinguishable from "all correct" unless something asserts otherwise.
    expect(all.length, "no builders resolved against the registry — the parser is broken")
      .toBeGreaterThan(30);
    expect(all.some(b => b.fn === "buildTransferPactCode"), "the transfer builder must be in scope")
      .toBe(true);
  });

  it("emits one argument per declared parameter", () => {
    const bad = all.filter(b => b.args.length !== b.chain.length)
      .map(b => `${b.fn} -> ${b.key}: emits ${b.args.length}, chain declares ${b.chain.length}`);
    expect(bad, `argument COUNT disagrees with the chain:\n${bad.join("\n")}`).toEqual([]);
  });

  it("puts every nameable argument in the slot the chain declares for it", () => {
    const bad: string[] = [];
    for (const b of all) {
      b.args.forEach((raw, i) => {
        const name = raw.match(/\$\{(?:p\.)?(\w+)\}/)?.[1];
        const want = b.chain[i];
        if (!name) return;                       // a list / read-msg / literal — not nameable
        const mapped = ALIAS[name];
        if (!mapped || !Object.values(ALIAS).includes(want)) return;
        if (mapped !== want) {
          bad.push(`${b.fn} -> ${b.key} slot ${i + 1}: sends "${name}" (${mapped}) where the chain declares "${want}"`);
        }
      });
    }
    expect(bad, `argument ORDER disagrees with the chain:\n${bad.join("\n")}`).toEqual([]);
  });

  it("sends the transfer's sender and receiver as executor and executee, in that order", () => {
    // Pinned explicitly, because getting these two backwards would still satisfy every
    // structural check above and would move money to the wrong account. The deployed Talos
    // doc is the authority: "Transfers a DPTF Token from <executor> to <executee>".
    const t = all.find(b => b.fn === "buildTransferPactCode")!;
    expect(t.args[1]).toContain("sender");
    expect(t.args[2]).toContain("receiver");
    expect(t.args[3]).toContain("tokenId");
    expect(t.chain.slice(0, 4)).toEqual(["patron", "executor", "executee", "id"]);
  });
});
