import { useCallback, useMemo, useState } from "react";
import { PARTS, ratingHistory, type Part } from "@/app/lib/ratings";
import { navigate } from "@/app/lib/router";
import { Calendar } from "./Calendar";
import { showTime } from "./chart";
import {
  bests,
  binWidth,
  calendar,
  chartSolves,
  firstAtOrAfter,
  histogram,
  lastAtOrBefore,
  rangeStart,
  ratingRange,
  ratingSeries,
  trend,
  type Bests,
  type CalendarDay,
  type ChartSolve,
  type PlacedRating,
} from "./data";
import { Histogram } from "./Histogram";
import { useFullHistory, useNow } from "./hooks";
import { PART_LABEL } from "./labels";
import { setRange, useStatsPrefs, type Range, type XAxis } from "./prefs";
import { RatingChart } from "./RatingChart";
import { niceExtent } from "./scale";
import { TrendChart } from "./TrendChart";
import { clampView, convertView, extentOf, isFull, minSpan, windowFor, type View } from "./view";
import "./stats.css";

const FIGURES: readonly { key: keyof Bests; label: string; size: number }[] = [
  { key: "single", label: "Single", size: 1 },
  { key: "ao5", label: "ao5", size: 5 },
  { key: "ao12", label: "ao12", size: 12 },
  { key: "ao100", label: "ao100", size: 100 },
];

/** Solves around a lone best single, so the dot sits among its neighbours rather than alone. */
const SINGLE_CONTEXT = 12;
const CALENDAR_WEEKS = 26;
const MIN_HISTOGRAM = 5;
/** The rating charts are short: about three gridlines keep their labels apart. */
const RATING_TICKS = 2;

/**
 * A zoom belongs to the axis, range and solve set it was made on; switching axis converts it, the rest reset it.
 * `count` is how many solves were charted then: older pages arriving renumber every solve, and the window follows.
 */
type Zoom = { view: View; x: XAxis; range: Range; count: number };

