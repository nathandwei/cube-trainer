// Whether he did a last-layer step with the alg he chose for its case, and if not, whether what he did instead is
// worth switching to (the fingertrick model rates it faster) or a step down (graded like any extra moves would be).

import type { Verdict } from "@/app/lib/review";
import { algOptions, caseAlgSpeed, playback, toFaceTurns, turnsMatchAlg } from "@/cube";
import type { Stage, StageKind } from "@/cube/types";

const LAST_LAYER: ReadonlySet<StageKind> = new Set(["eo", "oll", "coll", "pll", "epll"]);

/** What he did has to beat his alg by this much (as a share of its time) to count as faster: the model's noise. */
const FASTER_BY = 0.03;
/**
 * Another real alg up to this much slower than his is an inaccuracy, beyond a mistake. Turns that are no alg on their
 * own (a mistake fixed on the way) are judged by outer turns over his alg's: up to INACCURACY_EXTRA_TURNS.
 */
const INACCURACY_RATIO = 1.3;
const INACCURACY_EXTRA_TURNS = 3;

/** `storedId`: the case id his alg is saved under (a PLL pick serves the EPLL case too), where a switch saves. */
export type AlgUse =
  | { caseId: string; storedId: string; yours: string; used: true; verdict: Verdict }
  | {
      caseId: string;
      storedId: string;
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

/** His alg for a case and the id it's saved under; EPLL and PLL share the U, H and Z perms, so either set's pick serves the other. */
export function yourAlg(caseId: string, algs: Readonly<Record<string, string>>): { id: string; alg: string } | undefined {
  for (const id of [caseId, caseId.replace(/^EPLL-/, "PLL-"), caseId.replace(/^PLL-/, "EPLL-")]) {
    const alg = algs[id];
    if (alg) return { id, alg };
  }
  return undefined;
}

/** Outer turns, U turns at either end (the AUFs) left off. */
function outerTurns(turns: readonly string[]): number {
  let start = 0;
  let end = turns.length;
  while (start < end && /^U/.test(turns[start]!)) start++;
  while (end > start && /^U/.test(turns[end - 1]!)) end--;
  return end - start;
}

function outerTurnsOf(alg: string): number | null {
  try {
    return outerTurns(toFaceTurns(alg).split(" ").filter(Boolean));
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    return null;
  }
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
  const stored = yourAlg(caseId, algs);
  if (!stored) return null;
  const { id: storedId, alg: yours } = stored;
  if (turnsMatchAlg(turns, yours)) return { caseId, storedId, yours, used: true, verdict: "best" };
  const known = algOptions(caseId).find((option) => turnsMatchAlg(turns, option.alg))?.alg;
  const did = known ?? withoutAufs(seen);
  const switchable = known !== undefined || solvesAlone(caseId, did);
  const didMs = switchable ? estimate(caseId, did) : null;
  const yoursMs = estimate(caseId, yours);
  const faster = didMs !== null && yoursMs !== null && didMs < yoursMs * (1 - FASTER_BY);
  if (faster) return { caseId, storedId, yours, used: false, did, switchable, faster, verdict: "excellent" };
  // Two real algs differ in moves for good reasons (an M-slice Ua is 7 moves, the RU one 13): only time counts.
  // Turns that are no alg on their own are counted against his alg, both as outer turns without AUFs.
  const yourTurns = outerTurnsOf(yours);
  const close = switchable
    ? didMs !== null && yoursMs !== null && didMs / yoursMs <= INACCURACY_RATIO
    : yourTurns !== null && outerTurns(turns) - yourTurns <= INACCURACY_EXTRA_TURNS;
  return { caseId, storedId, yours, used: false, did, switchable, faster, verdict: close ? "inaccuracy" : "mistake" };
}
