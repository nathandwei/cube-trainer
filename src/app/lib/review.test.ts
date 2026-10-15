import { describe, expect, it } from "vitest";
import type { Stage } from "@/cube/types";
import { bestPossibleMoves, flow, pauseMs, verdictForExtraMoves } from "./review";

function pair(overrides: Partial<Stage>): Stage {
  return {
    kind: "pair",
    label: "p1",
    startMove: 0,
    endMove: 8,
    recognitionMs: 500,
    executionMs: 1000,
    totalMs: 1500,
    moveCount: 8,
    longestPauseMs: 0,
    ...overrides,
  };
}

describe("verdictForExtraMoves", () => {
  it.each([
    [0, "best"],
    [1, "excellent"],
    [2, "good"],
    [3, "inaccuracy"],
    [5, "mistake"],
    [9, "blunder"],
  ] as const)("%i extra moves is %s", (extra, verdict) => {
    expect(verdictForExtraMoves(extra)).toBe(verdict);
  });
});

describe("bestPossibleMoves", () => {
  it.each([
    { name: "no optimum known", stage: pair({}), expected: null },
    { name: "chosen slot optimum", stage: pair({ optimalMoves: 7 }), expected: 7 },
    {
      name: "easier slot elsewhere",
      stage: pair({ optimalMoves: 9, bestAlternative: { slot: "BR", moves: 5, solution: "" } }),
      expected: 5,
    },
  ])("$name", ({ stage, expected }) => {
    expect(bestPossibleMoves(stage)).toBe(expected);
  });
});

describe("pauses and flow", () => {
  const moves = [
    { move: "R", t: 0 },
    { move: "U", t: 150 },
    { move: "R'", t: 1150 },
    { move: "U'", t: 1300 },
  ];

  it("counts only gaps longer than the pause threshold", () => {
    expect(pauseMs(moves)).toBe(1000);
  });

  it("reports the turning share", () => {
    expect(flow(moves, 2000)).toBe(50);
  });
});
