import { useEffect, useMemo, useState } from "react";
import { formatSeconds } from "@/app/lib/format";
import { loadAllReps, updateLearnSettings, useLearnSettings, useReps } from "@/app/lib/learnStore";
import { navigate } from "@/app/lib/router";
import { median } from "@/app/lib/averages";
import type { CaseDef } from "@/cube";
import type { CaseRep } from "@/shared/learn";
import { CaseDiagram } from "./CaseDiagram";
import { LearnChart } from "./LearnChart";
import { casesOf, LEARN_ITEMS, learnItem } from "./items";
import { caseProgress, currentCaseReps, sessionMedians, totalMs, targetMs } from "./progress";
import { pickSession } from "./scheduler";
import { Session, Summary, type DrillInput } from "./Session";

const INPUT_KEY = "cube.input";

function savedInput(): DrillInput {
  try {
    return localStorage.getItem(INPUT_KEY) === "keyboard" ? "keyboard" : "virtual";
  } catch (error) {
    console.warn("Could not read the input mode", error);
    return "virtual";
  }
}

type Running = { caseIds: string[]; startedAt: number };
type Finished = { caseIds: string[]; reps: CaseRep[]; previousMedian: number | null };

export function LearnPage({ set }: { set?: string }) {
  const settings = useLearnSettings();
  const allReps = useReps();
  const reps = useMemo(() => currentCaseReps(allReps, settings), [allReps, settings]);
  const [running, setRunning] = useState<Running | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [custom, setCustom] = useState(false);
  const [input, setInput] = useState<DrillInput>(savedInput);

  useEffect(() => {
    void loadAllReps();
  }, []);

  const open = learnItem(set ?? settings.items[0]);

  function start(caseIds: string[]) {
    if (caseIds.length === 0) return;
    setFinished(null);
    setRunning({ caseIds, startedAt: Date.now() });
  }

  function previousMedianFor(caseIds: readonly string[], before: number): number | null {
    const prior = reps.filter((r) => r.correct && caseIds.includes(r.item) && r.createdAt < before).map(totalMs);
    return median(prior.slice(-60));
  }

  if (running) {
    return (
      <Session
        caseIds={running.caseIds}
        input={input}
        onExit={(done) => {
          setRunning(null);
          if (done.length > 0) setFinished({ caseIds: running.caseIds, reps: done, previousMedian: previousMedianFor(running.caseIds, running.startedAt) });
        }}
      />
    );
  }

  if (finished) {
    return (
      <Summary
        reps={finished.reps}
        previousMedian={finished.previousMedian}
        onAgain={() => start(finished.caseIds)}
        onSlow={(ids) => start(ids.flatMap((id) => [id, id, id]))}
        onClose={() => setFinished(null)}
      />
    );
  }

  if (settings.items.length === 0) {
    return (
      <div className="learn-empty">
        {LEARN_ITEMS.map((item) => (
          <button key={item.id} className="pill" onClick={() => updateLearnSettings((s) => ({ ...s, items: [...s.items, item.id] }))}>
            + {item.id}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="learn">
      <div className="learn-top">
        <div className="actions">
          <button className="pill primary" onClick={() => start(pickSession(settings, reps, Date.now()))}>
            learn now
          </button>
          <button className="pill" onClick={() => setCustom(!custom)}>
            custom
          </button>
        </div>
        <div className="switch" role="radiogroup" aria-label="input">
          {(["virtual", "keyboard"] as const).map((mode) => (
            <button
              key={mode}
              role="radio"
              aria-checked={input === mode}
              className={input === mode ? "on" : ""}
              onClick={() => {
                setInput(mode);
                try {
                  localStorage.setItem(INPUT_KEY, mode);
                } catch (error) {
                  console.warn("Could not save the input mode", error);
                }
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      {custom && <CustomSession items={settings.items} onStart={(ids) => start(ids)} />}
      {open?.kind === "cases" && <CaseSetView cases={open.cases} name={open.id} reps={reps} algs={settings.algs} onDrill={(id) => start([id, id, id, id, id])} />}
      {open?.kind === "cross" && (
        <div className="learn-set">
          <h1>{open.id}</h1>
        </div>
      )}
      {!open && settings.items[0] && (
        <button className="pill" onClick={() => navigate(`/learn/${settings.items[0]}`)}>
          {settings.items[0]}
        </button>
      )}
    </div>
  );
}

function CaseSetView({ cases, name, reps, algs, onDrill }: { cases: readonly CaseDef[]; name: string; reps: readonly CaseRep[]; algs: Record<string, string>; onDrill: (caseId: string) => void }) {
  const setId = cases[0]?.set;
  const target = setId ? targetMs(setId, reps) : 0;
  const learned = cases.filter((c) => algs[c.id] !== undefined);
  return (
    <div className="learn-set">
      <div className="set-head">
        <h1>{name}</h1>
        <span className="count">
          {learned.length}/{cases.length}
        </span>
      </div>
      {setId && <LearnChartForSet set={setId} reps={reps} />}
      <div className="case-grid">
        {cases.map((c) => {
          const progress = caseProgress(c.id, reps, target);
          const isLearned = algs[c.id] !== undefined;
          return (
            <button key={c.id} className={`case-cell ${isLearned ? "" : "new"} ${progress.fluent ? "fluent" : ""}`} onClick={() => onDrill(c.id)} title={c.label}>
              <CaseDiagram caseDef={c} size={58} />
              <span className="name">{c.name}</span>
              <span className="time">{progress.medianMs === null ? "" : formatSeconds(progress.medianMs)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LearnChartForSet({ set, reps }: { set: CaseDef["set"]; reps: readonly CaseRep[] }) {
  const points = useMemo(() => sessionMedians(set, reps), [set, reps]);
  return <LearnChart points={points} />;
}

function CustomSession({ items, onStart }: { items: readonly string[]; onStart: (caseIds: string[]) => void }) {
  const [chosen, setChosen] = useState<string[]>(items.filter((id) => learnItem(id)?.kind === "cases"));
  const [size, setSize] = useState(20);
  const pool = casesOf(chosen).map((c) => c.id);
  return (
    <div className="custom-session">
      <div className="choices">
        {items
          .filter((id) => learnItem(id)?.kind === "cases")
          .map((id) => (
            <button key={id} className={`chip-toggle ${chosen.includes(id) ? "on" : ""}`} onClick={() => setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id])}>
              {id}
            </button>
          ))}
      </div>
      <div className="switch" role="radiogroup" aria-label="length">
        {[10, 20, 40].map((n) => (
          <button key={n} role="radio" aria-checked={size === n} className={size === n ? "on" : ""} onClick={() => setSize(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="pill primary" disabled={pool.length === 0} onClick={() => onStart(shuffle(pool, size))}>
        start
      </button>
    </div>
  );
}

function shuffle(pool: readonly string[], size: number): string[] {
  const out: string[] = [];
  while (out.length < size && pool.length > 0) out.push(pool[Math.floor(Math.random() * pool.length)] ?? "");
  return out.filter(Boolean);
}

