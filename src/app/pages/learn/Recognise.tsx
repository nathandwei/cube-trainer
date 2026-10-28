import { getCase } from "@/cube";
import { CaseDiagram } from "./CaseDiagram";
import type { Angle } from "./recognition";

type Props = { caseId: string; angles: readonly Angle[]; at: number; onAt: (quarters: number) => void };

function Feature({ label, value }: { label: string; value: string }) {
  return (
    <div className="case-stat">
      <span className="case-stat-label">{label}</span>
      <span className="case-stat-value">{value}</span>
    </div>
  );
}

/**
 * Telling the case from two sides (recognition.ts): its four angles as he holds it, each with the U turn that gets him
 * to where his alg starts, and for the one picked (`at`, in quarter turns from that start) what it shows and the
 * cases that show the same, with the stickers that tell them apart ringed.
 */
export function Recognise({ caseId, angles, at, onAt }: Props) {
  const caseDef = getCase(caseId);
  const angle = angles.find((a) => a.quarters === at) ?? angles[0];
  if (!angle) return null;
  const { features, lookalikes } = angle;
  return (
    <div className="recognise">
      <div className="recognise-angles">
        {angles.map((a) => (
          <button
            key={a.quarters}
            className={`recognise-angle ${a === angle ? "on" : ""}`}
            aria-pressed={a === angle}
            aria-label={a.preAuf || "Start"}
            onClick={() => onAt(a.quarters)}
          >
            <CaseDiagram caseDef={caseDef} view="iso" auf={a.auf} size={150} />
            <span className={`recognise-turn ${a.preAuf ? "" : "start"}`}>{a.preAuf || "Start"}</span>
          </button>
        ))}
      </div>
      <div className="case-stat-row recognise-features">
        <Feature label="Left" value={features.left} />
        <Feature label="Right" value={features.right} />
        <Feature label="Colours" value={String(features.colours)} />
        <Feature label="Bookends" value={features.bookends ? "Yes" : "No"} />
      </div>
      <div className="recognise-lookalikes">
        <span className="case-stat-label">Looks like</span>
        {lookalikes.length === 0 ? (
          <span className="recognise-none">–</span>
        ) : (
          lookalikes.map((lookalike) => {
            const other = getCase(lookalike.caseId);
            return (
              <span key={lookalike.caseId} className="recognise-lookalike">
                <CaseDiagram caseDef={other} view="iso" auf={lookalike.auf} marks={lookalike.differ} size={90} />
                <span className="name">{other.name}</span>
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}
