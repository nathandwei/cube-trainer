import { MAX_CROSS_MOVES, MAX_XCROSS_MOVES, type Rng } from "@/cube";
import { movesForRating, type CrossVariant } from "./rating";

type Rungs = { min: number; max: number; start: number };

// Shorter than these are too easy to teach planning; the start is about a typical optimal length (5.8 for a fixed
// colour cross, 7.4 for the best-slot xcross; docs/research/01 §2).
export const LADDER: Record<CrossVariant, Rungs> = {
  cross: { min: 3, max: MAX_CROSS_MOVES, start: 5 },
  xcross: { min: 4, max: MAX_XCROSS_MOVES, start: 7 },
};

/** Chance of a scramble one move shorter, and separately one move longer, than his comfortable length. */
const STEP_CHANCE = 0.2;

function clamp(value: number, { min, max }: Rungs): number {
  return Math.max(min, Math.min(max, value));
}

/** The optimal length he currently plans well, per his rating; the start length before any rated rep. */
export function comfortableLength(rating: number | null, variant: CrossVariant): number {
  const rungs = LADDER[variant];
  if (rating === null) return rungs.start;
  return clamp(Math.round(movesForRating(rating)), rungs);
}

/**
 * The next scramble's optimal length: mostly the comfortable one, sometimes one either side, so he can never be
 * sure how short the best solution is (knowing it is exactly N gives the answer away).
 */
export function chooseLength(rating: number | null, variant: CrossVariant, rng: Rng): number {
  return lengthAround(comfortableLength(rating, variant), variant, rng);
}

/** chooseLength for a comfortable length already worked out. */
export function lengthAround(comfortable: number, variant: CrossVariant, rng: Rng): number {
  const roll = rng();
  const offset = roll < STEP_CHANCE ? -1 : roll < 2 * STEP_CHANCE ? 1 : 0;
  return clamp(comfortable + offset, LADDER[variant]);
}
