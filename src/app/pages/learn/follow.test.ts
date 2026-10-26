import { describe, expect, it } from "vitest";
import { angleBetween, multiply, snap, type Quaternion } from "@/app/smartcube/gyro";
import type { Rotation } from "@/cube/types";
import { SCRAMBLE_GRIP, SOLVER_GRIP, gridOf } from "./calibrate/grip";
import { CubeFollower } from "./follow";

const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** A turn of `degrees` about one of the solver's axes (right-hand rule), as the gyro measures one. */
function tilt(axis: "x" | "y" | "z", degrees: number): Quaternion {
  const half = (degrees * Math.PI) / 360;
  return { ...IDENTITY, w: Math.cos(half), [axis]: Math.sin(half) };
}

/** The gyro report after turning by `turns` (solver's axes, in order) from the solver's grip (the fake GAN cube's __cubeQuat). */
function reportAfter(...turns: Quaternion[]): Quaternion {
  const q = turns.reduce((total, turn) => multiply(turn, total), IDENTITY);
  return { w: q.w, x: -q.x, y: -q.z, z: -q.y };
}

const grid = (rotation: Rotation) => gridOf(rotation).q;

/** The orientation an attitude holds the cube on screen at, as rotations from the solver's grip ("" upright). */
function shownAs(attitude: Quaternion | null): string | null {
  if (!attitude) return null;
  const { orientation, degrees } = snap(attitude);
  return degrees < 1 ? orientation.rotations.join(" ") : `${degrees.toFixed(1)}° from ${orientation.rotations.join(" ")}`;
}

let clock = 1000;
/** The next gyro report's time: 90 ms after the last. */
const tick = () => (clock += 90);

/** A follower held as the band leaves the cube: white on top, green in front. */
function atScramble(): CubeFollower {
  const follower = new CubeFollower();
  expect(shownAs(follower.hold({ report: reportAfter(grid("z2")), grip: SCRAMBLE_GRIP }))).toBe("z2");
  return follower;
}

describe("CubeFollower", () => {
  it.each([
    { flip: "z2" as const, shown: "" },
    { flip: "x2" as const, shown: "y2" },
  ])("holds the cube on screen as it's turned over by $flip", ({ flip, shown }) => {
    const follower = atScramble();
    expect(shownAs(follower.gyro(reportAfter(grid("z2"), grid(flip)), tick()))).toBe(shown);
  });

  it.each([
    { axis: "x" as const, degrees: 8 },
    { axis: "y" as const, degrees: -15 },
    { axis: "z" as const, degrees: 40 },
  ])("follows a slight turn of $degrees° about $axis, not just whole quarter turns", ({ axis, degrees }) => {
    const follower = atScramble();
    const attitude = follower.gyro(reportAfter(grid("z2"), grid("z2"), tilt(axis, degrees)), tick());
    expect(attitude).not.toBeNull();
    expect(angleBetween(attitude!, tilt(axis, degrees))).toBeLessThan(0.01);
  });

  it("leaves out the hand's own lean at the hold, whichever way the cube is turned after", () => {
    // Held leaning towards the solver, as a hand holds a cube to look at it.
    const lean = tilt("x", 20);
    const follower = new CubeFollower();
    expect(shownAs(follower.hold({ report: reportAfter(grid("z2"), lean), grip: SCRAMBLE_GRIP }))).toBe("z2");
    expect(shownAs(follower.gyro(reportAfter(lean), tick()))).toBe("");
    expect(shownAs(follower.gyro(reportAfter(grid("y"), lean), tick()))).toBe("y");
    // Leaning further shows as the extra lean.
    expect(angleBetween(follower.gyro(reportAfter(tilt("x", 30)), tick())!, tilt("x", 10))).toBeLessThan(0.01);
  });

  it("waits for the cube's first gyro report when it had none at the hold", () => {
    const follower = new CubeFollower();
    expect(follower.hold({ report: null, grip: SCRAMBLE_GRIP })).toBeNull();
    expect(shownAs(follower.gyro(reportAfter(grid("z2")), tick()))).toBe("z2");
    expect(shownAs(follower.gyro(reportAfter(grid("z2"), grid("z2")), tick()))).toBe("");
  });

  it("counts a slice as exactly its turn, though a fast one reads short", () => {
    const follower = new CubeFollower();
    follower.hold({ report: reportAfter(), grip: SOLVER_GRIP });
    follower.gyro(reportAfter(), 1000);
    // M: R and L' together, while the core turns like x' (+90° about x) but the gyro sees only 70° of it.
    follower.turn("R", 1100);
    follower.turn("L'", 1110);
    const short = reportAfter(tilt("x", 70));
    // Read once no more turns on that axis can be part of it (GYRO_TUNING.moveGapMs after the last).
    for (let t = 1200; t < 1300; t += 90) follower.gyro(short, t);
    expect(shownAs(follower.gyro(short, 1350))).toBe("x'");
    // From there on it follows as before: a slight lean shows as that lean.
    expect(angleBetween(follower.gyro(reportAfter(tilt("x", 80)), 1650)!, multiply(tilt("x", 10), grid("x'")))).toBeLessThan(0.01);
  });

  it("leaves a plain turn's tilt alone", () => {
    const follower = new CubeFollower();
    follower.hold({ report: reportAfter(), grip: SOLVER_GRIP });
    follower.gyro(reportAfter(), 1000);
    follower.turn("R", 1100);
    const leaning = reportAfter(tilt("x", 30));
    follower.gyro(leaning, 1200);
    expect(angleBetween(follower.gyro(leaning, 1400)!, tilt("x", 30))).toBeLessThan(0.01);
  });

  it("follows nothing until held, nor after reset", () => {
    const follower = new CubeFollower();
    expect(follower.gyro(reportAfter(grid("y")), tick())).toBeNull();
    follower.hold({ report: reportAfter(), grip: SOLVER_GRIP });
    expect(follower.holding).toBe(true);
    follower.reset();
    expect(follower.holding).toBe(false);
    expect(follower.gyro(reportAfter(grid("y")), tick())).toBeNull();
  });
});
