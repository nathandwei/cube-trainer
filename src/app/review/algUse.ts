// Whether he did a last-layer step with the alg he chose for its case, and if not, whether what he did instead is
// worth switching to (the fingertrick model rates it faster) or a step down (graded like any extra moves would be).

import type { Verdict } from "@/app/lib/review";
import { algMoveCount, algOptions, caseAlgSpeed, playback, turnsMatchAlg } from "@/cube";
import type { Stage, StageKind } from "@/cube/types";

const LAST_LAYER: ReadonlySet<StageKind> = new Set(["eo", "oll", "coll", "pll", "epll"]);

/** What he did has to beat his alg by this much (as a share of its time) to count as faster: the model's noise. */
const FASTER_BY = 0.03;
/** Up to this much slower than his alg (and a couple of moves over) is an inaccuracy; beyond, a mistake. */
const INACCURACY_RATIO = 1.3;
const INACCURACY_EXTRA_MOVES = 3;

export type AlgUse =
  | { caseId: string; yours: string; used: true; verdict: Verdict }
  | {
      caseId: string;
      yours: string;
      used: false;
      /** What he did, as an alg: the option it matches, else his turns as he saw them, AUFs left off. */
      did: string;
      /** It solves the case on its own, so it can become his alg. */
      switchable: boolean;
      /** The model rates it faster than his alg. */
      faster: boolean;
      verdict: Verdict;
    };

/** His alg for a case; EPLL and PLL share the U, H and Z perms, so either set's pick serves the other. */
export function yourAlg(caseId: string, algs: Readonly<Record<string, string>>): string | undefined {
  return algs[caseId] ?? algs[caseId.replace(/^EPLL-/, "PLL-")] ?? algs[caseId.replace(/^PLL-/, "EPLL-")];
}

function estimate(caseId: string, alg: string): number | null {
  try {
    return caseAlgSpeed(caseId, alg).ms;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return null;
  }
}

function solvesAlone(caseId: string, alg: string): boolean {
  try {
    playback(caseId, alg);
    return true;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return false;
  }
}

/** His turns as he saw them, without the U turns at either end (the AUFs). */
function withoutAufs(seen: readonly string[]): string {
  let start = 0;
  let end = seen.length;
  while (start < end && /^U/.test(seen[start]!)) start++;
  while (end > start && /^U/.test(seen[end - 1]!)) end--;
  return seen.slice(start, end).join(" ");
}

/**
 * How a last-layer stage went against his alg for its case. `turns` are the stage's turns as the cube reported them,
 * `seen` the same stage as he saw it (display tokens: rotations, wide moves). Null for other stages, an unknown
 * case, or a case he hasn't chosen an alg for.
 */
export function algUse(stage: Stage, caseId: string | null, algs: Readonly<Record<string, string>>, turns: readonly string[], seen: readonly string[]): AlgUse | null {
  if (!caseId || !LAST_LAYER.has(stage.kind)) return null;
  const yours = yourAlg(caseId, algs);
  if (!yours) return null;
  if (turnsMatchAlg(turns, yours)) return { caseId, yours, used: true, verdict: "best" };
  const known = algOptions(caseId).find((option) => turnsMatchAlg(turns, option.alg))?.alg;
  const did = known ?? withoutAufs(seen);
  const switchable = known !== undefined || solvesAlone(caseId, did);
  const didMs = switchable ? estimate(caseId, did) : null;
  const yoursMs = estimate(caseId, yours);
  const faster = didMs !== null && yoursMs !== null && didMs < yoursMs * (1 - FASTER_BY);
  if (faster) return { caseId, yours, used: false, did, switchable, faster, verdict: "excellent" };
  const ratio = didMs !== null && yoursMs !== null ? didMs / yoursMs : Infinity;
  const extraMoves = stage.moveCount - algMoveCount(yours);
  const close = ratio <= INACCURACY_RATIO && extraMoves <= INACCURACY_EXTRA_MOVES;
  return { caseId, yours, used: false, did, switchable, faster, verdict: close ? "inaccuracy" : "mistake" };
}
