// Whole-cube rotations from the smart cube's gyro.
//
// The gyro sits on the cube's core, which carries the centres, so it sees exactly what a RotationEvent means: a
// regrip (y), and also the centre movement inside a wide move or slice (r turns the core like x; M like x'). The
// driver reports the core's orientation as a quaternion in the cube's axes (+X red, +Y blue, +Z white) at about
// 10 Hz, and it drifts. So orientation is measured relative to a reference taken at a known grip (white down, green
// front: the start of a solve, or "reset orientation"), snapped to the nearest of the 24 cube orientations, and a
// change counts only once it is close to a new orientation and stays there (hysteresis plus dwell).
//
// Tuning once the cube arrives: GYRO_TUNING below, and GYRO_INVERTED if a y regrip shows up as y'.

import { FrameTracker, parseRotation } from "@/cube";
import type { Move, Rotation } from "@/cube/types";

export type Quaternion = { w: number; x: number; y: number; z: number };

export const GYRO_TUNING = {
  /** A new 90° orientation counts once the cube is within this many degrees of it. Lower is stricter. */
  enterDegrees: 25,
  /**
   * ...for this many reports in a row (~90 ms apart, faster in bursts). Two rejects a single noisy report and still
   * catches an M2 followed by an M a quarter second later; raise it if tilts show up as rotations.
   */
  dwellReports: 2,
  /** A rotation detected this soon after a face turn (ms) may be that turn's wide move or slice. */
  lookbackMs: 450,
  /** The two turns of a slice arrive this close together (ms). */
  slicePairMs: 50,
  /** Two equal quarter turns this close together (ms) are one half turn (matches src/cube HALF_TURN_MS). */
  halfTurnMs: 80,
};

/**
 * Whether the driver's quaternion maps world to cube instead of cube to world. Derived from afedotov's GAN sample
 * app (which renders q0⁻¹·q as the cube's rotation); flip it if a clean y regrip is recorded as y'.
 */
export const GYRO_INVERTED = false;

const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function conjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

function normalize(q: Quaternion): Quaternion {
  const length = Math.hypot(q.w, q.x, q.y, q.z);
  if (length === 0 || !Number.isFinite(length)) throw new Error("Gyro quaternion has no length");
  return { w: q.w / length, x: q.x / length, y: q.y / length, z: q.z / length };
}

/** Angle in degrees between two orientations (a quaternion and its negation are the same orientation). */
export function angleBetween(a: Quaternion, b: Quaternion): number {
  const dot = Math.abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z);
  return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

/**
 * A rotation in the cube's own axes re-expressed in the solver's (x right, y up, z towards the solver). In the
 * reference grip the cube's +X (red) points left, +Y (blue) away and +Z (white) down.
 */
function cubeAxesToSolver(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.z, z: -q.y };
}

/** How the cube has turned in the solver's view since `reference` was read. */
export function rotationSince(reference: Quaternion, current: Quaternion): Quaternion {
  const ref = normalize(reference);
  const now = normalize(current);
  const delta = GYRO_INVERTED ? multiply(ref, conjugate(now)) : multiply(conjugate(ref), now);
  return cubeAxesToSolver(delta);
}

// x, y and z turn the cube like R, U and F: a quarter turn clockwise seen from that side, i.e. -90° about +x/+y/+z.
const S = Math.SQRT1_2;
const QUARTER: Record<"x" | "y" | "z", Quaternion> = {
  x: { w: S, x: -S, y: 0, z: 0 },
  y: { w: S, x: 0, y: -S, z: 0 },
  z: { w: S, x: 0, y: 0, z: -S },
};

function rotationQuaternion(rotation: Rotation): Quaternion {
  const [axis, amount] = parseRotation(rotation);
  let q = IDENTITY;
  for (let i = 0; i < amount; i++) q = multiply(QUARTER[axis], q);
  return q;
}

/** One of the 24 orientations, with the fewest whole-cube rotations (applied in order) that reach it. */
export type GridOrientation = { q: Quaternion; rotations: Rotation[] };

const SINGLE: readonly Rotation[] = ["x", "x2", "x'", "y", "y2", "y'", "z", "z2", "z'"];

function buildGrid(): GridOrientation[] {
  const grid: GridOrientation[] = [{ q: IDENTITY, rotations: [] }];
  const known = (q: Quaternion) => grid.some((g) => angleBetween(g.q, q) < 1);
  for (const r of SINGLE) {
    const q = rotationQuaternion(r);
    if (!known(q)) grid.push({ q, rotations: [r] });
  }
  for (const first of SINGLE) {
    for (const second of SINGLE) {
      const q = multiply(rotationQuaternion(second), rotationQuaternion(first));
      if (!known(q)) grid.push({ q, rotations: [first, second] });
    }
  }
  if (grid.length !== 24) throw new Error(`Expected 24 cube orientations, built ${grid.length}`);
  return grid;
}

export const GRID: readonly GridOrientation[] = buildGrid();

