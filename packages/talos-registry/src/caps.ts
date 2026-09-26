import { getEntrypoint, RegistryError } from "./registry.js";

/** One capability, parsed out of what a capability reader returned. */
export interface ParsedCapability {
  /** fully-qualified, e.g. `coin.TRANSFER` */
  name: string;
  /** positional arguments, already typed for a Kadena signer */
  args: (string | { decimal: string })[];
}

/**
 * Parse the strings a capability reader returns.
 *
 * `URC_Acquire` returns `[string]`, each wrapped in angle brackets:
 *
 *     <(coin.TRANSFER "from" "to" 9.595000000000)>
 *
 * The brackets are the contract's own quoting; they are not part of the capability. Parsing
 * this by hand is where a consumer drops a leg and signs for less than the transaction moves.
 */
export function parseCapability(raw: string): ParsedCapability {
  const cleaned = raw.replace(/^\s*<\s*/, "").replace(/\s*>\s*$/, "").trim();
  const m = cleaned.match(/^\(([^\s()]+)\s+"([^"]*)"\s+"([^"]*)"\s+([\d.]+)\)$/);
  if (!m) {
    throw new RegistryError(
      `Unrecognised capability string: ${raw}\n` +
        `  expected: <(NAME "from" "to" amount)>`,
    );
  }
  const [, name, from, to, amount] = m as unknown as [string, string, string, string, string];
  return { name, args: [from, to, { decimal: amount }] };
}

export function parseCapabilities(raws: readonly string[]): ParsedCapability[] {
  return raws.map(parseCapability);
}

/** What a caller must do to obtain this entrypoint's extra capabilities. */
export interface CapabilityRecipe {
  reader: string;
  /** reader parameter -> where its value comes from */
  argsFrom: Record<string, string>;
  readerParams: { name: string; type: string }[];
  attachTo: string;
  note: string;
}

/**
 * The recipe for an entrypoint's required capabilities, or null when GAS_PAYER is enough.
 *
 * Only four entrypoints need this -- the launchpad buys -- and the reader that computes them
 * lives on the SALE module, not on the Talos module the entrypoint belongs to. Looking in the
 * entrypoint's own module finds nothing, which reads as "no capabilities required" rather than
 * as a failed lookup.
 */
export function capabilityRecipe(key: string): CapabilityRecipe | null {
  const ec = getEntrypoint(key).externalCaps;
  if (!ec) return null;
  return {
    reader: ec.computedBy,
    argsFrom: ec.argsFrom,
    readerParams: ec.readerParams,
    attachTo: ec.attachTo,
    note: ec.note,
  };
}
