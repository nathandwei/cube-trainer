import { randomScrambleForEvent } from "cubing/scramble";
import { Bluetooth, Play, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CubeStatus } from "@/app/components/CubeStatus";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { RatingsBar } from "@/app/components/RatingsBar";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import { SplitChips } from "@/app/components/SplitChips";
import { formatMs } from "@/app/lib/format";
import { splitAlg, toSolverFrame } from "@/app/lib/frame";
import { computeRatings } from "@/app/lib/ratings";
import { navigate } from "@/app/lib/router";
import { resultMs } from "@/app/lib/averages";
import { useSettings } from "@/app/lib/settings";
import { addSolve, deleteSolve, newId, setPenalty, setTestSolve } from "@/app/lib/store";
import { displayTokens } from "@/app/lib/display";
import { ConnectSheet } from "@/app/smartcube/ConnectSheet";
import { useSmartCube, type CubeStatus as LinkStatus } from "@/app/smartcube/connection";
import { inspectionDisplay } from "@/app/smartcube/inspection";
import { ScrambleProgress } from "@/app/smartcube/ScrambleProgress";
import type { FinishedSolve, SessionView } from "@/app/smartcube/session";
import { useCubeSession } from "@/app/smartcube/useCubeSession";
import "@/app/smartcube/smartcube.css";
import { analyzeSolve, generateDemoSolve } from "@/cube";
import type { SolveRecord } from "@/cube/types";

const SCRAMBLE_STEP_MS = 110;
const INSPECTION_MS = 900;

/** The test solve's own phases; real attempts are the cube session's. */
type Phase = "idle" | "preparing" | "scrambling" | "inspecting" | "solving";

type Props = {
  solves: readonly SolveRecord[];
  testSolve: SolveRecord | null;
  /** A solve picked in the sidebar, shown here instead of the latest one. */
  selectedId?: string;
  onFocusChange: (focused: boolean) => void;
};

async function nextScramble(): Promise<string> {
  return (await randomScrambleForEvent("333")).toString();
}

