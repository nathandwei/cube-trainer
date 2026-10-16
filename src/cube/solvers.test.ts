import { describe, expect, it } from "vitest";
import { MOVE_NAMES, SOLVED, applyAlg, invertAlg, moveFace, moveIndex, scrambledState, type CubeState } from "./cubie";
import { SLOTS, isCrossSolved, isSlotSolved, solvedSlots } from "./pieces";
import { createRng, randomInt, randomScramble, shuffled } from "./random";
import {
  MAX_ENUMERATE_LENGTH,
  crossDistance,
  enumerateSlots,
  solveCross,
  solvePair,
  solveSlots,
  solveXCross,
} from "./solvers";
import { UNREACHED, getCrossTable, getFarTable, getNearTable } from "./tables";
import type { Slot } from "./types";

const rng = createRng(31);
const scrambles = Array.from({ length: 12 }, () => randomScramble(rng));

function reached(table: Uint8Array): number {
  return table.reduce((count, d) => count + (d === UNREACHED ? 0 : 1), 0);
}

/** Naive iterative deepening over full cube states: an independent check on optimality for short solutions. */
function bruteForceDistance(start: CubeState, goal: (s: CubeState) => boolean, maxDepth: number): number {
  const search = (state: CubeState, depth: number, prevFace: number): boolean => {
    if (depth === 0) return goal(state);
    for (let m = 0; m < 18; m++) {
      const face = moveFace(m);
      if (face === prevFace) continue;
      if (search(applyAlg(state, [MOVE_NAMES[m]!]), depth - 1, face)) return true;
    }
    return false;
  };
  for (let depth = 0; depth <= maxDepth; depth++) if (search(start, depth, -1)) return depth;
  return Infinity;
}

function randomMoves(count: number): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const move = MOVE_NAMES[randomInt(rng, 18)]!;
    if (out.length > 0 && out.at(-1)![0] === move[0]) continue;
    out.push(move);
  }
  return out;
}

function pairGoal(slot: Slot, keep: readonly Slot[]): (s: CubeState) => boolean {
  return (s) => isCrossSolved(s) && isSlotSolved(s, slot) && keep.every((k) => isSlotSolved(s, k));
}

describe("pruning tables", () => {
  it("reach exactly the legal states", () => {
    expect(reached(getCrossTable())).toBe(12 * 11 * 10 * 9 * 16);
    const pairStates = 8 * 3 * (12 * 11 * 10) * 8;
    expect(reached(getNearTable())).toBe(pairStates);
    expect(reached(getFarTable())).toBe(pairStates);
  });

  it("the cross table tops out at 8 turns", () => {
    expect(getCrossTable().reduce((max, d) => (d === UNREACHED ? max : Math.max(max, d)), 0)).toBe(8);
  });
});

describe("solveCross", () => {
  it.each(scrambles.map((s) => [s]))("returns distinct optimal crosses for %s", (scramble) => {
    const state = scrambledState(scramble);
    const solutions = solveCross(state, 8);
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions.length).toBeLessThanOrEqual(8);
    expect(new Set(solutions).size).toBe(solutions.length);
    for (const solution of solutions) {
      expect(isCrossSolved(applyAlg(state, solution))).toBe(true);
      expect(solution.split(" ")).toHaveLength(crossDistance(state));
    }
  });

  it.each([1, 2, 3, 4].flatMap((n) => [[n], [n]]))("matches brute force after %i random turns", (n) => {
    const state = applyAlg(SOLVED, randomMoves(n));
    expect(crossDistance(state)).toBe(bruteForceDistance(state, isCrossSolved, n));
  });

  it("returns the empty solution for a solved cross", () => {
    expect(solveCross(applyAlg(SOLVED, "R U R'"))).toEqual([""]);
  });
});

