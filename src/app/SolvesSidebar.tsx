import { Trash2 } from "lucide-react";
import { averageOf, formatAverage, resultMs } from "@/app/lib/averages";
import { isCharted } from "@/app/pages/stats/data";
import { formatMs } from "@/app/lib/format";
import { navigate } from "@/app/lib/router";
import { deleteSolve } from "@/app/lib/store";
import type { SolveRecord } from "@/cube/types";

function label(solve: SolveRecord): string {
  if (solve.penalty === "dnf") return "DNF";
  return formatMs(resultMs(solve)) + (solve.penalty === "+2" ? "+" : "");
}

/** The list shows the newest solves; the stats page has the full history. */
const LISTED = 200;

/** The timer's sidebar: recent solves (pick one to see it on the timer), then the averages. */
export function SolvesSidebar({ solves, selectedId }: { solves: readonly SolveRecord[]; selectedId?: string }) {
  // Same solves as the stats page: test solves and old virtual-cube solves never count toward your averages.
  const results = solves.filter(isCharted).map(resultMs);
  return (
    <>
      <ul className="solves">
        {solves.slice(0, LISTED).map((solve) => (
          <li
            key={solve.id}
            className={[solve.analysis ? "reviewable" : "", solve.id === selectedId ? "selected" : ""].join(" ")}
          >
            <button className="time" onClick={() => navigate(`/?s=${encodeURIComponent(solve.id)}`)}>
              <span className="dot" />
              {label(solve)}
            </button>
            <button className="delete" aria-label="Delete solve" onClick={() => deleteSolve(solve.id)}>
              <Trash2 strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <dl className="averages">
        <dt>ao5</dt>
        <dd>{formatAverage(averageOf(results, 5))}</dd>
        <dt>ao12</dt>
        <dd>{formatAverage(averageOf(results, 12))}</dd>
        <dt>ao100</dt>
        <dd>{formatAverage(averageOf(results, 100))}</dd>
      </dl>
    </>
  );
}
