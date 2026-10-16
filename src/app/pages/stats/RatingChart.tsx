import { memo, useMemo, useRef, type PointerEvent } from "react";
import { crisp } from "./chart";
import { firstAtOrAfter, lastAtOrBefore, type PlacedRating } from "./data";
import { useWidth } from "./hooks";
import { bandPath, linePath } from "./paths";
import { linear, type Axis } from "./scale";
import type { View } from "./view";

const HEIGHT = 128;
const M = { left: 38, right: 6, top: 6, bottom: 6 };

type Props = {
  label: string;
  points: readonly PlacedRating[];
  domain: View;
  /** Shared by the three charts, so the parts compare at a glance. */
  axis: Axis;
  hoverX: number | null;
  /** Absent when this chart's x axis is not the main chart's (it then keeps its crosshair to itself). */
  onHover?: (x: number | null) => void;
};

/** One part's rating over the same stretch as the main chart, over the band of its usual performances. */
export const RatingChart = memo(function RatingChart({ label, points, domain, axis, hoverX, onHover }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  const plotWidth = Math.max(0, width - M.left - M.right);
  const [d0, d1] = domain;
  const keys = useMemo(() => points.map((p) => p.x), [points]);
  const lo = firstAtOrAfter(keys, d0);
  const hi = lastAtOrBefore(keys, d1);

  const xScale = useMemo(() => linear([d0, d1], [M.left, M.left + plotWidth]), [d0, d1, plotWidth]);
  const yScale = useMemo(() => linear(axis.domain, [HEIGHT - M.bottom, M.top]), [axis]);
  const shapes = useMemo(() => {
    const start = Math.max(0, lo - 1);
    const lows = points.map((p) => p.low);
    const highs = points.map((p) => p.high);
    return {
      band: bandPath(keys, lows, highs, start, hi + 1, xScale, yScale),
      line: linePath(keys, points.map((p) => p.rating), start, hi + 1, xScale, yScale),
    };
  }, [points, keys, lo, hi, xScale, yScale]);

  const hovering = hoverX !== null && hoverX >= d0 && hoverX <= d1;
  const hoverIndex = hovering ? lastAtOrBefore(keys, hoverX) : -1;
  const shown = hovering ? points[hoverIndex] : points[points.length - 1];
  const marker = hovering && hoverIndex >= lo ? points[hoverIndex] : undefined;

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left + M.left;
    onHover?.(xScale.invert(px));
  }

  return (
    <figure className="rating-chart">
      <figcaption>
        <span className="label">{label}</span>
        <span className="num">{shown ? Math.round(shown.rating) : "–"}</span>
      </figcaption>
      <div className="rating-plot" ref={box} style={{ height: HEIGHT }}>
        <svg width={width} height={HEIGHT} aria-hidden="true">
          {axis.ticks.map((t) => (
            <g key={t} className="grid">
              <line x1={M.left} x2={M.left + plotWidth} y1={crisp(yScale.at(t))} y2={crisp(yScale.at(t))} />
              <text x={M.left - 8} y={yScale.at(t)} dy="0.32em" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          <defs>
            <clipPath id={`rating-clip-${label}`}>
              <rect x={M.left} y={0} width={plotWidth} height={HEIGHT} />
            </clipPath>
          </defs>
          <g clipPath={`url(#rating-clip-${label})`}>
            {shapes.band && <path className="rating-band" d={shapes.band} />}
            {shapes.line && <path className="rating-line" d={shapes.line} />}
          </g>
          {hovering && (
            <line className="crosshair" x1={crisp(xScale.at(hoverX))} x2={crisp(xScale.at(hoverX))} y1={M.top} y2={HEIGHT - M.bottom} />
          )}
          {marker && <circle className="marker marker-rating" cx={xScale.at(marker.x)} cy={yScale.at(marker.rating)} r={3.5} />}
        </svg>
        <div
          className="rating-hit"
          style={{ left: M.left, width: plotWidth }}
          onPointerMove={onHover ? onPointerMove : undefined}
          onPointerLeave={onHover ? () => onHover(null) : undefined}
        />
      </div>
    </figure>
  );
});
