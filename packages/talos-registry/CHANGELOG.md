# @ouronet/talos-registry

## 1.0.0

First release. 423 entrypoints, 428 previews, surface `67c0979111eb156b`, generated against
mainnet by `REPL/tools/_registry.py --probe`.

* `buildCall` / `buildPreviewCall` / `buildGhostCall` — arguments by NAME, rendered in the
  contract's declared order and checked against the deployed signature.
* `planCall` / `explainCall` — preflight reads, capability reader, signers, transaction count
  and the warnings that live in different keys of the record.
* `capabilityRecipe` / `parseCapabilities` — the four launchpad buys.
* `formatForType` — Pact literal rules: decimals never bare, lists space-separated, glyph
  strings verbatim, guards as `(read-keyset "name")`.
* Full types for the record.

450 tests, including one per entrypoint asserting its ghost builds.
