// The end of calibration: what he knows, and where another alg would save him the most time.

import { algOptions, caseAlgSpeed, isSameAlg } from "@/cube";
import { median } from "@/app/lib/averages";

/** A case he showed how he solves. */
export type Known = {
  caseId: string;
  alg: string;
  /** Played by the Test button rather than turned on a cube; never saved as his alg. */
  test: boolean;
  /** First turn to last. */
  executionMs: number;
};

export type Saving = { caseId: string; yours: string; yourMs: number; faster: string; fasterMs: number; savedMs: number; test: boolean };

/** How many savings the summary lists. */
export const TOP_SAVINGS = 8;
/** "Clearly faster": at least this much, and this share of his take, so noise in one take doesn't send him relearning. */
const MIN_SAVED_MS = 150;
const MIN_SAVED_SHARE = 0.15;

function estimate(caseId: string, alg: string): number | null {
  try {
    const { ms } = caseAlgSpeed(caseId, alg);
    return ms > 0 ? ms : null;
  } catch (error) {
    console.warn(`No estimate for ${alg} on ${caseId}`, error);
    return null;
  }
}

function sameAlg(a: string, b: string): boolean {
  try {
    return isSameAlg(a, b);
  } catch (error) {
    console.warn(`Can't compare ${a} and ${b}`, error);
    return false;
  }
}

/**
 * His pace against the fingertrick model: the median of his take ÷ the model's time for his own alg, over every
 * take. One number for the whole set, so a single hesitant take doesn't make its case look slow.
 */
export function paceOf(known: readonly Known[]): number | null {
  // Test takes play at a fixed speed: they say nothing about his pace unless they're all there is.
  const real = known.filter((entry) => !entry.test);
  const ratios = (real.length > 0 ? real : known).flatMap((entry) => {
    const ms = estimate(entry.caseId, entry.alg);
    return ms && entry.executionMs > 0 ? [entry.executionMs / ms] : [];
  });
  return median(ratios);
}

/**
 * Every known case where another option should be clearly faster for him, most time saved first (ties keep the set's
 * order), at most `limit`. Both sides are the model's times at his pace: one slow take can't make his own alg look
 * worse than it is, so a suggestion is only ever an alg the model rates faster than his.
 */
export function biggestSavings(known: readonly Known[], limit = TOP_SAVINGS): Saving[] {
  const pace = paceOf(known);
  if (pace === null || !Number.isFinite(pace) || pace <= 0) return [];
  const savings = known.flatMap((entry): Saving[] => {
    const own = estimate(entry.caseId, entry.alg);
    if (own === null) return [];
    const yourMs = own * pace;
    const best = algOptions(entry.caseId)
      .filter((option) => !sameAlg(option.alg, entry.alg))
      .flatMap((option) => {
        const ms = estimate(entry.caseId, option.alg);
        return ms === null ? [] : [{ alg: option.alg, ms: ms * pace }];
      })
      .sort((a, b) => a.ms - b.ms)[0];
    if (!best) return [];
    const savedMs = yourMs - best.ms;
    if (!(savedMs >= Math.max(MIN_SAVED_MS, yourMs * MIN_SAVED_SHARE))) return [];
    return [{ caseId: entry.caseId, yours: entry.alg, yourMs: Math.round(yourMs), faster: best.alg, fasterMs: Math.round(best.ms), savedMs: Math.round(savedMs), test: entry.test }];
  });
  return savings.sort((a, b) => b.savedMs - a.savedMs).slice(0, limit);
}
