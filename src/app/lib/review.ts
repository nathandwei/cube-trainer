import type { SolveAnalysis, Stage, TimedMove } from "@/cube/types";

export type Verdict = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder";

/** A gap between turns longer than this counts as a pause rather than turning. */
export const PAUSE_MS = 400;
/** A recognition gap this long before a stage is worth pointing out. */
export const LONG_RECOGNITION_MS = 900;

/**
 * Extra moves over the best available grade a step. A blunder is kept for concrete errors (a wrong alg, breaking
 * something already solved), so extra moves alone stop at mistake.
 */
export function verdictForExtraMoves(extra: number): Verdict {
  if (extra <= 0) return "best";
  if (extra === 1) return "excellent";
  if (extra === 2) return "good";
  if (extra <= 4) return "inaccuracy";
  return "mistake";
}

export const VERDICTS: readonly Verdict[] = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

export function verdictCounts(analysis: SolveAnalysis): Record<Verdict, number> {
  const counts = Object.fromEntries(VERDICTS.map((v) => [v, 0])) as Record<Verdict, number>;
  for (const stage of analysis.stages) {
    const verdict = stageVerdict(stage);
    if (verdict) counts[verdict] += 1;
  }
  return counts;
}

/**
 * The costliest key moments in the order they happened: a pause comes before the moves of the stage it delays.
 * Three by default, which is what the review's report has room for.
 */
export function momentsInOrder(analysis: SolveAnalysis, limit = 3): Moment[] {
  const happened = (moment: Moment) => moment.stageIndex * 2 + (moment.kind === "pause" ? 0 : 1);
  return keyMoments(analysis, limit).sort((a, b) => happened(a) - happened(b));
}

/** A single-pair alternative only competes with a stage that made a single pair. */
export function singlePairAlternative(stage: Stage): Stage["bestAlternative"] {
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

/** Accuracy: how close the cross and F2L moves were to the best available, as a percentage. */
export function accuracy(analysis: SolveAnalysis): number | null {
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

/** Flow: share of the solve spent turning rather than paused, as a percentage. Lockups join this once the smart cube reports them. */
export function flow(moves: readonly TimedMove[], totalMs: number): number | null {
  if (totalMs <= 0) return null;
  return Math.round(100 * (1 - pauseMs(moves) / totalMs));
}

/** Something worth a second look: a step that took extra moves, or a long pause before a step. */
export type Moment =
  | { kind: "moves"; stageIndex: number; costMs: number; moves: number; best: number }
  | { kind: "pause"; stageIndex: number; costMs: number; ms: number };

function msPerMove(stage: Stage): number {
  return stage.moveCount > 0 ? stage.executionMs / stage.moveCount : 130;
}

/** The costliest moments, `limit` at most. `costMs` is a rough price used only for this ranking. */
export function keyMoments(analysis: SolveAnalysis, limit = 5): Moment[] {
  const moments: Moment[] = [];
  analysis.stages.forEach((stage, stageIndex) => {
    const best = bestPossibleMoves(stage);
    if (best !== null && stage.moveCount - best >= 2) {
      moments.push({ kind: "moves", stageIndex, costMs: (stage.moveCount - best) * msPerMove(stage), moves: stage.moveCount, best });
    }
    if (stageIndex > 0 && stage.recognitionMs >= LONG_RECOGNITION_MS) {
      moments.push({ kind: "pause", stageIndex, costMs: stage.recognitionMs - PAUSE_MS, ms: stage.recognitionMs });
    }
  });
  return moments.sort((a, b) => b.costMs - a.costMs).slice(0, limit);
}

/** Which stage owns move `index`; moves past the end belong to the last stage. */
export function stageAt(analysis: SolveAnalysis, index: number): number {
  const found = analysis.stages.findIndex((s) => index >= s.startMove && index < s.endMove);
  return found === -1 ? analysis.stages.length - 1 : found;
}
