// The cube on screen held the way the smart cube is held: tilted, turned over and regripped with it, a few degrees at
// a time, from the gyro's reports. Turns need no renaming for this: the cube reports them by centre colour, the
// screen turns that colour's layer, and the tilt puts the layer where it really is.
//
// A GAN cube's reading is against gravity: its world +Z is up (in 17 real solves the yellow centre read straight up
// all through F2L), so how the cube tilts is known outright and never drifts. Only its heading (which way round it
// faces, about the vertical) is relative, so that's all a hold sets: the cube is turned to face as the grip says, and
// shows exactly the tilt it has. The gyro sits in the core, so a slice turns the cube on screen too, as it should; a
// fast one reads short, and gravity sets the tilt straight within a second, but a short turn about the vertical (an
// E slice) would leave the heading off, so each slice CoreWatch recognises counts as exactly its turn there.

import type { Move } from "@/cube/types";
import { CoreWatch, GRID, GYRO_INVERTED, conjugate, multiply, rotationQuaternion, type GridOrientation, type Quaternion } from "./gyro";

function gridNamed(rotations: string): GridOrientation {
  const found = GRID.find((g) => g.rotations.join(" ") === rotations);
  if (!found) throw new Error(`No cube orientation is written "${rotations}"`);
  return found;
}

/** The solver's grip: white down, green in front. */
export const SOLVER_GRIP = gridNamed("");
/** Scrambling grip: white on top, green in front. */
export const SCRAMBLE_GRIP = gridNamed("z2");

/** How the cube is held at some moment: its gyro report then (null before its first, or without a gyro) and the grip. */
export type Hold = { report: Quaternion | null; grip: GridOrientation };

/** The world (+Z up) as the screen sees it (+y up): a quarter turn about x. */
const WORLD_TO_SCREEN: Quaternion = { w: Math.SQRT1_2, x: -Math.SQRT1_2, y: 0, z: 0 };
/** The cube on screen's axes (+x R, +y U, +z F) as the cube's own (+X red, +Y blue, +Z white): R is −X, U −Z, F −Y. */
const SCREEN_TO_CUBE: Quaternion = { w: 0, x: 0, y: Math.SQRT1_2, z: -Math.SQRT1_2 };
const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** The attitude a report shows before any heading is set: the cube's real tilt, at the world's own heading. */
function unheaded(report: Quaternion): Quaternion {
  const cubeToWorld = GYRO_INVERTED ? conjugate(report) : report;
  return multiply(multiply(WORLD_TO_SCREEN, cubeToWorld), SCREEN_TO_CUBE);
}

/** The part of a rotation about the vertical (its twist about y). */
function aboutVertical(q: Quaternion): Quaternion {
  const length = Math.hypot(q.w, q.y);
  return length < 1e-9 ? IDENTITY : { w: q.w / length, x: 0, y: q.y / length, z: 0 };
}

/** The report a cube held at `attitude` gives, at the world's own heading (for tests, and anything faking a cube). */
export function reportAt(attitude: Quaternion): Quaternion {
  const cubeToWorld = multiply(multiply(conjugate(WORLD_TO_SCREEN), attitude), conjugate(SCREEN_TO_CUBE));
  return GYRO_INVERTED ? conjugate(cubeToWorld) : cubeToWorld;
}

/** The cube's attitude from its gyro reports: how it's turned from the solver's grip, in the solver's axes. */
export class CubeFollower {
  /** The turn about the vertical that faces the cube as the last hold said; null until held. */
  #heading: Quaternion | null = null;
  /** A grip from hold() that waits for the cube's first gyro report. */
  #pending: GridOrientation | null = null;
  #holding = false;
  #core = new CoreWatch();
  #turns = 0;

  /** Following since hold() (or resume()), until reset(). */
  get holding(): boolean {
    return this.#holding;
  }

  /** The turn about the vertical the cube is faced by; null until held. */
  get heading(): Quaternion | null {
    return this.#heading;
  }

  /** Follow with a heading learnt before (a page load ago): the cube's reading against gravity does the rest. */
  resume(heading: Quaternion): void {
    this.#holding = true;
    this.#pending = null;
    this.#heading = heading;
  }

  /** The attitude `report` shows, without taking it as the latest report (one remembered from before); null until held. */
  attitudeOf(report: Quaternion): Quaternion | null {
    return this.#heading ? this.#attitude(report) : null;
  }

  reset(): void {
    this.#heading = null;
    this.#pending = null;
    this.#holding = false;
    this.#core = new CoreWatch();
    this.#turns = 0;
  }

  /** Follow from `hold`: the attitude now, once there's a report to read it from. */
  hold({ report, grip }: Hold): Quaternion | null {
    this.#holding = true;
    this.#pending = report ? null : grip;
    if (!report) {
      this.#heading = null;
      return null;
    }
    this.#face(report, grip.q);
    return this.#attitude(report);
  }

  /** One of the cube's turns (centre frame, as reported), for reading slices. */
  turn(move: Move, hostT: number): void {
    this.#core.turn(this.#turns++, move, hostT);
  }

  /** A gyro report: the attitude to show, once following. */
  gyro(q: Quaternion, hostT: number): Quaternion | null {
    if (!this.#heading && this.#pending) {
      this.#face(q, this.#pending.q);
      this.#pending = null;
    }
    const cores = this.#core.sample(q, hostT);
    if (!this.#heading) return null;
    for (const core of cores) {
      // The core turned exactly the slice's rotation from where it was just before: face it that way round.
      this.#face(core.after.q, multiply(this.#attitude(core.before.q), rotationQuaternion(core.rotation)));
    }
    return this.#attitude(q);
  }

  /** Turns the heading so `report` faces as close to `attitude` as its tilt allows. */
  #face(report: Quaternion, attitude: Quaternion): void {
    this.#heading = aboutVertical(multiply(attitude, conjugate(unheaded(report))));
  }

  #attitude(report: Quaternion): Quaternion {
    return multiply(this.#heading ?? IDENTITY, unheaded(report));
  }
}
