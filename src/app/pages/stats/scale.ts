/** A linear map from data values to pixels and back. */
export type Linear = {
  at: (value: number) => number;
  invert: (px: number) => number;
  domain: readonly [number, number];
  range: readonly [number, number];
};

export function linear(domain: readonly [number, number], range: readonly [number, number]): Linear {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = (r1 - r0) / (d1 - d0 || 1);
  return { at: (value) => r0 + (value - d0) * k, invert: (px) => d0 + (px - r0) / k, domain, range };
}

/** A 1, 2 or 5 times a power of ten close to span / count. */
export function niceStep(span: number, count: number): number {
  const raw = Math.abs(span) / Math.max(1, count);
  if (!Number.isFinite(raw) || raw === 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized < 1.5 ? 1 : normalized < 3 ? 2 : normalized < 7 ? 5 : 10;
  return factor * magnitude;
}

/** Multiples of a nice step inside [min, max]. */
export function ticks(min: number, max: number, count: number, step = niceStep(max - min, count)): number[] {
  if (!(max > min)) return [min];
  const out: number[] = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  // Multiplying (rather than adding the step repeatedly) keeps 0.1 + 0.2 style drift out of the labels.
  for (let i = first; i <= last; i++) out.push(Number((i * step).toPrecision(12)));
  return out;
}

export type Axis = { domain: [number, number]; ticks: number[]; step: number };

/** [min, max] widened outward to the nice step, with its ticks. */
export function niceExtent(min: number, max: number, count: number): Axis {
  if (!(max > min)) return niceExtent(min - 1000, max + 1000, count);
  const step = niceStep(max - min, count);
  const domain: [number, number] = [Math.floor(min / step + 1e-9) * step, Math.ceil(max / step - 1e-9) * step];
  return { domain, ticks: ticks(domain[0], domain[1], count, step), step };
}

/**
 * A y axis for times: the middle 99% of `values` (all of them when there are few, so a lone outlier still
 * shows in a short stretch), always including `keep`, padded a little and rounded out to nice ticks.
 */
export function timeAxis(values: readonly number[], keep: readonly number[], count: number): Axis {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const kept = keep.filter(Number.isFinite);
  if (sorted.length === 0 && kept.length === 0) return niceExtent(10_000, 30_000, count);
  const trim = sorted.length >= 200 ? Math.floor(sorted.length * 0.005) : 0;
  const low = Math.min(...kept, sorted[trim] ?? Infinity);
  const high = Math.max(...kept, sorted[sorted.length - 1 - trim] ?? -Infinity);
  const pad = Math.max((high - low) * 0.04, 100);
  return niceExtent(Math.max(0, low - pad), high + pad, count);
}

/** Seconds with one decimal ("15.0"), or more when the ticks are closer than a tenth. */
export function secondsLabel(ms: number, stepMs: number): string {
  const step = String(Number((stepMs / 1000).toPrecision(6)));
  const decimals = step.split(".")[1]?.length ?? 0;
  return (ms / 1000).toFixed(Math.min(3, Math.max(1, decimals)));
}

// ---------- time ----------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type Unit = "minute" | "hour" | "day" | "week" | "month" | "year";
type Interval = { unit: Unit; every: number; approx: number };

const INTERVALS: readonly Interval[] = [
  { unit: "minute", every: 15, approx: 15 * MINUTE },
  { unit: "minute", every: 30, approx: 30 * MINUTE },
  { unit: "hour", every: 1, approx: HOUR },
  { unit: "hour", every: 3, approx: 3 * HOUR },
  { unit: "hour", every: 6, approx: 6 * HOUR },
  { unit: "hour", every: 12, approx: 12 * HOUR },
  { unit: "day", every: 1, approx: DAY },
  { unit: "day", every: 2, approx: 2 * DAY },
  { unit: "week", every: 1, approx: 7 * DAY },
  { unit: "week", every: 2, approx: 14 * DAY },
  { unit: "month", every: 1, approx: 30 * DAY },
  { unit: "month", every: 2, approx: 61 * DAY },
  { unit: "month", every: 3, approx: 91 * DAY },
  { unit: "month", every: 6, approx: 182 * DAY },
  { unit: "year", every: 1, approx: 365 * DAY },
];

const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" });
const hourLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric" });
const minuteLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const momentLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "Oct 3" */
export function formatDay(t: number): string {
  return dayLabel.format(t);
}

/** "Oct 3, 2:14 PM" */
export function formatMoment(t: number): string {
  return momentLabel.format(t);
}

/** The first boundary of the interval at or before t, in local time. */
function floorTo(t: number, { unit, every }: Interval): Date {
  const d = new Date(t);
  if (unit === "minute") d.setMinutes(Math.floor(d.getMinutes() / every) * every, 0, 0);
  else if (unit === "hour") d.setHours(Math.floor(d.getHours() / every) * every, 0, 0, 0);
  else {
    d.setHours(0, 0, 0, 0);
    if (unit === "week") d.setDate(d.getDate() - d.getDay());
    if (unit === "month") d.setDate(1);
    if (unit === "month") d.setMonth(Math.floor(d.getMonth() / every) * every);
    if (unit === "year") d.setMonth(0, 1);
  }
  return d;
}

function step(d: Date, { unit, every }: Interval): void {
  if (unit === "minute") d.setMinutes(d.getMinutes() + every);
  else if (unit === "hour") d.setHours(d.getHours() + every);
  else if (unit === "day") d.setDate(d.getDate() + every);
  else if (unit === "week") d.setDate(d.getDate() + 7 * every);
  else if (unit === "month") d.setMonth(d.getMonth() + every);
  else d.setFullYear(d.getFullYear() + every);
}

/** Every other day or week is counted from a fixed origin, so the ticks stay put while the window pans. */
function keeps(d: Date, { unit, every }: Interval): boolean {
  if (every === 1) return true;
  if (unit === "day") return (d.getDate() - 1) % every === 0;
  if (unit === "week") return Math.round((d.getTime() - new Date(1970, 0, 4).getTime()) / (7 * DAY)) % every === 0;
  return true;
}

function label(d: Date, { unit }: Interval): string {
  const midnight = d.getHours() === 0 && d.getMinutes() === 0;
  if (unit === "minute") return midnight ? dayLabel.format(d) : minuteLabel.format(d);
  if (unit === "hour") return midnight ? dayLabel.format(d) : hourLabel.format(d);
  if (unit === "day" || unit === "week") return dayLabel.format(d);
  if (unit === "month") return d.getMonth() === 0 ? String(d.getFullYear()) : monthLabel.format(d);
  return String(d.getFullYear());
}

export type Tick = { value: number; label: string };

/** Calendar-aligned ticks (local time) for [t0, t1], at most about maxTicks of them. */
export function timeTicks(t0: number, t1: number, maxTicks: number): Tick[] {
  if (!(t1 > t0)) return [];
  const span = t1 - t0;
  const interval = INTERVALS.find((i) => span / i.approx <= maxTicks) ?? { unit: "year", every: Math.ceil(span / (365 * DAY * maxTicks)), approx: 0 };
  const out: Tick[] = [];
  const d = floorTo(t0, interval);
  for (let guard = 0; d.getTime() <= t1 && guard < 1000; guard++) {
    if (d.getTime() >= t0 && keeps(d, interval)) out.push({ value: d.getTime(), label: label(d, interval) });
    step(d, interval);
  }
  return out;
}