/** performance.now(), refreshed every animation frame while `active`. */
function useFrameClock(active: boolean): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = requestAnimationFrame(function tick() {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return now;
}

/** The line under the clock while the cube is connected. */
function cubeHint(view: SessionView, status: LinkStatus): { text: string; alert: boolean } | null {
  if (view.phase === "lost") return { text: "The cube dropped out. The timer is still running: press space when you finish.", alert: true };
  if (status === "reconnecting") return { text: "Cube disconnected. Reconnecting…", alert: true };
  if (status === "lost") return { text: "Lost the cube. Click it above to reconnect.", alert: true };
  switch (view.phase) {
    case "waiting":
      return view.hasState ? null : { text: "Reading the cube…", alert: false };
    // Scrambling and ready need no words: the band fills in as he turns, and the clock goes green.
    default:
      return null;
  }
}

export function TimerPage({ solves, testSolve, selectedId, onFocusChange }: Props) {
  const [scramble, setScramble] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [showCube, setShowCube] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const settings = useSettings();
  const cubeLink = useSmartCube();
  const cube = useRef<CubeHandle>(null);
  const startedAt = useRef(0);
  const frame = useRef<number | undefined>(undefined);
  const cancelled = useRef(false);

  // The most recent result on screen: a test solve is shown and reviewable but never saved.
  const [showTest, setShowTest] = useState(false);
  const picked = selectedId ? solves.find((s) => s.id === selectedId) : undefined;
  const last = picked ?? (showTest && testSolve ? testSolve : solves[0]);
  const ratings = useMemo(() => computeRatings(solves), [solves]);

  const refreshScramble = useCallback(() => {
    nextScramble()
      .then(setScramble)
      .catch((error: unknown) => console.error("Scramble generation failed", error));
  }, []);

  useEffect(refreshScramble, [refreshScramble]);

  const saveCubeSolve = useCallback(
    (solve: FinishedSolve) => {
      setShowTest(false);
      addSolve({ id: newId(), ...solve, createdAt: Date.now(), source: "smartcube" });
      refreshScramble();
    },
    [refreshScramble],
  );

  const connected = cubeLink.status === "connected" || cubeLink.status === "reconnecting";
  const { view: cubeView, session } = useCubeSession({ active: true, scramble, inspection: settings.inspection, onFinish: saveCubeSolve });
  const cubePhase = cubeView.phase;
  const cubeTiming = cubePhase === "solving" || cubePhase === "lost";
  // The cube is past scrambling: the last result and its controls step aside until the attempt is saved.
  const cubeBusy = cubePhase === "inspecting" || cubePhase === "ready" || cubeTiming;

  const focused = phase === "solving" || phase === "inspecting" || cubePhase === "inspecting" || cubeTiming;
  const now = useFrameClock(cubePhase === "inspecting" || cubeTiming);

  useEffect(() => onFocusChange(focused), [focused, onFocusChange]);
  useEffect(() => () => onFocusChange(false), [onFocusChange]);

  useEffect(() => {
    // StrictMode mounts twice in development, so re-arm on every mount.
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  // A cube solve starting replaces the solve picked in the sidebar.
  useEffect(() => {
    if (cubePhase === "solving" && selectedId) navigate("/");
  }, [cubePhase, selectedId]);

  useEffect(() => {
    function fromTextField(event: KeyboardEvent): boolean {
      const target = event.target;
      return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    }
    function onKeyDown(event: KeyboardEvent) {
      if (sheetOpen || fromTextField(event)) return;
      if (cubePhase === "lost" && event.code === "Space" && !event.repeat) {
        event.preventDefault();
        session.stopLost(performance.now());
      } else if (cubePhase === "solving" && event.key === "Escape") {
        session.cancel();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cubePhase, session, sheetOpen]);

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
    // Back to the result layout: time, splits, buttons (the review replays the solve).
    setShowCube(false);
    setElapsed(totalMs);
    setProgress(undefined);
    setPhase("idle");
    // With a cube connected, this scramble may already be on it; only a cube-free test moves on to a new one.
    if (!connected) refreshScramble();
  }

  const waiting = phase === "idle" && !cubeBusy;
  const showingResult = waiting && last !== undefined;
  const clockMs = waiting ? (last ? resultMs(last) : 0) : elapsed;
  const resultText = waiting && last?.penalty === "dnf" ? "DNF" : formatMs(clockMs) + (waiting && last?.penalty === "+2" ? "+" : "");
  // While a solve runs the page is just the time (plus the cube when it is the thing being solved).
  const solo = focused;
  const saved = last && last.source !== "demo" ? last : undefined;
  const solvingLabel = <span className="clock-solving">Solving</span>;

  function clock(): { content: ReactNode; className: string; cue: string | null } {
    if (cubePhase === "inspecting") {
      const { text, cue } = inspectionDisplay(Math.max(0, now - (cubeView.startedAt ?? now)));
      return { content: text, className: "inspecting", cue };
    }
    if (cubePhase === "ready") return { content: formatMs(0), className: "ready", cue: null };
    if (cubeTiming) {
      // The time stands from the solving turn while the gyro settles, and shows even with hidden time.
      const stopped = cubeView.stoppedAt;
      const runningMs = Math.max(0, (stopped ?? now) - (cubeView.startedAt ?? now));
      return { content: settings.hideTime && stopped === null ? solvingLabel : formatMs(runningMs), className: "", cue: null };
    }
    return { content: resultText, className: waiting && !last ? "idle" : "", cue: null };
  }

  const { content: clockContent, className: clockClass, cue } = clock();
  // A solve whose cube dropped out keeps its hint whatever the link does next: space is the only way to stop it.
  const hint = connected || cubeLink.status === "lost" || cubePhase === "lost" ? cubeHint(cubeView, cubeLink.status) : null;

  return (
    <div className={`timer ${solo ? "solo" : ""}`}>
      <div className="topbar">
        <CubeStatus onClick={() => setSheetOpen(true)} />
        <RatingsBar ratings={ratings} />
      </div>
      <div className="timer-stage">
        {connected && cubeView.plan && phase === "idle" ? (
          <ScrambleProgress plan={cubeView.plan} />
        ) : (
          <ScrambleBand scramble={scramble} progress={cubeBusy ? splitAlg(scramble).length : progress} />
        )}
        <div className={`clock ${clockClass}`}>{clockContent}</div>
        {cubePhase === "inspecting" && <p className="clock-cue">{cue ?? ""}</p>}
        {hint && <p className={`timer-hint ${hint.alert ? "alert" : ""}`}>{hint.text}</p>}
        {showingResult && last && <SplitChips solve={last} history={solves} />}
        <div className="cube" hidden={!showCube}>
          <CubeView ref={cube} />
        </div>
        {waiting && (
          <div className="result-actions">
            {saved && (
              <div className="penalties" role="group" aria-label="Penalty">
                <button className={`pill small ${saved.penalty === "+2" ? "on" : ""}`} aria-pressed={saved.penalty === "+2"} onClick={() => setPenalty(saved.id, saved.penalty === "+2" ? "none" : "+2")}>
                  +2
                </button>
                <button className={`pill small ${saved.penalty === "dnf" ? "on" : ""}`} aria-pressed={saved.penalty === "dnf"} onClick={() => setPenalty(saved.id, saved.penalty === "dnf" ? "none" : "dnf")}>
                  DNF
                </button>
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  onClick={() => {
                    deleteSolve(saved.id);
                    if (selectedId) navigate("/");
                  }}
                />
              </div>
            )}
            <div className="iconbar">
              {!connected && cubeLink.status !== "lost" && <IconButton icon={Bluetooth} label="Connect" variant="primary" size="xl" onClick={() => setSheetOpen(true)} />}
              <IconButton icon={Play} label="Test solve" variant="soft" size="xl" filled onClick={runTestSolve} disabled={!scramble || phase !== "idle"} />
              {last?.analysis && <IconButton icon={Search} label="Review" variant="soft" size="xl" onClick={() => navigate(`/solve/${last.id}`)} />}
            </div>
          </div>
        )}
      </div>
      {sheetOpen && <ConnectSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
