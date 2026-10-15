import type { SolveAnalysis, Stage, TimedMove } from "@/cube/types";

export type Verdict = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

/** A gap between turns longer than this counts as a pause rather than turning. */
export const PAUSE_MS = 400;
/** A recognition gap this long before a stage is worth pointing out. */
const LONG_RECOGNITION_MS = 900;

export const VERDICT_MARK: Record<Verdict, string> = {
  best: "★",
  excellent: "!",
  good: "✓",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export function verdictForExtraMoves(extra: number): Verdict {
  if (extra <= 0) return "best";
  if (extra === 1) return "excellent";
  if (extra === 2) return "good";
  if (extra <= 4) return "inaccuracy";
  if (extra <= 7) return "mistake";
  return "blunder";
}

/** A single-pair alternative only competes with a stage that made a single pair. */
function singlePairAlternative(stage: Stage): Stage["bestAlternative"] {
  return stage.kind === "pair" && stage.slots?.length === 1 ? stage.bestAlternative : undefined;
}

/** The fewest moves this step could have taken, counting an easier pair in another slot. */
export function bestPossibleMoves(stage: Stage): number | null {
  if (stage.optimalMoves === undefined) return null;
  // The xcross optimum is for one pair; a multi-pair xcross has nothing fair to compare against.
  if (stage.kind === "xcross" && (stage.slots?.length ?? 0) > 1) return null;
  return Math.min(stage.optimalMoves, singlePairAlternative(stage)?.moves ?? Number.POSITIVE_INFINITY);
}

export function stageVerdict(stage: Stage): Verdict | null {
  const best = bestPossibleMoves(stage);
  if (best === null) return null;
  return verdictForExtraMoves(stage.moveCount - best);
}

/** Share of the cross and F2L moves that were necessary, as a percentage. */
export function efficiency(analysis: SolveAnalysis): number | null {
  let optimal = 0;
  let actual = 0;
  for (const stage of analysis.stages) {
    const best = bestPossibleMoves(stage);
    if (best === null) continue;
    optimal += best;
    actual += stage.moveCount;
  }
  return actual === 0 ? null : Math.round((100 * optimal) / actual);
}

/** Total time spent in gaps longer than PAUSE_MS, counting the wait before the first turn. */
export function pauseMs(moves: readonly TimedMove[]): number {
  let paused = 0;
  let previous = 0;
  for (const { t } of moves) {
    const gap = t - previous;
    if (gap > PAUSE_MS) paused += gap;
    previous = t;
  }
  return paused;
}

/** Share of the solve spent turning rather than paused, as a percentage. */
export function flow(moves: readonly TimedMove[], totalMs: number): number | null {
  if (totalMs <= 0) return null;
  return Math.round(100 * (1 - pauseMs(moves) / totalMs));
}

export type Moment = {
  kind: "moves" | "slot" | "pause";
  stageIndex: number;
  /** Rough cost in ms, used only to rank moments. */
  costMs: number;
  title: string;
  /** A better line from the start of the stage, when there is one. */
  line?: string;
};

function msPerMove(stage: Stage): number {
  return stage.moveCount > 0 ? stage.executionMs / stage.moveCount : 130;
}

export function keyMoments(analysis: SolveAnalysis, limit = 5): Moment[] {
  const moments: Moment[] = [];
  analysis.stages.forEach((stage, stageIndex) => {
    const alternative = singlePairAlternative(stage);
    const best = bestPossibleMoves(stage);
    if (alternative && stage.optimalMoves !== undefined && alternative.moves <= stage.optimalMoves - 2) {
      moments.push({
        kind: "slot",
        stageIndex,
        costMs: (stage.moveCount - alternative.moves) * msPerMove(stage),
        title: `${stage.label}: ${alternative.slot} was ${alternative.moves} moves`,
        line: alternative.solution,
      });
    } else if (best !== null && stage.moveCount - best >= 2) {
      moments.push({
        kind: "moves",
        stageIndex,
        costMs: (stage.moveCount - best) * msPerMove(stage),
        title: `${stage.label}: ${stage.moveCount} moves, best ${best}`,
        line: stage.optimalSolution,
      });
    }
    if (stageIndex > 0 && stage.recognitionMs >= LONG_RECOGNITION_MS) {
      moments.push({
        kind: "pause",
        stageIndex,
        costMs: stage.recognitionMs - PAUSE_MS,
        title: `${(stage.recognitionMs / 1000).toFixed(2)} s pause before ${stage.label}`,
      });
    }
  });
  return moments.sort((a, b) => b.costMs - a.costMs).slice(0, limit);
}

/** Which stage owns move `index`; moves past the end belong to the last stage. */
export function stageAt(analysis: SolveAnalysis, index: number): number {
  const found = analysis.stages.findIndex((s) => index >= s.startMove && index < s.endMove);
  return found === -1 ? analysis.stages.length - 1 : found;
}
