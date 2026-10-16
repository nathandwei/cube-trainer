// Display notation for a recorded solve.
//
// A smart cube reports outer turns relative to its centres: a slice M arrives as R and L', a wide r as L, and every
// later turn is named after centres that have since moved. Its gyro (or the demo generator) adds RotationEvents:
// how the cube, and so its centres, turned in the solver's hands. humanize() rewrites the stream the way the
// solver would write it, naming each turn in the view they had at the time.

import { FACES, expandMove, faceTurnName, rotationName, type Face } from "./cubie";
import { FrameTracker, parseRotation } from "./frame";
import type { Move, Rotation, RotationEvent, Stage, TimedMove } from "./types";

/**
 * One move as the solver would write it.
 * - kind "turn": an outer turn, half turn, wide move or slice ("R", "U2", "r'", "M2"), standing for the reported
 *   turns moves[start, end).
 * - kind "rotation": a whole-cube rotation ("y") that happened after `start` reported turns; start = end, since it
 *   stands for no reported turn.
 * A token belongs to the stage that contains `start`. The texts in order, after the scramble and "z2", replay the
 * solve in cubing.js, rotations included, so the cube ends solved in the solver's final grip.
 */
export type DisplayToken = { kind: "turn" | "rotation"; text: string; start: number; end: number };

/** A rotation event this close (ms) to the turn it follows is read as part of that turn: a wide move or a slice. */
export const ROTATION_MERGE_MS = 100;
/** The two outer turns of a slice arrive within this many ms of each other (a smart cube sends them ~10–30 ms apart). */
export const SLICE_PAIR_MS = 50;

type Combined = { text: string; rotation: Rotation };

const COMBINED_FAMILIES = ["r", "l", "u", "d", "f", "b", "M", "E", "S"] as const;
const SLICE_FAMILIES: readonly string[] = ["M", "E", "S"];
const AMOUNT_SUFFIXES = ["", "2", "'"] as const;

/** The view-named turns of a wide move or slice, in a fixed face order so either reporting order matches. */
function turnsKey(turns: readonly Move[]): string {
  const rank = (turn: Move): number => FACES.indexOf(turn.charAt(0) as Face);
  return [...turns].sort((a, b) => rank(a) - rank(b)).join(" ");
}

function buildCombined(): { withRotation: Map<string, Combined>; slicePairs: Map<string, Combined> } {
  const withRotation = new Map<string, Combined>();
  const slicePairs = new Map<string, Combined>();
  for (const family of COMBINED_FAMILIES) {
    for (const amount of [1, 2, 3]) {
      const { turns, rotation } = expandMove(family, amount);
      if (!rotation) throw new Error(`${family} should carry a rotation`);
      const combined = { text: family + AMOUNT_SUFFIXES[amount - 1], rotation: rotationName(...rotation) };
      const key = turnsKey(turns.map(([face, turnAmount]) => faceTurnName(face, turnAmount)));
      withRotation.set(`${key}|${combined.rotation}`, combined);
      if (SLICE_FAMILIES.includes(family)) slicePairs.set(key, combined);
    }
  }
  return { withRotation, slicePairs };
}

const { withRotation: COMBINED, slicePairs: SLICE_PAIRS } = buildCombined();

function isQuarter(move: Move): boolean {
  return move.length === 1 || move.endsWith("'");
}

function turnToken(text: string, start: number, end: number): DisplayToken {
  return { kind: "turn", text, start, end };
}

function validate(moves: readonly TimedMove[], rotations: readonly RotationEvent[]): void {
  rotations.forEach(({ after }, i) => {
    if (!Number.isInteger(after) || after < 0 || after > moves.length) {
      throw new Error(`Rotation ${i} sits after ${after} turns, outside 0..${moves.length}`);
    }
    if (i > 0 && after < rotations[i - 1]!.after) throw new Error(`Rotation ${i} is out of order`);
  });
}

/**
 * Rewrites a reported solve for display.
 *
 * With rotation events: turns are named in the view the solver had at the time; a turn (or a pair of opposite
 * turns at most SLICE_PAIR_MS apart) followed, at the same `after` and within ROTATION_MERGE_MS, by the rotation a
 * wide move or slice carries becomes that move ("r", "M2"); any other rotation event becomes a rotation token ("y").
 * Without any (old solves, a virtual cube without rotation keys): today's inference, where two turns that
 * `mergeable(i)` allows to be read together become a slice when they are an opposite pair (R L' → M).
 * Either way two equal quarter turns that `mergeable(i)` allows become a half turn (R R → R2).
 * `mergeable(i)` is asked about reported turns i and i + 1 (e.g. "they arrived within 60 ms, in one stage").
 */
