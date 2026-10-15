import { median } from "@/app/lib/averages";
import { formatSeconds } from "@/app/lib/format";
import type { SolveAnalysis, SolveRecord } from "@/cube/types";

/** Needs this many earlier solves with the same stage before tinting faster/slower. */
const MIN_HISTORY = 3;
const MARGIN = 0.1;

type Props = { analysis: SolveAnalysis; history: readonly SolveRecord[] };

function usualMs(label: string, history: readonly SolveRecord[]): number | null {
  const times = history.flatMap((s) => s.analysis?.stages.filter((st) => st.label === label).map((st) => st.totalMs) ?? []);
  return times.length >= MIN_HISTORY ? median(times) : null;
}

export function Breakdown({ analysis, history }: Props) {
  return (
    <div className="breakdown">
      {analysis.stages.map((stage, i) => {
        const usual = usualMs(stage.label, history);
        const tone =
          usual === null ? "" : stage.totalMs < usual * (1 - MARGIN) ? "faster" : stage.totalMs > usual * (1 + MARGIN) ? "slower" : "";
        return (
          <div key={i} className={`split ${tone}`}>
            <span className="label">{stage.label}</span>
            <span className="value">{formatSeconds(stage.totalMs)}</span>
          </div>
        );
      })}
    </div>
  );
}
