import type { KPattern } from "cubing/kpuzzle";
import { randomScrambleForEvent } from "cubing/scramble";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { PlayIcon, ReviewIcon } from "@/app/components/Icons";
import { InputSwitch, type InputMode } from "@/app/components/InputSwitch";
import { RatingsBar } from "@/app/components/RatingsBar";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import { SplitChips } from "@/app/components/SplitChips";
import { formatMs } from "@/app/lib/format";
import { splitAlg, toSolverFrame } from "@/app/lib/frame";
import { computeRatings } from "@/app/lib/ratings";
import { navigate } from "@/app/lib/router";
import { resultMs } from "@/app/lib/averages";
import { addSolve, deleteSolve, newId, setPenalty, setTestSolve } from "@/app/lib/store";
import { isSolved, scrambledPattern, VIRTUAL_KEYS, VIRTUAL_LAYOUT } from "@/app/lib/virtualCube";
import { displayTokens } from "@/app/lib/display";
import { analyzeSolve, FrameTracker, generateDemoSolve } from "@/cube";
import type { RotationEvent, SolveRecord, TimedMove } from "@/cube/types";

/** Hold space this long before release starts the timer, like a stackmat. */
const HOLD_MS = 300;
const SCRAMBLE_STEP_MS = 110;
const INSPECTION_MS = 900;

type Phase =
  | "idle"
  | "holding"
  | "ready"
  | "running"
  | "preparing"
  | "scrambling"
  | "inspecting"
  | "solving"
  | "virtual"
  | "virtual-solving";

type Props = {
  solves: readonly SolveRecord[];
  testSolve: SolveRecord | null;
  /** A solve picked in the sidebar, shown here instead of the latest one. */
  selectedId?: string;
  onFocusChange: (focused: boolean) => void;
};

const MODE_KEY = "cube.input";

function savedMode(): InputMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === "virtual" || saved === "keyboard" ? saved : "keyboard";
  } catch (error) {
    console.warn("Could not read the input mode", error);
    return "keyboard";
  }
}

function saveMode(mode: InputMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch (error) {
    console.warn("Could not save the input mode", error);
  }
}

async function nextScramble(): Promise<string> {
  return (await randomScrambleForEvent("333")).toString();
}

