import { describe, expect, it } from "vitest";
import { analyzeSolve } from "./analyze";
import { applyAlg, invertAlg, parseAlg, scrambledState, toFaceTurns } from "./cubie";
import { COLL_CASES, EPLL_CASES } from "./ll";
import { isCrossSolved, isSlotSolved } from "./pieces";
import { createRng, randomScramble } from "./random";
import { solveCross, solveXCross } from "./solvers";
import type { TimedMove } from "./types";

// The solver frame is the WCA frame after z2, which swaps U/D and R/L; the swap is its own inverse.
const SWAP: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "F", B: "B" };

function wcaScrambleFor(solverMoves: readonly string[]): string {
  return invertAlg(solverMoves)
    .map((move) => SWAP[move[0]!]! + move.slice(1))
    .join(" ");
}

/** Times each move 100 ms apart, with extra pauses before the given move indices. */
function timed(moves: readonly string[], pauses: Record<number, number> = {}): TimedMove[] {
  let t = 0;
  return moves.map((move, i) => {
    if (i > 0) t += 100;
    t += pauses[i] ?? 0;
    return { move, t };
  });
}

function faceTurns(alg: string): string[] {
  return toFaceTurns(alg).split(" ").filter(Boolean);
}

function summary(analysis: ReturnType<typeof analyzeSolve>): [string, number, number][] {
  return analysis.stages.map((s) => [s.label, s.startMove, s.endMove]);
}

describe("last layer", () => {
  const eo = faceTurns("F R U R' U' F'");
  const coll = ["U", ...faceTurns(COLL_CASES.find((c) => c.name === "S1")!.alg)];
  const epll = ["U2", ...faceTurns(EPLL_CASES.find((c) => c.name === "Ua")!.alg), "U'"];
  const moves = [...eo, ...coll, ...epll];
  const analysis = analyzeSolve(wcaScrambleFor(moves), timed(moves, { [eo.length]: 700, [eo.length + coll.length]: 400 }));

  it("splits EO, COLL and EPLL, with the final AUF in the last stage", () => {
    const a = eo.length;
    const b = a + coll.length;
    expect(summary(analysis)).toEqual([
      ["eo", 0, a],
      ["coll", a, b],
      ["epll", b, moves.length],
    ]);
    expect(analysis.solved).toBe(true);
    expect(analysis.moveCount).toBe(moves.length);
  });

  it("names the cases", () => {
    expect(analysis.stages.map((s) => s.caseName)).toEqual(["line", "S1", "Ua"]);
  });

  it("times each stage", () => {
    const [first, second] = analysis.stages;
    expect(first).toMatchObject({ recognitionMs: 0, executionMs: (eo.length - 1) * 100, longestPauseMs: 100 });
    expect(second).toMatchObject({ recognitionMs: 800, executionMs: (coll.length - 1) * 100, moveCount: coll.length });
    const total = analysis.stages.reduce((sum, s) => sum + s.totalMs, 0);
    expect(total).toBe(analysis.totalMs);
    expect(analysis.totalMs).toBe((moves.length - 1) * 100 + 1100);
  });

  it("labels a two-look path (edges, OCLL, corner swap, EPLL) with the catch-all for OCLL", () => {
    const sune = faceTurns("R U R' U R U2 R'");
    const tPerm = faceTurns(COLL_CASES.find((c) => c.name === "O-adj")!.alg);
    const twoLook = [...eo, ...sune, ...tPerm, ...epll];
    const result = analyzeSolve(wcaScrambleFor(twoLook), timed(twoLook));
    expect(result.stages.map((s) => [s.label, s.caseName])).toEqual([
      ["eo", "line"],
      ["ll", undefined],
      ["coll", "O-adj"],
      ["epll", "Ua"],
    ]);
  });

  it("uses the catch-all when one alg does the whole last layer", () => {
    const result = analyzeSolve(wcaScrambleFor(eo), timed(eo));
    expect(summary(result)).toEqual([["ll", 0, eo.length]]);
  });
});

