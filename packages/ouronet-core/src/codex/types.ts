/**
 * PlaintextCodex — the portable shape of an Ouronet user's in-memory
 * codex state. Consumers decide the concrete element types for each list
 * via generics (OuronetUI plugs in its IKadenaSeed / IOuroAccount / etc;
 * the future HUB can supply its own if it prefers, or reuse UI's via a
 * shared `@ouronet/shared-types` package later).
 *
 * Why generic? Because the codec (serialize / deserialize) and any other
 * core-side consumer only cares about the SHAPE — "there are N wallets,
 * M accounts, K pure keypairs, an address book, and some ui settings".
 * The field contents are consumer-defined. Generics let the type carry
 * information without forcing core to own every wallet-domain type.
 *
 * Default type params are `unknown` so downstream code that doesn't need
 * field-level types still works — `PlaintextCodex` with no args treats
 * each list as `unknown[]`, which TypeScript allows assignment TO but
 * nothing structured FROM (exactly right for a generic serializer).
 */

export interface PlaintextCodex<
  KadenaSeed       = unknown,
  OuroAccount      = unknown,
  PureKeypair      = unknown,
  AddressBookEntry = unknown,
  UiSettings       = unknown,
> {
  /** HD seeds (koala / chainweaver / eckowallet variants) known to this codex. */
  readonly kadenaWallets: KadenaSeed[];
  /** Resident OURO accounts the user controls. */
  readonly ouronetWallets: OuroAccount[];
  /** Address-book entries (cached or user-added). */
  readonly addressBook: AddressBookEntry[];
  /** Raw pure Pact keypairs stored directly (encrypted privateKey). */
  readonly pureKeypairs: PureKeypair[];
  /** Non-sensitive UI preferences (dock position, zone state, etc). */
  readonly uiSettings: UiSettings;

  /**
   * Schema version of this codex. `0` = pre-upgrade V1-encrypted; `1+` =
   * post-upgrade V2-encrypted. Consumers can read this to decide whether
   * to run the encryption upgrade on unlock.
   */
  readonly schemaVersion: number;
  /** ISO timestamp of the last write to this codex (across any device). */
  readonly lastUpdatedAt: string | null;
  /** Which device family last wrote — used for dev/main cross-sync UX. */
  readonly lastUpdatedDevice: "dev" | "main";
}

/**
 * The exported-backup JSON shape (`version: "1.2"` — the historical string
 * that OuronetUI has written since well before the extraction began).
 *
 * A codex backup is a subset of PlaintextCodex: no schemaVersion /
 * lastUpdatedAt / lastUpdatedDevice (those are device-local), and no
 * pureKeypairs in this historical shape (they ship inside `cloud-backup`
 * alongside user settings — see the `downloadAsJson` → `exportForCloud`
 * split in OuronetUI's LocalStorageCodexAdapter). The `"1.2"` label
 * stays because a bump would break every existing user's recovery file.
 */
export interface CodexExportV1_2<
  KadenaSeed       = unknown,
  OuroAccount      = unknown,
  AddressBookEntry = unknown,
  UiSettings       = unknown,
> {
  readonly version: "1.2";
  readonly exportedAt: string;
  readonly kadenaWallets: KadenaSeed[];
  readonly ouronetWallets: OuroAccount[];
  readonly addressBook: AddressBookEntry[];
  readonly uiSettings: UiSettings;
}

/**
 * A single foreign (cross-chain) key entry inside a `foreignKeys` block. The
 * `encryptedKeyfile` is already-encrypted at rest — this envelope only carries
 * the ciphertext, never a plaintext key.
 *
 * This mirrors the codex-core (`@ancientpantheon`) V1_3 foreign-key shape by
 * VALUE, not by import: the two orgs share no dependency edge, so the shape is
 * an intentionally-duplicated peer kept structurally identical by hand.
 */
export interface CodexForeignKeyV1_3 {
  readonly id: string;
  readonly label?: string;
  readonly chainId: string;
  readonly encryptedKeyfile: string;
}

/** The optional `foreignKeys` block on a 1.3 envelope. */
export interface CodexForeignKeysBlockV1_3 {
  readonly schemaVersion: 1;
  readonly keys: readonly CodexForeignKeyV1_3[];
}

/**
 * The exported-backup JSON shape at `version: "1.3"`. Structurally identical to
 * `CodexExportV1_2` except for the version literal and an OPTIONAL `foreignKeys`
 * block. The bump was made under reader-before-writer discipline: the reader
 * (`deserializeCodex`) was widened to accept "1.3" and to allow-list the
 * `foreignKeys` field BEFORE the writer began stamping "1.3".
 *
 * ouronet's `PlaintextCodex` has no foreign-key source field, so the live
 * writer emits `foreignKeys`-ABSENT (a bare 1.3 envelope). The block is typed
 * as optional so the writer can emit it if a source is ever wired up, without a
 * mandatory empty-block lie on every export.
 */
export interface CodexExportV1_3<
  KadenaSeed       = unknown,
  OuroAccount      = unknown,
  AddressBookEntry = unknown,
  UiSettings       = unknown,
> {
  readonly version: "1.3";
  readonly exportedAt: string;
  readonly kadenaWallets: KadenaSeed[];
  readonly ouronetWallets: OuroAccount[];
  readonly addressBook: AddressBookEntry[];
  readonly uiSettings: UiSettings;
  readonly foreignKeys?: CodexForeignKeysBlockV1_3;
}
