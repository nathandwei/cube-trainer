import { cube3x3x3 } from "cubing/puzzles";
import { describe, expect, it } from "vitest";
import { CASE_SETS, getCase, isGoalReached, recognizeCase, type CaseSetId } from "./cases";
import { SOLVED, applyAlg, isSolved, parseAlg, scrambledState, stateKey, toFaceTurns, type CubeState } from "./cubie";
import { isCOLLDone, isF2LSolved, llCornerAlignment } from "./milestones";
import { isCrossSolved, isSlotSolved } from "./pieces";
import { createRng, randomScramble } from "./random";
import {
  MAX_CROSS_MOVES,
  MAX_XCROSS_MOVES,
  SCRAMBLE_MAX_MOVES,
  SCRAMBLE_MIN_MOVES,
  caseScramble,
  crossScramble,
  stateScramble,
  toKPatternOrbits,
  xcrossScramble,
} from "./scramble";
import { crossDistance, solveXCross } from "./solvers";

const kpuzzle = await cube3x3x3.kpuzzle();
const ALL_CASES = CASE_SETS.flatMap((set) => set.cases);
const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

/** WCA outer turns only, 16–22 of them, no face turned twice in a row or around its opposite (R L R). */
function expectWellFormed(scramble: string): void {
  const moves = scramble.split(" ");
  expect(parseAlg(scramble)).toEqual(moves);
  expect(moves.length).toBeGreaterThanOrEqual(SCRAMBLE_MIN_MOVES);
  expect(moves.length).toBeLessThanOrEqual(SCRAMBLE_MAX_MOVES);
  moves.forEach((move, i) => {
    const next = moves[i + 1];
    const afterNext = moves[i + 2];
    if (next) expect(next.charAt(0), scramble).not.toBe(move.charAt(0));
    if (next && afterNext && AXIS[next.charAt(0)] === AXIS[move.charAt(0)]) {
      expect(afterNext.charAt(0), scramble).not.toBe(move.charAt(0));
    }
  });
}

function apply(state: CubeState, ...algs: string[]): CubeState {
  return applyAlg(
    state,
    algs.flatMap((alg) => toFaceTurns(alg).split(" ").filter(Boolean)),
  );
}

/** After preAuf + alg + postAuf: the set's goal with nothing left to align. */
function fullyDone(set: CaseSetId, state: CubeState): boolean {
  switch (set) {
    case "PLL":
    case "EPLL":
      return isSolved(state);
    case "COLL":
      return isCOLLDone(state) && llCornerAlignment(state) === 0;
    default:
      return isGoalReached(set, state);
  }
}

async function expectCaseScramble(caseId: string, seed: number): Promise<CubeState> {
  const { set, algs } = getCase(caseId);
  const result = await caseScramble(caseId, createRng(seed));
  expectWellFormed(result.scramble);
  // scrambledState applies the scramble in WCA orientation and then views the cube after z2.
  const state = scrambledState(result.scramble);
  const match = recognizeCase(set, state);
  expect(match?.caseId, result.scramble).toBe(caseId);
  expect(result.preAuf).toBe(match!.preAuf);
  if (set === "PLL" || set === "EPLL" || set === "COLL") expect(result.postAuf).toBe(match!.postAuf);
  else expect(result.postAuf).toBeUndefined();
  expect(fullyDone(set, apply(state, result.preAuf, algs[0]!, result.postAuf ?? ""))).toBe(true);
  if (set === "F2L") {
    expect(isCrossSolved(state)).toBe(true);
    expect((["FL", "BL", "BR"] as const).every((slot) => isSlotSolved(state, slot))).toBe(true);
    expect(isSlotSolved(state, "FR")).toBe(false);
  } else {
    expect(isF2LSolved(state)).toBe(true);
  }
  return state;
}

