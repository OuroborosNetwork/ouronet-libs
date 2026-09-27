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
 * 4. THREE WORLDS, and they must be distinguishable at a glance. `ouronet` (the ouronet-ns
 *    surface), `stoa` (StoaChain's own `coin` contract) and `kadena` (Kadena mainnet's `coin`).
 *    They differ in what they cost and what can be previewed. Only `ouronet` has an INFO_ reader
 *    and collects IGNIS; gas is sponsored on the Stoa side regardless -- claiming otherwise tells
 *    a user they are about to spend when they are not. HOW you distinguish them is yours: `kind`
 *    is the canon, the palette is not.
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
   * A renderer MUST make these visually distinct, because they differ in what they cost and what
   * can be previewed. It is NOT told how: OuronetUI uses gold/blue, the Codex violet for Ouronet
   * and green for Kadena, and all are conformant. Mandating a palette in a package consumed by
   * applications with their own design languages is a rule that gets ignored, and an ignored rule
   * weakens the ones that matter.
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

/** StoaChain's root-namespace `coin`.  source: 0_Stoa/coin-contract/coin-live.pact */
export const STOA_SIGNATURES: Readonly<Record<string, ReadonlyArray<[string, string]>>> = {
  "coin.C_Transfer":      [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :583
  "coin.C_Transmit":      [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :593
  "coin.C_TransferAnew":  [["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["amount", "decimal"]], // :586
  "coin.C_TransmitAnew":  [["sender", "string"], ["receiver", "string"], ["receiver-guard", "guard"], ["amount", "decimal"]], // :599
  "coin.C_UR|Transfer":   [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :1075
  "coin.C_UR|Transmit":   [["sender", "string"], ["receiver", "string"], ["amount", "decimal"]],      // :1085
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
): TooltipModel {
  const sig = (kind === "stoa" ? STOA_SIGNATURES : KADENA_SIGNATURES)[key];
  if (!sig) throw new Error(`offRegistryModel: no signature for "${key}"`);
  const ghost = kind === "stoa" ? STOA_GHOST : KADENA_GHOST;
  return {
    kind,
    exec: key,
    slots: sig.map(([name, type], i) => ({
      index: i + 1,
      name,
      type,
      value: values[name] ?? ghost[type] ?? PLACEHOLDER,
      isPlaceholder: values[name] === undefined && ghost[type] === undefined,
      isPreflightFed: false,
      // A guard is never prefillable, on any chain. Same rule, same reason.
      prefillable: type !== "guard",
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
): TooltipModel {
  const chain = chainOf(key);
  if (chain === "stoa" || chain === "kadena") return offRegistryModel(key, chain, values);
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
): TooltipModel[] {
  return keys
    .filter((k) => chainOf(k) !== undefined)
    .map((k) => tooltipModel(k, values));
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
