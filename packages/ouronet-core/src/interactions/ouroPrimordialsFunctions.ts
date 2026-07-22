/**
 * ouroPrimordialsFunctions.ts
 * Chain call to ouronet-ns.DPL-UR.URC_0002_Primordials plus the placeholder factory.
 * The internal `parseResponse` and `fmt` helpers retain the v4.x token-decoration
 * logic verbatim for backward compat (v5.0.0 will physically extract it).
 */

import { KADENA_NAMESPACE } from "../constants/index.js";
import { formatEU, mayComeWithDeimal } from "@stoachain/stoa-core/pact";
import { pactRead } from "@stoachain/stoa-core/reads";

// (namespace.DPL-UR.URC_0002_Primordials account)
export async function getPrimordials(
  currentAccount: string = "",
  codexAccounts: string[] = [],
  options?: { skipTempWatcher?: boolean }
): Promise<any> {
  const accountsList = codexAccounts.map((a) => `"${a}"`).join(" ");
  const pactCode = `(${KADENA_NAMESPACE}.DPL-UR.URC_0002_Primordials "${currentAccount}" [${accountsList}])`;

  const response = await pactRead(pactCode, { tier: "T5", skipTempWatcher: options?.skipTempWatcher });

  if (!response || !response.result) {
    return null; // network failure — caller should retry, not show ???
  }
  if (response.result.status === "failure") {
    return null; // pact failure — caller should retry, not show ???
  }
  return parseResponse(response.result.data as any[]);
}

const fmt = (v: any): string => formatEU(mayComeWithDeimal(v) ?? null);

