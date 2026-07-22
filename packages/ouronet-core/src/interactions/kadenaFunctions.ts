import { pactRead } from "@stoachain/stoa-core/reads";
import { KadenaShapeError } from "./errors.js";

export interface BalanceItem {
  account: string;
  balance: string;
}

export async function getBalance(account: string): Promise<BalanceItem> {
  const pactCode = `(coin.get-balance "${account}")`;
  const response = await pactRead(pactCode, { tier: "T1" });

  const raw = (response.result as any).data;

  let balance: string;
  if (raw !== null && raw !== undefined && typeof raw === "object" && "decimal" in raw) {
    // Kadena may return { decimal: "..." } — unwrap to plain string
    balance = String(raw.decimal);
  } else if (typeof raw === "string") {
    balance = raw;
  } else {
    throw new KadenaShapeError("Unexpected balance envelope", { cause: response.result });
  }

  return { account, balance };
}

export async function accountDescription(address: string) {
  const pactCode = `(coin.details "${address}")`;
  const { result }: any = await pactRead(pactCode, { tier: "T5" });

  if (result?.status === "failure") {
    return {
      isNewAccount: true,
      balance: undefined,
      account: result?.data?.account || address,
      guard: result?.data?.guard || null,
    };
  }

  if (result?.data?.balance === undefined || result?.data?.balance === null) {
    throw new KadenaShapeError("Account description envelope missing balance field", { cause: result });
  }

  return {
    isNewAccount: false,
    balance: result.data.balance,
    account: result?.data?.account || address,
    guard: result?.data?.guard || null,
  };
}