export function TimerPage({ solves, testSolve, selectedId, onFocusChange }: Props) {
  const [scramble, setScramble] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [showCube, setShowCube] = useState(false);
  const [mode, setMode] = useState<InputMode>(savedMode);
  const cube = useRef<CubeHandle>(null);
  const startedAt = useRef(0);
  const holdTimer = useRef<number | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const cancelled = useRef(false);
  const pattern = useRef<KPattern | null>(null);
  const virtualMoves = useRef<TimedMove[]>([]);
  const virtualRotations = useRef<RotationEvent[]>([]);
  const tracker = useRef(new FrameTracker());
  const virtualStarted = useRef(false);

  // The most recent result on screen: a test solve is shown and reviewable but never saved.
  const [showTest, setShowTest] = useState(false);
  const picked = selectedId ? solves.find((s) => s.id === selectedId) : undefined;
  const last = picked ?? (showTest && testSolve ? testSolve : solves[0]);
  const focused = phase === "running" || phase === "solving" || phase === "inspecting" || phase === "virtual-solving";
  const inVirtual = phase === "virtual" || phase === "virtual-solving";
  const ratings = useMemo(() => computeRatings(solves), [solves]);

  useEffect(() => onFocusChange(focused), [focused, onFocusChange]);
  useEffect(() => () => onFocusChange(false), [onFocusChange]);

  const refreshScramble = useCallback(() => {
    nextScramble()
      .then(setScramble)
      .catch((error: unknown) => console.error("Scramble generation failed", error));
  }, []);

  useEffect(refreshScramble, [refreshScramble]);

  useEffect(() => {
    // StrictMode mounts twice in development, so re-arm on every mount.
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (frame.current) cancelAnimationFrame(frame.current);
      window.clearTimeout(holdTimer.current);
    };
  }, []);

  const startTicking = useCallback(() => {
    const loop = () => {
      setElapsed(performance.now() - startedAt.current);
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, []);

  const stopKeyboardSolve = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    const totalMs = Math.round(performance.now() - startedAt.current);
    setElapsed(totalMs);
    setPhase("idle");
    setShowTest(false);
    addSolve({ id: newId(), scramble, moves: [], totalMs, penalty: "none", createdAt: Date.now(), source: "keyboard" });
    refreshScramble();
  }, [scramble, refreshScramble]);

  const exitVirtual = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    pattern.current = null;
    setShowCube(false);
    setPhase("idle");
  }, []);

  const finishVirtual = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    const moves = virtualMoves.current;
    const rotations = virtualRotations.current;
    const totalMs = moves.at(-1)?.t ?? 0;
    const analysis = analyzeSolve(scramble, moves);
    setShowTest(false);
    addSolve({ id: newId(), scramble, moves, rotations, totalMs, penalty: "none", createdAt: Date.now(), source: "virtual", analysis });
    pattern.current = null;
    setElapsed(totalMs);
    setPhase("idle");
    refreshScramble();
  }, [scramble, refreshScramble]);

  const virtualTurn = useCallback(
    (move: string) => {
      const current = pattern.current;
      if (!current) return;
      if (!virtualStarted.current) {
        if (selectedId) navigate("/");
        virtualStarted.current = true;
        virtualMoves.current = [];
        virtualRotations.current = [];
        tracker.current = new FrameTracker();
        startedAt.current = performance.now();
        setPhase("virtual-solving");
        startTicking();
      }
      // Record it the way a smart cube would: turns relative to the centres, plus how the cube body turned.
      const t = Math.round(performance.now() - startedAt.current);
      const step = tracker.current.apply(move);
      for (const turn of step.turns) virtualMoves.current.push({ move: turn, t });
      if (step.rotation) virtualRotations.current.push({ rotation: step.rotation, after: virtualMoves.current.length, t });
      cube.current?.turn(move);
      const next = current.applyMove(move);
      pattern.current = next;
      if (isSolved(next)) finishVirtual();
    },
    [finishVirtual, selectedId, startTicking],
  );

  // In virtual mode the cube is always out and scrambled, waiting for the first turn.
  useEffect(() => {
    if (mode !== "virtual" || phase !== "idle" || !scramble) return;
    let stale = false;
    scrambledPattern(scramble)
      .then((scrambled) => {
        if (stale) return;
        pattern.current = scrambled;
        virtualStarted.current = false;
        setElapsed(0);
        cube.current?.setTempo(4);
        cube.current?.show(`${scramble} z2`);
        setPhase("virtual");
      })
      .catch((error: unknown) => console.error("Could not set up the virtual cube", error));
    return () => {
      stale = true;
    };
  }, [mode, phase, scramble]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (phase === "virtual" || phase === "virtual-solving") {
        if (event.key === "Escape") return exitVirtual(); // the effect above re-scrambles it
        const move = VIRTUAL_KEYS[event.key.toLowerCase()];
        if (!move || event.metaKey || event.ctrlKey || event.altKey) return;
        event.preventDefault();
        virtualTurn(move);
        return;
      }
      if (phase === "running") {
        event.preventDefault();
        stopKeyboardSolve();
        return;
      }
      if (mode !== "keyboard" || event.code !== "Space" || event.repeat || phase !== "idle" || !scramble) return;
      event.preventDefault();
      setShowCube(false);
      if (selectedId) navigate("/");
      setPhase("holding");
      holdTimer.current = window.setTimeout(() => setPhase("ready"), HOLD_MS);
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space") return;
      window.clearTimeout(holdTimer.current);
      if (phase === "holding") setPhase("idle");
      if (phase !== "ready") return;
      startedAt.current = performance.now();
      setPhase("running");
      startTicking();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [mode, phase, scramble, selectedId, stopKeyboardSolve, startTicking, exitVirtual, virtualTurn]);

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function playTokens(tokens: readonly { text: string; t: number }[], endMs: number) {
    startedAt.current = performance.now();
    let next = 0;
    await new Promise<void>((resolve) => {
      const step = () => {
        if (cancelled.current) return resolve();
        const now = performance.now() - startedAt.current;
        while (next < tokens.length && (tokens[next]?.t ?? Infinity) <= now) {
          cube.current?.turn(tokens[next]?.text ?? "");
          next++;
        }
        setElapsed(Math.min(now, endMs));
        if (next >= tokens.length) return resolve();
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    });
  }

  async function runTestSolve() {
    if (!scramble || phase !== "idle") return;
    if (selectedId) navigate("/");
    setPhase("preparing");
    setShowCube(true);
    setElapsed(0);
    await sleep(30);
    const { moves, rotations } = generateDemoSolve(scramble, Date.now() % 100000);
    const analysis = analyzeSolve(scramble, moves);
    const totalMs = moves.at(-1)?.t ?? 0;

    setPhase("scrambling");
    cube.current?.show("z2");
    cube.current?.setTempo(4);
    const scrambleMoves = splitAlg(scramble);
    for (let i = 0; i < scrambleMoves.length; i++) {
      if (cancelled.current) return;
      setProgress(i);
      cube.current?.turn(toSolverFrame(scrambleMoves[i] ?? ""));
      await sleep(SCRAMBLE_STEP_MS);
    }
    setProgress(scrambleMoves.length);

    setPhase("inspecting");
    await sleep(INSPECTION_MS);

    setPhase("solving");
    cube.current?.setTempo(3);
    await playTokens(displayTokens({ moves, rotations }, analysis), totalMs);
    if (cancelled.current) return;

    setTestSolve({ id: newId(), scramble, moves, rotations, totalMs, penalty: "none", createdAt: Date.now(), source: "demo", analysis });
    setShowTest(true);
    setElapsed(totalMs);
    setProgress(undefined);
    setPhase("idle");
    refreshScramble();
  }

  function changeMode(next: InputMode) {
    if (inVirtual) exitVirtual();
    setMode(next);
    saveMode(next);
  }

  // Before the first turn on the virtual cube, the last result stays up like it does on the timer.
  const waiting = phase === "idle" || phase === "virtual";
  const showingResult = waiting && last !== undefined;
  const clockMs = waiting ? (last ? resultMs(last) : 0) : elapsed;
  const clockText = waiting && last?.penalty === "dnf" ? "DNF" : formatMs(clockMs) + (waiting && last?.penalty === "+2" ? "+" : "");
  // While a solve runs the page is just the time (plus the cube when it is the thing being solved).
  const solo = focused;
  const saved = last && last.source !== "demo" ? last : undefined;
  const clockClass = phase === "ready" ? "ready" : waiting && !last ? "idle" : "";

  return (
    <div className={`timer ${solo ? "solo" : ""}`}>
      <div className="topbar">
        <InputSwitch mode={mode} onChange={changeMode} cubeName={null} />
        <RatingsBar ratings={ratings} />
      </div>
      <div className="timer-stage">
        <ScrambleBand scramble={scramble} progress={progress} />
        <div className={`clock ${clockClass}`}>{clockText}</div>
        {showingResult && last && <SplitChips solve={last} history={solves} />}
        <div className="cube" hidden={!showCube && mode !== "virtual"}>
          <CubeView ref={cube} />
        </div>
        {inVirtual && (
          <div className="keymap">
            {VIRTUAL_LAYOUT.map(([key, move]) => (
              <span key={key}>
                <kbd>{key}</kbd> {move}
              </span>
            ))}
            <span>
              <kbd>esc</kbd>
            </span>
          </div>
        )}
        {waiting && saved && (
          <div className="penalties">
            <button className={saved.penalty === "+2" ? "on" : ""} onClick={() => setPenalty(saved.id, saved.penalty === "+2" ? "none" : "+2")}>
              +2
            </button>
            <button className={saved.penalty === "dnf" ? "on" : ""} onClick={() => setPenalty(saved.id, saved.penalty === "dnf" ? "none" : "dnf")}>
              DNF
            </button>
            <button
              onClick={() => {
                deleteSolve(saved.id);
                if (selectedId) navigate("/");
              }}
            >
              delete
            </button>
          </div>
        )}
        {waiting && (
          <div className="iconbar">
            <button className="icon" onClick={runTestSolve} disabled={!scramble || phase !== "idle"} aria-label="test solve" title="test solve">
              <PlayIcon />
            </button>
            {last?.analysis && (
              <button className="icon" onClick={() => navigate(`/solve/${last.id}`)} aria-label="review" title="review">
                <ReviewIcon />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
