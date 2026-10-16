// Cross, F2L-pair and XCross solvers. All searches run on single-piece coordinates (see pieces.ts) and use
// iterative deepening with admissible heuristics taken from the exact pruning tables in tables.ts.

import { FACES, MOVE_NAMES, moveFace, moveIndex, stateKey, type CubeState, type Face } from "./cubie";
import {
  CORNER_MOVES,
  CROSS_EDGES,
  EDGE_MOVES,
  FRAME_MAPS,
  MOVE_COUNT,
  PIECE_STATES,
  SLOT_INFO,
  SLOTS,
  cornerState,
  edgeState,
} from "./pieces";
import { getCrossTable, getFarTable, getNearTable, tableIndex } from "./tables";
import type { Move, Slot } from "./types";

export type StepSolution = { readonly moves: number; readonly solution: string };
export type XCrossSolution = StepSolution & { slot: Slot };

export const MAX_PAIR_DEPTH = 11;
const NO_FACE = -10;

// Skip a second turn of the same face, and order commuting opposite faces (U before D, R before L, F before B)
// so each sequence is generated once.
function isRedundant(face: number, prevFace: number): boolean {
  return face === prevFace || face === prevFace - 3;
}

function crossStates(state: CubeState): [number, number, number, number] {
  const [a, b, c, d] = CROSS_EDGES.map((edge) => edgeState(state, edge));
  return [a!, b!, c!, d!];
}

export function crossDistance(state: CubeState): number {
  return getCrossTable()[tableIndex(...crossStates(state))]!;
}

/** Up to `max` optimal cross solutions (outer face turns), found by always stepping to a closer state. */
export function solveCross(state: CubeState, max = 8): string[] {
  const table = getCrossTable();
  const solutions: string[] = [];
  const path: number[] = [];
  const walk = (s: readonly number[], remaining: number, prevFace: number): void => {
    if (remaining === 0) {
      solutions.push(path.map((m) => MOVE_NAMES[m]).join(" "));
      return;
    }
    for (let m = 0; m < MOVE_COUNT && solutions.length < max; m++) {
      const face = moveFace(m);
      if (isRedundant(face, prevFace)) continue;
      const row = m * PIECE_STATES;
      const next = s.map((piece) => EDGE_MOVES[row + piece]!);
      if (table[tableIndex(next[0]!, next[1]!, next[2]!, next[3]!)] !== remaining - 1) continue;
      path.push(m);
      walk(next, remaining - 1, face);
      path.pop();
    }
  };
  const start = crossStates(state);
  walk(start, table[tableIndex(...start)]!, NO_FACE);
  return solutions;
}

/**
 * A cross solution of exactly `length` turns that does not pass through a solved cross on the way, trying moves
 * in the order given by `pickOrder` (used by the demo to vary its crosses). Returns null if none exists.
 */
