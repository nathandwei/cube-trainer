import { describe, expect, it } from "vitest";
import { GRID, angleBetween, multiply, snap, type Quaternion } from "./gyro";
import type { Rotation } from "@/cube/types";
import { CubeFollower, SCRAMBLE_GRIP, SOLVER_GRIP, reportAt } from "./follower";

const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** A turn of `degrees` about one of the solver's axes (right-hand rule), as the gyro measures one. */
function tilt(axis: "x" | "y" | "z", degrees: number): Quaternion {
  const half = (degrees * Math.PI) / 360;
  return { ...IDENTITY, w: Math.cos(half), [axis]: Math.sin(half) };
}

/** The gyro's own heading is arbitrary: the world it reads against is turned this far round from the solver. */
const WORLD = tilt("y", 37);

/** The gyro report after turning by `turns` (solver's axes, in order) from the solver's grip. */
function reportAfter(...turns: Quaternion[]): Quaternion {
  return reportAt(multiply(WORLD, turns.reduce((total, turn) => multiply(turn, total), IDENTITY)));
}

const grid = (rotation: Rotation) => GRID.find((g) => g.rotations.length === 1 && g.rotations[0] === rotation)!.q;

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

  it("shows the cube's real tilt, read against gravity: a lean at the hold stays a lean, whichever way round", () => {
    // Held leaning towards the solver, as a hand holds a cube to look at it.
    const lean = tilt("x", 20);
    const follower = new CubeFollower();
    expect(angleBetween(follower.hold({ report: reportAfter(grid("z2"), lean), grip: SCRAMBLE_GRIP })!, multiply(lean, grid("z2")))).toBeLessThan(0.01);
    expect(angleBetween(follower.gyro(reportAfter(lean), tick())!, lean)).toBeLessThan(0.01);
    expect(angleBetween(follower.gyro(reportAfter(grid("y"), lean), tick())!, multiply(lean, grid("y")))).toBeLessThan(0.01);
  });

  it("takes only its heading from a hold: a cube held tipped stays tipped on screen", () => {
    const follower = new CubeFollower();
    expect(shownAs(follower.hold({ report: reportAfter(grid("x")), grip: SOLVER_GRIP }))).toBe("x");
    // Turned round on the desk: round about the vertical on screen too.
    expect(shownAs(follower.gyro(reportAfter(grid("x"), grid("y")), tick()))).toBe("x y");
  });

  it("waits for the cube's first gyro report when it had none at the hold", () => {
    const follower = new CubeFollower();
    expect(follower.hold({ report: null, grip: SCRAMBLE_GRIP })).toBeNull();
    expect(shownAs(follower.gyro(reportAfter(grid("z2")), tick()))).toBe("z2");
    expect(shownAs(follower.gyro(reportAfter(grid("z2"), grid("z2")), tick()))).toBe("");
  });

  it("counts an E slice as exactly its turn round the vertical, though a fast one reads short", () => {
    const follower = new CubeFollower();
    follower.hold({ report: reportAfter(), grip: SOLVER_GRIP });
    follower.gyro(reportAfter(), 1000);
    // E: U and D' together, while the core turns like y' (+90° about y) but the gyro sees only 70° of it. Gravity
    // would set a short tilt straight by itself; nothing sets a short heading straight but this.
    follower.turn("U", 1100);
    follower.turn("D'", 1110);
    const short = reportAfter(tilt("y", 70));
    for (let t = 1200; t < 1300; t += 90) follower.gyro(short, t);
    expect(shownAs(follower.gyro(short, 1350))).toBe("y'");
    // From there on it follows as before: a turn further shows as that turn.
    expect(angleBetween(follower.gyro(reportAfter(tilt("y", 80)), 1650)!, multiply(tilt("y", 10), grid("y'")))).toBeLessThan(0.01);
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