const parseResponse = (data: any[]): any => {
  const d = data[0];
  const codex = data[1] ?? {};

  const supplyHoverVal = (v: any) => {
    const raw = mayComeWithDeimal(v);
    return formatEU(raw !== null && raw !== undefined ? String(raw) : null);
  };

  const ouro = {
    id: d["ouro-id"],
    name: d["ouro-name"],
    icon: "/images/coins/OURO.svg",
    iconBgColor: "bg-primary/5",
    balance: {
      display: fmt(d["ouro-balance"]),
      value: fmt(d["ouro-balance-hover"]),
    },
    balanceUsd: fmt(d["ouro-balance-vid"]),
    pricePerUnit: fmt(d["ouro-price"]),
    totalSupply: {
      display: fmt(d["ouro-dispo-capacity"]),
      value: fmt(d["ouro-dispo-capacity-hover"]),
    },
    supplyUsdValue: fmt(d["ouro-dispo-capacity-vid"]),
    virtual: {
      display: fmt(d["ouro-v-balance"]),
      value: fmt(d["ouro-v-balance-hover"]),
      inUsd: fmt(d["ouro-v-balance-vid"]),
    },
    info: "",
    currencySymbol: "Ѻ",
    currencySymbolColor: "#7b4a1e",
    availableActions: ["Sublimate", "Coil", "Curl", "Transfer", "Bulk Transfer"],
    keepTransferNames: true,
    balanceLabel: "Balance",
    virtualLabel: "Virtual Balance",
    supplyLabel: "Dispo Capacity",
  };

  const ignis = {
    id: d["gas-id"],
    name: d["gas-name"],
    icon: "/images/coins/Ignis.svg",
    iconBgColor: "bg-primary/5",
    balance: {
      display: fmt(d["gas-balance"]),
      value: fmt(d["gas-balance-hover"]),
    },
    balanceUsd: fmt(d["gas-balance-vid"]),
    pricePerUnit: fmt(d["gas-price"]),
    totalSupply: {
      display: fmt(d["gas-supply"]),
      value: supplyHoverVal(d["gas-supply-hover"]),
    },
    supplyUsdValue: fmt(d["gas-supply-vid"]),
    virtual: null,
    info: d["gas-discount-text"] ?? "",
    currencySymbol: "Ω",
    currencySymbolColor: "#cc2200",
    availableActions: ["Compress", "Firestarter", "Transfer", "Bulk Transfer"],
    keepTransferNames: true,
    maxButtonsPerRow: 2,
    balanceLabel: "Balance",
    showCodexRow: true,
    supplyLabel: "Ouronet Total GAS",
    codexBalance: {
      display: fmt(codex["codex-balance"]),
      value: fmt(codex["codex-balance-hover"]),
      inUsd: fmt(codex["codex-balance-vid"]),
    },
  };

  const auryn = {
    id: d["auryn-id"],
    name: d["auryn-name"],
    icon: "/images/coins/AURYN.svg",
    iconBgColor: "bg-purple-50",
    balance: {
      display: fmt(d["auryn-balance"]),
      value: fmt(d["auryn-balance-hover"]),
    },
    balanceUsd: fmt(d["auryn-balance-vid"]),
    pricePerUnit: fmt(d["auryn-price"]),
    totalSupply: {
      display: fmt(d["auryn-supply"]),
      value: fmt(d["auryn-supply-hover"]),
    },
    supplyUsdValue: fmt(d["auryn-supply-vid"]),
    supplyLabel: "Auryn Supply",
    postSupplyRow: {
      label: "Ouroboros Supply",
      value: fmt(d["ouro-supply"]),
      hoverValue: fmt(d["ouro-supply-hover"]),
      usdValue: fmt(d["ouro-supply-vid"]),
      suffix: " Ѻ",
      suffixColor: "#7b4a1e",
    },
    virtual: null,
    info: "",
    currencySymbol: "₳",
    currencySymbolColor: "#d2d3d4",
    availableActions: ["Autostake (Coil)", "Recover (Uncoil)", "Transfer", "Bulk Transfer"],
    keepTransferNames: true,
    maxButtonsPerRow: 2,
    hideSupplySeparator: true,
  };

  const eauryn = {
    id: d["eauryn-id"],
    name: d["eauryn-name"],
    icon: "/images/coins/ELITE-AURYN.svg",
    iconBgColor: "bg-yellow-50",
    balance: {
      display: fmt(d["eauryn-balance"]),
      value: fmt(d["eauryn-balance-hover"]),
    },
    balanceUsd: fmt(d["eauryn-balance-vid"]),
    pricePerUnit: fmt(d["eauryn-price"]),
    totalSupply: {
      display: fmt(d["eauryn-supply"]),
      value: fmt(d["eauryn-supply-hover"]),
    },
    supplyUsdValue: fmt(d["eauryn-supply-vid"]),
    supplyLabel: "EliteAuryn Supply",
    virtual: null,
    info: "",
    currencySymbol: "Ξ₳",
    currencySymbolColor: "#ceac5f",
    availableActions: ["Clear Ouroboros Dispo", "Recover (Uncoil)", "Transfer", "Bulk Transfer"],
    keepTransferNames: true,
    notImplementedActions: [],
    maxButtonsPerRow: 2,
    hideSupplySeparator: true,
    extraBalanceRow: {
      label: "EA to Next Tier",
      value: fmt(d["eauryn-next"]),
      hoverValue: fmt(d["eauryn-next-hover"]),
      usdValue: fmt(d["eauryn-next-vid"]),
    },
  };

  const wstoa = {
    id: d["wstoa-id"],
    name: "WSTOA",
    icon: "/images/coins/WSTOA.svg",
    iconBgColor: "bg-primary/5",
    balance: {
      display: fmt(d["wstoa-wrapped-balance"]),
      value: fmt(d["wstoa-wrapped-balance-hover"]),
    },
    balanceUsd: fmt(d["wstoa-wrapped-balance-vid"]),
    pricePerUnit: fmt(d["wstoa-price"]),
    totalSupply: {
      display: fmt(d["wstoa-wrapped-total-supply"]),
      value: fmt(d["wstoa-wrapped-total-supply-hover"]),
    },
    supplyUsdValue: fmt(d["wstoa-wrapped-total-supply-vid"]),
    virtual: null,
    info: d["stoa-discount-text"] ?? "",
    currencySymbol: "❖",
    currencySymbolColor: "#ceac5f",
    displayName: "WrappedStoa",
    leadingBalanceRow: {
      label: "Native Balance",
      value: fmt(d["wstoa-native-balance"]),
      hoverValue: supplyHoverVal(d["wstoa-native-balance-hover"]),
      usdValue: fmt(d["wstoa-native-balance-vid"]),
      suffix: " ❖",
      suffixColor: "#ceac5f",
    },
    balanceLabel: "Wrapped Balance",
    supplyLabel: "Total Wrapped Supply",
    hideSupplySeparator: true,
    keepTransferNames: true,
    availableActions: ["Coil", "Brumate", "Wrap", "Transfer", "Bulk Transfer", "Unwrap"],
  };

  const sstoa = {
    id: d["sstoa-id"],
    name: "SSTOA",
    icon: "/images/coins/SSTOA.svg",
    iconBgColor: "bg-primary/5",
    balance: {
      display: fmt(d["sstoa-balance"]),
      value: fmt(d["sstoa-balance-hover"]),
    },
    balanceUsd: fmt(d["sstoa-balance-vid"]),
    pricePerUnit: fmt(d["sstoa-price"]),
    totalSupply: {
      display: fmt(d["sstoa-supply"]),
      value: fmt(d["sstoa-supply-hover"]),
    },
    supplyUsdValue: fmt(d["sstoa-supply-vid"]),
    virtual: null,
    info: "",
    currencySymbol: "◈",
    currencySymbolColor: "#e8e8e8",
    displayName: "SilverStoa",
    supplyLabel: "Total SilverStoa Supply",
    hideSupplySeparator: true,
    keepTransferNames: true,
    maxButtonsPerRow: 2,
    availableActions: ["Constrict", "Recover", "Transfer", "Bulk Transfer"],
    postSupplyRow: {
      label: "Total GoldenStoa Supply",
      value: fmt(d["gstoa-supply"]),
      hoverValue: fmt(d["gstoa-supply-hover"]),
      usdValue: fmt(d["gstoa-supply-vid"]),
      suffix: " ◈",
      suffixColor: "#ceac5f",
    },
  };

  const gstoa = {
    id: d["gstoa-id"],
    displayId: `${d["gstoa-id"] ?? "GSTOA"} | ${d["hgstoa-id"] ?? "H|GSTOA"}`,
    name: "GSTOA",
    icon: "/images/coins/SSTOA.svg",
    isGoldIcon: true,
    balance: {
      display: fmt(d["gstoa-balance"]),
      value: fmt(d["gstoa-balance-hover"]),
    },
    balanceUsd: fmt(d["gstoa-balance-vid"]),
    pricePerUnit: fmt(d["gstoa-price"]),
    totalSupply: {
      display: fmt(d["gstoa-supply"]),
      value: fmt(d["gstoa-supply-hover"]),
    },
    supplyUsdValue: fmt(d["gstoa-supply-vid"]),
    virtual: null,
    info: "",
    currencySymbol: "◈",
    currencySymbolColor: "#ceac5f",
    displayName: "GoldenStoa",
    hideSupplySeparator: true,
    hideSupplyRow: true,
    middleBalanceRows: [
      {
        label: "Hibernated Balance (Nonces)",
        value: fmt(d["hgstoa-balance-nonces"]),
        hoverValue: d["hgstoa-balance-nonces-hover"] ?? undefined,
        usdValue: fmt(d["hgstoa-balance-nonces-vid"]),
        suffix: " ◈",
        suffixColor: "#ceac5f",
      },
      {
        label: "Total GoldenStoa",
        value: fmt(d["gstoa-total-balance"]),
        hoverValue: fmt(d["gstoa-total-balance-hover"]),
        usdValue: fmt(d["gstoa-total-balance-vid"]),
        suffix: " ◈",
        suffixColor: "#ceac5f",
      },
    ],
    availableActions: ["Recover", "Transfer", "Bulk Transfer", "Awake", "Slumber", "Transfer Nonces"],
    keepTransferNames: true,
    notImplementedActions: [],
  };

  const urstoa = {
    id: "URSTOA",
    displayId: "coin.UR|StoaTable",
    name: "UrStoa",
    icon: "/images/coins/WSTOA.svg",
    isStoneIcon: true,
    pricePerUnit: "—",
    balanceUsd: "—",
    balance: { display: "—", value: "0" },
    totalSupply: { display: "—", value: "0" },
    currencySymbol: "✦",
    currencySymbolColor: "#555555",
    hidePrice: true,
    hideSupplySeparator: true,
    textAlignTop: true,
    customBalanceRows: [
      {
        label: "Wrapped Balance",
        value: fmt(String(d["urstoa-wrapped-balance"] ?? 0)),
        suffix: " ✦",
        suffixColor: "#555555",
      },
      {
        label: "Payment Key Balance",
        value: fmt(String(d["urstoa-payment-key-balance"] ?? 0)),
        suffix: " ✦",
        suffixColor: "#555555",
      },
      {
        label: "UrStoa Vault Balance",
        value: fmt(String(d["urstoa-vault-balance"] ?? 0)),
        suffix: " ✦",
        suffixColor: "#555555",
      },
      {
        label: "UrStoa Vault Earnings in STOA",
        value: fmt(d["urstoa-vault-earnings"]),
        // The chain returns this hover as a { decimal: "…" } object (like the
        // supply hover). Route it through supplyHoverVal so mayComeWithDeimal
        // unwraps it — `String({decimal})` would yield "[object Object]", which
        // parses back to 0 and wrongly disables the Collect button. See supply row.
        hoverValue: supplyHoverVal(d["urstoa-vault-earning-hover"]),
        suffix: " ❖",
        suffixColor: "#ceac5f",
      },
      {
        label: "UrStoa Vault STOA Supply",
        value: fmt(d["urstoa-vault-stoa-supply"]),
        hoverValue: supplyHoverVal(d["urstoa-vault-stoa-supply-hover"]),
        suffix: " ❖",
        suffixColor: "#ceac5f",
      },
    ],
    availableActions: ["Stake", "Unstake", "Wrap", "Collect", "Transfer", "Unwrap"],
    keepTransferNames: true,
    forceGoldActions: ["Transfer", "Stake", "Unstake", "Collect"],
    notImplementedActions: [],
    /** Wrapped UrStoa DPTF token ID (from primordials) */
    wrappedTokenId: d["urstoa-wrapped-id"] ?? null,
  };

  return {
    totalWithVirtual: formatEU(d["total-value-with-vouro"]),
    total: formatEU(d["total-value"]),
    tokens: [ouro, ignis, auryn, eauryn, wstoa, sstoa, gstoa, urstoa],
  };
};

