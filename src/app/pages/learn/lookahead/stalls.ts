// What counts against a lookahead solve besides a pause. Turning on the beat isn't looking ahead when the turns are
// filler: spinning U while looking for the next pair (U U U U), or undoing a turn straight away (R R'), keeps the
// beat without solving anything. Nor is wandering through a pair with moves it never needed. Each is a stall, like a
// pause, so the drill can't be passed by turning for the sake of it.

import type { Move, SolveAnalysis, Stage } from "@/cube/types";
import type { LookaheadRep } from "@/shared/learn";
import type { BpmResult } from "./bpm";

/**
 * A cross or pair this many moves (outer turns, a half turn one) longer than its shortest solution is a detour. In
 * real timer solves a pair ran 0–7 over (median 2), so 8 or more is wandering, not just a longer way round.
 */
export const DETOUR_MOVES = 8;

/** Turns `start`..`end` (indexes), all on one axis, that did less than their turns: `wasted` of them did nothing. */
export type Filler = { start: number; end: number; wasted: number };

const AXIS: Readonly<Record<string, number>> = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };

function axisOf(move: Move): number {
  const axis = AXIS[move.charAt(0)];
  if (axis === undefined) throw new Error(`Not an outer turn: ${move}`);
  return axis;
}

type FaceTally = { quarters: number; net: number; turns: number };

/**
 * Runs of turns on one axis that cancel or overshoot, face by face: U U U U, U U', U2 U (an AUF changed mind),
 * U D U'. Counted in quarter turns, so a half turn reported as two quarters (U U), however slowly, is not filler.
 */
export function findFiller(turns: readonly Move[]): Filler[] {
  const found: Filler[] = [];
  let start = 0;
  while (start < turns.length) {
    const axis = axisOf(turns[start]!);
    let end = start;
    while (end + 1 < turns.length && axisOf(turns[end + 1]!) === axis) end++;
    const faces = new Map<string, FaceTally>();
    for (const move of turns.slice(start, end + 1)) {
      const tally = faces.get(move.charAt(0)) ?? { quarters: 0, net: 0, turns: 0 };
      tally.quarters += move.endsWith("2") ? 2 : 1;
      tally.net += move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
      tally.turns++;
      faces.set(move.charAt(0), tally);
    }
    let wastedQuarters = 0;
    let wasted = 0;
    for (const { quarters, net, turns: count } of faces.values()) {
      const left = net % 4;
      wastedQuarters += quarters - (left === 0 ? 0 : left === 2 ? 2 : 1);
      wasted += count - (left === 0 ? 0 : 1);
    }
    if (wastedQuarters > 0) found.push({ start, end, wasted });
    start = end + 1;
  }
  return found;
}

/** The crosses and pairs that took DETOUR_MOVES or more beyond their shortest solution, filler aside. */
export function findDetours(analysis: SolveAnalysis | undefined, filler: readonly Filler[]): Stage[] {
  if (!analysis) return [];
  return analysis.stages.filter((stage) => {
    if (stage.optimalMoves === undefined) return false;
    const spun = filler.filter((run) => run.start >= stage.startMove && run.start < stage.endMove).reduce((sum, run) => sum + run.wasted, 0);
    return stage.moveCount - spun - stage.optimalMoves >= DETOUR_MOVES;
  });
}

/** Everything that counts against a solve: pauses, filler and detours (reps from before stalls only have pauses). */
export function stallsOf(rep: LookaheadRep): number {
  const count = (value: unknown) => (typeof value === "number" ? value : 0);
  return rep.pauses + count(rep.filler) + count(rep.detours);
}

export function bpmResult(rep: LookaheadRep): BpmResult {
  return { bpm: rep.bpm, stalls: stallsOf(rep) };
}
