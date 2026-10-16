import { solveCross, type CubeState } from "@/cube";
import type { Slot, Stage, StageKind } from "@/cube/types";
import { tokenCountBefore, type TimedToken } from "@/app/lib/display";
import { bestPossibleMoves, singlePairAlternative } from "@/app/lib/review";

/** The display tokens a stage owns, [start, end). */
export type Span = { start: number; end: number };

/** One shortest way to do a step from where it began, in the centre frame. */
export type BestLine = { moves: string; count: number; slot?: Slot };

const MAX_BEST_LINES = 3;

/** Each stage's tokens; a rotation right before a stage's first turn opens that stage, like the turn after it. */
export function stageSpans(tokens: readonly TimedToken[], stages: readonly Stage[]): Span[] {
  const starts = stages.map((stage) => tokenCountBefore(tokens, stage.startMove));
  return starts.map((start, i) => ({ start, end: starts[i + 1] ?? tokens.length }));
}

/** The stage owning token `index`; before the first token that is the first stage, past the end the last. */
export function stageOfToken(spans: readonly Span[], index: number): number {
  if (index < 0) return 0;
  const found = spans.findIndex((span) => index >= span.start && index < span.end);
  return found === -1 ? Math.max(0, spans.length - 1) : found;
}

/**
 * The stage the stepper shows after `played` tokens. Jumping to a stage pins it, so its start shows that stage
 * rather than the end of the one before (the same cube); otherwise it is the stage of the last token played.
 */
export function focusedStage(spans: readonly Span[], played: number, pinned: number | null): number {
  return pinned ?? stageOfToken(spans, played - 1);
}

/** The token to highlight: the last one played, when it belongs to the stage on show. */
export function currentToken(spans: readonly Span[], stage: number, played: number): number | null {
  const span = spans[stage];
  const last = played - 1;
  return span && last >= span.start && last < span.end ? last : null;
}

export type Target = { stage: number; played: number };

/** Back a stage, the way a player's back button works: to the start of this stage, or of the previous one when already there. */
export function previousStageTarget(spans: readonly Span[], stage: number, played: number): Target {
  const span = spans[stage];
  if (span && played > span.start) return { stage, played: span.start };
  const previous = Math.max(0, stage - 1);
  return { stage: previous, played: spans[previous]?.start ?? 0 };
}

/** On a stage: to the start of the next one, or from the last stage to the end of the solve. */
export function nextStageTarget(spans: readonly Span[], stage: number): Target {
  const next = spans[stage + 1];
  if (next) return { stage: stage + 1, played: next.start };
  return { stage, played: spans[stage]?.end ?? 0 };
}

function moveCount(line: string): number {
  return line.split(/\s+/).filter(Boolean).length;
}

/**
 * Up to three shortest lines for a graded step, shortest first. The cross gets several optimal crosses (cheap to
 * enumerate) when its start state is given; a pair gets its own optimum and the easier pair elsewhere, if any.
 */
export function bestLines(stage: Stage, crossStart?: CubeState): BestLine[] {
  if (bestPossibleMoves(stage) === null) return [];
  if (stage.kind === "cross" && crossStart) {
    return solveCross(crossStart, MAX_BEST_LINES)
      .filter(Boolean)
      .map((moves) => ({ moves, count: moveCount(moves) }));
  }
  const lines: BestLine[] = [];
  if (stage.optimalSolution && stage.optimalMoves !== undefined) {
    const slot = stage.kind === "pair" && stage.slots?.length === 1 ? stage.slots[0] : undefined;
    lines.push({ moves: stage.optimalSolution, count: stage.optimalMoves, ...(slot ? { slot } : {}) });
  }
  const alternative = singlePairAlternative(stage);
  if (alternative?.solution && !lines.some((line) => line.slot === alternative.slot)) {
    lines.push({ moves: alternative.solution, count: alternative.moves, slot: alternative.slot });
  }
  return lines.sort((a, b) => a.count - b.count).slice(0, MAX_BEST_LINES);
}

/** A word as shown on screen: sentence case ("inaccuracy" → "Inaccuracy"). */
export function sentenceCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A stage label as shown: Cross and XCross by name, pairs and last-layer steps as written in notation (P1, COLL). */
export function stageName(label: string): string {
  if (label === "cross") return "Cross";
  if (label === "xcross") return "XCross";
  return label.toUpperCase();
}

/** Learn items that drill what a long pause before each kind of stage points at, most specific first. */
const DRILLS: Partial<Record<StageKind, readonly string[]>> = {
  pair: ["lookahead", "F2L"],
  eo: ["EO"],
  coll: ["COLL"],
  epll: ["EPLL"],
  oll: ["OLL"],
  pll: ["PLL"],
};

/** The learn item to drill after a long pause before `stage`, among those that exist. */
export function drillFor(stage: Stage, exists: (id: string) => boolean): string | null {
  return DRILLS[stage.kind]?.find(exists) ?? null;
}
