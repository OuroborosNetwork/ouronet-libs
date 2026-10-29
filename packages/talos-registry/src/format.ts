import { RegistryError } from "./registry.js";

/** A guard argument: the NAME of the transaction-data key holding the keyset. */
export interface KeysetRef {
  readKeyset: string;
}

/**
 * Render a JS value as a Pact literal for a DECLARED type.
 *
 * Every rule here is a bug someone already shipped.
 */

/**
 * Pact's decimal lexer REJECTS a bare integer in a decimal slot: `5` is an integer literal and
 * will not coerce, so an amount of 5 must be emitted as `5.0`. Number.toString() gives "5".
 * This is the shipped defect the UI's builders call F-SEC-001.
 */
export function formatDecimal(v: unknown): string {
  if (typeof v === "string") {
    if (!/^-?\d+(\.\d+)?$/.test(v)) throw new RegistryError(`Not a decimal literal: "${v}"`);
    return v.includes(".") ? v : v + ".0";
  }
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new RegistryError(`Expected a decimal, got ${JSON.stringify(v)}`);
  // toFixed(12) rather than toString(): 1e-7 stringifies to "1e-7", which Pact cannot read.
  // Trailing zeros are trimmed back, but at least one digit is always kept after the point.
  const s = v.toFixed(12).replace(/0+$/, "");
  return s.endsWith(".") ? s + "0" : s;
}

export function formatInteger(v: unknown): string {
  if (typeof v === "string" && /^-?\d+$/.test(v)) return v;
  if (typeof v !== "number" || !Number.isInteger(v))
    throw new RegistryError(`Expected an integer, got ${JSON.stringify(v)}`);
  return String(v);
}

/**
 * Ouronet account ids are GLYPH strings and routinely contain characters that must survive
 * verbatim. Escape only what Pact's string lexer requires -- a backslash and a double quote.
 * Do NOT JSON.stringify: that would \\u-escape every non-ASCII glyph and change the account.
 */
