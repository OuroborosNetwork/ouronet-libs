import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// During development the tests reach across the monorepo into
// `@stoachain/stoa-core/*` — but the published exports map points at
// `./dist/...`, which doesn't exist until `npm run build`. These
// aliases mirror the `paths` block in `tsconfig.base.json` so that
// vitest resolves the bare specifiers to TypeScript source files at
// runtime, matching the typecheck behaviour. Subpath order matters:
// the root `@stoachain/stoa-core` entry must come AFTER the
// subpath entries so vitest picks the most-specific match first.
//
// Phase 5 deviation from REQ-19 (locked):
// The phase plan called for 6 additional `@stoachain/kadena-stoic-legacy/*`
// alias entries appended at L30+ (mirroring the stoa-core/* pattern
// above). That pattern works for ouronet-core consuming stoa-core's
// pure-TypeScript source. It DOES NOT work for ouronet-core consuming
// kadena-stoic-legacy's vendored CJS source: the `src/*/index.ts` barrels
// re-export from sibling `.cjs` files whose internal `require("./X")`
// calls (bare-extension, upstream-preserved) cannot be resolved by
// Vitest's transform layer — Node's CJS resolver auto-resolves only
// `.js`/`.json`/`.node`, and the bare-to-`.cjs` rewrite happens only
// at copy time into `dist/` (per `packages/kadena-stoic-legacy/scripts/
// copy-vendor-files.cjs`). Pointing aliases at `src/` therefore breaks
// test files with `MODULE_NOT_FOUND` errors. (Phase 4 T4.4 applied the
// same decision for stoa-core's vitest.config; documented at
// packages/stoa-core/vitest.config.ts:3-25.)
//
// Resolution: no kadena-stoic-legacy aliases. Runtime resolution flows
// through the published `exports` map → `dist/*/index.js` (where bare
// requires have been rewritten with explicit `.cjs` extensions). Type
// resolution flows through `tsconfig.base.json`'s paths block (Phase 1
// T1.6) → `src/*/index.ts`. Both work; only Vitest's runtime alias
// path was incompatible.
const ouronetCoreSrc = resolve(__dirname, "src");

export default defineConfig({
  resolve: {
    alias: [
      // Self-referencing subpath aliases so test files can import from
      // `@ouronet/ouronet-core/interactions/*` without a built dist.
      { find: /^@ouronet\/ouronet-core\/interactions\/(.+)$/, replacement: `${ouronetCoreSrc}/interactions/$1.ts` },
      { find: /^@ouronet\/ouronet-core\/interactions$/, replacement: `${ouronetCoreSrc}/interactions/index.ts` },
      { find: /^@ouronet\/ouronet-core\/constants$/, replacement: `${ouronetCoreSrc}/constants/index.ts` },
      { find: /^@ouronet\/ouronet-core\/codex$/, replacement: `${ouronetCoreSrc}/codex/index.ts` },
      { find: /^@ouronet\/ouronet-core\/pact$/, replacement: `${ouronetCoreSrc}/pact/index.ts` },
      { find: /^@ouronet\/ouronet-core$/, replacement: `${ouronetCoreSrc}/index.ts` },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    typecheck: {
      enabled: true,
      tsconfig: "tsconfig.json",
      include: ["tests/types.test.ts"],
    },
  },
});
