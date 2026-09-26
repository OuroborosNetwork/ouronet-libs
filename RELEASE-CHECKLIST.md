# Releasing `@ouronet/ouronet-core` 5.0.0 and `@ouronet/talos-registry` 1.0.0

Both are **prepared, verified and committed — neither is published.** Publishing needs npm
credentials and is the owner's call; everything else is done.

## State

| package | version | tests | build | pack |
|---|---|---|---|---|
| `@ouronet/ouronet-core` | **5.0.0** (was 4.6.0) | 858 / 56 files | clean | 257.4 kB, 103 files |
| `@ouronet/talos-registry` | **1.0.0** (new) | 461 / 2 files | clean | 64.8 kB, 103 files → 18 |

## Why core is a MAJOR

Six transaction builders gained a required `executor`. That is breaking for every TypeScript
caller, and it is not cosmetic: without it they emit Pact the deployed contracts reject.

`SWP|C_ChangeOwnership` also **reordered** — the pool id moved last and `newOwner` became the
canon's `executee` — so a caller that merely adds an argument in the old position is still
wrong. Orders came from `Deploy/OURONET-REGISTRY.json`, generated from the deployed modules.

## The order matters

1. **Publish `@ouronet/ouronet-core@5.0.0` first.** `@ouronet/talos-registry` does not depend
   on it, but OuronetUI does, and the UI is currently running on a hand-copied `dist/`.
2. **Then `@ouronet/talos-registry@1.0.0`.**
3. **Then bump OuronetUI's pin** — `daimons/OuronetUI/package.json` pins
   `"@ouronet/ouronet-core": "4.6.0"` EXACTLY, so it must move to `5.0.0`.

### Do not bump the UI pin before publishing

It is an exact pin. Setting it to `5.0.0` while that version does not exist on the registry
makes `npm install` fail in the UI, and the failure is confusing — it looks like a broken
lockfile rather than an unpublished dependency. That is why it is still at `4.6.0` in the
committed tree.

### The UI is currently running on a copied dist

`daimons/OuronetUI/node_modules/@ouronet/ouronet-core/dist/` was overwritten by hand so the
fixes could be tested on localhost. **`npm install` wipes it.** If the UI suddenly regresses to
five TS2353 `executor` errors, that is what happened; re-copy or publish.

## Codex is unaffected

`@ouronet/ouronet-codex` peers on `>=4.3.0`, which 5.0.0 satisfies. Worth noting that an open
lower bound will keep accepting majors silently — a decision to revisit, not a blocker here.

## After publishing

```bash
cd daimons/OuronetUI
npm install                      # picks up the real 5.0.0
npx tsc --noEmit -p tsconfig.app.json   # MUST be 0 errors -- not `-p tsconfig.json`
npx vitest run
```

`tsconfig.json` is a project-references stub with `"files": []` — it checks **nothing** and
exits 0. Use `tsconfig.app.json`. Five real errors hid behind that for weeks.

## Keeping the registry snapshot honest

`@ouronet/talos-registry` bundles a snapshot of the registry rather than fetching at runtime.
Two checks keep it from rotting, and both are already wired:

- `npm run sync:check` in the package — fails when the bundle drifts from the Pact repo;
- `python3 REPL/tools/_pkgsync.py --check` in the Pact repo, run by the gate — reports when the
  package ships a different surface. Non-fatal, because the package may not be checked out.

When the contracts change: regenerate with `_registry.py --probe`, `npm run build` here, and
bump the registry package — **the callable surface moving is a release**, not a patch.
