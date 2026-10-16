import { pauseMs } from "@/app/lib/review";
import type { SolveRecord, Stage } from "@/cube/types";

// Scale: 1000 = a 30 s solver, and every +100 is 10% faster (18 s ≈ 1485, 15 s ≈ 1658, 12 s ≈ 1870,
// world-record average ≈ 2900). A part rating reads its stage time as the share of a solve it usually takes.
const ANCHOR_MS = 30_000;
const ANCHOR_RATING = 1000;
const STEP = 100;
const STEP_FACTOR = 0.9;

/** Share of a CFOP solve each part takes at every level (Boyce & Storm 2022 data, docs/research/01). */
export const PART_SHARE = { cross: 0.135, f2l: 0.52, ll: 0.345 } as const;
const PAIR_SHARE = PART_SHARE.f2l / 4;

export type Part = keyof typeof PART_SHARE;
export const PARTS: readonly Part[] = ["cross", "f2l", "ll"];

/**
 * Lookahead: the time a solve spends stopped (gaps over PAUSE_MS, as in the review's flow), read on the same scale
 * as if pauses were this share of a typical solve. So pausing like a typical solver of his speed puts it level with
 * the part ratings; fast turning with long stops puts it below them. The share is a starting guess to check against
 * his own solves.
 */
const PAUSE_SHARE = 0.3;
/** No solve is pause-free in the rating's eyes: keeps a perfectly smooth solve from scoring infinity. */
const MIN_PAUSE_MS = 300;

export type RatingKey = Part | "lookahead";
export const RATING_KEYS: readonly RatingKey[] = ["cross", "f2l", "ll", "lookahead"];

/** Every solve moves the rating; the first ones move it a lot, later ones less (like a provisional rating). */
const MIN_STEP = 0.04;
/** One bad (or lucky) solve can move a performance at most this far from the current rating. */
const MAX_SWING = 400;

export function ratingForMs(ms: number): number {
  return ANCHOR_RATING + (STEP * Math.log(ANCHOR_MS / ms)) / Math.log(1 / STEP_FACTOR);
}

export function msForRating(rating: number): number {
  return ANCHOR_MS * STEP_FACTOR ** ((rating - ANCHOR_RATING) / STEP);
}

/** Time spent on each part in one analysed solve; an xcross is split between cross and F2L by their shares. */
export function partTimes(stages: readonly Stage[]): Record<Part, number> {
  const times: Record<Part, number> = { cross: 0, f2l: 0, ll: 0 };
  for (const stage of stages) {
    if (stage.kind === "cross") times.cross += stage.totalMs;
    else if (stage.kind === "pair") times.f2l += stage.totalMs;
    else if (stage.kind === "xcross") {
      const pairs = stage.slots?.length ?? 1;
      const crossShare = PART_SHARE.cross / (PART_SHARE.cross + pairs * PAIR_SHARE);
      times.cross += stage.totalMs * crossShare;
      times.f2l += stage.totalMs * (1 - crossShare);
    } else times.ll += stage.totalMs;
  }
  return times;
}

/** The solve's performance on the rating scale for one part: the overall time it is typical of. */
export function partPerformance(part: Part, ms: number): number {
  return ratingForMs(ms / PART_SHARE[part]);
}

export type PartRating = { rating: number; delta: number; solves: number };
export type Ratings = Record<RatingKey, PartRating | null>;

/** The lookahead performance of one rated solve (see PAUSE_SHARE), or null for a solve that doesn't rate. */
export function lookaheadPerformance(solve: SolveRecord): number | null {
  if (!performances(solve)) return null;
  return ratingForMs(Math.max(MIN_PAUSE_MS, pauseMs(solve.moves)) / PAUSE_SHARE);
}

/**
 * What one solve says about each part, on the rating scale: each part from its own stage times. Only smart-cube
 * solves rate; test solves are computer-made, and the timer-only and virtual solves from before the site went
 * smart-cube-only have no real stage times. A DNF doesn't rate either.
 */
export function performances(solve: SolveRecord): Record<Part, number> | null {
  if (solve.penalty === "dnf") return null;
  if (solve.source !== "smartcube" || !solve.analysis?.solved) return null;
  const times = partTimes(solve.analysis.stages);
  if (PARTS.some((part) => times[part] <= 0)) return null;
  return { cross: partPerformance("cross", times.cross), f2l: partPerformance("f2l", times.f2l), ll: partPerformance("ll", times.ll) };
}

function advance(previous: PartRating | null, performance: number): PartRating {
  if (!previous) return { rating: performance, delta: 0, solves: 1 };
  const capped = Math.max(previous.rating - MAX_SWING, Math.min(previous.rating + MAX_SWING, performance));
  const step = Math.max(MIN_STEP, 1 / (previous.solves + 1));
  const rating = previous.rating + step * (capped - previous.rating);
  return { rating, delta: rating - previous.rating, solves: previous.solves + 1 };
}

/** Replays solves oldest first. Nothing decays with time away: only solves move a rating. */
export function computeRatings(solvesNewestFirst: readonly SolveRecord[]): Ratings {
  const ratings: Ratings = { cross: null, f2l: null, ll: null, lookahead: null };
  for (const solve of [...solvesNewestFirst].reverse()) {
    const scores = performances(solve);
    if (!scores) continue;
    for (const part of PARTS) ratings[part] = advance(ratings[part], scores[part]);
    const lookahead = lookaheadPerformance(solve);
    if (lookahead !== null) ratings.lookahead = advance(ratings.lookahead, lookahead);
  }
  return ratings;
}

/** One rated solve in the replay: what it scored and the ratings right after it. */
export type RatingStep = {
  id: string;
  createdAt: number;
  performance: Record<Part, number>;
  rating: Record<Part, number>;
};

/** The same replay as computeRatings, oldest first, keeping the ratings after every solve that moved them. */
export function ratingHistory(solvesNewestFirst: readonly SolveRecord[]): RatingStep[] {
  const ratings: Record<Part, PartRating | null> = { cross: null, f2l: null, ll: null };
  const steps: RatingStep[] = [];
  for (const solve of [...solvesNewestFirst].reverse()) {
    const scores = performances(solve);
    if (!scores) continue;
    const rating = { cross: 0, f2l: 0, ll: 0 };
    for (const part of PARTS) {
      const next = advance(ratings[part], scores[part]);
      ratings[part] = next;
      rating[part] = next.rating;
    }
    steps.push({ id: solve.id, createdAt: solve.createdAt, performance: scores, rating });
  }
  return steps;
}
