/**
 * REQ-31..34 (Phase 8 — atomic doc + 1 test): INTEGRATION-GUIDE.md doc-validity check.
 *
 * Validates the comprehensive cold-start consumer onboarding guide at the repo
 * root covering the full v4.0 → v4.1 → v4.2 architectural arc.
 *
 * Asserts:
 *   - REQ-31: INTEGRATION-GUIDE.md exists at the repo root with non-zero size.
 *   - REQ-32: All 13 mandated `## N. <heading>` sections present (regex-matched
 *             against numeric-prefixed `## 1.` ... `## 13.` per LC-8-G).
 *   - REQ-33: Doc length within 30-50 pages of markdown (~1200-6000 lines).
 *   - REQ-34 (subpaths): Every cited subpath in the doc resolves via dynamic
 *             `import()` (LC-8-D — covers all 6 kadena-stoic-legacy + 13
 *             stoa-core + 5 ouronet-core + representative interactions/* glob
 *             entries). Hardcoded list = source-of-truth that locks doc
 *             structure against drift.
 *   - REQ-34 (errors): Every cited `*Error` class imports successfully and
 *             resolves to a constructor function (LC-8-E — 14 consumer-relevant
 *             classes, including the v4.1.1 mandated 5).
 *   - REQ-34 (seams): The 3 mandated pluggable seams + auxiliary logger seam
 *             are exported from their cited subpaths (LC-8-F).
 *   - LC-8-H: Cross-references to MIGRATION-v4.md and MIGRATION-v4.1.md resolve;
 *             MIGRATION-v4.2.md cross-reference is `it.todo` (Phase 9 deliverable).
 *
 * Mirrors the precedent at `tests/v4-1-1-migration-doc-validity.test.ts` (3
 * it-blocks); extended to ~30-40 it-blocks across 5 nested describe groups.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const integrationPath = resolve(repoRoot, "INTEGRATION-GUIDE.md");
const migrationV4Path = resolve(repoRoot, "MIGRATION-v4.md");
const migrationV41Path = resolve(repoRoot, "MIGRATION-v4.1.md");
const migrationV42Path = resolve(repoRoot, "MIGRATION-v4.2.md");

describe("REQ-31..34: INTEGRATION-GUIDE.md doc validity", () => {
  describe("File existence and length", () => {
    it("INTEGRATION-GUIDE.md exists at repo root", () => {
      expect(existsSync(integrationPath)).toBe(true);
    });

    it("INTEGRATION-GUIDE.md has non-zero size (> 1KB)", () => {
      const size = statSync(integrationPath).size;
      expect(size).toBeGreaterThan(1000);
    });

    it("INTEGRATION-GUIDE.md is between 30 and 50 pages of markdown (1200-6000 lines)", () => {
      const doc = readFileSync(integrationPath, "utf8");
      const lines = doc.split(/\r?\n/).length;
      expect(lines).toBeGreaterThan(1200);
      expect(lines).toBeLessThan(6000);
    });
  });

  describe("13 mandated section headings (LC-8-G)", () => {
    const doc = (): string =>
      existsSync(integrationPath) ? readFileSync(integrationPath, "utf8") : "";

    it("Section 1: Preamble & TL;DR present", () => {
      expect(doc()).toMatch(/^##\s+1\.\s+(Preamble|TL;DR)/im);
    });

    it("Section 2: Architecture history present", () => {
      expect(doc()).toMatch(/^##\s+2\.\s+Architecture\s+history/im);
    });

    it("Section 3: Per-package install present", () => {
      expect(doc()).toMatch(/^##\s+3\.\s+(Per-package\s+)?Install/im);
    });

    it("Section 4: Subpath imports per package present", () => {
      expect(doc()).toMatch(/^##\s+4\.\s+Subpath\s+imports/im);
    });

    it("Section 5: The 5 typed error classes present", () => {
      expect(doc()).toMatch(/^##\s+5\.\s+.*error\s+classes/im);
    });

    it("Section 6: Pluggable seam wiring present", () => {
      expect(doc()).toMatch(/^##\s+6\.\s+Pluggable\s+seams?/im);
    });

    it("Section 7: 7-entity Ouronet taxonomy present", () => {
      expect(doc()).toMatch(/^##\s+7\.\s+(.*entity.*taxonomy|Ouronet\s+taxonomy)/im);
    });

    it("Section 8: UI-decoration responsibilities present", () => {
      expect(doc()).toMatch(/^##\s+8\.\s+UI[- ]decoration/im);
    });

    it("Section 9: Code-mod scripts present", () => {
      expect(doc()).toMatch(/^##\s+9\.\s+Code[- ]mod/im);
    });

    it("Section 10: Worked example present", () => {
      expect(doc()).toMatch(/^##\s+10\.\s+Worked\s+example/im);
    });

    it("Section 11: Verification checklist present", () => {
      expect(doc()).toMatch(/^##\s+11\.\s+Verification\s+checklist/im);
    });

    it("Section 12: Browser-vs-server differences present", () => {
      expect(doc()).toMatch(/^##\s+12\.\s+Browser/im);
    });

    it("Section 13: Forward to v5.0.0 present", () => {
      expect(doc()).toMatch(/^##\s+13\.\s+Forward/im);
    });
  });

  describe("Subpath imports cited in the doc resolve via dynamic import (LC-8-D)", () => {
    const subpaths = [
      // kadena-stoic-legacy (6)
      "@stoachain/kadena-stoic-legacy",
      "@stoachain/kadena-stoic-legacy/client",
      "@stoachain/kadena-stoic-legacy/cryptography-utils",
      "@stoachain/kadena-stoic-legacy/hd-wallet",
      "@stoachain/kadena-stoic-legacy/hd-wallet/chainweaver",
      "@stoachain/kadena-stoic-legacy/types",
      // stoa-core (13)
      "@stoachain/stoa-core",
      "@stoachain/stoa-core/constants",
      "@stoachain/stoa-core/network",
      "@stoachain/stoa-core/observability",
      "@stoachain/stoa-core/gas",
      "@stoachain/stoa-core/guard",
      "@stoachain/stoa-core/crypto",
      "@stoachain/stoa-core/errors",
      "@stoachain/stoa-core/signing",
      "@stoachain/stoa-core/wallet",
      "@stoachain/stoa-core/reads",
      "@stoachain/stoa-core/pact",
      "@stoachain/stoa-core/dalos",
      // ouronet-core (5 explicit + representative ./interactions/* entries)
      "@ouronet/ouronet-core",
      "@ouronet/ouronet-core/constants",
      "@ouronet/ouronet-core/codex",
      "@ouronet/ouronet-core/pact",
      "@ouronet/ouronet-core/interactions",
      "@ouronet/ouronet-core/interactions/dexFunctions",
      "@ouronet/ouronet-core/interactions/ouroFunctions",
      "@ouronet/ouronet-core/interactions/dexSwapPairCalcFunctions",
      "@ouronet/ouronet-core/interactions/dexSwapPairDashboardFunctions",
      "@ouronet/ouronet-core/interactions/dexTrueFungibleFunctions",
      "@ouronet/ouronet-core/interactions/ouroAccountFunctions",
      "@ouronet/ouronet-core/interactions/ouroWrapFunctions",
      "@ouronet/ouronet-core/interactions/ouroPrimordialsFunctions",
      "@ouronet/ouronet-core/interactions/kadenaFunctions",
      "@ouronet/ouronet-core/interactions/errors",
    ];

    for (const subpath of subpaths) {
      it(`Subpath '${subpath}' resolves via dynamic import()`, async () => {
        const mod = (await import(subpath)) as Record<string, unknown>;
        expect(mod).toBeDefined();
        expect(typeof mod).toBe("object");
      });
    }
  });

  describe("Error classes cited in the doc resolve to constructors (LC-8-E)", () => {
    type ErrorCase = { name: string; subpath: string };
    const errorCases: ErrorCase[] = [
      // The v4.1.1 mandated 5 (REQ-32 §5):
      // KadenaShapeError lives at the entity-oriented `interactions/errors` glob
      // entry (per LC-8-F + the post-v4.1.1 errors.ts birth) — the broader
      // `./interactions` barrel re-exports only `ouroFunctions`.
      { name: "KadenaShapeError", subpath: "@ouronet/ouronet-core/interactions/errors" },
      { name: "MnemonicMismatchError", subpath: "@stoachain/stoa-core/wallet" },
      { name: "SmartAccountAuthError", subpath: "@stoachain/stoa-core/signing" },
      { name: "CodexUnknownFieldError", subpath: "@ouronet/ouronet-core/codex" },
      { name: "UnknownSeedTypeError", subpath: "@ouronet/ouronet-core/codex" },
      // Broader consumer-relevant set (LC-8-E stretch):
      { name: "WrongPasswordError", subpath: "@stoachain/stoa-core/crypto" },
      { name: "CorruptEnvelopeError", subpath: "@stoachain/stoa-core/crypto" },
      { name: "UnsupportedFormatError", subpath: "@stoachain/stoa-core/crypto" },
      { name: "SigningError", subpath: "@stoachain/stoa-core/errors" },
      { name: "UnknownPredicateError", subpath: "@stoachain/stoa-core/guard" },
      { name: "InvalidLoggerError", subpath: "@stoachain/stoa-core/observability" },
      { name: "InvalidPactReaderError", subpath: "@stoachain/stoa-core/reads" },
      { name: "InvalidEnvelopeError", subpath: "@stoachain/stoa-core/signing" },
      { name: "TamperedHashError", subpath: "@stoachain/stoa-core/signing" },
    ];

    for (const { name, subpath } of errorCases) {
      it(`${name} imports successfully from ${subpath}`, async () => {
        const mod = (await import(subpath)) as Record<string, unknown>;
        const Ctor = mod[name];
        expect(typeof Ctor).toBe("function");
        const inst = new (Ctor as new (msg: string) => Error)("test");
        expect(inst).toBeInstanceOf(Error);
      });
    }
  });

  describe("Seam functions cited in the doc are exported from cited subpaths (LC-8-F)", () => {
    it("setPactReader is exported from @stoachain/stoa-core/reads", async () => {
      const mod = (await import("@stoachain/stoa-core/reads")) as Record<string, unknown>;
      expect(typeof mod.setPactReader).toBe("function");
    });

    it("rawCalibratedDirtyRead is exported from @stoachain/stoa-core/reads", async () => {
      const mod = (await import("@stoachain/stoa-core/reads")) as Record<string, unknown>;
      expect(typeof mod.rawCalibratedDirtyRead).toBe("function");
    });

    it("pactRead is exported from @stoachain/stoa-core/reads", async () => {
      const mod = (await import("@stoachain/stoa-core/reads")) as Record<string, unknown>;
      expect(typeof mod.pactRead).toBe("function");
    });

    it("CodexSigningStrategy is exported from @stoachain/stoa-core/signing", async () => {
      const mod = (await import("@stoachain/stoa-core/signing")) as Record<string, unknown>;
      expect(typeof mod.CodexSigningStrategy).toBe("function");
    });

    it("KadenaWallet is exported from @stoachain/stoa-core/wallet", async () => {
      const mod = (await import("@stoachain/stoa-core/wallet")) as Record<string, unknown>;
      expect(typeof mod.KadenaWallet).toBe("function");
    });

    it("setLogger is exported from @stoachain/stoa-core/observability", async () => {
      const mod = (await import("@stoachain/stoa-core/observability")) as Record<string, unknown>;
      expect(typeof mod.setLogger).toBe("function");
    });

    it("getLogger is exported from @stoachain/stoa-core/observability", async () => {
      const mod = (await import("@stoachain/stoa-core/observability")) as Record<string, unknown>;
      expect(typeof mod.getLogger).toBe("function");
    });
  });

  describe("Cross-references to MIGRATION docs are valid (LC-8-H)", () => {
    it("MIGRATION-v4.md exists at repo root and is cross-referenced", () => {
      expect(existsSync(migrationV4Path)).toBe(true);
      const doc = readFileSync(integrationPath, "utf8");
      expect(doc).toMatch(/MIGRATION-v4\.md/);
    });

    it("MIGRATION-v4.1.md exists at repo root and is cross-referenced", () => {
      expect(existsSync(migrationV41Path)).toBe(true);
      const doc = readFileSync(integrationPath, "utf8");
      expect(doc).toMatch(/MIGRATION-v4\.1\.md/);
    });

    it("MIGRATION-v4.2.md exists at repo root and is cross-referenced", () => {
      expect(existsSync(migrationV42Path)).toBe(true);
      const doc = readFileSync(integrationPath, "utf8");
      expect(doc).toMatch(/MIGRATION-v4\.2\.md/);
    });
  });
});
