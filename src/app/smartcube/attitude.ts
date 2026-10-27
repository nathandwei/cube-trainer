// Where the smart cube points, for every cube on screen: it's held the way the real one is, so the centre on top on
// screen is the one on top in his hands and his R is the screen's R. Tilt is read against gravity and always right
// (see follower.ts). Which way round the cube faces him is not something the gyro can know, so it's learnt whenever
// the cube is held a known way: "reset orientation" (white down, green front), or a scramble just followed on the
// band (white on top, green front), in the timer, a drill or "Set up my cube". Until then the side facing him at the
// first report is taken to be green.

import { smartCube, type SmartCubeLink } from "./connection";
import { CubeFollower, SCRAMBLE_GRIP, SOLVER_GRIP, type Hold } from "./follower";
import { GYRO_TUNING, snap, type GridOrientation, type Quaternion } from "./gyro";

/**
 * The hold the moment the cube reaches a scramble: as scrambled if the band led it there, else as it's solved (it was
 * already there, say after a blip once turned over).
 */
export function heldAtScramble(followedBand: boolean): Hold {
  return { report: smartCube.lastGyro, grip: followedBand ? SCRAMBLE_GRIP : SOLVER_GRIP };
}

/** What the attitude follows: the app's cube link (or a stand-in in tests). */
export type AttitudeSource = Pick<SmartCubeLink, "onGyro" | "onMove" | "subscribe" | "state" | "orientationReference">;

export class AmbientAttitude {
  readonly #follower = new CubeFollower();
  #current: Quaternion | null = null;
  /** Which way round the cube faces is known from a hold, not guessed. */
  #anchored = false;
  readonly #listeners = new Set<() => void>();

  constructor(link: AttitudeSource) {
    link.onGyro((q, hostT) => {
      if (!this.#follower.holding) {
        const reference = link.orientationReference;
        if (reference) this.hold({ report: reference, grip: SOLVER_GRIP });
        else this.#follower.hold({ report: q, grip: SOLVER_GRIP });
      }
      this.#set(this.#follower.gyro(q, hostT));
    });
    link.onMove((move, hostT) => this.#follower.turn(move, hostT));
    // Gone (or a cube without a gyro): nothing to follow until it reports again, from a grip read afresh.
    link.subscribe(() => {
      if (link.state.hasGyro || !this.#follower.holding) return;
      this.#follower.reset();
      this.#anchored = false;
      this.#set(null);
    });
  }

  /**
   * How the cube is held now, as the nearest of the 24 orientations from the solver's grip, when that's known: the
   * way round it faces has been learnt, and it's clearly at one.
   */
  get grip(): GridOrientation | null {
    if (!this.#anchored || !this.#current) return null;
    const { orientation, degrees } = snap(this.#current);
    return degrees <= GYRO_TUNING.enterDegrees ? orientation : null;
  }

  /** The cube's attitude from the solver's grip; null while there's no gyro to follow. */
  get current(): Quaternion | null {
    return this.#current;
  }

  /** Which way round the cube faces has been learnt (a hold), not guessed from its first report. */
  get anchored(): boolean {
    return this.#anchored;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** The cube is held as `hold` says now (it reached a scramble, or "reset orientation"). */
  hold(hold: Hold): void {
    if (!hold.report) return;
    const learnt = !this.#anchored;
    this.#anchored = true;
    this.#set(this.#follower.hold(hold));
    if (learnt) for (const listener of this.#listeners) listener();
  }

  #set(attitude: Quaternion | null): void {
    if (attitude === this.#current) return;
    this.#current = attitude;
    for (const listener of this.#listeners) listener();
  }
}

export const ambientAttitude = new AmbientAttitude(smartCube);

/**
 * He's holding the cube white down, green in front: remember that grip for every solve (the cube link's reference)
 * and face every cube on screen that way from now. False before the cube's first gyro report.
 */
export function lineUp(): boolean {
  if (!smartCube.resetOrientation()) return false;
  ambientAttitude.hold({ report: smartCube.lastGyro, grip: SOLVER_GRIP });
  return true;
}
