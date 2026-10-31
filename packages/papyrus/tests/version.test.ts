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
import { PAPYRUS_VERSION, PAPYRUS_COPY, type PapyrusKind } from "../src/kind.js";

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

describe("the vocabulary", () => {
  it("names three FORMS, and each says what it promises", () => {
    for (const k of ["page", "roll", "leaf"] as const) {
      expect(PAPYRUS_COPY[k].label).toBe(
        { page: "Papyrus Page", roll: "Papyrus Roll", leaf: "Papyrus Leaf" }[k]);
    }
  });

  /**
   * AND ONE NON-FORM, added 2026-10-31. `threads` is the catalogue of controls the forms are
   * woven from, not a sheet — it is in the union so that the word on the prototype shelf and
   * the word in the engine are the same word. "CFM Input Patterns" survived the rename to
   * Papyrus precisely because its name lived nowhere the package could see it.
   */
  it("and one NON-FORM — the controls the forms are made of", () => {
    expect(PAPYRUS_COPY.threads.label).toBe("Papyrus Threads");
    expect(PAPYRUS_COPY.threads.blurb, "a thread is a mounted control, not a sample")
      .toMatch(/actually mounts/);
  });

  it("every member explains itself", () => {
    for (const [k, v] of Object.entries(PAPYRUS_COPY))
      expect(v.blurb.length, `${k} must explain itself`).toBeGreaterThan(80);
  });

  it("the union and the copy table cannot drift apart", () => {
    // A member added to `PapyrusKind` without copy is a badge that renders `undefined`.
    const kinds: PapyrusKind[] = ["page", "roll", "leaf", "threads"];
    expect(Object.keys(PAPYRUS_COPY).sort()).toEqual([...kinds].sort());
  });
});
