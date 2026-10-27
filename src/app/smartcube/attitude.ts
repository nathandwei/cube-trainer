// Where the smart cube points, for every cube on screen that a drill isn't holding itself (CubeView's `gyro`): the
// cube on screen tilts with it instead of being dragged round. Upright is the solver's grip (white down, green
// front). The grip is known from "reset orientation", or whenever a drill or the timer sees the cube reach a scramble
// (held as scrambled, white on top); until either, however the cube is held when it first reports counts as upright.

import { smartCube, type SmartCubeLink } from "./connection";
import { CubeFollower, SCRAMBLE_GRIP, SOLVER_GRIP, type Hold } from "./follower";
import type { Quaternion } from "./gyro";

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
  readonly #listeners = new Set<() => void>();

  constructor(link: AttitudeSource) {
    link.onGyro((q, hostT) => {
      if (!this.#follower.holding) this.#follower.hold({ report: link.orientationReference ?? q, grip: SOLVER_GRIP });
      this.#set(this.#follower.gyro(q, hostT));
    });
    link.onMove((move, hostT) => this.#follower.turn(move, hostT));
    // Gone (or a cube without a gyro): nothing to follow until it reports again, from a grip read afresh.
    link.subscribe(() => {
      if (link.state.hasGyro || !this.#follower.holding) return;
      this.#follower.reset();
      this.#set(null);
    });
  }

  /** The cube's attitude from the solver's grip; null while there's no gyro to follow. */
  get current(): Quaternion | null {
    return this.#current;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** The cube is held as `hold` says now (it reached a scramble, or "reset orientation"). */
  hold(hold: Hold): void {
    if (!hold.report) return;
    this.#follower.hold(hold);
    this.#set(hold.grip.q);
  }

  #set(attitude: Quaternion | null): void {
    if (attitude === this.#current) return;
    this.#current = attitude;
    for (const listener of this.#listeners) listener();
  }
}

export const ambientAttitude = new AmbientAttitude(smartCube);
