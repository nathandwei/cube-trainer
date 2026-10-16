import { MAX_CROSS_MOVES, MAX_XCROSS_MOVES, type Rng } from "@/cube";
import type { CrossRep } from "@/shared/learn";

export type CrossVariant = "cross" | "xcross";

type Rungs = { min: number; max: number; start: number };

// Shorter than these are too easy to teach planning; the start is about a typical optimal length (5.8 for a fixed
// colour cross, 7.4 for the best-slot xcross; docs/research/01 §2).
export const LADDER: Record<CrossVariant, Rungs> = {
  cross: { min: 3, max: MAX_CROSS_MOVES, start: 5 },
  xcross: { min: 4, max: MAX_XCROSS_MOVES, start: 7 },
};

// A staircase, not a rating (only solves move his ratings, his ruling): an attempt within a move of the best nudges
// the length up, one three or more over brings it down faster, so it settles where he finds good solutions most of
// the time.
const STEP_UP = 0.34;
const STEP_DOWN = 0.5;
const CLOSE_ENOUGH = 1;
const TOO_FAR = 3;

/** Chance of a scramble one move shorter, and separately one move longer, than his comfortable length. */
const STEP_CHANCE = 0.2;

function clamp(value: number, { min, max }: Rungs): number {
  return Math.max(min, Math.min(max, value));
}

export function extraMoves(rep: Pick<CrossRep, "optimalMoves" | "moveCount">): number {
  return Math.max(0, rep.moveCount - rep.optimalMoves);
}

/** A retry (he has seen the best line) or a test attempt says nothing about his planning. */
export function countsForLadder(rep: CrossRep): boolean {
  return rep.retry !== true && rep.test !== true;
}

/** The optimal length he currently plans well, walked up and down by his attempts (oldest first). */
export function comfortableLength(repsOldestFirst: readonly CrossRep[], variant: CrossVariant): number {
  const rungs = LADDER[variant];
  let level = rungs.start;
  for (const rep of repsOldestFirst) {
    if (!countsForLadder(rep)) continue;
    const extra = extraMoves(rep);
    if (extra <= CLOSE_ENOUGH) level = clamp(level + STEP_UP, rungs);
    else if (extra >= TOO_FAR) level = clamp(level - STEP_DOWN, rungs);
  }
  return clamp(Math.round(level), rungs);
}

/**
 * The next scramble's optimal length: mostly the comfortable one, sometimes one either side, so he can never be
 * sure how short the best solution is (knowing it is exactly N gives the answer away).
 */
export function lengthAround(comfortable: number, variant: CrossVariant, rng: Rng): number {
  const roll = rng();
  const offset = roll < STEP_CHANCE ? -1 : roll < 2 * STEP_CHANCE ? 1 : 0;
  return clamp(comfortable + offset, LADDER[variant]);
}
