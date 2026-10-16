// Splits a timed solve into CFOP stages and annotates each with timing, optimal alternatives and LL case names. A
// pair's optimum puts back whatever sits in the slots it isn't solving (solvers.ts holdOthers): the shortest line
// that wrecks another pair isn't one to learn from, and isn't fair to grade his moves against.
//
// Stage boundaries come from milestones measured after every move:
// - cross: the first move after which the cross is solved.
// - F2L pairs: progress is the number of solved slots, read only at moves where the cross is solved (an insertion
//   such as R U R' displaces cross edges mid-way, so those in-between states say nothing). A level counts from the
//   first such move after which it holds at every later cross-solved move until F2L is complete; a pair that is
//   solved and then broken again is therefore not counted until it is re-made, and the moves in between belong
//   to the stage being worked on.
// - last layer: the first move at which EO, OLL (corners oriented), COLL and "solved up to AUF" hold. LL algs
//   break F2L mid-way, so only the first arrival is meaningful there. Which of those split the last layer depends
//   on his method (AnalyzeOptions.method): OLL → PLL (the default) stops only at OLL and solved, EO → COLL → EPLL
//   at all four.
// Trailing U turns after the cube is solved up to AUF belong to the last stage.
//
// Within his method, each last-layer stage is named for the alg he did (llAlgs.ts), when it is one he could know:
// an OCLL that happened to solve the corners too is an OCLL followed by EPLL, not a COLL.

import { getCase, recognizeCase, type CaseSetId } from "./cases";
import { applyMove, isSolved, parseAlg, scrambledState, type CubeState } from "./cubie";
import { recognizeCOLL, recognizeEO, recognizeEPLL } from "./ll";
import { algIndex, recognizeAlgs, splitAlgs, type AlgIndex } from "./llAlgs";
import { isCOLLDone, isEODone, isOLLDone, isSolvedUpToAuf } from "./milestones";
import { SLOTS, isCrossSolved, solvedSlots } from "./pieces";
import { crossDistance, solveCross, solveSlots, solveXCross, type StepSolution } from "./solvers";
import type { Slot, SolveAnalysis, Stage, StageKind, TimedMove } from "./types";

/** How he solves the last layer: OLL then PLL (either in two looks); or edges, then COLL (or OCLL and PLL), then EPLL. */
export type LastLayerMethod = "oll-pll" | "eo-coll";

export const LAST_LAYER_METHODS: readonly LastLayerMethod[] = ["oll-pll", "eo-coll"];

/** Plain CFOP: cross, F2L, OLL, PLL. */
export const DEFAULT_LAST_LAYER: LastLayerMethod = "oll-pll";

export type AnalyzeOptions = {
  /** Defaults to DEFAULT_LAST_LAYER. */
  method?: LastLayerMethod;
  /** His own algs (case id → alg), so the ones he picked are recognised as well as the catalog's. */
  algs?: Readonly<Record<string, string>>;
};

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

const LL_ALL: readonly Milestone[] = ["eo", "oll", "coll", "done"];

/** The last-layer milestones that end a stage in each method. */
const LL_MILESTONES: Record<LastLayerMethod, readonly Milestone[]> = {
  "eo-coll": ["eo", "oll", "coll", "done"],
  "oll-pll": ["oll", "done"],
};

function findBoundaries(progress: readonly Progress[], method: LastLayerMethod): Boundary[] {
  const f2lAt = firstIndex(progress, (p) => p.cross && p.slots.length === 4);
  const levels = slotLevels(progress, f2lAt ?? progress.length - 1);
  const all: [Milestone, number | undefined][] = [
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
  const lastLayer = LL_MILESTONES[method];
  const events = all.filter(([milestone]) => !LL_ALL.includes(milestone) || lastLayer.includes(milestone));
  const byIndex = new Map<number, Milestone[]>();
  for (const [milestone, at] of events) {
    if (at === undefined) continue;
    byIndex.set(at, [...(byIndex.get(at) ?? []), milestone]);
  }
  return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([at, milestones]) => ({ at, milestones }));
}

const SLOT_MILESTONES: readonly Milestone[] = ["slot1", "slot2", "slot3", "slot4"];

type Kind = { kind: StageKind; label: string };

