/**
 * THE TOOLTIP CANON, as code.
 *
 * A pre-ZBOM tooltip answers one question: *what will this button actually execute, and what will
 * it cost?* Two applications render it -- OuronetUI and the Codex -- and they had been converging
 * on it independently, each rediscovering the same traps a few weeks apart. This module exists so
 * the rules are a SHARED IMPLEMENTATION rather than a shared document, because a document drifts
 * from the code it describes and nobody finds out until a user sees a wrong number.
 *
 * `TOOLTIP-CANON.md` beside this file explains WHY each rule exists. This file is the rule.
 *
 * ── THE FIVE RULES ────────────────────────────────────────────────────────────────────────────
 *
 * 1. SHOW EVERY EXECUTION PARAMETER. All of them, always, in declared order. A tooltip that lists
 *    five rows for a six-parameter function is not a summary, it is a wrong answer -- and it is
 *    how `DPTF|C_Transfer` came to display five arguments for a six-argument call.
 *
 * 2. THE ARGUMENTS BELONG TO THE EXECUTION, the cost belongs to the preview. 410 of 423
 *    entrypoints have a preview whose parameter list DIFFERS from their own, so the two cannot
 *    share one numbered list. Render the execution's; mention the preview's separately.
 *
 * 3. TYPES GO ON THEIR OWN ROW. `patron:string executor:string ...` doubles the width of the
 *    widest line in the panel. A parallel row under the names costs one line and reads better.
 *
 * 4. THREE WORLDS, WITH A CANONICAL COLOUR EACH. `ouronet` (blue), `stoa` (gold), `kadena`
 *    (green). They differ in what they cost and what can be previewed. Only `ouronet` has an
 *    INFO_ reader and collects IGNIS; gas is sponsored on the Stoa side regardless -- claiming
 *    otherwise tells a user they are about to spend when they are not.
 *
 *    THE PALETTE IS NOW CANON, reversing the 1.4.0 position that it was each app's business.
 *    The argument then was that a package should not dictate colours inside somebody else's
 *    design language, and that was right about DECORATION and wrong about this: the colour
 *    encodes WHICH CHAIN YOUR MONEY IS ON. A user who learns green-means-Kadena in one app and
 *    meets green-means-something-else in the other has been taught a falsehood by the
 *    inconsistency, and the two apps share users. A shared vocabulary has to be shared.
 *
 * 4b. SAY WHO IS RENDERING. Two applications draw this tooltip, and they draw it over different
 *    surfaces for the same chains. A caller zone naming the consumer costs one line and answers
 *    "which app am I looking at" without the user having to infer it from chrome -- which matters
 *    most in exactly the case where it is hardest, a Codex panel over an OuronetUI page.
 *
 * 0. CHAINWEB ONLY -- the rule that decides whether a tooltip exists at all. This model describes
 *    a PACT call on a Chainweb chain: what function, what arguments, what it costs. A button that
 *    transacts on Arweave, or any non-Chainweb chain, has none of those things in this shape and
 *    gets NO tooltip of this kind rather than an empty one. An empty panel reads as a failure to
 *    load; absence reads as "this is a different kind of thing", which is the truth.
 *
 * 5. A GHOST IS NOT DATA. An unresolved argument must LOOK unresolved, and a tooltip whose
 *    arguments are placeholders must not fire the preview read at all: the answer is a foregone
 *    refusal and the latency is paid by the user for nothing.
 */
import { getEntrypoint, getPreview, tryGetEntrypoint, registry } from "./registry.js";
import { formatForType } from "./format.js";
import type { GhostUse } from "./types.js";

/** The three worlds a tooltip can describe. See rule 4. */
export type Chain = "ouronet" | "stoa" | "kadena";

