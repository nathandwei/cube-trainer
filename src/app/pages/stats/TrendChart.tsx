import { useEffect, useEffectEvent, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Part } from "@/app/lib/ratings";
import { clamp, crisp, MARGIN, showTime } from "./chart";
import { cssColor, dotSprite, prepareCanvas, stamp } from "./canvas";
import { firstAtOrAfter, lastAtOrBefore, nearestIndex, type Trend, type TrendPoint } from "./data";
import { useBoxSize, useWidth } from "./hooks";
import { LINE_LABEL, PART_LABEL, SPLIT_LABEL } from "./labels";
import { LineKey } from "./LineKey";
import { Overview } from "./Overview";
import { linePath, stepPath } from "./paths";
import type { StatsPrefs, XAxis } from "./prefs";
import { formatDay, formatMoment, linear, niceStep, secondsLabel, ticks, timeAxis, timeTicks, type Tick } from "./scale";
import { minSpan, panView, zoomView, type View } from "./view";

const HEIGHT = 300;
const PICK_RADIUS = 12;
const READOUT_GAP = 16;

/** Fewer dots get bigger and darker, so a zoomed-in stretch reads as individual solves. */
function dotStyle(count: number, plotWidth: number): { radius: number; alpha: number } {
  const perPixel = count / Math.max(1, plotWidth);
  if (perPixel > 6) return { radius: 1.4, alpha: 0.18 };
  if (perPixel > 1.5) return { radius: 1.5, alpha: 0.3 };
  if (perPixel > 0.5) return { radius: 1.9, alpha: 0.38 };
  if (perPixel > 0.12) return { radius: 2.4, alpha: 0.5 };
  return { radius: 3, alpha: 0.62 };
}

export function xTicks(x: XAxis, [v0, v1]: View, plotWidth: number): Tick[] {
  const count = Math.max(2, Math.floor(plotWidth / 90));
  if (x === "date") return timeTicks(v0, v1, count);
  // Solve numbers are shown from 1; the axis itself counts from 0.
  const step = Math.max(1, niceStep(v1 - v0, count));
  return ticks(v0 + 1, v1 + 1, count, step).map((n) => ({ value: n - 1, label: String(n) }));
}

type Props = {
  trend: Trend;
  /** Index of the first point inside the chosen range. */
  from: number;
  x: XAxis;
  parts: readonly Part[];
  lines: StatsPrefs["lines"];
  view: View;
  extent: View;
  onView: (view: View | null) => void;
  hoverX: number | null;
  onHover: (x: number | null) => void;
  onOpen: (id: string) => void;
};

