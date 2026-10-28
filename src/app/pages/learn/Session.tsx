import { Flag, Play, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton, Key } from "@/app/components/IconButton";
import { formatSeconds } from "@/app/lib/format";
import { averageOf, formatAverage, median } from "@/app/lib/averages";
import { addReps, newRepId, updateLearnSettings, useLearnSettings } from "@/app/lib/learnStore";
import { smartCube } from "@/app/smartcube/connection";
import {
  applyAlg,
  caseScramble,
  createRng,
  fasterAlg,
  FrameTracker,
  getCase,
  isGoalReached,
  scrambledState,
  splitMoves,
  type CaseScramble,
} from "@/cube";
import type { CaseRep } from "@/shared/learn";
import { CaseDiagram } from "./CaseDiagram";
import { CasePage } from "./CasePage";
import { caseOutcome, readCase, turnCase, type CaseReadings } from "./caseTurns";
import { countTurns } from "./cross/attempt";
import { LearnAlg } from "./LearnAlg";
import { totalMs } from "./progress";

/** cube: the connected smart cube; test: no cube, the Test button plays the alg (nothing is saved). */
export type DrillInput = "cube" | "test";

/** Locks in his alg for a case; reps from before belong to the old alg (algChosenAt). */
export function chooseAlg(caseId: string, alg: string): void {
  updateLearnSettings((s) => ({ ...s, algs: { ...s.algs, [caseId]: alg }, algChosenAt: { ...s.algChosenAt, [caseId]: Date.now() } }));
}

/** Test reps: a beat to "recognise", then turns at a quick human pace. */
const TEST_RECOGNITION_MS = 650;
const TEST_TURN_MS = 150;

/** Give up on a rep after this many turns past the alg's length: something went wrong. */
const SPARE_TURNS = 8;

/**
 * The alg's length in the turns a smart cube reports, counted like the rep's turns: a slice is two (R L'), and a half
 * turn one, though it arrives as two quarters.
 */
function algTurns(alg: string): number {
  const tracker = new FrameTracker();
  return countTurns(splitMoves(alg).flatMap((token) => tracker.apply(token).turns));
}

type Props = { caseIds: readonly string[]; input: DrillInput; onExit: (done: CaseRep[]) => void };

type Phase = "ready" | "running" | "result";

/**
 * One drill session, full page and nothing else on screen (like solving). The case shows on screen and the clock runs
 * from then (recognition, then execution from his first turn). On the smart cube he does it on his own cube in
 * whatever state it's in, with no scrambling into the case: only its turns count, applied to the case on screen
 * until it's done. Without a cube, Test plays the alg on screen (like the timer's test solve), so the flow can be
 * tried; those reps are never saved.
 */