/** The nearest of the 24 orientations and how far away it is (degrees). */
export function snap(q: Quaternion): { orientation: GridOrientation; degrees: number } {
  let best = GRID[0]!;
  let bestDegrees = angleBetween(best.q, q);
  for (const g of GRID) {
    const degrees = angleBetween(g.q, q);
    if (degrees < bestDegrees) {
      best = g;
      bestDegrees = degrees;
    }
  }
  return { orientation: best, degrees: bestDegrees };
}

/** The rotations that take orientation `from` to `to`, in the solver's view. */
export function rotationsBetween(from: GridOrientation, to: GridOrientation): Rotation[] {
  return snap(multiply(to.q, conjugate(from.q))).orientation.rotations;
}

/** Rotations the detector is sure of, and when the cube first came close to the new orientation (host ms). */
export type Detection = { rotations: Rotation[]; since: number };

/**
 * Follows one attempt: feed it every gyro report and it answers with the rotations it is sure of. `reference` is the
 * report at the start of the attempt and `initial` the orientation the cube had then, relative to the reference
 * grip (identity when unknown).
 */
export class RotationDetector {
  readonly #reference: Quaternion;
  readonly #initial: Quaternion;
  #current: GridOrientation;
  #candidate: { orientation: GridOrientation; since: number; reports: number } | null = null;

  constructor(reference: Quaternion, initial: GridOrientation = GRID[0]!) {
    this.#reference = reference;
    this.#initial = initial.q;
    this.#current = initial;
  }

  get orientation(): GridOrientation {
    return this.#current;
  }

  sample(q: Quaternion, t: number): Detection | null {
    const { orientation, degrees } = snap(multiply(rotationSince(this.#reference, q), this.#initial));
    if (orientation === this.#current || degrees > GYRO_TUNING.enterDegrees) {
      this.#candidate = null;
      return null;
    }
    if (this.#candidate?.orientation === orientation) this.#candidate.reports++;
    else this.#candidate = { orientation, since: t, reports: 1 };
    if (this.#candidate.reports < GYRO_TUNING.dwellReports) return null;
    const detection = { rotations: rotationsBetween(this.#current, orientation), since: this.#candidate.since };
    this.#current = orientation;
    this.#candidate = null;
    return detection;
  }
}

/**
 * Where the cube was at the start of a solve relative to the grip saved by "reset orientation": a grid orientation
 * only when it is clearly one (drift since the reset can be large), else null (assume the reference grip).
 */
export function startOrientation(reference: Quaternion | null, atStart: Quaternion): GridOrientation | null {
  if (!reference) return null;
  const { orientation, degrees } = snap(rotationSince(reference, atStart));
  return degrees <= GYRO_TUNING.enterDegrees ? orientation : null;
}

type Turn = { move: Move; hostT: number };

function turnsKey(turns: readonly Move[]): string {
  return [...turns].sort().join(" ");
}

/** "view-named turns|rotation" → that wide move or slice, from the engine's own expansion of each move. */
const COMBINED: ReadonlySet<string> = new Set(
  ["r", "l", "u", "d", "f", "b", "M", "E", "S"].flatMap((family) =>
    ["", "2", "'"].map((suffix) => {
      const { turns, rotation } = new FrameTracker().apply(family + suffix);
      return `${turnsKey(turns)}|${rotation}`;
    }),
  ),
);

/** A turn may arrive this long (ms) after the gyro report that already shows its centres turned. */
const TURN_SLACK_MS = 120;

/**
 * The index of the last turn of a wide move or slice that `rotation` completes, or null. Candidates are the turns
 * from `from` on (those after the previous rotation event) that arrived within GYRO_TUNING.lookbackMs before
 * `since`, when the gyro first saw the new orientation. `view` names reported turns as the solver saw them. A wide
 * half turn may still be two quarter turns here, and a slice is two opposite turns arriving together.
 */
export function wideMoveEnd(
  rotation: Rotation,
  turns: readonly Turn[],
  from: number,
  view: FrameTracker,
  since: number,
): number | null {
  const named = (i: number) => view.name(turns[i]!.move);
  const matches = (names: readonly Move[]) => COMBINED.has(`${turnsKey(names)}|${rotation}`);
  for (let i = turns.length - 1; i >= from; i--) {
    if (turns[i]!.hostT > since + TURN_SLACK_MS) continue;
    if (since - turns[i]!.hostT > GYRO_TUNING.lookbackMs) return null;
    if (matches([named(i)])) return i;
    if (i - 1 < from) continue;
    const gap = turns[i]!.hostT - turns[i - 1]!.hostT;
    const [a, b] = [named(i - 1), named(i)];
    if (a === b && !a.endsWith("2") && gap <= GYRO_TUNING.halfTurnMs && matches([`${a.charAt(0)}2`])) return i;
    if (gap <= GYRO_TUNING.slicePairMs && matches([a, b])) return i;
  }
  return null;
}
