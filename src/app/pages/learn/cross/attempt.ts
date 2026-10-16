import { verdictForExtraMoves, type Verdict } from "@/app/lib/review";
import {
  crossDistance,
  isCrossSolved,
  solveCross,
  solveSlots,
  solveXCross,
  solvedSlots,
  SLOTS,
  type CubeState,
} from "@/cube";
import type { Move, Slot } from "@/cube/types";
import type { CrossVariant } from "./rating";

const AXIS: Readonly<Record<string, number>> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const FACE_ORDER = "URFDLB";

function axisOf(move: Move): number {
  const axis = AXIS[move.charAt(0)];
  if (axis === undefined) throw new Error(`Not an outer face turn: "${move}"`);
  return axis;
}

/** One face's turns within an axis block: two equal quarter turns in a row are one half turn. */
function countFaceTurns(turns: readonly Move[]): number {
  let count = 0;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]!;
    if (!turn.endsWith("2") && turns[i + 1] === turn) i++;
    count++;
  }
  return count;
}

/**
 * His move count in the metric the optimal solutions use (outer face turns, a half turn is one). A keyboard or a
 * smart cube gives quarter turns, so R R is the R2 he meant; turns on opposite faces commute, so U D U is still
 * U2 D. Nothing cancels, though: R R' is two moves he really made.
 */
export function countTurns(turns: readonly Move[]): number {
  let count = 0;
  let start = 0;
  while (start < turns.length) {
    const axis = axisOf(turns[start]!);
    let end = start;
    while (end < turns.length && axisOf(turns[end]!) === axis) end++;
    const block = turns.slice(start, end);
    for (const face of new Set(block.map((turn) => turn.charAt(0)))) {
      count += countFaceTurns(block.filter((turn) => turn.charAt(0) === face));
    }
    start = end;
  }
  return count;
}

/** Done: the white cross, plus any one F2L pair for an xcross. */
export function isGoal(variant: CrossVariant, state: CubeState): boolean {
  return isCrossSolved(state) && (variant === "cross" || solvedSlots(state).length > 0);
}

export type SolutionLine = { moves: Move[]; slot?: Slot };
export type BestSolutions = { moves: number; lines: SolutionLine[] };

function split(solution: string): Move[] {
  return solution.split(" ").filter(Boolean);
}

function bestXCross(state: CubeState, max: number): BestSolutions {
  const best = solveXCross(state);
  if (!best) throw new Error("No xcross within the search depth");
  const lines: SolutionLine[] = [];
  const add = (solution: string, slot: Slot) => {
    if (!lines.some((line) => line.moves.join(" ") === solution)) lines.push({ moves: split(solution), slot });
  };
  for (const slot of SLOTS) {
    const found = slot === best.slot ? best : solveSlots(state, [slot], [], { maxDepth: best.moves });
    if (found?.moves === best.moves) add(found.solution, slot);
  }
  // Fewer optimal slots than lines wanted: a second route into the same slot, starting with a different face.
  for (const line of [...lines]) {
    if (lines.length >= max || !line.slot || line.moves.length === 0) break;
    const avoidFirstFace = FACE_ORDER.indexOf(line.moves[0]!.charAt(0));
    const other = solveSlots(state, [line.slot], [], { maxDepth: best.moves, avoidFirstFace });
    if (other?.moves === best.moves) add(other.solution, line.slot);
  }
  return { moves: best.moves, lines: lines.slice(0, max) };
}

/** Up to `max` optimal solutions from `state` (solver frame, outer turns on fixed centres). */
export function bestSolutions(variant: CrossVariant, state: CubeState, max = 3): BestSolutions {
  if (variant === "xcross") return bestXCross(state, max);
  return { moves: crossDistance(state), lines: solveCross(state, max).map((solution) => ({ moves: split(solution) })) };
}

export type Tone = "good" | "ok" | "bad";

export function verdictOf(extra: number): Verdict {
  return verdictForExtraMoves(extra);
}

/** The colour of an attempt's dot: green for the best or one over, neutral for two over, red beyond. */
export function toneOf(extra: number): Tone {
  if (extra <= 1) return "good";
  if (extra === 2) return "ok";
  return "bad";
}
