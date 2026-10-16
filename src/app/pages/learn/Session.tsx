import { ArrowLeft, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton, Key } from "@/app/components/IconButton";
import { formatSeconds } from "@/app/lib/format";
import { median } from "@/app/lib/averages";
import { addReps, newRepId, updateLearnSettings, useLearnSettings, useReps } from "@/app/lib/learnStore";
import { smartCube } from "@/app/smartcube/connection";
import { solveFix } from "@/app/smartcube/fixup";
import { ScrambleProgress } from "@/app/smartcube/ScrambleProgress";
import { CubeSession } from "@/app/smartcube/session";
import {
  applyAlg,
  caseScramble,
  createRng,
  fasterAlg,
  FrameTracker,
  getCase,
  isGoalReached,
  scrambledState,
  type CaseScramble,
  type CubeState,
} from "@/cube";
import type { CaseRep } from "@/shared/learn";
import { CaseDiagram } from "./CaseDiagram";
import { totalMs } from "./progress";

/** cube: the connected smart cube; test: no cube, the Test button plays the alg (nothing is saved). */
export type DrillInput = "cube" | "test";

/** Test reps: a beat to "recognise", then turns at a quick human pace. */
const TEST_RECOGNITION_MS = 650;
const TEST_TURN_MS = 150;

/** Give up on a rep after this many turns past the alg's length: something went wrong. */
const SPARE_TURNS = 8;
const RESULT_MS = 1100;

type Props = { caseIds: readonly string[]; input: DrillInput; onExit: (done: CaseRep[]) => void };

type Phase = "ready" | "running" | "result";

/**
 * One drill session, full page and nothing else on screen (like solving). On the smart cube he scrambles into the
 * case, then his turns are checked until the case is done; recognition isn't timed there, since the case only
 * shows once he turns the cube over from scrambling. Without a cube, Test plays the alg on screen (like the
 * timer's test solve), so the flow can be tried; those reps are never saved.
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
  const done = useRef<CaseRep[]>([]);
  const cube = useRef<CubeHandle>(null);
  const shownAt = useRef(0);
  const firstTurnAt = useRef(0);
  const state = useRef<CubeState | null>(null);
  const testTimers = useRef<number[]>([]);
  const turns = useRef<string[]>([]);
  const frame = useRef<number | undefined>(undefined);
  // Seeded once per session from a random value so each session gets different scrambles.
  const [rng] = useState(() => createRng(Math.floor(Math.random() * 1_000_000)));
  const prefetched = useRef(new Map<number, Promise<CaseScramble>>());
  const [cubeSession] = useState(
    () => new CubeSession({ inspection: () => false, orientationReference: () => smartCube.orientationReference, solveFix, onFinish: () => undefined }),
  );
  /** Set the moment a rep is recorded, so turns still arriving (queued test turns, a fast hand) can't record it twice. */
  const recorded = useRef(false);
  const subscribeCube = useCallback((listener: () => void) => cubeSession.subscribe(listener), [cubeSession]);
  const cubeView = useSyncExternalStore(subscribeCube, () => cubeSession.view());
  const onCube = input === "cube" && (cubeView.phase === "ready" || cubeView.phase === "solving");

  const caseId = caseIds[index];
  const caseDef = caseId ? getCase(caseId) : undefined;
  const alg = caseId ? settings.algs[caseId] : undefined;
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
    if (!caseId || needsAlg) return;
    let stale = false;
    scrambleFor(index)
      ?.then((next) => {
        if (stale) return;
        void scrambleFor(index + 1);
        setSetup(next);
        state.current = scrambledState(next.scramble);
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
        if (input === "test") tick();
        if (input === "cube") {
          cubeSession.cancel();
          cubeSession.setScramble(next.scramble);
        }
      })
      .catch((error: unknown) => console.error("Could not set up the case", error));
    return () => {
      stale = true;
    };
  }, [caseId, cubeSession, index, input, needsAlg, scrambleFor, tick]);

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
      if (input === "cube") {
        // Drop the attempt and wait for the next case's scramble rather than steering back to this one.
        cubeSession.cancel();
        cubeSession.setScramble("");
        addReps([rep]);
      }
      done.current = [...done.current, rep];
      setLast(rep);
      setPhase("result");
    },
    [alg, caseId, cubeSession, input, setup],
  );

  /** One turn on the case: `turns` in the solver's centre frame, `shown` as it animates on screen. */
  const drillTurn = useCallback(
    (turns_: readonly string[], shown: string) => {
      if (!caseDef || !state.current || recorded.current) return;
      if (phase === "ready") {
        firstTurnAt.current = performance.now();
        // The smart cube's case only shows once he's turned it over, so its clock starts with the first turn.
        if (input === "cube") shownAt.current = firstTurnAt.current;
        setPhase("running");
        tick();
      }
      turns.current = [...turns.current, ...turns_];
      state.current = applyAlg(state.current, turns_);
      cube.current?.turn(shown);
      if (isGoalReached(caseDef.set, state.current)) {
        record(true, firstTurnAt.current - shownAt.current, performance.now() - firstTurnAt.current);
        return;
      }
      const budget = (alg?.split(/\s+/).length ?? 12) + SPARE_TURNS;
      if (turns.current.length > budget) record(false, firstTurnAt.current - shownAt.current, performance.now() - firstTurnAt.current);
    },
    [alg, caseDef, input, phase, record, tick],
  );

  // The smart cube: its own scramble tracker brings the cube to the case, then its turns drive the drill.
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
    const known = smartCube.state.cube;
    if (known) cubeSession.facelets(known, performance.now());
    const off = [
      smartCube.onMove((move, hostT, cubeT) => {
        const before = cubeSession.view().phase;
        cubeSession.move(move, hostT, cubeT);
        const live = phaseRef.current === "ready" || phaseRef.current === "running";
        if (live && (before === "ready" || before === "solving")) drillTurnRef.current([move], move);
      }),
      smartCube.onGyro((q, hostT) => cubeSession.gyro(q, hostT)),
      smartCube.onFacelets((cubeState, hostT) => cubeSession.facelets(cubeState, hostT)),
      smartCube.onLost(() => cubeSession.connectionLost()),
    ];
    return () => off.forEach((unsubscribe) => unsubscribe());
  }, [cubeSession, input]);

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
    const start = state.current;
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

  // After a result, move on by itself unless it was wrong (then wait, so the alg can be read).
  useEffect(() => {
    if (phase !== "result" || !last?.correct) return;
    const timer = window.setTimeout(next, RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [last, next, phase]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
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
  }, [finish, input, loading, needsAlg, next, phase, runTest]);

  useEffect(() => {
    const pending = testTimers;
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      pending.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  if (needsAlg && caseDef && caseId) {
    return <PickAlg caseId={caseId} onChoose={(chosen) => updateLearnSettings((s) => ({ ...s, algs: { ...s.algs, [caseId]: chosen }, algChosenAt: { ...s.algChosenAt, [caseId]: Date.now() } }))} onExit={finish} />;
  }

  const suggestion = last && caseId && last.correct ? fasterAlg(caseId, totalMs(last), 7, alg) : null;

  return (
    <div className="learn-session">
      <span className="session-count">
        {Math.min(index + 1, caseIds.length)} / {caseIds.length}
      </span>
      {input === "cube" && !onCube && phase === "ready" && !loading && (cubeView.plan ? <ScrambleProgress plan={cubeView.plan} /> : <span className="muted">{cubeView.hasState ? "" : "Reading the cube…"}</span>)}
      <CubeView ref={cube} className="cube big" />
      <div className={`session-time ${last ? (last.correct ? "good" : "bad") : ""}`}>
        {phase === "result" && last ? formatSeconds(totalMs(last)) : phase === "running" || (phase === "ready" && input === "test") ? formatSeconds(elapsed) : loading || (input === "cube" && !onCube) ? "" : "0.00"}
      </div>
      {/* One fixed slot under the time, so the cube and time never jump when a result or the Test button shows. */}
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
            {!last.correct && <Key>Space</Key>}
          </div>
        )}
        {input === "test" && phase === "ready" && !loading && <IconButton icon={Play} label="Test" variant="soft" size="lg" filled onClick={runTest} />}
      </div>
    </div>
  );
}

