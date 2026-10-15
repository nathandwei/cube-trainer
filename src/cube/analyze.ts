// Splits a timed solve into CFOP stages and annotates each with timing, optimal alternatives and LL case names.
//
// Stage boundaries come from milestones measured after every move:
// - cross: the first move after which the cross is solved.
// - F2L pairs: progress is the number of solved slots, read only at moves where the cross is solved (an insertion
//   such as R U R' displaces cross edges mid-way, so those in-between states say nothing). A level counts from the
//   first such move after which it holds at every later cross-solved move until F2L is complete; a pair that is
//   solved and then broken again is therefore not counted until it is re-made, and the moves in between belong
//   to the stage being worked on.
// - last layer: the first move at which EO, OLL (corners oriented), COLL and "solved up to AUF" hold. LL algs
//   break F2L mid-way, so only the first arrival is meaningful there.
// Trailing U turns after the cube is solved up to AUF belong to the last stage.

import { applyMove, isSolved, parseAlg, scrambledState, type CubeState } from "./cubie";
import { recognizeCOLL, recognizeEO, recognizeEPLL } from "./ll";
import { isCOLLDone, isEODone, isOLLDone, isSolvedUpToAuf } from "./milestones";
import { SLOTS, isCrossSolved, solvedSlots } from "./pieces";
import { crossDistance, solveCross, solveSlots, solveXCross, type StepSolution } from "./solvers";
import type { Slot, SolveAnalysis, Stage, StageKind, TimedMove } from "./types";

type Progress = {
  cross: boolean;
  slots: Slot[];
  eo: boolean;
  oll: boolean;
  coll: boolean;
  done: boolean;
};

type Milestone = "cross" | "slot1" | "slot2" | "slot3" | "slot4" | "eo" | "oll" | "coll" | "done";

type Boundary = { at: number; milestones: Milestone[] };

function measure(state: CubeState): Progress {
  return {
    cross: isCrossSolved(state),
    slots: solvedSlots(state),
    eo: isEODone(state),
    oll: isOLLDone(state),
    coll: isCOLLDone(state),
    done: isSolvedUpToAuf(state),
  };
}

function replay(start: CubeState, moves: readonly TimedMove[]): CubeState[] {
  const states = [start];
  moves.forEach(({ move, t }, i) => {
    const [parsed, ...rest] = parseAlg(move);
    if (!parsed || rest.length > 0) throw new Error(`Move ${i} is not a single face turn: "${move}"`);
    if (!Number.isFinite(t) || t < 0) throw new Error(`Move ${i} has an invalid time: ${t}`);
    if (i > 0 && t < moves[i - 1]!.t) throw new Error(`Move ${i} is earlier than the move before it`);
    states.push(applyMove(states[i]!, parsed));
  });
  return states;
}

function firstIndex(progress: readonly Progress[], test: (p: Progress) => boolean): number | undefined {
  const index = progress.findIndex(test);
  return index < 0 ? undefined : index;
}

/** slotLevels[k]: first cross-solved index from which k slots stay solved at every cross-solved index up to `until`. */
function slotLevels(progress: readonly Progress[], until: number): (number | undefined)[] {
  const levels: (number | undefined)[] = [undefined, undefined, undefined, undefined, undefined];
  let suffixMin = Infinity;
  for (let i = until; i >= 0; i--) {
    const p = progress[i]!;
    if (!p.cross) continue;
    suffixMin = Math.min(suffixMin, p.slots.length);
    for (let k = 1; k <= suffixMin; k++) levels[k] = i;
  }
  return levels;
}

function findBoundaries(progress: readonly Progress[]): Boundary[] {
  const f2lAt = firstIndex(progress, (p) => p.cross && p.slots.length === 4);
  const levels = slotLevels(progress, f2lAt ?? progress.length - 1);
  const events: [Milestone, number | undefined][] = [
    ["cross", firstIndex(progress, (p) => p.cross)],
    ["slot1", levels[1]],
    ["slot2", levels[2]],
    ["slot3", levels[3]],
    ["slot4", levels[4]],
    ["eo", firstIndex(progress, (p) => p.eo)],
    ["oll", firstIndex(progress, (p) => p.oll)],
    ["coll", firstIndex(progress, (p) => p.coll)],
    ["done", firstIndex(progress, (p) => p.done)],
  ];
  const byIndex = new Map<number, Milestone[]>();
  for (const [milestone, at] of events) {
    if (at === undefined) continue;
    byIndex.set(at, [...(byIndex.get(at) ?? []), milestone]);
  }
  return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([at, milestones]) => ({ at, milestones }));
}

const SLOT_MILESTONES: readonly Milestone[] = ["slot1", "slot2", "slot3", "slot4"];

function classify(milestones: readonly Milestone[]): { kind: StageKind; label: string } {
  const has = (m: Milestone): boolean => milestones.includes(m);
  const topSlot = SLOT_MILESTONES.reduce((top, m, i) => (has(m) ? i + 1 : top), 0);
  if (has("cross")) return topSlot > 0 ? { kind: "xcross", label: "xcross" } : { kind: "cross", label: "cross" };
  if (topSlot > 0) return { kind: "pair", label: `p${topSlot}` };
  if (has("eo")) return has("done") ? { kind: "ll", label: "ll" } : { kind: "eo", label: "eo" };
  if (has("coll")) return { kind: "coll", label: "coll" };
  if (has("done")) return { kind: "epll", label: "epll" };
  return { kind: "ll", label: "ll" };
}

