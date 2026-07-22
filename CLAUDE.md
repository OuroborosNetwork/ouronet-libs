# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository purpose

`ouronet-libs` is the **Ouronet-level** half of the stack — a two-package npm workspace publishing to the public `@ouronet` scope:

- **`@ouronet/ouronet-core`** (`4.x`) — Ouronet protocol business logic: the codex backup format, the 13 `interactions/*` Pact builders for the `ouronet-ns` modules, the `STOA_AUTONOMIC_*` accounts, and the cfm Pact-code assembler.
- **`@ouronet/ouronet-codex`** (independent `0.x`) — the modular React Codex layer consumer apps mount.

Treat this as a library repo, not an app: no UI shell, no server, no runtime entry point. Every change ripples to consumers via npm publish.

**Split out of `StoaChain/stoa-js`** in the Phase-4 reorg so published identity matches org ownership. The chain-level halves stay there and are consumed here from npm as ordinary dependencies — never vendored, never duplicated:

- `@stoachain/stoa-core` — chain-generic foundation
- `@stoachain/kadena-stoic-legacy` — vendored `@kadena/*`

The dependency direction is one-way: **ouronet-libs → stoa-js**, never the reverse. If something here needs a change in a `@stoachain/*` package, that change ships from `stoa-js` first and lands here as a version bump.

## Renamed from `@stoachain/*`

| Was | Now |
|---|---|
| `@stoachain/ouronet-core` | `@ouronet/ouronet-core` |
| `@stoachain/ouronet-codex` | `@ouronet/ouronet-codex` |

The version lines continue unbroken across the rename (core resumed at `4.3.6`, codex at `0.5.7`). The old names are deprecated on npm and point here; they receive no further releases. Never reintroduce a `@stoachain/ouronet-*` import — those specifiers are dead.

## Common commands

```bash
npm install        # installs @stoachain/* from npm alongside the workspace packages
npm run typecheck  # tsc --noEmit across both packages
npm run build      # ouronet-core → ouronet-codex (order is significant)
npm test           # vitest across both packages
npm run clean      # rimraf dist/
```

Per-package: `npm run <script> --workspace=@ouronet/ouronet-core`.
Single test: `npx vitest run tests/cfm-builders.test.ts --root packages/ouronet-core`, or `-t "name fragment"`.

## Module layout — subpath exports

Every directory under `packages/ouronet-core/src/` corresponds to a subpath export declared in `package.json`. Consumers are steered toward subpath imports for tree-shaking — `src/index.ts` is intentionally near-empty (`export {}`):

```ts
import { serializeCodex } from "@ouronet/ouronet-core/codex";        // good
import { serializeCodex } from "@ouronet/ouronet-core";              // not supported
```

`./interactions` is special: the directory holds 13 files with overlapping symbol names, so the barrel re-exports only `ouroFunctions` (the canonical type source). The others are reached via the `./interactions/*` glob export — e.g. `@ouronet/ouronet-core/interactions/wrapFunctions`.

## Architectural patterns to preserve

**The codex backup format is frozen at `"1.2"`.** `packages/ouronet-core/src/codex/codec.ts` — do not bump the version string. Read its JSDoc before touching the codec.

**Backwards-compat type duplication is intentional in places.** `IKadenaKeypair` is canonically defined in `@stoachain/stoa-core`'s signing types, but a structurally identical type still exists in `interactions/ouroFunctions` for older imports. Don't "consolidate" without checking the comment trail.

**Smart Ouronet Account auth (`Σ.` prefix) uses three branches.** The `enforce-one` resolves over account guard / sovereign guard / governor. The signing strategy itself takes a single AND-of-keysets array — the consumer picks the branch before calling `execute`. Standard accounts (`Ѻ.` prefix) use a single keyset.

**Never re-vendor the chain layer.** If a `@stoachain/*` symbol is missing, add it upstream in `stoa-js` and bump the dependency — do not copy the implementation here.

## Dev-time resolution

`tsconfig.base.json` carries dev-time `paths` for the `@ouronet/*` workspace packages only — they resolve to source files so typecheck and IDE intellisense work without a build. The `@stoachain/*` packages deliberately have **no** path mapping: they resolve from `node_modules` exactly as a consumer sees them. Per-package `tsconfig.build.json` overrides `paths: {}`. The vitest configs mirror the same rule with `resolve.alias`.

Build order is significant: `ouronet-core` before `ouronet-codex` (codex peer-deps core). Lexical workspace ordering would do the wrong thing — the root script makes the order explicit.

## Publishing flow

The two packages carry **independent** version lines, so one tag ships one package:

```bash
git tag -a v4.3.6 -m "..."   # → publishes @ouronet/ouronet-core
git tag -a v0.5.7 -m "..."   # → publishes @ouronet/ouronet-codex
git push origin --tags
```

1. Bump the shipping package's `package.json` + add its `CHANGELOG.md` entry + update its `README.md` Status block and version history.
2. Commit, tag (annotated — the message becomes the GitHub Release body), push.
3. `.github/workflows/publish.yml` typechecks, builds, tests, verifies each queued package's README/CHANGELOG references the shipping version, publishes with `--provenance`, and creates the GitHub Release. Publishing uses the `NPM_PUBLISHER` secret.

The doc-parity gates are load-bearing — never push a tag whose number disagrees with `package.json`.

## Versioning discipline

Strict semver, independent per package. Breaking changes → major bump → consumers upgrade deliberately. Never silently change the shape of a public type or barrel export — this library exists to keep OuronetUI, StoaWallet, and the HUB from forking logic, and a stable surface is the whole point. Each `CHANGELOG.md` is the source of truth for that package.
