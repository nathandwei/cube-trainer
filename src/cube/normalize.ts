// A smart cube's move stream, made into a solve as a person would write it.
//
// Two artefacts of the hardware: each turn carries a timestamp from the cube's own clock, which runs a fraction of a
// percent off the host's and restarts on every reconnect, plus the host's arrival time, which jitters by tens of ms;
// and a half turn arrives as two quarter turns. fitCubeClock maps the cube clock onto the host clock with one line
// per attempt (a session-long fit drifts by hundreds of ms at its ends); normalizeTurns merges the quarter pairs, so
// move counts match human notation before analyzeSolve sees them.

import { parseRotation } from "./frame";
import { rotationName } from "./cubie";
import type { Move, RotationEvent, TimedMove } from "./types";

/**
 * One turn as reported: `hostT` is when it arrived (host ms), `cubeT` the cube's own timestamp, or null when the
 * cube gave none (a turn recovered from the cube's history after a dropped packet, or a cube without a clock).
 */
export type ReportedMove = { move: Move; hostT: number; cubeT: number | null };

/** Two equal quarter turns of one face this close together (ms) are one half turn. */
export const HALF_TURN_MS = 80;
/** A fitted line that misses an arrival time by more than this (ms) is not trusted: the cube clock jumped. */
export const MAX_FIT_RESIDUAL_MS = 150;
/** Real cube clocks are within about 1% of the host's; anything steeper is a bad fit. */
const MAX_SKEW = 0.05;

type Line = { slope: number; intercept: number };
type Point = { x: number; y: number };

function leastSquares(points: readonly Point[]): Line | null {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const { x, y } of points) {
    covariance += (x - meanX) * (y - meanY);
    variance += (x - meanX) ** 2;
  }
  if (variance === 0) return null;
  const slope = covariance / variance;
  return { slope, intercept: meanY - slope * meanX };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function fits(line: Line, points: readonly Point[]): boolean {
  if (Math.abs(line.slope - 1) > MAX_SKEW) return false;
  return points.every(({ x, y }) => Math.abs(line.slope * x + line.intercept - y) <= MAX_FIT_RESIDUAL_MS);
}

/** The cube-clock → host-clock line for one attempt, or null when the cube's timestamps cannot be trusted. */
export function cubeClockLine(moves: readonly ReportedMove[]): Line | null {
  const points = moves.flatMap(({ hostT, cubeT }) => (cubeT === null || !Number.isFinite(cubeT) ? [] : [{ x: cubeT, y: hostT }]));
  if (points.length === 0) return null;
  const regression = leastSquares(points);
  if (regression) return fits(regression, points) ? regression : null;
  // One turn, or turns at a single cube time: no slope to fit, so keep the cube's spacing at the typical offset.
  const offset: Line = { slope: 1, intercept: median(points.map(({ x, y }) => y - x)) };
  return fits(offset, points) ? offset : null;
}

/** Fills turns without a cube time by interpolating between their fitted neighbours. */
function fillGaps(times: readonly (number | null)[]): number[] {
  return times.map((time, i) => {
    if (time !== null) return time;
    let before = i - 1;
    while (before >= 0 && times[before] === null) before--;
    let after = i + 1;
    while (after < times.length && times[after] === null) after++;
    const prev = before >= 0 ? times[before] : null;
    const next = after < times.length ? times[after] : null;
    if (prev != null && next != null) return prev + ((next - prev) * (i - before)) / (after - before);
    return prev ?? next ?? 0;
  });
}

/**
 * Host-clock times for one attempt's turns: the cube's timestamps mapped through a least-squares line fitted to
 * this attempt alone (each turn's arrival time is that line plus radio jitter). Turns without a cube time sit
 * between their neighbours. When the cube has no usable clock, the arrival times are used as they are.
 * Times come back rounded and never decreasing.
 */
export function fitCubeClock(moves: readonly ReportedMove[]): TimedMove[] {
  const line = cubeClockLine(moves);
  const raw = line
    ? fillGaps(moves.map(({ cubeT }) => (cubeT === null || !Number.isFinite(cubeT) ? null : line.slope * cubeT + line.intercept)))
    : moves.map(({ hostT }) => hostT);
  let floor = -Infinity;
  return moves.map(({ move }, i) => {
    floor = Math.max(floor, Math.round(raw[i]!));
    return { move, t: floor };
  });
}

