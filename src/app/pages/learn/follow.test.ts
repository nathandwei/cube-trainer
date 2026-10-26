import { describe, expect, it } from "vitest";
import { multiply, type Quaternion } from "@/app/smartcube/gyro";
import { FrameTracker } from "@/cube";
import type { Rotation } from "@/cube/types";
import { SCRAMBLE_GRIP, SOLVER_GRIP, gridOf } from "./calibrate/grip";
import { CubeFollower } from "./follow";

const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** The gyro report after these rotations from the solver's grip (the fake GAN cube's __cubeQuat). */
function report(...rotations: Rotation[]): Quaternion {
  const q = rotations.reduce((total, rotation) => multiply(gridOf(rotation).q, total), IDENTITY);
  return { w: q.w, x: -q.x, y: -q.z, z: -q.y };
}

class Hand {
  t = 1000;
  constructor(readonly follower: CubeFollower) {}

  /** Holds the cube at `rotations` from the solver's grip for three gyro reports; returns what the screen animates. */
  hold(...rotations: Rotation[]): string[] {
    return [0, 1, 2].flatMap(() => {
      this.t += 90;
      return this.follower.gyro(report(...rotations), this.t);
    });
  }
}

/** The centre-frame turn a smart cube reports for `move` done while held `grip` away from the solver's grip. */
function reported(move: string, ...grip: Rotation[]): string {
  const view = new FrameTracker();
  for (const rotation of grip) view.rotate(rotation);
  const [turn] = view.apply(move).turns;
  if (!turn) throw new Error(`${move} is not a turn`);
  return turn;
}

/** A follower held as the band leaves the cube: white on top, green in front. */
function atScramble(): { follower: CubeFollower; hand: Hand } {
  const follower = new CubeFollower();
  const hand = new Hand(follower);
  expect(follower.hold({ report: report("z2"), grip: SCRAMBLE_GRIP })).toEqual([]);
  return { follower, hand };
}

describe("CubeFollower", () => {
  it.each([
    { flip: ["z2"] as Rotation[], shown: [] },
    { flip: ["x2"] as Rotation[], shown: ["y2"] },
  ])("turns the cube on screen to face the case as it was turned over by $flip", ({ flip, shown }) => {
    const { hand } = atScramble();
    // From the scramble grip (z2), a further z2 is the solver's grip; an x2 leaves blue in front instead.
    expect(hand.hold("z2", ...flip)).toEqual(shown);
  });

  it("follows a y before the first turn, and plays turns on the faces turned in hand", () => {
    const { follower, hand } = atScramble();
    hand.hold();
    expect(hand.hold("y")).toEqual(["y"]);
    expect(follower.turn(reported("R", "y"))).toEqual(["R"]);
    expect(follower.turn(reported("U'", "y"))).toEqual(["U'"]);
  });

  it("leaves the screen alone while the cube is tilted before the first turn, then faces it at that turn", () => {
    const { follower, hand } = atScramble();
    expect(hand.hold("x")).toEqual([]);
    expect(follower.turn(reported("R", "x"))).toEqual(["x", "R"]);
    expect(hand.hold()).toEqual(["x'"]);
  });

  it("follows every regrip once turning", () => {
    const { follower, hand } = atScramble();
    hand.hold();
    expect(follower.turn(reported("R"))).toEqual(["R"]);
    expect(hand.hold("x")).toEqual(["x"]);
    expect(follower.turn(reported("U", "x"))).toEqual(["U"]);
  });

  it("waits for the cube's first gyro report when it had none at the hold", () => {
    const follower = new CubeFollower();
    const hand = new Hand(follower);
    expect(follower.hold({ report: null, grip: SCRAMBLE_GRIP })).toEqual([]);
    hand.t += 90;
    expect(follower.gyro(report("z2"), hand.t)).toEqual([]);
    expect(hand.hold("y")).toEqual(["y"]);
  });

  it("names turns as reported without a gyro, and ignores the gyro until held", () => {
    const follower = new CubeFollower();
    const hand = new Hand(follower);
    expect(hand.hold("y")).toEqual([]);
    expect(follower.turn("F")).toEqual(["F"]);
    follower.hold({ report: null, grip: SOLVER_GRIP });
    expect(follower.turn("F")).toEqual(["F"]);
  });

  it("starts over in the solver's grip after reset", () => {
    const { follower, hand } = atScramble();
    hand.hold("y");
    follower.reset();
    expect(follower.holding).toBe(false);
    expect(hand.hold("y2")).toEqual([]);
    expect(follower.turn("R")).toEqual(["R"]);
  });
});
