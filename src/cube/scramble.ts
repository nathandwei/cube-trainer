// Scrambles that set up a chosen case, cross length or xcross length (docs/research/05 §2).
//
// The method is csTimer's: build the target state in the solver frame, solve it with min2phase (cubing.js's
// experimentalSolve3x3x3IgnoringCenters: a worker in the browser, in-process in Node), invert the solution and
// rename its faces for WCA orientation, where the solver then turns the cube over with z2. Pieces the drill does
// not care about are random, and so is the padding described below, so repeated scrambles for one case differ.
//
// min2phase returns the first solution it finds under 22 moves: a phase that brings the cube into <U, D, R2, L2, F2,
// B2> followed by at most 12 moves inside it. Inverted, a scramble is those U, D and half turns first and the
// phase-1 moves, the quarter turns of R, L, F and B, last. For a state at or near that group (every PLL) phase 1 is
// a few moves or none, so the scramble is mostly U, D and half turns, or even the case's own alg: it gives the case
// away. A scramble therefore needs 16–22 moves and at least five side quarter turns (random-state scrambles have
// about six), or three when it is 19+ moves long, since then phase 1 took at least 7. When the direct solution
// falls short, the scramble becomes a few random moves, a min2phase solution for what is left, and a few more
// random moves. Random moves on one side only do not work: min2phase then solves the inverse state, whose phase 1
// is just those moves, and the scramble collapses back to the short one.

import type { KPatternData, KPatternOrbitData } from "cubing/kpuzzle";
import { getCase, recognizeCase, type CaseMatch, type CaseSetId } from "./cases";
import {
  SOLVED,
  applyAlg,
  faceTurnName,
  invertAlg,
  multiply,
  parseAlg,
  scrambledState,
  solverFrameToScramble,
  stateKey,
  type CubeState,
  type Face,
} from "./cubie";
import { AUFS } from "./milestones";
import { CROSS_EDGES, SLOTS, SLOT_INFO } from "./pieces";
import { randomInt, randomScramble, shuffled, type Rng } from "./random";
import { crossDistance, solveXCross } from "./solvers";
import { getCrossTable } from "./tables";
import type { Move } from "./types";

export const SCRAMBLE_MIN_MOVES = 16;
export const SCRAMBLE_MAX_MOVES = 22;
const MIN_SIDE_QUARTER_TURNS = 5;
const LONG_SCRAMBLE_MOVES = 19;
const LONG_SCRAMBLE_MIN_SIDE_QUARTER_TURNS = 3;
// Random moves around the min2phase part: how many to start with, and the range they adapt within.
const START_PADDING = 5;
const MIN_PADDING = 2;
const MAX_PADDING = 10;
const MAX_PADDED_ATTEMPTS = 100;
// A state whose solution is already near 22 moves (a random state) cannot take padding; stop trying after this many.
const MAX_TOO_LONG_AT_MIN_PADDING = 5;

/** Longest optimal cross (the exact table tops out at 8). */
export const MAX_CROSS_MOVES = 8;
/**
 * Longest best-slot xcross target. Of 20,000 random states, 1.4% needed 9 and none needed 10, so a target of 10
 * could not be found by sampling in reasonable time.
 */
export const MAX_XCROSS_MOVES = 9;
// Up to this many moves an xcross state comes from a short random walk away from a solved xcross (random states
// that close are rare); beyond it, from random states, which are mostly 7 or 8 away.
const XCROSS_WALK_MAX = 6;
const MAX_XCROSS_ATTEMPTS = 20_000;

/** A WCA-orientation scramble; after it and z2 the solver sees the case. AUFs are for the case's default alg. */
export type CaseScramble = {
  scramble: string;
  /** U turn (solver frame) before algs[0], "" for none. */
  preAuf: string;
  /** PLL, EPLL: U turn that finishes the solve after algs[0]; COLL: the one that lines up the corners. */
  postAuf?: string;
};

// ---------------------------------------------------------------------------------------------------------------
// cubing.js adapter

// cubing.js orders corners UFR URB UBL ULF DRF DFL DLB DBR and edges UF UR UB UL DF DR DB DL FR FL BR BL. Its
// orientation conventions match cubie.ts (cubie.test.ts checks every face turn against it).
const CORNER_TO_CUBING = [0, 3, 2, 1, 4, 5, 6, 7] as const;
const EDGE_TO_CUBING = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10] as const;

