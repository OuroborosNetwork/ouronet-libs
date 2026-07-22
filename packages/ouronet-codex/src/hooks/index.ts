// @ouronet/ouronet-codex/hooks
//
// Public React hooks consumers use to interact with the codex.
//
// Inventory (per spec §5.2 + Phase 5 useWatchList addition):
//   - useCodex()             high-level Codex state + actions
//   - useActiveWallet()      active kadena/ouro wallet + switch
//   - useGetKeypair()        pubkey → IKadenaKeypair (throws CodexKeyMissingError)
//   - useSignTransaction()   CFM strategy wrapper (replaces useCFMStrategy)
//   - useCodexAuth()         password prompts, lock/unlock
//   - useKadenaSeeds()       CRUD
//   - usePureKeypairs()      CRUD
//   - useOuroAccounts()      CRUD (CodexPrime is protected)
//   - useAddressBook()       CRUD
//   - useWatchList()         CRUD (Phase 5 addition, not in spec §5.2)
//   - useCodexBackup()       download / import / cloud-export helpers
//   - useCodexLifecycle()    kickstart / recover (v0.2.0+; spec §5.2/§5.3)

export { useCodex } from "./useCodex.js";
export type { CodexView } from "./useCodex.js";

export { useActiveWallet } from "./useActiveWallet.js";
export type { ActiveWalletView } from "./useActiveWallet.js";

export { useCodexAuth } from "./useCodexAuth.js";
export type { CodexAuthView } from "./useCodexAuth.js";

export { useRequestPassword } from "./useRequestPassword.js";
export type { RequestPasswordFn } from "./useRequestPassword.js";

export { useGetKeypair } from "./useGetKeypair.js";
export type { GetKeypairFn } from "./useGetKeypair.js";

export { useSignTransaction } from "./useSignTransaction.js";
export type {
  SignTransactionView,
  UseSignTransactionOptions,
} from "./useSignTransaction.js";

export { useKadenaSeeds } from "./useKadenaSeeds.js";
export type { KadenaSeedsView } from "./useKadenaSeeds.js";

export { usePureKeypairs } from "./usePureKeypairs.js";
export type { PureKeypairsView } from "./usePureKeypairs.js";

export { useOuroAccounts } from "./useOuroAccounts.js";
export type { OuroAccountsView } from "./useOuroAccounts.js";

export { useAddressBook } from "./useAddressBook.js";
export type { AddressBookView } from "./useAddressBook.js";

export { useWatchList } from "./useWatchList.js";
export type { WatchListView } from "./useWatchList.js";

export { useCodexBackup } from "./useCodexBackup.js";
export type { CodexBackupView } from "./useCodexBackup.js";

export { useCodexLifecycle } from "./useCodexLifecycle.js";
export type { CodexLifecycleView } from "./useCodexLifecycle.js";

export { useCodexIdentity } from "./useCodexIdentity.js";
export type { CodexIdentityView } from "./useCodexIdentity.js";

export { useCodexGuard } from "./useCodexGuard.js";
export type { CodexGuardView } from "./useCodexGuard.js";

export { useConsumerSettings } from "./useConsumerSettings.js";
export type { ConsumerSettingsView } from "./useConsumerSettings.js";
