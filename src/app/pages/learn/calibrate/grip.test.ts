import { describe, expect, it } from "vitest";
import { multiply, rotationSince, snap, type Quaternion } from "@/app/smartcube/gyro";
import type { Rotation } from "@/cube/types";
import { SCRAMBLE_GRIP, gridOf, keepsYellowUp, leadRotations, solverGripReport } from "./grip";

const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
/** How a cube in a real hand rests in the solver's grip (gyro.test.ts's capture): tilted. */
const RESTING: Quaternion = { w: 0.9652699362163152, x: -0.25247962889492476, y: -0.05533005767998291, z: -0.037659840693380534 };

/** Rotations applied one after another, in the solver's view. */
function turned(...rotations: Rotation[]): Quaternion {
  return rotations.reduce((q, rotation) => multiply(gridOf(rotation).q, q), IDENTITY);
}

/** What the cube reports after turning by `solver` from where it reported `start` (as gyro.test.ts builds it). */
function reportAfter(start: Quaternion, solver: Quaternion): Quaternion {
  return multiply(start, { w: solver.w, x: -solver.x, y: -solver.z, z: -solver.y });
}

describe("solverGripReport", () => {
  it("recovers the solver's grip from a report taken white on top", () => {
    const whiteOnTop = reportAfter(RESTING, turned("z2"));
    expect(snap(rotationSince(solverGripReport(whiteOnTop, SCRAMBLE_GRIP), RESTING)).degrees).toBeLessThan(0.01);
  });

  it.each([["y"], ["y'"], ["x'"], ["z"]] as const)("then reads a %s regrip against the solver's grip", (rotation) => {
    const reference = solverGripReport(reportAfter(RESTING, turned("z2")), SCRAMBLE_GRIP);
    expect(snap(rotationSince(reference, reportAfter(RESTING, turned(rotation)))).orientation.rotations).toEqual([rotation]);
  });
});

describe("leadRotations", () => {
  it.each<[Rotation[], Rotation[]]>([
    [[], []],
    [["y"], ["y"]],
    [["y2"], ["y2"]],
    [["x'"], ["x'"]],
    [["y", "x'"], ["y", "x'"]],
    [["x2"], ["x2"]],
  ])("writes the grip after %j as %j", (done, expected) => {
    expect(leadRotations(snap(turned(...done)).orientation)).toEqual(expected);
  });

  it("always reaches the grip it describes", () => {
    for (const first of ["x", "y", "z", "x'", "y2"] as const) {
      for (const second of ["x", "y'", "z2"] as const) {
        const grip = snap(turned(first, second)).orientation;
        expect(snap(turned(...leadRotations(grip))).orientation).toBe(grip);
      }
    }
  });
});

describe("keepsYellowUp", () => {
  it.each<[Rotation[], boolean]>([
    [[], true],
    [["y'"], true],
    [["z2"], false],
    [["x"], false],
  ])("after %j: %s", (done, expected) => {
    expect(keepsYellowUp(snap(turned(...done)).orientation)).toBe(expected);
  });
});
