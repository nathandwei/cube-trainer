import { randomScrambleForEvent } from "cubing/scramble";
import { Minus, Play, Plus, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CubeStatus } from "@/app/components/CubeStatus";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import { formatMs } from "@/app/lib/format";
import { toSolverFrame } from "@/app/lib/frame";
import { addReps, newRepId, useReps } from "@/app/lib/learnStore";
import { ConnectSheet } from "@/app/smartcube/ConnectSheet";
import { shortCubeName, smartCube, useSmartCube } from "@/app/smartcube/connection";
import { ScrambleProgress } from "@/app/smartcube/ScrambleProgress";
import "@/app/smartcube/smartcube.css";
import { applyAlg, createRng, isSolved, scrambledState, splitMoves, type CubeState } from "@/cube";
import type { Move } from "@/cube/types";
import type { LookaheadRep } from "@/shared/learn";
import { countTurns } from "./cross/attempt";
import { BandFit } from "./cross/BandFit";
import { useCubeScramble } from "./cross/cubeScramble";
import { fromTextField, hasModifier, releaseFocus, takeSpace, useFrameClock } from "./cross/drill";
import { BPM_STEP, clampBpm, isClean, isMessy, startingBpm, suggestBpm } from "./lookahead/bpm";
import { Metronome } from "./lookahead/metronome";
import { beatMs, findPauses, pauseThresholdMs, type Gap } from "./lookahead/pauses";
import { simulateSolve } from "./lookahead/simulate";
import { readStoredBpm, storeBpm } from "./lookahead/storage";
import "./drills.css";

const CLICK_KEY = "cube.lookahead.click";
const DONE_HOLD_MS = 900;
const HISTORY_ROWS = 8;
/** The Test button's pretend cube: scrambling pace, a look before the first turn, and how many pauses it makes. */
const TEST_SCRAMBLE_STEP_MS = 90;
const TEST_LOOK_MS = 1500;
const TEST_PAUSES = 2;

/** `test`: the Test button's pretend solve, shown like a real one but never saved. */
type Setup = { key: number; scramble: string; bpm: number; test: boolean };
type Running = { key: number; setup: Setup | null; error: string | null };

type Outcome = {
  /** Every reported turn, host ms. */
  times: number[];
  solveMs: number;
  moveCount: number;
};

type Result = { rep: LookaheadRep; pauses: Gap[]; times: number[]; solveMs: number; moveCount: number; nextBpm: number };


function readClick(): boolean {
  try {
    return localStorage.getItem(CLICK_KEY) === "on";
  } catch (error) {
    console.warn("Could not read the metronome setting", error);
    return false;
  }
}

function storeClick(on: boolean): void {
  try {
    localStorage.setItem(CLICK_KEY, on ? "on" : "off");
  } catch (error) {
    console.warn("Could not save the metronome setting", error);
  }
}

async function makeScramble(): Promise<string> {
  return (await randomScrambleForEvent("333")).toString();
}

function beatStyle(bpm: number): CSSProperties {
  return { "--beat": `${beatMs(bpm)}ms` } as CSSProperties;
}

