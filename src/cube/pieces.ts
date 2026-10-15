// Single-piece coordinates for the searches: a corner state is position * 3 + twist and an edge state is
// position * 2 + flip, so every piece lives in 0..23 and a turn is one table lookup.

import { MOVE_CUBIES, type CubeState } from "./cubie";
import type { Slot } from "./types";

export const MOVE_COUNT = 18;
export const PIECE_STATES = 24;

function buildPieceMoves(size: 8 | 12): Uint8Array {
  const twists = size === 8 ? 3 : 2;
  const table = new Uint8Array(MOVE_COUNT * PIECE_STATES);
  MOVE_CUBIES.forEach((cubie, m) => {
    const perm = size === 8 ? cubie.cp : cubie.ep;
    const ori = size === 8 ? cubie.co : cubie.eo;
    for (let to = 0; to < size; to++) {
      const from = perm[to]!;
      for (let twist = 0; twist < twists; twist++) {
        table[m * PIECE_STATES + from * twists + twist] = to * twists + ((twist + ori[to]!) % twists);
      }
    }
  });
  return table;
}

/** CORNER_MOVES[m * 24 + s]: the state of a corner in state s after move m. */
export const CORNER_MOVES = buildPieceMoves(8);
/** EDGE_MOVES[m * 24 + s]: the state of an edge in state s after move m. */
export const EDGE_MOVES = buildPieceMoves(12);

export function cornerState(state: CubeState, piece: number): number {
  const pos = state.cp.indexOf(piece);
  return pos * 3 + state.co[pos]!;
}

export function edgeState(state: CubeState, piece: number): number {
  const pos = state.ep.indexOf(piece);
  return pos * 2 + state.eo[pos]!;
}

/** Cross edges in the solver frame: DR DF DL DB. */
export const CROSS_EDGES = [4, 5, 6, 7] as const;

export const SLOTS: readonly Slot[] = ["FR", "FL", "BL", "BR"];

export type SlotInfo = {
  slot: Slot;
  corner: number;
  edge: number;
  /** y' turns that carry this slot to FR; the pruning tables are built for FR only. */
  turnsToFR: number;
  /** The cross edges playing the roles of DR and DF (near) and DL and DB (far) once the slot sits at FR. */
  near: readonly [number, number];
  far: readonly [number, number];
};

export const SLOT_INFO: Record<Slot, SlotInfo> = {
  FR: { slot: "FR", corner: 4, edge: 8, turnsToFR: 0, near: [4, 5], far: [6, 7] },
  FL: { slot: "FL", corner: 5, edge: 9, turnsToFR: 1, near: [5, 6], far: [7, 4] },
  BL: { slot: "BL", corner: 6, edge: 10, turnsToFR: 2, near: [6, 7], far: [4, 5] },
  BR: { slot: "BR", corner: 7, edge: 11, turnsToFR: 3, near: [7, 4], far: [5, 6] },
};

export function isCrossSolved(state: CubeState): boolean {
  return CROSS_EDGES.every((edge) => state.ep[edge] === edge && state.eo[edge] === 0);
}

export function isSlotSolved(state: CubeState, slot: Slot): boolean {
  const { corner, edge } = SLOT_INFO[slot];
  return state.cp[corner] === corner && state.co[corner] === 0 && state.ep[edge] === edge && state.eo[edge] === 0;
}

export function solvedSlots(state: CubeState): Slot[] {
  return SLOTS.filter((slot) => isSlotSolved(state, slot));
}

// A y' turn carries face F to R, R to B, B to L and L to F. Turning physical face X before the rotation is the
// same as turning face Y_PRIME_FACE[X] after it; move indices are face * 3 + variant with faces U R F D L B.
const Y_PRIME_FACE = [0, 5, 1, 3, 2, 4];

function relabelMove(m: number, turns: number): number {
  let face = Math.floor(m / 3);
  for (let i = 0; i < turns; i++) face = Y_PRIME_FACE[face]!;
  return face * 3 + (m % 3);
}

// Conjugating by y'^k maps a piece state to the state it has in the rotated frame. Rather than hand-derive the
// orientation conventions, walk the move graph in both frames from a piece whose orientation is unaffected
// (D-layer pieces keep their D sticker on D) and record the correspondence, failing loudly if it is inconsistent.
function buildFrameMap(moves: Uint8Array, homes: readonly [number, number][], turns: number): Uint8Array {
  const map = new Uint8Array(PIECE_STATES).fill(255);
  for (const [from, to] of homes) {
    const queue: [number, number][] = [[from, to]];
    if (map[from] !== 255 && map[from] !== to) throw new Error("Inconsistent frame map seed");
    map[from] = to;
    while (queue.length > 0) {
      const [s, t] = queue.shift()!;
      for (let m = 0; m < MOVE_COUNT; m++) {
        const ns = moves[m * PIECE_STATES + s]!;
        const nt = moves[relabelMove(m, turns) * PIECE_STATES + t]!;
        if (map[ns] === 255) {
          map[ns] = nt;
          queue.push([ns, nt]);
        } else if (map[ns] !== nt) {
          throw new Error(`Frame map conflict for y'^${turns}`);
        }
      }
    }
  }
  if (map.includes(255)) throw new Error(`Frame map for y'^${turns} is incomplete`);
  return map;
}

// Where a y' turn carries each D-layer position. The numbering lines up for both kinds of piece (corners
// DFR DLF DBL DRB and edges DR DF DL DB are both 4..7), so one table serves both.
const Y_PRIME_D_POSITION: Record<number, number> = { 4: 7, 5: 4, 6: 5, 7: 6 };

function rotatePosition(table: Record<number, number>, pos: number, turns: number): number {
  let current = pos;
  for (let i = 0; i < turns; i++) current = table[current]!;
  return current;
}

type FrameMaps = { corner: Uint8Array; edge: Uint8Array; sliceEdge: Uint8Array };

function frameMaps(turns: number): FrameMaps {
  const dPositions = [4, 5, 6, 7];
  const cornerHomes = dPositions.map((p): [number, number] => [p * 3, rotatePosition(Y_PRIME_D_POSITION, p, turns) * 3]);
  const edgeHomes = dPositions.map((p): [number, number] => [p * 2, rotatePosition(Y_PRIME_D_POSITION, p, turns) * 2]);
  const edge = buildFrameMap(EDGE_MOVES, edgeHomes, turns);
  // An E-slice edge is oriented by its F/B sticker. After an odd number of y' turns it plays the role of a piece
  // whose F/B sticker was its R/L sticker, so its flip reads the other way round.
  const sliceEdge = turns % 2 === 1 ? edge.map((s) => s ^ 1) : edge;
  return { corner: buildFrameMap(CORNER_MOVES, cornerHomes, turns), edge, sliceEdge };
}

/**
 * FRAME_MAPS[k]: piece-state maps into the frame turned by y'^k. Use `corner` for corners, `edge` for U/D-layer
 * edges (oriented by their U/D sticker) and `sliceEdge` for the F2L edges.
 */
export const FRAME_MAPS = [0, 1, 2, 3].map(frameMaps);