export function humanize(
  moves: readonly TimedMove[],
  rotations: readonly RotationEvent[],
  mergeable: (i: number) => boolean,
): DisplayToken[] {
  validate(moves, rotations);
  return rotations.length === 0 ? humanizeTurns(moves, mergeable) : humanizeWithRotations(moves, rotations, mergeable);
}

function humanizeTurns(moves: readonly TimedMove[], mergeable: (i: number) => boolean): DisplayToken[] {
  const view = new FrameTracker();
  const out: DisplayToken[] = [];
  for (let i = 0; i < moves.length; i++) {
    const current = view.name(moves[i]!.move);
    const next = moves[i + 1];
    if (next === undefined || !mergeable(i)) {
      out.push(turnToken(current, i, i + 1));
      continue;
    }
    const following = view.name(next.move);
    if (isQuarter(current) && following === current) {
      out.push(turnToken(`${current.charAt(0)}2`, i, i + 2));
      i++;
      continue;
    }
    const slice = SLICE_PAIRS.get(turnsKey([current, following]));
    if (!slice) {
      out.push(turnToken(current, i, i + 1));
      continue;
    }
    out.push(turnToken(slice.text, i, i + 2));
    view.rotate(slice.rotation);
    i++;
  }
  return out;
}

type Unit = { text: Move; start: number; end: number };

function humanizeWithRotations(
  moves: readonly TimedMove[],
  rotations: readonly RotationEvent[],
  mergeable: (i: number) => boolean,
): DisplayToken[] {
  const view = new FrameTracker();
  const out: DisplayToken[] = [];
  let pendingIndex = 0;

  // A turn, or two equal quarter turns read as a half turn when no rotation falls between them.
  const unitAt = (i: number, pending: RotationEvent | undefined): Unit => {
    const text = view.name(moves[i]!.move);
    const next = moves[i + 1];
    const canMerge = next !== undefined && pending?.after !== i + 1 && mergeable(i) && isQuarter(text);
    if (canMerge && view.name(next.move) === text) return { text: `${text.charAt(0)}2`, start: i, end: i + 2 };
    return { text, start: i, end: i + 1 };
  };
  const closesUnit = (pending: RotationEvent | undefined, unit: Unit): pending is RotationEvent =>
    pending?.after === unit.end && Math.abs(pending.t - moves[unit.end - 1]!.t) <= ROTATION_MERGE_MS;
  const combine = (turns: readonly Move[], pending: RotationEvent, start: number, end: number): boolean => {
    const combined = COMBINED.get(`${turnsKey(turns)}|${pending.rotation}`);
    if (!combined) return false;
    out.push(turnToken(combined.text, start, end));
    view.rotate(pending.rotation);
    pendingIndex++;
    return true;
  };

  let i = 0;
  while (i < moves.length || pendingIndex < rotations.length) {
    const pending = rotations[pendingIndex];
    if (pending && pending.after <= i) {
      pushRotation(out, pending);
      view.rotate(pending.rotation);
      pendingIndex++;
      continue;
    }
    const first = unitAt(i, pending);
    i = first.end;
    const together = first.end < moves.length && moves[first.end]!.t - moves[first.end - 1]!.t <= SLICE_PAIR_MS;
    if (together && pending?.after !== first.end) {
      const second = unitAt(first.end, pending);
      if (closesUnit(pending, second) && combine([first.text, second.text], pending, first.start, second.end)) {
        i = second.end;
        continue;
      }
    }
    if (closesUnit(pending, first) && combine([first.text], pending, first.start, first.end)) continue;
    out.push(turnToken(first.text, first.start, first.end));
  }
  return out;
}

/** Back-to-back rotations about one axis read as one (y y → y2; y y' → nothing). */
function pushRotation(out: DisplayToken[], event: RotationEvent): void {
  const last = out.at(-1);
  const [axis, amount] = parseRotation(event.rotation);
  if (last?.kind !== "rotation" || last.start !== event.after || parseRotation(last.text)[0] !== axis) {
    out.push({ kind: "rotation", text: event.rotation, start: event.after, end: event.after });
    return;
  }
  const total = (parseRotation(last.text)[1] + amount) % 4;
  if (total === 0) out.pop();
  else last.text = rotationName(axis, total);
}

/** Moves a person would count for a stage (slice turn metric: a wide move or slice is 1, a rotation 0). */
export function countDisplayTurns(tokens: readonly DisplayToken[], stage: Pick<Stage, "startMove" | "endMove">): number {
  return tokens.filter((token) => token.kind === "turn" && token.start >= stage.startMove && token.start < stage.endMove)
    .length;
}