/**
 * The canonical border colour per chain. USE THESE.
 *
 * Not styling: the colour tells a user which chain their money is on, and that vocabulary is
 * shared between the applications that render it. Two apps teaching different meanings for the
 * same colour is worse than neither using colour at all, because the user believes the first one
 * they learned.
 *
 *   ouronet  blue    the ouronet-ns surface -- priced, IGNIS, sponsored
 *   stoa     gold    StoaChain's own coin -- unpriced, no IGNIS, still sponsored
 *   kadena   green   a DIFFERENT CHAIN -- its own gas, its own balances
 *
 * Chosen from what was already in use rather than invented: gold is OuronetUI's STOA accent and
 * blue its established `#3b82f6`; green is the app's existing success green, which is unused on
 * any other tooltip surface and therefore free to carry this meaning.
 */
export const CHAIN_PALETTE: Readonly<Record<Chain, string>> = {
  ouronet: "#3b82f6",
  stoa: "#ceac5f",
  kadena: "#22c55e",
};

/** Human label for the chain, for the border-adjacent marker. */
export const CHAIN_LABEL: Readonly<Record<Chain, string>> = {
  ouronet: "OURONET",
  stoa: "STOA NATIVE",
  kadena: "KADENA",
};

/**
 * Who is drawing the tooltip -- rule 4b.
 *
 * Two applications render this, and a Codex panel can open over an OuronetUI page, which is
 * exactly the case where "whose tooltip is this" is hardest to infer from chrome and most useful
 * to state. The accent is the CONSUMER's identity and is deliberately a different axis from
 * `CHAIN_PALETTE`: one says what you are looking at, the other says who is showing it to you.
 *
 * `name` matches the `consumerName` key each app already uses for its codex settings, so there is
 * one spelling of "OuronetUI" across the workspace rather than two.
 */
export interface ConsumerIdentity {
  name: string;
  /** the app's own accent for the caller zone. NOT a chain colour. */
  accent: string;
}

export const CONSUMERS: Readonly<Record<"OuronetUI" | "Codex", ConsumerIdentity>> = {
  OuronetUI: { name: "OuronetUI", accent: "#d2d3d4" },
  Codex: { name: "Codex", accent: "#8b5cf6" },
};

/** One parameter of the execution, with everything a renderer needs about it. */
export interface TooltipSlot {
  /** 1-based, so a renderer never has to decide whether to add one. */
  index: number;
  name: string;
  /** the Pact type as DECLARED. Rendered on its own row -- rule 3. */
  type: string;
  /** the rendered Pact literal, or the `display` override where one exists. */
  value: string;
  /** the generic "example" ghost: an entity that does not exist on chain. Render it as such. */
  isPlaceholder: boolean;
  /** the output of a preflight read. There is no value and none may be invented. */
  isPreflightFed: boolean;
  /** false = never prefill into an input that can reach a signed transaction (guards). */
  prefillable: boolean;
  /**
   * The CALLER supplied this value; it is not a ghost.
   *
   * Tracked in the model rather than left to each renderer, because "is this the user's data or
   * an example?" is the question every one of this module's bugs turned on, and two consumers
   * answering it separately is two chances to answer it differently.
   */
  supplied: boolean;
  /** the registry's own note about this argument, when it has one. */
  note?: string;
}

export interface TooltipPreview {
  /** fully qualified INFO_ reader. */
  name: string;
  /** ITS parameter names, which are usually not the execution's. */
  params: string[];
  /** the rendered call, ready to `/local`. */
  call: string;
}

