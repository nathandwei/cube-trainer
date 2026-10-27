// A drilled case as his smart cube's turns leave it. His turns name the centre they turned, and the case on screen
// is held as his cube is, so they apply to it as they come. If the gyro has his heading wrong, though, his R lands
// on another face of the case; read a quarter, half or three-quarter turn round about the vertical, one reading
// still solves it, so a drifted heading never fails a clean rep.

import { FrameTracker, applyAlg, isGoalReached, type CaseSetId, type CubeState } from "@/cube";
import type { Rotation } from "@/cube/types";

const HEADINGS: readonly (readonly Rotation[])[] = [[], ["y"], ["y2"], ["y'"]];

const READERS = HEADINGS.map((rotations) => {
  const tracker = new FrameTracker();
  for (const rotation of rotations) tracker.rotate(rotation);
  return (turn: string) => tracker.name(turn);
});

/** The case once per heading he might really be facing; the first is the heading the gyro gives. */
export type CaseReadings = readonly CubeState[];

export function readCase(start: CubeState): CaseReadings {
  return READERS.map(() => start);
}

export function turnCase(readings: CaseReadings, turns: readonly string[]): CaseReadings {
  return readings.map((state, i) => applyAlg(state, turns.map(READERS[i]!)));
}

export function caseDone(set: CaseSetId, readings: CaseReadings): boolean {
  return readings.some((state) => isGoalReached(set, state));
}