function toOrbit(perm: readonly number[], ori: readonly number[], map: readonly number[]): KPatternOrbitData {
  const pieces = new Array<number>(map.length);
  const orientation = new Array<number>(map.length);
  map.forEach((cubingPosition, position) => {
    pieces[cubingPosition] = map[perm[position]!]!;
    orientation[cubingPosition] = ori[position]!;
  });
  return { pieces, orientation };
}

/** The CORNERS and EDGES orbits of a cubing.js 3x3x3 KPattern for a cubie state. */
export function toKPatternOrbits(state: CubeState): Pick<KPatternData, "CORNERS" | "EDGES"> {
  return {
    CORNERS: toOrbit(state.cp, state.co, CORNER_TO_CUBING),
    EDGES: toOrbit(state.ep, state.eo, EDGE_TO_CUBING),
  };
}

type Solver = (state: CubeState) => Promise<Move[]>;

let solverPromise: Promise<Solver> | undefined;

// Loaded on first use, so importing the engine does not pull in cubing.js's search code.
function loadSolver(): Promise<Solver> {
  solverPromise ??= createSolver().catch((error: unknown) => {
    solverPromise = undefined;
    throw error;
  });
  return solverPromise;
}

async function createSolver(): Promise<Solver> {
  const [{ cube3x3x3 }, { KPattern }, { experimentalSolve3x3x3IgnoringCenters }] = await Promise.all([
    import("cubing/puzzles"),
    import("cubing/kpuzzle"),
    import("cubing/search"),
  ]);
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern().patternData;
  return async (state) => {
    const pattern = new KPattern(kpuzzle, { ...solved, ...toKPatternOrbits(state) });
    const solution = await experimentalSolve3x3x3IgnoringCenters(pattern);
    return parseAlg(solution.toString());
  };
}

// ---------------------------------------------------------------------------------------------------------------
// State → scramble

function parity(perm: readonly number[]): number {
  let inversions = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i]! > perm[j]!) inversions++;
  return inversions % 2;
}

function isPermutation(perm: readonly number[], size: number): boolean {
  if (perm.length !== size || new Set(perm).size !== size) return false;
  return perm.every((p) => Number.isInteger(p) && p >= 0 && p < size);
}

function assertReachable(state: CubeState): void {
  const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
  if (!isPermutation(state.cp, 8) || !isPermutation(state.ep, 12)) throw new Error("Not a cube state");
  if (sum(state.co) % 3 !== 0 || sum(state.eo) % 2 !== 0 || parity(state.cp) !== parity(state.ep)) {
    throw new Error("Not a reachable cube state (twist, flip or parity)");
  }
}

const AXIS_FACES: readonly (readonly Face[])[] = [
  ["U", "D"],
  ["R", "L"],
  ["F", "B"],
];

function axisOf(move: Move): number {
  return AXIS_FACES.findIndex((faces) => faces.includes(move.charAt(0) as Face));
}

function quarterTurns(move: Move): number {
  return move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
}

/** Merges turns within each run on one axis (R L R' → L, U D U → U2 D) until nothing more cancels. */
function cancelMoves(moves: readonly Move[]): Move[] {
  const out: Move[] = [];
  let start = 0;
  while (start < moves.length) {
    const axis = axisOf(moves[start]!);
    const totals = new Map<Face, number>();
    let end = start;
    for (; end < moves.length && axisOf(moves[end]!) === axis; end++) {
      const face = moves[end]!.charAt(0) as Face;
      totals.set(face, (totals.get(face) ?? 0) + quarterTurns(moves[end]!));
    }
    for (const face of AXIS_FACES[axis]!) {
      const amount = (totals.get(face) ?? 0) % 4;
      if (amount !== 0) out.push(faceTurnName(face, amount));
    }
    start = end;
  }
  return out.length < moves.length ? cancelMoves(out) : out;
}

const SIDE_FACES = new Set(["R", "L", "F", "B"]);

function inLengthRange(moves: readonly Move[]): boolean {
  return moves.length >= SCRAMBLE_MIN_MOVES && moves.length <= SCRAMBLE_MAX_MOVES;
}

function sideQuarterTurns(moves: readonly Move[]): number {
  return moves.filter((move) => SIDE_FACES.has(move.charAt(0)) && !move.endsWith("2")).length;
}

