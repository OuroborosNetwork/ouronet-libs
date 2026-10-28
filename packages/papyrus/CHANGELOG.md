# Changelog

## 0.1.1 — 2026-10-28

**`planBatchesVerified` is exported. In 0.1.0 it was not, and that made it unreachable.**

`package.json` `exports` admits `"."` alone — a deliberate choice, so that the surface is one
curated list rather than whatever file layout `dist/` happens to have. The cost of that choice is
that `index.ts` is not documentation, it is the **boundary**: a symbol missing from it cannot be
imported by any path, no matter that it is sitting in `dist/batch.js` with its types alongside.

0.1.0's index exported `ProbeOutcome` and `VerifiedBatchPlan` — the argument type and the result
type of `planBatchesVerified` — and not the function between them. So the published surface
advertised a signature nobody could call. It was found the way these are always found: the first
consumer wired the package and its three batched flows had nothing to import.

- **`planBatchesVerified` re-exported**, with a comment saying what distinguishes it from the
  synchronous `planStakeBatches` it replaced: it probes candidate batches and returns a plan only
  when the plan's **largest** batch was simulated under the ceiling.
- **`tests/surface.test.ts`** — the index may REORDER and ANNOTATE, and may not OMIT. Runtime
  exports are compared as module keys, so there is no string matching to fool; types are compared
  as name sets parsed from sources with comments stripped first, because a name in prose is not a
  name exported. Both halves were mutation-checked: dropping the function fails two assertions,
  dropping a type fails one.

A curated list is worth keeping — it is the only place a reader learns the shape of a surface —
but a hand-kept list of an evolving module falls behind, and this is what makes it safe to keep.

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