function classify(milestones: readonly Milestone[], method: LastLayerMethod): Kind {
  const has = (m: Milestone): boolean => milestones.includes(m);
  const topSlot = SLOT_MILESTONES.reduce((top, m, i) => (has(m) ? i + 1 : top), 0);
  if (has("cross")) return topSlot > 0 ? { kind: "xcross", label: "xcross" } : { kind: "cross", label: "cross" };
  if (topSlot > 0) return { kind: "pair", label: `p${topSlot}` };
  return method === "oll-pll" ? classifyOllPll(has) : classifyEoColl(has);
}

/** OLL, then PLL. An OLL that also solves the cube is still the OLL (a PLL skip). */
function classifyOllPll(has: (m: Milestone) => boolean): Kind {
  if (has("oll")) return { kind: "oll", label: "oll" };
  if (has("done")) return { kind: "pll", label: "pll" };
  return { kind: "ll", label: "ll" };
}

function classifyEoColl(has: (m: Milestone) => boolean): Kind {
  // The last-layer milestones a stage reaches together tell which system was used: EO → COLL → EPLL,
  // OCLL → PLL, or 2-look OCLL → corner swap → EPLL.
  // An alg that orients edges and corners at once reads as EO here: that is Nathan's system (EO, then
  // COLL), where it means an OCLL skip. A full-OLL user would call it OLL; that needs a per-user setting.
  if (has("eo")) return has("done") ? { kind: "ll", label: "ll" } : { kind: "eo", label: "eo" };
  // Corners oriented and permuted together is COLL, even when it also finishes the cube (an EPLL skip,
  // or what a ZBLL user would call ZBLL).
  if (has("oll")) return has("coll") ? { kind: "coll", label: "coll" } : { kind: "oll", label: "ocll" };
  // Corners already oriented: a corner swap alone is COLL's O case (or 2-look PLL's first step); a
  // corner swap that also finishes the cube is a full PLL.
  if (has("coll")) return has("done") ? { kind: "pll", label: "pll" } : { kind: "coll", label: "coll" };
  if (has("done")) return { kind: "epll", label: "epll" };
  return { kind: "ll", label: "ll" };
}