function looksNatural(moves: readonly Move[]): boolean {
  if (!inLengthRange(moves)) return false;
  const quarters = sideQuarterTurns(moves);
  if (quarters >= MIN_SIDE_QUARTER_TURNS) return true;
  return moves.length >= LONG_SCRAMBLE_MOVES && quarters >= LONG_SCRAMBLE_MIN_SIDE_QUARTER_TURNS;
}

// With random padding the length no longer bounds phase 1 from below, so only the side quarter turns count.
function looksNaturalPadded(moves: readonly Move[]): boolean {
  return inLengthRange(moves) && sideQuarterTurns(moves) >= MIN_SIDE_QUARTER_TURNS;
}

function toScramble(moves: readonly Move[], target: CubeState): string {
  if (stateKey(applyAlg(SOLVED, moves)) !== stateKey(target)) throw new Error("Scramble misses its target state");
  return solverFrameToScramble(moves);
}

/**
 * A natural-looking WCA-orientation scramble (16–22 outer turns) that, followed by z2, leaves the cube in `state`
 * (solver frame). `rng` only matters when the direct min2phase solution is too short or too regular.
 */
export async function stateScramble(state: CubeState, rng: Rng): Promise<string> {
  assertReachable(state);
  const solve = await loadSolver();
  const direct = cancelMoves(invertAlg(await solve(state)));
  if (looksNatural(direct)) return toScramble(direct, state);
  let padding = START_PADDING;
  let tooLongAtMinimum = 0;
  for (let attempt = 0; attempt < MAX_PADDED_ATTEMPTS && tooLongAtMinimum < MAX_TOO_LONG_AT_MIN_PADDING; attempt++) {
    const before = 1 + randomInt(rng, padding - 1);
    const prefix = parseAlg(randomScramble(rng, before));
    const suffix = parseAlg(randomScramble(rng, padding - before));
    // prefix · rest · suffix = state, so rest = prefix⁻¹ · state · suffix⁻¹.
    const rest = multiply(multiply(applyAlg(SOLVED, invertAlg(prefix)), state), applyAlg(SOLVED, invertAlg(suffix)));
    const moves = cancelMoves([...prefix, ...invertAlg(await solve(rest)), ...suffix]);
    if (looksNaturalPadded(moves)) return toScramble(moves, state);
    if (moves.length <= SCRAMBLE_MAX_MOVES) {
      padding = Math.min(MAX_PADDING, padding + 1);
      continue;
    }
    if (padding === MIN_PADDING) tooLongAtMinimum++;
    padding = Math.max(MIN_PADDING, padding - 1);
  }
  // Reached by a random state whose solution happens to have few side quarter turns: padding pushes it past 22
  // moves, and the direct solution is an ordinary random-state scramble anyway.
  if (inLengthRange(direct)) return toScramble(direct, state);
  throw new Error(`No natural ${SCRAMBLE_MIN_MOVES}–${SCRAMBLE_MAX_MOVES} move scramble found`);
}

// ---------------------------------------------------------------------------------------------------------------
// Random states

function swapAt(values: number[], i: number, j: number): void {
  [values[i], values[j]] = [values[j]!, values[i]!];
}

/** Random orientations at `positions`, keeping their sum (mod `twists`) so the cube stays reachable. */
function reorientAt(ori: number[], positions: readonly number[], twists: number, rng: Rng): void {
  const total = positions.reduce((sum, position) => sum + ori[position]!, 0);
  let partial = 0;
  positions.forEach((position, i) => {
    const last = i === positions.length - 1;
    const value = last ? (((total - partial) % twists) + twists) % twists : randomInt(rng, twists);
    ori[position] = value;
    partial += value;
  });
}

function permuteAt(perm: number[], positions: readonly number[], rng: Rng): void {
  const pieces = shuffled(
    rng,
    positions.map((position) => perm[position]!),
  );
  positions.forEach((position, i) => {
    perm[position] = pieces[i]!;
  });
}

type Placement = { perm: number[]; ori: number[]; free: number[] };

