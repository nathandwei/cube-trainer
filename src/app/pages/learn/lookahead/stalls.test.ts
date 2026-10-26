import { describe, expect, it } from "vitest";
import type { SolveAnalysis, Stage } from "@/cube/types";
import { DETOUR_MOVES, findDetours, findFiller } from "./stalls";

const turns = (alg: string) => alg.split(/\s+/).filter(Boolean);

describe("findFiller", () => {
  it.each([
    { name: "a clean pair", alg: "U R U' R' U' F' U F", filler: [] },
    { name: "a half turn as two quarters", alg: "R U U R'", filler: [] },
    { name: "a half turn the other way", alg: "R U' U' R'", filler: [] },
    { name: "a slice M2 as quarters", alg: "R L' R L' U", filler: [] },
    { name: "spinning U while looking", alg: "R U U U U R'", filler: [{ start: 1, end: 4, wasted: 4 }] },
    { name: "a turn undone straight away", alg: "U R R' F", filler: [{ start: 1, end: 2, wasted: 2 }] },
    { name: "U' done as three quarters", alg: "F U U U F'", filler: [{ start: 1, end: 3, wasted: 2 }] },
    { name: "an AUF changed mind", alg: "R U2 U R'", filler: [{ start: 1, end: 2, wasted: 1 }] },
    { name: "cancelling across the other face", alg: "U D U' R", filler: [{ start: 0, end: 2, wasted: 2 }] },
  ])("$name", ({ alg, filler }) => {
    expect(findFiller(turns(alg))).toEqual(filler);
  });
});

function pair(startMove: number, moveCount: number, optimalMoves: number | undefined): Stage {
  return {
    kind: "pair",
    label: "p1",
    startMove,
    endMove: startMove + moveCount,
    recognitionMs: 0,
    executionMs: 0,
    totalMs: 0,
    moveCount,
    longestPauseMs: 0,
    ...(optimalMoves === undefined ? {} : { optimalMoves }),
  };
}

const analysis = (...stages: Stage[]): SolveAnalysis => ({ stages, totalMs: 0, moveCount: 0, solved: true });

describe("findDetours", () => {
  it.each([
    { name: "a pair a little long", stage: pair(0, 6 + DETOUR_MOVES - 1, 6), detours: 0 },
    { name: "a pair that wandered", stage: pair(0, 6 + DETOUR_MOVES, 6), detours: 1 },
    { name: "a step with no shortest solution (the last layer)", stage: pair(0, 40, undefined), detours: 0 },
  ])("$name", ({ stage, detours }) => {
    expect(findDetours(analysis(stage), [])).toHaveLength(detours);
  });

  it("doesn't count filler inside a pair twice", () => {
    const filler = [{ start: 2, end: 5, wasted: 4 }];
    expect(findDetours(analysis(pair(0, 6 + DETOUR_MOVES, 6)), filler)).toHaveLength(0);
  });

  it("finds nothing without an analysis", () => {
    expect(findDetours(undefined, [])).toEqual([]);
  });
});
