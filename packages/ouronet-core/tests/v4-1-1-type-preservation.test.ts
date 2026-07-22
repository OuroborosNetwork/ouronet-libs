/**
 * REQ-29: ouronet-core public type shape preservation.
 * Locks critical type exports against accidental shape changes.
 * If the type structure changes, these tests fail at typecheck time.
 */
import { describe, it, expectTypeOf } from "vitest";
import { KadenaShapeError } from "@ouronet/ouronet-core/interactions/errors";
import { CodexUnknownFieldError, UnknownSeedTypeError } from "@ouronet/ouronet-core/codex";
import type { SeedType } from "@ouronet/ouronet-core/codex";

describe("REQ-29: ouronet-core public type-shape preservation", () => {
  it("KadenaShapeError extends Error class", () => {
    expectTypeOf<KadenaShapeError>().toMatchTypeOf<Error>();
  });

  it("CodexUnknownFieldError extends Error class", () => {
    expectTypeOf<CodexUnknownFieldError>().toMatchTypeOf<Error>();
  });

  it("UnknownSeedTypeError extends Error class", () => {
    expectTypeOf<UnknownSeedTypeError>().toMatchTypeOf<Error>();
  });

  it("SeedType (re-exported from stoa-core/wallet) is `koala | chainweaver | eckowallet`", () => {
    expectTypeOf<SeedType>().toEqualTypeOf<"koala" | "chainweaver" | "eckowallet">();
  });
});