export function TrendChart({ trend, from, x, parts, lines, view, extent, onView, hoverX, onHover, onOpen }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLDivElement>(null);
  const drag = useRef<{ clientX: number; view: View; moved: boolean } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [keyIndex, setKeyIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const width = useWidth(box);
  const readoutSize = useBoxSize(readout);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const { points } = trend;
  const [v0, v1] = view;
  const keys = useMemo(() => points.map((p) => (x === "solve" ? p.n : p.t)), [points, x]);
  const lo = Math.max(from, firstAtOrAfter(keys, v0));
  const hi = lastAtOrBefore(keys, v1);
  const visible = Math.max(0, hi - lo + 1);

  const xScale = useMemo(() => linear([v0, v1], [MARGIN.left, MARGIN.left + plotWidth]), [v0, v1, plotWidth]);
  const yAxis = useMemo(() => {
    const values: number[] = [];
    for (let i = lo; i <= hi; i++) values.push(points[i]?.value ?? Infinity);
    const best = lines.pb ? trend.pb[hi] : undefined;
    return timeAxis(values, best === undefined ? [] : [best], 5);
  }, [points, lo, hi, lines.pb, trend.pb]);
  const yScale = useMemo(() => linear(yAxis.domain, [MARGIN.top + plotHeight, MARGIN.top]), [yAxis, plotHeight]);
  const { radius, alpha } = dotStyle(visible, plotWidth);

  useEffect(() => {
    const canvas = dots.current;
    if (!canvas || width === 0) return;
    const context = prepareCanvas(canvas, width, HEIGHT);
    if (!context) return;
    const sprite = dotSprite({ radius, alpha, color: cssColor(canvas, "--ink", "#3a2e28") });
    context.save();
    context.beginPath();
    context.rect(MARGIN.left - radius - 1, MARGIN.top - radius - 1, plotWidth + 2 * radius + 2, plotHeight + 2 * radius + 2);
    context.clip();
    for (let i = lo; i <= hi; i++) {
      const point = points[i];
      const key = keys[i];
      if (!point || key === undefined || !Number.isFinite(point.value)) continue;
      stamp(context, sprite, xScale.at(key), yScale.at(point.value));
    }
    context.restore();
  }, [width, plotWidth, plotHeight, points, keys, lo, hi, xScale, yScale, radius, alpha]);

  const paths = useMemo(() => {
    if (hi < lo) return { ao100: "", ao12: "", pb: "" };
    const start = Math.max(0, lo - 1);
    return {
      ao100: lines.ao100 ? linePath(keys, trend.ao100, start, hi + 1, xScale, yScale) : "",
      ao12: lines.ao12 ? linePath(keys, trend.ao12, start, hi + 1, xScale, yScale) : "",
      pb: lines.pb ? stepPath(keys, trend.pb, start, hi + 1, xScale, yScale) : "",
    };
  }, [keys, trend, lo, hi, lines.ao100, lines.ao12, lines.pb, xScale, yScale]);

  const xAxisTicks = useMemo(() => xTicks(x, [v0, v1], plotWidth), [x, v0, v1, plotWidth]);

  // ---------- what the cursor reads ----------

  const hovering = hoverX !== null && hoverX >= v0 && hoverX <= v1 && plotWidth > 0;
  const cursorIndex = !hovering ? -1 : x === "solve" ? nearestIndex(keys, hoverX) : lastAtOrBefore(keys, hoverX);
  const picked = keyIndex ?? (pointer && hovering ? pick(pointer) : null);
  const lineIndex = picked ?? cursorIndex;
  const pickedPoint = picked === null ? undefined : points[picked];
  const cursorPoint = cursorIndex >= from ? points[cursorIndex] : undefined;
  const shown: TrendPoint | undefined = pickedPoint ?? (x === "solve" ? cursorPoint : undefined);
  const lineAt = lineIndex >= from ? lineIndex : -1;
  const series = [
    { key: "ao100" as const, on: lines.ao100, value: trend.ao100[lineAt] },
    { key: "ao12" as const, on: lines.ao12, value: trend.ao12[lineAt] },
    { key: "pb" as const, on: lines.pb, value: trend.pb[lineAt] },
  ].filter((s) => s.on);

  /** The dot nearest the pointer, if one is within reach: the only way a solve gets selected. */
  function pick(at: { x: number; y: number }): number | null {
    const start = Math.max(lo, firstAtOrAfter(keys, xScale.invert(at.x - PICK_RADIUS)));
    const end = Math.min(hi, lastAtOrBefore(keys, xScale.invert(at.x + PICK_RADIUS)));
    let best: number | null = null;
    let bestDistance = PICK_RADIUS * PICK_RADIUS;
    for (let i = start; i <= end; i++) {
      const point = points[i];
      const key = keys[i];
      if (!point || key === undefined || !Number.isFinite(point.value)) continue;
      const distance = (xScale.at(key) - at.x) ** 2 + (yScale.at(point.value) - at.y) ** 2;
      if (distance <= bestDistance) {
        best = i;
        bestDistance = distance;
      }
    }
    return best;
  }

  const cursorPx = hovering ? xScale.at(hoverX) : 0;
  const anchorY = pickedPoint ? yScale.at(pickedPoint.value) : (pointer?.y ?? MARGIN.top + plotHeight * 0.3);
  let readoutLeft = cursorPx + READOUT_GAP;
  if (readoutLeft + readoutSize.width > width) readoutLeft = cursorPx - READOUT_GAP - readoutSize.width;
  readoutLeft = clamp(readoutLeft, 0, Math.max(0, width - readoutSize.width));
  const readoutTop = clamp(anchorY - readoutSize.height / 2, 0, Math.max(0, HEIGHT - readoutSize.height));
  const when = x === "solve" ? (shown ? `#${shown.n + 1} · ${formatDay(shown.t)}` : "") : hovering ? formatMoment(shown?.t ?? hoverX) : "";
  const metricLabel = parts.map((part) => PART_LABEL[part]).join(" + ");

  // ---------- interaction ----------

  function localPoint(e: PointerEvent<HTMLDivElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left + MARGIN.left, y: e.clientY - rect.top + MARGIN.top };
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { clientX: e.clientX, view, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const at = localPoint(e);
    const current = drag.current;
    if (current) {
      const dx = e.clientX - current.clientX;
      const moved = current.moved || Math.abs(dx) > 3;
      if (moved && !current.moved) {
        drag.current = { ...current, moved };
        setDragging(true);
      }
      if (moved) onView(panView(current.view, extent, (-dx * (current.view[1] - current.view[0])) / Math.max(1, plotWidth), minSpan(x)));
    }
    setPointer(at);
    setKeyIndex(null);
    onHover(xScale.invert(at.x));
  }

  function onPointerUp() {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    if (current && !current.moved && pickedPoint) onOpen(pickedPoint.id);
  }

  function onPointerCancel() {
    drag.current = null;
    setDragging(false);
  }

  function onPointerLeave() {
    if (drag.current) return;
    setPointer(null);
    onHover(null);
  }

  function step(to: number) {
    const index = clamp(to, from, points.length - 1);
    const key = keys[index];
    if (key === undefined) return;
    setKeyIndex(index);
    setPointer(null);
    onHover(key);
    if (key < v0 || key > v1) onView(panView(view, extent, key < v0 ? key - v0 - (v1 - v0) * 0.1 : key - v1 + (v1 - v0) * 0.1, minSpan(x)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = keyIndex ?? (cursorIndex >= from ? cursorIndex : hi);
    const anchor = hoverX ?? (v0 + v1) / 2;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight":
        step(current + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1));
        break;
      case "Home":
        step(lo);
        break;
      case "End":
        step(hi);
        break;
      case "Enter":
        if (pickedPoint) onOpen(pickedPoint.id);
        break;
      case "+":
      case "=":
        onView(zoomView(view, extent, 0.7, anchor, minSpan(x)));
        break;
      case "-":
      case "_":
        onView(zoomView(view, extent, 1 / 0.7, anchor, minSpan(x)));
        break;
      case "Escape":
      case "0":
        onView(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  function onBlur() {
    setKeyIndex(null);
    if (!pointer) onHover(null);
  }

  // Trackpad pinch (and ctrl/cmd + wheel) zooms around the pointer; a sideways swipe pans. A plain vertical
  // scroll is left to the page, so scrolling past the chart never gets stuck in it.
  const onWheel = useEffectEvent((e: WheelEvent) => {
    const element = hit.current;
    if (!element || plotWidth === 0) return;
    const px = e.clientX - element.getBoundingClientRect().left + MARGIN.left;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onView(zoomView(view, extent, Math.exp(clamp(e.deltaY, -50, 50) * 0.01), xScale.invert(px), minSpan(x)));
      return;
    }
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    onView(panView(view, extent, (e.deltaX * (v1 - v0)) / plotWidth, minSpan(x)));
  });

  useEffect(() => {
    const element = hit.current;
    if (!element) return;
    const listener = (e: WheelEvent) => onWheel(e);
    element.addEventListener("wheel", listener, { passive: false });
    return () => element.removeEventListener("wheel", listener);
  }, []);

  const pickedKey = picked === null ? undefined : keys[picked];
  const pickRing = pickedPoint && pickedKey !== undefined ? { cx: xScale.at(pickedKey), cy: yScale.at(pickedPoint.value) } : null;
  const markerX = lineAt >= 0 ? keys[lineAt] : undefined;

  return (
    <div className="trend" ref={box}>
      <div className="trend-main" style={{ height: HEIGHT }}>
        <svg className="trend-grid" width={width} height={HEIGHT} aria-hidden="true">
          {yAxis.ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={crisp(yScale.at(t))} y2={crisp(yScale.at(t))} />
              <text x={MARGIN.left - 10} y={yScale.at(t)} dy="0.32em" textAnchor="end">
                {secondsLabel(t, yAxis.step)}
              </text>
            </g>
          ))}
          {xAxisTicks.map((t) => (
            <text key={t.value} x={xScale.at(t.value)} y={HEIGHT - 8} textAnchor="middle">
              {t.label}
            </text>
          ))}
        </svg>
        <canvas ref={dots} className="trend-dots" style={{ width, height: HEIGHT }} />
        <svg className="trend-lines" width={width} height={HEIGHT} aria-hidden="true">
          <defs>
            <clipPath id="trend-clip">
              <rect x={MARGIN.left} y={MARGIN.top - 2} width={plotWidth} height={plotHeight + 4} />
            </clipPath>
          </defs>
          <g clipPath="url(#trend-clip)">
            {paths.pb && <path className="line-pb" d={paths.pb} />}
            {paths.ao12 && <path className="line-ao12" d={paths.ao12} />}
            {paths.ao100 && <path className="line-ao100" d={paths.ao100} />}
          </g>
          {hovering && (
            <g>
              <line className="crosshair" x1={crisp(cursorPx)} x2={crisp(cursorPx)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
              {markerX !== undefined &&
                series.map((s) =>
                  s.value != null && Number.isFinite(s.value) ? (
                    <circle key={s.key} className={`marker marker-${s.key}`} cx={xScale.at(markerX)} cy={yScale.at(s.value)} r={3.5} />
                  ) : null,
                )}
              {pickRing && <circle className="pick-ring" cx={pickRing.cx} cy={pickRing.cy} r={radius + 4} />}
              {!pickRing && x === "solve" && cursorPoint && Number.isFinite(cursorPoint.value) && (
                <circle className="slice-ring" cx={xScale.at(cursorPoint.n)} cy={yScale.at(cursorPoint.value)} r={radius + 3} />
              )}
            </g>
          )}
        </svg>
        <div
          ref={hit}
          className={`trend-hit ${pickedPoint ? "picking" : ""} ${dragging ? "dragging" : ""}`}
          style={{ left: MARGIN.left, top: MARGIN.top, width: plotWidth, height: plotHeight }}
          tabIndex={0}
          role="group"
          aria-label="Solve times. Arrow keys step through solves, Enter opens one, plus and minus zoom, Escape resets."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerLeave}
          onDoubleClick={() => onView(null)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        />
        <div
          ref={readout}
          className={`trend-readout ${hovering && (shown || series.length > 0) ? "" : "off"}`}
          style={{ left: readoutLeft, top: readoutTop }}
          aria-live={keyIndex === null ? "off" : "polite"}
        >
          {when && <div className="when">{when}</div>}
          {shown && (
            <div className="value">
              {showTime(shown.value)}
              {metricLabel && <span className="metric">{metricLabel}</span>}
            </div>
          )}
          {shown?.splits && (
            <dl className="splits">
              {parts.length > 0 && (
                <div className="row">
                  <dt>Solve</dt>
                  <dd>{showTime(shown.result)}</dd>
                </div>
              )}
              {(["cross", "f2l", "ll"] as const).map((part) => (
                <div key={part} className="row">
                  <dt>{SPLIT_LABEL[part]}</dt>
                  <dd>{showTime(shown.splits?.[part])}</dd>
                </div>
              ))}
            </dl>
          )}
          {series.length > 0 && (
            <dl className="series">
              {series.map((s) => (
                <div key={s.key} className="row">
                  <dt>
                    <LineKey line={s.key} />
                    {LINE_LABEL[s.key]}
                  </dt>
                  <dd>{showTime(s.value === undefined || (s.key === "pb" && !Number.isFinite(s.value)) ? null : s.value)}</dd>
                </div>
              ))}
            </dl>
          )}
          {pickedPoint && <div className="open">Review →</div>}
        </div>
      </div>
      <Overview
        width={width}
        points={points}
        keys={keys}
        from={from}
        ao100={trend.ao100}
        extent={extent}
        view={view}
        x={x}
        onView={onView}
      />
    </div>
  );
}