function PickAlg({ caseId, onChoose, onExit }: { caseId: string; onChoose: (alg: string) => void; onExit: () => void }) {
  const caseDef = getCase(caseId);
  const reps = useReps();
  const preview = useRef<CubeHandle>(null);

  useEffect(() => {
    preview.current?.show(`z2 ${caseDef.setup}`);
  }, [caseDef]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  function play(alg: string) {
    preview.current?.setTempo(1.6);
    preview.current?.play(`z2 ${caseDef.setup}`, alg);
  }

  /** His median with each alg, if he has drilled it before (a previous pick, or another case's same alg). */
  function yours(alg: string): number | null {
    const times = reps.filter((r): r is CaseRep => r.kind === "case" && r.item === caseId && r.alg === alg && r.correct).map(totalMs);
    return median(times);
  }

  const fewest = Math.min(...caseDef.moves);
  return (
    <div className="learn-pick">
      <IconButton icon={ArrowLeft} label="Back" className="pick-back" onClick={onExit} />
      <CubeView ref={preview} className="cube pick-cube" setup={`z2 ${caseDef.setup}`} />
      <h2 className="case-title">{caseDef.label}</h2>
      <div className="alg-options">
        {caseDef.algs.map((option, i) => {
          const mine = yours(option);
          const best = caseDef.moves[i] === fewest;
          return (
            <div key={option} className={`alg-option ${best ? "best" : ""}`}>
              <code>{option}</code>
              <span className="moves">{caseDef.moves[i]}</span>
              <span className="note">{mine !== null ? `Yours ${formatSeconds(mine)}` : best && caseDef.algs.length > 1 ? <span className="tag">Fewest</span> : ""}</span>
              <div className="alg-actions">
                <IconButton icon={Play} label="Play" filled className="outline" onClick={() => play(option)} />
                <button className={`pill ${best ? "primary" : ""}`} onClick={() => onChoose(option)}>
                  Choose
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** End of a session (round-8 12): the median against last time, every case with its time, the slow ones again. */
export function Summary({ reps, previousMedian, onAgain, onSlow, onClose }: { reps: readonly CaseRep[]; previousMedian: number | null; onAgain: () => void; onSlow: (caseIds: string[]) => void; onClose: () => void }) {
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
            <CaseDiagram caseDef={getCase(rep.item)} size={66} view="top" />
            <span>{rep.correct ? formatSeconds(totalMs(rep)) : "×"}</span>
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