describe("F2L", () => {
  it("keeps a broken and re-made pair in the stage that re-makes it", () => {
    // Cross, BL and BR start solved. FR is made, broken again, re-made, then FL is made.
    const moves = parseAlg("R U' R' R U R' R U' R' L' U L");
    const analysis = analyzeSolve(wcaScrambleFor(moves), timed(moves));
    expect(analysis.stages.map((s) => [s.label, s.startMove, s.endMove, s.slots])).toEqual([
      ["p3", 0, 9, ["FR"]],
      ["p4", 9, 12, ["FL"]],
    ]);
    expect(analysis.stages[0]).toMatchObject({
      optimalMoves: 3,
      optimalSolution: "R U' R'",
      bestAlternative: { slot: "FR", moves: 3, solution: "R U' R'" },
    });
  });

  it("credits a slot that was solved, broken and re-made to the stage that re-made it", () => {
    // Cross, FR, BL and BR start solved; FR is broken and re-made (count drops at a cross-solved move), then FL.
    const moves = parseAlg("R U R' R U' R' L' U L");
    const analysis = analyzeSolve(wcaScrambleFor(moves), timed(moves));
    expect(analysis.stages.map((s) => [s.label, s.startMove, s.endMove, s.slots])).toEqual([
      ["p3", 0, 6, ["FR"]],
      ["p4", 6, 9, ["FL"]],
    ]);
    expect(analysis.stages[0]).toMatchObject({ optimalMoves: 0, bestAlternative: { slot: "FL", moves: 3 } });
  });

  it("reports an optimal cross and the cheapest pair on offer", () => {
    const rng = createRng(4);
    const scramble = randomScramble(rng);
    const state = scrambledState(scramble);
    const cross = solveCross(state, 1)[0]!.split(" ");
    const analysis = analyzeSolve(scramble, timed([...cross, "U"]));
    const [crossStage, pairStage] = analysis.stages;
    expect(crossStage).toMatchObject({ kind: "cross", startMove: 0, endMove: cross.length });
    expect(crossStage!.optimalMoves).toBe(cross.length);
    expect(isCrossSolved(applyAlg(state, crossStage!.optimalSolution!))).toBe(true);
    // The solve stops after one U turn: an unfinished first pair with the best option recorded.
    expect(pairStage).toMatchObject({ kind: "pair", label: "p1", slots: [], startMove: cross.length });
    expect(pairStage!.bestAlternative).toBeDefined();
    expect(analysis.solved).toBe(false);
  });

  it("detects an XCross when the cross and a pair finish on the same turn", () => {
    const rng = createRng(12);
    for (let attempt = 0; attempt < 40; attempt++) {
      const scramble = randomScramble(rng);
      const state = scrambledState(scramble);
      const xcross = solveXCross(state)!;
      const moves = xcross.solution.split(" ");
      let current = state;
      const crossAt = moves.findIndex((move) => {
        current = applyAlg(current, [move]);
        return isCrossSolved(current);
      });
      if (crossAt !== moves.length - 1) continue;
      const analysis = analyzeSolve(scramble, timed(moves));
      expect(analysis.stages).toHaveLength(1);
      expect(analysis.stages[0]).toMatchObject({
        kind: "xcross",
        label: "xcross",
        slots: [xcross.slot],
        optimalMoves: xcross.moves,
      });
      expect(isSlotSolved(applyAlg(state, moves), xcross.slot)).toBe(true);
      return;
    }
    throw new Error("No scramble whose optimal XCross finishes the cross on its last turn");
  });
});

describe("input handling", () => {
  it("returns no stages for an empty solve", () => {
    expect(analyzeSolve("", [])).toEqual({ stages: [], totalMs: 0, moveCount: 0, solved: true });
  });

  it.each([
    [[{ move: "Rw", t: 0 }]],
    [[{ move: "R U", t: 0 }]],
    [[{ move: "R", t: -5 }]],
    [
      [
        { move: "R", t: 50 },
        { move: "U", t: 40 },
      ],
    ],
  ])("rejects %j", (moves) => {
    expect(() => analyzeSolve("R U", moves)).toThrow();
  });
});
