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
 * 4. NATIVE IS NOT OURONET, and the difference is narrow. A `coin.*` call has no INFO_ preview
 *    and collects no IGNIS. Gas IS still sponsored -- claiming otherwise tells a user they are
 *    about to spend when they are not. Render native with a gold perimeter so the two are never
 *    confused, and say what is actually different rather than inventing a difference.
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
  /** `native` renders with a gold perimeter and no cost section -- rule 4. */
  kind: "ouronet" | "native";
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

/** A `coin.*` key is StoaChain's root-namespace contract -- outside this registry by design. */
export const isNativeKey = (key: string): boolean => key.startsWith("coin.");

/**
 * STOA-native specs, which the generated registry does not and will not describe.
 *
 * They live HERE rather than in each consumer so that both applications render the same
 * signatures. Transcribed from the deployed contract with its line numbers; `tooltip.test.ts`
 * asserts internal consistency and the Pact repo's own test re-reads the source.
 *
 *   source: 0_Stoa/coin-contract/coin-live.pact
 */
export const NATIVE_SIGNATURES: Readonly<Record<string, ReadonlyArray<[string, string]>>> = {
  // [name, type] pairs, in declared order.
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

/** Kadena-shaped, NOT an Ouronet glyph account -- a `coin` call takes k:/c:/u:/w:. */
const NATIVE_GHOST: Readonly<Record<string, string>> = {
  string: '"k:1ac0d8b0a4f6e2c9d3b5a7e1f4c6089d2b3e5a7c9f1d3b5e7a9c1f3d5b7e9a1c"',
  decimal: "1.0",
  integer: "1",
  bool: "false",
  guard: '(read-keyset "ks")',
};

function nativeModel(key: string, values: Readonly<Record<string, string>>): TooltipModel {
  // Callers reach this only through `tooltipModel`, which has already rejected an unknown key.
  // Asserted rather than assumed: a non-null assertion here would make a future direct caller
  // fail with a property access on undefined instead of a sentence naming the problem.
  const sig = NATIVE_SIGNATURES[key];
  if (!sig) throw new Error(`nativeModel: no signature for "${key}"`);
  return {
    kind: "native",
    exec: key,
    slots: sig.map(([name, type], i) => ({
      index: i + 1,
      name,
      type,
      value: values[name] ?? NATIVE_GHOST[type] ?? PLACEHOLDER,
      isPlaceholder: values[name] === undefined && NATIVE_GHOST[type] === undefined,
      isPreflightFed: false,
      // A guard is never prefillable, native or not. Same rule, same reason.
      prefillable: type !== "guard",
    })),
    // No preview, deliberately. Rule 4: nothing on `coin` prices a call, so there is no cost to
    // show and a renderer must say that rather than leaving an empty panel that reads as a
    // failed load.
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
  if (isNativeKey(key)) {
    if (!NATIVE_SIGNATURES[key])
      throw new Error(`tooltipModel: unknown native key "${key}". ` +
        `Known: ${Object.keys(NATIVE_SIGNATURES).join(", ")}`);
    return nativeModel(key, values);
  }

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
    .filter((k) => isNativeKey(k) ? Boolean(NATIVE_SIGNATURES[k]) : Boolean(tryGetEntrypoint(k)))
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
