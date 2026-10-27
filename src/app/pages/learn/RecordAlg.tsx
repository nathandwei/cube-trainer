import { Boxes, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { CubeStatus } from "@/app/components/CubeStatus";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { ConnectSheet } from "@/app/smartcube/ConnectSheet";
import { ambientAttitude, lineUp } from "@/app/smartcube/attitude";
import { smartCube, useSmartCube } from "@/app/smartcube/connection";
import { solveFix } from "@/app/smartcube/fixup";
import type { GridOrientation, Quaternion } from "@/app/smartcube/gyro";
import { ScrambleProgress } from "@/app/smartcube/ScrambleProgress";
import { CubeSession } from "@/app/smartcube/session";
import { caseScramble, caseState, createRng, getCase, type CaseScramble } from "@/cube";
import { SETTLE_MS, useGhostCube } from "./calibrate/ghost";
import { SCRAMBLE_GRIP, SOLVER_GRIP } from "./calibrate/grip";
import { testLine } from "./calibrate/notation";
import { TakeStore } from "./calibrate/take";
import "./calibrate.css";

/** How a recorded take was made, for whoever keeps it. */
export type TakeInfo = {
  /** Played by the Test button (no cube connected), not turned by him. */
  test: boolean;
  /** First turn to last. */
  executionMs: number;
};

type Props = {
  caseId: string;
  /** He showed how he solves the case and moved on: `alg` is his take, written as an alg for the case. */
  onRecorded: (alg: string, take: TakeInfo) => void;
  /** He doesn't know the case. */
  onSkip: () => void;
  /** For "Set up my cube": the case's scramble, if the caller fetched it ahead (one is made here otherwise). */
  scramble?: Promise<CaseScramble>;
  /** More controls for the top-right corner, after Skip. */
  corner?: ReactNode;
};

/** ghost: the case on screen follows his cube; setup: his cube is scrambled into the case first (the band). */
type Mode = "ghost" | "setup";

/** Test takes: a beat to "recognise", then turns at a quick human pace. */
const TEST_LEAD_MS = 650;
const TEST_TURN_MS = 150;

/**
 * One case, recorded on the smart cube. By default the case is on screen and his cube, in whatever state, drives it
 * (the ghost): every turn and regrip plays on the case, and once it's done his take shows as an alg. "Set up my cube"
 * scrambles his cube into the case instead (the band, white on top) and records from the real state. Without a
 * cube, Test plays the catalog's alg as if it were turned.
 */
export function RecordAlg({ caseId, onRecorded, onSkip, scramble, corner }: Props) {
  const caseDef = getCase(caseId);
  const link = useSmartCube();
  const connected = link.status === "connected";
  const cube = useRef<CubeHandle>(null);
  const testTimers = useRef<number[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("ghost");
  // Whether the take on screen was played by Test, for the take it belongs to.
  const [tested, setTested] = useState<{ caseId: string; mode: Mode } | null>(null);
  const [modeFor, setModeFor] = useState(caseId);
  // Each case starts on the ghost; setting the cube up is per case.
  if (modeFor !== caseId) {
    setModeFor(caseId);
    setMode("ghost");
  }
  const settingUp = mode === "setup";
  const ghost = useGhostCube({ cube, caseId, active: !settingUp });
  const physical = usePhysicalTake({ cube, caseId, active: settingUp, scramble, onHeld: ghost.anchor });
  const take = settingUp ? physical.take : ghost.take;
  const isTest = tested?.caseId === caseId && tested.mode === mode && take.phase !== "waiting";

  const clearTestTimers = useCallback(() => {
    testTimers.current.forEach((timer) => window.clearTimeout(timer));
    testTimers.current = [];
  }, []);

  useEffect(() => {
    clearTestTimers();
  }, [caseId, clearTestTimers, mode]);

  useEffect(() => clearTestTimers, [clearTestTimers]);

  const accept = useCallback(() => {
    if (!take.sealed || !take.alg) return;
    onRecorded(take.alg, { test: isTest, executionMs: take.executionMs });
  }, [isTest, onRecorded, take.alg, take.executionMs, take.sealed]);

  const reset = useCallback(() => {
    clearTestTimers();
    setTested(null);
    if (settingUp) physical.redo();
    else ghost.reset();
  }, [clearTestTimers, ghost, physical, settingUp]);

  const testReady = !connected && !settingUp && take.holding && take.phase === "waiting";

  const runTest = useCallback(() => {
    if (!testReady || testTimers.current.length > 0) return;
    const line = testLine(caseId, caseState(caseId));
    if (!line) {
      console.error(`${caseId}'s alg doesn't solve its case after any U turn`, getCase(caseId).algs[0]);
      return;
    }
    setTested({ caseId, mode: "ghost" });
    testTimers.current = line.map((token, i) => window.setTimeout(() => ghost.play(token), TEST_LEAD_MS + i * TEST_TURN_MS));
  }, [caseId, ghost, testReady]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code !== "Space" && event.key !== "Enter") return;
      // Keys belong to the connect sheet while it's open.
      if (document.querySelector('[role="dialog"]')) return;
      // Never let Space/Enter press a focused button (Skip, Set up my cube) and throw a take away.
      event.preventDefault();
      if (take.sealed) {
        event.preventDefault();
        accept();
        return;
      }
      if (event.code === "Space" && !event.repeat && testReady) {
        event.preventDefault();
        runTest();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [accept, runTest, take.sealed, testReady]);

  // Until it's known which way round his cube faces, the case on screen can't face the same way: he lines it up.
  const lined = useSyncExternalStore(ambientAttitude.subscribe, () => ambientAttitude.anchored);
  const playing = isTest && take.phase === "turning";
  const showReset = !playing && take.phase !== "waiting";
  const algState = take.sealed ? "done" : take.phase === "over" ? "over" : "live";

  return (
    <div className="record" data-case={caseId}>
      <div className="record-top">
        <div className="record-cube-status">
          <CubeStatus onClick={() => setSheetOpen(true)} />
          {connected && link.hasGyro && !lined && (
            <button className="pill" data-tip="Hold white down, green in front, then press" onClick={lineUp}>
              Line up
            </button>
          )}
        </div>
        <div className="record-corner">
          <button className="pill" onClick={onSkip}>
            Skip
          </button>
          {corner}
        </div>
      </div>
      {sheetOpen && <ConnectSheet onClose={() => setSheetOpen(false)} />}
      <div className="record-stage">
        {settingUp && <div className="record-band">{physical.band}</div>}
        <CubeView ref={cube} className="cube record-cube" setup={`z2 ${caseDef.setup}`} />
        <h2 className="record-name">{caseDef.label}</h2>
        <div className={`record-alg ${algState}`}>
          {take.sealed && take.alg !== null ? (
            <>
              <span className="alg">{take.alg}</span>
              <span className="count">{take.algMoves}</span>
              {isTest && <span className="tag test">Test</span>}
            </>
          ) : (
            take.tokens.length > 0 && <span className="alg">{take.tokens.join(" ")}</span>
          )}
        </div>
        <div className="record-actions">
          <div className="side">{showReset && <IconButton icon={RotateCcw} label="Reset" variant={take.phase === "over" ? "primary" : "ghost"} onClick={reset} />}</div>
          <div className="middle">
            {take.sealed ? (
              <button className="pill primary" onClick={accept}>
                Next
              </button>
            ) : (
              testReady && <IconButton icon={Play} label="Test" variant="soft" size="lg" filled onClick={runTest} />
            )}
          </div>
          <div className="side">
            {(connected || settingUp) && (
              <IconButton icon={Boxes} label="Set up my cube" aria-pressed={settingUp} onClick={() => setMode(settingUp ? "ghost" : "setup")} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type PhysicalOptions = {
  cube: RefObject<CubeHandle | null>;
  caseId: string;
  active: boolean;
  scramble?: Promise<CaseScramble>;
  /** His cube reached the case, held `grip` away from the solver's grip. */
  onHeld: (grip: GridOrientation) => void;
};

/**
 * "Set up my cube": the timer's scramble tracker leads his cube into the case (the band, white on top), then the take
 * records from the cube's real state. Idle while not active.
 */
function usePhysicalTake({ cube, caseId, active, scramble, onHeld }: PhysicalOptions) {
  const lastGyro = useRef<Quaternion | null>(null);
  /** The band showed during this take: he followed it, so he's holding the cube as it was scrambled. */
  const followedBand = useRef(false);
  const held = useRef(onHeld);
  // Seeded once from a random value, so each calibration gets different scrambles.
  const [rng] = useState(() => createRng(Math.floor(Math.random() * 1_000_000)));
  const [store] = useState(() => new TakeStore());
  const take = useSyncExternalStore(store.subscribe, store.view);
  const [cubeSession] = useState(
    () => new CubeSession({ inspection: () => false, orientationReference: () => smartCube.orientationReference, solveFix, onFinish: () => undefined }),
  );
  const subscribeCube = useCallback((listener: () => void) => cubeSession.subscribe(listener), [cubeSession]);
  const cubeView = useSyncExternalStore(subscribeCube, () => cubeSession.view());
  const [loaded, setLoaded] = useState<{ caseId: string; scramble: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const current = active && loaded?.caseId === caseId ? loaded.scramble : null;

  useEffect(() => {
    held.current = onHeld;
  });

  const animate = useCallback(
    (moves: readonly string[]) => {
      for (const move of moves) cube.current?.turn(move);
    },
    [cube],
  );

  useEffect(() => {
    if (!active) {
      store.clear();
      return;
    }
    let stale = false;
    (scramble ?? caseScramble(caseId, rng))
      .then((next) => {
        if (!stale) setLoaded({ caseId, scramble: next.scramble });
      })
      .catch((error: unknown) => console.error(`Could not make a scramble for ${caseId}`, error));
    return () => {
      stale = true;
    };
  }, [active, caseId, rng, scramble, store]);

  useEffect(() => {
    if (!active) return;
    const known = smartCube.state.cube;
    if (known) cubeSession.facelets(known, performance.now());
    const off = [
      cubeSession.subscribe(() => {
        const { phase } = cubeSession.view();
        if (phase === "scrambling") followedBand.current = true;
        if (phase !== "ready" || !store.started || store.holding) return;
        // Already in the case (a blip after he'd turned it over, say): he holds it as he solves, not white on top.
        const grip = followedBand.current ? SCRAMBLE_GRIP : SOLVER_GRIP;
        store.hold(lastGyro.current, grip);
        ambientAttitude.hold({ report: lastGyro.current, grip });
        held.current(grip);
      }),
      smartCube.onMove((move, hostT, cubeT) => {
        // The turn that finishes the scramble isn't part of the take.
        const holding = store.holding;
        cubeSession.move(move, hostT, cubeT);
        if (holding) animate(store.turn(move, hostT, cubeT));
      }),
      smartCube.onGyro((q, hostT) => {
        lastGyro.current = q;
        cubeSession.gyro(q, hostT);
        store.gyro(q, hostT);
      }),
      smartCube.onFacelets((state, hostT) => cubeSession.facelets(state, hostT)),
      smartCube.onLost(() => cubeSession.connectionLost()),
    ];
    return () => off.forEach((unsubscribe) => unsubscribe());
  }, [active, animate, cube, cubeSession, store]);

  // A take: on the case's scramble, and again after Reset. Back to the case from wherever the cube is.
  useEffect(() => {
    if (!current) return;
    cube.current?.setTempo(3);
    cube.current?.show(`${current} z2`);
    cubeSession.cancel();
    store.start(caseId, current);
    followedBand.current = false;
    cubeSession.setScramble(current);
  }, [attempt, caseId, cube, cubeSession, current, store]);

  useEffect(() => {
    if (take.phase !== "reached" || take.sealed) return;
    const timer = window.setTimeout(() => store.seal(), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [store, take.phase, take.sealed]);

  const redo = useCallback(() => setAttempt((n) => n + 1), []);

  const band =
    current === null || take.holding ? null : cubeView.plan ? (
      <ScrambleProgress plan={cubeView.plan} />
    ) : (
      <span className="muted">{cubeView.hasState ? "" : "Reading the cube…"}</span>
    );

  return { take, band, redo };
}
