/**
 * Inverse StoicTag read seam tests — getStoicTagInfo (URC_0027c) and
 * getStoicTagSelectorData (URC_0027b). Mirrors interactions-read-seam.test.ts:
 * a counting stub installed via setPactReader records (pactCode, options) and
 * returns a shape compatible with each function's unwrap path. Pins:
 *   - the function routes through the pactRead seam at tier T5,
 *   - the constructed Pact code (module + function + quoted args),
 *   - the empty-input short-circuit and failure → null/[] contracts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setPactReader,
  rawCalibratedDirtyRead,
  type PactReader,
} from "@stoachain/stoa-core/reads";
import {
  getStoicTagInfo,
  getStoicTagSelectorData,
} from "../src/interactions/ouroAccountFunctions";

type Call = { pactCode: string; options?: Parameters<PactReader>[1] };

let calls: Call[] = [];
let nextStatus: "success" | "failure" = "success";

const ACTIVE_ROW = {
  "stoic-tag": "alice",
  "iz-row-exists": true,
  "iz-active": true,
  "iz-released": false,
  "iz-never-registered": false,
  "ouronet-account": "Ѻ.ALICE",
  "registered-at": { time: "2026-01-01T00:00:00Z" },
};

const stub: PactReader = (pactCode, options) => {
  calls.push({ pactCode, options });
  if (nextStatus === "failure") {
    return Promise.resolve({ result: { status: "failure", error: { message: "boom" } } });
  }
  // Batch (URC_0027b) returns one row per quoted tag; single (URC_0027c) one row.
  if (pactCode.includes("URC_0027b_StoicTagSelectorMapper")) {
    const count = (pactCode.match(/"/g)?.length ?? 0) / 2;
    return Promise.resolve({
      result: { status: "success", data: Array.from({ length: count }, () => ACTIVE_ROW) },
    });
  }
  return Promise.resolve({ result: { status: "success", data: ACTIVE_ROW } });
};

beforeEach(() => {
  calls = [];
  nextStatus = "success";
  setPactReader(stub);
});

afterEach(() => {
  setPactReader(rawCalibratedDirtyRead);
});

describe("getStoicTagInfo (URC_0027c)", () => {
  it("routes through pactRead at tier T5 with the quoted tag name", async () => {
    const out = await getStoicTagInfo("alice");
    expect(calls.length).toBe(1);
    expect(calls[0].options?.tier).toBe("T5");
    expect(calls[0].pactCode).toBe(
      `(ouronet-ns.DPL-UR.URC_0027c_StoicTagSelectorSingle "alice")`,
    );
    expect(out).toEqual(ACTIVE_ROW);
  });

  it("returns null without reading when the tag name is empty", async () => {
    const out = await getStoicTagInfo("");
    expect(calls.length).toBe(0);
    expect(out).toBeNull();
  });

  it("returns null on a chain read failure", async () => {
    nextStatus = "failure";
    const out = await getStoicTagInfo("alice");
    expect(out).toBeNull();
  });
});

describe("getStoicTagSelectorData (URC_0027b)", () => {
  it("routes through pactRead at tier T5 with a space-joined quoted tag list", async () => {
    const out = await getStoicTagSelectorData(["alice", "bob"]);
    expect(calls.length).toBe(1);
    expect(calls[0].options?.tier).toBe("T5");
    expect(calls[0].pactCode).toBe(
      `(ouronet-ns.DPL-UR.URC_0027b_StoicTagSelectorMapper ["alice" "bob"])`,
    );
    expect(out).toHaveLength(2);
  });

  it("short-circuits to [] without reading when the list is empty", async () => {
    const out = await getStoicTagSelectorData([]);
    expect(calls.length).toBe(0);
    expect(out).toEqual([]);
  });

  it("returns [] on a chain read failure", async () => {
    nextStatus = "failure";
    const out = await getStoicTagSelectorData(["alice"]);
    expect(out).toEqual([]);
  });
});
