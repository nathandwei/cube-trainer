import { describe, expect, it } from "vitest";
import { analyzeSolve, relabelLastLayer } from "./analyze";
import { getCaseSet } from "./cases";
import { applyAlg, invertAlg, parseAlg, scrambledState, toFaceTurns } from "./cubie";
import { generateDemoSolve } from "./demo";
import { FrameTracker, splitMoves } from "./frame";
import { COLL_CASES, EPLL_CASES } from "./ll";
import { algIndex, recognizeAlgs } from "./llAlgs";
import { humanize } from "./notation";
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

describe("last layer (EO → COLL → EPLL)", () => {
  const eo = faceTurns("F R U R' U' F'");
  const coll = ["U", ...faceTurns(COLL_CASES.find((c) => c.name === "S1")!.alg)];
  const epll = ["U2", ...faceTurns(EPLL_CASES.find((c) => c.name === "Ua")!.alg), "U'"];
  const moves = [...eo, ...coll, ...epll];
  const analysis = analyzeSolve(wcaScrambleFor(moves), timed(moves, { [eo.length]: 700, [eo.length + coll.length]: 400 }), { method: "eo-coll" });

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

  it("labels a two-look path (edges, OCLL, corner swap, EPLL)", () => {
    const sune = faceTurns("R U R' U R U2 R'");
    const tPerm = faceTurns(COLL_CASES.find((c) => c.name === "O-adj")!.alg);
    const twoLook = [...eo, ...sune, ...tPerm, ...epll];
    const result = analyzeSolve(wcaScrambleFor(twoLook), timed(twoLook), { method: "eo-coll" });
    expect(result.stages.map((s) => [s.label, s.caseName])).toEqual([
      ["eo", "line"],
      ["ocll", "Sune"],
      ["coll", "O-adj"],
      ["epll", "Ua"],
    ]);
  });

  it("labels OCLL then a full PLL", () => {
    const sune = faceTurns("R U R' U R U2 R'");
    const tPerm = faceTurns("R U R' U' R' F R2 U' R' U' R U R' F'");
    const moves = [...eo, ...sune, ...tPerm];
    const result = analyzeSolve(wcaScrambleFor(moves), timed(moves), { method: "eo-coll" });
    expect(result.stages.map((s) => s.label)).toEqual(["eo", "ocll", "pll"]);
  });

  it("uses the catch-all when one alg does the whole last layer", () => {
    const result = analyzeSolve(wcaScrambleFor(eo), timed(eo), { method: "eo-coll" });
    expect(summary(result)).toEqual([["ll", 0, eo.length]]);
  });
});