export function StatsPage() {
  const solves = useFullHistory();
  const prefs = useStatsPrefs();
  const now = useNow();
  const { x, range, lines, splits } = prefs;
  const parts = useMemo(() => PARTS.filter((part) => splits[part]), [splits]);

  const charted = useMemo(() => chartSolves(solves), [solves]);
  const series = useMemo(() => trend(charted, parts), [charted, parts]);
  const best = useMemo(() => bests(charted.map((s) => s.result)), [charted]);
  const start = rangeStart(range, now);
  const times = useMemo(() => series.points.map((p) => p.t), [series]);
  const from = firstAtOrAfter(times, start);
  const extent = useMemo(() => extentOf(series.points.slice(from), x, now), [series, from, x, now]);

  const [zoom, setZoom] = useState<Zoom | null>(null);
  const view = useMemo((): View => {
    if (!zoom || zoom.range !== range) return extent;
    const shift = zoom.x === "solve" ? charted.length - zoom.count : 0;
    const made: View = [zoom.view[0] + shift, zoom.view[1] + shift];
    const converted = zoom.x === x ? made : convertView(made, zoom.x, charted);
    return converted ? clampView(converted, extent, minSpan(x)) : extent;
  }, [zoom, range, x, extent, charted]);
  const zoomed = !isFull(view, extent);

  const onView = useCallback(
    (next: View | null) =>
      setZoom(next === null || isFull(next, extent) ? null : { view: next, x, range, count: charted.length }),
    [extent, x, range, charted.length],
  );

  const [hover, setHover] = useState<{ x: number; axis: XAxis } | null>(null);
  const hoverX = hover && hover.axis === x ? hover.x : null;
  const onHover = useCallback((at: number | null) => setHover(at === null ? null : { x: at, axis: x }), [x]);
  const onOpen = useCallback((id: string) => navigate(`/?s=${encodeURIComponent(id)}`), []);

  /** Zooms to the solves numbered first..last (oldest first), widening the range when they fall outside it. */
  const focusSolves = useCallback(
    (first: ChartSolve, last: ChartSolve) => {
      const target = first.t < start ? "all" : range;
      if (target !== range) setRange(target);
      setZoom({ view: windowFor(first, last, x), x, range: target, count: charted.length });
    },
    [start, range, x, charted.length],
  );

  function focusBest(key: keyof Bests, size: number) {
    const found = best[key];
    if (!found) return;
    const before = size === 1 ? SINGLE_CONTEXT : size - 1;
    const after = size === 1 ? SINGLE_CONTEXT : 0;
    const first = charted[Math.max(0, found.end - before)];
    const last = charted[Math.min(charted.length - 1, found.end + after)];
    if (first && last) focusSolves(first, last);
  }

  const solveTimes = useMemo(() => charted.map((s) => s.t), [charted]);
  const onPickDay = useCallback(
    (day: CalendarDay) => {
      const end = new Date(day.start);
      end.setDate(end.getDate() + 1);
      const first = charted[firstAtOrAfter(solveTimes, day.start)];
      const last = charted[lastAtOrBefore(solveTimes, end.getTime() - 1)];
      if (first && last && first.n <= last.n) focusSolves(first, last);
    },
    [charted, solveTimes, focusSolves],
  );

  const days = useMemo(() => calendar(solveTimes, now, CALENDAR_WEEKS), [solveTimes, now]);

  // The visible stretch, shared by the histogram and the calendar's fade.
  const keys = useMemo(() => series.points.map((p) => (x === "solve" ? p.n : p.t)), [series, x]);
  const lo = Math.max(from, firstAtOrAfter(keys, view[0]));
  const hi = lastAtOrBefore(keys, view[1]);
  const visibleValues = useMemo(() => series.points.slice(lo, hi + 1).map((p) => p.value), [series, lo, hi]);
  const bins = useMemo(() => {
    // A handful of solves is not a distribution yet: the empty rows say so without words.
    if (visibleValues.filter(Number.isFinite).length < MIN_HISTOGRAM) return { width: 1000, rows: [] };
    const width = binWidth(visibleValues);
    return { width, rows: histogram(visibleValues, width, 12) };
  }, [visibleValues]);
  const firstVisible = series.points[lo];
  const lastVisible = series.points[hi];
  const timeWindow = useMemo((): readonly [number, number] | null => {
    if (!zoomed) return null;
    if (x === "date") return [view[0], view[1]];
    return firstVisible && lastVisible ? [firstVisible.t, lastVisible.t] : null;
  }, [zoomed, x, view, firstVisible, lastVisible]);

  // The rating charts share the main chart's x axis, window and crosshair.
  const steps = useMemo(() => ratingHistory(solves), [solves]);
  const ratingCharts = useMemo(() => {
    const placed = new Map(charted.map((s) => [s.id, s]));
    return PARTS.map((part): { part: Part; points: PlacedRating[] } => ({
      part,
      points: ratingSeries(steps, part).flatMap((p) => {
        const solve = placed.get(p.id);
        return solve ? [{ x: x === "solve" ? solve.n : solve.t, rating: p.rating, low: p.low, high: p.high }] : [];
      }),
    }));
  }, [steps, charted, x]);
  const ratingAxis = useMemo(() => {
    const found = ratingRange(ratingCharts.map((c) => c.points), view);
    if (!found) return niceExtent(1000, 2000, RATING_TICKS);
    const [low, high] = found;
    const pad = Math.max(10, (high - low) * 0.08);
    return niceExtent(low - pad, high + pad, RATING_TICKS);
  }, [ratingCharts, view]);

  return (
    <div className="stats">
      <div className="stats-figures">
        {FIGURES.map(({ key, label, size }) => (
          <button key={key} className="stats-figure" disabled={!best[key]} onClick={() => focusBest(key, size)}>
            <span className="label">{label}</span>
            <span className="num">{showTime(best[key]?.value)}</span>
          </button>
        ))}
      </div>
      <TrendChart
        trend={series}
        from={from}
        x={x}
        parts={parts}
        lines={lines}
        view={view}
        extent={extent}
        onView={onView}
        hoverX={hoverX}
        onHover={onHover}
        onOpen={onOpen}
      />
      <div className="stats-lower">
        {ratingCharts.map(({ part, points }) => (
          <RatingChart
            key={part}
            label={PART_LABEL[part]}
            points={points}
            domain={view}
            axis={ratingAxis}
            hoverX={hoverX}
            onHover={onHover}
          />
        ))}
        <div className="stats-side">
          <Calendar columns={days} highlight={timeWindow} onPick={onPickDay} />
          <Histogram bins={bins.rows} width={bins.width} />
        </div>
      </div>
    </div>
  );
}