export function formatString(v: unknown): string {
  if (typeof v !== "string") throw new RegistryError(`Expected a string, got ${JSON.stringify(v)}`);
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function formatBool(v: unknown): string {
  if (typeof v !== "boolean") throw new RegistryError(`Expected a bool, got ${JSON.stringify(v)}`);
  return v ? "true" : "false";
}

/**
 * A reference to an object carried in the transaction's `data`, rendered `(read-msg 'name)`.
 *
 * The object-typed sibling of `{ readKeyset: "ks" }`, and it exists for the same reason: some
 * arguments are not literals. Added 2026-10-28.
 */
export interface MsgRef { readMsg: string }

/**
 * A VALUE THAT CARRIES ITS OWN PACT TYPE — for a field inside an object literal.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS CLOSES
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * `formatObject` renders an object's FIELDS through `formatLoose`, which has no declared type to
 * work from — the registry carries a parameter's type (`object{AcquisitionSchemasV3.VCT|
 * VacateTfLeg}`) but not the named schema's FIELD types. For every type but one that is
 * harmless. For `decimal` it is not, because JAVASCRIPT CANNOT EXPRESS THE DIFFERENCE:
 * `100.0 === 100`, so by the time a value reaches this module the trailing zero is gone and a
 * whole-number decimal is indistinguishable from an integer.
 *
 * MEASURED, against `INFO_AQP-POOL|FullVacate`, whose legs declare `balance:decimal`:
 *
 *     buildPreviewCall(...)  ->  { "balance": 100 } ... { "balance": 2.5 }
 *
 * The second is right and the first is refused by Pact's decimal lexer. So the same code path
 * works or fails according to the DATA — intermittent by pool, which is the worst available
 * failure and precisely the kind a casual test passes. It is why OuronetUI ships the whole-pool
 * vacate with no cost preview rather than with one that usually fails.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE CALLER DECLARES IT, RATHER THAN THIS PACKAGE DERIVING IT
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * The field types ARE derivable — from the Pact sources' `defschema` forms. But this package
 * bundles a snapshot of the DEPLOYED surface, and its whole discipline is that deployed code
 * wins; a repo-sourced schema table would be a second authority inside it, authoritative-looking
 * and unverified against the chain. So the type travels with the value, chosen at the call site
 * by the code that knows which schema it is building for.
 *
 * That is the same reasoning `formatObject` already applies one level up: *"The caller chooses,
 * because only the caller knows whether its value came from the chain."*
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * ADDITIVE
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * An untagged value renders exactly as before. Nothing existing has to change, and a consumer
 * that tags nothing is in the position it was in — which for an object with no decimal field is
 * correct, and is why `C_UpdateSpecialFeeTargets` never needed this.
 */
export interface PactTyped {
  /** The Pact type this value must render as. */
  __pactType: "decimal" | "integer" | "string" | "bool" | "time";
  value: unknown;
}

function isPactTyped(v: unknown): v is PactTyped {
  return !!v && typeof v === "object" && typeof (v as PactTyped).__pactType === "string"
    && "value" in (v as object);
}

/**
 * Tag a value as a Pact `decimal`, so it renders as one INSIDE an object literal.
 *
 * `pactDecimal(100)` renders `100.0`; `pactDecimal(2.5)` renders `2.5`. Accepts a STRING too,
 * which is the lossless form — Pact decimals carry up to 24 places and a JS `number` holds about
 * 15 significant digits, so a value read from the chain and handed back should travel as the
 * digits the chain sent:
 *
 *     pactDecimal("16.800576521961000000000000")
 *
 * Only needed inside objects. A top-level `decimal` parameter already has its declared type and
 * goes through `formatDecimal` correctly.
 */
export function pactDecimal(value: number | string): PactTyped {
  return { __pactType: "decimal", value };
}

/**
 * Tag a value as a Pact `integer`.
 *
 * Less often needed than `pactDecimal` — a whole JS number already renders as an integer — but it
 * makes the intent explicit, and it turns the MIRROR defect into an error: a fractional value in
 * an integer field currently renders as `2.5` where `integer` is declared, which Pact refuses
 * after the fact. Tagged, it is refused here, with the value named.
 */
export function pactInteger(value: number | string): PactTyped {
  return { __pactType: "integer", value };
}

/**
 * Pact object literal: `{ "k": v, ... }` — OR a `(read-msg 'name)` reference.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * WHY AN OBJECT ARGUMENT SOMETIMES MUST NOT BE A LITERAL
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * Inline rendering is correct when every field's Pact type survives a JS round trip. It does for
 * `object{SwapperV5.FeeSplit}` — `{target:string, value:integer}` — which is the only object
 * argument any Ouronet client passes today, and it renders correctly.
 *
 * It is WRONG for `object{SwapperUsageV4.Slippage}`:
 *
 *     (defschema Slippage
 *         expected-output-amount:decimal
 *         output-precision:integer
 *         slippage-percent:decimal
 *     )
 *
 * Two decimals and an integer — and `formatLoose` below, which renders object FIELDS, is
 * documented as *"best-effort … where no declared type is available"*. It cannot know those
 * types: the registry carries a parameter's type (`object{SwapperUsageV4.Slippage}`) but not the
 * named schema's FIELD types. So a whole-number `expected-output-amount` renders as the integer
 * `5` where the schema declares `decimal`, and JavaScript cannot even express the difference —
 * `5.0 === 5`, so the trailing zero is gone before this function sees the value.
 *
 * AND THE DEEPER REASON IS PROVENANCE, not formatting. A `Slippage` is CONSTRUCTED BY THE CHAIN
 * (`SWPU.UDC_SpawnSlippageBounds`), read into the client, and handed straight back. Re-serialising
 * a chain-produced value through a JS literal formatter is a round trip through a lossy encoding
 * for no benefit; putting it in the transaction's `data` returns the chain its own JSON. That is
 * why the deployed templates render `(read-msg 'slippage-bounds)`.
 *
 * RESOLVED 2026-10-29 FOR THE CASES THAT CANNOT USE `read-msg` — see `PactTyped` / `pactDecimal`
 * above. The escape below works for an EXECUTION, which has a `data` payload; a COST PREVIEW is
 * issued as a bare code string and has nowhere for the object to travel, so
 * `INFO_AQP-POOL|FullVacate` could not be priced at all. The field's type now travels with the
 * value, declared at the call site. The paragraph above still stands for a chain-constructed
 * object an execution hands straight back: `read-msg` remains the better answer there, because it
 * avoids the round trip rather than correcting it.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * ADDITIVE, SO THE ONE EXISTING CONSUMER IS UNTOUCHED
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * A STRING (or `{ readMsg }`) means "this argument lives in the transaction data under that
 * name". An OBJECT still renders inline, exactly as before. `C_UpdateSpecialFeeTargets` keeps
 * working with no change, because it passes objects and its schema has no decimal field.
 *
 * The caller chooses, because only the caller knows whether its value came from the chain. The
 * alternative — refusing every object with a decimal field — needs schema field types the
 * registry does not carry, and inventing them here would be guessing about a contract. That last
 * sentence is still true and is why `pactDecimal` is an OPT-IN at the call site rather than a
 * table in this package: the types are derivable from the Pact sources, but a repo-sourced table
 * inside a snapshot of the DEPLOYED surface would be a second authority, authoritative-looking
 * and unverified against the chain.
 */
function formatObject(v: unknown, type: string): string {
  // `(read-msg 'name)` — the object travels in the transaction's data under this key.
  if (typeof v === "string") return `(read-msg '${v})`;
  if (v && typeof v === "object" && typeof (v as MsgRef).readMsg === "string")
    return `(read-msg '${(v as MsgRef).readMsg})`;
  if (v === null || typeof v !== "object" || Array.isArray(v))
    throw new RegistryError(
      `Expected an object for ${type}, or the NAME of a transaction-data key to pass it as ` +
        `(read-msg '<name>'). Got ${JSON.stringify(v)}.`);
  const body = Object.entries(v as Record<string, unknown>)
    .map(([k, val]) => `${formatString(k)}: ${formatLoose(val)}`)
    .join(", ");
  return `{ ${body} }`;
}

/**
 * Best-effort for values inside an untyped object, where no declared type is available — EXCEPT
 * where the value brought its own.
 *
 * THE CHECK MUST PRECEDE THE OBJECT BRANCH and nothing else, which is worth stating because the
 * ordering looks load-bearing and mostly is not. A `PactTyped` is an object, so reaching
 * `formatObject` first would render it as a nested literal `{ "__pactType": "decimal", … }` —
 * which parses and means something else entirely. It cannot collide with the string, boolean,
 * number or array branches, so its position among THOSE is immaterial: a mutant moving it down
 * to sit immediately above the object branch survives, and survives correctly.
 */
function formatLoose(v: unknown): string {
  if (isPactTyped(v)) return formatForType(v.value, v.__pactType);
  if (typeof v === "string") return formatString(v);
  if (typeof v === "boolean") return formatBool(v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : formatDecimal(v);
  if (Array.isArray(v)) return `[${v.map(formatLoose).join(" ")}]`;
  if (v && typeof v === "object") return formatObject(v, "object");
  throw new RegistryError(`Cannot render ${JSON.stringify(v)} as a Pact literal`);
}

/**
 * Render `value` for a parameter declared as `type`.
 *
 * Pact LIST literals are SPACE-separated, not comma-separated: `[1 2 3]`. A comma-joined list
 * is a different expression and will not parse as the caller intends.
 */
export function formatForType(value: unknown, type: string): string {
  const t = type.trim();

  if (t.startsWith("[") && t.endsWith("]")) {
    if (!Array.isArray(value))
      throw new RegistryError(`Expected a list for ${t}, got ${JSON.stringify(value)}`);
    const inner = t.slice(1, -1);
    return `[${value.map(v => formatForType(v, inner)).join(" ")}]`;
  }
  switch (t) {
    case "string":  return formatString(value);
    case "decimal": return formatDecimal(value);
    case "integer": return formatInteger(value);
    case "bool":    return formatBool(value);
    case "time":    return formatString(value);
  }
  if (t === "guard" || t.startsWith("keyset")) {
    // A guard is NEVER a literal. The calling convention across Ouronet is a `read-keyset`
    // reference in the code, with the keyset itself in the transaction's `data` under that
    // name -- `(coin.C_UR|TransferAnew "a" "b" (read-keyset "ks") 1.0)`.
    //
    // So this takes the NAME of the data key, not the keyset. Passing `{keys, pred}` is
    // refused rather than serialised: inlining it would type-error at best, and at worst
    // produce something that parses and means something else.
    const name =
      typeof value === "string" ? value
      : value && typeof value === "object" && typeof (value as KeysetRef).readKeyset === "string"
        ? (value as KeysetRef).readKeyset
        : null;
    if (name === null) {
      throw new RegistryError(
        `A \`${t}\` is passed as (read-keyset "<name>"), so this argument is the NAME of the ` +
          `data key -- give "ks" or { readKeyset: "ks" }, and put the keyset itself in the ` +
          `transaction's data under that name. Got ${JSON.stringify(value)}.`,
      );
    }
    return `(read-keyset ${formatString(name)})`;
  }
  if (t === "object" || t.startsWith("object{")) return formatObject(value, t);
  throw new RegistryError(`No rendering rule for declared type "${t}".`);
}
