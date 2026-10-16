import { Lightbulb, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CubeStatus } from "@/app/components/CubeStatus";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import { formatSeconds } from "@/app/lib/format";
import { toSolverFrame } from "@/app/lib/frame";
import { addReps, newRepId, useReps } from "@/app/lib/learnStore";
import { ConnectSheet } from "@/app/smartcube/ConnectSheet";
import { shortCubeName, smartCube, useSmartCube } from "@/app/smartcube/connection";
import { ScrambleProgress } from "@/app/smartcube/ScrambleProgress";
import "@/app/smartcube/smartcube.css";
import {
  applyAlg,
  createRng,
  crossDistance,
  crossScramble,
  scrambledState,
  solveXCross,
  solvedSlots,
  splitMoves,
  xcrossScramble,
  type CubeState,
  type Rng,
} from "@/cube";
import type { Move, Slot } from "@/cube/types";
import type { CrossRep } from "@/shared/learn";
import { bestSolutions, countTurns, isGoal, toneOf, verdictOf, type BestSolutions, type Tone } from "./cross/attempt";
import { BandFit } from "./cross/BandFit";
import { useCubeScramble } from "./cross/cubeScramble";
import { fromTextField, hasModifier, releaseFocus, sentenceCase, takeSpace, useFrameClock } from "./cross/drill";
import { comfortableLength, lengthAround } from "./cross/ladder";
import { crossRating, extraMoves, type CrossRating, type CrossVariant } from "./cross/rating";
import { simulateAttempt } from "./cross/simulate";
import "./drills.css";

/** How long the finished time stays on the full page before the result. */
const DONE_HOLD_MS = 700;
/** An attempt this many turns long has lost its way: it ends, unsaved. */
const MAX_TURNS = 150;
const HISTORY_DOTS = 48;
const HISTORY_ROWS = 8;
/** Dots in the history rise by this much (mockup pixels) per move over the best, up to MAX_DOT_RISE moves. */
const DOT_RISE_U = 8;
const MAX_DOT_RISE = 6;
/** The Test button's pretend cube scrambles at this pace. */
const TEST_SCRAMBLE_STEP_MS = 90;

const VARIANT_LABEL: Record<CrossVariant, string> = { cross: "Cross", xcross: "XCross" };

type Props = { variant: CrossVariant };

type Prepared = { scramble: string; optimal: number };
/** `test`: the Test button's pretend attempt, shown like a real one but never saved. */
type Setup = Prepared & { key: number; retry: boolean; test: boolean };
type Running = { key: number; setup: Setup | null; error: string | null };

/** One finished attempt, as the full page measured it. */
type Outcome = {
  moveCount: number;
  inspectionMs: number;
  executionMs: number;
  /** The turns the cube reported, solver frame. */
  turns: Move[];
  slot?: Slot;
};

type Result = { setup: Setup; rep: CrossRep; best: BestSolutions; turns: Move[] };

async function prepare(variant: CrossVariant, length: number, rng: Rng): Promise<Prepared> {
  const scramble = variant === "cross" ? await crossScramble(length, rng) : await xcrossScramble(length, rng);
  const state = scrambledState(scramble);
  const optimal = variant === "cross" ? crossDistance(state) : solveXCross(state)?.moves;
  if (optimal === undefined) throw new Error(`No xcross found for ${scramble}`);
  return { scramble, optimal };
}

function buildRep(variant: CrossVariant, setup: Setup, outcome: Outcome, best: BestSolutions): CrossRep {
  return {
    kind: "cross",
    id: newRepId(),
    createdAt: Date.now(),
    item: variant,
    scramble: setup.scramble,
    optimalMoves: best.moves,
    moveCount: outcome.moveCount,
    inspectionMs: Math.round(outcome.inspectionMs),
    executionMs: Math.round(outcome.executionMs),
    source: "smartcube",
    moves: outcome.turns,
    ...(outcome.slot ? { slot: outcome.slot } : {}),
    ...(setup.retry ? { retry: true } : {}),
    ...(setup.test ? { test: true } : {}),
  };
}

/**
 * The cross and xcross trainer, for a smart cube. The page holds his rating, the last result and his recent attempts;
 * an attempt runs full page. He scrambles to the band, then plans untimed for as long as he likes once the cube
 * matches; the clock runs from his first turn until the cross (plus any pair, for an xcross) is done, and his moves are
 * set against the best solutions. Without a cube, Start opens the connect sheet; Test plays a pretend attempt (kept on
 * this page only, never saved) so the whole flow can be tried.
 */
