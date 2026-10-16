import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { IconButton } from "@/app/components/IconButton";
import { CubeStatus } from "@/app/components/CubeStatus";
import { formatSeconds } from "@/app/lib/format";
import { loadAllReps, useLearnSettings, useReps } from "@/app/lib/learnStore";
import { navigate } from "@/app/lib/router";
import { median } from "@/app/lib/averages";
import { ConnectSheet } from "@/app/smartcube/ConnectSheet";
import { useSmartCube } from "@/app/smartcube/connection";
import type { CaseDef } from "@/cube";
import type { CaseRep } from "@/shared/learn";
import { CaseDiagram } from "./CaseDiagram";
import { CasePage } from "./CasePage";
import { CrossDrill } from "./CrossDrill";
import { LookaheadDrill } from "./LookaheadDrill";
import { LearnChart } from "./LearnChart";
import { casesOf, itemLabel, LEARN_ITEMS, learnItem } from "./items";
import { caseProgress, currentCaseReps, setOf, totalMs, targetMs } from "./progress";
import { pickSession } from "./scheduler";
import { chooseAlg, Session, Summary, type DrillInput } from "./Session";

/** The input is fixed when a session starts: a Bluetooth blip mid-session must not reset the case it's on. */
type Running = { caseIds: string[]; startedAt: number; input: DrillInput };
type Finished = { caseIds: string[]; reps: CaseRep[]; previousMedian: number | null };

