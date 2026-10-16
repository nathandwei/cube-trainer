// What a case page shows about his own record on a case: his drills with the alg he has now, and the times the case
// came up in his real solves.

import { median } from "@/app/lib/averages";
import { stageCase } from "@/app/review/cases";
import { applyAlg, getCase, relabelLastLayer, scrambledState, turnsMatchAlg, type AnalyzeOptions } from "@/cube";
import type { SolveRecord } from "@/cube/types";
import type { CaseRep } from "@/shared/learn";

export type DrillStats = { reps: number; executionMs: number | null; recognitionMs: number | null; bestMs: number | null };

/** His correct drill reps of the case, as medians; recognition only from reps that timed it (test reps, not cube ones). */
export function drillStats(caseId: string, reps: readonly CaseRep[]): DrillStats {
  const own = reps.filter((rep) => rep.item === caseId && rep.correct);
  const recognised = own.filter((rep) => rep.recognitionMs > 0);
  const totals = own.map((rep) => rep.recognitionMs + rep.executionMs);
  return {
    reps: own.length,
    executionMs: median(own.map((rep) => rep.executionMs)),
    recognitionMs: median(recognised.map((rep) => rep.recognitionMs)),
    bestMs: totals.length > 0 ? Math.min(...totals) : null,
  };
}

/** One time the case came up in a solve. `usedAlg` is null where it can't be told (F2L: inserts mix with setup). */
export type SolveSighting = { solveId: string; createdAt: number; recognitionMs: number; executionMs: number; moves: number; usedAlg: boolean | null };

export type SolveStats = {
  sightings: SolveSighting[];
  recognitionMs: number | null;
  executionMs: number | null;
  /** Share of sightings he did with his alg (of those it can be told for); null with none. */
  usedAlgShare: number | null;
};

/**
 * Every stage of his solves that started on this case, newest first: its last-layer stages named his way (his method
 * and algs), F2L pairs by the case their slot showed. Solves whose analysis can't be redone are skipped.
 */
export function solveStats(caseId: string, alg: string | undefined, solves: readonly SolveRecord[], options: AnalyzeOptions): SolveStats {
  const isF2L = getCase(caseId).set === "F2L";
  const sightings: SolveSighting[] = [];
  for (const solve of solves) {
    if (solve.source === "demo" || !solve.analysis || solve.moves.length === 0) continue;
    let analysis;
    try {
      analysis = relabelLastLayer(solve.analysis, solve.scramble, solve.moves, options);
    } catch (error) {
      console.warn(`Skipping solve ${solve.id} in case stats`, error);
      continue;
    }
    let state = scrambledState(solve.scramble);
    let done = 0;
    for (const stage of analysis.stages) {
      state = applyAlg(state, solve.moves.slice(done, stage.startMove).map((m) => m.move));
      done = stage.startMove;
      if (stageCase(stage, state) !== caseId) continue;
      const turns = solve.moves.slice(stage.startMove, stage.endMove).map((m) => m.move);
      sightings.push({
        solveId: solve.id,
        createdAt: solve.createdAt,
        recognitionMs: stage.recognitionMs,
        executionMs: stage.executionMs,
        moves: stage.moveCount,
        usedAlg: isF2L || !alg ? null : turnsMatchAlg(turns, alg),
      });
    }
  }
  sightings.sort((a, b) => b.createdAt - a.createdAt);
  const told = sightings.filter((s) => s.usedAlg !== null);
  return {
    sightings,
    recognitionMs: median(sightings.map((s) => s.recognitionMs)),
    executionMs: median(sightings.map((s) => s.executionMs)),
    usedAlgShare: told.length === 0 ? null : told.filter((s) => s.usedAlg).length / told.length,
  };
}