export interface TooltipModel {
  /**
   * Which world this call belongs to -- rule 4.
   *
   *   ouronet  the `ouronet-ns` surface. Priced by an INFO_ reader, collects IGNIS.
   *   stoa     StoaChain's own root-namespace `coin`. No preview, no IGNIS, gas still sponsored.
   *   kadena   Kadena mainnet's `coin`. A DIFFERENT CHAIN -- different gas, different accounts,
   *            and nothing about Ouronet applies to it.
   *
   * Each has a canonical colour in `CHAIN_PALETTE`, and a renderer should use it: the colour
   * encodes which chain the user's money is on, which is shared vocabulary rather than styling.
   *
   * RENAMED from `"native"` in 2.0.0. With only two worlds "native" was unambiguous; with three
   * it silently invited the question "native to WHAT" -- and both candidate answers are a
   * contract called `coin`.
   */
  kind: "ouronet" | "stoa" | "kadena";
  /** fully qualified execution, as it would be typed in a transaction. */
  exec: string;
  /** EVERY execution parameter, in declared order -- rule 1. */
  slots: TooltipSlot[];
  /** absent for native calls: nothing on StoaChain's `coin` contract prices a call. */
  preview?: TooltipPreview;
  /**
   * Whether a renderer should fire the preview read.
   *
   * False when any argument is a placeholder -- the read would refuse, and a refusal per hover is
   * latency the user pays for a foregone conclusion. Rule 5.
   */
  shouldRead: boolean;
  /** the canonical border colour for `kind`. Convenience -- identical to CHAIN_PALETTE[kind]. */
  chainColor: string;
  /** the label to print beside it: OURONET / STOA NATIVE / KADENA. */
  chainLabel: string;
  /** who is rendering, for the caller zone. Undefined when the caller did not say. */
  consumer?: ConsumerIdentity;
  /** things a renderer may want to surface. Never thrown; a tooltip must not take a page down. */
  warnings: string[];
}

/** The registry's generic placeholder: an entity id for something that does not exist on chain. */
export const PLACEHOLDER = '"example"';
export const isPlaceholder = (rendered: string): boolean => rendered === PLACEHOLDER;

/**
 * Off-registry signatures, by chain.
 *
 * Neither chain's `coin` contract is in the generated registry -- that describes `ouronet-ns`
 * only -- so these are transcribed by hand with their source lines. They live HERE rather than in
 * each consumer so both applications render the same signatures instead of each keeping a copy.
 *
 * BOTH CHAINS CALL THEIR CONTRACT `coin`, which is the one real hazard in this table. StoaChain's
 * uses Ouronet-style names (`C_Transfer`, `C_URV|Stake`); Kadena's uses KIP-0002 kebab-case
 * (`transfer`, `transfer-create`). No key collides TODAY, and `chainOf` refuses rather than
 * guesses if one ever does -- the same posture `resolveByName` takes for the four SWP names that
 * resolve to two modules. Guessing wrong here would price a call on the wrong chain.
 */

/**
 * StoaChain's root-namespace `coin`.  source: `0_Stoa/coin-contract/coin-live.pact`
 *
 * COMPLETED 2026-10-28 — all 18 `C_` entrypoints, read off the contract rather than added as
 * each consumer asked for one. It held NINE, and the nine were the ones somebody had needed so
 * far, which is a different thing from a surface. Three consequences were live at that moment:
 *
 *   - `coin.C_CreateAccount` and `coin.C_UR|CreateAccount` were absent, and they are the first
 *     leg of every "create the destination, then act" composite in OuronetUI.
 *   - `coin.C_UR|TransferAnew` / `C_UR|TransmitAnew` were absent, which is what `TransferUrStoa`
 *     needs — and `PAPYRUS_ENGINE_SPEC.md` §2.5.4 QUOTED `coin.C_UR|TransferAnew` from this
 *     table as evidence the surface was covered. The entry it actually read was
 *     `C_TransferAnew`, the non-UR one. A near-name is how a gap reads as a presence.
 *   - Nothing could say the table was short, because nothing compares it to the contract. It
 *     still cannot: the Pact sources live in another repository. So the line references below
 *     are the audit trail — re-derive with `grep -n "(defun C_" coin-live.pact`, which is how
 *     this list was built.
 */
