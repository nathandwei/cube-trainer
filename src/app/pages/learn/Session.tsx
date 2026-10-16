import { useCallback, useEffect, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import { formatSeconds } from "@/app/lib/format";
import { addReps, newRepId, updateLearnSettings, useLearnSettings } from "@/app/lib/learnStore";
import { VIRTUAL_KEYS } from "@/app/lib/virtualCube";
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

export type DrillInput = "virtual" | "keyboard";

/** Give up on a rep after this many turns past the alg's length: something went wrong. */
const SPARE_TURNS = 8;
const RESULT_MS = 1100;

type Props = { caseIds: readonly string[]; input: DrillInput; onExit: (done: CaseRep[]) => void };

type Phase = "ready" | "running" | "result";

/**
 * One drill session, full page and nothing else on screen (like solving). Each case appears on the cube from a
 * real scramble at the solving angle; recognition runs from when it appears to the first turn, execution from
 * the first turn until the case is done. On the virtual cube that's checked automatically; on a real cube
 * without Bluetooth the spacebar times it and correctness is assumed unless marked wrong.
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
  const tracker = useRef(new FrameTracker());
  const turns = useRef<string[]>([]);
  const frame = useRef<number | undefined>(undefined);
  // Seeded once per session from a random value so each session gets different scrambles.
  const [rng] = useState(() => createRng(Math.floor(Math.random() * 1_000_000)));
  const prefetched = useRef(new Map<number, Promise<CaseScramble>>());

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
        tracker.current = new FrameTracker();
        turns.current = [];
        cube.current?.setTempo(3);
        cube.current?.show(`${next.scramble} z2`);
        shownAt.current = performance.now();
        setElapsed(0);
        setPhase("ready");
        setLoadedFor(index);
      })
      .catch((error: unknown) => console.error("Could not set up the case", error));
    return () => {
      stale = true;
    };
  }, [caseId, index, needsAlg, scrambleFor]);

  const tick = useCallback(() => {
    const loop = () => {
      setElapsed(performance.now() - shownAt.current);
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, []);

  const record = useCallback(
    (correct: boolean, recognitionMs: number, executionMs: number) => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (!caseId || !setup) return;
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
        source: input,
        alg,
      };
      addReps([rep]);
      done.current = [...done.current, rep];
      setLast(rep);
      setPhase("result");
    },
    [alg, caseId, input, setup],
  );

  const next = useCallback(() => {
    if (index + 1 >= caseIds.length) {
      finish();
      return;
    }
    setLast(null);
    setIndex(index + 1);
  }, [caseIds.length, finish, index]);

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
      if (phase === "result" && (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault();
        next();
        return;
      }
      if (!caseDef || loading || (phase !== "ready" && phase !== "running")) return;

      if (input === "keyboard") {
        if (event.code !== "Space" || event.repeat) return;
        event.preventDefault();
        if (phase === "ready") {
          firstTurnAt.current = performance.now();
          shownAt.current = firstTurnAt.current;
          setPhase("running");
          tick();
        } else {
          record(true, 0, performance.now() - firstTurnAt.current);
        }
        return;
      }

      const move = VIRTUAL_KEYS[event.key.toLowerCase()];
      if (!move || event.metaKey || event.ctrlKey || event.altKey || !state.current) return;
      event.preventDefault();
      if (phase === "ready") {
        firstTurnAt.current = performance.now();
        setPhase("running");
        tick();
      }
      const step = tracker.current.apply(move);
      turns.current = [...turns.current, ...step.turns];
      state.current = applyAlg(state.current, step.turns);
      cube.current?.turn(move);
      if (isGoalReached(caseDef.set, state.current)) {
        record(true, firstTurnAt.current - shownAt.current, performance.now() - firstTurnAt.current);
        return;
      }
      const budget = (alg?.split(/\s+/).length ?? 12) + SPARE_TURNS;
      if (turns.current.length > budget) record(false, firstTurnAt.current - shownAt.current, performance.now() - firstTurnAt.current);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [alg, caseDef, finish, input, loading, next, phase, record, tick]);

  useEffect(() => () => {
    if (frame.current) cancelAnimationFrame(frame.current);
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
      {input === "keyboard" && setup && phase !== "result" && <ScrambleBand scramble={setup.scramble} className="small" />}
      <CubeView ref={cube} className="cube big" />
      <div className={`session-time ${last ? (last.correct ? "good" : "bad") : ""}`}>
        {phase === "result" && last ? formatSeconds(totalMs(last)) : phase === "running" ? formatSeconds(elapsed) : loading ? "" : "0.00"}
      </div>
      {phase === "result" && last && (
        <div className="session-result">
          {last.recognitionMs > 0 && (
            <span>
              recog {formatSeconds(last.recognitionMs)} · exec {formatSeconds(last.executionMs)}
            </span>
          )}
          {caseDef && <span className="case-name">{caseDef.label}</span>}
          {(!last.correct || suggestion) && <code>{alg}</code>}
          {suggestion && (
            <span className="suggest">
              try <code>{suggestion.alg}</code> ({suggestion.currentMoves - suggestion.moves} fewer moves)
            </span>
          )}
          {!last.correct && <span className="muted">space</span>}
        </div>
      )}
      {input === "keyboard" && phase === "running" && <span className="muted">space</span>}
    </div>
  );
}

function PickAlg({ caseId, onChoose, onExit }: { caseId: string; onChoose: (alg: string) => void; onExit: () => void }) {
  const caseDef = getCase(caseId);
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
    preview.current?.show(`z2 ${caseDef.setup}`);
    window.setTimeout(() => alg.split(/\s+/).filter(Boolean).forEach((move) => preview.current?.turn(move)), 300);
  }

  const fewest = Math.min(...caseDef.moves);
  return (
    <div className="learn-session pick">
      <span className="session-count">new</span>
      <CubeView ref={preview} className="cube" setup={`z2 ${caseDef.setup}`} />
      <h2 className="case-title">{caseDef.label}</h2>
      <div className="alg-options">
        {caseDef.algs.map((option, i) => (
          <div key={option} className="alg-option">
            <code>{option}</code>
            <span className="moves">
              {caseDef.moves[i]}
              {caseDef.moves[i] === fewest && caseDef.algs.length > 1 && <span className="tag">fewest</span>}
            </span>
            <div className="alg-actions">
              <button aria-label="play" onClick={() => play(option)}>
                ▶
              </button>
              <button className="pill primary" onClick={() => onChoose(option)}>
                choose
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** End of a session: the median against last time, every case with its time, and the slow ones to go again. */
export function Summary({ reps, previousMedian, onAgain, onSlow, onClose }: { reps: readonly CaseRep[]; previousMedian: number | null; onAgain: () => void; onSlow: (caseIds: string[]) => void; onClose: () => void }) {
  const correct = reps.filter((r) => r.correct).map(totalMs).sort((a, b) => a - b);
  const median = correct.length ? (correct[Math.floor((correct.length - 1) / 2)] ?? 0) : null;
  const slowCut = correct.length ? (correct[Math.floor(correct.length * 0.75)] ?? Infinity) : Infinity;
  const slow = reps.filter((r) => !r.correct || totalMs(r) >= slowCut).map((r) => r.item);
  const delta = median !== null && previousMedian !== null ? median - previousMedian : null;
  return (
    <div className="learn-summary">
      <div className="summary-head">
        <span className="hero">{median === null ? "–" : formatSeconds(median)}</span>
        {previousMedian !== null && <span className="muted">previous {formatSeconds(previousMedian)}</span>}
        {delta !== null && <span className={delta <= 0 ? "delta up" : "delta down"}>{delta <= 0 ? `↓${formatSeconds(-delta)}` : `↑${formatSeconds(delta)}`}</span>}
      </div>
      <div className="summary-grid">
        {reps.map((rep) => (
          <div key={rep.id} className={`summary-case ${!rep.correct || totalMs(rep) >= slowCut ? "slow" : ""}`}>
            <CaseDiagram caseDef={getCase(rep.item)} size={56} />
            <span>{rep.correct ? formatSeconds(totalMs(rep)) : "×"}</span>
          </div>
        ))}
      </div>
      <div className="summary-actions">
        <button className="pill primary" onClick={onAgain}>
          again
        </button>
        {slow.length > 0 && (
          <button className="pill" onClick={() => onSlow([...new Set(slow)])}>
            learn slow
          </button>
        )}
        <button className="pill" onClick={onClose}>
          done
        </button>
      </div>
    </div>
  );
}
