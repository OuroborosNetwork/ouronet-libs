/**
 * CreateKadenaSeedModal — Stoic path tests.
 *
 * `KadenaWalletBuilder.createWalletPairFromDalosBitString` is a real,
 * agreed `@stoachain/stoa-core` method that has NOT been published to npm
 * yet — see `src/wallet/stoicDalosBridge.ts`'s file-level "TEMPORARY" doc
 * for the full context. The installed `@stoachain/stoa-core` (4.4.0, pin
 * `>=4.3.0`) genuinely does not have this method, so unlike this repo's
 * other `KadenaWalletBuilder`-touching tests (`ui-seed-words-tab.test.tsx`,
 * `resolver-internal.test.ts` — both of which deliberately use REAL crypto
 * per their own doc comments), there is no real implementation to exercise
 * here. It's monkeypatched directly onto the real class for this file's
 * duration — the only viable "mock" for a not-yet-shipped static method
 * (there's no existing `vi.mock`-of-`KadenaWalletBuilder` convention in
 * this repo to follow, since every other file that touches it uses real
 * crypto).
 *
 * `seedWordsToBitString` (from `@ouronet/dalos-crypto/gen1`) and
 * `smartEncrypt`/`smartDecrypt` (from `@stoachain/stoa-core/crypto`) ARE
 * real in these tests — only the not-yet-published stoa-core method is
 * stubbed.
 */
import * as React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { smartEncrypt, smartDecrypt } from "@stoachain/stoa-core/crypto";
import { KadenaWalletBuilder } from "@stoachain/stoa-core/wallet";

import { CodexProvider } from "@ouronet/ouronet-codex/provider";
import { MemoryCodexAdapter } from "@ouronet/ouronet-codex/adapters";
import { useCodex, useKadenaSeeds, useOuroAccounts, useCodexAuth } from "@ouronet/ouronet-codex/hooks";
import { SeedWordsTab } from "@ouronet/ouronet-codex/ui";
import type { IKadenaSeed, IOuroAccount } from "@ouronet/ouronet-codex/types";

const PASSWORD = "hunter2-stoic-test";
const SEED_WORDS = "alpha bravo charlie delta echo foxtrot";

const FIXTURE_PUBLIC_KEY_0 = "f".repeat(64);
const FIXTURE_PUBLIC_KEY_1 = "e".repeat(64);
const FIXTURE_SECRET_KEY_0 = "1".repeat(64);
const FIXTURE_SECRET_KEY_1 = "2".repeat(64);

function makeOuroAccount(over: Partial<IOuroAccount> & { id: string }): IOuroAccount {
  return {
    version: "1.0",
    isSmart: false,
    address: "Ѻ." + over.id.padEnd(40, "0"),
    guard: null,
    kadenaLedger: null,
    publicKey: "pub-" + over.id,
    secret: "unset",
    backup: "",
    originCurve: "dalos",
    originMode: "seedWords",
    ...over,
  };
}

