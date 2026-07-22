/**
 * Full-chain integration test.
 * Sample flow: kadena-stoic-legacy keypair → stoa-core wallet → ouronet-core interaction.
 * Verifies the dependency triangle resolves correctly + handles error paths.
 */
import { describe, it, expect } from "vitest";
import { kadenaGenKeypairFromSeed } from "@stoachain/kadena-stoic-legacy/hd-wallet";
import { setPactReader, rawCalibratedDirtyRead, type PactReader } from "@stoachain/stoa-core/reads";
import { getBalance } from "@ouronet/ouronet-core/interactions/kadenaFunctions";
import { KadenaShapeError } from "@ouronet/ouronet-core/interactions/errors";

describe("full-chain integration (kadena-stoic-legacy → stoa-core → ouronet-core)", () => {
  it("happy path: keypair generation function is callable + mocked balance lookup returns parsed result", async () => {
    // kadenaGenKeypairFromSeed requires an encrypted seed, so we only verify the
    // function is reachable from the dist export — actual invocation requires a
    // full seed derivation ceremony which belongs to kadena-stoic-legacy tests.
    expect(typeof kadenaGenKeypairFromSeed).toBe("function");

    const stub: PactReader = async (pactCode) => {
      if (pactCode.includes("coin.get-balance")) {
        return { result: { status: "success", data: "100.5" } };
      }
      return { result: { status: "failure", error: "unsupported" } };
    };
    setPactReader(stub);

    try {
      const result = await getBalance("k:abc123");
      expect(result).toBeDefined();
      expect(result.balance).toBe("100.5");
    } finally {
      setPactReader(rawCalibratedDirtyRead);
    }
  });

  it("error path: shape mismatch from RPC throws KadenaShapeError", async () => {
    // data is undefined — neither string nor { decimal } — triggers KadenaShapeError
    const stub: PactReader = async () => ({
      result: { data: undefined },
    });
    setPactReader(stub);

    try {
      await expect(getBalance("k:abc")).rejects.toBeInstanceOf(KadenaShapeError);
    } finally {
      setPactReader(rawCalibratedDirtyRead);
    }
  });

  it("error path: decimal-object envelope unwraps to plain string balance", async () => {
    // Kadena may return { decimal: "..." } — the interaction layer must unwrap it
    const stub: PactReader = async () => ({
      result: { data: { decimal: "0" } },
    });
    setPactReader(stub);

    try {
      const result = await getBalance("k:abc");
      expect(result.balance).toBe("0");
    } finally {
      setPactReader(rawCalibratedDirtyRead);
    }
  });
});
