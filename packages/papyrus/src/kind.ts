/**
 * THE PAPYRUS FAMILY — the members, the engine version, and the copy for each.
 *
 * Owner, 2026-10-28: *"we should be designating each instance so that it is recognised as such —
 * Papyrus Leaf, Papyrus Page, Papyrus Roll, and beneath it somewhere on the page, the package
 * version of papyrus, so that the users instantly know 'aha, this is a Papyrus Leaf'."*
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * THE THREE MEMBERS
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * All three answer the same question — *what am I about to sign, and what does it cost* — and
 * differ in HOW the arguments got there and WHERE the instrument is presented.
 *
 *   PAGE   A discrete sheet, presented for signing. Zones 0-3, the cost rectangle, the four
 *          button stages. The user supplies or confirms each input. 23 instances.
 *
 *   ROLL   The same zones UNROLLED DOWN THE PAGE rather than in a popup — always visible beside
 *          the thing it prices, taking its inputs from the panel next to it. Swap and Add
 *          Liquidity. 2 instances.
 *
 *   LEAF   NEWEST MEMBER, named 2026-10-28. No zones at all. A progress popup over live DIRTY
 *          READS: the transaction is DISCOVERED from the chain rather than typed, out of inputs
 *          captured before it opened, and then signed. Smart Swap is the first — the route, the
 *          Liquid Boost valuation path and one pricing path per pool are all found by `/local`
 *          reads, and only once a route exists can the user be told what it costs.
 *
 *          A LEAF IS NOT A SPINNER. Every line it shows is a read that really ran, with the
 *          elapsed time measured rather than animated. That is why it earns a name instead of
 *          being "the swap's loading state": the reads ARE the drafting of the instrument.
 *
 *          Owner, on keeping it separate rather than folding it into a Page: *"we could integrate
 *          that in a Papyrus Page, but we could keep it as the newly introduced member, the
 *          Papyrus Leaf. Because i think we'll have further uses for this down the road."*
 *
 * SPLIT FROM THE BADGE so this module exports no component: a file mixing a component with
 * constants defeats Vite's fast refresh for every consumer of it (`react-refresh/only-export-
 * components`), and `PAPYRUS_VERSION` is imported by tests and will be imported by the package.
 * `PapyrusBadge.tsx` beside this file renders them.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * WHY A VISIBLE BADGE AND NOT JUST A TYPE
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * Two reasons, and the second is the one that pays.
 *
 * 1. A user who recognises the form knows what to expect of it — a Leaf will decide the cost
 *    only after it has finished reading, so a Leaf showing no price yet is CORRECT, while a Page
 *    showing no price is a failed preview.
 * 2. It makes the migration VISIBLE. Three implementations of this engine existed for a year
 *    without anyone noticing, because nothing on screen said which one you were in. A badge
 *    naming the member and the version means a screen running the old path is identifiable by
 *    looking at it, which is the cheapest possible audit.
 */
/**
 * THE PAPYRUS VERSION, in ONE place.
 *
 * THIS FILE IS NOW THE PACKAGE'S, which is what the `-pre` suffix was waiting for. While the
 * constant lived in OuronetUI it described a local artefact and said so; here it describes a
 * published one, so a badge rendering it names something a reader can actually install.
 *
 * KEEP IT IN STEP WITH `package.json` BY HAND, and the alternative was worse: importing the
 * manifest needs `resolveJsonModule` plus a bundler that will inline it for every consumer, and
 * a version that silently becomes `undefined` in one consumer's build is harder to notice than
 * one that is merely stale. `tests/version.test.ts` compares the two, so the hand-kept copy
 * cannot drift.
 *
 * It is DELIBERATELY NOT `APP_VERSION`. The whole point of the badge is to distinguish the engine
 * from the app that hosts it — once Codex consumes Papyrus too, two apps will show the same
 * Papyrus version and different app versions, and that is the fact a user needs.
 */
export const PAPYRUS_VERSION = "0.1.0";

export type PapyrusKind = "page" | "roll" | "leaf";

export const PAPYRUS_COPY: Readonly<Record<PapyrusKind, { label: string; blurb: string }>> = {
  page: {
    label: "Papyrus Page",
    blurb:
      "A discrete sheet presented for signing. Its zones name the patron, every input with the "
      + "type the contract declares for it, and the signers; the cost rectangle prices the call "
      + "live before you are asked for a password.",
  },
  roll: {
    label: "Papyrus Roll",
    blurb:
      "The same instrument unrolled down the page instead of in a popup — always visible beside "
      + "the panel it prices, and taking its inputs from it as you change them.",
  },
  leaf: {
    label: "Papyrus Leaf",
    blurb:
      "A live reading, not a spinner. Each line is a real dirty read against the chain, timed as "
      + "it happens, discovering the transaction rather than asking you to type it — out of "
      + "inputs you captured before it opened. Only once the route exists can it be priced, so a "
      + "Leaf with no cost yet is still working, not broken.",
  },
};
