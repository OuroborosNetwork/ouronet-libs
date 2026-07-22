/**
 * CodexSettingsSection — the assembled, token-styled Codex Settings panel.
 *
 * Organised into four pill-selected subtabs (one bucket visible at a time),
 * mirroring OuronetUI's `app-settings` subtab pattern so the page stays focused
 * instead of one long scroll:
 *   • Operations        — ZBOM defaults (patron / zone expansion / execute) + gas reference
 *   • Security          — password change / auto-lock / encryption upgrade / codex guard
 *   • Identity & Backup — codex identity, observational CodexID, codex download, info
 *   • Advanced          — consumer settings + experimental curves
 *
 * The Google Drive sync card is intentionally excluded (it stays
 * redux/localStorage-bound in OuronetUI). The card-owned consumer seams
 * (`onChangePassword`, `onUpgradeEncryption`) thread through as section props —
 * the package never re-encrypts or rotates passwords itself; it delegates to
 * the host app. All visual structure uses `--codex-*` tokens. No Redux, no
 * wallet-context. The subtab state lives here, so the package owns its own
 * settings navigation (the consumer mounts <CodexSettingsSection/> as a leaf).
 */

import { useState, type CSSProperties } from "react";
import { CodexInfoCard } from "./CodexInfoCard.js";
import {
  ChangePasswordCard,
  type ChangePasswordPayload,
} from "./ChangePasswordCard.js";
import { DownloadCodexCard } from "./DownloadCodexCard.js";
import { EncryptionCard } from "./EncryptionCard.js";
import { ExperimentalCurvesCard } from "./ExperimentalCurvesCard.js";
import { CodexIdentityCard } from "./CodexIdentityCard.js";
import { CodexGuardCard } from "./CodexGuardCard.js";
import { ConsumerSettingsCard } from "./ConsumerSettingsCard.js";
import { PasswordCacheCard } from "./PasswordCacheCard.js";
import { ZbomSettingsCard } from "./ZbomSettingsCard.js";
import { GasSettingsCard } from "./GasSettingsCard.js";
import { DebouncerSettingsCard } from "./DebouncerSettingsCard.js";
import { ReadFunctionsCard } from "./ReadFunctionsCard.js";
import { ObservationalCodexIdSettings } from "../ObservationalCodexId.js";

export interface CodexSettingsSectionProps {
  /** Re-encryption seam forwarded to <ChangePasswordCard>. The package hands
   *  over a validated {currentPassword,newPassword} pair; the host owns the
   *  crypto + persistence. */
  onChangePassword?: (payload: ChangePasswordPayload) => Promise<void> | void;
  /** V1→V2 upgrade seam forwarded to <EncryptionCard>. */
  onUpgradeEncryption?: () => Promise<void> | void;
  /** Consumer registry key for the embedded <ConsumerSettingsCard>. Defaults
   *  to "OuronetUI". */
  consumerName?: string;
  /** Subtab open on first render. Defaults to "operations". */
  initialTab?: SettingsTab;
  /** Consumer class merged onto the section root. */
  className?: string;
}

type SettingsTab =
  | "operations"
  | "debouncer"
  | "read-functions"
  | "security"
  | "identity"
  | "advanced";

const TABS: { key: SettingsTab; label: string; color: string }[] = [
  { key: "operations", label: "Operations", color: "#ceac5f" },
  { key: "debouncer", label: "Debouncer", color: "#ec4899" },
  { key: "read-functions", label: "Read Functions", color: "#06b6d4" },
  { key: "security", label: "Security", color: "#22c55e" },
  { key: "identity", label: "Identity & Backup", color: "#8b5cf6" },
  { key: "advanced", label: "Advanced", color: "#f59e0b" },
];

/** Responsive auto-fit grid used to lay out the small action cards in a tab.
 *  `alignItems: stretch` makes every card in a row share the tallest card's
 *  height — so the rectangles line up cleanly instead of looking ragged. */
function cardGrid(min: number): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
    gap: "12px",
    alignItems: "stretch",
  };
}

export function CodexSettingsSection({
  onChangePassword,
  onUpgradeEncryption,
  consumerName = "OuronetUI",
  initialTab = "operations",
  className,
}: CodexSettingsSectionProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        fontFamily: "var(--codex-font)",
        color: "var(--codex-text)",
      }}
    >
      {/* ── Subtab pill bar ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {TABS.map(({ key, label, color }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                border: `1px solid ${active ? color : "var(--codex-border)"}`,
                backgroundColor: active ? `${color}1a` : "transparent",
                color: active ? color : "var(--codex-text-dim)",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Operations ── ZBOM defaults + gas reference. */}
      {tab === "operations" && (
        <div style={cardGrid(300)}>
          <ZbomSettingsCard />
          <GasSettingsCard />
        </div>
      )}

      {/* ── Debouncer ── the live read monitor + the tier explainer. */}
      {tab === "debouncer" && <DebouncerSettingsCard />}

      {/* ── Read Functions ── the CodexUI's on-chain read registry + live status. */}
      {tab === "read-functions" && <ReadFunctionsCard />}

      {/* ── Security ── password change / encryption upgrade / codex guard,
          with the auto-lock duration in its own labelled box. */}
      {tab === "security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={cardGrid(220)}>
            <ChangePasswordCard onChangePassword={onChangePassword} />
            <EncryptionCard onUpgradeEncryption={onUpgradeEncryption} />
            <CodexGuardCard />
          </div>
          <div
            style={{
              borderRadius: "var(--codex-radius)",
              border: "1px solid var(--codex-border)",
              padding: "16px",
            }}
          >
            <PasswordCacheCard />
          </div>
        </div>
      )}

      {/* ── Identity & Backup ── identity card, observational CodexID preview,
          codex download, and the read-only info card. */}
      {tab === "identity" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={cardGrid(240)}>
            <CodexIdentityCard />
            <DownloadCodexCard />
          </div>
          <div
            style={{
              borderRadius: "var(--codex-radius)",
              border: "1px solid #22c55e40",
              padding: "16px",
            }}
          >
            <ObservationalCodexIdSettings />
          </div>
          <CodexInfoCard />
        </div>
      )}

      {/* ── Advanced ── consumer-namespaced settings + experimental curves. */}
      {tab === "advanced" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <ConsumerSettingsCard consumerName={consumerName} />
          <div
            style={{
              borderRadius: "var(--codex-radius)",
              border: "1px solid var(--codex-warning)",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--codex-warning)",
                }}
              >
                Experimental Curves
              </span>
              <span
                style={{
                  fontSize: "10px",
                  padding: "1px 8px",
                  borderRadius: "999px",
                  color: "var(--codex-warning)",
                  border: "1px solid var(--codex-warning)",
                }}
              >
                observational
              </span>
            </div>
            <ExperimentalCurvesCard />
          </div>
        </div>
      )}
    </div>
  );
}

export default CodexSettingsSection;