/** `fixed` maps a piece to its piece state (position * twists + twist); every other piece goes anywhere else. */
function placePieces(rng: Rng, count: number, twists: number, fixed: ReadonlyMap<number, number>): Placement {
  const perm = new Array<number>(count).fill(-1);
  const ori = new Array<number>(count).fill(0);
  for (const [piece, pieceState] of fixed) {
    const position = Math.floor(pieceState / twists);
    if (perm[position] !== -1) throw new Error(`Two fixed pieces at position ${position}`);
    perm[position] = piece;
    ori[position] = pieceState % twists;
  }
  const free = perm.flatMap((piece, position) => (piece === -1 ? [position] : []));
  const loose = shuffled(
    rng,
    Array.from({ length: count }, (_, piece) => piece).filter((piece) => !fixed.has(piece)),
  );
  free.forEach((position, i) => {
    perm[position] = loose[i]!;
  });
  // Free pieces get random twists, the last one whatever makes the total a multiple of `twists`.
  let total = ori.reduce((sum, value) => sum + value, 0);
  free.forEach((position, i) => {
    const value = i === free.length - 1 ? (twists - (total % twists)) % twists : randomInt(rng, twists);
    ori[position] = value;
    total += value;
  });
  if (total % twists !== 0) throw new Error("Fixed pieces have an impossible total twist");
  return { perm, ori, free };
}

/** A uniformly random reachable state with the given pieces fixed (piece → piece state, see pieces.ts). */
function randomState(rng: Rng, fixedCorners: ReadonlyMap<number, number>, fixedEdges: ReadonlyMap<number, number>) {
  const corners = placePieces(rng, 8, 3, fixedCorners);
  const edges = placePieces(rng, 12, 2, fixedEdges);
  if (parity(corners.perm) !== parity(edges.perm)) {
    const [perm, free] = corners.free.length >= 2 ? [corners.perm, corners.free] : [edges.perm, edges.free];
    if (free.length < 2) throw new Error("Fixed pieces leave no way to fix parity");
    swapAt(perm, free[0]!, free[1]!);
  }
  return { cp: corners.perm, co: corners.ori, ep: edges.perm, eo: edges.ori } satisfies CubeState;
}

type Shuffle = { corners: "keep" | "permute" | "permute+twist"; edges: "keep" | "permute" | "permute+flip" };

// What each set leaves random. "permute" moves the pieces but leaves each position's orientation, because the case
// is that orientation pattern (OLL, EO edges) or because it must stay oriented (COLL edges).
const FREE_PIECES: Record<CaseSetId, Shuffle> = {
  PLL: { corners: "keep", edges: "keep" },
  EPLL: { corners: "keep", edges: "keep" },
  OLL: { corners: "permute", edges: "permute" },
  COLL: { corners: "keep", edges: "permute" },
  EO: { corners: "permute+twist", edges: "permute" },
  F2L: { corners: "permute+twist", edges: "permute+flip" },
};

// Last-layer pieces are 0..3 for corners (URF UFL ULB UBR) and edges (UR UF UL UB) alike. In an F2L case one of
// them may sit in the front-right slot, so they are found wherever they are rather than assumed on U.
const isLastLayerPiece = (piece: number): boolean => piece < 4;

function shuffleLastLayer(state: CubeState, mode: Shuffle, rng: Rng): CubeState {
  const cp = [...state.cp];
  const co = [...state.co];
  const ep = [...state.ep];
  const eo = [...state.eo];
  const cornerPositions = cp.flatMap((piece, position) => (isLastLayerPiece(piece) ? [position] : []));
  const edgePositions = ep.flatMap((piece, position) => (isLastLayerPiece(piece) ? [position] : []));
  if (mode.corners !== "keep") permuteAt(cp, cornerPositions, rng);
  if (mode.corners === "permute+twist") reorientAt(co, cornerPositions, 3, rng);
  if (mode.edges !== "keep") permuteAt(ep, edgePositions, rng);
  if (mode.edges === "permute+flip") reorientAt(eo, edgePositions, 2, rng);
  if (parity(cp) !== parity(ep)) {
    // Only reachable when something was permuted; one more swap there restores matching parity.
    const [perm, positions] = mode.edges !== "keep" ? [ep, edgePositions] : [cp, cornerPositions];
    swapAt(perm, positions[0]!, positions[1]!);
  }
  return { cp, co, ep, eo };
}

// ---------------------------------------------------------------------------------------------------------------
// Public scramblers

const POST_AUF_SETS: ReadonlySet<CaseSetId> = new Set(["PLL", "EPLL", "COLL"]);

function caseTarget(caseId: string, rng: Rng): CubeState {
  const { set, setup } = getCase(caseId);
  const pre = AUFS[randomInt(rng, 4)]!;
  const post = AUFS[randomInt(rng, 4)]!;
  // target · pre · alg · post = solved: the solver sees the case behind a random U turn and ends on another.
  const base = applyAlg(SOLVED, [...invertAlg(post), ...parseAlg(setup), ...invertAlg(pre)]);
  return shuffleLastLayer(base, FREE_PIECES[set], rng);
}

