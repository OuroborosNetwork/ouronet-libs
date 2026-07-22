// @ouronet/ouronet-codex/ui — themeable UI shell for assembled components.
//
// Phase 13 ships the foundation: the `<CodexUiRoot>` token-scope wrapper plus
// the `--codex-*` token contract in `tokens.css` (emitted as
// `@ouronet/ouronet-codex/ui.css`). Phases 14/15 add the visual components
// (tabs, account list, etc.) that style against these tokens via inline
// `style={{ ... var(--codex-*) }}`.
//
// The CSS sheet is a build artifact, not a JS import — consumers load it once
// via `import "@ouronet/ouronet-codex/ui.css"`.

export { CodexUiRoot } from "./CodexUiRoot.js";
export type { CodexUiRootProps } from "./CodexUiRoot.js";

// Phase 14 — assembled, token-styled account tabs.
export { AddressBookTab } from "./tabs/AddressBookTab.js";
export type { AddressBookTabProps } from "./tabs/AddressBookTab.js";
export { PureKeypairsTab } from "./tabs/PureKeypairsTab.js";
export type { PureKeypairsTabProps } from "./tabs/PureKeypairsTab.js";
export { SeedWordsTab } from "./tabs/SeedWordsTab.js";
export type { SeedWordsTabProps } from "./tabs/SeedWordsTab.js";
export { StoaAccountsTab } from "./tabs/StoaAccountsTab.js";
export type { StoaAccountsTabProps } from "./tabs/StoaAccountsTab.js";
export { OuronetAccountsTab } from "./tabs/OuronetAccountsTab.js";
export type { OuronetAccountsTabProps } from "./tabs/OuronetAccountsTab.js";
export { StoicTagDisplay } from "./StoicTagDisplay.js";
export type { StoicTagDisplayProps } from "./StoicTagDisplay.js";
export { CodexLockControl, CodexPasswordPrompt } from "./CodexLockControl.js";
export type { CodexLockControlProps } from "./CodexLockControl.js";
export {
  ObservationalCodexIdSettings,
  ObservationalCodexIdDisplay,
} from "./ObservationalCodexId.js";
export type {
  ObservationalCodexIdSettingsProps,
  ObservationalCodexIdDisplayProps,
  ObservationalCodexIdConfig,
} from "./ObservationalCodexId.js";

// ZBOM (Zone-Based Operation Modal) transaction surface — the seven codex
// operations are now the verbatim-cloned modals in `../zbom/modals/*`, mounted
// directly by `OuronetAccountsTab`. The earlier descriptor-driven shell
// (`ui/zbom/*`) was retired, so nothing is re-exported here.

// Phase 14 — the assembled shell composing all five tabs.
export { CodexTabs } from "./CodexTabs.js";
export type { CodexTabsProps, CodexTabKey } from "./CodexTabs.js";

// Phase 16 — the CodexUI debouncer panel (full MainDebouncer-style read monitor)
// + the read registry, re-surfaced here for consumers importing from `./ui`.
export { CodexDebouncerPanel } from "../zbom/debouncer/CodexDebouncerPanel.js";
export type { CodexDebouncerPanelProps } from "../zbom/debouncer/CodexDebouncerPanel.js";
export { codexClock } from "../zbom/debouncer/codexClock.js";
export { CODEX_READ_REGISTRY } from "../zbom/debouncer/readRegistry.js";
export type { CodexReadFn } from "../zbom/debouncer/readRegistry.js";

// Phase 15 — token-styled Codex Settings section cards (Google Drive sync
// card intentionally excluded — it stays redux-bound in OuronetUI).
export { CodexInfoCard } from "./settings/CodexInfoCard.js";
export type { CodexInfoCardProps } from "./settings/CodexInfoCard.js";
export { ChangePasswordCard } from "./settings/ChangePasswordCard.js";
export type {
  ChangePasswordCardProps,
  ChangePasswordPayload,
} from "./settings/ChangePasswordCard.js";
export { DownloadCodexCard } from "./settings/DownloadCodexCard.js";
export type { DownloadCodexCardProps } from "./settings/DownloadCodexCard.js";
export { EncryptionCard } from "./settings/EncryptionCard.js";
export type { EncryptionCardProps } from "./settings/EncryptionCard.js";
export { ExperimentalCurvesCard } from "./settings/ExperimentalCurvesCard.js";
export type { ExperimentalCurvesCardProps } from "./settings/ExperimentalCurvesCard.js";

// Phase 15 — the NEW v0.3.0 surfaces (Phase-12 hooks; gate gracefully on null).
export { CodexIdentityCard } from "./settings/CodexIdentityCard.js";
export type { CodexIdentityCardProps } from "./settings/CodexIdentityCard.js";
export { CodexGuardCard } from "./settings/CodexGuardCard.js";
export type { CodexGuardCardProps } from "./settings/CodexGuardCard.js";
export { ConsumerSettingsCard } from "./settings/ConsumerSettingsCard.js";
export type { ConsumerSettingsCardProps } from "./settings/ConsumerSettingsCard.js";
export { ZbomSettingsCard } from "./settings/ZbomSettingsCard.js";
export type { ZbomSettingsCardProps } from "./settings/ZbomSettingsCard.js";
export { GasSettingsCard } from "./settings/GasSettingsCard.js";
export type { GasSettingsCardProps } from "./settings/GasSettingsCard.js";
export { DebouncerSettingsCard } from "./settings/DebouncerSettingsCard.js";
export type { DebouncerSettingsCardProps } from "./settings/DebouncerSettingsCard.js";
export { ReadFunctionsCard } from "./settings/ReadFunctionsCard.js";
export type { ReadFunctionsCardProps } from "./settings/ReadFunctionsCard.js";

// Phase 15 — the assembled section composing all eight cards (Google Drive
// sync intentionally excluded).
export { CodexSettingsSection } from "./settings/CodexSettingsSection.js";
export type { CodexSettingsSectionProps } from "./settings/CodexSettingsSection.js";
