// Generates a plausible ~14–19 s human CFOP solve (cross, four pairs, EO, COLL, EPLL) for demos and tests.

import { applyAlg, isSolved, moveFace, moveIndex, scrambledState, simplifyMoves, type CubeState } from "./cubie";
import { matchFaceTurns, recognizeCOLL, recognizeEO, recognizeEPLL } from "./ll";
import { AUFS, aufToSolve, isSolvedUpToAuf } from "./milestones";
import { SLOTS, isCrossSolved, solvedSlots } from "./pieces";
import { createRng, hashString, shuffled, uniform, type Rng } from "./random";
import { crossDistance, findCrossOfLength, solveCross, solveSlots, type StepSolution } from "./solvers";
import type { Move, Slot, StageKind, TimedMove } from "./types";

/** One generated stage: what the analysis of the demo should report for it. */
export type DemoStage = {
  kind: StageKind;
  label: string;
  startMove: number;
  endMove: number;
  slots?: Slot[];
  caseName?: string;
};

type Segment = { kind: StageKind; label: string; moves: Move[]; slots?: Slot[]; caseName?: string; slices?: boolean };

const PAUSE_MS: Partial<Record<StageKind, [number, number]>> = {
  pair: [400, 1400],
  eo: [300, 600],
  coll: [600, 1200],
  epll: [400, 800],
  ll: [400, 900],
};

// Turns per second within a stage: F2L is a little slower than memorised last-layer algs.
const F2L_TPS: [number, number] = [7, 8.5];
const LL_TPS: [number, number] = [7.5, 9];
const F2L_KINDS: readonly StageKind[] = ["cross", "xcross", "pair"];
/** A smart cube reports a slice move as two outer turns a few milliseconds apart. */
const SLICE_GAP_MS: [number, number] = [8, 30];
const OPPOSITE: Readonly<Record<string, string>> = { R: "L", L: "R", U: "D", D: "U", F: "B", B: "F" };

function usesSlices(alg: string): boolean {
  return /(^|\s)[MES]/.test(alg);
}

function split(sequence: string): Move[] {
  return sequence.split(" ").filter(Boolean);
}

function chooseCross(state: CubeState, rng: Rng): Move[] {
  const roll = rng();
  const extra = roll < 0.3 ? 0 : roll < 0.7 ? 1 : 2;
  if (extra > 0) {
    const order = (): number[] => shuffled(rng, [...Array(18).keys()]);
    const longer = findCrossOfLength(state, crossDistance(state) + extra, order);
    if (longer !== null) return split(longer);
  }
  const optimal = solveCross(state, 8);
  return split(optimal[Math.floor(rng() * optimal.length)] ?? "");
}

/** No intermediate cross-solved state may show a different set of solved slots (keeps stage boundaries exact). */
function isClean(state: CubeState, moves: readonly Move[], keep: readonly Slot[]): boolean {
  let current = state;
  for (const move of moves.slice(0, -1)) {
    current = applyAlg(current, [move]);
    if (!isCrossSolved(current)) continue;
    const solved = solvedSlots(current);
    if (solved.length !== keep.length || !keep.every((slot) => solved.includes(slot))) return false;
  }
  return true;
}

type Candidate = { slot: Slot; moves: Move[] };

function optimalPair(state: CubeState, slot: Slot, keep: readonly Slot[], lastFace: number): StepSolution | null {
  const solution = solveSlots(state, [slot], keep);
  const firstMove = solution?.solution.split(" ")[0];
  if (!firstMove || moveFace(moveIndex(firstMove)) !== lastFace) return solution;
  return solveSlots(state, [slot], keep, { avoidFirstFace: lastFace });
}

function attempt(state: CubeState, slot: Slot, keep: readonly Slot[], lastFace: number, adjust: Move | ""): Move[] | null {
  const adjusted = adjust ? applyAlg(state, [adjust]) : state;
  const solution = optimalPair(adjusted, slot, keep, adjust ? moveFace(moveIndex(adjust)) : lastFace);
  if (!solution) return null;
  const moves = simplifyMoves([...split(adjust), ...split(solution.solution)]);
  if (moves.length === 0 || moveFace(moveIndex(moves[0]!)) === lastFace) return null;
  return isClean(state, moves, keep) ? moves : null;
}

// People rarely find the optimal pair: they often turn U first to look at or set up the pair and only then
// solve it, which costs a move or two over the optimum. Fall back to the plain optimum when that fails.
function pairCandidate(state: CubeState, slot: Slot, keep: readonly Slot[], lastFace: number, rng: Rng): Candidate | null {
  const adjust = rng() < 0.6 ? AUFS[1 + Math.floor(rng() * 3)]! : "";
  const moves = (adjust ? attempt(state, slot, keep, lastFace, adjust) : null) ?? attempt(state, slot, keep, lastFace, "");
  return moves ? { slot, moves } : null;
}

// Humans often but not always take the cheapest pair.
function pickPair(candidates: readonly Candidate[], rng: Rng): Candidate {
  const sorted = [...candidates].sort((a, b) => a.moves.length - b.moves.length);
  const roll = rng();
  const index = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2 + Math.floor(rng() * 2);
  return sorted[Math.min(index, sorted.length - 1)]!;
}

function lastFaceOf(segments: readonly Segment[]): number {
  const last = segments.at(-1)?.moves.at(-1);
  return last ? moveFace(moveIndex(last)) : -10;
}

