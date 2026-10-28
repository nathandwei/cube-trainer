// A drilled case as his smart cube's turns leave it. His turns name the centre they turned, and the case on screen
// is held as his cube is, so they apply to it as they come: the rep is done when the case as shown is solved. The
// same turns are also read a quarter, half and three-quarter turn round about the vertical. One of those solving it
// means he did the alg from the wrong side (the wrong angle, or a missed AUF), which is a miss, however clean the alg
// was. A drifted gyro heading reads the same way, but it shows on screen (his turns land on the wrong faces) and the
// reset button squares it up, so it never needs to pass a rep the screen shows unsolved.

import { FrameTracker, applyAlg, isGoalReached, type CaseSetId, type CubeState } from "@/cube";
import type { Rotation } from "@/cube/types";

const HEADINGS: readonly (readonly Rotation[])[] = [[], ["y"], ["y2"], ["y'"]];

const READERS = HEADINGS.map((rotations) => {
  const tracker = new FrameTracker();
  for (const rotation of rotations) tracker.rotate(rotation);
  return (turn: string) => tracker.name(turn);
});

/** The case once per heading he might be facing; the first is the case as the screen shows it. */
export type CaseReadings = readonly CubeState[];

/** solved: the case as shown is done. wrong side: done only from another side. null: not done yet. */
export type CaseOutcome = "solved" | "wrong side" | null;

export function readCase(start: CubeState): CaseReadings {
  return READERS.map(() => start);
}

export function turnCase(readings: CaseReadings, turns: readonly string[]): CaseReadings {
  return readings.map((state, i) => applyAlg(state, turns.map(READERS[i]!)));
}

export function caseOutcome(set: CaseSetId, readings: CaseReadings): CaseOutcome {
  const [shown, ...turned] = readings;
  if (shown && isGoalReached(set, shown)) return "solved";
  return turned.some((state) => isGoalReached(set, state)) ? "wrong side" : null;
}
