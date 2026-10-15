// Progress predicates in the solver frame (cross on D, last layer on U). Last-layer checks assume F2L is solved,
// so the four U positions hold the four U pieces.

import type { CubeState } from "./cubie";
import { SLOTS, isCrossSolved, isSlotSolved } from "./pieces";

export const AUFS = ["", "U", "U2", "U'"] as const;

export function isF2LSolved(state: CubeState): boolean {
  return isCrossSolved(state) && SLOTS.every((slot) => isSlotSolved(state, slot));
}

export function llEdgesOriented(state: CubeState): boolean {
  return [0, 1, 2, 3].every((i) => state.eo[i] === 0);
}

export function llCornersOriented(state: CubeState): boolean {
  return [0, 1, 2, 3].every((i) => state.co[i] === 0);
}

/** U turns (0..3, as in AUFS) that would line the pieces up, or -1 if no single U turn does. */
function alignment(perm: readonly number[]): number {
  const shift = perm[0]!;
  if (shift > 3) return -1;
  for (let i = 1; i < 4; i++) if (perm[i] !== (i + shift) % 4) return -1;
  return shift;
}

/** U turns after which the last-layer corners are solved, or -1 when they are not solved relative to each other. */
export function llCornerAlignment(state: CubeState): number {
  return llCornersOriented(state) ? alignment(state.cp) : -1;
}

/** F2L solved and every last-layer edge oriented. */
export function isEODone(state: CubeState): boolean {
  return isF2LSolved(state) && llEdgesOriented(state);
}

/** EO done and the last-layer corners oriented (what OLL achieves). */
export function isOLLDone(state: CubeState): boolean {
  return isEODone(state) && llCornersOriented(state);
}

/** EO done and the last-layer corners solved relative to each other (what COLL achieves). */
export function isCOLLDone(state: CubeState): boolean {
  return isEODone(state) && llCornerAlignment(state) >= 0;
}

/** U turns that finish the solve, or -1 when the cube is not solved up to a U turn. */
export function aufToSolve(state: CubeState): number {
  if (!isEODone(state)) return -1;
  const corners = llCornerAlignment(state);
  if (corners < 0) return -1;
  return alignment(state.ep) === corners ? corners : -1;
}

export function isSolvedUpToAuf(state: CubeState): boolean {
  return aufToSolve(state) >= 0;
}
