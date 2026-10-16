// Generates a plausible ~14–19 s human CFOP solve (cross, four pairs, then OLL, PLL or EO, COLL, EPLL) for demos
// and tests.
//
// The simulated solver works in their own view: before each pair they rotate the cube (y, y', y2) to bring the
// slot to the front, solve the pair mostly with R, U, F and L, and run last-layer algs as written, wide moves and
// slices included. The output is what a smart cube would report: outer turns relative to the centres (`moves`, see
// types.ts) plus every movement of the centres relative to the solver (`rotations`: the y before a pair, the x
// inside an r, the x' inside an M). FrameTracker converts each move in the solver's view to the centre frame.

import {
  SOLVED,
  applyAlg,
  isSolved,
  moveFace,
  moveIndex,
  rotateFrame,
  scrambleToSolverFrame,
  simplifyMoves,
  type CubeState,
  type Face,
  type Frame,
} from "./cubie";
import { DEFAULT_LAST_LAYER, type LastLayerMethod } from "./analyze";
import { getCase, recognizeCase } from "./cases";
import { FrameTracker, splitMoves, type FrameStep } from "./frame";
import { recognizeCOLL, recognizeEO, recognizeEPLL } from "./ll";
import { AUFS, aufToSolve, isSolvedUpToAuf, llCornersOriented } from "./milestones";
import { SLOTS, SLOT_INFO, isCrossSolved, solvedSlots } from "./pieces";
import { createRng, hashString, shuffled, uniform, type Rng } from "./random";
import {
  MAX_PAIR_DEPTH,
  crossDistance,
  findCrossOfLength,
  solveCross,
  solveSlots,
  type SearchOptions,
  type StepSolution,
} from "./solvers";
import type { Move, Rotation, RotationEvent, Slot, StageKind, TimedMove } from "./types";

/** One generated stage: what the analysis of the demo should report for it. */
export type DemoStage = {
  kind: StageKind;
  label: string;
  startMove: number;
  endMove: number;
  slots?: Slot[];
  caseName?: string;
};

/** A demo solve as a smart cube with a gyro would record it. */
export type DemoSolve = { moves: TimedMove[]; rotations: RotationEvent[] };

/**
 * One thing the solver does, in the centre frame: an outer turn, a wide move or slice (its turns plus the rotation
 * inside it), or a whole-cube rotation (no turns).
 */
type Step = FrameStep;

type Segment = { kind: StageKind; label: string; steps: Step[]; slots?: Slot[]; caseName?: string };

/** The solve so far. `history` holds every centre-frame turn since solved, so the state can be re-read in any view. */
type Planner = { state: CubeState; view: FrameTracker; history: Move[]; segments: Segment[]; rng: Rng };

const PAUSE_MS: Partial<Record<StageKind, [number, number]>> = {
  pair: [400, 1400],
  eo: [300, 600],
  coll: [600, 1200],
  epll: [400, 800],
  oll: [500, 1100],
  pll: [500, 1000],
  ll: [400, 900],
};

// Turns per second within a stage: F2L is a little slower than memorised last-layer algs.
const F2L_TPS: [number, number] = [7, 8.5];
const LL_TPS: [number, number] = [7.5, 9];
const F2L_KINDS: readonly StageKind[] = ["cross", "xcross", "pair"];
/** A smart cube reports a slice move as two outer turns a few milliseconds apart. */
const SLICE_GAP_MS: [number, number] = [8, 30];
/** A cube rotation takes a moment, and so does regripping before the next turn. */
const ROTATION_MS: [number, number] = [150, 300];

const U_FACE = moveFace(moveIndex("U"));
const NO_FACE = -10;

function split(sequence: string): Move[] {
  return sequence.split(" ").filter(Boolean);
}

function turnCount(steps: readonly Step[]): number {
  return steps.reduce((count, step) => count + step.turns.length, 0);
}

function play(p: Planner, steps: Step[]): Step[] {
  for (const step of steps) {
    p.state = applyAlg(p.state, step.turns);
    p.history.push(...step.turns);
  }
  return steps;
}

/** Performs an alg as the solver sees it (wide moves, slices and rotations allowed). */
function playInView(p: Planner, alg: string): Step[] {
  return play(p, splitMoves(alg).map((move) => p.view.apply(move)));
}