export const STOA_SIGNATURES: Readonly<Record<string, ReadonlyArray<[string, string]>>> = {
  // Account lifecycle. The guard is ALWAYS `(read-keyset "<name>")` — see `formatForType`.
  "coin.C_CreateAccount": [["account", "string"], ["guard", "guard"]],                                // :577
  "coin.C_RotateAccount": [["account", "string"], ["new-guard", "guard"]],                             // :580
  // STOA.
  "coin.C_Transfer":      [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :583
  "coin.C_TransferAnew":  [["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["amount", "decimal"]], // :586
  "coin.C_TransferAcross":[["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["target-chain", "string"], ["amount", "decimal"]], // :589
  "coin.C_Transmit":      [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :593
  "coin.C_TransmitAnew":  [["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["amount", "decimal"]], // :599
  // UrStoa — a SEPARATE account table, hence its own create/rotate rather than reusing the above.
  "coin.C_UR|CreateAccount": [["account", "string"], ["guard", "guard"]],                              // :1060
  "coin.C_UR|RotateAccount": [["account", "string"], ["new-guard", "guard"]],                          // :1068
  "coin.C_UR|Transfer":   [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :1075
  "coin.C_UR|TransferAnew":[["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["amount", "decimal"]], // :1080
  "coin.C_UR|Transmit":   [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :1085
  "coin.C_UR|TransmitAnew":[["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["amount", "decimal"]], // :1090
  // The UrStoa Vault.
  "coin.C_URV|Inject":    [["account", "string"], ["stoa-amount", "decimal"]],                         // :1364
  "coin.C_URV|CoinbaseInject": [["account", "string"], ["stoa-amount", "decimal"]],                    // :1372
  "coin.C_URV|Stake":     [["account", "string"], ["urstoa-amount", "decimal"]],                      // :1407
  "coin.C_URV|Unstake":   [["account", "string"], ["urstoa-amount", "decimal"]],                      // :1439
  "coin.C_URV|Collect":   [["account", "string"]],                                                    // :1467
};

/**
 * Kadena mainnet's `coin`.  source: 00_KadenaSandbox/kda-env/kadena/coin-v6.pact
 *
 * A DIFFERENT CHAIN. Different gas, different accounts, and nothing about Ouronet's gas station
 * or IGNIS applies. `transfer-crosschain` is a `defpact` -- a multi-step continuation -- which a
 * renderer may want to say out loud, because its later steps are not sponsored by anyone.
 */
export const KADENA_SIGNATURES: Readonly<Record<string, ReadonlyArray<[string, string]>>> = {
  "coin.transfer":            [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],  // :329
  "coin.transfer-create":     [["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["amount", "decimal"]], // :356
  "coin.transfer-crosschain": [["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["target-chain", "string"], ["amount", "decimal"]], // :528 (defpact)
  "coin.create-account":      [["account", "string"], ["guard", "guard"]],                            // :278
  "coin.rotate":              [["account", "string"], ["new-guard", "guard"]],                        // :307
};

/** Back-compat alias. `NATIVE_SIGNATURES` meant StoaChain's before Kadena joined the model. */
export const NATIVE_SIGNATURES = STOA_SIGNATURES;

/**
 * Which chain a key belongs to, or `undefined` for a key this model does not describe.
 *
 * Refuses an AMBIGUOUS key rather than picking: both chains have a `coin`, and pricing a call on
 * the wrong chain is the kind of wrong that looks right.
 */
export function chainOf(key: string): "ouronet" | "stoa" | "kadena" | undefined {
  const inStoa = key in STOA_SIGNATURES;
  const inKda = key in KADENA_SIGNATURES;
  if (inStoa && inKda)
    throw new Error(
      `tooltip: "${key}" is declared for BOTH StoaChain and Kadena. Both chains have a \`coin\` ` +
      `contract, so this cannot be resolved by name -- and choosing wrong would describe a call ` +
      `on the wrong chain. Remove the duplicate or key it explicitly.`);
  if (inStoa) return "stoa";
  if (inKda) return "kadena";
  return tryGetEntrypoint(key) ? "ouronet" : undefined;
}

/** True for any key this model can describe at all. Arweave and friends answer false -- rule 0. */
export const isOffRegistryKey = (key: string): boolean =>
  key in STOA_SIGNATURES || key in KADENA_SIGNATURES;

/** @deprecated use `chainOf(key) === "stoa"`. Kept so 1.x callers keep compiling. */
export const isNativeKey = (key: string): boolean => key in STOA_SIGNATURES;

/** StoaChain `coin` accounts are k:/c:/u:/w: shaped, NOT Ouronet glyph strings. */
const STOA_GHOST: Readonly<Record<string, string>> = {
  string: '"k:1ac0d8b0a4f6e2c9d3b5a7e1f4c6089d2b3e5a7c9f1d3b5e7a9c1f3d5b7e9a1c"',
  decimal: "1.0",
  integer: "1",
  bool: "false",
  guard: '(read-keyset "ks")',
};

/** Kadena accounts are `k:` principals. Same shape, different chain -- and a different balance. */
const KADENA_GHOST: Readonly<Record<string, string>> = {
  string: '"k:1ac0d8b0a4f6e2c9d3b5a7e1f4c6089d2b3e5a7c9f1d3b5e7a9c1f3d5b7e9a1c"',
  decimal: "1.0",
  integer: "1",
  bool: "false",
  guard: '(read-keyset "ks")',
};

function offRegistryModel(
  key: string,
  kind: "stoa" | "kadena",
  values: Readonly<Record<string, string>>,
  consumer?: ConsumerIdentity,
): TooltipModel {
  const sig = (kind === "stoa" ? STOA_SIGNATURES : KADENA_SIGNATURES)[key];
  if (!sig) throw new Error(`offRegistryModel: no signature for "${key}"`);
  const ghost = kind === "stoa" ? STOA_GHOST : KADENA_GHOST;
  return {
    kind,
    exec: key,
    chainColor: CHAIN_PALETTE[kind],
    chainLabel: CHAIN_LABEL[kind],
    consumer,
    slots: sig.map(([name, type], i) => ({
      index: i + 1,
      name,
      type,
      value: values[name] ?? ghost[type] ?? PLACEHOLDER,
      isPlaceholder: values[name] === undefined && ghost[type] === undefined,
      isPreflightFed: false,
      // A guard is never prefillable, on any chain. Same rule, same reason.
      prefillable: type !== "guard",
      supplied: values[name] !== undefined,
    })),
    // No preview, deliberately. Neither chain's `coin` has a reader that prices a call, so there
    // is no cost to show -- and a renderer must SAY that rather than leaving an empty panel,
    // which reads as "the price failed to load".
    shouldRead: false,
    warnings: [],
  };
}

/**
 * Everything a renderer needs for one entrypoint.
 *
 * `values` overrides ghosts BY PARAMETER NAME. Never positionally: 410 of 423 previews declare a
 * different list from their entrypoint, and positional merging is how an executor's account ends
 * up in a token-id slot -- silently, because both are strings.
 *
 * Throws only on an unknown key, which is a programming error. Everything else degrades: an
 * unresolvable argument becomes a visible placeholder rather than an exception, because a tooltip
 * must never take down the page it annotates.
 */
export function tooltipModel(
  key: string,
  values: Readonly<Record<string, string>> = {},
  consumer?: ConsumerIdentity,
): TooltipModel {
  const chain = chainOf(key);
  if (chain === "stoa" || chain === "kadena")
    return offRegistryModel(key, chain, values, consumer);
  if (chain === undefined && isOffRegistryKey(key))
    throw new Error(`tooltipModel: "${key}" matched no chain. This is a bug in chainOf.`);

  const ep = getEntrypoint(key);           // throws, and names near matches, on a stale key
  const warnings: string[] = [];
  const use: Record<string, GhostUse> = ep.ghost.use ?? {};

  // RULE 1: every parameter, in declared order. Not the preview's list, not a subset.
  const slots: TooltipSlot[] = ep.params.map((p, i) => {
    const supplied = values[p.name];
    const raw = ep.ghost.args[p.name];
    const u = use[p.name];

    let value: string;
    let isPlaceholder = false;
    const isPreflightFed = raw === null;

    if (supplied !== undefined) {
      value = supplied;
    } else if (u?.display !== undefined) {
      // The submittable form and the readable form differ -- a guard is `(read-keyset "ks")` to
      // a reader and a data-key name to the transaction builder.
      value = u.display;
    } else if (isPreflightFed) {
      value = "<from preflight>";
    } else if (raw === undefined) {
      value = PLACEHOLDER;
      isPlaceholder = true;
      warnings.push(`no ghost for ${p.name}:${p.type}`);
    } else {
      try {
        value = formatForType(raw, p.type);
      } catch {
        value = PLACEHOLDER;
        isPlaceholder = true;
        warnings.push(`ghost for ${p.name} does not fit ${p.type}`);
      }
      if (isPlaceholder || value === PLACEHOLDER) isPlaceholder = true;
    }

    return {
      index: i + 1,
      name: p.name,
      type: p.type,
      value,
      isPlaceholder,
      isPreflightFed,
      prefillable: u?.zbom !== false,
      supplied: supplied !== undefined,
      note: ep.ghost.notes?.[p.name],
    };
  });

  // RULE 2: the preview is priced with ITS OWN parameter list, which is usually not this one.
  let preview: TooltipPreview | undefined;
  const pvKey = ep.preview;
  const pv = pvKey ? getPreview(pvKey) : undefined;
  if (pvKey && pv) {
    const args = pv.params.map((p) => {
      const supplied = values[p.name];
      if (supplied !== undefined) return supplied;
      const raw = ep.ghost.args[p.name];
      if (raw === undefined || raw === null) return PLACEHOLDER;
      try { return formatForType(raw, p.type); } catch { return PLACEHOLDER; }
    });
    preview = {
      name: `${registry.namespace}.${pvKey}`,
      params: pv.params.map((p) => p.name),
      call: `(${registry.namespace}.${pvKey} ${args.join(" ")})`,
    };
    if (args.some(isPlaceholder))
      warnings.push("preview has placeholder arguments; the read would refuse");
  } else if (pvKey) {
    warnings.push(`preview ${pvKey} is named but not in the registry`);
  }

  return {
    kind: "ouronet",
    exec: `${registry.namespace}.${key}`,
    chainColor: CHAIN_PALETTE.ouronet,
    chainLabel: CHAIN_LABEL.ouronet,
    consumer,
    slots,
    preview,
    // RULE 5: do not fire a read whose answer is a foregone refusal.
    shouldRead: preview !== undefined && !preview.call.includes(PLACEHOLDER),
    warnings,
  };
}

/**
 * Models for a button that fronts a CHOICE of executions, in the order the ZBOM presents them.
 *
 * Unknown keys are DROPPED rather than throwing: a button offering three executions should not
 * lose its tooltip because one is stale. The absence is reported in `warnings` of the survivors'
 * caller instead -- and if nothing survives, the caller renders no tooltip, which is the correct
 * outcome and not a crash.
 */
export function tooltipModels(
  keys: readonly string[],
  values: Readonly<Record<string, string>> = {},
  consumer?: ConsumerIdentity,
): TooltipModel[] {
  return keys
    .filter((k) => chainOf(k) !== undefined)
    .map((k) => tooltipModel(k, values, consumer));
}

/**
 * The type row -- rule 3.
 *
 * Returned parallel to the names so a renderer can print two aligned lines rather than
 * `name:type` pairs, which double the width of the widest line in the panel.
 */
export function signatureRows(m: TooltipModel): { names: string[]; types: string[] } {
  return { names: m.slots.map((s) => s.name), types: m.slots.map((s) => s.type) };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// RULE 7 — FILL EVERY PARAMETER YOU CAN. The role system exists to make that checkable.
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * What KIND of thing a parameter holds.
 *
 * Pact types cannot answer this -- `patron`, `id`, `ats` and `swpair` are all `string`, and a
 * value of the wrong kind in any of them type-checks, renders plausibly, and makes the preview
 * succeed against the wrong entity. That is the defect class this whole module exists to prevent,
 * and it has now produced four separate bugs.
 */
export type ParamRole =
  | "ouronet-account" | "kadena-account"
  | "token-id" | "dpof-id" | "ats-pool" | "swap-pool"
  | "other";

/**
 * DERIVED FROM THE GHOST'S SHAPE, not from a hand-written list of 332 names.
 *
 * Hand-classifying the vocabulary would be the same act that produced the bugs: a human deciding
 * that `ats` looks like a token because both are strings. The registry's ghosts were each resolved
 * for their own parameter and READ FROM MAINNET, so the value's shape is evidence rather than
 * opinion -- an Ouronet account is a glyph string, a pool is `Name-O136CBn22ncY`, a swap pair
 * starts `W|`, a hibernated DPOF starts `H|`.
 *
 * A name whose ghost is the generic `"example"` gets NO role, and that is correct: nothing is
 * known about it, so nothing should be inferred. Those render as visible placeholders.
 */
const ROLE_PATTERNS: ReadonlyArray<[RegExp, ParamRole]> = [
  [/^k:/, "kadena-account"],
  [/^[^\u0000-\u007F]\./, "ouronet-account"],
  [/^W\|/, "swap-pool"],
  [/^H\|/, "dpof-id"],
  [/^[A-Za-z]+-O136CBn22ncY$/, "ats-pool"],
  [/^[A-Z0-9]+-[A-Za-z0-9]{3}-[A-Za-z0-9]+$/, "token-id"],
];

let ROLES: Map<string, ParamRole> | null = null;

function buildRoles(): Map<string, ParamRole> {
  const out = new Map<string, ParamRole>();
  const reg = registry as unknown as {
    entrypoints: Record<string, any>; previews: Record<string, any>;
  };
  for (const coll of [reg.entrypoints, reg.previews]) {
    for (const v of Object.values(coll)) {
      const args = v?.ghost?.args ?? {};
      for (const p of v?.params ?? []) {
        if (p.type !== "string" || out.has(p.name)) continue;
        const g = args[p.name];
        if (typeof g !== "string" || g === "example") continue;
        for (const [re, role] of ROLE_PATTERNS)
          if (re.test(g)) { out.set(p.name, role); break; }
      }
    }
  }
  return out;
}

/** The role of a parameter name, or undefined when nothing is known about it. */
export function paramRole(name: string): ParamRole | undefined {
  if (!ROLES) ROLES = buildRoles();
  return ROLES.get(name);
}

/** Every name this registry can classify, grouped. Useful for building a consumer's fill map. */
export function paramsByRole(): Record<ParamRole, string[]> {
  if (!ROLES) ROLES = buildRoles();
  const out = {} as Record<ParamRole, string[]>;
  for (const [n, r] of ROLES) (out[r] ??= []).push(n);
  for (const k of Object.keys(out)) out[k as ParamRole].sort();
  return out;
}

/**
 * RULE 7, as a check: which slots the consumer COULD have filled and did not.
 *
 * A slot qualifies when its role is known and the caller supplied no value for it. Those are the
 * ones that silently show somebody else's real id -- `ats = "Auryndex-…"` on a SilverStoa button,
 * an example account whose pool ledger is empty, a reward token rendered as "no live example".
 *
 * Placeholders and preflight-fed slots are NOT reported: the first is honestly unresolved and the
 * second must not be invented. This answers "what did you leave on the table", not "what is
 * missing".
 *
 * A conformant consumer asserts this is empty for every button it renders.
 */
export function unfilledFillable(m: TooltipModel): TooltipSlot[] {
  return m.slots.filter(
    (s) => !s.supplied
        && !s.isPlaceholder && !s.isPreflightFed
        && paramRole(s.name) !== undefined,
  );
}
