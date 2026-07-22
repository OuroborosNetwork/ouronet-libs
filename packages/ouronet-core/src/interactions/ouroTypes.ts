/**
 * ouroTypes.ts
 * Cross-cutting interface and type-alias definitions for the ouro entity files.
 * Sole non-local re-export: IKadenaKeypair from @stoachain/stoa-core/signing.
 */

export type { IKadenaKeypair } from "@stoachain/stoa-core/signing";

import type { IKadenaKeypair } from "@stoachain/stoa-core/signing";

export interface AccountSelectorData {
  readonly "iz-activated": boolean;
  readonly "ouronet-account": string;
  readonly "ouronet-account-guard": any; // IKeyset or false
  readonly "iz-smart": boolean | number; // true/false/-1
  readonly "ouro-balance": number;
  readonly "ignis-balance": number;
  readonly "payment-key-existance": boolean;
  readonly "payment-key": string;
  readonly "payment-key-balance": number;
  readonly "payment-key-guard": any;
  readonly "ignis-discount": any;
  readonly "stoa-discount": any;
  /**
   * On-chain public key for the account — the long base-49 string in the
   * DALOS `{prefixLenBase49}.{xyBase49}` format. Populated for both
   * Standard (Ѻ.) and Smart (Σ.) accounts. **This is the on-chain source
   * of truth** and is expected to match the codex-stored `publicKey` for
   * any account created through the standard flow. A mismatch would
   * indicate either (a) an admin-level key rotation performed on chain
   * (designed as a last-resort correction tool), or (b) a corrupted
   * codex entry. Added in ouronet-core v1.4.0 alongside the
   * `URC_0027_AccountSelectorMapper` Pact-side extension.
   */
  readonly "public-key": string;
  /**
   * Sovereign — only populated for Smart accounts (iz-smart = true). The
   * Ѻ. Standard Ouronet Account that has sovereignty over this Smart
   * account; proving ownership of the sovereign proves ownership of the
   * Smart account's `sovereign` authorization path. Pact returns `false`
   * for Standard accounts and unactivated accounts. Added in v1.4.0.
   */
  readonly "sovereign": string | false;
  /**
   * Governor — only populated for Smart accounts. A Pact guard used for
   * complex custom authorization logic (capability guards, module guards,
   * user guards, or additional keyset arrangements). For Smart accounts
   * where no custom governor has been set, this equals the account's own
   * `ouronet-account-guard`. Pact returns `false` for Standard accounts
   * and unactivated accounts. Added in v1.4.0.
   */
  readonly "governor": any | false; // IKeyset / capability / module guard / false
  /**
   * Stoic Tag — the human-readable alias attached to this Ouronet account.
   *   `stoic-tag-has`            true when the account has an active tag.
   *   `stoic-tag`                the tag name, or the literal sentinel
   *                              "No StoicTag yet" when none. Consumers MUST
   *                              gate on `stoic-tag-has`, never the string.
   *   `stoic-tag-registered-at`  block time at registration; `false` if none.
   */
  readonly "stoic-tag-has": boolean;
  readonly "stoic-tag": string;
  readonly "stoic-tag-registered-at": unknown; // Pact time, or false
}

/**
 * Inverse StoicTag read — one row per queried tag name, from
 * `URC_0027c_StoicTagSelectorSingle` (and the batch `URC_0027b_…Mapper`).
 * Powers Address Book StoicTag entries, which watch a tag independently of
 * any codex account.
 */
export interface StoicTagSelectorData {
  readonly "stoic-tag": string;            // the queried tag name
  readonly "iz-row-exists": boolean;       // row present (active OR released)
  readonly "iz-active": boolean;           // currently bound to an account
  readonly "iz-released": boolean;         // row exists but no longer active
  readonly "iz-never-registered": boolean; // no row at all
  readonly "ouronet-account": string;      // bound Ѻ. account, or "BAR"
  readonly "registered-at": unknown;       // Pact time, or false
}

export interface StoaAccountSelectorData {
  readonly "iz-activated": boolean;
  readonly "account": string;
  readonly "balance": number;
  readonly "guard": any;
}

export interface AccountOverviewData {
  readonly "global-administrative-pause": boolean;
  readonly "iz-selected-activated": boolean;
  readonly "stoa-costs": number;
}

// Interface definitions for keypair types
export interface IOuroAccountKeypair {
  readonly address: string;
  readonly publicKey: string;
  readonly privateKey?: string;
}

export interface UnwrapStoaParams {
  readonly patronAddress: string;
  readonly unwrapperAddress: string;
  readonly amount: string;          // pre-formatted decimal string (formatDecimalForPact)
  readonly numAmount: number;       // numeric value (for coin.TRANSFER capability param)
  readonly targetAddress: string;
  readonly targetExists: boolean;   // true = Case 2, false = Case 1 (new k: creation)
  readonly gasStationKey: IKadenaKeypair;
  readonly patronGuardKeys: IKadenaKeypair[];
  readonly accountGuardKeys: IKadenaKeypair[];
}

export interface UnwrapUrStoaParams {
  readonly patronAddress: string;
  readonly unwrapperAddress: string;
  readonly amount: string;
  readonly targetAddress: string;
  readonly targetExists: boolean;
  readonly gasStationKey: IKadenaKeypair;
  readonly patronGuardKeys: IKadenaKeypair[];
  readonly accountGuardKeys: IKadenaKeypair[];
}