export function Session({ caseIds, input, onExit }: Props) {
  const settings = useLearnSettings();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  // Which case index has its scramble set up on the cube; anything else means it's still loading.
  const [loadedFor, setLoadedFor] = useState(-1);
  const [setup, setSetup] = useState<CaseScramble | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [last, setLast] = useState<CaseRep | null>(null);
  // A case whose alg he just chose: he learns it before its first rep.
  const [learning, setLearning] = useState<string | null>(null);
  const done = useRef<CaseRep[]>([]);
  const cube = useRef<CubeHandle>(null);
  const shownAt = useRef(0);
  const firstTurnAt = useRef(0);
  /** The case as his turns leave it (caseTurns.ts). */
  const states = useRef<CaseReadings | null>(null);
  const testTimers = useRef<number[]>([]);
  const turns = useRef<string[]>([]);
  const frame = useRef<number | undefined>(undefined);
  // Seeded once per session from a random value so each session gets different scrambles.
  const [rng] = useState(() => createRng(Math.floor(Math.random() * 1_000_000)));
  const prefetched = useRef(new Map<number, Promise<CaseScramble>>());
  /** Set the moment a rep is recorded, so turns still arriving (queued test turns, a fast hand) can't record it twice. */
  const recorded = useRef(false);

  const caseId = caseIds[index];
  const caseDef = caseId ? getCase(caseId) : undefined;
  const alg = caseId ? settings.algs[caseId] : undefined;
  const turnBudget = useMemo(() => (alg ? algTurns(alg) : 12) + SPARE_TURNS, [alg]);
  const needsAlg = Boolean(caseId) && !alg;
  const loading = !needsAlg && loadedFor !== index;

  const scrambleFor = useCallback(
    (i: number) => {
      const id = caseIds[i];
      if (!id) return null;
      let pending = prefetched.current.get(i);
      if (!pending) {
        pending = caseScramble(id, rng);
        prefetched.current.set(i, pending);
      }
      return pending;
    },
    [caseIds, rng],
  );

  const finish = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    onExit(done.current);
  }, [onExit]);

  const tick = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    const loop = () => {
      setElapsed(performance.now() - shownAt.current);
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, []);

  // Each case with an alg: set it up from a real scramble.
  useEffect(() => {
    if (!caseId || needsAlg || learning === caseId) return;
    let stale = false;
    scrambleFor(index)
      ?.then((next) => {
        if (stale) return;
        void scrambleFor(index + 1);
        setSetup(next);
        states.current = readCase(scrambledState(next.scramble));
        testTimers.current.forEach((timer) => window.clearTimeout(timer));
        testTimers.current = [];
        recorded.current = false;
        turns.current = [];
        cube.current?.setTempo(3);
        cube.current?.show(`${next.scramble} z2`);
        shownAt.current = performance.now();
        setElapsed(0);
        setPhase("ready");
        setLoadedFor(index);
        tick();
      })
      .catch((error: unknown) => console.error("Could not set up the case", error));
    return () => {
      stale = true;
    };
  }, [caseId, index, learning, needsAlg, scrambleFor, tick]);

  const record = useCallback(
    (correct: boolean, recognitionMs: number, executionMs: number) => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (!caseId || !setup || recorded.current) return;
      recorded.current = true;
      testTimers.current.forEach((timer) => window.clearTimeout(timer));
      testTimers.current = [];
      const rep: CaseRep = {
        kind: "case",
        id: newRepId(),
        createdAt: Date.now(),
        item: caseId,
        auf: (setup.preAuf || "") as CaseRep["auf"],
        recognitionMs: Math.round(recognitionMs),
        executionMs: Math.round(executionMs),
        moves: turns.current,
        correct,
        source: "smartcube",
        alg,
      };
      if (input === "cube") addReps([rep]);
      done.current = [...done.current, rep];
      setLast(rep);
      setPhase("result");
    },
    [alg, caseId, input, setup],
  );

  /** One turn on the case: `turns` in the solver's centre frame, `shown` as it animates on screen. */
  const drillTurn = useCallback(
    (turns_: readonly string[], shown: string) => {
      if (!caseDef || !states.current || recorded.current) return;
      if (phase === "ready") {
        firstTurnAt.current = performance.now();
        setPhase("running");
      }
      turns.current = [...turns.current, ...turns_];
      states.current = turnCase(states.current, turns_);
      cube.current?.turn(shown);
      const outcome = caseOutcome(caseDef.set, states.current);
      if (outcome) {
        record(outcome === "solved", firstTurnAt.current - shownAt.current, performance.now() - firstTurnAt.current);
        return;
      }
      if (countTurns(turns.current) > turnBudget) record(false, firstTurnAt.current - shownAt.current, performance.now() - firstTurnAt.current);
    },
    [caseDef, phase, record, turnBudget],
  );

  // The smart cube: its turns drive the drill while a case is up (not while a result shows).
  const drillTurnRef = useRef(drillTurn);
  useEffect(() => {
    drillTurnRef.current = drillTurn;
  }, [drillTurn]);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    if (input !== "cube") return;
    return smartCube.onMove((move) => {
      if (phaseRef.current === "ready" || phaseRef.current === "running") drillTurnRef.current([move], move);
    });
  }, [input]);

  const next = useCallback(() => {
    if (index + 1 >= caseIds.length) {
      finish();
      return;
    }
    setLast(null);
    setIndex(index + 1);
  }, [caseIds.length, finish, index]);

  /** Plays the chosen alg (after whichever AUF the case needs) as if it were done on the cube. */
  const runTest = useCallback(() => {
    const start = states.current?.[0];
    if (input !== "test" || phase !== "ready" || !caseDef || !start || !alg || testTimers.current.length > 0) return;
    const turnsOf = (line: string) => {
      const tracker = new FrameTracker();
      return line.split(/\s+/).filter(Boolean).map((move) => ({ move, turns: tracker.apply(move).turns }));
    };
    const line = ["", "U", "U'", "U2"].map((auf) => `${auf} ${alg}`.trim()).find((candidate) => isGoalReached(caseDef.set, applyAlg(start, turnsOf(candidate).flatMap((step) => step.turns))));
    if (!line) {
      console.error(`The alg for ${caseDef.id} doesn't solve its case from this AUF`, alg);
      return;
    }
    testTimers.current = turnsOf(line).map((step, i) =>
      window.setTimeout(() => drillTurnRef.current(step.turns, step.move), TEST_RECOGNITION_MS + i * TEST_TURN_MS),
    );
  }, [alg, caseDef, input, phase]);

  /** He gives up on the rep: a DNF, with the split as far as it got (no turn yet is all recognition). */
  const giveUp = useCallback(() => {
    const now = performance.now();
    if (phase === "ready") record(false, now - shownAt.current, 0);
    else if (phase === "running") record(false, firstTurnAt.current - shownAt.current, now - firstTurnAt.current);
  }, [phase, record]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Learning a new alg: its page has its own keys (Space plays, Enter drills, Escape goes back).
      if (learning !== null && learning === caseId) return;
      if (event.key === "Escape") {
        finish();
        return;
      }
      if (phase === "result" && !needsAlg && (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault();
        next();
        return;
      }
      if (input === "test" && phase === "ready" && !loading && event.code === "Space" && !event.repeat) {
        event.preventDefault();
        runTest();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [caseId, finish, input, learning, loading, needsAlg, next, phase, runTest]);

  useEffect(() => {
    const pending = testTimers;
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      pending.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  if (needsAlg && caseDef && caseId) {
    return (
      <CasePage
        key={caseId}
        caseId={caseId}
        onChoose={(chosen) => {
          chooseAlg(caseId, chosen);
          setLearning(caseId);
        }}
        onBack={finish}
      />
    );
  }

  if (learning === caseId && caseId && alg) {
    return <LearnAlg key={caseId} caseId={caseId} alg={alg} onDrill={() => setLearning(null)} onBack={() => setLearning(null)} />;
  }

  const suggestion = last && caseId && last.correct ? fasterAlg(caseId, totalMs(last), 7, alg) : null;

  return (
    <div className="learn-session">
      <span className="session-count">
        {Math.min(index + 1, caseIds.length)} / {caseIds.length}
      </span>
      <CubeView ref={cube} className="cube big" />
      <div className={`session-time ${last ? (last.correct ? "good" : "bad") : ""}`}>
        {phase === "result" && last ? (last.correct ? formatSeconds(totalMs(last)) : "DNF") : loading ? "" : formatSeconds(elapsed)}
      </div>
      {/* One fixed slot under the time, so the cube and time never jump when a result or the buttons show. */}
      <div className="session-below">
        {phase === "result" && last && (
          <div className="session-result">
            {caseDef && <span className="case-name">{caseDef.label}</span>}
            {last.recognitionMs > 0 && (
              <span className="split">
                Recognition {formatSeconds(last.recognitionMs)} · Execution {formatSeconds(last.executionMs)}
              </span>
            )}
            {(!last.correct || suggestion) && <code>{alg}</code>}
            {suggestion && (
              <span className="suggest">
                <code>{suggestion.alg}</code>
                <span className="tag">−{suggestion.currentMoves - suggestion.moves} moves</span>
              </span>
            )}
            <Key>Space</Key>
          </div>
        )}
        {(phase === "ready" || phase === "running") && !loading && (
          <div className="session-actions">
            {input === "test" && phase === "ready" && <IconButton icon={Play} label="Test" variant="soft" size="lg" filled onClick={runTest} />}
            <IconButton icon={Flag} label="Give up" variant="soft" size="lg" onClick={giveUp} />
          </div>
        )}
      </div>
    </div>
  );
}

type SummaryProps = {
  reps: readonly CaseRep[];
  previousMedian: number | null;
  onAgain: () => void;
  onSlow: (caseIds: string[]) => void;
  onDelete: (repId: string) => void;
  onClose: () => void;
};

/**
 * End of a session (round-8 12): the median against last time (and the session's ao5 and ao12 once it's long enough),
 * every case with its time, the slow ones again. A rep can be deleted from here.
 */
export function Summary({ reps, previousMedian, onAgain, onSlow, onDelete, onClose }: SummaryProps) {
  const [show, setShow] = useState<"slow" | "all">("slow");
  const correct = reps.filter((r) => r.correct).map(totalMs).sort((a, b) => a - b);
  const middle = median(correct);
  const slowCut = correct.length ? (correct[Math.floor(correct.length * 0.75)] ?? Infinity) : Infinity;
  const isSlow = (rep: CaseRep) => !rep.correct || totalMs(rep) >= slowCut;
  const slow = reps.filter(isSlow);
  const delta = middle !== null && previousMedian !== null ? middle - previousMedian : null;
  const turns = reps.reduce((sum, r) => sum + r.moves.length, 0);
  const executionMs = reps.reduce((sum, r) => sum + r.executionMs, 0);
  const shown = show === "slow" && slow.length > 0 ? slow : reps;
  const first = reps[0];
  // In the order they were done, newest first; a wrong one is a DNF.
  const results = reps.map((rep) => (rep.correct ? totalMs(rep) : Number.POSITIVE_INFINITY)).reverse();
  const averages = ([5, 12] as const).filter((n) => results.length >= n);
  return (
    <div className="learn-summary">
      <div className="summary-head">
        {first && <CaseDiagram caseDef={getCase(first.item)} size={124} view="iso" />}
        <span className="hero">{middle === null ? "–" : formatSeconds(middle)}</span>
        {previousMedian !== null && (
          <span className="stat previous">
            <span className="value">{formatSeconds(previousMedian)}</span>
            {delta !== null && <span className={`delta ${delta <= 0 ? "up" : "down"}`}>{delta <= 0 ? `↓${formatSeconds(-delta)}` : `↑${formatSeconds(delta)}`}</span>}
          </span>
        )}
        <span className="stat">
          <span className="label">Cases</span>
          <span className="value">{reps.length}</span>
        </span>
        <span className="stat">
          <span className="label">TPS</span>
          <span className="value">{executionMs > 0 ? (turns / (executionMs / 1000)).toFixed(1) : "–"}</span>
        </span>
        <span className="stat">
          <span className="label">Slowest</span>
          <span className="value">{correct.length ? formatSeconds(correct.at(-1) ?? 0) : "–"}</span>
        </span>
        {averages.map((n) => (
          <span key={n} className="stat">
            <span className="label">ao{n}</span>
            <span className="value">{formatAverage(averageOf(results, n))}</span>
          </span>
        ))}
        <IconButton icon={X} label="Close" className="summary-close" onClick={onClose} />
      </div>
      <div className="tabs" role="tablist">
        {(["slow", "all"] as const).map((tab) => (
          <button key={tab} role="tab" aria-selected={show === tab} className={show === tab ? "on" : ""} onClick={() => setShow(tab)}>
            {tab === "slow" ? "Slow" : "All"}
          </button>
        ))}
      </div>
      <div className="summary-grid">
        {shown.map((rep) => (
          <div key={rep.id} className={`summary-case ${isSlow(rep) ? "slow" : ""}`}>
            <CaseDiagram caseDef={getCase(rep.item)} size={66} view="top" alg={rep.alg} />
            <span>{rep.correct ? formatSeconds(totalMs(rep)) : "×"}</span>
            <IconButton icon={Trash2} label="Delete" size="sm" className="rep-delete" onClick={() => onDelete(rep.id)} />
          </div>
        ))}
      </div>
      <div className="summary-actions">
        <button className="pill primary large" onClick={onAgain}>
          Again
        </button>
        {slow.length > 0 && (
          <button className="pill large outline" onClick={() => onSlow([...new Set(slow.map((r) => r.item))])}>
            Slowest
          </button>
        )}
      </div>
    </div>
  );
}