const QUARTER_RE = /^([URFDLB])('?)$/;
const OPPOSITE: Readonly<Record<string, string>> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

function halfOf(first: TimedMove, second: TimedMove, windowMs: number): Move | null {
  const a = QUARTER_RE.exec(first.move);
  const b = QUARTER_RE.exec(second.move);
  if (!a || !b || a[1] !== b[1] || a[2] !== b[2]) return null;
  return second.t - first.t <= windowMs ? `${a[1]}2` : null;
}

/**
 * The turn that completes turn i's half turn: the next turn of the same face, if only turns of the opposite face
 * came between. Opposite faces commute, so a slice reported as R L' R L' is exactly R2 L2.
 */
function partnerOf(moves: readonly TimedMove[], i: number, taken: ReadonlySet<number>, windowMs: number): { k: number; half: Move } | null {
  const face = moves[i]!.move.charAt(0);
  for (let k = i + 1; k < moves.length; k++) {
    const other = moves[k]!;
    if (other.t - moves[i]!.t > windowMs) return null;
    if (other.move.charAt(0) === OPPOSITE[face]) continue;
    if (taken.has(k)) return null;
    const half = halfOf(moves[i]!, other, windowMs);
    return half ? { k, half } : null;
  }
  return null;
}

/** Adds rotation events that now sit at the same place about the same axis (x then x → x2; y then y' → nothing). */
function mergeRotations(events: readonly RotationEvent[]): RotationEvent[] {
  const out: RotationEvent[] = [];
  for (const event of events) {
    const last = out.at(-1);
    const [axis, amount] = parseRotation(event.rotation);
    if (!last || last.after !== event.after || parseRotation(last.rotation)[0] !== axis) {
      out.push(event);
      continue;
    }
    const total = (parseRotation(last.rotation)[1] + amount) % 4;
    if (total === 0) {
      out.pop();
      continue;
    }
    out[out.length - 1] = { rotation: rotationName(axis, total), after: event.after, t: event.t };
  }
  return out;
}

/**
 * normalizeTurns for a solve with rotation events: each event keeps its place relative to the turns (an event
 * between the two quarters of a merged half turn moves to just after it), and events that end up together about
 * the same axis are added, so a wide half turn's two quarter rotations read as one (L2 with x2 → r2).
 */
export function normalizeStream(
  moves: readonly TimedMove[],
  rotations: readonly RotationEvent[],
  windowMs = HALF_TURN_MS,
): { moves: TimedMove[]; rotations: RotationEvent[] } {
  // Each output turn sits where its last quarter arrived, so times stay in order; `first` is its first quarter.
  const merged: { move: TimedMove; first: number; last: number }[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < moves.length; i++) {
    if (taken.has(i)) continue;
    const partner = partnerOf(moves, i, taken, windowMs);
    if (!partner) {
      merged.push({ move: moves[i]!, first: i, last: i });
      continue;
    }
    taken.add(partner.k);
    merged.push({ move: { move: partner.half, t: moves[partner.k]!.t }, first: i, last: partner.k });
  }
  merged.sort((a, b) => a.last - b.last);
  const out = merged.map(({ move }) => move);
  /** coveredBy[k]: output turns begun within the first k input turns (an event mid half turn moves after it). */
  const coveredBy = Array.from({ length: moves.length + 1 }, (_, k) => merged.filter(({ first }) => first < k).length);
  const remapped = rotations.map((event) => {
    const after = coveredBy[event.after];
    if (after === undefined) throw new Error(`Rotation after ${event.after} turns is past the ${moves.length} turns`);
    return { ...event, after };
  });
  return { moves: out, rotations: mergeRotations(remapped) };
}

/**
 * Two equal quarter turns of a face within `windowMs` become one half turn at the second one's time (R R → R2),
 * also when only turns of the opposite face came between (R L R L → R2 L2). Separate quarter turns stay.
 */
export function normalizeTurns(moves: readonly TimedMove[], windowMs = HALF_TURN_MS): TimedMove[] {
  return normalizeStream(moves, [], windowMs).moves;
}