function OuroAccountSeeder({ accounts }: { accounts: IOuroAccount[] }) {
  const { addAccount } = useOuroAccounts();
  const { isReady } = useCodex();
  React.useEffect(() => {
    if (isReady) accounts.forEach((a) => void addAccount(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return null;
}

function Authenticator({ password }: { password: string }) {
  const { authenticate } = useCodexAuth();
  const { isReady } = useCodex();
  React.useEffect(() => {
    if (isReady) authenticate(password, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);
  return null;
}

function SeedSpy({ onSeeds }: { onSeeds: (seeds: IKadenaSeed[]) => void }) {
  const { seeds } = useKadenaSeeds();
  React.useEffect(() => { onSeeds(seeds); }, [seeds, onSeeds]);
  return null;
}

async function renderTab(
  accounts: IOuroAccount[],
  password?: string,
  onSeeds?: (seeds: IKadenaSeed[]) => void,
) {
  const adapter = new MemoryCodexAdapter("dev");
  const utils = render(
    <CodexProvider adapter={adapter}>
      <OuroAccountSeeder accounts={accounts} />
      {password !== undefined && <Authenticator password={password} />}
      {onSeeds && <SeedSpy onSeeds={onSeeds} />}
      <SeedWordsTab />
    </CodexProvider>,
  );
  await waitFor(() => expect(screen.getByText(/No seeds/i)).toBeTruthy());
  return utils;
}

async function openCreateModalAndSelectStoic() {
  fireEvent.click(screen.getByRole("button", { name: /create your first seed/i }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: /stoic/i }));
}

describe("<CreateKadenaSeedModal> — Stoic path", () => {
  let bridgeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    bridgeMock = vi.fn((_bitString: string, index: number) => ({
      publicKey: index === 0 ? FIXTURE_PUBLIC_KEY_0 : FIXTURE_PUBLIC_KEY_1,
      secretKey: index === 0 ? FIXTURE_SECRET_KEY_0 : FIXTURE_SECRET_KEY_1,
      address: `k:${index === 0 ? FIXTURE_PUBLIC_KEY_0 : FIXTURE_PUBLIC_KEY_1}`,
    }));
    (KadenaWalletBuilder as unknown as Record<string, unknown>).createWalletPairFromDalosBitString = bridgeMock;
  });

  afterEach(() => {
    delete (KadenaWalletBuilder as unknown as Record<string, unknown>).createWalletPairFromDalosBitString;
  });

  it("lists only dalos-origin accounts — an apollo-origin fixture must not appear", async () => {
    const dalosAccount = makeOuroAccount({ id: "dalos-1", name: "My Dalos Account" });
    const apolloAccount = makeOuroAccount({
      id: "apollo-1",
      name: "My Apollo Account",
      originCurve: "apollo",
      address: "₱." + "apollo1".padEnd(40, "0"),
    });
    await renderTab([dalosAccount, apolloAccount]);
    await openCreateModalAndSelectStoic();

    expect(await screen.findByRole("option", { name: /My Dalos Account/i })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /My Apollo Account/i })).toBeNull();
  });

  it("shows the 'no compatible accounts' state when no dalos accounts exist", async () => {
    const apolloAccount = makeOuroAccount({ id: "apollo-1", name: "Only Apollo", originCurve: "apollo" });
    await renderTab([apolloAccount]);
    await openCreateModalAndSelectStoic();

    expect(await screen.findByText(/no compatible ouronet accounts/i)).toBeTruthy();
  });

  it("excludes a bitString-origin dalos account from the existing-account picker (narrowing regression)", async () => {
    // Correction: the picker previously allowed originMode "seedWords" OR
    // "bitString". A bitString-origin account has no discrete words at its
    // core — only a raw bitstring — so it must never appear here, even
    // though it's a real dalos-curve account and its bitstring is
    // technically usable.
    const seedWordsAccount = makeOuroAccount({ id: "dalos-1", name: "Words Dalos Account", originMode: "seedWords" });
    const bitStringAccount = makeOuroAccount({
      id: "dalos-2",
      name: "BitString Dalos Account",
      originMode: "bitString",
      address: "Ѻ." + "bits2".padEnd(40, "0"),
    });
    await renderTab([seedWordsAccount, bitStringAccount]);
    await openCreateModalAndSelectStoic();

    expect(await screen.findByRole("option", { name: /Words Dalos Account/i })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /BitString Dalos Account/i })).toBeNull();
  });

  it("selecting an eligible account + entering the correct password produces a live Key #0 preview", async () => {
    const secret = await smartEncrypt(SEED_WORDS, PASSWORD, "2");
    const account = makeOuroAccount({ id: "dalos-1", name: "Prime Dalos", secret, originMode: "seedWords" });
    await renderTab([account], PASSWORD);
    await openCreateModalAndSelectStoic();

    fireEvent.click(await screen.findByRole("option", { name: /Prime Dalos/i }));

    // Generous timeout: this gates on a REAL smartDecrypt (V2 envelope, a
    // deliberately expensive KDF) + real seedWordsToBitString, not just a
    // React re-render — see ui-seed-words-tab.test.tsx's own note on the
    // same class of flakiness with the default 1000ms waitFor timeout.
    await waitFor(() => expect(screen.getByText(/key #0 preview/i)).toBeTruthy(), { timeout: 15_000 });
    expect(screen.getByText(new RegExp(`k:${FIXTURE_PUBLIC_KEY_0}`))).toBeTruthy();
    expect(bridgeMock).toHaveBeenCalledWith(expect.any(String), 0);
  }, 20_000);

  it("submitting persists an IKadenaSeed with seedType 'stoic' and Key #0/Key #1 derived", async () => {
    const secret = await smartEncrypt(SEED_WORDS, PASSWORD, "2");
    const account = makeOuroAccount({ id: "dalos-1", name: "Prime Dalos", secret, originMode: "seedWords" });
    let captured: IKadenaSeed[] = [];
    await renderTab([account], PASSWORD, (seeds) => { captured = seeds; });
    await openCreateModalAndSelectStoic();

    fireEvent.click(await screen.findByRole("option", { name: /Prime Dalos/i }));
    await waitFor(() => expect(screen.getByText(/key #0 preview/i)).toBeTruthy(), { timeout: 15_000 });

    fireEvent.change(screen.getByPlaceholderText(/my seed/i), { target: { value: "My Stoic Seed" } });

    const addButton = screen.getByRole("button", { name: /^add seed$/i }) as HTMLButtonElement;
    await waitFor(() => expect(addButton.disabled).toBe(false), { timeout: 15_000 });
    fireEvent.click(addButton);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 15_000 });

    const created = captured.find((s) => s.name === "My Stoic Seed");
    expect(created).toBeTruthy();
    expect(created!.seedType).toBe("stoic");
    expect(created!.accounts).toHaveLength(2);
    expect(created!.accounts.find((a) => a.index === 0)?.publicKey).toBe(FIXTURE_PUBLIC_KEY_0);
    expect(created!.accounts.find((a) => a.index === 1)?.publicKey).toBe(FIXTURE_PUBLIC_KEY_1);
    expect(bridgeMock).toHaveBeenCalledWith(expect.any(String), 1);

    // secret stores the DERIVED 1600-bit DALOS bitstring (encrypted at the
    // codex password), not the source account's own secret/mnemonic.
    const decryptedSecret = await smartDecrypt(created!.secret, PASSWORD);
    expect(decryptedSecret).toMatch(/^[01]{1600}$/);
  }, 15_000);

  it("wrong password shows an error and does not persist anything", async () => {
    const secret = await smartEncrypt(SEED_WORDS, PASSWORD, "2");
    const account = makeOuroAccount({ id: "dalos-1", name: "Prime Dalos", secret, originMode: "seedWords" });
    let captured: IKadenaSeed[] = [];
    // No Authenticator — codex starts locked, so the password field starts blank.
    await renderTab([account], undefined, (seeds) => { captured = seeds; });
    await openCreateModalAndSelectStoic();

    fireEvent.click(await screen.findByRole("option", { name: /Prime Dalos/i }));
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), { target: { value: "totally-wrong-password" } });

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/incorrect password/i), { timeout: 15_000 });
    expect(screen.queryByText(/key #0 preview/i)).toBeNull();

    const addButton = screen.getByRole("button", { name: /^add seed$/i }) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    expect(captured.some((s) => s.seedType === "stoic")).toBe(false);
  }, 20_000);

  describe("'Enter new seed words' sub-mode", () => {
    async function switchToNewWordsSubMode() {
      fireEvent.click(screen.getByRole("button", { name: /enter new seed words/i }));
    }

    it("typing valid brand-new DALOS seed words produces a live Key #0 preview (no account, no decrypt)", async () => {
      await renderTab([]);
      await openCreateModalAndSelectStoic();
      await switchToNewWordsSubMode();

      fireEvent.change(screen.getByPlaceholderText(/type brand-new dalos seed words/i), {
        target: { value: "alpha bravo charlie delta" },
      });

      await waitFor(() => expect(screen.getByText(/key #0 preview/i)).toBeTruthy());
      expect(screen.getByText(new RegExp(`k:${FIXTURE_PUBLIC_KEY_0}`))).toBeTruthy();
      expect(bridgeMock).toHaveBeenCalledWith(expect.any(String), 0);
    });

    it("submitting new seed words persists an IKadenaSeed with seedType 'stoic', Key #0/#1 derived, and no source account", async () => {
      let captured: IKadenaSeed[] = [];
      // No Ouronet accounts at all — proves this sub-mode needs none.
      await renderTab([], PASSWORD, (seeds) => { captured = seeds; });
      await openCreateModalAndSelectStoic();
      await switchToNewWordsSubMode();

      fireEvent.change(screen.getByPlaceholderText(/type brand-new dalos seed words/i), {
        target: { value: "alpha bravo charlie delta" },
      });
      await waitFor(() => expect(screen.getByText(/key #0 preview/i)).toBeTruthy());

      fireEvent.change(screen.getByPlaceholderText(/my seed/i), { target: { value: "My New Stoic Seed" } });

      const addButton = screen.getByRole("button", { name: /^add seed$/i }) as HTMLButtonElement;
      await waitFor(() => expect(addButton.disabled).toBe(false));
      fireEvent.click(addButton);

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      const created = captured.find((s) => s.name === "My New Stoic Seed");
      expect(created).toBeTruthy();
      expect(created!.seedType).toBe("stoic");
      expect(created!.accounts).toHaveLength(2);
      expect(created!.accounts.find((a) => a.index === 0)?.publicKey).toBe(FIXTURE_PUBLIC_KEY_0);
      expect(created!.accounts.find((a) => a.index === 1)?.publicKey).toBe(FIXTURE_PUBLIC_KEY_1);
      expect(bridgeMock).toHaveBeenCalledWith(expect.any(String), 1);

      const decryptedSecret = await smartDecrypt(created!.secret, PASSWORD);
      expect(decryptedSecret).toMatch(/^[01]{1600}$/);
    });

    it("typed seed words outside the DALOS character set show an error and never reach the live preview or persist", async () => {
      let captured: IKadenaSeed[] = [];
      await renderTab([], PASSWORD, (seeds) => { captured = seeds; });
      await openCreateModalAndSelectStoic();
      await switchToNewWordsSubMode();

      fireEvent.change(screen.getByPlaceholderText(/type brand-new dalos seed words/i), {
        // "@" is not one of the 256 glyphs in the DALOS character set.
        target: { value: "alpha inv@lid charlie" },
      });

      await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/dalos seed-word alphabet/i));
      expect(screen.queryByText(/key #0 preview/i)).toBeNull();

      const addButton = screen.getByRole("button", { name: /^add seed$/i }) as HTMLButtonElement;
      expect(addButton.disabled).toBe(true);
      expect(captured.some((s) => s.seedType === "stoic")).toBe(false);
    });
  });
});