function playCentreTurns(p: Planner, moves: readonly Move[]): Step[] {
  return play(p, moves.map((move) => ({ turns: [move] })));
}

/** The cube as the solver sees it now (pieces and positions named after the faces in their view). */
function viewState(p: Planner): CubeState {
  return applyAlg(SOLVED, p.history.map((move) => p.view.name(move)));
}

function requireUpright(frame: Frame, when: string): void {
  if (frame.U !== "U" || frame.D !== "D") throw new Error(`Demo solver is not holding the cross on D ${when}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Cross

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

function planCross(p: Planner): void {
  if (isCrossSolved(p.state)) return;
  const before = solvedSlots(p.state);
  const steps = playCentreTurns(p, chooseCross(p.state, p.rng));
  const after = solvedSlots(p.state);
  const fresh = after.filter((slot) => !before.includes(slot));
  if (after.length === 0) p.segments.push({ kind: "cross", label: "cross", steps });
  else p.segments.push({ kind: "xcross", label: "xcross", steps, slots: fresh.length > 0 ? fresh : after });
}

// ---------------------------------------------------------------------------------------------------------------
// F2L pairs

type Side = "right" | "left";

type PairCandidate = { slot: Slot; yTurns: number; moves: Move[]; cost: number };

const Y_ROTATIONS: readonly (Rotation | null)[] = [null, "y", "y2", "y'"];
/** In moves: a rotation costs time and a regrip; the left hand is the weaker one for most solvers. */
const ROTATION_COST = [0, 1, 1.6, 1];
const LEFT_COST = 0.8;
const VISIBLE_BONUS = 0.5;

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

function slotBetween(a: Face, b: Face): Slot {
  const slot = SLOTS.find((s) => s.includes(a) && s.includes(b));
  if (!slot) throw new Error(`No F2L slot between ${a} and ${b}`);
  return slot;
}

/** The faces a person turns for the slot in front of them: U, the slot's side, F, the other side (favourite first). */
type PairFaces = { up: Face; near: Face; front: Face; far: Face };

/** The y turns (0–3) that bring `slot` to the front right (or left), and the faces turned there. */
function placement(frame: Frame, slot: Slot, side: Side): { yTurns: number; faces: PairFaces } {
  for (let yTurns = 0; yTurns < 4; yTurns++) {
    const view = rotateFrame(frame, "y", yTurns);
    const [near, far] = side === "right" ? [view.R, view.L] : [view.L, view.R];
    if (slotBetween(view.F, near) === slot) return { yTurns, faces: { up: view.U, near, front: view.F, far } };
  }
  throw new Error(`Slot ${slot} cannot be brought to the front ${side}`);
}

// A person turns the faces in front of them: U, R, F and L in their view, B or D only when nothing else works
// within the search depth (or keeps the stage boundaries clean). Among those they favour R and U, then F, and
// rarely half-turn a side face: each preferred move set wins when its solution is at most `slack` turns longer
// than the best with all four faces.
const quarterTurnsOf = (face: Face): Move[] => [face, `${face}'`];
const allTurnsOf = (face: Face): Move[] => [face, `${face}2`, `${face}'`];

function preferredMoveSets({ up, near, front, far }: PairFaces): { moves: Move[]; slack: number }[] {
  const base = [...allTurnsOf(up), ...quarterTurnsOf(near)];
  return [
    { moves: base, slack: 2 },
    { moves: [...base, ...quarterTurnsOf(front)], slack: 1 },
    { moves: [...base, ...quarterTurnsOf(front), ...quarterTurnsOf(far)], slack: 1 },
  ];
}

function attempt(
  state: CubeState,
  slot: Slot,
  keep: readonly Slot[],
  faces: PairFaces,
  lastFace: number,
  adjust: Move | "",
): Move[] | null {
  const adjusted = adjust ? applyAlg(state, [adjust]) : state;
  const avoid = adjust ? U_FACE : lastFace;
  const search = (restriction: SearchOptions, maxDepth: number): StepSolution | null =>
    solveSlots(adjusted, [slot], keep, { ...restriction, maxDepth, ...(avoid >= 0 ? { avoidFirstFace: avoid } : {}) });
  const accept = (found: StepSolution | null): Move[] | null => {
    if (!found) return null;
    const moves = simplifyMoves([...split(adjust), ...split(found.solution)]);
    if (moves.length === 0 || moveFace(moveIndex(moves[0]!)) === lastFace) return null;
    return isClean(state, moves, keep) ? moves : null;
  };
  const fourFaces = { faces: [faces.up, faces.near, faces.front, faces.far] };
  const best = search(fourFaces, MAX_PAIR_DEPTH);
  if (!best) return accept(search({}, MAX_PAIR_DEPTH));
  for (const { moves, slack } of preferredMoveSets(faces)) {
    const found = accept(search({ moves }, best.moves + slack));
    if (found) return found;
  }
  return accept(best) ?? accept(search({}, MAX_PAIR_DEPTH));
}

// People rarely find the optimal pair: they often turn U first to look at or set up the pair and only then solve
// it, which costs a move or two over the optimum. Fall back to the plain optimum when that fails.
function pairCandidate(p: Planner, slot: Slot, keep: readonly Slot[], side: Side, lastFace: number): PairCandidate | null {
  const { yTurns, faces } = placement(p.view.frame, slot, side);
  // After a rotation the first turn cannot merge with the last one, whatever its face.
  const last = yTurns === 0 ? lastFace : NO_FACE;
  const adjust = p.rng() < 0.6 ? AUFS[1 + Math.floor(p.rng() * 3)]! : "";
  const moves =
    (adjust ? attempt(p.state, slot, keep, faces, last, adjust) : null) ?? attempt(p.state, slot, keep, faces, last, "");
  if (!moves) return null;
  const cost = moves.length + ROTATION_COST[yTurns]! + (side === "left" ? LEFT_COST : 0);
  return { slot, yTurns, moves, cost };
}

/** What a person sees of a pair: pieces showing on top, and pieces stuck in another slot that must come out first. */
function pairVisibility(state: CubeState, slot: Slot): { visible: number; stuck: number } {
  const { corner, edge } = SLOT_INFO[slot];
  const cornerAt = state.cp.indexOf(corner);
  const edgeAt = state.ep.indexOf(edge);
  const visible = (cornerAt < 4 ? 1 : 0) + (edgeAt < 4 ? 1 : 0);
  const stuck = (cornerAt >= 4 && cornerAt !== corner ? 1 : 0) + (edgeAt >= 8 && edgeAt !== edge ? 1 : 0);
  return { visible, stuck };
}

// Humans favour pairs they can see and avoid digging pieces out of other slots; among those they often but not
// always take the cheapest.
function pickPair(state: CubeState, candidates: readonly PairCandidate[], rng: Rng): PairCandidate {
  const scored = candidates.map((candidate) => ({ candidate, ...pairVisibility(state, candidate.slot) }));
  const free = scored.filter(({ stuck }) => stuck === 0);
  const pool = (free.length > 0 ? free : scored)
    .map(({ candidate, visible }) => ({ candidate, score: candidate.cost - VISIBLE_BONUS * visible }))
    .sort((a, b) => a.score - b.score);
  const roll = rng();
  const index = roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
  return pool[Math.min(index, pool.length - 1)]!.candidate;
}

function lastFaceOf(segments: readonly Segment[]): number {
  const last = segments.at(-1)?.steps.findLast((step) => step.turns.length > 0)?.turns.at(-1);
  return last ? moveFace(moveIndex(last)) : NO_FACE;
}

function bestSide(p: Planner, slot: Slot, keep: readonly Slot[], lastFace: number): PairCandidate | null {
  const right = pairCandidate(p, slot, keep, "right", lastFace);
  const left = pairCandidate(p, slot, keep, "left", lastFace);
  if (!right || !left) return right ?? left;
  return left.cost < right.cost ? left : right;
}

function planPairs(p: Planner): void {
  while (solvedSlots(p.state).length < 4) {
    requireUpright(p.view.frame, "during F2L");
    const keep = solvedSlots(p.state);
    const lastFace = lastFaceOf(p.segments);
    const candidates = SLOTS.filter((slot) => !keep.includes(slot))
      .map((slot) => bestSide(p, slot, keep, lastFace))
      .filter((candidate): candidate is PairCandidate => candidate !== null);
    if (candidates.length === 0) throw new Error("Demo generator found no clean pair solution");
    const { yTurns, moves } = pickPair(p.state, candidates, p.rng);
    const rotation = Y_ROTATIONS[yTurns];
    const steps = [...(rotation ? playInView(p, rotation) : []), ...playCentreTurns(p, moves)];
    const solved = solvedSlots(p.state);
    const slots = solved.filter((slot) => !keep.includes(slot));
    p.segments.push({ kind: "pair", label: `p${solved.length}`, steps, slots });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Last layer: recognised in the solver's view and executed as written.

function planLastLayer(p: Planner, method: LastLayerMethod): void {
  requireUpright(p.view.frame, "at the last layer");
  if (method === "oll-pll") planOllPll(p);
  else planEoColl(p);
  const auf = aufToSolve(p.state);
  if (auf < 0) throw new Error("Demo generator did not reach a solved last layer");
  if (auf === 0) return;
  const steps = playCentreTurns(p, [AUFS[auf]!]);
  const last = p.segments.at(-1);
  if (last) last.steps.push(...steps);
  else p.segments.push({ kind: "epll", label: "epll", steps });
}

function planOllPll(p: Planner): void {
  const oll = recognizeCase("OLL", viewState(p));
  if (oll) {
    const alg = getCase(oll.caseId).algs[0]!;
    const steps = playInView(p, `${oll.preAuf} ${alg}`);
    p.segments.push({ kind: "oll", label: "oll", steps, caseName: getCase(oll.caseId).name });
    requireUpright(p.view.frame, `after ${alg}`);
  }
  const pll = recognizeCase("PLL", viewState(p));
  if (pll) {
    const alg = getCase(pll.caseId).algs[0]!;
    const steps = playInView(p, `${pll.preAuf} ${alg} ${pll.postAuf}`);
    p.segments.push({ kind: "pll", label: "pll", steps, caseName: getCase(pll.caseId).name });
    requireUpright(p.view.frame, `after ${alg}`);
  }
}

function planEoColl(p: Planner): void {
  const eo = recognizeEO(viewState(p));
  if (eo) {
    const steps = playInView(p, `${eo.preAuf} ${eo.alg}`);
    const kind = isSolvedUpToAuf(p.state) ? "ll" : "eo";
    p.segments.push({ kind, label: kind, steps, ...(kind === "eo" ? { caseName: eo.caseName } : {}) });
    requireUpright(p.view.frame, `after ${eo.alg}`);
  }
  const before = viewState(p);
  const coll = recognizeCOLL(before);
  if (coll) {
    const steps = playInView(p, `${coll.preAuf} ${coll.alg}`);
    // With the corners already oriented (COLL's O cases), an alg that also finishes the cube is a PLL, and the
    // analysis names it as one.
    const pll = llCornersOriented(before) && isSolvedUpToAuf(p.state) ? recognizeCase("PLL", before) : null;
    if (pll) p.segments.push({ kind: "pll", label: "pll", steps, caseName: getCase(pll.caseId).name });
    else p.segments.push({ kind: "coll", label: "coll", steps, caseName: coll.caseName });
    requireUpright(p.view.frame, `after ${coll.alg}`);
  }
  const epll = recognizeEPLL(viewState(p));
  if (epll) {
    const steps = playInView(p, `${epll.preAuf} ${epll.alg} ${epll.postAuf}`);
    p.segments.push({ kind: "epll", label: "epll", steps, caseName: epll.caseName });
    requireUpright(p.view.frame, `after ${epll.alg}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Tidying and timing

function isPlainTurn(step: Step): boolean {
  return step.turns.length === 1 && step.rotation === undefined;
}

/** Merges adjacent plain turns of one face (U U → U2, U U' → nothing); wide moves, slices and rotations stay. */
function simplifySteps(steps: readonly Step[]): Step[] {
  const out: Step[] = [];
  for (const step of steps) {
    const last = out.at(-1);
    if (!last || !isPlainTurn(last) || !isPlainTurn(step) || last.turns[0]!.charAt(0) !== step.turns[0]!.charAt(0)) {
      out.push(step);
      continue;
    }
    out.pop();
    const merged = simplifyMoves([last.turns[0]!, step.turns[0]!]);
    if (merged.length > 0) out.push({ turns: merged });
  }
  return out;
}

// A stage's milestone is reached on its last turn of anything but the U centre, so trailing U-centre turns (and
// any rotation among them) are really the next stage's: carry them over and merge them the way a person would.
function tidySegments(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  let carried: Step[] = [];
  segments.forEach((segment, i) => {
    let steps = simplifySteps([...carried, ...segment.steps]);
    carried = [];
    if (i < segments.length - 1) {
      let cut = steps.length;
      while (cut > 0 && steps[cut - 1]!.turns.every((turn) => turn.startsWith("U"))) cut--;
      carried = steps.slice(cut);
      steps = steps.slice(0, cut);
    }
    if (steps.length > 0) out.push({ ...segment, steps });
  });
  return out;
}

function timeSegments(segments: readonly Segment[], rng: Rng): DemoSolve {
  const moves: TimedMove[] = [];
  const rotations: RotationEvent[] = [];
  let t = 0;
  segments.forEach((segment, index) => {
    const pause = PAUSE_MS[segment.kind];
    if (index > 0 && pause) t += uniform(rng, ...pause);
    const gap = 1000 / uniform(rng, ...(F2L_KINDS.includes(segment.kind) ? F2L_TPS : LL_TPS));
    const { steps } = segment;
    const hesitateAt = turnCount(steps) >= 4 && rng() < 0.5 ? 1 + Math.floor(rng() * (steps.length - 1)) : -1;
    let turned = false;
    let regrip = 0;
    steps.forEach((step, i) => {
      if (step.turns.length === 0) {
        if (!step.rotation) throw new Error("A step needs turns or a rotation");
        if (turned) t += uniform(rng, ...ROTATION_MS);
        rotations.push({ rotation: step.rotation, after: moves.length, t: Math.round(t) });
        regrip = uniform(rng, ...ROTATION_MS);
        return;
      }
      if (regrip > 0) t += regrip;
      else if (turned) t += gap * uniform(rng, 0.6, 1.4);
      if (i === hesitateAt) t += uniform(rng, 500, 1000);
      regrip = 0;
      turned = true;
      step.turns.forEach((turn, k) => {
        if (k > 0) t += uniform(rng, ...SLICE_GAP_MS);
        moves.push({ move: turn, t: Math.round(t) });
      });
      if (step.rotation) rotations.push({ rotation: step.rotation, after: moves.length, t: moves.at(-1)!.t });
    });
  });
  return { moves, rotations };
}

/** The solve plus the stages the generator intended (the analysis should report exactly these). */
export function generateDemoPlan(scramble: string, seed?: number, method: LastLayerMethod = DEFAULT_LAST_LAYER): DemoSolve & { stages: DemoStage[] } {
  const rng = createRng(seed ?? hashString(scramble));
  const history = scrambleToSolverFrame(scramble);
  const p: Planner = { state: applyAlg(SOLVED, history), view: new FrameTracker(), history, segments: [], rng };
  planCross(p);
  planPairs(p);
  planLastLayer(p, method);
  if (!isSolved(p.state)) throw new Error(`Demo generator failed to solve "${scramble}"`);
  const segments = tidySegments(p.segments);
  const { moves, rotations } = timeSegments(segments, rng);
  let start = 0;
  const stages = segments.map(({ kind, label, steps, slots, caseName }) => {
    const stage: DemoStage = { kind, label, startMove: start, endMove: start + turnCount(steps) };
    if (slots) stage.slots = slots;
    if (caseName) stage.caseName = caseName;
    start = stage.endMove;
    return stage;
  });
  return { moves, rotations, stages };
}

/**
 * A plausible human CFOP solve of `scramble`: centre-frame outer turns plus the solver's rotations, timed from the
 * start (t = 0 at the first turn, or at the first rotation when the solve opens with one).
 */
export function generateDemoSolve(scramble: string, seed?: number, method: LastLayerMethod = DEFAULT_LAST_LAYER): DemoSolve {
  const { moves, rotations } = generateDemoPlan(scramble, seed, method);
  return { moves, rotations };
}