describe("last-layer method", () => {
  const eo = faceTurns("F R U R' U' F'");
  const sune = faceTurns("R U R' U R U2 R'");
  const tPerm = faceTurns("R U R' U' R' F R2 U' R' U' R U R' F'");
  const ua = faceTurns(EPLL_CASES.find((c) => c.name === "Ua")!.alg);

  function stages(moves: readonly string[], method: "eo-coll" | "oll-pll" = "eo-coll"): [string, string | undefined][] {
    return analyzeSolve(wcaScrambleFor(moves), timed(moves), { method }).stages.map((s) => [s.label, s.caseName]);
  }

  it("names his OCLL that happened to solve the corners an OCLL, with EPLL after it", () => {
    // Every catalog OCLL alg is also some COLL case's alg, so only an OCLL of his own that no COLL alg matches can
    // tell luck from a COLL. His T: an H perm, then the catalog's OLL 24 alg.
    const own = `M2 U M2 U2 M2 U M2 ${getCaseSet("OLL").cases.find((c) => c.name === "24")!.algs[0]}`;
    const algs = { "OLL-24": own };
    expect([...(recognizeAlgs(faceTurns(own), algIndex(algs))?.[0] ?? [])]).toEqual(["OLL"]);
    const moves = [...eo, ...faceTurns(own), ...ua];
    const labels = (options: { algs?: Record<string, string> }) =>
      analyzeSolve(wcaScrambleFor(moves), timed(moves), { method: "eo-coll", ...options }).stages.map((s) => [s.label, s.caseName]);
    expect(labels({ algs })).toEqual([
      ["eo", "line"],
      ["ocll", "T"],
      ["epll", "Ua"],
    ]);
    // Not knowing his alg, the corners solved with the edges oriented read as a COLL.
    expect(labels({}).map(([label]) => label)).toEqual(["eo", "coll", "epll"]);
  });

  it("names a full OLL an OLL rather than an EO with an OCLL skip", () => {
    const oll1 = faceTurns("R U2 R2 F R F' U2 R' F R F'");
    expect(stages([...oll1, ...ua])).toEqual([
      ["oll", "1"],
      ["epll", "Ua"],
    ]);
  });

  it("keeps a dot done as two EO algs an EO, even when the two add up to an OLL alg", () => {
    // EO's L case, U', then its line: together that's OLL 3, but he did two EO algs with a look in between.
    const first = faceTurns("f R U R' U' f'");
    const second = faceTurns("U' F R U R' U' F'");
    expect([...(recognizeAlgs([...first, ...second], algIndex())?.[0] ?? [])]).toEqual(["OLL"]);
    const moves = [...first, ...second, ...ua];
    const result = analyzeSolve(wcaScrambleFor(moves), timed(moves, { [first.length]: 600 }), { method: "eo-coll" });
    expect(result.stages.map((s) => s.label)).toEqual(["eo", "epll"]);
  });

  it.each([
    ["one look each", [...eo, ...sune, ...tPerm], ["oll", "pll"]],
    ["two-look OLL and PLL", [...eo, ...sune, ...faceTurns(COLL_CASES.find((c) => c.name === "O-adj")!.alg), ...ua], ["oll", "pll"]],
    ["a PLL skip", eo, ["oll"]],
  ])("splits OLL → PLL only at OLL and solved (%s)", (_, moves, labels) => {
    expect(stages(moves, "oll-pll").map(([label]) => label)).toEqual(labels);
  });

  it("names the OLL and PLL cases", () => {
    const [oll, pll] = stages([...eo, ...sune, ...tPerm], "oll-pll");
    expect(oll?.[1]).toMatch(/^\d+$/);
    expect(pll).toEqual(["pll", "T"]);
  });

  it("is cross, F2L, OLL, PLL unless told otherwise", () => {
    const moves = [...eo, ...sune, ...tPerm];
    const scramble = wcaScrambleFor(moves);
    expect(analyzeSolve(scramble, timed(moves))).toEqual(analyzeSolve(scramble, timed(moves), { method: "oll-pll" }));
  });

  it("relabels a saved analysis for another method and keeps its F2L stages", () => {
    const scramble = randomScramble(createRng(31));
    const { moves } = generateDemoSolve(scramble, 3, "eo-coll");
    const saved = analyzeSolve(scramble, moves, { method: "eo-coll" });
    const relabelled = relabelLastLayer(saved, scramble, moves, { method: "oll-pll" });
    expect(relabelled).toEqual(analyzeSolve(scramble, moves, { method: "oll-pll" }));
    const f2l = saved.stages.filter((s) => ["cross", "xcross", "pair"].includes(s.kind));
    expect(relabelled.stages.slice(0, f2l.length)).toEqual(f2l);
    expect(relabelled.stages[0]).toBe(saved.stages[0]);
    expect(relabelled.stages.slice(f2l.length).map((s) => s.kind)).not.toContain("coll");
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

// Rotations, and the centre movement inside wide moves and slices, never change what the cube reports relative
// to its centres, so the analysis (which reads only `moves`) is the same however the solver held the cube.
describe("rotations", () => {
  function typed(alg: string): string[] {
    const tracker = new FrameTracker();
    return splitMoves(alg).flatMap((move) => tracker.apply(move).turns);
  }

  it.each([
    ["y U' R U R'", "U' B U B'"],
    ["y' U R' U' R", "U F' U' F"],
    ["y2 L' U' L", "R' U' R"],
  ])("reads %s exactly like the fixed-grip %s", (rotated, fixed) => {
    const moves = parseAlg(fixed);
    expect(typed(rotated)).toEqual(moves);
    const scramble = wcaScrambleFor(moves);
    expect(analyzeSolve(scramble, timed(typed(rotated)))).toEqual(analyzeSolve(scramble, timed(moves)));
  });

  const rng = createRng(808);
  const solves = Array.from({ length: 6 }, (_, i) => [i, randomScramble(rng)] as const);

  // Retype a demo solve token by token as the solver saw it: the same turns come out, so the same analysis.
  it.each(solves)("leave demo solve %i's analysis unchanged", (i, scramble) => {
    const { moves, rotations } = generateDemoSolve(scramble, i);
    expect(rotations.length).toBeGreaterThan(0);
    const tracker = new FrameTracker();
    const retyped = humanize(moves, rotations, () => false).flatMap((token) =>
      tracker.apply(token.text).turns.map((move, k) => ({ move, t: moves[token.start + k]!.t })),
    );
    expect(retyped).toEqual(moves);
    expect(analyzeSolve(scramble, retyped)).toEqual(analyzeSolve(scramble, moves));
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
