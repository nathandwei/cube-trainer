// A pretend attempt for the Test button, so the trainer can be tried without a smart cube: what a cube would report
// for someone who plans for a while and then turns a good (sometimes slightly long) cross.

import { MOVE_NAMES, applyAlg, type CubeState, type Rng } from "@/cube";
import { randomInt, uniform } from "@/cube/random";
import type { Move } from "@/cube/types";
import { bestSolutions } from "./attempt";
import type { CrossVariant } from "./rating";

export type SimulatedAttempt = {
  /** Untimed looking before the first turn. */
  planMs: number;
  /** Quarter turns as a smart cube reports them (a half turn arrives as two), solver frame. */
  turns: Move[];
  /** turns[i] arrives atMs[i] after the first turn (atMs[0] = 0). */
  atMs: number[];
  /** Moves over the best that the attempt was built to take. */
  extra: number;
};

const PLAN_MS: [number, number] = [1500, 3200];
const TURN_GAP_MS: [number, number] = [130, 260];
/** The two quarters of a half turn arrive this close together. */
const HALF_GAP_MS: [number, number] = [55, 90];
/** How often the pretend attempt is the best line, one over, or two over. */
const EXTRA_ODDS: readonly [number, number][] = [
  [0, 0.6],
  [1, 0.25],
  [2, 0.15],
];
const DETOUR_TRIES = 40;

function rollExtra(rng: Rng): number {
  let roll = rng();
  for (const [extra, odds] of EXTRA_ODDS) {
    if (roll < odds) return extra;
    roll -= odds;
  }
  return 0;
}

/**
 * A complete line from `state`: the best one, or a plausible slightly longer one (a wrong first turn, then the best
 * from there) when the roll asks for extra moves and such a line exists.
 */
function chooseLine(variant: CrossVariant, state: CubeState, extra: number, rng: Rng): { line: Move[]; extra: number } {
  const best = bestSolutions(variant, state, 1);
  const optimal = best.lines[0]?.moves ?? [];
  if (extra === 0) return { line: optimal, extra: 0 };
  for (let attempt = 0; attempt < DETOUR_TRIES; attempt++) {
    const first = MOVE_NAMES[randomInt(rng, MOVE_NAMES.length)]!;
    const rest = bestSolutions(variant, applyAlg(state, [first]), 1);
    const restLine = rest.lines[0]?.moves;
    if (restLine && 1 + rest.moves === best.moves + extra && restLine[0]?.charAt(0) !== first.charAt(0)) {
      return { line: [first, ...restLine], extra };
    }
  }
  return { line: optimal, extra: 0 };
}

export function simulateAttempt(variant: CrossVariant, state: CubeState, rng: Rng): SimulatedAttempt {
  const { line, extra } = chooseLine(variant, state, rollExtra(rng), rng);
  const turns: Move[] = [];
  const atMs: number[] = [];
  let t = 0;
  for (const move of line) {
    const quarters = move.endsWith("2") ? [move.charAt(0), move.charAt(0)] : [move];
    quarters.forEach((quarter, k) => {
      if (turns.length > 0) t += k > 0 ? uniform(rng, ...HALF_GAP_MS) : uniform(rng, ...TURN_GAP_MS);
      turns.push(quarter);
      atMs.push(Math.round(t));
    });
  }
  return { planMs: Math.round(uniform(rng, ...PLAN_MS)), turns, atMs, extra };
}
