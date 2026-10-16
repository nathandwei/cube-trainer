// Cube states between the smart cube's frame, the solver frame and cubing.js.
//
// The cube names its faces the WCA way, white on U and green on F. Solves are stored in the solver frame, the same
// cube after z2 (white on D, src/cube/types.ts). A z2 swaps U with D and R with L and keeps every turn's direction,
// so a reported "U" is the solver's "D". Both frames use Kociemba's cubie convention (the vendored CubieCube and
// src/cube agree on it, see state.test.ts), so moving a state between them only relabels positions and pieces.

import { KPattern, type KPuzzle } from "cubing/kpuzzle";
import { SOLVED, type CubeState } from "@/cube";
import { toSolverFrame } from "@/app/lib/frame";
import { CubieCube } from "@/vendor/smartcube-web-bluetooth/smartcube/cubie-cube";
import { toKociembaFacelets } from "@/vendor/smartcube-web-bluetooth/utils";

/** Corner positions URF UFL ULB UBR DFR DLF DBL DRB, swapped by z2: URF↔DLF, UFL↔DFR, ULB↔DRB, UBR↔DBL. */
const Z2_CORNERS = [5, 4, 7, 6, 1, 0, 3, 2] as const;
/** Edge positions UR UF UL UB DR DF DL DB FR FL BL BR, swapped by z2: UR↔DL, UF↔DF, UL↔DR, UB↔DB, FR↔FL, BL↔BR. */
const Z2_EDGES = [6, 5, 4, 7, 2, 1, 0, 3, 9, 8, 11, 10] as const;

/** A turn as the cube reported it ("U'"), named in the solver frame ("D'"). */
export function cubeMoveToSolver(move: string): string {
  return toSolverFrame(move);
}

/**
 * The same physical cube described in the other frame. z2 maps each face's reference sticker to a face of the same
 * axis (U/D stay U/D, F/B stay F/B), so orientations carry over unchanged; z2 is its own inverse, so this converts
 * both ways.
 */
export function swapFrame(state: CubeState): CubeState {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  for (let i = 0; i < 8; i++) {
    cp[Z2_CORNERS[i]!] = Z2_CORNERS[state.cp[i]!]!;
    co[Z2_CORNERS[i]!] = state.co[i]!;
  }
  for (let i = 0; i < 12; i++) {
    ep[Z2_EDGES[i]!] = Z2_EDGES[state.ep[i]!]!;
    eo[Z2_EDGES[i]!] = state.eo[i]!;
  }
  return { cp, co, ep, eo };
}

/** The state that undoes `state`: multiply(state, inverse(state)) is solved. */
export function inverse(state: CubeState): CubeState {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  state.cp.forEach((piece, i) => {
    cp[piece] = i;
    co[piece] = (3 - state.co[i]!) % 3;
  });
  state.ep.forEach((piece, i) => {
    ep[piece] = i;
    eo[piece] = state.eo[i]!;
  });
  return { cp, co, ep, eo };
}

/** The cube's own facelet report (Kociemba order, its frame) as a solver-frame state, or null if it is not a legal cube. */
export function solverStateFromFacelets(facelets: string): CubeState | null {
  if (facelets.length !== 54) return null;
  const cubie = new CubieCube().fromFacelet(facelets);
  if (cubie === -1) return null;
  const state: CubeState = {
    cp: cubie.ca.map((c) => c & 7),
    co: cubie.ca.map((c) => c >> 3),
    ep: cubie.ea.map((e) => e >> 1),
    eo: cubie.ea.map((e) => e & 1),
  };
  return isLegal(state) ? swapFrame(state) : null;
}

/** Permutations of the right sizes with legal twist and flip sums (parity is the cube's business). */
function isLegal(state: CubeState): boolean {
  const isPermutation = (values: readonly number[], size: number) =>
    values.length === size && new Set(values).size === size && values.every((v) => Number.isInteger(v) && v >= 0 && v < size);
  if (!isPermutation(state.cp, 8) || !isPermutation(state.ep, 12)) return false;
  const twist = state.co.reduce((sum, v) => sum + v, 0);
  const flip = state.eo.reduce((sum, v) => sum + v, 0);
  return twist % 3 === 0 && flip % 2 === 0 && state.co.every((v) => v >= 0 && v < 3) && state.eo.every((v) => v === 0 || v === 1);
}

/** Facelet letters of a solver-frame state, in Kociemba order: U face (the solver's top) first, then R F D L B. */
export function solverFacelets(state: CubeState): string {
  return toKociembaFacelets([...state.cp], [...state.co], [...state.ep], [...state.eo]);
}

/** Sticker colours by solver-frame face: white on D and green on F, so red is on L and orange on R. */
export const SOLVER_FACE_COLORS: Readonly<Record<string, string>> = {
  U: "yellow",
  D: "white",
  F: "green",
  B: "blue",
  R: "orange",
  L: "red",
};

// cubing.js orders its 3x3x3 pieces UF UR UB UL DF DR DB DL FR FL BR BL and UFR URB UBL ULF DRF DFL DLB DBR, with the
// same "position i holds piece p" reading and the same twist and flip conventions as Kociemba (state.test.ts checks
// every face turn), so only the indices move.
const KOCIEMBA_TO_CUBING_EDGE = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10] as const;
const KOCIEMBA_TO_CUBING_CORNER = [0, 3, 2, 1, 4, 5, 6, 7] as const;

function reorder(map: readonly number[], pieces: readonly number[], orientation: readonly number[]) {
  const outPieces = new Array<number>(map.length);
  const outOrientation = new Array<number>(map.length);
  pieces.forEach((piece, i) => {
    outPieces[map[i]!] = map[piece]!;
    outOrientation[map[i]!] = orientation[i]!;
  });
  return { pieces: outPieces, orientation: outOrientation };
}

/** A src/cube state as a cubing.js pattern (centres solved), for cubing.js's solver. */
export function toKPattern(kpuzzle: KPuzzle, state: CubeState = SOLVED): KPattern {
  const solved = kpuzzle.defaultPattern();
  const centers = solved.patternData["CENTERS"];
  if (!centers) throw new Error("cubing.js 3x3x3 pattern has no CENTERS orbit");
  return new KPattern(kpuzzle, {
    EDGES: reorder(KOCIEMBA_TO_CUBING_EDGE, state.ep, state.eo),
    CORNERS: reorder(KOCIEMBA_TO_CUBING_CORNER, state.cp, state.co),
    CENTERS: centers,
  });
}
