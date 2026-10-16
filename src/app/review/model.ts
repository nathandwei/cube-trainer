import { CASES_BY_ID, SLOTS, applyAlg, solveCross, solveSlots, solvedSlots, type CubeState } from "@/cube";
import type { Slot, Stage, StageKind } from "@/cube/types";
import { tokenCountBefore, type TimedToken } from "@/app/lib/display";
import { bestPossibleMoves, singlePairAlternative } from "@/app/lib/review";

/** The display tokens a stage owns, [start, end). */
export type Span = { start: number; end: number };

/** Best lines come in sections: the step's own best, and for the cross the best xcrosses from the same start. */
export type LineGroup = "best" | "xcross";

/** One shortest way to do a step from where it began, in the centre frame, with the slots of the pairs it solves. */
export type BestLine = { moves: string; count: number; slots: readonly Slot[]; group: LineGroup };

const MAX_BEST_LINES = 3;
/** The cross keeps two of its optimal crosses, leaving room for the xcross section under them. */
const MAX_CROSS_LINES = 2;
const MAX_XCROSS_LINES = 2;

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

/** The slots a line solves that were not solved at its start. */
export function slotsMadeBy(start: CubeState, moves: string): Slot[] {
  const before = solvedSlots(start);
  return solvedSlots(applyAlg(start, moves)).filter((slot) => !before.includes(slot));
}

/**
 * Up to three shortest lines for a graded step, shortest first. The cross gets two optimal crosses (cheap to
 * enumerate) when its start state is given; a pair gets its own optimum and the easier pair elsewhere, if any.
 */
export function bestLines(stage: Stage, start?: CubeState): BestLine[] {
  if (bestPossibleMoves(stage) === null) return [];
  if (stage.kind === "cross" && start) {
    return solveCross(start, MAX_CROSS_LINES)
      .filter(Boolean)
      .map((moves): BestLine => ({ moves, count: moveCount(moves), slots: [], group: "best" }));
  }
  const lines: BestLine[] = [];
  if (stage.optimalSolution && stage.optimalMoves !== undefined) {
    lines.push({ moves: stage.optimalSolution, count: stage.optimalMoves, slots: optimumSlots(stage, start), group: "best" });
  }
  const alternative = singlePairAlternative(stage);
  if (alternative?.solution && !lines.some((line) => line.slots.length === 1 && line.slots[0] === alternative.slot)) {
    lines.push({ moves: alternative.solution, count: alternative.moves, slots: [alternative.slot], group: "best" });
  }
  return lines.sort((a, b) => a.count - b.count).slice(0, MAX_BEST_LINES);
}

/** A pair stage's optimum makes the pairs he made; an xcross's optimum makes whichever pair was cheapest. */
function optimumSlots(stage: Stage, start: CubeState | undefined): Slot[] {
  if (stage.kind === "pair") return stage.slots ?? [];
  if (stage.kind === "xcross" && start && stage.optimalSolution) return slotsMadeBy(start, stage.optimalSolution);
  return [];
}

/**
 * The best xcross from the cross's start: the cheapest cross plus one pair for each slot, shortest first, keeping
 * those at most one move over the best. A few ms once the pruning tables are built (the first search builds them).
 */
export function xcrossLines(start: CubeState): BestLine[] {
  const found = SLOTS.flatMap((slot) => {
    const solution = solveSlots(start, [slot], []);
    return solution && solution.moves > 0 ? [{ moves: solution.solution, count: solution.moves, slots: [slot], group: "xcross" as const }] : [];
  });
  const shortest = Math.min(...found.map((line) => line.count));
  return found
    .filter((line) => line.count <= shortest + 1)
    .sort((a, b) => a.count - b.count)
    .slice(0, MAX_XCROSS_LINES);
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

/** Where a stage's drill button goes, and its label (the tooltip: several words are fine there). */
export type Drill = { path: string; label: string };

/** The learn set that drills each kind of stage's cases. */
const CASE_SETS_BY_KIND: Partial<Record<StageKind, string>> = {
  pair: "F2L",
  eo: "EO",
  coll: "COLL",
  epll: "EPLL",
  oll: "OLL",
  pll: "PLL",
};

/**
 * The drill for a stage: the cross and xcross trainers, or the case set of a pair or last-layer step, opened on the
 * case he had when it was recognised (`caseId`). Null when there is nothing to drill (an unclassified last layer)
 * or the learn item doesn't exist.
 */
export function stageDrill(stage: Stage, caseId: string | null, exists: (id: string) => boolean): Drill | null {
  if (stage.kind === "cross" || stage.kind === "xcross") {
    return exists(stage.kind) ? { path: `/learn/${stage.kind}`, label: `Drill ${stage.kind === "cross" ? "cross" : "XCross"}` } : null;
  }
  const set = CASE_SETS_BY_KIND[stage.kind];
  if (!set || !exists(set)) return null;
  const caseDef = caseId ? CASES_BY_ID.get(caseId) : undefined;
  if (!caseDef || caseDef.set !== set) return { path: `/learn/${set}`, label: `Drill ${set}` };
  return { path: `/learn/${set}?case=${encodeURIComponent(caseDef.id)}`, label: `Drill ${caseDef.label}` };
}

/** Where the report's one pause row sends him: reading ahead while turning is what shortens every pause. */
export const PAUSE_DRILL: Drill = { path: "/learn/lookahead", label: "Lookahead drill" };
