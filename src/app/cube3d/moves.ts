// A move as the 3D cube turns it: which layers, about which axis, and how far, and the arithmetic of turning cubies.
//
// Coordinates are three.js's with the cube centred on the origin: +x is R, +y is U, +z is F, and each cubie sits at
// -1, 0 or 1 on every axis. A positive quarter is a quarter turn anticlockwise about the positive axis (right-hand
// rule), so a face's clockwise turn is a negative quarter about its outward normal: R is -1 about +x, L is +1.

import { Matrix4, Quaternion, Vector3 } from "three";

export type Axis = "x" | "y" | "z";

export type LayerTurn = {
  axis: Axis;
  /** The layers that turn, by their coordinate on the axis. */
  layers: readonly number[];
  /** Signed quarter turns about the positive axis. */
  quarters: number;
};

type Family = { axis: Axis; layers: readonly number[]; sign: 1 | -1 };

const ALL = [-1, 0, 1] as const;

const FAMILIES: Readonly<Record<string, Family>> = {
  R: { axis: "x", layers: [1], sign: -1 },
  L: { axis: "x", layers: [-1], sign: 1 },
  U: { axis: "y", layers: [1], sign: -1 },
  D: { axis: "y", layers: [-1], sign: 1 },
  F: { axis: "z", layers: [1], sign: -1 },
  B: { axis: "z", layers: [-1], sign: 1 },
  // A slice turns the way the face it follows does: M like L, E like D, S like F.
  M: { axis: "x", layers: [0], sign: 1 },
  E: { axis: "y", layers: [0], sign: 1 },
  S: { axis: "z", layers: [0], sign: -1 },
  // A rotation turns the whole cube the way its face does: x like R, y like U, z like F.
  x: { axis: "x", layers: ALL, sign: -1 },
  y: { axis: "y", layers: ALL, sign: -1 },
  z: { axis: "z", layers: ALL, sign: -1 },
};

/** "R", "r", "Rw", "M", "x" with an optional amount and prime ("U2", "R'", "M2'" spins a half turn the other way). */
const MOVE = /^([URFDLBurfdlbMESxyz])(w?)(\d*)('?)$/;

function family(letter: string, wide: boolean): Family | undefined {
  const lower = letter === letter.toLowerCase() && "urfdlb".includes(letter);
  const face = FAMILIES[lower ? letter.toUpperCase() : letter];
  if (!face) return undefined;
  if (!(lower || wide)) return face;
  if (!"URFDLB".includes(lower ? letter.toUpperCase() : letter)) return undefined;
  // A wide move is its face's layer and the middle one.
  return { ...face, layers: [...face.layers, 0] };
}

/** The layer turn a move makes, or null when it isn't a move the cube knows. */
export function parseTurn(move: string): LayerTurn | null {
  const parts = MOVE.exec(move);
  if (!parts) return null;
  const [, letter = "", wide = "", digits = "", prime = ""] = parts;
  const found = family(letter, wide === "w");
  if (!found) return null;
  const amount = digits ? Number(digits) : 1;
  return { axis: found.axis, layers: found.layers, quarters: found.sign * amount * (prime ? -1 : 1) };
}

/** Where a cubie is and how it's turned, relative to where it started (solved). */
export type Placement = { position: Vector3; quaternion: Quaternion };

const AXES: Readonly<Record<Axis, Vector3>> = { x: new Vector3(1, 0, 0), y: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) };

export function inLayers(position: Vector3, turn: LayerTurn): boolean {
  return turn.layers.includes(Math.round(position[turn.axis]));
}

/** The rotation `fraction` of the way through the turn. */
export function turnRotation(turn: LayerTurn, fraction = 1, into = new Quaternion()): Quaternion {
  return into.setFromAxisAngle(AXES[turn.axis], (turn.quarters * Math.PI * fraction) / 2);
}

const snapMatrix = new Matrix4();

/** Back onto the grid: positions to whole cubies, orientations to whole quarter turns, so error never builds up. */
export function snap(placement: Placement): void {
  const { position, quaternion } = placement;
  position.set(Math.round(position.x), Math.round(position.y), Math.round(position.z));
  snapMatrix.makeRotationFromQuaternion(quaternion);
  const e = snapMatrix.elements;
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[i] = Math.round(e[i]!);
  quaternion.setFromRotationMatrix(snapMatrix);
}

/** The whole turn at once on the cubies in its layers. */
export function applyTurn(placements: readonly Placement[], turn: LayerTurn): void {
  const rotation = turnRotation(turn);
  for (const placement of placements) {
    if (!inLayers(placement.position, turn)) continue;
    placement.position.applyQuaternion(rotation);
    placement.quaternion.premultiply(rotation);
    snap(placement);
  }
}
