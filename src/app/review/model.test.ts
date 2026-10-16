import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, crossDistance, scrambledState, solveXCross } from "@/cube";
import type { Stage } from "@/cube/types";
import { slotInView, type TimedToken } from "@/app/lib/display";
import {
  PAUSE_DRILL,
  bestLines,
  currentToken,
  focusedStage,
  nextStageTarget,
  previousStageTarget,
  sentenceCase,
  slotsMadeBy,
  stageDrill,
  stageName,
  stageOfToken,
  stageSpans,
  xcrossLines,
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

const SCRAMBLE = "R2 F L' U R2 D2 F B2 L B U2 F2 U' F2 D2 L2 F2 D2 L2 D";

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
        { moves: "L' U L", count: 3, slots: ["BL"], group: "best" },
        { moves: "R U R' U' R U R'", count: 7, slots: ["FR"], group: "best" },
      ],
    },
    {
      name: "the same slot is not listed twice",
      stage: stage({ slots: ["FR"], optimalMoves: 3, optimalSolution: "R U R'", bestAlternative: { slot: "FR", moves: 3, solution: "R U R'" } }),
      expected: [{ moves: "R U R'", count: 3, slots: ["FR"], group: "best" }],
    },
    {
      name: "a two-pair stage has one joint line making both pairs",
      stage: stage({ slots: ["FR", "FL"], optimalMoves: 9, optimalSolution: "R U R' L' U' L U2 R U' R'" }),
      expected: [{ moves: "R U R' L' U' L U2 R U' R'", count: 9, slots: ["FR", "FL"], group: "best" }],
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

  it("lists up to two optimal crosses from the cross's start", () => {
    const start = scrambledState(SCRAMBLE);
    const optimum = crossDistance(start);
    const lines = bestLines(stage({ kind: "cross", label: "cross", optimalMoves: optimum, optimalSolution: "x" }), start);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(new Set(lines.map((line) => line.moves)).size).toBe(lines.length);
    for (const line of lines) expect(line).toMatchObject({ count: optimum, slots: [], group: "best" });
  });

  it("names the pair an xcross's optimum makes", () => {
    const start = scrambledState(SCRAMBLE);
    const optimum = solveXCross(start);
    if (!optimum) throw new Error("no xcross found");
    const lines = bestLines(stage({ kind: "xcross", label: "xcross", slots: ["BL"], optimalMoves: optimum.moves, optimalSolution: optimum.solution }), start);
    expect(lines).toEqual([{ moves: optimum.solution, count: optimum.moves, slots: [optimum.slot], group: "best" }]);
  });
});

describe("xcrossLines", () => {
  it("gives the best xcross first, each for its own slot, at most one move longer", () => {
    const start = scrambledState(SCRAMBLE);
    const optimum = solveXCross(start);
    if (!optimum) throw new Error("no xcross found");
    const lines = xcrossLines(start);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines[0]?.count).toBe(optimum.moves);
    for (const line of lines) {
      expect(line.group).toBe("xcross");
      expect(line.count).toBeLessThanOrEqual(optimum.moves + 1);
      expect(slotsMadeBy(start, line.moves)).toContain(line.slots[0]);
    }
    expect(new Set(lines.map((line) => line.slots[0])).size).toBe(lines.length);
  });
});

describe("slotsMadeBy", () => {
  it.each([
    { name: "a pair put back", start: applyAlg(SOLVED, "R U R'"), moves: "R U' R'", expected: ["FR"] },
    { name: "nothing new", start: SOLVED, moves: "U", expected: [] },
  ] as const)("$name", ({ start, moves, expected }) => {
    expect(slotsMadeBy(start, moves)).toEqual(expected);
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

describe("stageDrill", () => {
  const all = () => true;
  it.each([
    { name: "the cross", stage: stage({ kind: "cross" }), caseId: null, expected: { path: "/learn/cross", label: "Drill cross" } },
    { name: "an xcross", stage: stage({ kind: "xcross" }), caseId: null, expected: { path: "/learn/xcross", label: "Drill XCross" } },
    { name: "a recognised pair", stage: stage({ kind: "pair" }), caseId: "F2L-12", expected: { path: "/learn/F2L?case=F2L-12", label: "Drill F2L 12" } },
    { name: "an unrecognised pair", stage: stage({ kind: "pair" }), caseId: null, expected: { path: "/learn/F2L", label: "Drill F2L" } },
    { name: "a COLL case", stage: stage({ kind: "coll" }), caseId: "COLL-T3", expected: { path: "/learn/COLL?case=COLL-T3", label: "Drill COLL T3" } },
    { name: "an EPLL case", stage: stage({ kind: "epll" }), caseId: "EPLL-Ua", expected: { path: "/learn/EPLL?case=EPLL-Ua", label: "Drill Ua perm" } },
    { name: "a case from another set", stage: stage({ kind: "oll" }), caseId: "COLL-T3", expected: { path: "/learn/OLL", label: "Drill OLL" } },
    { name: "an unclassified last layer", stage: stage({ kind: "ll" }), caseId: null, expected: null },
  ] as const)("$name", ({ stage: input, caseId, expected }) => {
    expect(stageDrill(input, caseId, all)).toEqual(expected);
  });

  it("has none when the learn item is missing", () => {
    expect(stageDrill(stage({ kind: "eo" }), "EO-line", () => false)).toBeNull();
  });

  it("sends pauses to the lookahead drill", () => {
    expect(PAUSE_DRILL.path).toBe("/learn/lookahead");
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
