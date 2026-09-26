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

/** Pact object literal: `{ "k": v, ... }`. Keys are always quoted strings. */
function formatObject(v: unknown, type: string): string {
  if (v === null || typeof v !== "object" || Array.isArray(v))
    throw new RegistryError(`Expected an object for ${type}, got ${JSON.stringify(v)}`);
  const body = Object.entries(v as Record<string, unknown>)
    .map(([k, val]) => `${formatString(k)}: ${formatLoose(val)}`)
    .join(", ");
  return `{ ${body} }`;
}

/** Best-effort for values inside an untyped object, where no declared type is available. */
function formatLoose(v: unknown): string {
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