export function LearnPage({ set }: { set?: string }) {
  const settings = useLearnSettings();
  const allReps = useReps();
  const reps = useMemo(() => currentCaseReps(allReps, settings), [allReps, settings]);
  const [running, setRunning] = useState<Running | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [custom, setCustom] = useState(false);
  /** A case opened from the grid: its algs, Choose / Record mine, and Drill. */
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Picking another item in the sidebar leaves whatever was open here (a session, the alg picker, a summary).
  const [shownSet, setShownSet] = useState(set);
  if (set !== shownSet) {
    setShownSet(set);
    setRunning(null);
    setFinished(null);
    setCustom(false);
    setOpenCase(null);
  }
  const cubeLink = useSmartCube();
  // Without a cube the drill still runs, on screen, for trying it out (nothing is saved).
  const input: DrillInput = cubeLink.status === "connected" ? "cube" : "test";

  useEffect(() => {
    void loadAllReps();
  }, []);

  // With nothing ticked (and nothing picked) the first set still shows: the sidebar's checks are how he adds things.
  const open = learnItem(set ?? settings.items[0] ?? LEARN_ITEMS[0]?.id);
  const hasCases = casesOf(settings.items).length > 0;

  function start(caseIds: string[]) {
    if (caseIds.length === 0) return;
    setFinished(null);
    setRunning({ caseIds, startedAt: Date.now(), input });
  }

  function previousMedianFor(caseIds: readonly string[], before: number): number | null {
    const prior = reps.filter((r) => r.correct && caseIds.includes(r.item) && r.createdAt < before).map(totalMs);
    return median(prior.slice(-60));
  }

  if (running) {
    return (
      <Session
        caseIds={running.caseIds}
        input={running.input}
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

  const openCases = open?.kind === "cases" ? open.cases : null;
  const learnedCount = openCases ? openCases.filter((c) => settings.algs[c.id] !== undefined).length : 0;

  if (openCase) {
    const caseId = openCase;
    const alg = settings.algs[caseId];
    return (
      <CasePage
        caseId={caseId}
        current={alg}
        onChoose={(chosen) => chooseAlg(caseId, chosen)}
        onBack={() => setOpenCase(null)}
        action={
          alg && (
            <button className="pill primary" onClick={() => start([caseId, caseId, caseId, caseId, caseId])}>
              Drill
            </button>
          )
        }
      />
    );
  }

  // The skill drills bring their own header (title, number, Start, Test), sheet and attempt page.
  if (open?.kind === "cross") return <CrossDrill variant={open.id} />;
  if (open?.kind === "lookahead") return <LookaheadDrill />;

  return (
    <div className="learn">
      <div className="learn-head">
        <h1>{open ? itemLabel(open.id) : ""}</h1>
        {openCases && (
          <>
            <span className="head-rule" aria-hidden="true" />
            <span className="head-count">
              {learnedCount}/{openCases.length}
            </span>
            <button className="pill primary start" onClick={() => start(pickSession(settings, reps, Date.now(), { only: openCases.map((c) => c.id) }))}>
              Start
            </button>
          </>
        )}
        {hasCases && <IconButton icon={SlidersHorizontal} label="Custom session" variant="soft" aria-pressed={custom} onClick={() => setCustom(!custom)} />}
        <span className="head-spacer" />
        <CubeStatus onClick={() => setSheetOpen(true)} />
      </div>
      {sheetOpen && <ConnectSheet onClose={() => setSheetOpen(false)} />}
      {custom && hasCases && <CustomSession items={settings.items} onStart={(ids) => start(ids)} />}
      {openCases && <CaseSetView cases={openCases} reps={reps} algs={settings.algs} onOpen={setOpenCase} />}
      {!open && settings.items[0] && (
        <button className="pill" onClick={() => navigate(`/learn/${settings.items[0]}`)}>
          {itemLabel(settings.items[0])}
        </button>
      )}
    </div>
  );
}

function CaseSetView({ cases, reps, algs, onOpen }: { cases: readonly CaseDef[]; reps: readonly CaseRep[]; algs: Record<string, string>; onOpen: (caseId: string) => void }) {
  const setId = cases[0]?.set;
  const target = setId ? targetMs(setId, reps) : 0;
  return (
    <div className="learn-set">
      {setId && <LearnChartForSet set={setId} reps={reps} />}
      <div className="case-grid">
        {cases.map((c) => {
          const progress = caseProgress(c.id, reps, target);
          const isLearned = algs[c.id] !== undefined;
          const time = progress.medianMs === null ? "" : ` · ${formatSeconds(progress.medianMs)}`;
          return (
            <button key={c.id} className={`case-cell ${isLearned ? "" : "new"} ${progress.fluent ? "fluent" : ""}`} onClick={() => onOpen(c.id)} data-tip={`${c.label}${time}`}>
              <CaseDiagram caseDef={c} size={74} view="iso" ghost={!isLearned} alg={algs[c.id]} />
              <span className="name">{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LearnChartForSet({ set, reps }: { set: CaseDef["set"]; reps: readonly CaseRep[] }) {
  const times = useMemo(() => reps.filter((r) => r.correct && setOf(r.item) === set).map(totalMs), [set, reps]);
  return <LearnChart times={times} />;
}

function CustomSession({ items, onStart }: { items: readonly string[]; onStart: (caseIds: string[]) => void }) {
  const [chosen, setChosen] = useState<string[]>(items.filter((id) => learnItem(id)?.kind === "cases"));
  const [size, setSize] = useState(20);
  const pool = casesOf(chosen).map((c) => c.id);
  return (
    <div className="custom-session">
      <div className="choices" role="group" aria-label="Sets">
        {items
          .filter((id) => learnItem(id)?.kind === "cases")
          .map((id) => (
            <button key={id} className="pill toggle" aria-pressed={chosen.includes(id)} onClick={() => setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id])}>
              {itemLabel(id)}
            </button>
          ))}
      </div>
      <div className="switch" role="radiogroup" aria-label="Length">
        {[10, 20, 40].map((n) => (
          <button key={n} role="radio" aria-checked={size === n} className={size === n ? "on" : ""} onClick={() => setSize(n)}>
            {n}
          </button>
        ))}
      </div>
      <button className="pill" disabled={pool.length === 0} onClick={() => onStart(shuffle(pool, size))}>
        Start
      </button>
    </div>
  );
}

function shuffle(pool: readonly string[], size: number): string[] {
  const out: string[] = [];
  while (out.length < size && pool.length > 0) out.push(pool[Math.floor(Math.random() * pool.length)] ?? "");
  return out.filter(Boolean);
}