export function findCrossOfLength(state: CubeState, length: number, pickOrder: () => number[]): string | null {
  const table = getCrossTable();
  const path: number[] = [];
  const walk = (s: readonly number[], remaining: number, prevFace: number): boolean => {
    const dist = table[tableIndex(s[0]!, s[1]!, s[2]!, s[3]!)]!;
    if (remaining === 0) return dist === 0;
    if (dist === 0 || dist > remaining) return false;
    for (const m of pickOrder()) {
      const face = moveFace(m);
      if (isRedundant(face, prevFace)) continue;
      const row = m * PIECE_STATES;
      path.push(m);
      if (walk(s.map((piece) => EDGE_MOVES[row + piece]!), remaining - 1, face)) return true;
      path.pop();
    }
    return false;
  };
  const start = crossStates(state);
  if (length === 0) return table[tableIndex(...start)] === 0 ? "" : null;
  return walk(start, length, NO_FACE) ? path.map((m) => MOVE_NAMES[m]).join(" ") : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Piece-coordinate IDA*

const IDENTITY_MAP = Uint8Array.from({ length: PIECE_STATES }, (_, i) => i);

/** One pruning-table lookup: four tracked pieces (indices into the piece vector), each through a frame map. */
type Term = {
  table: Uint8Array;
  pieces: readonly [number, number, number, number];
  maps: readonly [Uint8Array, Uint8Array, Uint8Array, Uint8Array];
};

type SearchSpec = {
  /** Every term must reach 0. */
  all: Term[];
  /** At least one group must have all of its terms at 0 (empty = no such requirement). */
  anyOf: Term[][];
};

type PieceLayout = {
  /** 1 = corner, 0 = edge, per tracked piece. */
  kinds: Uint8Array;
  start: Uint8Array;
  crossTerm: Term;
  slotTerms: (slot: Slot) => [Term, Term];
};

function lookup(term: Term, states: Uint8Array, base: number): number {
  const [p0, p1, p2, p3] = term.pieces;
  const [m0, m1, m2, m3] = term.maps;
  return term.table[
    tableIndex(m0[states[base + p0]!]!, m1[states[base + p1]!]!, m2[states[base + p2]!]!, m3[states[base + p3]!]!)
  ]!;
}

/** Heuristic value, or any number above `limit` as soon as the bound is known to be exceeded. */
function evaluate(spec: SearchSpec, states: Uint8Array, base: number, limit: number): number {
  let h = 0;
  for (const term of spec.all) {
    const value = lookup(term, states, base);
    if (value > h) h = value;
    if (h > limit) return h;
  }
  if (spec.anyOf.length === 0) return h;
  let best = Infinity;
  for (const group of spec.anyOf) {
    let groupH = 0;
    for (const term of group) {
      groupH = Math.max(groupH, lookup(term, states, base));
      if (groupH >= best) break;
    }
    best = Math.min(best, groupH);
  }
  return Math.max(h, best);
}

function buildLayout(state: CubeState, slots: readonly Slot[]): PieceLayout {
  const kinds: number[] = [0, 0, 0, 0];
  const start: number[] = crossStates(state);
  const slotIndex = new Map<Slot, number>();
  for (const slot of slots) {
    const { corner, edge } = SLOT_INFO[slot];
    slotIndex.set(slot, kinds.length);
    kinds.push(1, 0);
    start.push(cornerState(state, corner), edgeState(state, edge));
  }
  const crossTerm: Term = {
    table: getCrossTable(),
    pieces: [0, 1, 2, 3],
    maps: [IDENTITY_MAP, IDENTITY_MAP, IDENTITY_MAP, IDENTITY_MAP],
  };
  const slotTerms = (slot: Slot): [Term, Term] => {
    const info = SLOT_INFO[slot];
    const at = slotIndex.get(slot);
    if (at === undefined) throw new Error(`Slot ${slot} is not tracked`);
    const { corner, edge, sliceEdge } = FRAME_MAPS[info.turnsToFR]!;
    const crossAt = (piece: number): number => CROSS_EDGES.indexOf(piece as 4 | 5 | 6 | 7);
    const term = (table: Uint8Array, roles: readonly [number, number]): Term => ({
      table,
      pieces: [at, at + 1, crossAt(roles[0]), crossAt(roles[1])],
      maps: [corner, sliceEdge, edge, edge],
    });
    return [term(getNearTable(), info.near), term(getFarTable(), info.far)];
  };
  return { kinds: Uint8Array.from(kinds), start: Uint8Array.from(start), crossTerm, slotTerms };
}

/**
 * `faces` and `moves` restrict the turns (fixed-centre names), tried in the order given; pass one or neither.
 * Among equally short solutions the search returns the first in that order, so listing what a person favours
 * first biases it towards them.
 */
export type SearchOptions = {
  maxDepth?: number;
  avoidFirstFace?: number;
  /** Turn only these faces (all three turns of each). */
  faces?: readonly Face[];
  /** Turn only these outer turns, e.g. ["U", "U2", "U'", "R", "R'"]. */
  moves?: readonly Move[];
};

const ALL_MOVES: readonly number[] = Array.from({ length: MOVE_COUNT }, (_, m) => m);

function allowedMoves({ faces, moves }: SearchOptions): readonly number[] {
  if (faces && moves) throw new Error("Restrict the search by faces or by moves, not both");
  const allowed =
    moves?.map(moveIndex) ?? faces?.flatMap((face) => [0, 1, 2].map((variant) => FACES.indexOf(face) * 3 + variant));
  if (!allowed) return ALL_MOVES;
  if (new Set(allowed).size !== allowed.length) throw new Error(`Repeated move in ${allowed.join(",")}`);
  return allowed;
}

function idaStar(layout: PieceLayout, spec: SearchSpec, options: SearchOptions): number[] | null {
  const maxDepth = options.maxDepth ?? MAX_PAIR_DEPTH;
  const moves = allowedMoves(options);
  const width = layout.kinds.length;
  const states = new Uint8Array((maxDepth + 1) * width);
  states.set(layout.start);
  const path: number[] = [];

  const dfs = (g: number, bound: number, prevFace: number): boolean => {
    const base = g * width;
    const childBase = base + width;
    for (const m of moves) {
      const face = moveFace(m);
      if (isRedundant(face, prevFace)) continue;
      if (g === 0 && face === options.avoidFirstFace) continue;
      const row = m * PIECE_STATES;
      for (let i = 0; i < width; i++) {
        const table = layout.kinds[i] === 1 ? CORNER_MOVES : EDGE_MOVES;
        states[childBase + i] = table[row + states[base + i]!]!;
      }
      const limit = bound - g - 1;
      const h = evaluate(spec, states, childBase, limit);
      if (h > limit) continue;
      path.push(m);
      if (h === 0 || dfs(g + 1, bound, face)) return true;
      path.pop();
    }
    return false;
  };

  const h0 = evaluate(spec, states, 0, maxDepth);
  if (h0 === 0) return [];
  for (let bound = h0; bound <= maxDepth; bound++) {
    if (dfs(0, bound, NO_FACE)) return path;
  }
  return null;
}

function toSolution(path: readonly number[]): StepSolution {
  return { moves: path.length, solution: path.map((m) => MOVE_NAMES[m]).join(" ") };
}

const cache = new Map<string, StepSolution | null>();
const CACHE_LIMIT = 2000;

function remember(key: string, value: StepSolution | null): StepSolution | null {
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}

/**
 * Shortest sequence that solves the cross plus every slot in `targets` and `keep` (internal workhorse for
 * solvePair and the solve analysis). Null when nothing is found within `maxDepth`.
 */
export function solveSlots(
  state: CubeState,
  targets: readonly Slot[],
  keep: readonly Slot[],
  options: SearchOptions = {},
): StepSolution | null {
  const slots = SLOTS.filter((slot) => targets.includes(slot) || keep.includes(slot));
  if (slots.length === 0) throw new Error("solveSlots needs at least one target slot");
  const { maxDepth = "", avoidFirstFace = "", faces = [], moves = [] } = options;
  const key = `${stateKey(state)}|${slots.join(",")}|${maxDepth}|${avoidFirstFace}|${faces.join("")}|${moves.join(" ")}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const layout = buildLayout(state, slots);
  const all = [layout.crossTerm, ...slots.flatMap((slot) => layout.slotTerms(slot))];
  const path = idaStar(layout, { all, anyOf: [] }, options);
  return remember(key, path ? toSolution(path) : null);
}

/** Optimal solution for one F2L pair that also keeps the cross and the `keep` slots solved (null beyond 11 turns). */
export function solvePair(state: CubeState, slot: Slot, keep: readonly Slot[] = []): StepSolution | null {
  return solveSlots(state, [slot], keep.filter((kept) => kept !== slot));
}

/** Optimal cross plus any one F2L pair; `slot` names the pair it solves. */
export function solveXCross(state: CubeState, maxDepth = 14): XCrossSolution | null {
  const layout = buildLayout(state, SLOTS);
  const spec: SearchSpec = { all: [layout.crossTerm], anyOf: SLOTS.map((slot) => layout.slotTerms(slot)) };
  const path = idaStar(layout, spec, { maxDepth });
  if (!path) return null;
  const solved = SLOTS.find((slot) => {
    const end = path.reduce((current, m) => applyToPair(current, m), pairStates(state, slot));
    return end[0] === SLOT_INFO[slot].corner * 3 && end[1] === SLOT_INFO[slot].edge * 2;
  });
  if (!solved) throw new Error("XCross search ended without a solved pair");
  return { ...toSolution(path), slot: solved };
}

function pairStates(state: CubeState, slot: Slot): [number, number] {
  return [cornerState(state, SLOT_INFO[slot].corner), edgeState(state, SLOT_INFO[slot].edge)];
}

function applyToPair([corner, edge]: [number, number], m: number): [number, number] {
  const row = m * PIECE_STATES;
  return [CORNER_MOVES[row + corner]!, EDGE_MOVES[row + edge]!];
}
