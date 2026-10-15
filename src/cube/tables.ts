// Pruning tables: exact distances (in face turns) over four tracked pieces, filled by breadth-first search from
// the solved state and built lazily on first use. Index = ((s0 * 24 + s1) * 24 + s2) * 24 + s3.

import { CORNER_MOVES, EDGE_MOVES, MOVE_COUNT, PIECE_STATES } from "./pieces";

export const UNREACHED = 255;
const SIZE = PIECE_STATES ** 4;

export function tableIndex(s0: number, s1: number, s2: number, s3: number): number {
  return ((s0 * PIECE_STATES + s1) * PIECE_STATES + s2) * PIECE_STATES + s3;
}

function buildTable(first: Uint8Array, homes: readonly [number, number, number, number]): Uint8Array {
  const dist = new Uint8Array(SIZE).fill(UNREACHED);
  // Parallel queues hold the four piece states so nothing has to be decoded from the index.
  const q0 = new Uint8Array(SIZE);
  const q1 = new Uint8Array(SIZE);
  const q2 = new Uint8Array(SIZE);
  const q3 = new Uint8Array(SIZE);
  const edges = EDGE_MOVES;
  const n = PIECE_STATES;
  [q0[0], q1[0], q2[0], q3[0]] = homes;
  dist[tableIndex(...homes)] = 0;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const s0 = q0[head]!;
    const s1 = q1[head]!;
    const s2 = q2[head]!;
    const s3 = q3[head]!;
    head++;
    const next = dist[((s0 * n + s1) * n + s2) * n + s3]! + 1;
    for (let row = 0; row < MOVE_COUNT * n; row += n) {
      const t0 = first[row + s0]!;
      const t1 = edges[row + s1]!;
      const t2 = edges[row + s2]!;
      const t3 = edges[row + s3]!;
      const target = ((t0 * n + t1) * n + t2) * n + t3;
      if (dist[target] !== UNREACHED) continue;
      dist[target] = next;
      q0[tail] = t0;
      q1[tail] = t1;
      q2[tail] = t2;
      q3[tail] = t3;
      tail++;
    }
  }
  return dist;
}

let crossTable: Uint8Array | undefined;
let nearTable: Uint8Array | undefined;
let farTable: Uint8Array | undefined;

/** Cross edges DR, DF, DL, DB (edge states). */
export function getCrossTable(): Uint8Array {
  crossTable ??= buildTable(EDGE_MOVES, [4 * 2, 5 * 2, 6 * 2, 7 * 2]);
  return crossTable;
}

/** FR pair (corner DFR, edge FR) with the adjacent cross edges DR and DF. */
export function getNearTable(): Uint8Array {
  nearTable ??= buildTable(CORNER_MOVES, [4 * 3, 8 * 2, 4 * 2, 5 * 2]);
  return nearTable;
}

/** FR pair (corner DFR, edge FR) with the opposite cross edges DL and DB. */
export function getFarTable(): Uint8Array {
  farTable ??= buildTable(CORNER_MOVES, [4 * 3, 8 * 2, 6 * 2, 7 * 2]);
  return farTable;
}
