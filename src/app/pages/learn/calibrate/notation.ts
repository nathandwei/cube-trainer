// A recorded take written as an alg.
//
// The smart cube reports outer turns against its centres, two quarter turns for a half turn and two outer turns for a
// slice, and the gyro adds when the cube turned in his hands. The solve review already rewrites such a stream the way
// he would write it (src/app/lib/display.ts); this adds what an alg needs on top: no fumbles (R R' is nothing, a slow
// R R is R2), and no lining up. A scrambled cube shows the case behind a random U turn, and he may turn any case
// round before starting, so the U turns (and, on the last layer, the y regrips) before his first real turn only line
// the case up; the alg is written against the catalog's case instead.

import { displayTokens } from "@/app/lib/display";
import { FrameTracker, algMoveCount, applyAlg, caseState, getCase, isGoalReached, normalizeStream, type CaseDef, type CubeState } from "@/cube";
import type { RotationEvent, SolveSource, TimedMove } from "@/cube/types";

/**
 * Turns on the take's clock (ms from the first turn) and the rotations between them, as a solve stores them;
 * `source` "smartcube" when turned on the cube (its rotations from the gyro), not played by Test.
 */
export type Take = { moves: readonly TimedMove[]; rotations: readonly RotationEvent[]; source?: SolveSource };

const TOKEN = /^([URFDLBMESurfdlbxyz])(2|')?$/;
const SUFFIX = ["", "", "2", "'"] as const;
const AUF = /^U(2|')?$/;
const Y_ROTATION = /^y(2|')?$/;
const ROTATION = /^[xyz](2|')?$/;
const PRE_AUFS = ["", "U", "U'", "U2"] as const;

function quarters(suffix: string | undefined): number {
  return suffix === "2" ? 2 : suffix === "'" ? 3 : 1;
}

/** Adjacent moves of one kind added up: R R → R2, R R' → nothing, y y → y2. */
export function tidy(tokens: readonly string[]): string[] {
  const out: { letter: string; amount: number }[] = [];
  for (const token of tokens) {
    const match = TOKEN.exec(token);
    if (!match) throw new Error(`Not a move: "${token}"`);
    const letter = match[1]!;
    const last = out.at(-1);
    if (last?.letter !== letter) {
      out.push({ letter, amount: quarters(match[2]) });
      continue;
    }
    last.amount = (last.amount + quarters(match[2])) % 4;
    if (last.amount === 0) out.pop();
  }
  return out.map(({ letter, amount }) => letter + SUFFIX[amount]);
}

/** The take as he did it: half turns, slices, wide moves and rotations, each named in his view at the time. */
export function takeTokens(take: Take): string[] {
  const merged = normalizeStream(take.moves, take.rotations);
  return tidy(displayTokens({ ...merged, source: take.source }, undefined).map((token) => token.text));
}

/** Moves in the slice turn metric, as the catalog counts them (rotations are free). */
export function moveCount(tokens: readonly string[]): number {
  return tokens.length === 0 ? 0 : algMoveCount(tokens.join(" "));
}

/** The centre-frame turns of moves written in the solver's view, starting from the solver's grip. */
function centreTurns(tokens: readonly string[]): string[] {
  const view = new FrameTracker();
  return tokens.flatMap((token) => view.apply(token).turns);
}

function reachesGoal(caseDef: CaseDef, from: CubeState, tokens: readonly string[]): boolean {
  return isGoalReached(caseDef.set, applyAlg(from, centreTurns(tokens)));
}

/**
 * The take as an alg for the case, written from the angle the catalog draws the case at:
 * - The U turns before his first other move are replaced by the one U turn (or none) after which the rest solves the
 *   catalog's case, so the alg solves the case as drawn, as the catalog's own algs do (COLL's start with their AUF).
 * - Last-layer sets: a y before his first other move goes too. The last layer looks the same from any side, so a y
 *   there only lines the case up, like a U turn.
 * - F2L: a y in front stays, since it picks which slot faces him.
 * Rotations after the last turn are dropped. A take that, read this way, doesn't solve the catalog's case is
 * returned as it was done rather than rewritten into something wrong.
 */
export function asAlg(caseId: string, tokens: readonly string[]): string[] {
  const caseDef = getCase(caseId);
  let end = tokens.length;
  while (end > 0 && ROTATION.test(tokens[end - 1]!)) end--;
  const done = tokens.slice(0, end);
  let lead = 0;
  while (lead < done.length && (AUF.test(done[lead]!) || Y_ROTATION.test(done[lead]!))) lead++;
  const body = done.slice(lead);
  const regrip = caseDef.set === "F2L" ? tidy(done.slice(0, lead).filter((token) => Y_ROTATION.test(token))) : [];
  const start = caseState(caseId);
  for (const auf of PRE_AUFS) {
    const line = [...regrip, ...(auf ? [auf] : []), ...body];
    if (reachesGoal(caseDef, start, line)) return line;
  }
  return [...done];
}

/**
 * Test takes: the case's default alg after whichever U turn the cube in front of him needs, as moves in his view.
 * Null when no U turn makes it solve (the catalog would be wrong).
 */
export function testLine(caseId: string, from: CubeState): string[] | null {
  const caseDef = getCase(caseId);
  const alg = caseDef.algs[0]!.replace(/[()[\]]/g, " ").split(/\s+/).filter(Boolean);
  for (const auf of PRE_AUFS) {
    const line = auf ? [auf, ...alg] : alg;
    if (reachesGoal(caseDef, from, line)) return line;
  }
  return null;
}
