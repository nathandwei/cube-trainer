// The case catalog for drills: every case of each set with its algs, the state it describes, and recognition of
// a case (with its AUFs) from a cube state.
//
// A case is defined by its default alg (algs[0]): the case state is that alg's inverse applied to a solved cube.
// Each set has a goal, and an alg solves a case when, after a pre-AUF if needed, it takes the case state to the goal:
// - PLL, EPLL: solved up to a U turn.
// - OLL: F2L solved and every last-layer piece oriented.
// - COLL: F2L solved, last-layer edges oriented, last-layer corners solved relative to each other.
// - EO: F2L solved and every last-layer edge oriented.
// - F2L: the cross and all four slots solved. Only the front-right pair is ever unsolved in an F2L case state, so
//   this means the alg inserts that pair without disturbing the cross or the other slots; it may leave the last
//   layer (the U-layer pieces) in any state.
// All states are in the solver frame (cross on D, last layer on U), see types.ts.

import { algMoveCount, isSameAlg } from "./algs";
import { SOLVED, applyAlg, invertAlg, toFaceTurns, type CubeState } from "./cubie";
import { F2L_DATA } from "./f2l-data";
import {
  buildIndex,
  permutationSignature,
  recognizeCOLL,
  recognizeEO,
  recognizeEPLL,
  type LLMatch,
  type Signature,
} from "./ll";
import { COLL_ALGS, COLL_ALTERNATIVES, EO_ALGS, EO_ALTERNATIVES, EPLL_ALGS, type CaseData } from "./ll-data";
import {
  AUFS,
  aufToSolve,
  isCOLLDone,
  isEODone,
  isF2LSolved,
  isOLLDone,
  isSolvedUpToAuf,
  llCornerAlignment,
  llCornersOriented,
  llEdgesOriented,
} from "./milestones";
import { OLL_DATA } from "./oll-data";
import { SLOT_INFO, cornerState, edgeState, isCrossSolved, isSlotSolved } from "./pieces";
import { PLL_DATA } from "./pll-data";
import type { Move } from "./types";

export type CaseSetId = "PLL" | "OLL" | "COLL" | "EPLL" | "EO" | "F2L";

export type CaseDef = {
  /** "PLL-Ga", "OLL-27", "COLL-T3", "COLL-O-adj", "EPLL-Ua", "EO-line", "F2L-12". */
  id: string;
  set: CaseSetId;
  /** The dataset's name within the set: "Ga", "27", "T3", "line", "12". */
  name: string;
  /** For display: "Ga perm", "OLL 27", "COLL T3", "EO line", "F2L 12". */
  label: string;
  /** Subset within the set: "G perms", "Dot", "Sune", "Connected", ... */
  group: string;
  /** OLL only: the case's common nickname ("Sune"), when it has a suitable one. */
  nickname?: string;
  /** 1–4 algs in dataset order; algs[0] is the default and defines the case. Wide moves, slices, rotations OK. */
  algs: readonly string[];
  /** Slice-turn-metric length of each alg (see algMoveCount). */
  moves: readonly number[];
  /** Outer face turns (solver frame) that set the case up from solved: the inverse of algs[0]. */
  setup: string;
};

export type CaseSet = {
  id: CaseSetId;
  /** One line on what the set's algs achieve. */
  description: string;
  cases: readonly CaseDef[];
};

/** U turn before an alg (pre) and after it (post), "" for none; post is always "" for OLL, EO and F2L. */
export type CaseMatch = { caseId: string; preAuf: string; postAuf: string };

const SET_DESCRIPTIONS: Record<CaseSetId, string> = {
  PLL: "Permute the last layer: from an oriented last layer to solved, up to a U turn.",
  OLL: "Orient the last layer: every last-layer piece ends up facing up, F2L kept.",
  COLL: "With last-layer edges oriented, orient and permute the corners in one alg, leaving only the edges.",
  EPLL: "Permute the last-layer edges once the corners are solved.",
  EO: "Orient the last-layer edges (first look of 2-look OLL).",
  F2L: "Insert the front-right pair with the cross and the other three slots solved; the last layer may change.",
};

function label(set: CaseSetId, name: string): string {
  return set === "PLL" || set === "EPLL" ? `${name} perm` : `${set} ${name}`;
}

function defineCase(set: CaseSetId, data: CaseData): CaseDef {
  const [first] = data.algs;
  if (first === undefined) throw new Error(`${set} ${data.name} has no algs`);
  return {
    id: `${set}-${data.name}`,
    set,
    name: data.name,
    label: label(set, data.name),
    group: data.group,
    ...(data.nickname === undefined ? {} : { nickname: data.nickname }),
    algs: data.algs,
    moves: data.algs.map(algMoveCount),
    setup: invertAlg(toFaceTurns(first)).join(" "),
  };
}

function collData(): CaseData[] {
  return COLL_ALGS.map(({ name, alg, subset }) => {
    if (subset === undefined) throw new Error(`COLL ${name} has no subset`);
    return { name, group: subset, algs: [alg, ...(COLL_ALTERNATIVES[name] ?? [])] };
  });
}

