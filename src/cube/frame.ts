// The solver's view versus the centre frame.
//
// A smart cube reports outer turns relative to its own centres, and solves are stored that way (types.ts). The
// solver names turns after where faces are in their hands instead: after a y rotation the face they call R is the
// centre-frame B. Wide moves and slices move the centres too (r = L with x, M = R L' with x'). FrameTracker keeps
// the current view and converts in both directions.

import {
  FACES,
  IDENTITY_FRAME,
  expandMove,
  faceTurnName,
  rotateFrame,
  rotationName,
  tokenizeAlg,
  type Axis,
  type Frame,
} from "./cubie";
import type { Move, Rotation } from "./types";

/** One move in the solver's view as the cube reports it: centre-frame outer turns, then the centre rotation. */
export type FrameStep = { turns: Move[]; rotation?: Rotation };

const ROTATION_RE = /^([xyz])(2|')?$/;
const TURN_RE = /^[URFDLB](2|')?$/;
const AMOUNT_SUFFIXES = ["", "2", "'"] as const;

export function parseRotation(rotation: string): [Axis, number] {
  const match = ROTATION_RE.exec(rotation);
  if (!match) throw new Error(`Not a whole-cube rotation: "${rotation}"`);
  const [, axis = "", suffix] = match;
  return [axis as Axis, suffix === "2" ? 2 : suffix === "'" ? 3 : 1];
}

/** Splits an alg into single moves in canonical form ("(R2' U)" → ["R2", "U"]); wide moves keep their spelling. */
export function splitMoves(alg: string): string[] {
  return tokenizeAlg(alg).map(({ family, amount }) => family + AMOUNT_SUFFIXES[amount - 1]);
}

/**
 * Tracks which centre sits where in the solver's hands. Feed it moves as the solver sees them (keyboard virtual
 * cube, an alg being executed) to get what a smart cube would report; or feed it reported rotations and use
 * `name` to read reported turns the way the solver saw them.
 */
export class FrameTracker {
  #frame: Frame;

  constructor(frame: Frame = IDENTITY_FRAME) {
    this.#frame = frame;
  }

  /** frame[d] is the centre-frame face currently in direction d of the solver's view. */
  get frame(): Frame {
    return this.#frame;
  }

  /** One move in the solver's view ("R", "r'", "Rw2", "M2", "y") → centre-frame turns and rotation; moves the view. */
  apply(move: string): FrameStep {
    const tokens = tokenizeAlg(move);
    if (tokens.length > 1) throw new Error(`Expected a single move, got "${move}"`);
    const [token] = tokens;
    if (!token) return { turns: [] };
    const { turns, rotation } = expandMove(token.family, token.amount);
    const step: FrameStep = { turns: turns.map(([face, amount]) => faceTurnName(this.#frame[face], amount)) };
    if (!rotation) return step;
    const [axis, amount] = rotation;
    this.#frame = rotateFrame(this.#frame, axis, amount);
    return { ...step, rotation: rotationName(axis, amount) };
  }

  /** Follows a rotation of the whole cube relative to the solver (a gyro reading or a RotationEvent). */
  rotate(rotation: Rotation): void {
    this.#frame = rotateFrame(this.#frame, ...parseRotation(rotation));
  }

  /** The solver's name for a centre-frame outer turn: after y, "B" → "R". */
  name(turn: Move): Move {
    if (!TURN_RE.test(turn)) throw new Error(`Not an outer face turn: "${turn}"`);
    const direction = FACES.find((d) => this.#frame[d] === turn.charAt(0));
    if (!direction) throw new Error(`Frame has no direction for centre ${turn.charAt(0)}`);
    return direction + turn.slice(1);
  }
}
