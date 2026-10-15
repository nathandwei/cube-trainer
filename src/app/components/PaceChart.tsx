import type { MouseEvent } from "react";
import type { SolveAnalysis, TimedMove } from "@/cube/types";

const W = 600;
const H = 120;
const PAD = 6;

type Props = {
  moves: readonly TimedMove[];
  totalMs: number;
  analysis: SolveAnalysis;
  index: number;
  onSeek: (index: number) => void;
};

/** Moves completed against time, like chess.com's evaluation graph: flat stretches are pauses. */
export function PaceChart({ moves, totalMs, analysis, index, onSeek }: Props) {
  if (moves.length === 0 || totalMs <= 0) return null;
  const x = (t: number) => PAD + (t / totalMs) * (W - 2 * PAD);
  const y = (n: number) => H - PAD - (n / moves.length) * (H - 2 * PAD);
  const steps = moves.map((m, i) => `L${x(m.t).toFixed(1)},${y(i).toFixed(1)} L${x(m.t).toFixed(1)},${y(i + 1).toFixed(1)}`);
  const line = `M${x(0)},${y(0)} ${steps.join(" ")}`;
  const area = `${line} L${x(totalMs)},${y(moves.length)} L${x(totalMs)},${H - PAD} L${x(0)},${H - PAD} Z`;
  const headT = index === 0 ? 0 : (moves[index - 1]?.t ?? totalMs);

  function seek(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const t = ((event.clientX - box.left) / box.width) * totalMs;
    const after = moves.findIndex((m) => m.t > t);
    onSeek(after === -1 ? moves.length : after);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pace" onClick={seek} role="slider" aria-label="pace" aria-valuenow={index}>
      {analysis.stages.map((stage, i) => {
        const from = stage.startMove === 0 ? 0 : (moves[stage.startMove - 1]?.t ?? 0);
        const to = moves[stage.endMove - 1]?.t ?? totalMs;
        return (
          <g key={i}>
            <rect x={x(from)} y={PAD} width={Math.max(0, x(to) - x(from))} height={H - 2 * PAD} fill={i % 2 ? "var(--page)" : "transparent"} opacity={0.7} />
            <text x={x(from) + 4} y={PAD + 11} className="pace-label">
              {stage.label}
            </text>
          </g>
        );
      })}
      <path d={area} fill="var(--accent-tint)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
      <line x1={x(headT)} x2={x(headT)} y1={PAD} y2={H - PAD} stroke="var(--ink)" strokeWidth={1.5} />
    </svg>
  );
}
