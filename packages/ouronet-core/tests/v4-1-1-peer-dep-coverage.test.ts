/**
 * Peer-dep coverage for ouronet-core.
 * Locks the @stoachain/stoa-core version pin AND asserts NO direct @kadena/* peers
 * (the v4.1.0 architectural pin — ouronet-core consumes @kadena via the
 * vendored kadena-stoic-legacy bridge, never directly).
 *
 * Phase 8 hand-off: when version bumps to 4.1.1, this assertion string updates.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("REQ-05: ouronet-core peer-dep coverage", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(resolve(here, "..", "package.json"), "utf8"));
  const peers = pkg.peerDependencies ?? {};

  it("@stoachain/stoa-core peer-dep is exact-pin '4.3.6'", () => {
    expect(peers["@stoachain/stoa-core"]).toBe("4.3.6");
  });

  it("@stoachain/kadena-stoic-legacy is OPTIONAL (transitive via stoa-core; declared as peer for monorepo workspace resolution)", () => {
    // Either declared as peer (with version) OR not declared at all are both acceptable
    if (peers["@stoachain/kadena-stoic-legacy"] !== undefined) {
      expect(peers["@stoachain/kadena-stoic-legacy"]).toBe("4.3.6");
    }
  });

  it("ouronet-core has NO @kadena/* direct peer-deps (consumes via vendored kadena-stoic-legacy)", () => {
    const kadenaPeers = Object.keys(peers).filter(k => k.startsWith("@kadena/"));
    expect(kadenaPeers).toEqual([]);
  });

  it("all peer-dep version specifiers are well-formed", () => {
    for (const version of Object.values(peers)) {
      expect(typeof version).toBe("string");
      expect(version).toMatch(/^(\d+\.\d+\.\d+|\^\d+\.\d+\.\d+)$/);
    }
  });
});
