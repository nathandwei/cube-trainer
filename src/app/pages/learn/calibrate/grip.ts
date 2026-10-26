// How he holds the cube while recording an alg, from the smart cube's gyro.
//
// The gyro reads orientation against a reference taken at a known grip. Calibration has one for free: the moment the
// cube reaches the case he is holding it as he scrambled it, white on top and green in front, which is z2 from the
// solver's grip (white down, green front). Turning that report into "the report the solver's grip would give" lets
// RotationDetector measure every later orientation against the solver's grip directly, the way the timer does.

import { GRID, RotationDetector, conjugate, multiply, referenceFor, snap, type GridOrientation, type Quaternion } from "@/app/smartcube/gyro";
import type { Rotation } from "@/cube/types";

/** The grid orientation reached by exactly these rotations ("z2", "y'"). */
export function gridOf(...rotations: Rotation[]): GridOrientation {
  const found = GRID.find((g) => g.rotations.length === rotations.length && g.rotations.every((r, i) => r === rotations[i]));
  if (!found) throw new Error(`No cube orientation is written "${rotations.join(" ")}"`);
  return found;
}

export const SOLVER_GRIP = gridOf();
/** Scrambling grip: white on top, green in front. */
export const SCRAMBLE_GRIP = gridOf("z2");

/**
 * The report the cube would give in the solver's grip, from one it gave while held `held` away from that grip:
 * rotationSince(result, report) is `held`.
 */
export function solverGripReport(report: Quaternion, held: GridOrientation): Quaternion {
  return referenceFor(report, held.q);
}

/** A detector reading `report` as `grip`, already settled there (it would otherwise start from the solver's grip). */
export function detectorAt(report: Quaternion, grip: GridOrientation): RotationDetector {
  const detector = new RotationDetector(solverGripReport(report, grip));
  for (let i = 0; i < 8 && detector.orientation !== grip; i++) detector.sample(report, 0);
  if (detector.orientation !== grip) throw new Error(`The gyro reference doesn't read back as ${grip.rotations.join(" ") || "the solver's grip"}`);
  return detector;
}

/** Holding the last layer up: only a y away from the solver's grip. */
export function keepsYellowUp(orientation: GridOrientation): boolean {
  return orientation.rotations.every((rotation) => rotation.startsWith("y"));
}

const Y_TURNS: readonly (Rotation | null)[] = [null, "y", "y2", "y'"];

/**
 * The rotations that take the solver's grip to `orientation`, written as a y first (which way round he turned the
 * case) and then as few other rotations as possible ("y x'" rather than "z y"), so a y in front of an alg can be read
 * off on its own.
 */
export function leadRotations(orientation: GridOrientation): Rotation[] {
  let best: Rotation[] | null = null;
  let bestRest = Infinity;
  for (const y of Y_TURNS) {
    // orientation = rest · y, so rest = orientation · y⁻¹.
    const rest = y ? snap(multiply(orientation.q, conjugate(gridOf(y).q))).orientation.rotations : orientation.rotations;
    if (rest.length >= bestRest) continue;
    best = y ? [y, ...rest] : [...rest];
    bestRest = rest.length;
  }
  if (!best) throw new Error("No way to write a cube orientation as rotations");
  return best;
}
