import { describe, expect, it } from "vitest";
import {
  SOLVED,
  applyAlg,
  crossDistance,
  isCrossSolved,
  isSlotSolved,
  scrambledState,
  solveXCross,
  solvedSlots,
} from "@/cube";
import { bestSolutions, countTurns, isGoal, toneOf, verdictOf } from "./attempt";

const SCRAMBLES = [
  "B2 D' R2 F2 U' L2 D R2 U2 B' L F' D2 R U' F2 L' D B2 U'",
  "R' U2 F2 L2 D' F2 U L2 D2 B2 U' R B' D' F' R2 U' L' F R",
  "L2 F2 U' B2 R2 D B2 D' F2 U2 R' B L' U' F2 D L2 R' B' U",
];

describe("countTurns", () => {
  it.each([
    { turns: [], count: 0 },
    { turns: ["R"], count: 1 },
    { turns: ["R2"], count: 1 },
    { turns: ["R", "R"], count: 1 },
    { turns: ["R'", "R'"], count: 1 },
    { turns: ["R", "R'"], count: 2 },
    { turns: ["R", "R", "R"], count: 2 },
    { turns: ["R", "U", "R"], count: 3 },
    { turns: ["U", "D", "U"], count: 2 },
    { turns: ["R", "L'", "R", "L'"], count: 2 },
    { turns: ["F'", "F'", "R", "D2"], count: 3 },
  ])("$turns: $count", ({ turns, count }) => {
    expect(countTurns(turns)).toBe(count);
  });

  it("rejects anything but outer turns", () => {
    expect(() => countTurns(["M"])).toThrow(/outer face turn/);
  });
});

describe("isGoal", () => {
  // Sexy moves on every side keep the cross (each face's D edge comes straight back) and break every pair.
  const crossOnly = applyAlg(SOLVED, "R U R' U' L U L' U' F U F' U' B U B' U'");
  const crossAndPair = applyAlg(SOLVED, "L U L' U' F U F' U' B U B' U'");
  const broken = applyAlg(SOLVED, "F");

  it("starts from the states it claims", () => {
    expect(isCrossSolved(crossOnly) && solvedSlots(crossOnly).length === 0).toBe(true);
    expect(isCrossSolved(crossAndPair) && solvedSlots(crossAndPair).length > 0).toBe(true);
  });

  it.each([
    { name: "solved cube, cross", variant: "cross", state: SOLVED, done: true },
    { name: "solved cube, xcross", variant: "xcross", state: SOLVED, done: true },
    { name: "cross and no pair, cross", variant: "cross", state: crossOnly, done: true },
    { name: "cross and no pair, xcross", variant: "xcross", state: crossOnly, done: false },
    { name: "cross and a pair, xcross", variant: "xcross", state: crossAndPair, done: true },
    { name: "broken cross, cross", variant: "cross", state: broken, done: false },
    { name: "broken cross, xcross", variant: "xcross", state: broken, done: false },
  ] as const)("$name", ({ variant, state, done }) => {
    expect(isGoal(variant, state)).toBe(done);
  });
});

describe("bestSolutions", () => {
  it.each(SCRAMBLES)("cross: every line is optimal and solves it (%s)", (scramble) => {
    const state = scrambledState(scramble);
    const best = bestSolutions("cross", state);
    expect(best.moves).toBe(crossDistance(state));
    expect(best.lines.length).toBeGreaterThanOrEqual(1);
    expect(best.lines.length).toBeLessThanOrEqual(3);
    for (const line of best.lines) {
      expect(line.moves).toHaveLength(best.moves);
      expect(isCrossSolved(applyAlg(state, line.moves))).toBe(true);
    }
  });

  it.each(SCRAMBLES)("xcross: every line is optimal and solves its slot (%s)", (scramble) => {
    const state = scrambledState(scramble);
    const best = bestSolutions("xcross", state);
    expect(best.moves).toBe(solveXCross(state)?.moves);
    expect(best.lines.length).toBeGreaterThanOrEqual(1);
    expect(best.lines.length).toBeLessThanOrEqual(3);
    expect(new Set(best.lines.map((line) => line.moves.join(" "))).size).toBe(best.lines.length);
    for (const line of best.lines) {
      expect(line.moves).toHaveLength(best.moves);
      const end = applyAlg(state, line.moves);
      expect(isCrossSolved(end)).toBe(true);
      expect(line.slot && isSlotSolved(end, line.slot)).toBe(true);
    }
  });

  it("honours a smaller limit", () => {
    expect(bestSolutions("cross", scrambledState(SCRAMBLES[0]!), 1).lines).toHaveLength(1);
  });
});

describe("grading", () => {
  it.each([
    { extra: 0, verdict: "best", tone: "good" },
    { extra: 1, verdict: "excellent", tone: "good" },
    { extra: 2, verdict: "good", tone: "ok" },
    { extra: 3, verdict: "inaccuracy", tone: "bad" },
    { extra: 4, verdict: "inaccuracy", tone: "bad" },
    { extra: 5, verdict: "mistake", tone: "bad" },
    { extra: 10, verdict: "mistake", tone: "bad" },
  ])("$extra over: $verdict, $tone", ({ extra, verdict, tone }) => {
    expect(verdictOf(extra)).toBe(verdict);
    expect(toneOf(extra)).toBe(tone);
  });
});
