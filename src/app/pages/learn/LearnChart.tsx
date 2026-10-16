import { formatSeconds } from "@/app/lib/format";

const W = 760;
const H = 180;
const PAD = { left: 40, right: 12, top: 12, bottom: 22 };

/** Median time per practice day for a set: dots and a line, the way the stats page draws solves. */
export function LearnChart({ points }: { points: readonly { day: number; ms: number }[] }) {
  if (points.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="learn-chart" aria-label="no sessions yet">
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--rule)" />
      </svg>
    );
  }
  const values = points.map((p) => p.ms);
  const lo = Math.max(0, Math.min(...values) * 0.85);
  const hi = Math.max(...values) * 1.1;
  const x = (i: number) => PAD.left + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (ms: number) => PAD.top + (1 - (ms - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
  const ticks = [lo, (lo + hi) / 2, hi];
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.ms).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="learn-chart" role="img" aria-label="median time per session">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--rule)" />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="tick">
            {formatSeconds(t)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={1.8} />
      {points.map((p, i) => (
        <circle key={p.day} cx={x(i)} cy={y(p.ms)} r={3} fill="var(--accent)" />
      ))}
      <text x={x(points.length - 1)} y={y(points.at(-1)?.ms ?? 0) - 8} textAnchor="end" className="last">
        {formatSeconds(points.at(-1)?.ms ?? 0)}
      </text>
    </svg>
  );
}