/** The stage that was under way when the solve stopped short of its next milestone. */
function unfinishedStage(reached: readonly Milestone[]): { kind: StageKind; label: string } {
  if (!reached.includes("cross")) return { kind: "cross", label: "cross" };
  const slots = SLOT_MILESTONES.filter((m) => reached.includes(m)).length;
  if (slots < 4) return { kind: "pair", label: `p${slots + 1}` };
  if (!reached.includes("eo")) return { kind: "eo", label: "eo" };
  if (!reached.includes("coll")) return { kind: "coll", label: "coll" };
  return { kind: "epll", label: "epll" };
}

function timing(moves: readonly TimedMove[], start: number, end: number): Pick<
  Stage,
  "recognitionMs" | "executionMs" | "totalMs" | "moveCount" | "longestPauseMs"
> {
  const first = moves[start]!.t;
  const recognitionMs = first - (start > 0 ? moves[start - 1]!.t : 0);
  const executionMs = moves[end - 1]!.t - first;
  let longestPauseMs = 0;
  for (let i = start + 1; i < end; i++) longestPauseMs = Math.max(longestPauseMs, moves[i]!.t - moves[i - 1]!.t);
  return { recognitionMs, executionMs, totalMs: recognitionMs + executionMs, moveCount: end - start, longestPauseMs };
}

function asOptimal(solution: StepSolution | null): Pick<Stage, "optimalMoves" | "optimalSolution"> {
  return solution ? { optimalMoves: solution.moves, optimalSolution: solution.solution } : {};
}

function bestSinglePair(state: CubeState, keep: readonly Slot[], prefer: readonly Slot[]): Stage["bestAlternative"] {
  let best: { slot: Slot; moves: number; solution: string } | undefined;
  const order = [...prefer, ...SLOTS.filter((slot) => !prefer.includes(slot))];
  for (const slot of order) {
    if (keep.includes(slot)) continue;
    const found = solveSlots(state, [slot], keep);
    if (found && (!best || found.moves < best.moves)) best = { slot, ...found };
  }
  return best;
}

/**
 * Slots solved at the end of a stage that were unsolved at its start or at some cross-solved move inside it
 * (so a slot that was broken and re-made counts for the stage that re-made it).
 */
function slotsMade(progress: readonly Progress[], start: number, end: number): Slot[] {
  const inside = progress.slice(start, end).filter((p, i) => i === 0 || p.cross);
  return progress[end]!.slots.filter((slot) => inside.some((p) => !p.slots.includes(slot)));
}

function annotate(kind: StageKind, states: readonly CubeState[], progress: readonly Progress[], start: number, end: number): Partial<Stage> {
  const startState = states[start]!;
  switch (kind) {
    case "cross": {
      const [solution = ""] = solveCross(startState, 1);
      return { optimalMoves: crossDistance(startState), optimalSolution: solution };
    }
    case "xcross": {
      const made = slotsMade(progress, start, end);
      return { slots: made.length > 0 ? made : progress[end]!.slots, ...asOptimal(solveXCross(startState)) };
    }
    case "pair": {
      const slots = slotsMade(progress, start, end);
      const solvedAtStart = progress[start]!.slots;
      const bestAlternative = bestSinglePair(startState, solvedAtStart, slots);
      if (slots.length === 0) return { slots, bestAlternative };
      const keep = solvedAtStart.filter((slot) => !slots.includes(slot));
      return { slots, bestAlternative, ...asOptimal(solveSlots(startState, slots, keep)) };
    }
    case "eo":
      return { caseName: recognizeEO(startState)?.caseName };
    case "coll":
      return { caseName: recognizeCOLL(startState)?.caseName };
    case "epll":
      return { caseName: recognizeEPLL(startState)?.caseName };
    default:
      return {};
  }
}

function withoutUndefined(stage: Stage): Stage {
  return Object.fromEntries(Object.entries(stage).filter(([, value]) => value !== undefined)) as Stage;
}

export function analyzeSolve(scramble: string, moves: TimedMove[]): SolveAnalysis {
  const states = replay(scrambledState(scramble), moves);
  const analysis = { totalMs: moves.at(-1)?.t ?? 0, moveCount: moves.length, solved: isSolved(states[moves.length]!) };
  if (moves.length === 0) return { stages: [], ...analysis };

  const progress = states.map(measure);
  const boundaries = findBoundaries(progress);
  const done = progress.some((p) => p.done);
  const spans: { start: number; end: number; kind: StageKind; label: string }[] = [];
  let previous = 0;
  const reached: Milestone[] = [];
  for (const { at, milestones } of boundaries) {
    reached.push(...milestones);
    if (at === 0) continue;
    spans.push({ start: previous, end: at, ...classify(milestones) });
    previous = at;
  }
  if (previous < moves.length) {
    const last = spans.at(-1);
    if (done && last) last.end = moves.length;
    else spans.push({ start: previous, end: moves.length, ...unfinishedStage(reached) });
  }

  const stages = spans.map(({ start, end, kind, label }) =>
    withoutUndefined({
      kind,
      label,
      startMove: start,
      endMove: end,
      ...timing(moves, start, end),
      ...annotate(kind, states, progress, start, end),
    }),
  );
  return { stages, ...analysis };
}
