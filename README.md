# ouronet-libs

The **Ouronet** TypeScript stack — the Ouronet-level half of what used to be
[`StoaChain/stoa-js`](https://github.com/StoaChain/stoa-js), split out in the Phase-4
reorganisation so that package identity matches org ownership.

| Package | Version | What it is |
|---|---|---|
| [`@ouronet/ouronet-core`](./packages/ouronet-core) | `4.3.6` | Ouronet protocol business logic |
| [`@ouronet/ouronet-codex`](./packages/ouronet-codex) | `0.5.7` | Modular React Codex layer for consumer apps |

## Relationship to stoa-js

The **chain-level** packages stay in `stoa-js` and are consumed here from npm as ordinary
dependencies — they are *not* vendored or duplicated:

- `@stoachain/stoa-core` — chain-generic foundation
- `@stoachain/kadena-stoic-legacy` — vendored `@kadena/*`

So the dependency direction is one-way: **ouronet-libs → stoa-js**, never the reverse.

## Renamed from `@stoachain/*`

These packages were previously published under the StoaChain scope. The version lines continue
unbroken across the rename:

| Was | Now |
|---|---|
| `@stoachain/ouronet-core` | `@ouronet/ouronet-core` |
| `@stoachain/ouronet-codex` | `@ouronet/ouronet-codex` |

The old names are deprecated on npm and point here. Consumers should install the `@ouronet/*`
names; the old ones receive no further releases.

## Develop

```sh
npm install         # installs @stoachain/* from npm alongside the workspace packages
npm run typecheck
npm run build       # ouronet-core → ouronet-codex
npm test
```

## Release

Push a version tag matching the package you're shipping — the two carry **independent** version
lines, so one tag ships one package:

```sh
git tag -a v4.3.6 -m "…"   # → publishes @ouronet/ouronet-core
git tag -a v0.5.7 -m "…"   # → publishes @ouronet/ouronet-codex
git push origin --tags
```

`.github/workflows/publish.yml` typechecks, builds, tests, verifies each queued package's
README/CHANGELOG references the shipping version, publishes with provenance, and creates the
GitHub Release. Publishing uses the `NPM_PUBLISHER` secret.