function withAufs(set: CaseSetId, scramble: string, match: CaseMatch): CaseScramble {
  return POST_AUF_SETS.has(set)
    ? { scramble, preAuf: match.preAuf, postAuf: match.postAuf }
    : { scramble, preAuf: match.preAuf };
}

/**
 * A scramble (WCA orientation) that, after z2, shows `caseId` behind a random pre-AUF: for LL sets with F2L solved
 * and every last-layer piece the case leaves free random; for F2L cases with the cross and the other three slots
 * solved, the front-right pair in the case and the rest of the last layer random.
 */
export async function caseScramble(caseId: string, rng: Rng): Promise<CaseScramble> {
  const { set } = getCase(caseId);
  const target = caseTarget(caseId, rng);
  const match = recognizeCase(set, target);
  if (match?.caseId !== caseId) throw new Error(`Target for ${caseId} reads as ${match?.caseId ?? "no case"}`);
  // stateScramble checks that the scramble reaches `target` exactly, so `match` holds for it too.
  return withAufs(set, await stateScramble(target, rng), match);
}

let crossStatesByDepth: Map<number, Uint32Array> | undefined;

function crossStatesAt(depth: number): Uint32Array {
  crossStatesByDepth ??= new Map();
  const cached = crossStatesByDepth.get(depth);
  if (cached) return cached;
  const table = getCrossTable();
  const found: number[] = [];
  table.forEach((distance, index) => {
    if (distance === depth) found.push(index);
  });
  const states = Uint32Array.from(found);
  crossStatesByDepth.set(depth, states);
  return states;
}

function assertTarget(targetMoves: number, max: number): void {
  if (!Number.isInteger(targetMoves) || targetMoves < 0 || targetMoves > max) {
    throw new RangeError(`Target must be a whole number of moves from 0 to ${max}, got ${targetMoves}`);
  }
}

/**
 * A random-state scramble whose optimal white cross (solver frame, cross on D) takes exactly `targetMoves` face
 * turns: the cross edges are drawn uniformly from every placement at that distance, everything else at random.
 */
export async function crossScramble(targetMoves: number, rng: Rng): Promise<string> {
  assertTarget(targetMoves, MAX_CROSS_MOVES);
  const states = crossStatesAt(targetMoves);
  const index = states[randomInt(rng, states.length)]!;
  // Table index = ((s0 * 24 + s1) * 24 + s2) * 24 + s3 over the cross edges DR DF DL DB.
  const fixedEdges = new Map(CROSS_EDGES.map((edge, i) => [edge, Math.floor(index / 24 ** (3 - i)) % 24] as const));
  const target = randomState(rng, new Map(), fixedEdges);
  const scramble = await stateScramble(target, rng);
  if (crossDistance(scrambledState(scramble)) !== targetMoves) throw new Error("Cross scramble misses its target");
  return scramble;
}

function xcrossCandidate(targetMoves: number, rng: Rng): CubeState {
  if (targetMoves > XCROSS_WALK_MAX) return randomState(rng, new Map(), new Map());
  const { corner, edge } = SLOT_INFO[SLOTS[randomInt(rng, SLOTS.length)]!];
  const fixedEdges = new Map([...CROSS_EDGES.map((cross) => [cross, cross * 2] as const), [edge, edge * 2] as const]);
  const start = randomState(rng, new Map([[corner, corner * 3]]), fixedEdges);
  return targetMoves === 0 ? start : applyAlg(start, randomScramble(rng, targetMoves));
}

/**
 * A random-state scramble whose best xcross (white cross on D plus whichever F2L pair is cheapest) takes exactly
 * `targetMoves` face turns, 0 to MAX_XCROSS_MOVES.
 */
export async function xcrossScramble(targetMoves: number, rng: Rng): Promise<string> {
  assertTarget(targetMoves, MAX_XCROSS_MOVES);
  for (let attempt = 0; attempt < MAX_XCROSS_ATTEMPTS; attempt++) {
    const candidate = xcrossCandidate(targetMoves, rng);
    if (solveXCross(candidate)?.moves !== targetMoves) continue;
    return stateScramble(candidate, rng);
  }
  throw new Error(`No ${targetMoves}-move xcross found in ${MAX_XCROSS_ATTEMPTS} random states`);
}