describe("toKPatternOrbits", () => {
  const rng = createRng(3);
  it.each(Array.from({ length: 8 }, () => [randomScramble(rng, 25)]))("matches cubing.js after %s", (alg) => {
    const expected = kpuzzle.defaultPattern().applyAlg(alg).patternData;
    const actual = toKPatternOrbits(applyAlg(SOLVED, alg));
    for (const orbit of ["CORNERS", "EDGES"] as const) {
      expect(actual[orbit]).toEqual({ pieces: expected[orbit]!.pieces, orientation: expected[orbit]!.orientation });
    }
  });
});

describe("caseScramble", () => {
  it.each(ALL_CASES.flatMap((c) => [1, 2].map((seed) => [c.id, seed] as const)))(
    "%s (seed %i) shows the case after z2",
    async (caseId, seed) => {
      await expectCaseScramble(caseId, seed);
    },
  );

  it.each(["PLL-H", "PLL-T", "EPLL-Z", "OLL-27", "COLL-O-adj", "EO-dot", "F2L-4", "F2L-37"])(
    "%s over 25 more seeds",
    async (caseId) => {
      for (let seed = 100; seed < 125; seed++) await expectCaseScramble(caseId, seed);
    },
  );

  it("is deterministic for a seed", async () => {
    expect(await caseScramble("COLL-T3", createRng(9))).toEqual(await caseScramble("COLL-T3", createRng(9)));
  });

  it("varies the scramble even when the target state repeats (PLL)", async () => {
    const scrambles = new Set<string>();
    for (let seed = 0; seed < 20; seed++) scrambles.add((await caseScramble("PLL-Ua", createRng(seed))).scramble);
    expect(scrambles.size).toBe(20);
  });

  it("randomises the pieces an OLL leaves free", async () => {
    const states = new Set<string>();
    for (let seed = 0; seed < 12; seed++) states.add(stateKey(await expectCaseScramble("OLL-45", seed)));
    expect(states.size).toBeGreaterThan(6);
  });

  it("rejects an unknown case", async () => {
    await expect(caseScramble("OLL-58", createRng(1))).rejects.toThrow();
  });
});

describe("crossScramble", () => {
  it.each(Array.from({ length: MAX_CROSS_MOVES + 1 }, (_, n) => [n]))("optimal cross of exactly %i", async (n) => {
    for (let seed = 0; seed < 5; seed++) {
      const scramble = await crossScramble(n, createRng(seed * 31 + n));
      expectWellFormed(scramble);
      expect(crossDistance(scrambledState(scramble))).toBe(n);
    }
  });

  it.each([[-1], [MAX_CROSS_MOVES + 1], [2.5]])("rejects %d", async (n) => {
    await expect(crossScramble(n, createRng(1))).rejects.toThrow(RangeError);
  });
});

describe("xcrossScramble", () => {
  it.each(Array.from({ length: MAX_XCROSS_MOVES + 1 }, (_, n) => [n]))("best xcross of exactly %i", async (n) => {
    for (let seed = 0; seed < 3; seed++) {
      const scramble = await xcrossScramble(n, createRng(seed * 17 + n));
      expectWellFormed(scramble);
      expect(solveXCross(scrambledState(scramble))?.moves).toBe(n);
    }
  });

  it.each([[-1], [MAX_XCROSS_MOVES + 1]])("rejects %d", async (n) => {
    await expect(xcrossScramble(n, createRng(1))).rejects.toThrow(RangeError);
  });
});

describe("stateScramble", () => {
  it("scrambles even a solved cube with a natural sequence that undoes itself", async () => {
    const scramble = await stateScramble(SOLVED, createRng(4));
    expectWellFormed(scramble);
    expect(isSolved(scrambledState(scramble))).toBe(true);
  });

  it("rejects a state no turns can reach", async () => {
    const twisted: CubeState = { ...SOLVED, co: [1, 0, 0, 0, 0, 0, 0, 0] };
    await expect(stateScramble(twisted, createRng(1))).rejects.toThrow();
  });
});
