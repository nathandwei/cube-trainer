import { describe, expect, it } from "vitest";
import { crossDistance, scrambledState } from "@/cube";
import type { SolveAnalysis, Stage } from "@/cube/types";
import { slotInView, type TimedToken } from "@/app/lib/display";
import { momentsInOrder } from "@/app/lib/review";
import {
  bestLines,
  currentToken,
  drillFor,
  focusedStage,
  nextStageTarget,
  previousStageTarget,
  sentenceCase,
  stageName,
  stageOfToken,
  stageSpans,
  type Span,
} from "./model";

function turn(text: string, start: number): TimedToken {
  return { kind: "turn", text, start, end: start + 1, t: start * 100 };
}

function rotation(text: string, after: number): TimedToken {
  return { kind: "rotation", text, start: after, end: after, t: after * 100 };
}

function stage(overrides: Partial<Stage>): Stage {
  return {
    kind: "pair",
    label: "p1",
    startMove: 0,
    endMove: 8,
    recognitionMs: 300,
    executionMs: 1000,
    totalMs: 1300,
    moveCount: 8,
    longestPauseMs: 0,
    ...overrides,
  };
}

// Two stages of two turns each, with a rotation between them: R U | y R' U'.
const TOKENS = [turn("R", 0), turn("U", 1), rotation("y", 2), turn("R'", 2), turn("U'", 3)];
const STAGES = [stage({ label: "cross", kind: "cross", startMove: 0, endMove: 2 }), stage({ startMove: 2, endMove: 4 })];
const SPANS: Span[] = [
  { start: 0, end: 2 },
  { start: 2, end: 5 },
];

describe("stageSpans", () => {
  it("gives a rotation at a boundary to the stage it opens and runs the last stage to the end", () => {
    expect(stageSpans(TOKENS, STAGES)).toEqual(SPANS);
  });
});

describe("stageOfToken", () => {
  it.each([
    [-1, 0],
    [0, 0],
    [1, 0],
    [2, 1],
    [4, 1],
    [9, 1],
  ])("token %i is in stage %i", (index, expected) => {
    expect(stageOfToken(SPANS, index)).toBe(expected);
  });
});

describe("focusedStage and currentToken", () => {
  it.each([
    { name: "nothing played", played: 0, pinned: null, stage: 0, current: null },
    { name: "end of the first stage", played: 2, pinned: null, stage: 0, current: 1 },
    { name: "a stage jumped to shows its start", played: 2, pinned: 1, stage: 1, current: null },
    { name: "the rotation opening a stage", played: 3, pinned: null, stage: 1, current: 2 },
    { name: "the end of the solve", played: 5, pinned: null, stage: 1, current: 4 },
  ])("$name", ({ played, pinned, stage: expectedStage, current }) => {
    const focus = focusedStage(SPANS, played, pinned);
    expect(focus).toBe(expectedStage);
    expect(currentToken(SPANS, focus, played)).toBe(current);
  });
});

describe("stage navigation", () => {
  it.each([
    { name: "mid-stage goes to its start", stage: 1, played: 4, expected: { stage: 1, played: 2 } },
    { name: "at a stage's start goes to the one before", stage: 1, played: 2, expected: { stage: 0, played: 0 } },
    { name: "stays at the very start", stage: 0, played: 0, expected: { stage: 0, played: 0 } },
  ])("previous: $name", ({ stage: from, played, expected }) => {
    expect(previousStageTarget(SPANS, from, played)).toEqual(expected);
  });

  it.each([
    { name: "goes to the next stage's start", stage: 0, expected: { stage: 1, played: 2 } },
    { name: "from the last stage goes to the end", stage: 1, expected: { stage: 1, played: 5 } },
  ])("next: $name", ({ stage: from, expected }) => {
    expect(nextStageTarget(SPANS, from)).toEqual(expected);
  });
});

