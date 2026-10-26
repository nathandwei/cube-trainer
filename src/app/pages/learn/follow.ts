// The cube on screen held the way the smart cube is held: tilted, turned over and regripped with it, a few degrees at
// a time, from the gyro's reports. Turns need no renaming for this: the cube reports them by centre colour, the
// screen turns that colour's layer, and the tilt puts the layer where it really is. The gyro sits in the core, so a
// slice or wide move turns the cube on screen too, as it should; but a fast one reads short (an M2 as 140°), so each
// one CoreWatch recognises counts as exactly its turn, or the cube on screen would be left askew after it.
//
// The gyro only measures turning, so it needs a grip to start from. A drill has one when the cube reaches its
// scramble: the band was followed white on top, green in front. However it's held then counts as that grip exactly,
// so a hand's slight tilt at that moment stays out of the picture. Goal checks never need any of this: they run on
// the centre-frame state, which rotations don't change.

import { useEffect, useState, type RefObject } from "react";
import type { CubeHandle } from "@/app/components/CubeView";
import { smartCube } from "@/app/smartcube/connection";
import { CoreWatch, multiply, referenceFor, rotationQuaternion, rotationSince, type GridOrientation, type Quaternion } from "@/app/smartcube/gyro";
import type { Move } from "@/cube/types";
import { SCRAMBLE_GRIP, SOLVER_GRIP, solverGripReport } from "./calibrate/grip";

/** How the cube is held at some moment: its gyro report then (null before its first, or without a gyro) and the grip. */
export type Hold = { report: Quaternion | null; grip: GridOrientation };

/**
 * The hold the moment the cube reaches a drill's scramble: as scrambled if the band led it there, else as it's
 * solved (it was already there, say after a blip once turned over).
 */
export function heldAtScramble(followedBand: boolean): Hold {
  return { report: smartCube.lastGyro, grip: followedBand ? SCRAMBLE_GRIP : SOLVER_GRIP };
}

/** The cube's attitude from its gyro reports: how it's turned from the solver's grip, in the solver's axes. */
export class CubeFollower {
  /** The report the cube would give in the solver's grip. */
  #reference: Quaternion | null = null;
  /** A grip from hold() that waits for the cube's first gyro report. */
  #pending: GridOrientation | null = null;
  #holding = false;
  #core = new CoreWatch();
  #turns = 0;

  /** Following since hold(), until reset(). */
  get holding(): boolean {
    return this.#holding;
  }

  reset(): void {
    this.#reference = null;
    this.#pending = null;
    this.#holding = false;
    this.#core = new CoreWatch();
    this.#turns = 0;
  }

  /** Follow from `hold`: the attitude now, once there's a report to read it from. */
  hold({ report, grip }: Hold): Quaternion | null {
    this.#holding = true;
    this.#reference = report ? solverGripReport(report, grip) : null;
    this.#pending = report ? null : grip;
    return report ? grip.q : null;
  }

  /** One of the cube's turns (centre frame, as reported), for reading slices and wide moves. */
  turn(move: Move, hostT: number): void {
    this.#core.turn(this.#turns++, move, hostT);
  }

  /** A gyro report: the attitude to show, once following. */
  gyro(q: Quaternion, hostT: number): Quaternion | null {
    if (!this.#reference && this.#pending) {
      this.#reference = solverGripReport(q, this.#pending);
      this.#pending = null;
    }
    const cores = this.#core.sample(q, hostT);
    if (!this.#reference) return null;
    for (const core of cores) {
      // The core turned exactly the move's rotation, from wherever it was just before.
      const before = rotationSince(this.#reference, core.before.q);
      this.#reference = referenceFor(core.after.q, multiply(before, rotationQuaternion(core.rotation)));
    }
    return rotationSince(this.#reference, q);
  }
}


/** The cube on screen following the smart cube: upright until hold(), then tilted with every gyro report. */
export type FollowedCube = {
  readonly holding: boolean;
  /** Upright again at once (the screen just showed a fresh state), not following until hold(). */
  reset(): void;
  hold(hold: Hold): void;
  /** One of the cube's turns while following (centre frame, as reported), so a slice leaves it square. */
  turn(move: Move, hostT: number): void;
};

class ScreenFollower implements FollowedCube {
  readonly #cube: RefObject<CubeHandle | null>;
  readonly #follower = new CubeFollower();

  constructor(cube: RefObject<CubeHandle | null>) {
    this.#cube = cube;
  }

  get holding(): boolean {
    return this.#follower.holding;
  }

  reset(): void {
    this.#follower.reset();
    this.#cube.current?.setAttitude(null, true);
  }

  hold(hold: Hold): void {
    this.#show(this.#follower.hold(hold));
  }

  turn(move: Move, hostT: number): void {
    if (this.#follower.holding) this.#follower.turn(move, hostT);
  }

  gyro(q: Quaternion, hostT: number): void {
    this.#show(this.#follower.gyro(q, hostT));
  }

  #show(attitude: Quaternion | null): void {
    if (attitude) this.#cube.current?.setAttitude(attitude);
  }
}

/** The cube on screen following the smart cube's gyro while mounted. The drill resets it and holds it. */
export function useCubeFollower(cube: RefObject<CubeHandle | null>): FollowedCube {
  const [follower] = useState(() => new ScreenFollower(cube));
  useEffect(() => smartCube.onGyro((q, hostT) => follower.gyro(q, hostT)), [follower]);
  return follower;
}
