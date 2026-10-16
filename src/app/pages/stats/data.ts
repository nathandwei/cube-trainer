import { chipsFor } from "@/app/components/SplitChips";
import { resultMs } from "@/app/lib/averages";
import type { Part, RatingStep } from "@/app/lib/ratings";
import type { SolveRecord } from "@/cube/types";
import type { Range } from "./prefs";

const DAY = 86_400_000;

export type Splits = Record<Part, number>;

/** One solve as the charts see it. `n` is its solve number (0-based, oldest first) among the solves shown. */
export type ChartSolve = { id: string; n: number; t: number; result: number; splits: Splits | null };

/** The three split chips (cross or xcross, the remaining pairs, the last layer) of a completed, analysed solve. */
export function splitsOf(solve: SolveRecord): Splits | null {
  if (solve.penalty === "dnf" || !solve.analysis?.solved) return null;
  const [cross, f2l, ll] = chipsFor(solve.analysis.stages);
  return { cross: cross?.ms ?? 0, f2l: f2l?.ms ?? 0, ll: ll?.ms ?? 0 };
}

/**
 * A time on a real cube: smart-cube solves, and spacebar times from before the site went smart-cube-only. Test
 * solves are computer-made and old virtual-cube solves were keyboard turning, so neither counts (as in ratings).
 */
export function isCharted(solve: SolveRecord): boolean {
  return solve.source !== "demo" && solve.source !== "virtual";
}

/** Oldest first. */
export function chartSolves(solvesNewestFirst: readonly SolveRecord[]): ChartSolve[] {
  const out: ChartSolve[] = [];
  for (let i = solvesNewestFirst.length - 1; i >= 0; i--) {
    const solve = solvesNewestFirst[i];
    if (!solve || !isCharted(solve)) continue;
    out.push({ id: solve.id, n: out.length, t: solve.createdAt, result: resultMs(solve), splits: splitsOf(solve) });
  }
  return out;
}

/** What a dot shows: the whole result (Infinity for a DNF), or the sum of the chosen splits; null when unknown. */
export function metricValue(solve: ChartSolve, parts: readonly Part[]): number | null {
  if (parts.length === 0) return solve.result;
  if (!solve.splits) return null;
  const splits = solve.splits;
  const sum = parts.reduce((total, part) => total + splits[part], 0);
  return sum > 0 ? sum : null;
}

// ---------- rolling windows ----------

/** Index of the first element >= value in an ascending array. */
export function firstAtOrAfter(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] ?? Infinity) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** A window of the last `size` values kept in sorted order, so each step costs O(size) instead of a sort. */
class SortedWindow {
  private readonly sorted: number[] = [];
  private readonly order: number[] = [];

  constructor(private readonly size: number) {}

  push(value: number): void {
    this.sorted.splice(firstAtOrAfter(this.sorted, value), 0, value);
    this.order.push(value);
    if (this.order.length <= this.size) return;
    const dropped = this.order.shift() as number;
    this.sorted.splice(firstAtOrAfter(this.sorted, dropped), 1);
  }

  get full(): boolean {
    return this.order.length === this.size;
  }

  get values(): readonly number[] {
    return this.sorted;
  }
}

/** The WCA trimmed mean (same rule as averageOf) after every value, oldest first; null until `size` values. */
export function rollingAverage(values: readonly number[], size: number): (number | null)[] {
  const trim = Math.max(1, Math.ceil(size * 0.05));
  const window = new SortedWindow(size);
  return values.map((value) => {
    window.push(value);
    if (!window.full) return null;
    const sorted = window.values;
    let sum = 0;
    for (let i = trim; i < size - trim; i++) {
      const kept = sorted[i] ?? Infinity;
      if (!Number.isFinite(kept)) return Infinity;
      sum += kept;
    }
    return sum / (size - 2 * trim);
  });
}

/** Quantiles (0..1, nearest rank) of the last `size` values after every value; uses what there is at the start. */
export function rollingQuantiles(values: readonly number[], size: number, qs: readonly number[]): number[][] {
  const window = new SortedWindow(size);
  return values.map((value) => {
    window.push(value);
    const sorted = window.values;
    return qs.map((q) => sorted[Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1)))] ?? value);
  });
}

/** The best value so far after every value (Infinity until the first finite one): the stepped PB line. */
export function runningBest(values: readonly number[]): number[] {
  let best = Infinity;
  return values.map((value) => {
    best = Math.min(best, value);
    return best;
  });
}

// ---------- the trend ----------

export type TrendPoint = { id: string; n: number; t: number; value: number; splits: Splits | null; result: number };

export type Trend = {
  points: TrendPoint[];
  ao12: (number | null)[];
  ao100: (number | null)[];
  pb: number[];
};

/** Dots and lines over the whole history, aligned by position; averages run over the solves that have a value. */
export function trend(solves: readonly ChartSolve[], parts: readonly Part[]): Trend {
  const points: TrendPoint[] = [];
  for (const solve of solves) {
    const value = metricValue(solve, parts);
    if (value !== null) points.push({ id: solve.id, n: solve.n, t: solve.t, value, splits: solve.splits, result: solve.result });
  }
  const values = points.map((p) => p.value);
  return { points, ao12: rollingAverage(values, 12), ao100: rollingAverage(values, 100), pb: runningBest(values) };
}

/** A personal best and where it ends: the index (oldest first) of the last solve in its window. */
export type Best = { value: number; end: number };
export type Bests = { single: Best | null; ao5: Best | null; ao12: Best | null; ao100: Best | null };

