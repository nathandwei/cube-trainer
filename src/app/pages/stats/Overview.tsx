import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MARGIN } from "./chart";
import { cssColor, dotSprite, prepareCanvas, stamp } from "./canvas";
import type { TrendPoint } from "./data";
import { linePath } from "./paths";
import type { XAxis } from "./prefs";
import { linear, timeAxis } from "./scale";
import { clampView, isFull, minSpan, panView, zoomView, type View } from "./view";

const HEIGHT = 46;
const PAD_Y = 6;
/** How close (px) to a window edge the pointer must be to grab it. */
const EDGE = 7;

type Mode = "move" | "left" | "right" | "create";

/** The strip is tiny, so a long history fades each dot further to stay a band rather than a smear. */
function overviewDots(count: number, plotWidth: number): { radius: number; alpha: number } {
  const perPixel = count / Math.max(1, plotWidth);
  if (perPixel > 8) return { radius: 1, alpha: 0.07 };
  if (perPixel > 2) return { radius: 1, alpha: 0.14 };
  if (perPixel > 0.5) return { radius: 1.1, alpha: 0.26 };
  if (perPixel > 0.15) return { radius: 1.3, alpha: 0.36 };
  return { radius: 1.6, alpha: 0.45 };
}

type Props = {
  width: number;
  points: readonly TrendPoint[];
  keys: readonly number[];
  from: number;
  ao100: readonly (number | null)[];
  extent: View;
  view: View;
  x: XAxis;
  onView: (view: View | null) => void;
};

/** The whole range in miniature, with the main chart's window as a brush: drag it, resize it, or draw a new one. */
export function Overview({ width, points, keys, from, ao100, extent, view, x, onView }: Props) {
  const dots = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: Mode; startPx: number; view: View; moved: boolean } | null>(null);
  const [zone, setZone] = useState<Mode>("create");
  const [dragMode, setDragMode] = useState<Mode | null>(null);
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const [e0, e1] = extent;
  const xScale = useMemo(() => linear([e0, e1], [MARGIN.left, MARGIN.left + plotWidth]), [e0, e1, plotWidth]);
  const yScale = useMemo(() => {
    const axis = timeAxis(points.slice(from).map((p) => p.value), [], 2);
    return linear(axis.domain, [HEIGHT - PAD_Y, PAD_Y]);
  }, [points, from]);
  const zoomed = !isFull(view, extent);
  const left = xScale.at(view[0]);
  const right = xScale.at(view[1]);
  const min = minSpan(x);

  useEffect(() => {
    const canvas = dots.current;
    if (!canvas || width === 0) return;
    const context = prepareCanvas(canvas, width, HEIGHT);
    if (!context) return;
    const sprite = dotSprite({ ...overviewDots(points.length - from, plotWidth), color: cssColor(canvas, "--ink", "#3a2e28") });
    context.save();
    context.beginPath();
    context.rect(MARGIN.left - 2, 0, plotWidth + 4, HEIGHT);
    context.clip();
    for (let i = from; i < points.length; i++) {
      const point = points[i];
      const key = keys[i];
      if (!point || key === undefined || !Number.isFinite(point.value)) continue;
      stamp(context, sprite, xScale.at(key), yScale.at(point.value));
    }
    context.restore();
  }, [width, plotWidth, points, keys, from, xScale, yScale]);

  const trendPath = useMemo(() => linePath(keys, ao100, from, keys.length - 1, xScale, yScale), [keys, ao100, from, xScale, yScale]);

  function zoneAt(px: number): Mode {
    if (!zoomed) return "create";
    if (Math.abs(px - left) <= EDGE) return "left";
    if (Math.abs(px - right) <= EDGE) return "right";
    return px > left && px < right ? "move" : "create";
  }

  function localX(e: PointerEvent<HTMLDivElement>): number {
    return e.clientX - e.currentTarget.getBoundingClientRect().left + MARGIN.left - EDGE;
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || plotWidth === 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const px = localX(e);
    const mode = zoneAt(px);
    drag.current = { mode, startPx: px, view, moved: false };
    setDragMode(mode);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const px = localX(e);
    const current = drag.current;
    if (!current) {
      setZone(zoneAt(px));
      return;
    }
    const moved = current.moved || Math.abs(px - current.startPx) > 3;
    if (!moved) return;
    if (!current.moved) drag.current = { ...current, moved };
    const [a, b] = current.view;
    const at = xScale.invert(px);
    switch (current.mode) {
      case "move":
        onView(panView(current.view, extent, at - xScale.invert(current.startPx), min));
        break;
      case "left":
        onView(clampView([Math.min(at, b - min), b], extent, min));
        break;
      case "right":
        onView(clampView([a, Math.max(at, a + min)], extent, min));
        break;
      case "create": {
        const start = xScale.invert(current.startPx);
        onView(clampView([Math.min(start, at), Math.max(start, at)], extent, min));
        break;
      }
    }
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    drag.current = null;
    setDragMode(null);
    if (!current || current.moved || current.mode !== "create") return;
    // A click away from the window moves it there (or opens one a fifth of the range wide).
    const centre = xScale.invert(localX(e));
    const span = zoomed ? view[1] - view[0] : (e1 - e0) / 5;
    onView(clampView([centre - span / 2, centre + span / 2], extent, min));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const span = view[1] - view[0];
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight":
        onView(panView(view, extent, (e.key === "ArrowLeft" ? -1 : 1) * span * (e.shiftKey ? 0.5 : 0.1), min));
        break;
      case "Home":
        onView(panView(view, extent, e0 - view[0], min));
        break;
      case "End":
        onView(panView(view, extent, e1 - view[1], min));
        break;
      case "+":
      case "=":
        onView(zoomView(view, extent, 0.7, (view[0] + view[1]) / 2, min));
        break;
      case "-":
      case "_":
        onView(zoomView(view, extent, 1 / 0.7, (view[0] + view[1]) / 2, min));
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

  const active = dragMode ?? zone;
  const cursor = dragMode === "move" ? "grabbing" : active === "move" ? "grab" : active === "create" ? "crosshair" : "ew-resize";

  return (
    <div className="overview" style={{ height: HEIGHT }}>
      <canvas ref={dots} className="overview-dots" style={{ width, height: HEIGHT }} />
      <svg className="overview-lines" width={width} height={HEIGHT} aria-hidden="true">
        <line className="overview-base" x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} />
        {trendPath && <path className="overview-trend" d={trendPath} />}
        {zoomed && (
          <g className="brush">
            <rect x={left} y={1} width={Math.max(1, right - left)} height={HEIGHT - 2} />
            <line x1={Math.round(left)} x2={Math.round(left)} y1={1} y2={HEIGHT - 1} />
            <line x1={Math.round(right)} x2={Math.round(right)} y1={1} y2={HEIGHT - 1} />
          </g>
        )}
      </svg>
      <div
        className="overview-hit"
        style={{ left: MARGIN.left - EDGE, width: plotWidth + 2 * EDGE, cursor }}
        tabIndex={0}
        role="slider"
        aria-label="Zoom window. Drag to choose solves; arrow keys pan, plus and minus zoom, Escape shows everything."
        aria-valuemin={Math.round(e0)}
        aria-valuemax={Math.round(e1)}
        aria-valuenow={Math.round((view[0] + view[1]) / 2)}
        aria-valuetext={zoomed ? "zoomed" : "everything"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragMode(null);
        }}
        onDoubleClick={() => onView(null)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