function eoData(): CaseData[] {
  return EO_ALGS.map(({ name, alg }) => ({
    name,
    group: "Edge orientation",
    algs: [alg, ...(EO_ALTERNATIVES[name] ?? [])],
  }));
}

// EPLL keeps ll-data's default (what the solve analysis recognises) and borrows the other PLL algs for the case.
function epllData(): CaseData[] {
  return EPLL_ALGS.map(({ name, alg }) => {
    const pll = PLL_DATA.find((entry) => entry.name === name);
    if (!pll) throw new Error(`No PLL entry for EPLL ${name}`);
    return { name, group: "Edge perms", algs: [alg, ...pll.algs.filter((other) => !isSameAlg(other, alg))] };
  });
}

function defineSet(id: CaseSetId, data: readonly CaseData[]): CaseSet {
  return { id, description: SET_DESCRIPTIONS[id], cases: data.map((entry) => defineCase(id, entry)) };
}

export const CASE_SETS: readonly CaseSet[] = [
  defineSet("PLL", PLL_DATA),
  defineSet("OLL", OLL_DATA),
  defineSet("COLL", collData()),
  defineSet("EPLL", epllData()),
  defineSet("EO", eoData()),
  defineSet("F2L", F2L_DATA),
];

export const CASES_BY_ID: ReadonlyMap<string, CaseDef> = new Map(
  CASE_SETS.flatMap((set) => set.cases.map((caseDef) => [caseDef.id, caseDef] as const)),
);

export function getCase(caseId: string): CaseDef {
  const caseDef = CASES_BY_ID.get(caseId);
  if (!caseDef) throw new Error(`Unknown case "${caseId}"`);
  return caseDef;
}

export function getCaseSet(set: CaseSetId): CaseSet {
  const found = CASE_SETS.find((candidate) => candidate.id === set);
  if (!found) throw new Error(`Unknown case set "${set}"`);
  return found;
}

function faceTurnList(alg: string): Move[] {
  return toFaceTurns(alg).split(" ").filter(Boolean);
}

/** The case's state: its default alg's inverse applied to a solved cube. */
export function caseState(caseId: string): CubeState {
  return applyAlg(SOLVED, getCase(caseId).setup);
}

const GOALS: Record<CaseSetId, (state: CubeState) => boolean> = {
  PLL: isSolvedUpToAuf,
  EPLL: isSolvedUpToAuf,
  OLL: isOLLDone,
  COLL: isCOLLDone,
  EO: isEODone,
  F2L: isF2LSolved,
};

/** True when `state` meets what the set's algs achieve (see the top of this file). */
export function isGoalReached(set: CaseSetId, state: CubeState): boolean {
  return GOALS[set](state);
}

// ---------------------------------------------------------------------------------------------------------------
// Recognition

const FR = SLOT_INFO.FR;
const OTHER_SLOTS = ["FL", "BL", "BR"] as const;

const orientationSignature: Signature = (s) => `${s.co.slice(0, 4).join("")}${s.eo.slice(0, 4).join("")}`;
const pairSignature: Signature = (s) => `${cornerState(s, FR.corner)}.${edgeState(s, FR.edge)}`;

function isPLLState(state: CubeState): boolean {
  return isOLLDone(state) && !isSolvedUpToAuf(state);
}

function isOLLState(state: CubeState): boolean {
  return isF2LSolved(state) && !(llCornersOriented(state) && llEdgesOriented(state));
}

function isF2LState(state: CubeState): boolean {
  return isCrossSolved(state) && OTHER_SLOTS.every((slot) => isSlotSolved(state, slot)) && !isSlotSolved(state, "FR");
}

type OwnIndex = { signature: Signature; accepts: (state: CubeState) => boolean; index: Map<string, LLMatch> };

let ownIndexes: Record<"PLL" | "OLL" | "F2L", OwnIndex> | undefined;

function indexFor(set: "PLL" | "OLL" | "F2L", signature: Signature, accepts: (state: CubeState) => boolean): OwnIndex {
  const entries = getCaseSet(set).cases.map((caseDef) => ({
    name: caseDef.id,
    alg: caseDef.algs[0]!,
    faceTurns: faceTurnList(caseDef.algs[0]!),
  }));
  return { signature, accepts, index: buildIndex(entries, signature, set === "PLL") };
}

function getOwnIndexes(): NonNullable<typeof ownIndexes> {
  ownIndexes ??= {
    PLL: indexFor("PLL", permutationSignature, isPLLState),
    OLL: indexFor("OLL", orientationSignature, isOLLState),
    F2L: indexFor("F2L", pairSignature, isF2LState),
  };
  return ownIndexes;
}

function toCaseMatch(set: CaseSetId, match: LLMatch | null | undefined, ownId: boolean): CaseMatch | null {
  if (!match) return null;
  return { caseId: ownId ? match.caseName : `${set}-${match.caseName}`, preAuf: match.preAuf, postAuf: match.postAuf };
}

