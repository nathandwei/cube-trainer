import { lastAtOrBefore } from "./data";
import type { XAxis } from "./prefs";

/** The part of the x axis the main chart shows, in solve numbers or epoch ms depending on the axis. */
export type View = readonly [number, number];

const MINUTE = 60_000;
/** Below this many solves the page shows its empty layout, with room for the solves to come. */
const FEW = 5;
const DAY = 86_400_000;

/** The narrowest window: a handful of solves, or a few minutes of one session. */
export function minSpan(x: XAxis): number {
  return x === "solve" ? 8 : 10 * MINUTE;
}

/** Where solves sit on the x axis, oldest first. */
export type Placed = { n: number; t: number };

/** Everything in range, with a little room so the first and last dots are not cut by the edges. */
export function extentOf(placed: readonly Placed[], x: XAxis, now: number): View {
  const first = placed[0];
  const last = placed[placed.length - 1];
  if (!first || !last) return x === "solve" ? [-0.5, 49.5] : [now - 7 * DAY, now];
  // A handful of solves sit at the start of a longer axis, like the first marks on an empty page.
  if (x === "solve") return [first.n - 0.5, placed.length < FEW ? first.n + 49.5 : last.n + 0.5];
  const pad = Math.max(30 * MINUTE, (last.t - first.t) * 0.01);
  return [first.t - pad, last.t + pad];
}

/** Inside the extent and at least `min` wide (or the whole extent when that is narrower). */
export function clampView([a, b]: View, [e0, e1]: View, min: number): View {
  const full = e1 - e0;
  if (!(full > 0)) return [e0, e1];
  const span = Math.min(full, Math.max(min, b - a));
  const start = span === b - a ? a : (a + b) / 2 - span / 2;
  const clamped = Math.max(e0, Math.min(e1 - span, start));
  return [clamped, clamped + span];
}

/** Scales the window by `factor` (below 1 zooms in) keeping `anchor` where it is on screen. */
export function zoomView(view: View, extent: View, factor: number, anchor: number, min: number): View {
  const [a, b] = view;
  const share = (anchor - a) / (b - a || 1);
  const span = (b - a) * factor;
  const start = anchor - share * span;
  return clampView([start, start + span], extent, min);
}

export function panView([a, b]: View, extent: View, delta: number, min: number): View {
  return clampView([a + delta, b + delta], extent, min);
}

export function isFull(view: View, extent: View): boolean {
  const tolerance = (extent[1] - extent[0]) * 1e-6;
  return view[0] <= extent[0] + tolerance && view[1] >= extent[1] - tolerance;
}

/** The same stretch of solves on the other axis, or null when it holds none. */
export function convertView([a, b]: View, from: XAxis, placed: readonly Placed[]): View | null {
  const keys = placed.map((p) => (from === "solve" ? p.n : p.t));
  const firstIndex = lastAtOrBefore(keys, a) + 1;
  const lastIndex = lastAtOrBefore(keys, b);
  const first = placed[firstIndex];
  const last = placed[lastIndex];
  if (!first || !last || lastIndex < firstIndex) return null;
  return from === "solve" ? padTime(first.t, last.t) : [first.n - 0.5, last.n + 0.5];
}

/** A window over the solves numbered first..last (inclusive) on the given axis. */
export function windowFor(first: Placed, last: Placed, x: XAxis): View {
  return x === "solve" ? [first.n - 0.5, last.n + 0.5] : padTime(first.t, last.t);
}

function padTime(t0: number, t1: number): View {
  const pad = Math.max(MINUTE, (t1 - t0) * 0.04);
  return [t0 - pad, t1 + pad];
}
