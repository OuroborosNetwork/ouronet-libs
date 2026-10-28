# Changelog

## 0.1.0 — 2026-10-28

**The first slice of the Papyrus Engine, and deliberately a small one.**

The engine existed before this package did, and was implemented **three times across two
repositories** — `ZbomModal` in Codex, `RegistryOpCFMModal` in OuronetUI, and 28 bespoke modals
beside it. Nothing on screen said which one you were in, which is why it went a year unnoticed.
This package exists so that a change to how an Ouronet transaction is described, priced, signed
and reported is made once.

### What is here

- **the vocabulary** — the three members (Page, Roll, Leaf) and `PAPYRUS_VERSION`. A file with no
  imports at all. The Leaf was named 2026-10-28 for Smart Swap's dirty-read discovery popup: *"no
  zbom is used, but rather a small dirty read progress popup appears, then i click the sign, and
  the transaction executes."*
- **the batch planner** — `planStakeBatches`, `fitGasModel`, `solveBatchCount`,
  `planFromExceededProbe`, `perBatchPerNonce`. 538 lines importing nothing but
  `@stoachain/stoa-core`.

### What is NOT here, and why that is the point

Everything else in the engine still reaches into its host — a wallet context, a query cache,
redux, a toast library — about ten touchpoints across ~8,800 lines. **Lifting those before
inverting them would copy the engine rather than move it**, and a copy is what this package
exists to end. The extraction is phased in `PAPYRUS_ENGINE_SPEC.md`: P2 inverts the couplings in
place, where the consuming suite can prove behaviour is unchanged; P3 lifts what P2 has freed.

### Found by extracting

The package's tsconfig carries `noUncheckedIndexedAccess`, which OuronetUI's does not, so moving
the planner surfaced six index accesses the app had never held it to — including a `filter().map()`
pair that cannot be proven sound (rewritten as one `flatMap`) and a `reduce` seeded with
`batches[0]` where a zero-batch plan would have reached `undefined.length`. **An empty plan is now
refused rather than reduced over.** None of them was reachable in practice; all six are now
structurally impossible.