function bestOf(values: readonly (number | null)[]): Best | null {
  let best: Best | null = null;
  for (let end = 0; end < values.length; end++) {
    const value = values[end];
    if (value != null && Number.isFinite(value) && (best === null || value < best.value)) best = { value, end };
  }
  return best;
}

/** Personal bests over results given oldest first. */
export function bests(results: readonly number[]): Bests {
  return {
    single: bestOf(results),
    ao5: bestOf(rollingAverage(results, 5)),
    ao12: bestOf(rollingAverage(results, 12)),
    ao100: bestOf(rollingAverage(results, 100)),
  };
}

export function rangeStart(range: Range, now: number): number {
  if (range === "7d") return now - 7 * DAY;
  if (range === "30d") return now - 30 * DAY;
  return -Infinity;
}

// ---------- histogram ----------

export type Bin = { from: number; to: number; count: number; /** also holds everything slower */ open: boolean };

function quantile(sorted: readonly number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))] ?? 0;
}

/** Whole seconds whenever that gives a readable number of rows; finer for splits, coarser for slow solves. */
export function binWidth(values: readonly number[]): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 1000;
  const spread = quantile(sorted, 0.99) - (sorted[0] ?? 0);
  if (spread >= 4000 && spread <= 20_000) return 1000;
  const widths = [10_000, 5000, 2000, 1000, 500, 250, 100];
  return widths.find((w) => spread / w >= 6) ?? 100;
}

/**
 * Rows of `width` ms from the fastest result up to the 99th percentile; the last row also takes anything slower
 * (so one 60-second solve does not stretch the chart). DNFs have no time and are left out.
 */
export function histogram(values: readonly number[], width: number, maxRows = 14): Bin[] {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const fastest = sorted[0];
  if (fastest === undefined) return [];
  const first = Math.floor(fastest / width);
  const rows = Math.min(maxRows, Math.floor(quantile(sorted, 0.99) / width) - first + 1);
  const bins: Bin[] = Array.from({ length: rows }, (_, i) => ({
    from: (first + i) * width,
    to: (first + i + 1) * width,
    count: 0,
    open: false,
  }));
  for (const value of sorted) {
    const row = Math.min(rows - 1, Math.floor(value / width) - first);
    const bin = bins[row];
    if (!bin) continue;
    bin.count += 1;
    if (value >= bin.to) bin.open = true;
  }
  return bins;
}

// ---------- calendar ----------

export type CalendarDay = { start: number; count: number };

function dayKey(t: number): number {
  const d = new Date(t);
  return d.getFullYear() * 10_000 + d.getMonth() * 100 + d.getDate();
}

/**
 * The last `weeks` weeks as columns of days, Sunday first, in local time. The last column ends today, so it may
 * be shorter than seven.
 */
export function calendar(timestamps: readonly number[], now: number, weeks = 26): CalendarDay[][] {
  const counts = new Map<number, number>();
  for (const t of timestamps) counts.set(dayKey(t), (counts.get(dayKey(t)) ?? 0) + 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - 7 * (weeks - 1));
  const columns: CalendarDay[][] = [];
  const day = new Date(start);
  while (day.getTime() <= today.getTime()) {
    if (day.getDay() === 0) columns.push([]);
    columns[columns.length - 1]?.push({ start: day.getTime(), count: counts.get(dayKey(day.getTime())) ?? 0 });
    day.setDate(day.getDate() + 1);
  }
  return columns;
}

/** 0 for an empty day, then 1 to 4 by quarters of the busiest day. */
export function calendarLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// ---------- ratings ----------

/** The band is left out until the window holds this many performances: a few solves make no "usual" range. */
const BAND_MIN_SOLVES = 10;

export type RatingPoint = { id: string; rating: number; low: number | null; high: number | null };

/** How far back the "usual" band around a rating looks: long enough to read as a range, not as noise. */
const BAND_SOLVES = 50;

/** One part's rating after every rated solve, with the middle half of its recent performances as the band. */
export function ratingSeries(history: readonly RatingStep[], part: Part): RatingPoint[] {
  const band = rollingQuantiles(
    history.map((step) => step.performance[part]),
    BAND_SOLVES,
    [0.25, 0.75],
  );
  return history.map((step, i) => {
    const [low, high] = i + 1 >= BAND_MIN_SOLVES ? (band[i] ?? []) : [];
    return { id: step.id, rating: step.rating[part], low: low ?? null, high: high ?? null };
  });
}

/** A rating point placed on the main chart's x axis. */
export type PlacedRating = { x: number; rating: number; low: number | null; high: number | null };

/** The lowest and highest rating or band edge with x in [x0, x1] across all series; null when none is there. */
export function ratingRange(series: readonly (readonly PlacedRating[])[], [x0, x1]: readonly [number, number]): [number, number] | null {
  let low = Infinity;
  let high = -Infinity;
  for (const points of series) {
    for (const p of points) {
      if (p.x < x0 || p.x > x1) continue;
      low = Math.min(low, p.low ?? p.rating, p.rating);
      high = Math.max(high, p.high ?? p.rating, p.rating);
    }
  }
  return Number.isFinite(low) ? [low, high] : null;
}

// ---------- lookups ----------

/** Index of the last element whose key is <= x in an ascending array, or -1. */
export function lastAtOrBefore(keys: readonly number[], x: number): number {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((keys[mid] ?? Infinity) <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** Index of the element whose key is closest to x, or -1 for an empty array. */
export function nearestIndex(keys: readonly number[], x: number): number {
  if (keys.length === 0) return -1;
  const before = lastAtOrBefore(keys, x);
  if (before < 0) return 0;
  if (before >= keys.length - 1) return keys.length - 1;
  return x - (keys[before] ?? 0) <= (keys[before + 1] ?? 0) - x ? before : before + 1;
}