function planF2L(start: CubeState, rng: Rng, segments: Segment[]): CubeState {
  let state = start;
  if (!isCrossSolved(state)) {
    const before = solvedSlots(state);
    const moves = chooseCross(state, rng);
    state = applyAlg(state, moves);
    const after = solvedSlots(state);
    const fresh = after.filter((slot) => !before.includes(slot));
    if (after.length === 0) segments.push({ kind: "cross", label: "cross", moves });
    else segments.push({ kind: "xcross", label: "xcross", moves, slots: fresh.length > 0 ? fresh : after });
  }
  while (solvedSlots(state).length < 4) {
    const keep = solvedSlots(state);
    const lastFace = lastFaceOf(segments);
    const candidates = SLOTS.filter((slot) => !keep.includes(slot))
      .map((slot) => pairCandidate(state, slot, keep, lastFace, rng))
      .filter((candidate): candidate is Candidate => candidate !== null);
    if (candidates.length === 0) throw new Error("Demo generator found no clean pair solution");
    const { moves } = pickPair(candidates, rng);
    state = applyAlg(state, moves);
    const solved = solvedSlots(state);
    const slots = solved.filter((slot) => !keep.includes(slot));
    segments.push({ kind: "pair", label: `p${solved.length}`, moves, slots });
  }
  return state;
}

function planLastLayer(start: CubeState, segments: Segment[]): CubeState {
  let state = start;
  const eo = recognizeEO(state);
  if (eo) {
    const moves = matchFaceTurns({ ...eo, postAuf: "" });
    state = applyAlg(state, moves);
    const kind = isSolvedUpToAuf(state) ? "ll" : "eo";
    segments.push({ kind, label: kind, moves, caseName: kind === "eo" ? eo.caseName : undefined, slices: usesSlices(eo.alg) });
  }
  const coll = recognizeCOLL(state);
  if (coll) {
    const moves = matchFaceTurns({ ...coll, postAuf: "" });
    state = applyAlg(state, moves);
    segments.push({ kind: "coll", label: "coll", moves, caseName: coll.caseName, slices: usesSlices(coll.alg) });
  }
  const epll = recognizeEPLL(state);
  if (epll) {
    const moves = matchFaceTurns(epll);
    state = applyAlg(state, moves);
    segments.push({ kind: "epll", label: "epll", moves, caseName: epll.caseName, slices: usesSlices(epll.alg) });
  }
  const auf = aufToSolve(state);
  if (auf < 0) throw new Error("Demo generator did not reach a solved last layer");
  if (auf === 0) return state;
  const last = segments.at(-1);
  if (last) last.moves.push(AUFS[auf]!);
  else segments.push({ kind: "epll", label: "epll", moves: [AUFS[auf]!] });
  return applyAlg(state, [AUFS[auf]!]);
}

// A stage's milestone is reached on its last non-U turn, so trailing U turns are really the next stage's AUF:
// carry them over and merge them the way a person would.
function tidySegments(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  let carried: Move[] = [];
  segments.forEach((segment, i) => {
    let moves = simplifyMoves([...carried, ...segment.moves]);
    carried = [];
    if (i < segments.length - 1) {
      let cut = moves.length;
      while (cut > 0 && moves[cut - 1]!.startsWith("U")) cut--;
      carried = moves.slice(cut);
      moves = moves.slice(0, cut);
    }
    if (moves.length > 0) out.push({ ...segment, moves });
  });
  return out;
}

function timeSegments(segments: readonly Segment[], rng: Rng): TimedMove[] {
  const timed: TimedMove[] = [];
  let t = 0;
  segments.forEach((segment, index) => {
    const pause = PAUSE_MS[segment.kind];
    if (index > 0 && pause) t += uniform(rng, ...pause);
    const gap = 1000 / uniform(rng, ...(F2L_KINDS.includes(segment.kind) ? F2L_TPS : LL_TPS));
    const hesitateAt = segment.moves.length >= 4 && rng() < 0.5 ? 1 + Math.floor(rng() * (segment.moves.length - 1)) : -1;
    let pairedPrevious = false;
    segment.moves.forEach((move, i) => {
      const halfOfSlice =
        Boolean(segment.slices) && i > 0 && !pairedPrevious && OPPOSITE[segment.moves[i - 1]!.charAt(0)] === move.charAt(0);
      pairedPrevious = halfOfSlice;
      if (halfOfSlice) t += uniform(rng, ...SLICE_GAP_MS);
      else if (i > 0) t += gap * uniform(rng, 0.6, 1.4);
      if (i === hesitateAt) t += uniform(rng, 500, 1000);
      timed.push({ move, t: Math.round(t) });
    });
  });
  return timed;
}

/** Moves plus the stages the generator intended (the analysis should report exactly these). */
export function generateDemoPlan(scramble: string, seed?: number): { moves: TimedMove[]; stages: DemoStage[] } {
  const rng = createRng(seed ?? hashString(scramble));
  const raw: Segment[] = [];
  const afterF2L = planF2L(scrambledState(scramble), rng, raw);
  if (!isSolved(planLastLayer(afterF2L, raw))) throw new Error(`Demo generator failed to solve "${scramble}"`);
  const segments = tidySegments(raw);
  const moves = timeSegments(segments, rng);
  let start = 0;
  const stages = segments.map(({ kind, label, moves: segmentMoves, slots, caseName }) => {
    const stage: DemoStage = { kind, label, startMove: start, endMove: start + segmentMoves.length };
    if (slots) stage.slots = slots;
    if (caseName) stage.caseName = caseName;
    start = stage.endMove;
    return stage;
  });
  return { moves, stages };
}

/** A plausible human CFOP solve of `scramble` in the solver frame, timed from the first turn (t = 0). */
export function generateDemoSolve(scramble: string, seed?: number): TimedMove[] {
  return generateDemoPlan(scramble, seed).moves;
}
