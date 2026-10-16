import { median } from "@/app/lib/averages";
import { formatSeconds } from "@/app/lib/format";
import type { SolveRecord, Stage } from "@/cube/types";

/** Needs this many comparable earlier solves before judging faster or slower. */
const MIN_HISTORY = 3;
const MARGIN = 0.05;
const HISTORY = 50;

type Chip = { label: string; ms: number };

const LAST_LAYER: readonly Stage["kind"][] = ["eo", "coll", "epll", "oll", "pll", "ll"];

/** Three chips whatever the method: the first step (cross or xcross), the rest of F2L, the last layer. */
export function chipsFor(stages: readonly Stage[]): Chip[] {
  const first = stages.find((s) => s.kind === "cross" || s.kind === "xcross");
  const f2l = stages.filter((s) => s.kind === "pair").reduce((sum, s) => sum + s.totalMs, 0);
  const ll = stages.filter((s) => LAST_LAYER.includes(s.kind)).reduce((sum, s) => sum + s.totalMs, 0);
  return [
    { label: first?.kind === "xcross" ? "xcross" : "cross", ms: first?.totalMs ?? 0 },
    { label: "f2l", ms: f2l },
    { label: "last layer", ms: ll },
  ];
}

function usualMs(label: string, history: readonly SolveRecord[]): number | null {
  const times = history
    .slice(0, HISTORY)
    .flatMap((s) => (s.analysis ? chipsFor(s.analysis.stages).filter((c) => c.label === label && c.ms > 0) : []))
    .map((c) => c.ms);
  return times.length >= MIN_HISTORY ? median(times) : null;
}

type Props = { solve: SolveRecord; history: readonly SolveRecord[] };

export function SplitChips({ solve, history }: Props) {
  if (!solve.analysis) return null;
  // Compare like with like: test solves against test solves, your solves against yours.
  const comparable = history.filter((s) => s.id !== solve.id && s.source === solve.source);
  return (
    <div className="chips">
      {chipsFor(solve.analysis.stages).map((chip) => {
        const usual = usualMs(chip.label, comparable);
        const tone = usual === null ? "" : chip.ms < usual * (1 - MARGIN) ? "faster" : chip.ms > usual * (1 + MARGIN) ? "slower" : "";
        return (
          <div key={chip.label} className={`chip ${tone}`}>
            <span className="label">{chip.label}</span>
            <span className="value">
              {formatSeconds(chip.ms)}
              {tone && <span className="arrow">{tone === "faster" ? "↑" : "↓"}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
