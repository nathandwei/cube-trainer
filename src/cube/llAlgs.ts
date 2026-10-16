// Which kind of last-layer alg a stretch of turns was: EO, OLL, COLL, PLL or EPLL.
//
// A stretch is matched by its effect on the cube, so how the turns came out (a regrip, R R merged into R2, a U turn
// before or after) doesn't matter: two stretches with the same effect up to U turns either side are the same alg.
// That is what tells a COLL from an OCLL that happens to solve the corners as well: both leave the corners solved,
// but they move the edges differently. Algs come from the case catalog (with their mirrors) and his own picks.

import { CASES_BY_ID, CASE_SETS, type CaseSetId } from "./cases";
import { MOVE_CUBIES, SOLVED, moveIndex, multiply, stateKey, toFaceTurns, type CubeState } from "./cubie";
import { mirrorAlg } from "./mirror";
import type { Move } from "./types";

export type LLSet = Exclude<CaseSetId, "F2L">;

const LL_SETS: ReadonlySet<CaseSetId> = new Set<CaseSetId>(["EO", "OLL", "COLL", "PLL", "EPLL"]);

function isLLSet(set: CaseSetId): set is LLSet {
  return LL_SETS.has(set);
}

/** Canonical effect → every set with an alg of that effect (Sune is an OLL alg and a COLL alg). */
export type AlgIndex = ReadonlyMap<string, ReadonlySet<LLSet>>;

const U_TURNS: readonly CubeState[] = [SOLVED, ...["U", "U2", "U'"].map((move) => MOVE_CUBIES[moveIndex(move)]!)];

function effectOf(moves: readonly Move[]): CubeState {
  return moves.reduce<CubeState>((state, move) => multiply(state, MOVE_CUBIES[moveIndex(move)]!), SOLVED);
}

/** One key for an effect and every version of it with U turns before and after. */
function canonicalKey(effect: CubeState): string {
  let best: string | undefined;
  for (const before of U_TURNS) {
    const turned = multiply(before, effect);
    for (const after of U_TURNS) {
      const key = stateKey(multiply(turned, after));
      if (best === undefined || key < best) best = key;
    }
  }
  return best!;
}

const IDENTITY_KEY = canonicalKey(SOLVED);

function add(index: Map<string, Set<LLSet>>, set: LLSet, alg: string): void {
  const key = canonicalKey(effectOf(toFaceTurns(alg).split(" ").filter(Boolean)));
  const sets = index.get(key);
  if (sets) sets.add(set);
  else index.set(key, new Set([set]));
}

let catalog: Map<string, Set<LLSet>> | undefined;

function catalogIndex(): Map<string, Set<LLSet>> {
  if (catalog) return catalog;
  const index = new Map<string, Set<LLSet>>();
  for (const caseSet of CASE_SETS) {
    if (!isLLSet(caseSet.id)) continue;
    for (const caseDef of caseSet.cases) {
      for (const alg of caseDef.algs) {
        add(index, caseSet.id, alg);
        // A mirrored alg is still an alg of its set (Sune's mirror solves Antisune), so a left-handed
        // version of a known alg is recognised too.
        add(index, caseSet.id, mirrorAlg(alg));
      }
    }
  }
  catalog = index;
  return index;
}

let own: { key: string; index: AlgIndex } | undefined;

/**
 * The catalog's algs plus his own picks (`algs`: case id → alg, as stored in his learn settings). An alg that no
 * longer parses (or belongs to no last-layer case) is left out rather than breaking a review.
 */
export function algIndex(algs: Readonly<Record<string, string>> = {}): AlgIndex {
  const entries = Object.entries(algs)
    .flatMap(([caseId, alg]) => {
      const set = CASES_BY_ID.get(caseId)?.set;
      return set && isLLSet(set) ? [[set, alg] as const] : [];
    })
    .sort(([a, x], [b, y]) => (a + x < b + y ? -1 : 1));
  if (entries.length === 0) return catalogIndex();
  const key = JSON.stringify(entries);
  if (own?.key === key) return own.index;
  const index = new Map([...catalogIndex()].map(([effect, sets]) => [effect, new Set(sets)]));
  for (const [set, alg] of entries) {
    try {
      add(index, set, alg);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      // An unparsable stored alg only means it can't be recognised; the catalog still is.
      continue;
    }
  }
  own = { key, index };
  return index;
}

function setsOf(effect: CubeState, index: AlgIndex): ReadonlySet<LLSet> | undefined {
  const key = canonicalKey(effect);
  return key === IDENTITY_KEY ? undefined : index.get(key);
}

const TURNS: readonly CubeState[] = MOVE_CUBIES;
const INVERSE_TURNS: readonly CubeState[] = MOVE_CUBIES.map((_, i) => MOVE_CUBIES[i - (i % 3) + 2 - (i % 3)]!);

/**
 * The algs a stretch of turns was, in order: one alg, or two in a row (a dot's two EO algs, a two-look step), each
 * as the sets it belongs to. Null when the stretch is neither one nor two known algs (a mistake fixed on the way, an
 * alg not in the catalog). See splitAlgs for how two are found.
 */
export function recognizeAlgs(moves: readonly Move[], index: AlgIndex, times?: readonly number[]): ReadonlySet<LLSet>[] | null {
  const whole = setsOf(effectOf(moves), index);
  return whole ? [whole] : splitAlgs(moves, index, times);
}

/**
 * The stretch as two known algs in a row, or null. Where they meet their turns may have run together (the first's R'
 * and the second's R cancelled, or U U done as U2), so a split may also hand one turn's worth to each side. With
 * `times` (ms, one per turn) it splits at the longest pause between turns, where he stopped to look.
 */
export function splitAlgs(moves: readonly Move[], index: AlgIndex, times?: readonly number[]): ReadonlySet<LLSet>[] | null {
  const cubies = moves.map((move) => MOVE_CUBIES[moveIndex(move)]!);
  const prefixes = [SOLVED];
  for (const cubie of cubies) prefixes.push(multiply(prefixes.at(-1)!, cubie));
  const suffixes = [SOLVED];
  for (let i = cubies.length - 1; i >= 0; i--) suffixes.unshift(multiply(cubies[i]!, suffixes[0]!));
  let best: { sets: ReadonlySet<LLSet>[]; gap: number; bridged: boolean } | null = null;
  for (let split = 1; split < moves.length; split++) {
    const gap = times ? times[split]! - times[split - 1]! : 0;
    if (best && (gap < best.gap || (gap === best.gap && !best.bridged))) continue;
    for (let bridge = -1; bridge < TURNS.length; bridge++) {
      const first = setsOf(bridge < 0 ? prefixes[split]! : multiply(prefixes[split]!, TURNS[bridge]!), index);
      if (!first) continue;
      const second = setsOf(bridge < 0 ? suffixes[split]! : multiply(INVERSE_TURNS[bridge]!, suffixes[split]!), index);
      if (!second) continue;
      best = { sets: [first, second], gap, bridged: bridge >= 0 };
      break;
    }
  }
  return best?.sets ?? null;
}

