// The end of calibration: what he knows, and where a shorter alg would save the most moves.

import { algMoveCount, fasterAlg } from "@/cube";

/** A case he showed how he solves. */
export type Known = {
  caseId: string;
  alg: string;
  /** Played by the Test button rather than turned on a cube; never saved as his alg. */
  test: boolean;
  /** First turn to last. */
  executionMs: number;
};

export type Saving = { caseId: string; yours: string; yourMoves: number; shorter: string; moves: number; saved: number; test: boolean };

/** How many savings the summary lists. */
export const TOP_SAVINGS = 8;

function shorterAlg({ caseId, alg, executionMs }: Known): { alg: string; moves: number } | null {
  const yourMoves = algMoveCount(alg);
  if (yourMoves === 0) return null;
  // Judged at the speed he just turned, fasterAlg's time rule asks for an alg clearly shorter than his.
  const seconds = Math.max(executionMs, 1) / 1000;
  // Switch point: once @/cube exports algOptions(caseId), take the fewest-move option other than his from it here.
  return fasterAlg(caseId, seconds * 1000, yourMoves / seconds, alg);
}

/** Every known case with a clearly shorter alg, most moves saved first (ties keep the set's order), at most `limit`. */
export function biggestSavings(known: readonly Known[], limit = TOP_SAVINGS): Saving[] {
  const savings = known.flatMap((entry): Saving[] => {
    const shorter = shorterAlg(entry);
    if (!shorter) return [];
    const yourMoves = algMoveCount(entry.alg);
    return [{ caseId: entry.caseId, yours: entry.alg, yourMoves, shorter: shorter.alg, moves: shorter.moves, saved: yourMoves - shorter.moves, test: entry.test }];
  });
  return savings.sort((a, b) => b.saved - a.saved).slice(0, limit);
}
