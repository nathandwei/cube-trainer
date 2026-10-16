import { describe, expect, it } from "vitest";
import type { SolveAnalysis, Stage } from "@/cube/types";
import { bestPossibleMoves, flow, movesMoments, pauseMs, pauseSummary, reportMoments, verdictForExtraMoves } from "./review";

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
    [9, "mistake"],
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
      stage: pair({ slots: ["FR"], optimalMoves: 9, bestAlternative: { slot: "BR", moves: 5, solution: "" } }),
      expected: 5,
    },
    {
      name: "a two-pair stage ignores single-pair alternatives",
      stage: pair({ slots: ["FR", "FL"], optimalMoves: 9, bestAlternative: { slot: "FL", moves: 6, solution: "" } }),
      expected: 9,
    },
    {
      name: "a multi-pair xcross is not graded",
      stage: pair({ kind: "xcross", slots: ["FR", "FL"], optimalMoves: 8 }),
      expected: null,
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

function solve(stages: Stage[]): SolveAnalysis {
  return { stages, totalMs: 10000, moveCount: 60, solved: true };
}

// Cross 2 over, P1 4 over after a 1.2 s pause, P2 3 over after 1.5 s, P3 fine after 0.6 s, EO after 1.0 s.
const SOLVE = solve([
  pair({ kind: "cross", label: "cross", moveCount: 7, optimalMoves: 5, recognitionMs: 2000 }),
  pair({ label: "p1", moveCount: 11, optimalMoves: 7, recognitionMs: 1200 }),
  pair({ label: "p2", moveCount: 10, optimalMoves: 7, recognitionMs: 1500 }),
  pair({ label: "p3", moveCount: 7, optimalMoves: 7, recognitionMs: 600 }),
  pair({ kind: "eo", label: "eo", moveCount: 6, recognitionMs: 1000 }),
]);

describe("movesMoments", () => {
  it.each([
    { limit: 3, expected: [0, 1, 2] },
    { limit: 2, expected: [1, 2] },
    { limit: 1, expected: [1] },
    { limit: 0, expected: [] },
  ])("keeps the costliest $limit in solve order", ({ limit, expected }) => {
    expect(movesMoments(SOLVE, limit).map((moment) => moment.stageIndex)).toEqual(expected);
  });
});

describe("pauseSummary", () => {
  it("sums every long pause after the first stage and names the longest", () => {
    expect(pauseSummary(SOLVE)).toEqual({ count: 3, totalMs: 3700, longest: { stageIndex: 2, ms: 1500 } });
  });

  it("has none without a long pause", () => {
    expect(pauseSummary(solve([pair({ recognitionMs: 3000 }), pair({ recognitionMs: 500 })]))).toBeNull();
  });
});

describe("reportMoments", () => {
  it("gives the pauses one row and the extra moves the rest", () => {
    const { moves, pauses } = reportMoments(SOLVE);
    expect(moves.map((moment) => moment.stageIndex)).toEqual([1, 2]);
    expect(pauses?.count).toBe(3);
  });

  it("gives every row to extra moves when nothing paused", () => {
    const calm = solve(SOLVE.stages.map((stage) => ({ ...stage, recognitionMs: 300 })));
    expect(reportMoments(calm)).toEqual({ moves: movesMoments(calm, 3), pauses: null });
  });
});