describe("bestLines", () => {
  it.each([
    {
      name: "an easier pair elsewhere comes first",
      stage: stage({ slots: ["FR"], optimalMoves: 7, optimalSolution: "R U R' U' R U R'", bestAlternative: { slot: "BL", moves: 3, solution: "L' U L" } }),
      expected: [
        { moves: "L' U L", count: 3, slot: "BL" },
        { moves: "R U R' U' R U R'", count: 7, slot: "FR" },
      ],
    },
    {
      name: "the same slot is not listed twice",
      stage: stage({ slots: ["FR"], optimalMoves: 3, optimalSolution: "R U R'", bestAlternative: { slot: "FR", moves: 3, solution: "R U R'" } }),
      expected: [{ moves: "R U R'", count: 3, slot: "FR" }],
    },
    {
      name: "a two-pair stage has one joint line and no slot",
      stage: stage({ slots: ["FR", "FL"], optimalMoves: 9, optimalSolution: "R U R' L' U' L U2 R U' R'" }),
      expected: [{ moves: "R U R' L' U' L U2 R U' R'", count: 9 }],
    },
    {
      name: "an ungraded step has none",
      stage: stage({ kind: "xcross", slots: ["FR", "FL"], optimalMoves: 8, optimalSolution: "R U R' U' R U R' D" }),
      expected: [],
    },
    { name: "the last layer has none", stage: stage({ kind: "coll", caseName: "T3" }), expected: [] },
  ])("$name", ({ stage: input, expected }) => {
    expect(bestLines(input)).toEqual(expected);
  });

  it("lists up to three optimal crosses from the cross's start", () => {
    const start = scrambledState("R2 F L' U R2 D2 F B2 L B U2 F2 U' F2 D2 L2 F2 D2 L2 D");
    const optimum = crossDistance(start);
    const lines = bestLines(stage({ kind: "cross", label: "cross", optimalMoves: optimum, optimalSolution: "x" }), start);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(new Set(lines.map((line) => line.moves)).size).toBe(lines.length);
    for (const line of lines) expect(line.count).toBe(optimum);
  });
});

describe("slotInView", () => {
  it.each([
    { name: "no rotation keeps the name", tokens: [turn("R", 0)], slot: "BR", expected: "BR" },
    { name: "after y the back-right slot is in front", tokens: [rotation("y", 0)], slot: "BR", expected: "FR" },
    { name: "after y' the front-left slot is in front-right", tokens: [rotation("y'", 0)], slot: "FL", expected: "FR" },
    { name: "a tipped view keeps the centre-frame name", tokens: [rotation("x", 0)], slot: "FR", expected: "FR" },
  ] as const)("$name", ({ tokens, slot, expected }) => {
    expect(slotInView(tokens, tokens.length, slot)).toBe(expected);
  });
});

describe("drillFor", () => {
  const all = () => true;
  const casesOnly = (id: string) => id !== "lookahead";
  it.each([
    { kind: "pair", exists: all, expected: "lookahead" },
    { kind: "pair", exists: casesOnly, expected: "F2L" },
    { kind: "coll", exists: all, expected: "COLL" },
    { kind: "epll", exists: all, expected: "EPLL" },
    { kind: "ll", exists: all, expected: null },
    { kind: "eo", exists: () => false, expected: null },
  ] as const)("a pause before $kind drills $expected", ({ kind, exists, expected }) => {
    expect(drillFor(stage({ kind }), exists)).toBe(expected);
  });
});

describe("momentsInOrder", () => {
  it("puts a pause before the extra moves of the stage it delays", () => {
    const analysis: SolveAnalysis = {
      totalMs: 6000,
      moveCount: 30,
      solved: true,
      stages: [
        stage({ kind: "cross", label: "cross", startMove: 0, endMove: 8, moveCount: 8, optimalMoves: 5 }),
        stage({ label: "p1", startMove: 8, endMove: 18, moveCount: 10, optimalMoves: 6, slots: ["FR"], recognitionMs: 1500 }),
      ],
    };
    expect(momentsInOrder(analysis).map((m) => `${m.kind} ${m.stageIndex}`)).toEqual(["moves 0", "pause 1", "moves 1"]);
  });
});

describe("labels", () => {
  it.each([
    ["cross", "Cross"],
    ["xcross", "XCross"],
    ["p1", "P1"],
    ["p4", "P4"],
    ["eo", "EO"],
    ["coll", "COLL"],
    ["epll", "EPLL"],
    ["ocll", "OCLL"],
    ["pll", "PLL"],
    ["ll", "LL"],
  ])("stage %s shows as %s", (label, expected) => {
    expect(stageName(label)).toBe(expected);
  });

  it.each([
    ["best", "Best"],
    ["inaccuracy", "Inaccuracy"],
    ["pause", "Pause"],
  ])("%s shows as %s", (word, expected) => {
    expect(sentenceCase(word)).toBe(expected);
  });
});
