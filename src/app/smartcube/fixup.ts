// Turns from any cube state to the scrambled one, for when the cube is off its scramble by more than a slip (or
// started unsolved). cubing.js's two-phase search is loaded on first use and runs in its own worker.

import { cube3x3x3 } from "cubing/puzzles";
import { parseAlg, type CubeState } from "@/cube";
import { multiply } from "@/cube/cubie";
import type { Move } from "@/cube/types";
import { inverse, toKPattern } from "./state";

/**
 * Solver-frame turns F with from·F = to. cubing.js solves a pattern P to identity (P·F = I); with P = to⁻¹·from
 * that is to⁻¹·from·F = I, i.e. from·F = to.
 */
export async function solveFix(from: CubeState, to: CubeState): Promise<Move[]> {
  const [{ experimentalSolve3x3x3IgnoringCenters }, kpuzzle] = await Promise.all([import("cubing/search"), cube3x3x3.kpuzzle()]);
  const solution = await experimentalSolve3x3x3IgnoringCenters(toKPattern(kpuzzle, multiply(inverse(to), from)));
  return parseAlg(solution.toString());
}
