import { getEntrypoint } from "./registry.js";
import type { Entrypoint, ExecutionMode, OwnershipClause } from "./types.js";

/** An ordered, human-readable plan for performing one operation correctly. */
export interface CallPlan {
  key: string;
  mode: ExecutionMode;
  /** reads to run BEFORE building the transaction, in no particular order */
  preflight: string[];
  /** the reader that computes required capabilities, if any */
  capabilityReader: string | null;
  /** accounts whose key the caller must be able to sign for */
  mustSignFor: OwnershipClause[];
  /** true when the gas station pays; "step-0-only" for a defpact */
  sponsored: boolean | "step-0-only";
  /** how many transactions this operation takes, when the registry can say */
  transactions: "one" | "many-parallel" | "many-sequential" | "many-continuation";
  /** the single most important thing to get right */
  warnings: string[];
  /** a supported alternative, when this route is not the supported one */
  preferInstead: string | null;
}

/**
 * Everything a consumer must do to perform one operation, in order.
 *
 * Reading the registry field by field is possible but invites cherry-picking: the four
 * launchpad buys need a capability read that has nothing to do with their inputs, the ten
 * defpacts need a continuation whose gas the customer pays, and three pagers must not be
 * fired concurrently. Those facts live in different keys, and a consumer who checks one and
 * not the others gets a transaction that submits and does the wrong thing.
 */
export function planCall(key: string): CallPlan {
  const ep: Entrypoint = getEntrypoint(key);
  const ex = ep.execution;
  const warnings: string[] = [];

  const transactions =
    ex.mode === "defpact"             ? "many-continuation" as const
    : ex.mode === "indirect-parallel" ? "many-parallel"     as const
    : ex.mode === "indirect-sequential" ? "many-sequential" as const
    : "one" as const;

  if (ex.mode === "indirect-sequential")
    warnings.push(
      "STRICTLY ORDERED. Each call advances a stored cursor, so firing pages concurrently " +
        "races it -- submit one, confirm, then the next, until the preflight reports done.",
    );
  if (ex.mode === "indirect-parallel")
    warnings.push(
      "Order-independent: the slices MAY be submitted together. Cut them from the preflight; " +
        "do not invent the partition.",
    );
  if (ex.mode === "defpact") {
    warnings.push(
      `MULTI-TRANSACTION by continuation: ${ex.steps ?? "?"} steps. Step 0 runs on submit; the ` +
        "rest are `cont` payloads against the pact id the first result returns. Submitting once " +
        "and reporting success leaves the operation half-finished.",
    );
    warnings.push(
      "CONTINUATIONS ARE NOT GAS-SPONSORED. Chainweb injects `exec-code` only for `exec` " +
        "payloads, and DALOS.GAS_PAYER reads it eagerly, so it cannot evaluate a `cont`. " +
        "Step 0 is sponsored; the CUSTOMER account pays for every later step.",
    );
  }
  if (ep.externalCaps)
    warnings.push(
      `Requires capabilities beyond GAS_PAYER. Call ${ep.externalCaps.computedBy} and attach ` +
        `what it returns -- do NOT recompute the amounts; they depend on live price and a ` +
        `slippage pad, and a self-derived figure signs a capability the contract will not match.`,
    );
  for (const c of ep.ownership.requires ?? [])
    if (c.when === "CONDITIONAL")
      warnings.push(`Ownership of ${c.account} is CONDITIONAL: ${c.conditionalOn ?? ""}`.trim());
  if (ep.ownership.unmapped?.length)
    warnings.push(
      `Ownership enforces exist deeper in the call tree that the registry could not map to this ` +
        `entrypoint's parameters (${ep.ownership.unmapped.join(", ")}). Treat the list as ` +
        `INCOMPLETE, not as "nothing else is required".`,
    );
  if (!ep.preview)
    warnings.push(`No cost preview exists. ${ep.previewMissing ?? ""}`.trim());

  return {
    key,
    mode: ex.mode,
    preflight: (ex.preflight ?? []).filter((p): p is string => typeof p === "string"),
    capabilityReader: ex.capabilityPreflight ?? null,
    mustSignFor: ep.ownership.requires ?? [],
    sponsored: ep.sponsorship.sponsored,
    transactions,
    warnings,
    preferInstead: ex.preferInstead ?? null,
  };
}

/** Render a plan as text -- for a CLI, a code comment, or a docs page. */
export function explainCall(key: string): string {
  const p = planCall(key);
  const L: string[] = [`${p.key}  [${p.mode}, ${p.transactions} transaction(s)]`];
  if (p.preferInstead) L.push(`  PREFER INSTEAD: ${p.preferInstead}`);
  L.push(`  gas: ${p.sponsored === true ? "sponsored by the Ouronet gas station"
                 : p.sponsored === "step-0-only" ? "step 0 sponsored; continuations paid by the customer"
                 : "NOT sponsored -- the caller pays"}`);
  if (p.preflight.length) L.push(`  preflight: ${p.preflight.join(", ")}`);
  if (p.capabilityReader) L.push(`  capabilities from: ${p.capabilityReader}`);
  if (p.mustSignFor.length) {
    L.push("  must sign for:");
    for (const c of p.mustSignFor) L.push(`    - ${c.account} [${c.when}] -- ${c.meaning}`);
  }
  for (const w of p.warnings) L.push(`  ! ${w}`);
  return L.join("\n");
}
