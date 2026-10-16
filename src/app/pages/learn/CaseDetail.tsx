import { ArrowLeft, ArrowLeftRight, Check, GraduationCap, Minus, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { formatSeconds } from "@/app/lib/format";
import { useLearnSettings, useReps } from "@/app/lib/learnStore";
import { useAnalysisOptions } from "@/app/lib/method";
import { navigate } from "@/app/lib/router";
import { useSolves } from "@/app/lib/store";
import { algMoveCount, caseAlgSpeed, getCase, viewAuf } from "@/cube";
import { CaseDiagram } from "./CaseDiagram";
import { drillStats, solveStats } from "./caseStats";
import { currentCaseReps } from "./progress";

/** Sightings listed under the solve numbers, newest first. */
const SIGHTINGS_SHOWN = 6;

type Props = { caseId: string; alg: string; onDrill: () => void; onLearn: () => void; onChange: () => void; onBack: () => void };

function seconds(ms: number | null): string {
  return ms === null ? "–" : formatSeconds(ms);
}

function estimate(caseId: string, alg: string): number | null {
  try {
    return caseAlgSpeed(caseId, alg).ms;
  } catch (error) {
    console.warn(`No estimate for ${alg}`, error);
    return null;
  }
}

function moveCount(alg: string): number | null {
  try {
    return algMoveCount(alg);
  } catch (error) {
    console.warn(`Can't count the moves of ${alg}`, error);
    return null;
  }
}

function angleOf(caseId: string, alg: string): string {
  try {
    return viewAuf(caseId, alg);
  } catch (error) {
    console.warn(`Can't place ${alg} on ${caseId}`, error);
    return "";
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="case-stat">
      <span className="case-stat-label">{label}</span>
      <span className="case-stat-value">{value}</span>
    </div>
  );
}

/**
 * A case he has an alg for: the cube at his angle, his alg, how his drills of it go, and how it goes when it comes up
 * in his solves (recognition, execution, whether he used his alg), each sighting opening that solve's review.
 * Choosing another alg is one step away, under Change.
 */
export function CaseDetail({ caseId, alg, onDrill, onLearn, onChange, onBack }: Props) {
  const caseDef = getCase(caseId);
  const settings = useLearnSettings();
  const allReps = useReps();
  const reps = useMemo(() => currentCaseReps(allReps, settings), [allReps, settings]);
  const solves = useSolves();
  const options = useAnalysisOptions();
  const preview = useRef<CubeHandle>(null);
  const setup = `z2 ${caseDef.setup} ${angleOf(caseId, alg)}`.trim();
  const drills = useMemo(() => drillStats(caseId, reps), [caseId, reps]);
  const inSolves = useMemo(() => solveStats(caseId, alg, solves, options), [alg, caseId, options, solves]);
  const estimateMs = estimate(caseId, alg);
  const moves = moveCount(alg);

  useEffect(() => {
    preview.current?.show(setup);
  }, [setup]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="learn-pick case-detail">
      <IconButton icon={ArrowLeft} label="Back" className="pick-back" onClick={onBack} />
      <div className="case-views">
        <div className="case-cube">
          <CubeView ref={preview} className="cube pick-cube" setup={setup} />
          <IconButton icon={RotateCcw} label="Reset" size="sm" className="case-reset" onClick={() => preview.current?.show(setup)} />
        </div>
        {caseDef.set !== "F2L" && <CaseDiagram caseDef={caseDef} size={180} view="top" alg={alg} arrows />}
      </div>
      <div className="case-head">
        <h2 className="case-title">{caseDef.label}</h2>
        <IconButton icon={GraduationCap} label="Learn" variant="soft" onClick={onLearn} />
        <IconButton icon={ArrowLeftRight} label="Change alg" variant="soft" onClick={onChange} />
        <button className="pill primary" onClick={onDrill}>
          Drill
        </button>
      </div>
      <div className="case-alg">
        <code>{alg}</code>
        <span className="case-alg-meta">
          {moves !== null && <span>{moves}</span>}
          {estimateMs !== null && <span>≈{formatSeconds(estimateMs)} s</span>}
        </span>
      </div>
      <div className="case-stats">
        <section aria-label="Drills">
          <h3>Drills</h3>
          <div className="case-stat-row">
            <Stat label="Execution" value={seconds(drills.executionMs)} />
            <Stat label="Recognition" value={seconds(drills.recognitionMs)} />
            <Stat label="Best" value={seconds(drills.bestMs)} />
            <Stat label="Reps" value={String(drills.reps)} />
          </div>
        </section>
        <section aria-label="Solves">
          <h3>Solves</h3>
          <div className="case-stat-row">
            <Stat label="Execution" value={seconds(inSolves.executionMs)} />
            <Stat label="Recognition" value={seconds(inSolves.recognitionMs)} />
            <Stat label="Yours" value={inSolves.usedAlgShare === null ? "–" : `${Math.round(inSolves.usedAlgShare * 100)}%`} />
            <Stat label="Seen" value={String(inSolves.sightings.length)} />
          </div>
          {inSolves.sightings.length > 0 && (
            <ul className="case-sightings">
              {inSolves.sightings.slice(0, SIGHTINGS_SHOWN).map((sighting) => (
                <li key={`${sighting.solveId}-${sighting.createdAt}-${sighting.executionMs}`}>
                  <button onClick={() => navigate(`/solve/${sighting.solveId}`)} data-tip="Review">
                    <span className="when">{new Date(sighting.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    <span>{formatSeconds(sighting.recognitionMs)}</span>
                    <span>{formatSeconds(sighting.executionMs)}</span>
                    <span className="moves">{sighting.moves}</span>
                    <span className="used" aria-label={sighting.usedAlg ? "Yours" : sighting.usedAlg === false ? "Other alg" : ""}>
                      {sighting.usedAlg ? <Check strokeWidth={2.5} /> : sighting.usedAlg === false ? <Minus strokeWidth={2.5} /> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