export function buildPlaceholderPrimordials(): any {
  const Q = "???";
  const mkToken = (name: string, extra: object = {}) => ({
    id: Q,
    name,
    balance: { display: Q, value: Q },
    balanceUsd: Q,
    pricePerUnit: Q,
    totalSupply: { display: Q, value: Q },
    supplyUsdValue: Q,
    virtual: null,
    info: "",
    currencySymbol: "",
    availableActions: [],
    ...extra,
  });

  return {
    totalWithVirtual: Q,
    total: Q,
    tokens: [
      mkToken("Ouroboros", {
        icon: "/images/coins/OURO.svg",
        currencySymbol: "Ѻ",
        currencySymbolColor: "#7b4a1e",
        virtual: { display: Q, value: Q, inUsd: Q },
        availableActions: ["Sublimate", "Coil", "Curl", "Transfer", "Bulk Transfer"],
        keepTransferNames: true,
        balanceLabel: "Balance",
        virtualLabel: "Virtual Balance",
        supplyLabel: "Dispo Capacity",
      }),
      mkToken("Ignis", {
        icon: "/images/coins/Ignis.svg",
        currencySymbol: "Ω",
        currencySymbolColor: "#cc2200",
        showCodexRow: true,
        codexBalance: { display: Q, value: Q, inUsd: Q },
        availableActions: ["Compress", "Firestarter", "Transfer", "Bulk Transfer"],
        keepTransferNames: true,
        maxButtonsPerRow: 2,
        supplyLabel: "Ouronet Total GAS",
      }),
      mkToken("Auryn", {
        icon: "/images/coins/AURYN.svg",
        currencySymbol: "₳",
        hideSupplySeparator: true,
        availableActions: ["Autostake (Coil)", "Recover (Uncoil)", "Transfer", "Bulk Transfer"],
        keepTransferNames: true,
        maxButtonsPerRow: 2,
      }),
      mkToken("EliteAuryn", {
        icon: "/images/coins/ELITE-AURYN.svg",
        currencySymbol: "Ξ₳",
        currencySymbolColor: "#ceac5f",
        hideSupplySeparator: true,
        hideSupplyRow: true,
        extraBalanceRow: { label: "EA to Next Tier", value: Q, usdValue: Q },
        availableActions: ["Clear Ouroboros Dispo", "Recover (Uncoil)", "Transfer", "Bulk Transfer"],
        keepTransferNames: true,
        notImplementedActions: [],
        maxButtonsPerRow: 2,
      }),
      mkToken("WSTOA", {
        icon: "/images/coins/WSTOA.svg",
        currencySymbol: "❖",
        currencySymbolColor: "#ceac5f",
        displayName: "WrappedStoa",
        leadingBalanceRow: { label: "Native Balance", value: Q, usdValue: Q },
        balanceLabel: "Wrapped Balance",
        supplyLabel: "Total Wrapped Supply",
        hideSupplySeparator: true,
        keepTransferNames: true,
        availableActions: ["Coil", "Brumate", "Wrap", "Transfer", "Bulk Transfer", "Unwrap"],
      }),
      mkToken("SSTOA", {
        icon: "/images/coins/SSTOA.svg",
        currencySymbol: "◈",
        currencySymbolColor: "#e8e8e8",
        displayName: "SilverStoa",
        supplyLabel: "Total SilverStoa Supply",
        hideSupplySeparator: true,
        keepTransferNames: true,
        maxButtonsPerRow: 2,
        availableActions: ["Constrict", "Recover", "Transfer", "Bulk Transfer"],
      }),
      {
        id: Q,
        displayId: `${Q} | ${Q}`,
        name: "GSTOA",
        icon: "/images/coins/SSTOA.svg",
        isGoldIcon: true,
        balance: { display: Q, value: Q },
        balanceUsd: Q,
        pricePerUnit: Q,
        totalSupply: { display: Q, value: Q },
        supplyUsdValue: Q,
        virtual: null,
        info: "",
        currencySymbol: "◈",
        currencySymbolColor: "#ceac5f",
        displayName: "GoldenStoa",
        hideSupplySeparator: true,
        hideSupplyRow: true,
        middleBalanceRows: [
          { label: "Hibernated Balance (Nonces)", value: Q, usdValue: Q },
          { label: "Total GoldenStoa", value: Q, usdValue: Q },
        ],
        availableActions: ["Recover", "Transfer", "Bulk Transfer", "Awake", "Slumber", "Transfer Nonces"],
        keepTransferNames: true,
        notImplementedActions: [],
      },
      {
        id: "URSTOA",
        displayId: "coin.UR|StoaTable",
        name: "UrStoa",
        icon: "/images/coins/WSTOA.svg",
        isStoneIcon: true,
        pricePerUnit: "—",
        balanceUsd: "—",
        balance: { display: "—", value: "0" },
        totalSupply: { display: "—", value: "0" },
        currencySymbol: "✦",
        currencySymbolColor: "#555555",
        hidePrice: true,
        hideSupplySeparator: true,
        textAlignTop: true,
        customBalanceRows: [
          { label: "Payment Key Balance", value: Q },
          { label: "UrStoa Vault Balance", value: Q },
          { label: "UrStoa Vault Earnings in STOA", value: Q },
          { label: "UrStoa Vault STOA Supply", value: Q },
        ],
        availableActions: ["Stake", "Unstake", "Collect", "Transfer"],
        keepTransferNames: true,
        notImplementedActions: ["Transfer"],
      },
    ],
  };
}
