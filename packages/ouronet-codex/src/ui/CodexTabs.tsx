/**
 * CodexTabs — the assembled shell composing the five account tabs into a single
 * switcher. Drop it inside a <CodexProvider> (and, for theming, a <CodexUiRoot>)
 * and it renders the whole Codex management surface.
 *
 * The tab strip mirrors My Codex's big bordered icon tiles (rounded-xl, border-2,
 * h-10 icons, gold active fill — violet for Pure Key Pairs), inline-styled so the
 * package needs no Tailwind. OURO/WSTOA image icons are substituted with lucide
 * equivalents to keep the package asset-free.
 */

import * as React from "react";
import { useState } from "react";
import { Atom, Sprout, KeySquare, BookOpen } from "lucide-react";
import { OuronetAccountsTab } from "./tabs/OuronetAccountsTab.js";
import { SeedWordsTab } from "./tabs/SeedWordsTab.js";
import { PureKeypairsTab } from "./tabs/PureKeypairsTab.js";
import { StoaAccountsTab } from "./tabs/StoaAccountsTab.js";
import { AddressBookTab } from "./tabs/AddressBookTab.js";

type IconProps = { style?: React.CSSProperties; strokeWidth?: number };

/** Stoa Accounts logo — the Stoa rhombus as the ❖ glyph (a diamond divided by an
 *  X into four petals), matching the StoaChain mark. Custom SVG so it's the brand
 *  shape, not a generic gem. */
function StoaDiamond({ style, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" style={style} aria-hidden>
      <path d="M12 1.5 L22.5 12 L12 22.5 L1.5 12 Z" />
      <path d="M6.75 6.75 L17.25 17.25 M17.25 6.75 L6.75 17.25" />
    </svg>
  );
}

export type CodexTabKey =
  | "ouronet-accounts"
  | "seed-words"
  | "pure-keypairs"
  | "stoa-accounts"
  | "address-book";

interface TabDef {
  key: CodexTabKey;
  label: string;
  Icon: React.ComponentType<IconProps>;
  accent: string;
}

// Per-tab logo colour: Ouronet blue · Seed Words green · Pure Key Pairs purple ·
// Stoa Accounts gold-yellow · Address Book white.
const TAB_ORDER: TabDef[] = [
  { key: "ouronet-accounts", label: "Ouronet Accounts", Icon: Atom, accent: "#3b82f6" },
  { key: "seed-words", label: "Seed Words", Icon: Sprout, accent: "#22c55e" },
  { key: "pure-keypairs", label: "Pure Key Pairs", Icon: KeySquare, accent: "#a78bfa" },
  { key: "stoa-accounts", label: "Stoa Accounts", Icon: StoaDiamond, accent: "#ceac5f" },
  { key: "address-book", label: "Address Book", Icon: BookOpen, accent: "#e8e8ea" },
];

export interface CodexTabsProps {
  className?: string;
  /** Tab shown on first render. Defaults to "ouronet-accounts". */
  defaultTab?: CodexTabKey;
}

export function CodexTabs({ className, defaultTab = "ouronet-accounts" }: CodexTabsProps) {
  const [active, setActive] = useState<CodexTabKey>(defaultTab);

  return (
    <div
      className={className}
      style={{
        fontFamily: "var(--codex-font, inherit)",
        color: "var(--codex-text)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Big bordered icon tabs */}
      <div
        role="tablist"
        aria-label="Codex sections"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: "16px",
        }}
      >
        {TAB_ORDER.map(({ key, label, Icon, accent }) => {
          const selected = active === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "12px",
                border: `2px solid ${selected ? accent : "#262626"}`,
                backgroundColor: selected ? accent : "#0a0a0a",
                color: selected ? "#0a0a0a" : "#d2d3d4",
                cursor: "pointer",
                transition: "all 0.2s",
                fontWeight: 600,
              }}
            >
              <Icon style={{ width: 40, height: 40, flexShrink: 0, color: selected ? "#0a0a0a" : accent }} strokeWidth={1.5} />
              <span style={{ fontWeight: 600 }}>{label}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active === "ouronet-accounts" && <OuronetAccountsTab />}
        {active === "seed-words" && <SeedWordsTab />}
        {active === "pure-keypairs" && <PureKeypairsTab />}
        {active === "stoa-accounts" && <StoaAccountsTab />}
        {active === "address-book" && <AddressBookTab />}
      </div>
    </div>
  );
}

export default CodexTabs;
