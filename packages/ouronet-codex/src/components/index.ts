// @ouronet/ouronet-codex/components
//
// Headless React components consumers theme with their own design tokens.
// Each accepts className + render-prop slots; no CSS dependencies.
//
// Phase 6a shipped (this version):
//   - <PasswordModal>             observes pendingPasswordRequest slice
//   - <BackupRestorePanel>        download codex JSON / restore from file
//   - <AddPureKeypairForm>        import a raw private key as foreign key
//   - <ActiveWalletPicker>        switch between kadena seeds / accounts
//   - <CodexInfoPanel>            read-only stats (counts of each entity)
//
// Phase 6b will add (after the atomic-triplet bump to 4.3.0 lands the
// missing rotation Pact builders):
//   - <RotateGuardModal>          CFM modal for ouro-account guard rotation
//   - <RotatePaymentKeyModal>     CFM modal for payment-key rotation
//   - <RotateSovereignModal>      CFM modal for smart-account sovereign
//
// <RotateGovernorModal> is deferred post-OuronetUI-migration (chain side
// exposes the Pact function but no consumer surface ships it yet).

export { PasswordModal } from "./PasswordModal.js";
export type {
  PasswordModalProps,
  PasswordModalRenderArgs,
} from "./PasswordModal.js";

export { BackupRestorePanel } from "./BackupRestorePanel.js";
export type {
  BackupRestorePanelProps,
  BackupRestoreRenderArgs,
} from "./BackupRestorePanel.js";

export { AddPureKeypairForm } from "./AddPureKeypairForm.js";
export type {
  AddPureKeypairFormProps,
  AddPureKeypairRenderArgs,
} from "./AddPureKeypairForm.js";

export { ActiveWalletPicker } from "./ActiveWalletPicker.js";
export type {
  ActiveWalletPickerProps,
  ActiveWalletPickerRenderArgs,
} from "./ActiveWalletPicker.js";

export { CodexInfoPanel } from "./CodexInfoPanel.js";
export type {
  CodexInfoPanelProps,
  CodexInfoRenderArgs,
} from "./CodexInfoPanel.js";

// Phase 6b — headless rotation modals (consume the new v4.3.0 rotation builders)

export { RotateSovereignModal } from "./RotateSovereignModal.js";
export type {
  RotateSovereignModalProps,
  RotateSovereignRenderArgs,
} from "./RotateSovereignModal.js";

export { RotatePaymentKeyModal } from "./RotatePaymentKeyModal.js";
export type {
  RotatePaymentKeyModalProps,
  RotatePaymentKeyRenderArgs,
} from "./RotatePaymentKeyModal.js";

export { RotateGuardModal } from "./RotateGuardModal.js";
export type {
  RotateGuardModalProps,
  RotateGuardRenderArgs,
  RotateGuardMode,
  RotateGuardPred,
} from "./RotateGuardModal.js";