export function CrossDrill(props: Props) {
  // Each variant is its own page: switching from cross to xcross must not carry a result or an attempt across.
  return <CrossDrillPage key={props.variant} {...props} />;
}

function CrossDrillPage({ variant }: Props) {
  const allReps = useReps();
  const [testReps, setTestReps] = useState<CrossRep[]>([]);
  const reps = useMemo(
    () => [...allReps.filter((rep): rep is CrossRep => rep.kind === "cross" && rep.item === variant), ...testReps].sort((a, b) => a.createdAt - b.createdAt),
    [allReps, testReps, variant],
  );
  // Test attempts show in the history but never move the rating, or the next real scramble's difficulty with it.
  const rating = useMemo(() => crossRating(reps.filter((rep) => rep.test !== true)), [reps]);
  const link = useSmartCube();
  const connected = link.status === "connected";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rng] = useState(() => createRng(Math.floor(Math.random() * 2 ** 31)));
  const [running, setRunning] = useState<Running | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const upcoming = useRef<Promise<Prepared> | null>(null);
  const attempts = useRef(0);
  const comfortable = comfortableLength(rating?.rating ?? null, variant);

  const prefetch = useCallback(() => {
    const pending = prepare(variant, lengthAround(comfortable, variant, rng), rng);
    // Not fatal: start() makes a fresh one if this failed.
    pending.catch((error: unknown) => console.error(`Could not prepare a ${variant} scramble`, error));
    upcoming.current = pending;
  }, [comfortable, rng, variant]);

  useEffect(prefetch, [prefetch]);

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
      const fresh = () => prepare(variant, lengthAround(comfortable, variant, rng), rng);
      let prepared: Prepared;
      try {
        // A prefetch that failed has already been reported; make a fresh one instead.
        prepared = await (pending ? pending.catch(fresh) : fresh());
      } catch (error) {
        console.error(`Could not make a ${variant} scramble`, error);
        setRunning((current) => (current?.key === key ? { key, setup: null, error: "No scramble" } : current));
        return;
      }
      // Escape while it was being made leaves `running` on another attempt or none.
      setRunning((current) => (current?.key === key ? { key, setup: { ...prepared, key, retry: false, test }, error: null } : current));
      prefetch();
    },
    [comfortable, connected, prefetch, rng, variant],
  );

  const retry = useCallback(() => {
    if (!result) return;
    if (!result.setup.test && !connected) {
      setSheetOpen(true);
      return;
    }
    const key = ++attempts.current;
    releaseFocus();
    setRunning({ key, setup: { ...result.setup, key, retry: true }, error: null });
  }, [connected, result]);

  const finish = useCallback(
    (setup: Setup, outcome: Outcome) => {
      const best = bestSolutions(variant, scrambledState(setup.scramble));
      const rep = buildRep(variant, setup, outcome, best);
      setResult({ setup, rep, best, turns: outcome.turns });
      if (setup.test) {
        setTestReps((current) => [...current, rep]);
        return;
      }
      try {
        addReps([rep]);
      } catch (error) {
        console.error("Could not save the cross attempt", error);
      }
    },
    [variant],
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
        <h1>{VARIANT_LABEL[variant]}</h1>
        <span className="drill-divider" aria-hidden="true" />
        <RatingTag rating={rating} />
        <div className="drill-start">
          {!result && (
            <button className="pill primary" onClick={() => void start(false)}>
              Start
            </button>
          )}
          <IconButton icon={Play} label="Test" variant="soft" filled onClick={() => void start(true)} />
        </div>
        <span className="drill-spacer" />
        <CubeStatus onClick={() => setSheetOpen(true)} />
      </header>
      {result && <CrossResult key={result.rep.id} result={result} onRetry={retry} onNext={() => void start(result.setup.test)} />}
      <CrossHistory reps={reps} />
      {running && (
        <div className="drill-run">
          {running.setup ? (
            <CrossRun
              key={running.key}
              variant={variant}
              setup={running.setup}
              cubeName={link.deviceName}
              onDone={(outcome) => running.setup && finish(running.setup, outcome)}
              onClose={close}
            />
          ) : (
            <Waiting error={running.error} onExit={close} />
          )}
        </div>
      )}
      {sheetOpen && <ConnectSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

function RatingTag({ rating }: { rating: CrossRating | null }) {
  const delta = rating ? Math.round(rating.delta) : 0;
  return (
    <div className="drill-rating" aria-label="Rating">
      <span className="value">{rating ? Math.round(rating.rating) : "–"}</span>
      {delta !== 0 && <span className={`delta ${delta > 0 ? "up" : "down"}`}>{delta > 0 ? `↑${delta}` : `↓${-delta}`}</span>}
    </div>
  );
}

function Waiting({ error, onExit }: { error: string | null; onExit: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);
  return <p className="drill-foot">{error ?? ""}</p>;
}

type RunPhase = "scramble" | "plan" | "solve" | "done";

type Live = {
  state: CubeState;
  turns: Move[];
  shownAt: number | null;
  firstAt: number | null;
  done: boolean;
};

type RunProps = {
  variant: CrossVariant;
  setup: Setup;
  cubeName: string | null;
  onDone: (outcome: Outcome) => void;
  /** Leave the full page: after a finished attempt, or on Escape (nothing saved). */
  onClose: () => void;
};

/**
 * One attempt, full page. A real one follows the smart cube: the band leads it onto the scramble, planning starts
 * when it matches, and its turns are the attempt. A test one does the same with a pretend cube.
 */
function CrossRun({ variant, setup, cubeName, onDone, onClose }: RunProps) {
  const cube = useRef<CubeHandle>(null);
  const live = useRef<Live | null>(null);
  const [phase, setPhase] = useState<RunPhase>("scramble");
  const [solveStart, setSolveStart] = useState<number | null>(null);
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [tone, setTone] = useState<Tone | null>(null);
  const [testProgress, setTestProgress] = useState(0);
  const { view, readyAt } = useCubeScramble(setup.scramble, !setup.test);
  const now = useFrameClock(phase === "solve");
  const shownPhase: RunPhase = !setup.test && phase === "scramble" && readyAt !== null ? "plan" : phase;

  const attempt = useCallback((): Live => {
    live.current ??= { state: scrambledState(setup.scramble), turns: [], shownAt: null, firstAt: null, done: false };
    return live.current;
  }, [setup.scramble]);

  /** One reported turn at host time `t`. */
  const turn = useCallback(
    (move: Move, t: number) => {
      const run = attempt();
      if (run.done) return;
      if (run.firstAt === null) {
        run.firstAt = t;
        setSolveStart(t);
        setPhase("solve");
      }
      cube.current?.turn(move);
      run.turns.push(move);
      run.state = applyAlg(run.state, [move]);
      if (isGoal(variant, run.state)) {
        run.done = true;
        const moveCount = countTurns(run.turns);
        setStoppedAt(t);
        setTone(toneOf(moveCount - setup.optimal));
        setPhase("done");
        onDone({
          moveCount,
          inspectionMs: run.firstAt - (run.shownAt ?? run.firstAt),
          executionMs: t - run.firstAt,
          turns: [...run.turns],
          ...(variant === "xcross" ? { slot: solvedSlots(run.state)[0] } : {}),
        });
        return;
      }
      if (run.turns.length > MAX_TURNS) onClose();
    },
    [attempt, onClose, onDone, setup.optimal, variant],
  );

  // The latest `turn` for timers set up once per attempt.
  const turnNow = useRef(turn);
  useEffect(() => {
    turnNow.current = turn;
  }, [turn]);

  useEffect(() => {
    cube.current?.setTempo(4);
  }, []);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = window.setTimeout(onClose, DONE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [onClose, phase]);

  // A smart cube at the scramble: its turns are the attempt.
  useEffect(() => {
    if (setup.test || readyAt === null) return;
    attempt().shownAt = readyAt;
    return smartCube.onMove((move, hostT) => turnNow.current(move, hostT));
  }, [attempt, readyAt, setup.test]);

  // The Test button: scramble a pretend cube, plan for a while, then turn a good cross with human timing.
  useEffect(() => {
    if (!setup.test) return;
    const timers: number[] = [];
    const later = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const scrambleMoves = splitMoves(setup.scramble);
    const simulated = simulateAttempt(variant, scrambledState(setup.scramble), createRng(setup.key * 7919 + (Date.now() % 100_000)));
    scrambleMoves.forEach((move, i) =>
      later(i * TEST_SCRAMBLE_STEP_MS, () => {
        cube.current?.turn(toSolverFrame(move));
        setTestProgress(i + 1);
      }),
    );
    const planAt = scrambleMoves.length * TEST_SCRAMBLE_STEP_MS + 300;
    later(planAt, () => {
      attempt().shownAt = performance.now();
      setPhase("plan");
    });
    const firstAt = planAt + simulated.planMs;
    simulated.turns.forEach((move, i) => later(firstAt + (simulated.atMs[i] ?? 0), () => turnNow.current(move, performance.now())));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [attempt, setup.key, setup.scramble, setup.test, variant]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || live.current?.done) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const elapsed = solveStart === null ? 0 : shownPhase === "solve" ? Math.max(0, now - solveStart) : stoppedAt !== null ? stoppedAt - solveStart : 0;
  const clockClass = shownPhase === "plan" ? "idle" : shownPhase === "done" && tone ? `tone-${tone}` : "";
  const showBand = shownPhase === "scramble" || shownPhase === "plan";
  const scrambleMoves = splitMoves(setup.scramble).length;
  const band = !showBand ? null : setup.test ? (
    <BandFit moves={scrambleMoves}>
      <ScrambleBand scramble={setup.scramble} progress={shownPhase === "scramble" ? testProgress : undefined} />
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
      <div className={`drill-clock ${clockClass} ${shownPhase === "scramble" ? "hidden" : ""}`}>{formatSeconds(elapsed)}</div>
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
      </p>
    </>
  );
}

function CrossResult({ result, onRetry, onNext }: { result: Result; onRetry: () => void; onNext: () => void }) {
  const cube = useRef<CubeHandle>(null);
  const { setup, rep, best, turns } = result;
  const extra = extraMoves(rep);
  const tone = toneOf(extra);

  function play(moves: readonly string[]) {
    cube.current?.play(`${setup.scramble} z2`, moves.join(" "));
  }

  return (
    <section className="cross-result">
      <BandFit moves={splitMoves(setup.scramble).length}>
        <ScrambleBand scramble={setup.scramble} />
      </BandFit>
      <div className="cross-result-main">
        <div className="cross-numbers">
          <div className="cross-number">
            <span className="label">Yours</span>
            <span className="moves">{rep.moveCount} moves</span>
            <span className={`time tone-${tone}`}>{formatSeconds(rep.executionMs)}</span>
          </div>
          <div className="cross-number best">
            <span className="label">Best</span>
            <span className="moves">{best.moves} moves</span>
            <span className={`verdict tone-${tone}`}>{sentenceCase(verdictOf(extra))}</span>
          </div>
        </div>
        <ol className="cross-lines" aria-label="Best solutions" style={{ "--moves": best.moves } as CSSProperties}>
          {best.lines.map((line, i) => (
            <li key={i}>
              <span className={`line ${i === 0 ? "first" : ""}`}>{line.moves.join(" ")}</span>
              {line.slot && <span className="slot">{line.slot}</span>}
              <IconButton icon={Play} label="Play" filled onClick={() => play(line.moves)} />
            </li>
          ))}
        </ol>
        <div className="cross-actions">
          <button className="pill primary large" onClick={onNext}>
            Next
          </button>
          <div className="group">
            <IconButton icon={RotateCcw} label="Retry" variant="soft" size="lg" onClick={onRetry} />
            {best.lines[0] && <IconButton icon={Lightbulb} label="Show best" variant="soft" size="lg" onClick={() => play(best.lines[0]!.moves)} />}
          </div>
        </div>
      </div>
      <div className="cube-slot result">
        <CubeView ref={cube} className="cube" setup={`${setup.scramble} z2 ${turns.join(" ")}`.trim()} />
      </div>
    </section>
  );
}

function CrossHistory({ reps }: { reps: readonly CrossRep[] }) {
  if (reps.length === 0) return null;
  const dots = reps.slice(-HISTORY_DOTS);
  const rows = reps.slice(-HISTORY_ROWS).reverse();
  return (
    <section className="cross-history" aria-label="Recent attempts">
      <div className="cross-dots">
        {dots.map((rep) => {
          const extra = extraMoves(rep);
          return (
            <span
              key={rep.id}
              className={`drill-dot tone-${toneOf(extra)}`}
              style={{ marginBottom: `calc(${Math.min(extra, MAX_DOT_RISE) * DOT_RISE_U} * var(--u))` }}
              title={`${rep.moveCount} / ${rep.optimalMoves} · ${formatSeconds(rep.executionMs)}`}
            />
          );
        })}
      </div>
      <ul className="cross-rows">
        {rows.map((rep) => {
          const extra = extraMoves(rep);
          return (
            <li key={rep.id}>
              <span className={`drill-dot tone-${toneOf(extra)}`} />
              <span className="moves">
                {rep.moveCount} / {rep.optimalMoves}
              </span>
              <span className="time">{formatSeconds(rep.executionMs)}</span>
              <span className="verdict">{sentenceCase(verdictOf(extra))}</span>
              <span className="note">{rep.test === true ? "Test" : rep.retry === true ? "Retry" : ""}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
