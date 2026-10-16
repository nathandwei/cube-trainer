// A pretend slow solve for the Test button: a human-like solve (the demo generator's) re-timed to the beat, with a
// few pauses put in, so the drill can be tried without a smart cube.

import { generateDemoSolve, type Rng } from "@/cube";
import { uniform } from "@/cube/random";
import type { TimedMove } from "@/cube/types";
import { beatMs } from "./pauses";

/** The two turns of a slice arrive this close together; they stay that way. */
const SLICE_GAP_MS = 50;
/** An ordinary gap, in beats: around one turn per beat, never long enough to count as a pause (1.5). */
const STEADY_BEATS: [number, number] = [0.6, 1.2];
const PAUSE_BEATS: [number, number] = [1.9, 2.8];

/**
 * The same turns re-timed for `bpm`: every gap becomes about a beat, except `pauses` of them (away from the ends)
 * that become two or three beats. Times start at 0.
 */
export function paceToBeat(moves: readonly TimedMove[], bpm: number, pauses: number, rng: Rng): TimedMove[] {
  const beat = beatMs(bpm);
  const gaps = moves.slice(1).map((move, i) => move.t - moves[i]!.t);
  const open = gaps.flatMap((gap, i) => (gap >= SLICE_GAP_MS && i > 2 && i < gaps.length - 3 ? [i] : []));
  const paused = new Set<number>();
  while (paused.size < Math.min(pauses, open.length)) paused.add(open[Math.floor(rng() * open.length)]!);
  let t = 0;
  return moves.map((move, i) => {
    if (i > 0) {
      const gap = gaps[i - 1]!;
      if (gap < SLICE_GAP_MS) t += gap;
      else t += beat * uniform(rng, ...(paused.has(i - 1) ? PAUSE_BEATS : STEADY_BEATS));
    }
    return { move: move.move, t: Math.round(t) };
  });
}

/** A whole slow solve of `scramble` at `bpm`, as a smart cube would report its turns. */
export function simulateSolve(scramble: string, bpm: number, pauses: number, rng: Rng): TimedMove[] {
  const { moves } = generateDemoSolve(scramble, Math.floor(rng() * 100_000));
  return paceToBeat(moves, bpm, pauses, rng);
}