describe("solvePair", () => {
  function crossSolvedState(scramble: string): CubeState {
    const state = scrambledState(scramble);
    return applyAlg(state, solveCross(state, 1)[0]!);
  }

  it.each(scrambles.map((s) => [s]))("solves each pair after the cross while keeping others (%s)", (scramble) => {
    let state = crossSolvedState(scramble);
    for (const slot of shuffled(rng, SLOTS)) {
      const keep = solvedSlots(state).filter((s) => s !== slot);
      const result = solvePair(state, slot, keep);
      expect(result).not.toBeNull();
      const after = applyAlg(state, result!.solution);
      expect(pairGoal(slot, keep)(after)).toBe(true);
      expect(result!.moves).toBe(result!.solution ? result!.solution.split(" ").length : 0);
      state = after;
    }
  });

  // Start from a state where the cross and two slots are solved, scramble lightly, and compare with brute force.
  it.each([2, 3, 3, 4, 4, 4].map((n, i) => [n, SLOTS[i % 4]!]))(
    "matches brute force after %i random turns (%s)",
    (n, slot) => {
      const keep = SLOTS.filter((s) => s !== slot).slice(0, 2);
      const state = applyAlg(SOLVED, randomMoves(n));
      const result = solvePair(state, slot, keep);
      expect(result?.moves).toBe(bruteForceDistance(state, pairGoal(slot, keep), n));
    },
  );

  it("finds pairs that start in another slot", () => {
    const state = applyAlg(SOLVED, "R U2 R' U R' U' R");
    expect(state.cp.indexOf(4)).toBe(7); // the FR corner sits in the BR slot
    for (const slot of ["FR", "BR"] as const) {
      const result = solvePair(state, slot, ["FL", "BL"]);
      expect(result).not.toBeNull();
      expect(pairGoal(slot, ["FL", "BL"])(applyAlg(state, result!.solution))).toBe(true);
    }
  });

  it("returns null when the depth cap is too small", () => {
    const state = applyAlg(SOLVED, "R U R' U' F' U' F");
    expect(solveSlots(state, ["FR"], [], { maxDepth: 1 })).toBeNull();
  });

  it("honours avoidFirstFace", () => {
    const state = applyAlg(SOLVED, "R U R'");
    const result = solveSlots(state, ["FR"], [], { avoidFirstFace: moveFace(moveIndex("R")) });
    expect(result).not.toBeNull();
    expect(result!.solution.startsWith("R")).toBe(false);
  });

  // B U2 B' moved the FR pieces in the U layer; undoing it through the back is shortest (6 turns).
  const fromTheBack = applyAlg(SOLVED, "R U' R' B U2 B'");

  it.each([
    [["U", "R", "F", "L"] as const, /^[URFL]/],
    [["U", "R"] as const, /^[UR]/],
  ])("turns only the faces %j", (faces, pattern) => {
    const free = solveSlots(fromTheBack, ["FR"], [])!;
    expect(free.solution.startsWith("B")).toBe(true);
    const restricted = solveSlots(fromTheBack, ["FR"], [], { faces })!;
    expect(restricted.solution.split(" ").every((move) => pattern.test(move))).toBe(true);
    expect(pairGoal("FR", [])(applyAlg(fromTheBack, restricted.solution))).toBe(true);
    expect(restricted.moves).toBeGreaterThan(free.moves);
  });

  it("turns only the moves given", () => {
    const state = applyAlg(SOLVED, "R2 U R2");
    const result = solveSlots(state, ["FR"], [], { moves: ["U", "U2", "U'", "R", "R'"] })!;
    expect(result.solution.split(" ").every((move) => ["U", "U2", "U'", "R", "R'"].includes(move))).toBe(true);
    expect(pairGoal("FR", [])(applyAlg(state, result.solution))).toBe(true);
  });

  it("returns null when the allowed faces cannot solve the pair", () => {
    expect(solveSlots(applyAlg(SOLVED, "R U R'"), ["FR"], [], { faces: ["U", "L"] })).toBeNull();
  });

  it("refuses faces and moves together", () => {
    expect(() => solveSlots(SOLVED, ["FR"], [], { faces: ["U"], moves: ["U"] })).toThrow();
  });

  it("is fast enough for the main thread", () => {
    let worst = 0;
    let total = 0;
    let calls = 0;
    for (const scramble of scrambles) {
      const state = crossSolvedState(scramble);
      for (const slot of SLOTS) {
        const started = performance.now();
        solvePair(state, slot, SLOTS.filter((s) => s !== slot && isSlotSolved(state, s)));
        const elapsed = performance.now() - started;
        worst = Math.max(worst, elapsed);
        total += elapsed;
        calls++;
      }
    }
    console.info(`solvePair: ${calls} calls, mean ${(total / calls).toFixed(2)} ms, worst ${worst.toFixed(1)} ms`);
    expect(worst).toBeLessThan(150);
  });
});

