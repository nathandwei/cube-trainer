import { ArrowRight, FastForward, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { IconButton } from "@/app/components/IconButton";
import { getCase, getCaseSet, type CaseSetId } from "@/cube";
import { CaseDiagram } from "./CaseDiagram";
import { biggestSavings, type Known } from "./calibrate/summary";
import { chooseAlg } from "./Session";
import { RecordAlg, type TakeInfo } from "./RecordAlg";
import "./calibrate.css";

export type CalibrationResult = {
  set: CaseSetId;
  /** The cases he showed how he solves, in the set's order. Test takes are listed but were never saved. */
  known: Known[];
  /** The cases he skipped: he doesn't know them yet. */
  unknown: string[];
};

type Props = {
  set: CaseSetId;
  /** The end of calibration ("Learn" on the summary, or closing it). */
  onDone: (result: CalibrationResult) => void;
  /** Left midway. Every take he moved on from is already saved. */
  onCancel: () => void;
};


/**
 * Calibrating a set: every case in turn, like slides, and for each he shows how he solves it on the cube (the case
 * on screen follows his cube, see RecordAlg) or skips it (he doesn't know it). Each take becomes his alg for that
 * case the moment he moves on, so leaving midway keeps them. Test takes (no cube) show the flow but are never saved.
 * The end lists what he knows and where shorter algs save the most moves.
 */
export function Calibrate({ set, onDone, onCancel }: Props) {
  const cases = getCaseSet(set).cases;
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState<Known[]>([]);
  const [finished, setFinished] = useState(false);
  const caseDef = cases[index];

  const result = useCallback(
    (): CalibrationResult => ({
      set,
      known: cases.flatMap((c) => known.filter((k) => k.caseId === c.id)),
      unknown: cases.filter((c) => !known.some((k) => k.caseId === c.id)).map((c) => c.id),
    }),
    [cases, known, set],
  );

  const next = useCallback(() => {
    if (index + 1 >= cases.length) setFinished(true);
    else setIndex(index + 1);
  }, [cases.length, index]);

  const recorded = useCallback(
    (alg: string, take: TakeInfo) => {
      if (!caseDef) return;
      if (!take.test) chooseAlg(caseDef.id, alg);
      setKnown((list) => [...list.filter((k) => k.caseId !== caseDef.id), { caseId: caseDef.id, alg, ...take }]);
      next();
    },
    [caseDef, next],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Esc closes the connect sheet first.
      if (document.querySelector('[role="dialog"]')) return;
      if (finished) onDone(result());
      else onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, onCancel, onDone, result]);

  if (finished || !caseDef) return <CalibrationSummary result={result()} onDone={() => onDone(result())} />;

  return (
    <div className="calib">
      <RecordAlg
        key={caseDef.id}
        caseId={caseDef.id}
        onRecorded={recorded}
        onSkip={next}
        corner={
          <>
            <IconButton icon={FastForward} label="Skip the rest" onClick={() => setFinished(true)} />
            <IconButton icon={X} label="Close" className="calib-close" onClick={onCancel} />
          </>
        }
      />
      <span className="calib-count">
        {index + 1} / {cases.length}
      </span>
    </div>
  );
}

/**
 * The end (round-8 12's layout): what he knows against the set, the cases where a shorter alg saves the most moves
 * (his take against it), and the whole set with what he knows filled in.
 */
function CalibrationSummary({ result, onDone }: { result: CalibrationResult; onDone: () => void }) {
  const total = result.known.length + result.unknown.length;
  const savings = biggestSavings(result.known);
  const shorterCount = biggestSavings(result.known, Infinity).length;
  const [tab, setTab] = useState<"shorter" | "all">(savings.length > 0 ? "shorter" : "all");
  const tested = result.known.some((k) => k.test);
  const cases = getCaseSet(result.set).cases;
  const algOf = new Map(result.known.map((k) => [k.caseId, k.alg]));
  const first = cases[0];
  return (
    <div className="calib-summary">
      <div className="summary-head">
        {first && <CaseDiagram caseDef={first} size={124} view="iso" />}
        <span className="hero">
          {result.known.length}/{total}
        </span>
        {tested && <span className="tag test">Test</span>}
        <span className="stat">
          <span className="label">New</span>
          <span className="value">{result.unknown.length}</span>
        </span>
        <span className="stat">
          <span className="label">Shorter</span>
          <span className="value">{shorterCount}</span>
        </span>
        <IconButton icon={X} label="Close" className="summary-close" onClick={onDone} />
      </div>
      {savings.length > 0 && (
        <div className="tabs" role="tablist">
          {(["shorter", "all"] as const).map((option) => (
            <button key={option} role="tab" aria-selected={tab === option} className={tab === option ? "on" : ""} onClick={() => setTab(option)}>
              {option === "shorter" ? "Shorter" : "All"}
            </button>
          ))}
        </div>
      )}
      {tab === "shorter" && savings.length > 0 ? (
        <ol className="savings">
          {savings.map((saving) => {
            const caseDef = getCase(saving.caseId);
            return (
              <li key={saving.caseId} className="saving">
                <CaseDiagram caseDef={caseDef} size={56} />
                <span className="name">
                  {caseDef.name}
                  {saving.test && <span className="tag test">Test</span>}
                </span>
                <span className="algs">
                  <span className="yours">
                    {saving.yours}
                    <span className="n">{saving.yourMoves}</span>
                  </span>
                  <ArrowRight className="arrow" strokeWidth={1.75} aria-hidden="true" />
                  <span className="shorter">
                    {saving.shorter}
                    <span className="n">{saving.moves}</span>
                  </span>
                </span>
                <span className="tag">−{saving.saved} moves</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="calib-grid">
          {cases.map((caseDef) => {
            const alg = algOf.get(caseDef.id);
            return (
              <div key={caseDef.id} className={`calib-case ${alg === undefined ? "new" : ""}`} data-tip={alg}>
                <CaseDiagram caseDef={caseDef} size={56} ghost={alg === undefined} />
                <span className="name">{caseDef.name}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="summary-actions">
        <button className="pill primary large" onClick={onDone}>
          Learn
        </button>
      </div>
    </div>
  );
}
