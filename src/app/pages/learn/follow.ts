// The cube on screen held the way the smart cube is held, for the drills: a regrip turns it too, and each turn plays
// on the face that was turned rather than the one with that centre colour in the solver's grip, so after a y the R
// in hand is the R on screen.
//
// The gyro only measures turning, so it needs a grip to start from. A drill has one when the cube reaches its
// scramble: the band was followed white on top, green in front. Until the first turn the screen only follows round
// the last layer, so turning the cube over to start isn't shown; from then on it follows every regrip. Goal checks
// never need any of this: they run on the centre-frame state, which rotations don't change.

import { useEffect, useState, type RefObject } from "react";
import type { CubeHandle } from "@/app/components/CubeView";
import { smartCube } from "@/app/smartcube/connection";
import { rotationsBetween, type GridOrientation, type Quaternion, type RotationDetector } from "@/app/smartcube/gyro";
import { FrameTracker } from "@/cube";
import type { Move } from "@/cube/types";
import { SCRAMBLE_GRIP, SOLVER_GRIP, detectorAt, keepsYellowUp } from "./calibrate/grip";

/** How the cube is held at some moment: its gyro report then (null before its first, or without a gyro) and the grip. */
export type Hold = { report: Quaternion | null; grip: GridOrientation };

/**
 * The hold the moment the cube reaches a drill's scramble: as scrambled if the band led it there, else as it's
 * solved (it was already there, say after a blip once turned over).
 */
export function heldAtScramble(followedBand: boolean): Hold {
  return { report: smartCube.lastGyro, grip: followedBand ? SCRAMBLE_GRIP : SOLVER_GRIP };
}

export class CubeFollower {
  #detector: RotationDetector | null = null;
  /** A grip from hold() that waits for the cube's first gyro report. */
  #pending: GridOrientation | null = null;
  #holding = false;
  #turned = false;
  /** Where the cube on screen faces, relative to the solver's grip, and the names its faces have. */
  #shown: GridOrientation = SOLVER_GRIP;
  #screen = new FrameTracker();

  /** Following since hold(), until reset(). */
  get holding(): boolean {
    return this.#holding;
  }

  /** The cube on screen was just drawn in the solver's grip; nothing is followed until hold(). */
  reset(): void {
    this.#detector = null;
    this.#pending = null;
    this.#holding = false;
    this.#turned = false;
    this.#shown = SOLVER_GRIP;
    this.#screen = new FrameTracker();
  }

  /** Follow from `hold`. Returns the rotations that turn the cube on screen to face the same way. */
  hold({ report, grip }: Hold): string[] {
    this.#holding = true;
    this.#turned = false;
    this.#detector = report ? detectorAt(report, grip) : null;
    this.#pending = report ? null : grip;
    return this.#detector ? this.#follow(this.#detector.orientation) : [];
  }

  /** A gyro report: the rotations to animate, if the grip changed. */
  gyro(q: Quaternion, hostT: number): string[] {
    if (!this.#detector) {
      if (!this.#pending) return [];
      this.#detector = detectorAt(q, this.#pending);
      this.#pending = null;
      return this.#follow(this.#detector.orientation);
    }
    return this.#detector.sample(q, hostT) ? this.#follow(this.#detector.orientation) : [];
  }

  /** A centre-frame turn from the cube: what to animate. The first one also faces the screen fully the way it's held. */
  turn(move: Move): string[] {
    const shown = !this.#turned && this.#detector ? this.#face(this.#detector.orientation) : [];
    this.#turned = true;
    shown.push(this.#screen.name(move));
    return shown;
  }

  #follow(orientation: GridOrientation): string[] {
    return this.#turned || keepsYellowUp(orientation) ? this.#face(orientation) : [];
  }

  #face(target: GridOrientation): string[] {
    if (target === this.#shown) return [];
    // A copy: the list belongs to gyro.ts's shared orientation grid, and callers append turns to what this returns.
    const rotations = [...rotationsBetween(this.#shown, target)];
    this.#shown = target;
    for (const rotation of rotations) this.#screen.rotate(rotation);
    return rotations;
  }
}

/** A follower for the cube on screen, fed the smart cube's gyro while mounted. The drill resets it, holds it and turns with it. */
export function useCubeFollower(cube: RefObject<CubeHandle | null>): CubeFollower {
  const [follower] = useState(() => new CubeFollower());
  useEffect(
    () =>
      smartCube.onGyro((q, hostT) => {
        for (const rotation of follower.gyro(q, hostT)) cube.current?.turn(rotation);
      }),
    [cube, follower],
  );
  return follower;
}
