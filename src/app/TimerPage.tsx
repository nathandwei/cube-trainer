import type { KPattern } from "cubing/kpuzzle";
import { randomScrambleForEvent } from "cubing/scramble";
import { useCallback, useEffect, useRef, useState } from "react";
import { Breakdown } from "@/app/components/Breakdown";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { PauseBar } from "@/app/components/PauseBar";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import { formatMs } from "@/app/lib/format";
import { splitAlg, toSolverFrame } from "@/app/lib/frame";
import { navigate } from "@/app/lib/router";
import { addSolve, newId } from "@/app/lib/store";
import { isSolved, scrambledPattern, VIRTUAL_KEYS } from "@/app/lib/virtualCube";
import { analyzeSolve, generateDemoSolve } from "@/cube";
import type { SolveRecord, TimedMove } from "@/cube/types";

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

type Props = { solves: readonly SolveRecord[]; onFocusChange: (focused: boolean) => void };

async function nextScramble(): Promise<string> {
  return (await randomScrambleForEvent("333")).toString();
}

export function TimerPage({ solves, onFocusChange }: Props) {
  const [scramble, setScramble] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [showCube, setShowCube] = useState(false);
  const cube = useRef<CubeHandle>(null);
  const startedAt = useRef(0);
  const holdTimer = useRef<number | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const cancelled = useRef(false);
  const pattern = useRef<KPattern | null>(null);
  const virtualMoves = useRef<TimedMove[]>([]);
  const virtualStarted = useRef(false);

  const last = solves[0];
  const focused = phase === "running" || phase === "solving" || phase === "inspecting" || phase === "virtual-solving";
  const inVirtual = phase === "virtual" || phase === "virtual-solving";

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
    const totalMs = moves.at(-1)?.t ?? 0;
    const analysis = analyzeSolve(scramble, moves);
    addSolve({ id: newId(), scramble, moves, totalMs, penalty: "none", createdAt: Date.now(), source: "virtual", analysis });
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
        virtualStarted.current = true;
        virtualMoves.current = [];
        startedAt.current = performance.now();
        setPhase("virtual-solving");
        startTicking();
      }
      virtualMoves.current.push({ move, t: Math.round(performance.now() - startedAt.current) });
      cube.current?.turn(move);
      const next = current.applyMove(move);
      pattern.current = next;
      if (isSolved(next)) finishVirtual();
    },
    [finishVirtual, startTicking],
  );

  async function enterVirtual() {
    if (!scramble || phase !== "idle") return;
    pattern.current = await scrambledPattern(scramble);
    virtualStarted.current = false;
    setShowCube(true);
    setElapsed(0);
    cube.current?.setTempo(4);
    cube.current?.show(`${scramble} z2`);
    setPhase("virtual");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (phase === "virtual" || phase === "virtual-solving") {
        if (event.key === "Escape") return exitVirtual();
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
      if (event.code !== "Space" || event.repeat || phase !== "idle" || !scramble) return;
      event.preventDefault();
      setShowCube(false);
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
  }, [phase, scramble, stopKeyboardSolve, startTicking, exitVirtual, virtualTurn]);

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  async function playMoves(moves: readonly TimedMove[]) {
    startedAt.current = performance.now();
    let next = 0;
    await new Promise<void>((resolve) => {
      const step = () => {
        if (cancelled.current) return resolve();
        const now = performance.now() - startedAt.current;
        while (next < moves.length && (moves[next]?.t ?? Infinity) <= now) {
          cube.current?.turn(moves[next]?.move ?? "");
          next++;
        }
        const lastT = moves.at(-1)?.t ?? 0;
        setElapsed(Math.min(now, lastT));
        if (next >= moves.length) return resolve();
        frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    });
  }

  async function testSolve() {
    if (!scramble || phase !== "idle") return;
    setPhase("preparing");
    setShowCube(true);
    setElapsed(0);
    await sleep(30);
    const moves = generateDemoSolve(scramble, Date.now() % 100000);

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
    await playMoves(moves);
    if (cancelled.current) return;

    const totalMs = moves.at(-1)?.t ?? 0;
    const analysis = analyzeSolve(scramble, moves);
    addSolve({ id: newId(), scramble, moves, totalMs, penalty: "none", createdAt: Date.now(), source: "demo", analysis });
    setElapsed(totalMs);
    setProgress(undefined);
    setPhase("idle");
    refreshScramble();
  }

  const showingResult = phase === "idle" && last !== undefined;
  const clockMs = phase === "idle" ? (last ? last.totalMs : 0) : elapsed;
  const clockClass = phase === "ready" ? "ready" : phase === "idle" && !last ? "idle" : "";

  return (
    <div className="timer">
      <ScrambleBand scramble={scramble} progress={progress} dim={focused} />
      <div className="clock-row">
        <div className={`clock ${clockClass}`}>{formatMs(clockMs)}</div>
      </div>
      {showingResult && last?.analysis && (
        <>
          <Breakdown solve={last} analysis={last.analysis} history={solves.slice(1)} />
          <PauseBar moves={last.moves} totalMs={last.totalMs} />
        </>
      )}
      <div className="cube" hidden={!showCube}>
        <CubeView ref={cube} />
      </div>
      {inVirtual && (
        <div className="keymap">
          {Object.entries(VIRTUAL_KEYS).map(([key, move]) => (
            <span key={key}>
              <kbd>{key}</kbd> {move}
            </span>
          ))}
          <span>
            <kbd>esc</kbd>
          </span>
        </div>
      )}
      {phase === "idle" && (
        <div className="actions">
          {last?.analysis && (
            <button className="pill primary" onClick={() => navigate(`/solve/${last.id}`)}>
              review
            </button>
          )}
          <button className="pill" onClick={testSolve} disabled={!scramble}>
            test solve
          </button>
          <button className="pill" onClick={enterVirtual} disabled={!scramble}>
            virtual cube
          </button>
          <span className="keyhint">
            <kbd>space</kbd>
          </span>
        </div>
      )}
    </div>
  );
}
