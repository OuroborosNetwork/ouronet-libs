/**
 * Cross-package version-pin consistency.
 * Reads each package's package.json + peer-deps and asserts the dependency
 * triangle pins are consistent. Comparison-based (not hardcoded version strings)
 * so this test survives future version bumps cleanly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

describe("cross-package version-pin consistency", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..", "..");

  const ksl = JSON.parse(readFileSync(resolve(repoRoot, "packages/kadena-stoic-legacy/package.json"), "utf8"));
  const stoa = JSON.parse(readFileSync(resolve(repoRoot, "packages/stoa-core/package.json"), "utf8"));
  const our = JSON.parse(readFileSync(resolve(repoRoot, "packages/ouronet-core/package.json"), "utf8"));

  it("all 3 packages share the same version (atomic-triplet invariant)", () => {
    expect(stoa.version).toBe(ksl.version);
    expect(our.version).toBe(ksl.version);
  });

  it("stoa-core's @stoachain/kadena-stoic-legacy peer-dep matches kadena-stoic-legacy version", () => {
    const peer = stoa.peerDependencies?.["@stoachain/kadena-stoic-legacy"];
    expect(peer).toBe(ksl.version);
  });

  it("ouronet-core's @stoachain/stoa-core peer-dep matches stoa-core version", () => {
    const peer = our.peerDependencies?.["@stoachain/stoa-core"];
    expect(peer).toBe(stoa.version);
  });

  it("@scure/bip39 peer-dep is identical across kadena-stoic-legacy + stoa-core", () => {
    const kslBip39 = ksl.peerDependencies?.["@scure/bip39"];
    const stoaBip39 = stoa.peerDependencies?.["@scure/bip39"];
    expect(kslBip39).toBe(stoaBip39);
  });
});
