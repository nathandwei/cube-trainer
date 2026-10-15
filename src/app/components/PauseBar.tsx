import type { MouseEvent } from "react";
import { PAUSE_MS } from "@/app/lib/review";
import type { SolveAnalysis, TimedMove } from "@/cube/types";

const WIDTH = 1000;

type Props = {
  moves: readonly TimedMove[];
  totalMs: number;
  /** Color turning by stage (review) instead of one ink (timer). */
  analysis?: SolveAnalysis;
  /** Moves applied so far; draws a playhead. */
  index?: number;
  onSeek?: (index: number) => void;
  height?: number;
};

type Run = { from: number; to: number; stage: number };

function turningRuns(moves: readonly TimedMove[], analysis?: SolveAnalysis): Run[] {
  const runs: Run[] = [];
  let stage = 0;
  moves.forEach(({ t }, i) => {
    if (analysis) {
      while (stage < analysis.stages.length - 1 && i >= (analysis.stages[stage]?.endMove ?? Infinity)) stage++;
    }
    const last = runs.at(-1);
    const previousT = moves[i - 1]?.t;
    const joins = last && previousT !== undefined && t - previousT <= PAUSE_MS && last.stage === stage;
    if (joins) last.to = t;
    else runs.push({ from: previousT !== undefined && t - previousT <= PAUSE_MS ? previousT : t, to: t, stage });
  });
  return runs;
}

const STAGE_TONES = ["var(--ink)", "var(--accent)"];

export function PauseBar({ moves, totalMs, analysis, index, onSeek, height = 10 }: Props) {
  if (moves.length === 0 || totalMs <= 0) return null;
  const x = (t: number) => (t / totalMs) * WIDTH;
  const playheadT = index === undefined ? undefined : index === 0 ? 0 : (moves[index - 1]?.t ?? totalMs);

  function seek(event: MouseEvent<SVGSVGElement>) {
    if (!onSeek) return;
    const box = event.currentTarget.getBoundingClientRect();
    const t = ((event.clientX - box.left) / box.width) * totalMs;
    const after = moves.findIndex((m) => m.t > t);
    onSeek(after === -1 ? moves.length : after);
  }

  return (
    <svg
      className="pausebar"
      viewBox={`0 0 ${WIDTH} ${height + 8}`}
      preserveAspectRatio="none"
      onClick={seek}
      style={{ cursor: onSeek ? "pointer" : "default", height: height + 8, width: "100%" }}
      role={onSeek ? "slider" : "img"}
      aria-label="solve timeline"
      aria-valuenow={index}
    >
      <rect x={0} y={4} width={WIDTH} height={height} rx={height / 2} fill="var(--rule)" />
      {turningRuns(moves, analysis).map((run, i) => (
        <rect
          key={i}
          x={x(run.from)}
          y={4}
          width={Math.max(2.5, x(run.to) - x(run.from))}
          height={height}
          rx={height / 2}
          fill={analysis ? STAGE_TONES[run.stage % 2] : "var(--ink)"}
          opacity={analysis ? 0.85 : 1}
        />
      ))}
      {playheadT !== undefined && <rect x={x(playheadT) - 1.5} y={0} width={3} height={height + 8} rx={1.5} fill="var(--ink)" />}
    </svg>
  );
}
