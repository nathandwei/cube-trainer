// The cube on screen in a drill: it follows the smart cube from the grip the cube was in when it reached the scramble
// (the band was followed white on top, green in front), and is upright until then. Goal checks never need any of
// this: they run on the centre-frame state, which rotations don't change. See smartcube/follower.ts for how.

import { useEffect, useState, type RefObject } from "react";
import type { CubeHandle } from "@/app/components/CubeView";
import { ambientAttitude, heldAtScramble } from "@/app/smartcube/attitude";
import { smartCube } from "@/app/smartcube/connection";
import { CubeFollower, type Hold } from "@/app/smartcube/follower";
import type { Quaternion } from "@/app/smartcube/gyro";
import type { Move } from "@/cube/types";

export { heldAtScramble, type Hold };

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
    // Every other cube on screen follows from the same grip, freshest known.
    ambientAttitude.hold(hold);
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
