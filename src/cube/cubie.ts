// Cubie-level 3x3x3 model with fixed centres (Kociemba's cubie conventions).
//
// Corner positions: URF UFL ULB UBR DFR DLF DBL DRB. Edge positions: UR UF UL UB DR DF DL DB FR FL BL BR.
// `cp[i]` is the corner cubie sitting at position i and `co[i]` its twist (0 = its U/D sticker faces U/D);
// edges likewise, with `eo[i]` = 1 when the edge is flipped relative to the F/B-axis convention.
// Every state here is in the solver frame (white on D, green on F), see src/cube/types.ts.

import type { Move } from "./types";

export type CubeState = {
  readonly cp: readonly number[];
  readonly co: readonly number[];
  readonly ep: readonly number[];
  readonly eo: readonly number[];
};

export const FACES = ["U", "R", "F", "D", "L", "B"] as const;
export type Face = (typeof FACES)[number];

export const CORNER_NAMES = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"] as const;
export const EDGE_NAMES = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"] as const;

export const SOLVED: CubeState = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7],
  co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const BASE_TURNS: Record<Face, CubeState> = {
  U: {
    cp: [3, 0, 1, 2, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  R: {
    cp: [4, 1, 2, 0, 7, 5, 6, 3],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  F: {
    cp: [1, 5, 2, 3, 0, 4, 6, 7],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  D: {
    cp: [0, 1, 2, 3, 5, 6, 7, 4],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  L: {
    cp: [0, 2, 6, 3, 4, 1, 5, 7],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  B: {
    cp: [0, 1, 3, 7, 4, 5, 2, 6],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
};

/** Applies `b` after `a` (Kociemba's cubie multiplication a·b). */
export function multiply(a: CubeState, b: CubeState): CubeState {
  const cp = new Array<number>(8);
  const co = new Array<number>(8);
  for (let i = 0; i < 8; i++) {
    const from = b.cp[i]!;
    cp[i] = a.cp[from]!;
    co[i] = (a.co[from]! + b.co[i]!) % 3;
  }
  const ep = new Array<number>(12);
  const eo = new Array<number>(12);
  for (let i = 0; i < 12; i++) {
    const from = b.ep[i]!;
    ep[i] = a.ep[from]!;
    eo[i] = (a.eo[from]! + b.eo[i]!) % 2;
  }
  return { cp, co, ep, eo };
}

const SUFFIXES = ["", "2", "'"] as const;

/** The 18 face turns in index order: face index * 3 + (0 quarter, 1 half, 2 inverse). */
export const MOVE_NAMES: readonly Move[] = FACES.flatMap((face) => SUFFIXES.map((suffix) => face + suffix));

export const MOVE_CUBIES: readonly CubeState[] = FACES.flatMap((face) => {
  const quarter = BASE_TURNS[face];
  const half = multiply(quarter, quarter);
  return [quarter, half, multiply(half, quarter)];
});

const MOVE_INDEX = new Map<string, number>(MOVE_NAMES.map((name, index) => [name, index]));

export function moveIndex(move: Move): number {
  const index = MOVE_INDEX.get(move);
  if (index === undefined) throw new Error(`Not an outer face turn: "${move}"`);
  return index;
}

export function moveFace(moveIdx: number): number {
  return Math.floor(moveIdx / 3);
}

export function applyMove(state: CubeState, move: Move | number): CubeState {
  const index = typeof move === "number" ? move : moveIndex(move);
  const cubie = MOVE_CUBIES[index];
  if (!cubie) throw new Error(`Move index out of range: ${index}`);
  return multiply(state, cubie);
}

/** Applies face turns (a string or parsed list). Wide, slice and rotation moves must go through toFaceTurns first. */
export function applyAlg(state: CubeState, alg: string | readonly Move[]): CubeState {
  const moves = typeof alg === "string" ? parseAlg(alg) : alg;
  return moves.reduce<CubeState>((current, move) => applyMove(current, move), state);
}

export function isSolved(state: CubeState): boolean {
  return stateKey(state) === SOLVED_KEY;
}

export function stateKey(state: CubeState): string {
  return `${state.cp.join("")}.${state.co.join("")}.${state.ep.map((e) => e.toString(16)).join("")}.${state.eo.join("")}`;
}

const SOLVED_KEY = stateKey(SOLVED);

// ---------------------------------------------------------------------------------------------------------------
// Notation

type Token = { family: string; amount: number };

const TOKEN_RE = /^([URFDLB]w|[URFDLBMESxyzurfdlb])(\d*)('?)(\d*)('?)$/;

function amountOf(raw: string, digitsA: string, primeA: string, digitsB: string, primeB: string): number {
  const digits = digitsA || digitsB;
  if (digitsA && digitsB) throw new Error(`Malformed move: "${raw}"`);
  if (primeA && primeB) throw new Error(`Malformed move: "${raw}"`);
  const magnitude = digits ? Number.parseInt(digits, 10) : 1;
  const signed = primeA || primeB ? -magnitude : magnitude;
  return ((signed % 4) + 4) % 4;
}

function tokenize(alg: string): Token[] {
  const cleaned = alg.replace(/[()[\]]/g, " ").replace(/’/g, "'").trim();
  if (cleaned === "") return [];
  return cleaned.split(/\s+/).flatMap((raw) => {
    const match = TOKEN_RE.exec(raw);
    if (!match) throw new Error(`Unrecognised move: "${raw}"`);
    const [, family = "", digitsA = "", primeA = "", digitsB = "", primeB = ""] = match;
    const amount = amountOf(raw, digitsA, primeA, digitsB, primeB);
    return amount === 0 ? [] : [{ family, amount }];
  });
}

function faceTurnName(face: Face, amount: number): Move {
  const normalized = ((amount % 4) + 4) % 4;
  if (normalized === 0) throw new Error("Zero-amount face turn has no name");
  return face + (normalized === 1 ? "" : normalized === 2 ? "2" : "'");
}

function isFace(family: string): family is Face {
  return (FACES as readonly string[]).includes(family);
}

/** Parses outer face turns only (accepts R2', R'2, R3 and brackets) into canonical names like "R", "R2", "R'". */
export function parseAlg(alg: string): Move[] {
  return tokenize(alg).map(({ family, amount }) => {
    if (!isFace(family)) throw new Error(`"${family}" is not an outer face turn; convert with toFaceTurns first`);
    return faceTurnName(family, amount);
  });
}

function canonical(alg: string | readonly Move[]): Move[] {
  return parseAlg(typeof alg === "string" ? alg : alg.join(" "));
}

export function invertAlg(alg: string | readonly Move[]): Move[] {
  return canonical(alg).reverse().map((move) => {
    const face = move[0] as Face;
    const amount = move.endsWith("2") ? 2 : move.endsWith("'") ? 1 : 3;
    return faceTurnName(face, amount);
  });
}

/** Merges adjacent turns of the same face (R R → R2, R R' → nothing). */
export function simplifyMoves(moves: readonly Move[]): Move[] {
  const out: { face: Face; amount: number }[] = [];
  for (const move of canonical(moves)) {
    const face = move[0] as Face;
    const amount = move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
    const last = out.at(-1);
    if (last?.face !== face) {
      out.push({ face, amount });
      continue;
    }
    last.amount = (last.amount + amount) % 4;
    if (last.amount === 0) out.pop();
  }
  return out.map(({ face, amount }) => faceTurnName(face, amount));
}

// Orientation tracking for toFaceTurns: `frame[d]` is the fixed-centre face that currently sits in direction d.
type Frame = Record<Face, Face>;

const ROTATION_CYCLES: Record<"x" | "y" | "z", readonly Face[]> = {
  // Each list is the order in which one quarter rotation carries a face's content: F → U → B → D for x.
  x: ["F", "U", "B", "D"],
  y: ["F", "L", "B", "R"],
  z: ["U", "R", "D", "L"],
};

function rotateFrame(frame: Frame, axis: "x" | "y" | "z", amount: number): Frame {
  const cycle = ROTATION_CYCLES[axis];
  let current = frame;
  for (let turn = 0; turn < ((amount % 4) + 4) % 4; turn++) {
    const next = { ...current };
    for (let i = 0; i < 4; i++) next[cycle[(i + 1) % 4]!] = current[cycle[i]!];
    current = next;
  }
  return current;
}

type Expansion = { turns: [Face, number][]; rotation?: ["x" | "y" | "z", number] };

// Wide and slice moves as an outer turn (or two) plus a whole-cube rotation, e.g. r = L x and M = R L' x'.
function expand(family: string, amount: number): Expansion {
  const a = amount;
  switch (family) {
    case "r":
    case "Rw":
      return { turns: [["L", a]], rotation: ["x", a] };
    case "l":
    case "Lw":
      return { turns: [["R", a]], rotation: ["x", -a] };
    case "u":
    case "Uw":
      return { turns: [["D", a]], rotation: ["y", a] };
    case "d":
    case "Dw":
      return { turns: [["U", a]], rotation: ["y", -a] };
    case "f":
    case "Fw":
      return { turns: [["B", a]], rotation: ["z", a] };
    case "b":
    case "Bw":
      return { turns: [["F", a]], rotation: ["z", -a] };
    case "M":
      return { turns: [["R", a], ["L", -a]], rotation: ["x", -a] };
    case "E":
      return { turns: [["U", a], ["D", -a]], rotation: ["y", -a] };
    case "S":
      return { turns: [["F", -a], ["B", a]], rotation: ["z", a] };
    case "x":
    case "y":
    case "z":
      return { turns: [], rotation: [family, a] };
    default:
      if (isFace(family)) return { turns: [[family, a]] };
      throw new Error(`Unsupported move family: "${family}"`);
  }
}

function rotationName(axis: "x" | "y" | "z", amount: number): string {
  const normalized = ((amount % 4) + 4) % 4;
  return axis + (normalized === 1 ? "" : normalized === 2 ? "2" : "'");
}

/**
 * Rewrites an alg with wide moves, slices and rotations as outer face turns on a cube whose centres never move.
 * `rotations` lists the whole-cube rotations that the original alg leaves behind, so that
 * alg ≡ moves followed by rotations (exactly, centres included).
 */
export function toFaceTurnsDetailed(alg: string): { moves: Move[]; rotations: string[] } {
  let frame: Frame = { U: "U", R: "R", F: "F", D: "D", L: "L", B: "B" };
  const moves: Move[] = [];
  const rotations: string[] = [];
  for (const { family, amount } of tokenize(alg)) {
    const { turns, rotation } = expand(family, amount);
    for (const [face, turnAmount] of turns) moves.push(faceTurnName(frame[face], turnAmount));
    if (!rotation) continue;
    const [axis, rotationAmount] = rotation;
    frame = rotateFrame(frame, axis, rotationAmount);
    if (((rotationAmount % 4) + 4) % 4 !== 0) rotations.push(rotationName(axis, rotationAmount));
  }
  return { moves: simplifyMoves(moves), rotations };
}

/** Outer-face-turn equivalent of an alg that may contain r, Rw, M, E, S, x, y, z (fixed-centre frame). */
export function toFaceTurns(alg: string): string {
  return toFaceTurnsDetailed(alg).moves.join(" ");
}

// WCA scrambles hold white on U; the solver frame is the same cube after z2, so U↔D and R↔L swap.
const Z2_FACE: Record<Face, Face> = { U: "D", D: "U", R: "L", L: "R", F: "F", B: "B" };

export function scrambleToSolverFrame(scramble: string): Move[] {
  return toFaceTurnsDetailed(scramble).moves.map((move) => Z2_FACE[move[0] as Face] + move.slice(1));
}

/** The cube state, in the solver frame, after a WCA-orientation scramble. */
export function scrambledState(scramble: string): CubeState {
  return applyAlg(SOLVED, scrambleToSolverFrame(scramble));
}
