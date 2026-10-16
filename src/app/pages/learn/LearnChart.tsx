import { median } from "@/app/lib/averages";
import { formatSeconds } from "@/app/lib/format";

// Drawn in mockup pixels (round-9 08): the SVG spans the main column, so 1 unit ≈ 1 mockup pixel.
const W = 1090;
const H = 236;
const PAD = { left: 48, right: 62, top: 12, bottom: 26 };
/** The trend is the median of this many reps around each point: steady enough to read through noisy reps. */
const TREND_WINDOW = 15;
const TICKS = 5;

function trend(times: readonly number[]): number[] {
  const half = Math.floor(TREND_WINDOW / 2);
  return times.map((_, i) => median(times.slice(Math.max(0, i - half), i + half + 1)) ?? 0);
}

/** Every correct rep of a set as a dot, oldest to newest, with the trend line and its latest value. */
export function LearnChart({ times }: { times: readonly number[] }) {
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const axes = (
    <g className="axes">
      <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} />
      <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} />
    </g>
  );
  if (times.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="learn-chart" role="img" aria-label="No reps yet">
        {axes}
      </svg>
    );
  }
  const line = trend(times);
  const lo = Math.max(0, Math.min(...times) * 0.9);
  const hi = Math.max(...times) * 1.05;
  const x = (i: number) => PAD.left + 12 + (times.length === 1 ? 0.5 : i / (times.length - 1)) * (plotW - 12);
  const y = (ms: number) => PAD.top + (1 - (ms - lo) / (hi - lo || 1)) * plotH;
  const ticks = Array.from({ length: TICKS }, (_, i) => lo + ((hi - lo) * i) / (TICKS - 1));
  const path = line.map((ms, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(ms).toFixed(1)}`).join(" ");
  const last = line.at(-1) ?? 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="learn-chart" role="img" aria-label="Rep times">
      {ticks.map((t) => (
        <text key={t} x={PAD.left - 14} y={y(t) + 5} textAnchor="end" className="tick">
          {formatSeconds(t)}
        </text>
      ))}
      {axes}
      {times.map((ms, i) => (
        <circle key={i} cx={x(i)} cy={y(ms)} r={2.6} className="rep" />
      ))}
      <path d={path} className="trend" />
      <text x={W - PAD.right + 14} y={y(last) + 7} className="last">
        {formatSeconds(last)}
      </text>
    </svg>
  );
}
