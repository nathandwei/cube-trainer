import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, createRng, randomScramble, scrambledState, stateKey } from "@/cube";
import { scrambleOf } from "./cubeScramble";

describe("scrambleOf", () => {
  it.each([1, 2, 3, 4, 5])("writes turns from solved (solver frame) as a scramble that reaches the same state, %i", (seed) => {
    // Any turns from solved will do: a random scramble's, read as solver-frame turns.
    const turns = randomScramble(createRng(seed)).split(" ");
    expect(stateKey(scrambledState(scrambleOf(turns)))).toBe(stateKey(applyAlg(SOLVED, turns)));
  });
});
