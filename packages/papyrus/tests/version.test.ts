/**
 * THE EXPORTED VERSION IS THE PACKAGE'S VERSION.
 *
 * `PAPYRUS_VERSION` is what a Papyrus badge renders, so a consumer reads it to say which engine
 * drew the form in front of them. A copy that drifts from `package.json` would have the badge
 * confidently naming a version that was never published — which is worse than no badge, because
 * a wrong version in a bug report sends the reader to the wrong source.
 *
 * It is hand-kept rather than imported: pulling it from the manifest needs `resolveJsonModule`
 * and a bundler that inlines it for every consumer, and a version that silently becomes
 * `undefined` in one consumer's build is harder to notice than one that is merely stale. So the
 * copy stays and this test is what makes it safe.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PAPYRUS_VERSION, PAPYRUS_COPY } from "../src/kind.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("PAPYRUS_VERSION", () => {
  it("equals the package version exactly", () => {
    expect(PAPYRUS_VERSION).toBe(pkg.version);
  });

  it("is no longer marked pre-package", () => {
    // It read `0.1.0-pre` while the constant lived in OuronetUI and described a local artefact.
    // Publishing is precisely what retires that suffix.
    expect(PAPYRUS_VERSION).not.toMatch(/-pre$/);
  });
});

describe("the three members", () => {
  it("are named, and each says what it promises", () => {
    expect(Object.fromEntries(Object.entries(PAPYRUS_COPY).map(([k, v]) => [k, v.label])))
      .toEqual({ page: "Papyrus Page", roll: "Papyrus Roll", leaf: "Papyrus Leaf" });
    for (const [k, v] of Object.entries(PAPYRUS_COPY))
      expect(v.blurb.length, `${k} must explain itself`).toBeGreaterThan(80);
  });
});