function recognizeDefault(set: CaseSetId, state: CubeState): CaseMatch | null {
  switch (set) {
    case "COLL":
      return toCaseMatch(set, recognizeCOLL(state), false);
    case "EO":
      return toCaseMatch(set, recognizeEO(state), false);
    case "EPLL":
      return toCaseMatch(set, recognizeEPLL(state), false);
    case "PLL":
    case "OLL":
    case "F2L": {
      const { signature, accepts, index } = getOwnIndexes()[set];
      if (!accepts(state)) return null;
      return toCaseMatch(set, index.get(signature(state)), true);
    }
  }
}

function postAufAfter(set: CaseSetId, state: CubeState): string {
  switch (set) {
    case "PLL":
    case "EPLL":
      return AUFS[aufToSolve(state)] ?? "";
    case "COLL":
      return AUFS[llCornerAlignment(state)] ?? "";
    default:
      return "";
  }
}

// Preferred AUF order when several work, as in ll.ts: none, then quarter turns, then a half turn.
const PRE_AUFS = ["", "U", "U'", "U2"] as const;

/**
 * The case `state` shows within `set`, with the U turns that make algs[algIndex] solve it: preAuf before the alg,
 * postAuf after it (PLL and EPLL: to finish the solve; COLL: to line up the corners). Null when the state is not
 * a case of the set (its precondition fails, e.g. F2L broken for an LL set, or nothing is left to do).
 * Preconditions: PLL — OLL done; OLL — F2L solved; COLL — EO done; EPLL — COLL done; EO — F2L solved;
 * F2L — cross and the FL, BL, BR slots solved with FR unsolved.
 */
export function recognizeCase(set: CaseSetId, state: CubeState, algIndex = 0): CaseMatch | null {
  const match = recognizeDefault(set, state);
  if (!match || algIndex === 0) return match;
  const alg = getCase(match.caseId).algs[algIndex];
  if (alg === undefined) throw new RangeError(`${match.caseId} has no alg ${algIndex}`);
  const turns = faceTurnList(alg);
  for (const preAuf of PRE_AUFS) {
    const after = applyAlg(state, preAuf ? [preAuf, ...turns] : turns);
    if (GOALS[set](after)) return { caseId: match.caseId, preAuf, postAuf: postAufAfter(set, after) };
  }
  throw new Error(`${match.caseId} alg ${algIndex} ("${alg}") does not solve its case`);
}

// ---------------------------------------------------------------------------------------------------------------
// Alg suggestions

/**
 * fasterAlg's thresholds. An alternative is suggested only when it is clearly shorter than the alg in use (at
 * least `minFewerMoves` fewer moves and at most `maxMoveRatio` of its length) and, run at the solver's usual turn
 * speed, it would beat the measured execution by at least `minTimeSaving` (a fraction of the measured time).
 */
export const FASTER_ALG_RULES = { minFewerMoves: 2, maxMoveRatio: 0.85, minTimeSaving: 0.2 } as const;

export type AlgSuggestion = {
  alg: string;
  algIndex: number;
  moves: number;
  /** Moves in the alg in use. */
  currentMoves: number;
  /** How long the suggested alg should take at the given turn speed. */
  predictedMs: number;
  /** measuredMs - predictedMs. */
  savedMs: number;
};

/**
 * Suggests a shorter alg for a case when the one in use (`currentAlg`, default algs[0]) is slow for this solver:
 * `measuredMs` is how long they took to execute the case and `tps` their usual turns per second. Picks the shortest
 * alternative that passes FASTER_ALG_RULES (dataset order breaks ties); null when none does, which includes a
 * solver who is already quick with a long alg, and a case whose alternatives are no shorter.
 */
export function fasterAlg(caseId: string, measuredMs: number, tps: number, currentAlg?: string): AlgSuggestion | null {
  if (!Number.isFinite(measuredMs) || measuredMs <= 0) {
    throw new RangeError(`measuredMs must be positive: ${measuredMs}`);
  }
  if (!Number.isFinite(tps) || tps <= 0) throw new RangeError(`tps must be positive: ${tps}`);
  const caseDef = getCase(caseId);
  const current = currentAlg ?? caseDef.algs[0]!;
  const currentMoves = algMoveCount(current);
  const { minFewerMoves, maxMoveRatio, minTimeSaving } = FASTER_ALG_RULES;
  let best: AlgSuggestion | null = null;
  for (const [algIndex, alg] of caseDef.algs.entries()) {
    const moves = caseDef.moves[algIndex]!;
    if (isSameAlg(alg, current)) continue;
    if (moves > currentMoves - minFewerMoves || moves > currentMoves * maxMoveRatio) continue;
    const predictedMs = (moves / tps) * 1000;
    if (predictedMs > measuredMs * (1 - minTimeSaving)) continue;
    if (best && moves >= best.moves) continue;
    best = { alg, algIndex, moves, currentMoves, predictedMs, savedMs: measuredMs - predictedMs };
  }
  return best;
}
