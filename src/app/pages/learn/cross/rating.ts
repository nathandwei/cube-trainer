import type { CrossRep } from "@/shared/learn";

export type CrossVariant = "cross" | "xcross";

// A scramble's level is 1000 + 100 per optimal move, so a rating reads as the length he plans optimally: 1600 means
// six-move crosses found at their best. Each move over the optimum costs a level, so +1 on a seven-mover performs
// like the optimum on a six-mover, and +10 is far below +2 rather than an equal fail. Planning is untimed (Nathan's
// ruling); execution pace nudges the result by at most PACE_LIMIT either way, and the whole range of pace is less than
// one move, so time counts but never outweighs finding a better solution.
const LEVEL_BASE = 1000;
const LEVEL_STEP = 100;
const EXTRA_MOVE_COST = 100;
/** Execution pace that neither adds nor takes away: about 3.3 turns per second. */
const REFERENCE_PACE_MS = 300;
/** Points per doubling of pace. */
const PACE_WEIGHT = 30;
const PACE_LIMIT = 45;

// Same replay as src/app/lib/ratings.ts: the first reps set the rating, later ones move it a little; nothing decays.
const MIN_STEP = 0.05;
const MAX_SWING = 400;

export type CrossRating = { rating: number; delta: number; reps: number };

type Graded = Pick<CrossRep, "optimalMoves" | "moveCount" | "executionMs">;

export function levelForMoves(optimalMoves: number): number {
  return LEVEL_BASE + LEVEL_STEP * optimalMoves;
}

/** The optimal length a rating stands for (fractional). */
export function movesForRating(rating: number): number {
  return (rating - LEVEL_BASE) / LEVEL_STEP;
}

export function extraMoves(rep: Pick<CrossRep, "optimalMoves" | "moveCount">): number {
  return Math.max(0, rep.moveCount - rep.optimalMoves);
}

function paceTerm(rep: Graded): number {
  const pace = rep.executionMs / Math.max(1, rep.moveCount);
  if (pace <= 0) return PACE_LIMIT;
  const term = PACE_WEIGHT * Math.log2(REFERENCE_PACE_MS / pace);
  return Math.max(-PACE_LIMIT, Math.min(PACE_LIMIT, term));
}

/** What one attempt says about him, on the rating scale. */
export function crossPerformance(rep: Graded): number {
  return levelForMoves(rep.optimalMoves) - EXTRA_MOVE_COST * extraMoves(rep) + paceTerm(rep);
}

/** A retry of a scramble whose best solution he has already seen says nothing about planning, so it is not rated. */
export function isRated(rep: CrossRep): boolean {
  return rep.retry !== true;
}

function advance(previous: CrossRating | null, performance: number): CrossRating {
  if (!previous) return { rating: performance, delta: 0, reps: 1 };
  const capped = Math.max(previous.rating - MAX_SWING, Math.min(previous.rating + MAX_SWING, performance));
  const step = Math.max(MIN_STEP, 1 / (previous.reps + 1));
  const rating = previous.rating + step * (capped - previous.rating);
  return { rating, delta: rating - previous.rating, reps: previous.reps + 1 };
}

/** Replays one variant's reps, oldest first; `delta` is what the latest rated rep moved it. */
export function crossRating(repsOldestFirst: readonly CrossRep[]): CrossRating | null {
  let rating: CrossRating | null = null;
  for (const rep of repsOldestFirst) {
    if (isRated(rep)) rating = advance(rating, crossPerformance(rep));
  }
  return rating;
}
