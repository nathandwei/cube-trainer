// Last-layer case recognition for EO → COLL → EPLL. Each case is indexed by the last-layer signature of every
// state it solves (all pre-AUF and post-AUF combinations), so recognition is one map lookup.

import { SOLVED, applyAlg, invertAlg, toFaceTurns, type CubeState } from "./cubie";
import { COLL_ALGS, EO_ALGS, EPLL_ALGS, type AlgEntry } from "./ll-data";
import { AUFS, isCOLLDone, isEODone, isF2LSolved, isSolvedUpToAuf, llCornerAlignment } from "./milestones";
import type { Move } from "./types";

export type LLCase = AlgEntry & { faceTurns: Move[] };

export type LLMatch = {
  caseName: string;
  /** U turn to do before the alg ("" for none). */
  preAuf: string;
  /** The alg as written in the source dataset (may use wide and slice moves). */
  alg: string;
  /** U turn after the alg that lines up the corners (COLL) or the whole cube (EPLL); "" for EO. */
  postAuf: string;
};

function withFaceTurns(entries: readonly AlgEntry[]): LLCase[] {
  return entries.map((entry) => ({ ...entry, faceTurns: toFaceTurns(entry.alg).split(" ").filter(Boolean) }));
}

export const EO_CASES = withFaceTurns(EO_ALGS);
export const COLL_CASES = withFaceTurns(COLL_ALGS);
export const EPLL_CASES = withFaceTurns(EPLL_ALGS);

type Signature = (state: CubeState) => string;

const eoSignature: Signature = (s) => s.eo.slice(0, 4).join("");
const cornerSignature: Signature = (s) => `${s.cp.slice(0, 4).join("")}${s.co.slice(0, 4).join("")}`;
const permutationSignature: Signature = (s) => `${s.cp.slice(0, 4).join("")}${s.ep.slice(0, 4).join("")}`;

// Preferred AUF order when several work: none, then quarter turns, then a half turn.
const AUF_PREFERENCE = [0, 1, 3, 2];

function buildIndex(cases: readonly LLCase[], signature: Signature, withPostAuf: boolean): Map<string, LLMatch> {
  const index = new Map<string, LLMatch>();
  for (const pre of AUF_PREFERENCE) {
    for (const llCase of cases) {
      for (const post of withPostAuf ? AUF_PREFERENCE : [0]) {
        const sequence = [AUFS[pre], ...llCase.faceTurns, AUFS[post]].filter((m): m is Move => Boolean(m));
        const caseState = applyAlg(SOLVED, invertAlg(sequence));
        const key = signature(caseState);
        if (index.has(key)) continue;
        index.set(key, { caseName: llCase.name, preAuf: AUFS[pre]!, alg: llCase.alg, postAuf: AUFS[post]! });
      }
    }
  }
  return index;
}

let indexes: { eo: Map<string, LLMatch>; coll: Map<string, LLMatch>; epll: Map<string, LLMatch> } | undefined;

function getIndexes(): NonNullable<typeof indexes> {
  indexes ??= {
    eo: buildIndex(EO_CASES, eoSignature, false),
    coll: buildIndex(COLL_CASES, cornerSignature, true),
    epll: buildIndex(EPLL_CASES, permutationSignature, true),
  };
  return indexes;
}

/** EO case on a state with F2L solved; null when edges are already oriented or F2L is not solved. */
export function recognizeEO(state: CubeState): LLMatch | null {
  if (!isF2LSolved(state) || isEODone(state)) return null;
  return getIndexes().eo.get(eoSignature(state)) ?? null;
}

/** COLL case on a state with F2L solved and edges oriented; null when the corners are already solved. */
export function recognizeCOLL(state: CubeState): LLMatch | null {
  if (!isEODone(state) || llCornerAlignment(state) >= 0) return null;
  return getIndexes().coll.get(cornerSignature(state)) ?? null;
}

/** EPLL case once corners are solved and edges oriented; null when only an AUF (or nothing) is left. */
export function recognizeEPLL(state: CubeState): LLMatch | null {
  if (!isCOLLDone(state) || isSolvedUpToAuf(state)) return null;
  return getIndexes().epll.get(permutationSignature(state)) ?? null;
}

/** preAuf + alg + postAuf as outer face turns, for replaying a recognised case. */
export function matchFaceTurns(match: LLMatch): Move[] {
  return [match.preAuf, toFaceTurns(match.alg), match.postAuf].join(" ").split(" ").filter(Boolean);
}