describe("enumerateSlots", () => {
  const F2L_DONE = (s: CubeState): boolean => isCrossSolved(s) && SLOTS.every((slot) => isSlotSolved(s, slot));
  const URF = ["U", "R", "F"] as const;

  /** Every ⟨U, R, F⟩ sequence of exactly `length` turns ending at F2L solved and not passing it, by brute force. */
  function bruteForceAll(start: CubeState, length: number): string[] {
    const moves = MOVE_NAMES.filter((move) => URF.some((face) => move.startsWith(face)));
    const found: string[] = [];
    const walk = (state: CubeState, path: string[]): void => {
      if (path.length === length) {
        if (F2L_DONE(state)) found.push(path.join(" "));
        return;
      }
      if (path.length > 0 && F2L_DONE(state)) return;
      for (const move of moves) {
        if (path.length > 0 && path.at(-1)![0] === move[0]) continue;
        walk(applyAlg(state, [move]), [...path, move]);
      }
    };
    walk(start, []);
    return found;
  }

  it.each([
    ["U R U' R'", 4],
    ["U R U' R'", 5],
    ["U R U' R'", 6],
    ["F R' F' R", 4],
    ["F R' F' R", 6],
    ["R U2 R' U' R U R'", 6],
    ["R U R'", 3],
  ])("matches brute force for the pair %s at %i turns", (alg, length) => {
    const state = applyAlg(SOLVED, invertAlg(alg));
    const all = enumerateSlots(state, ["FR"], ["FL", "BL", "BR"], length, { faces: [...URF] });
    expect([...all].sort()).toEqual(bruteForceAll(state, length).sort());
  });

  it("finds U' F' U F for F2L 2 and never pads a solution", () => {
    const state = applyAlg(SOLVED, invertAlg("F R' F' R"));
    const four = enumerateSlots(state, ["FR"], ["FL", "BL", "BR"], 4, { faces: [...URF] });
    expect(four).toContain("U' F' U F");
    expect(four).toContain("F R' F' R");
    expect(enumerateSlots(state, ["FR"], ["FL", "BL", "BR"], 5, { faces: [...URF] })).toEqual([]);
  });

  it("stops at the limit, handles the solved goal and checks the length", () => {
    const state = applyAlg(SOLVED, invertAlg("F R' F' R"));
    expect(enumerateSlots(state, ["FR"], [], 4, { faces: [...URF], limit: 1 })).toHaveLength(1);
    expect(enumerateSlots(SOLVED, ["FR"], [], 0)).toEqual([""]);
    expect(enumerateSlots(SOLVED, ["FR"], [], 3)).toEqual([]);
    expect(() => enumerateSlots(state, ["FR"], [], MAX_ENUMERATE_LENGTH + 1)).toThrow(RangeError);
    expect(() => enumerateSlots(state, ["FR"], [], 2.5)).toThrow(RangeError);
    expect(() => enumerateSlots(state, [], [], 4)).toThrow();
  });
});

describe("solveXCross", () => {
  it.each(scrambles.slice(0, 6).map((s) => [s]))("is the best single-slot cross+pair for %s", (scramble) => {
    const state = scrambledState(scramble);
    const result = solveXCross(state);
    expect(result).not.toBeNull();
    const after = applyAlg(state, result!.solution);
    expect(isCrossSolved(after) && isSlotSolved(after, result!.slot)).toBe(true);
    const perSlot = SLOTS.map((slot) => solveSlots(state, [slot], [], { maxDepth: 14 })!.moves);
    expect(result!.moves).toBe(Math.min(...perSlot));
  });
});
