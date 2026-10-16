import { averageOf, resultMs } from "@/app/lib/averages";
import { formatMs } from "@/app/lib/format";
import { navigate } from "@/app/lib/router";
import { deleteSolve } from "@/app/lib/store";
import type { SolveRecord } from "@/cube/types";

function show(ms: number | null): string {
  if (ms === null) return "–";
  return Number.isFinite(ms) ? formatMs(ms) : "DNF";
}

function label(solve: SolveRecord): string {
  if (solve.penalty === "dnf") return "DNF";
  return formatMs(resultMs(solve)) + (solve.penalty === "+2" ? "+" : "");
}

/** The timer's sidebar: recent solves (pick one to see it on the timer), then the averages. */
export function SolvesSidebar({ solves, selectedId }: { solves: readonly SolveRecord[]; selectedId?: string }) {
  // Test solves are computer-made, so they never count toward your averages.
  const results = solves.filter((s) => s.source !== "demo").map(resultMs);
  return (
    <>
      <ul className="solves">
        {solves.map((solve) => (
          <li
            key={solve.id}
            className={[solve.analysis ? "reviewable" : "", solve.id === selectedId ? "selected" : ""].join(" ")}
          >
            <button className="time" onClick={() => navigate(`/?s=${encodeURIComponent(solve.id)}`)}>
              <span className="dot" />
              {label(solve)}
            </button>
            <button className="delete" aria-label="delete solve" onClick={() => deleteSolve(solve.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <dl className="averages">
        <dt>ao5</dt>
        <dd>{show(averageOf(results, 5))}</dd>
        <dt>ao12</dt>
        <dd>{show(averageOf(results, 12))}</dd>
        <dt>ao100</dt>
        <dd>{show(averageOf(results, 100))}</dd>
      </dl>
    </>
  );
}