/** The stage that was under way when the solve stopped short of its next milestone. */
function unfinishedStage(reached: readonly Milestone[], method: LastLayerMethod): Kind {
  if (!reached.includes("cross")) return { kind: "cross", label: "cross" };
  const slots = SLOT_MILESTONES.filter((m) => reached.includes(m)).length;
  if (slots < 4) return { kind: "pair", label: `p${slots + 1}` };
  if (method === "oll-pll") return reached.includes("oll") ? { kind: "pll", label: "pll" } : { kind: "oll", label: "oll" };
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

/** A pair's best line, putting back the other slots; the free one when holding them finds nothing within the depth limit. */
function bestPairLine(state: CubeState, slots: readonly Slot[], keep: readonly Slot[]): StepSolution | null {
  return solveSlots(state, slots, keep, { holdOthers: true }) ?? solveSlots(state, slots, keep);
}

function bestSinglePair(state: CubeState, keep: readonly Slot[], prefer: readonly Slot[]): Stage["bestAlternative"] {
  let best: { slot: Slot; moves: number; solution: string } | undefined;
  const order = [...prefer, ...SLOTS.filter((slot) => !prefer.includes(slot))];
  for (const slot of order) {
    if (keep.includes(slot)) continue;
    const found = bestPairLine(state, [slot], keep);
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

function annotate(kind: StageKind, label: string, states: readonly CubeState[], progress: readonly Progress[], start: number, end: number): Partial<Stage> {
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
      // A joint search over three or four pairs can take over a second; such multislots go unscored.
      if (slots.length > 2) return { slots, bestAlternative };
      const keep = solvedAtStart.filter((slot) => !slots.includes(slot));
      return { slots, bestAlternative, ...asOptimal(bestPairLine(startState, slots, keep)) };
    }
    case "eo":
      return { caseName: recognizeEO(startState)?.caseName };
    case "coll":
      return { caseName: recognizeCOLL(startState)?.caseName };
    case "epll":
      return { caseName: recognizeEPLL(startState)?.caseName };
    case "oll": {
      const name = catalogName("OLL", startState);
      return { caseName: label === "ocll" && name ? (OCLL_NAMES[name] ?? name) : name };
    }
    case "pll":
      return { caseName: catalogName("PLL", startState) };
    default:
      return {};
  }
}

/** OCLL cases by the corner shapes COLL's subsets are named for, rather than their OLL numbers. */
const OCLL_NAMES: Readonly<Record<string, string>> = { "21": "H", "22": "Pi", "23": "U", "24": "T", "25": "L", "26": "Antisune", "27": "Sune" };

/** The case's name in the catalog's set ("27", "Ga"). */
function catalogName(set: CaseSetId, state: CubeState): string | undefined {
  const match = recognizeCase(set, state);
  return match ? getCase(match.caseId).name : undefined;
}

/**
 * In EO → COLL → EPLL, a stage that got further than its alg aims for is named for the alg he did, when it is one
 * he could know: an OCLL that also solved the corners is an OCLL (EPLL comes next), not a COLL; an OLL that
 * oriented edges and corners at once is an OLL, not an EO with an OCLL skip. A dot done as two EO algs can add up to
 * an OLL alg (L, U', line is OLL 3), so a stretch that splits at his pause into EO algs stays EO.
 */
function refineEoColl(stage: Kind, milestones: readonly Milestone[], stretch: readonly TimedMove[], index: AlgIndex): Kind {
  if (!milestones.includes("oll")) return stage;
  const moves = stretch.map((m) => m.move);
  const times = stretch.map((m) => m.t);
  const last = recognizeAlgs(moves, index, times)?.at(-1);
  if (!last) return stage;
  if (stage.kind === "coll" && last.has("OLL") && !last.has("COLL")) return { kind: "oll", label: "ocll" };
  if ((stage.kind === "eo" || stage.kind === "ll") && last.has("OLL") && !last.has("EO")) {
    if (splitAlgs(moves, index, times)?.every((sets) => sets.has("EO"))) return stage;
    return { kind: "oll", label: "oll" };
  }
  return stage;
}

function withoutUndefined(stage: Stage): Stage {
  return Object.fromEntries(Object.entries(stage).filter(([, value]) => value !== undefined)) as Stage;
}

const F2L_KINDS: readonly StageKind[] = ["cross", "xcross", "pair"];

type Span = Kind & { start: number; end: number; milestones: readonly Milestone[] };

function stageSpans(progress: readonly Progress[], moveCount: number, method: LastLayerMethod): Span[] {
  const spans: Span[] = [];
  let previous = 0;
  const reached: Milestone[] = [];
  for (const { at, milestones } of findBoundaries(progress, method)) {
    reached.push(...milestones);
    if (at === 0) continue;
    spans.push({ start: previous, end: at, milestones, ...classify(milestones, method) });
    previous = at;
  }
  if (previous < moveCount) {
    const last = spans.at(-1);
    if (progress.some((p) => p.done) && last) last.end = moveCount;
    else spans.push({ start: previous, end: moveCount, milestones: [], ...unfinishedStage(reached, method) });
  }
  return spans;
}

function analyze(scramble: string, moves: TimedMove[], options: AnalyzeOptions, stored: readonly Stage[] = []): SolveAnalysis {
  const method = options.method ?? DEFAULT_LAST_LAYER;
  const states = replay(scrambledState(scramble), moves);
  const analysis = { totalMs: moves.at(-1)?.t ?? 0, moveCount: moves.length, solved: isSolved(states[moves.length]!) };
  if (moves.length === 0) return { stages: [], ...analysis };

  const progress = states.map(measure);
  const index = algIndex(options.algs);
  const stages = stageSpans(progress, moves.length, method).map((span): Stage => {
    const { start, end } = span;
    if (F2L_KINDS.includes(span.kind)) {
      const kept = stored.find((s) => s.kind === span.kind && s.label === span.label && s.startMove === start && s.endMove === end);
      if (kept) return kept;
    }
    const { kind, label } =
      method === "eo-coll" && !F2L_KINDS.includes(span.kind) ? refineEoColl(span, span.milestones, moves.slice(start, end), index) : span;
    return withoutUndefined({
      kind,
      label,
      startMove: start,
      endMove: end,
      ...timing(moves, start, end),
      ...annotate(kind, label, states, progress, start, end),
    });
  });
  return { stages, ...analysis };
}

export function analyzeSolve(scramble: string, moves: TimedMove[], options: AnalyzeOptions = {}): SolveAnalysis {
  return analyze(scramble, moves, options);
}

/**
 * The analysis with its last-layer stages redone for `options` (his method or algs may have changed since the solve
 * was saved). The cross and F2L stages don't depend on either, so the stored ones, the costly part, are kept.
 */
export function relabelLastLayer(analysis: SolveAnalysis, scramble: string, moves: TimedMove[], options: AnalyzeOptions = {}): SolveAnalysis {
  return analyze(scramble, moves, options, analysis.stages);
}
