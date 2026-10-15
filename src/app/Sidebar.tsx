import { averageOf, resultMs } from "@/app/lib/averages";
import { formatMs } from "@/app/lib/format";
import { navigate } from "@/app/lib/router";
import { deleteSolve } from "@/app/lib/store";
import type { SolveRecord } from "@/cube/types";

type Props = { solves: readonly SolveRecord[]; selectedId?: string };

function show(ms: number | null): string {
  if (ms === null) return "–";
  return Number.isFinite(ms) ? formatMs(ms) : "DNF";
}

function label(solve: SolveRecord): string {
  if (solve.penalty === "dnf") return "DNF";
  return formatMs(resultMs(solve)) + (solve.penalty === "+2" ? "+" : "");
}

export function Sidebar({ solves, selectedId }: Props) {
  const results = solves.map(resultMs);
  return (
    <aside className="sidebar">
      <nav className="nav">
        <a
          href="/"
          className="active"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          timer
        </a>
        <span aria-disabled="true">drills</span>
        <span aria-disabled="true">cross</span>
        <span aria-disabled="true">stats</span>
      </nav>
      <ul className="solves">
        {solves.map((solve) => (
          <li
            key={solve.id}
            className={[solve.analysis ? "reviewable" : "", solve.id === selectedId ? "selected" : ""].join(" ")}
          >
            <button className="time" onClick={() => solve.analysis && navigate(`/solve/${solve.id}`)} disabled={!solve.analysis}>
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
    </aside>
  );
}
