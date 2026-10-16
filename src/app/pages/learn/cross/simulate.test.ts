import { describe, expect, it } from "vitest";
import { applyAlg, createRng, scrambledState } from "@/cube";
import { bestSolutions, countTurns, isGoal } from "./attempt";
import { simulateAttempt } from "./simulate";

const SCRAMBLES = [
  "B2 D' R2 F2 U' L2 D R2 U2 B' L F' D2 R U' F2 L' D B2 U'",
  "R' U2 F2 L2 D' F2 U L2 D2 B2 U' R B' D' F' R2 U' L' F R",
  "L2 F2 U' B2 R2 D B2 D' F2 U2 R' B L' U' F2 D L2 R' B' U",
];

describe("simulateAttempt", () => {
  it.each(
    (["cross", "xcross"] as const).flatMap((variant) => SCRAMBLES.flatMap((scramble) => [1, 2, 3, 4].map((seed) => ({ variant, scramble, seed })))),
  )("$variant, seed $seed: finishes the goal in exactly best + extra moves", ({ variant, scramble, seed }) => {
    const state = scrambledState(scramble);
    const attempt = simulateAttempt(variant, state, createRng(seed));
    expect(isGoal(variant, applyAlg(state, attempt.turns))).toBe(true);
    expect(countTurns(attempt.turns)).toBe(bestSolutions(variant, state, 1).moves + attempt.extra);
    expect(attempt.extra).toBeGreaterThanOrEqual(0);
    expect(attempt.extra).toBeLessThanOrEqual(2);
  });

  it("reports quarter turns, timed from the first one, never going back", () => {
    const attempt = simulateAttempt("cross", scrambledState(SCRAMBLES[0]!), createRng(9));
    expect(attempt.turns.every((turn) => !turn.endsWith("2"))).toBe(true);
    expect(attempt.atMs[0]).toBe(0);
    expect(attempt.atMs).toHaveLength(attempt.turns.length);
    attempt.atMs.slice(1).forEach((t, i) => expect(t).toBeGreaterThan(attempt.atMs[i]!));
    expect(attempt.planMs).toBeGreaterThan(1000);
  });

  it("is sometimes over the best, mostly not", () => {
    const state = scrambledState(SCRAMBLES[1]!);
    const extras = Array.from({ length: 60 }, (_, seed) => simulateAttempt("cross", state, createRng(seed)).extra);
    const best = extras.filter((extra) => extra === 0).length;
    expect(best).toBeGreaterThan(20);
    expect(best).toBeLessThan(60);
  });
});