function toneOfPauses(pauses: number): "good" | "ok" | "bad" {
  if (isClean(pauses)) return "good";
  return isMessy(pauses) ? "bad" : "ok";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Slow solving without stopping, to a beat, on a smart cube: a pause is any gap between turns longer than 1.5 beats.
 * The bpm rises by 5 after three clean solves in a row and drops by 5 after three messy ones. The beat is a pulsing
 * dot; the click is opt-in. Without a cube, Start opens the connect sheet; Test plays a pretend slow solve (kept on
 * this page only, never saved).
 */
export function LookaheadDrill() {
  const allReps = useReps();
  const [testReps, setTestReps] = useState<LookaheadRep[]>([]);
  const reps = useMemo(
    () => [...allReps.filter((rep): rep is LookaheadRep => rep.kind === "lookahead"), ...testReps].sort((a, b) => a.createdAt - b.createdAt),
    [allReps, testReps],
  );
  const link = useSmartCube();
  const connected = link.status === "connected";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chosenBpm, setChosenBpm] = useState<number | null>(readStoredBpm);
  // Test solves show in the history but never steer the tempo.
  const history = useMemo(() => reps.filter((rep) => rep.test !== true), [reps]);
  const bpm = chosenBpm ?? startingBpm(history);
  const [click, setClick] = useState(readClick);
  const [running, setRunning] = useState<Running | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const upcoming = useRef<Promise<string> | null>(null);
  const attempts = useRef(0);

  const prefetch = useCallback(() => {
    const pending = makeScramble();
    // Not fatal: start() makes a fresh one if this failed.
    pending.catch((error: unknown) => console.error("Could not prepare a scramble", error));
    upcoming.current = pending;
  }, []);

  useEffect(prefetch, [prefetch]);

  /** A test solve's suggestion moves the control but is not remembered. */
  const chooseBpm = useCallback((next: number, remember = true) => {
    const value = clampBpm(next);
    setChosenBpm(value);
    if (remember) storeBpm(value);
  }, []);

  const start = useCallback(
    async (test: boolean) => {
      if (!test && !connected) {
        setSheetOpen(true);
        return;
      }
      const key = ++attempts.current;
      releaseFocus();
      setRunning({ key, setup: null, error: null });
      const pending = upcoming.current;
      upcoming.current = null;
      let scramble: string;
      try {
        scramble = await (pending ? pending.catch(makeScramble) : makeScramble());
      } catch (error) {
        console.error("Could not make a scramble", error);
        setRunning((current) => (current?.key === key ? { key, setup: null, error: "No scramble" } : current));
        return;
      }
      setRunning((current) => (current?.key === key ? { key, setup: { key, scramble, bpm, test }, error: null } : current));
      prefetch();
    },
    [bpm, connected, prefetch],
  );

  const finish = useCallback(
    (setup: Setup, outcome: Outcome) => {
      const pauses = findPauses(outcome.times, setup.bpm);
      const rep: LookaheadRep = {
        kind: "lookahead",
        id: newRepId(),
        createdAt: Date.now(),
        item: "lookahead",
        bpm: setup.bpm,
        pauses: pauses.length,
        source: "smartcube",
        solveMs: Math.round(outcome.solveMs),
        moveCount: outcome.moveCount,
        scramble: setup.scramble,
        longestGapMs: Math.round(Math.max(0, ...outcome.times.slice(1).map((t, i) => t - outcome.times[i]!))),
        ...(setup.test ? { test: true } : {}),
      };
      const nextBpm = suggestBpm([...history, rep], setup.bpm);
      if (!setup.test) chooseBpm(nextBpm, true);
      setResult({ rep, pauses, times: outcome.times, solveMs: outcome.solveMs, moveCount: outcome.moveCount, nextBpm });
      if (setup.test) {
        setTestReps((current) => [...current, rep]);
        return;
      }
      try {
        addReps([rep]);
      } catch (error) {
        console.error("Could not save the lookahead solve", error);
      }
    },
    [chooseBpm, history],
  );

  const close = useCallback(() => setRunning(null), []);

  useEffect(() => {
    if (running || sheetOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Space" || event.repeat || event.defaultPrevented || fromTextField(event) || hasModifier(event)) return;
      takeSpace(event);
      void start(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, sheetOpen, start]);

  return (
    <div className="drill-page">
      <header className="drill-head">
        <h1>Lookahead</h1>
        <span className="drill-divider" aria-hidden="true" />
        <div className="bpm-control">
          <input
            key={bpm}
            className="bpm-value"
            aria-label="Beats per minute"
            inputMode="numeric"
            defaultValue={bpm}
            onBlur={(event) => {
              const typed = Number(event.currentTarget.value);
              if (typed > 0) chooseBpm(typed);
              else event.currentTarget.value = String(bpm);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          <span className="bpm-unit">bpm</span>
        </div>
        <div className="drill-start">
          <button className="pill primary" onClick={() => void start(false)}>
            Start
          </button>
          <IconButton icon={Play} label="Test" variant="soft" filled onClick={() => void start(true)} />
        </div>
        <span className="drill-spacer" />
        <CubeStatus onClick={() => setSheetOpen(true)} />
      </header>
      {/* The tempo: slower / faster, the beat itself, and the optional click. */}
      <div className="tempo-row">
        <IconButton icon={Minus} label="Slower" variant="soft" onClick={() => chooseBpm(bpm - BPM_STEP)} />
        <IconButton icon={Plus} label="Faster" variant="soft" onClick={() => chooseBpm(bpm + BPM_STEP)} />
        <span className="beat-dot" style={beatStyle(bpm)} aria-hidden="true" />
        <IconButton
          icon={click ? Volume2 : VolumeX}
          label="Sound"
          variant="soft"
          aria-pressed={click}
          onClick={() => {
            setClick(!click);
            storeClick(!click);
          }}
        />
      </div>
      {result && <LookaheadResult result={result} />}
      <LookaheadHistory reps={reps} />
      {running && (
        <div className="drill-run">
          {running.setup ? (
            <LookaheadRun
              key={running.key}
              setup={running.setup}
              click={click}
              cubeName={link.deviceName}
              onDone={(outcome) => running.setup && finish(running.setup, outcome)}
              onClose={close}
            />
          ) : (
            <WaitingRun error={running.error} onExit={close} />
          )}
        </div>
      )}
      {sheetOpen && <ConnectSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

function WaitingRun({ error, onExit }: { error: string | null; onExit: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);
  return <p className="drill-foot">{error ?? ""}</p>;
}

type RunPhase = "scramble" | "ready" | "solve" | "done";

type Live = {
  state: CubeState;
  turns: Move[];
  times: number[];
  firstAt: number | null;
  done: boolean;
};

type RunProps = {
  setup: Setup;
  click: boolean;
  cubeName: string | null;
  onDone: (outcome: Outcome) => void;
  /** Leave the full page: after a finished solve, or on Escape (nothing saved). */
  onClose: () => void;
};

function LookaheadRun({ setup, click, cubeName, onDone, onClose }: RunProps) {
  const cube = useRef<CubeHandle>(null);
  const live = useRef<Live | null>(null);
  const [phase, setPhase] = useState<RunPhase>("scramble");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [closedPauses, setClosedPauses] = useState(0);
  const [lastTurnAt, setLastTurnAt] = useState<number | null>(null);
  const [testProgress, setTestProgress] = useState(0);
  const { view, readyAt } = useCubeScramble(setup.scramble, !setup.test);
  const now = useFrameClock(phase === "solve");
  const shownPhase: RunPhase = !setup.test && phase === "scramble" && readyAt !== null ? "ready" : phase;
  const threshold = pauseThresholdMs(setup.bpm);

  const attempt = useCallback((): Live => {
    live.current ??= { state: scrambledState(setup.scramble), turns: [], times: [], firstAt: null, done: false };
    return live.current;
  }, [setup.scramble]);

  /** One reported turn at host time `t`. */
  const turn = useCallback(
    (move: Move, t: number) => {
      const run = attempt();
      if (run.done) return;
      if (run.firstAt === null) {
        run.firstAt = t;
        setStartedAt(t);
        setPhase("solve");
      }
      const previous = run.times.at(-1);
      run.times.push(t);
      if (previous !== undefined && t - previous > threshold) setClosedPauses((count) => count + 1);
      setLastTurnAt(t);
      cube.current?.turn(move);
      run.turns.push(move);
      run.state = applyAlg(run.state, [move]);
      if (!isSolved(run.state)) return;
      run.done = true;
      setStoppedAt(t);
      setPhase("done");
      onDone({ times: [...run.times], solveMs: t - run.firstAt, moveCount: countTurns(run.turns) });
    },
    [attempt, onDone, threshold],
  );

  // The latest `turn` for listeners and timers set up once per attempt.
  const turnNow = useRef(turn);
  useEffect(() => {
    turnNow.current = turn;
  }, [turn]);

  useEffect(() => {
    cube.current?.setTempo(4);
  }, []);

  useEffect(() => {
    if (!click) return;
    const metronome = new Metronome();
    try {
      metronome.start(setup.bpm);
    } catch (error) {
      console.error("Could not start the metronome click", error);
      return;
    }
    return () => metronome.stop();
  }, [click, setup.bpm]);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(onClose, DONE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [onClose, phase]);

  useEffect(() => {
    if (setup.test || readyAt === null) return;
    return smartCube.onMove((move, hostT) => turnNow.current(move, hostT));
  }, [readyAt, setup.test]);

  // The Test button: scramble a pretend cube, look for a moment, then a slow solve re-timed to the beat.
  useEffect(() => {
    if (!setup.test) return;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const scrambleMoves = splitMoves(setup.scramble);
    const solve = simulateSolve(setup.scramble, setup.bpm, TEST_PAUSES, createRng(setup.key * 7919 + (Date.now() % 100_000)));
    scrambleMoves.forEach((move, i) =>
      later(i * TEST_SCRAMBLE_STEP_MS, () => {
        cube.current?.turn(toSolverFrame(move));
        setTestProgress(i + 1);
      }),
    );
    const readyAtMs = scrambleMoves.length * TEST_SCRAMBLE_STEP_MS + 300;
    later(readyAtMs, () => setPhase("ready"));
    const firstAt = readyAtMs + TEST_LOOK_MS;
    solve.forEach(({ move, t }) => later(firstAt + t, () => turnNow.current(move, performance.now())));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [setup.bpm, setup.key, setup.scramble, setup.test]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || live.current?.done) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const solving = shownPhase === "solve";
  const openPause = solving && lastTurnAt !== null && now - lastTurnAt > threshold ? 1 : 0;
  const pauses = closedPauses + openPause;
  const elapsed = startedAt === null ? 0 : solving ? Math.max(0, now - startedAt) : (stoppedAt ?? startedAt) - startedAt;
  const scrambleMoves = splitMoves(setup.scramble).length;
  const band =
    shownPhase !== "scramble" ? null : setup.test ? (
      <BandFit moves={scrambleMoves}>
        <ScrambleBand scramble={setup.scramble} progress={testProgress} />
      </BandFit>
    ) : view.plan ? (
      <BandFit moves={view.plan.moves.length}>
        <ScrambleProgress plan={view.plan} />
      </BandFit>
    ) : (
      <BandFit moves={scrambleMoves}>
        <ScrambleBand scramble={setup.scramble} />
      </BandFit>
    );

  return (
    <>
      {band}
      <div className="cube-slot running">
        <CubeView ref={cube} className="cube" setup={setup.test ? "z2" : `${setup.scramble} z2`} />
      </div>
      <span className="beat-dot big" style={beatStyle(setup.bpm)} aria-hidden="true" />
      <div className={`drill-pauses ${pauses > 0 ? "some" : ""} ${shownPhase === "scramble" ? "hidden" : ""}`}>
        <span className="count">{pauses}</span>
        <span className="label">{pauses === 1 ? "Pause" : "Pauses"}</span>
      </div>
      <p className="drill-foot">
        {setup.test ? (
          <span className="drill-tag">Test</span>
        ) : (
          cubeName && (
            <span className="drill-device">
              <span className="dot" />
              {shortCubeName(cubeName)}
            </span>
          )
        )}
        {shownPhase !== "scramble" && <span className="drill-elapsed">{formatMs(elapsed)}</span>}
      </p>
    </>
  );
}

function Timeline({ times, pauses, endMs }: { times: readonly number[]; pauses: readonly Gap[]; endMs: number }) {
  const width = 1000;
  const start = times[0] ?? 0;
  const span = Math.max(1, endMs - start);
  const x = (t: number) => ((t - start) / span) * width;
  return (
    <svg className="drill-timeline" viewBox={`0 0 ${width} 20`} preserveAspectRatio="none" role="img" aria-label={plural(pauses.length, "pause")}>
      <line className="base" x1={0} x2={width} y1={10} y2={10} />
      {times.map((t, i) => (
        <line key={i} className="turn" x1={x(t)} x2={x(t)} y1={5} y2={15} />
      ))}
      {pauses.map((gap) => (
        <line key={gap.from} className="pause" x1={x(gap.from)} x2={x(gap.to)} y1={10} y2={10} />
      ))}
    </svg>
  );
}

function LookaheadResult({ result }: { result: Result }) {
  const { rep, pauses, times, solveMs, moveCount, nextBpm } = result;
  const change = nextBpm - rep.bpm;
  return (
    <section className="lookahead-result">
      <div className="lookahead-summary">
        <span className={`hero tone-${toneOfPauses(rep.pauses)}`}>{plural(rep.pauses, "pause")}</span>
        <span className="meta">
          {formatMs(solveMs)} · {moveCount} moves · {rep.bpm} bpm
        </span>
        <span className="next">
          Next {nextBpm} bpm
          {change !== 0 && <span className={`delta ${change > 0 ? "up" : "down"}`}>{change > 0 ? `↑${change}` : `↓${-change}`}</span>}
        </span>
      </div>
      <Timeline times={times} pauses={pauses} endMs={(times[0] ?? 0) + solveMs} />
    </section>
  );
}

function LookaheadHistory({ reps }: { reps: readonly LookaheadRep[] }) {
  if (reps.length === 0) return null;
  return (
    <ul className="cross-rows lookahead-rows" aria-label="Recent solves">
      {reps
        .slice(-HISTORY_ROWS)
        .reverse()
        .map((rep) => (
          <li key={rep.id}>
            <span className={`drill-dot tone-${toneOfPauses(rep.pauses)}`} />
            <span className="moves">{rep.bpm} bpm</span>
            <span className="time">{plural(rep.pauses, "pause")}</span>
            <span className="verdict">{typeof rep.solveMs === "number" ? formatMs(rep.solveMs) : ""}</span>
            <span className="note">{rep.test === true ? "Test" : ""}</span>
          </li>
        ))}
    </ul>
  );
}
