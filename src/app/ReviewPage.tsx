import { ArrowLeft, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { displayTokens, inViewAfter, slotInView, type TimedToken } from "@/app/lib/display";
import { formatMs } from "@/app/lib/format";
import { navigate } from "@/app/lib/router";
import { accuracy, bestPossibleMoves, flow, LONG_RECOGNITION_MS, momentsInOrder, stageVerdict, verdictCounts } from "@/app/lib/review";
import { learnItem } from "@/app/pages/learn/items";
import {
  bestLines,
  currentToken,
  drillFor,
  focusedStage,
  nextStageTarget,
  previousStageTarget,
  stageName,
  stageSpans,
  type Target,
} from "@/app/review/model";
import type { LineId, Shown, StageView, ViewLine } from "@/app/review/parts";
import { ReportPanel } from "@/app/review/ReportPanel";
import { StepperPanel } from "@/app/review/StepperPanel";
import { scrambledState } from "@/cube";
import type { SolveAnalysis, SolveRecord } from "@/cube/types";
import "@/app/review/review.css";

const SPEEDS = [0.5, 1, 2];
/** A line he plays (show best, or his own) goes at this pace: slow enough to follow every move. */
const LINE_STEP_MS = 800;
const LINE_TEMPO = 1.4;

/** `back`: where Back and Escape go (the timer unless the solve came from somewhere else, like the lookahead drill). */
type Props = { solve: SolveRecord | undefined; back?: string };

export function ReviewPage({ solve, back = "/" }: Props) {
  if (!solve?.analysis || solve.moves.length === 0) {
    return (
      <div className="timer">
        <p className="empty">–</p>
        <button className="pill" onClick={() => navigate(back)}>
          Back
        </button>
      </div>
    );
  }
  return <Review key={solve.id} solve={solve} analysis={solve.analysis} back={back} />;
}

function setupAfter(solve: SolveRecord, tokens: readonly TimedToken[], count: number): string {
  return [solve.scramble, "z2", ...tokens.slice(0, count).map((t) => t.text)].join(" ");
}

function Review({ solve, analysis, back }: { solve: SolveRecord; analysis: SolveAnalysis; back: string }) {
  const tokens = useMemo(() => displayTokens(solve, analysis), [solve, analysis]);
  const spans = useMemo(() => stageSpans(tokens, analysis.stages), [tokens, analysis]);
  const stages = useMemo<StageView[]>(
    () =>
      analysis.stages.map((stage, index) => ({
        index,
        name: stageName(stage.label),
        caseName: stage.caseName,
        verdict: stageVerdict(stage),
        moves: stage.moveCount,
        best: bestPossibleMoves(stage),
        ms: stage.totalMs,
        pauseMs: index > 0 && stage.recognitionMs >= LONG_RECOGNITION_MS ? stage.recognitionMs : null,
        span: spans[index] ?? { start: 0, end: 0 },
      })),
    [analysis, spans],
  );
  const moments = useMemo(() => momentsInOrder(analysis), [analysis]);
  const counts = useMemo(() => verdictCounts(analysis), [analysis]);

  // Every stage's best lines, in his view at the stage's start. The cross enumerates its optima from the cross table.
  const bestByStage = useMemo<ViewLine[][]>(
    () =>
      analysis.stages.map((stage, index) => {
        const start = spans[index]?.start ?? 0;
        const crossStart = stage.kind === "cross" && stage.startMove === 0 ? scrambledState(solve.scramble) : undefined;
        return bestLines(stage, crossStart).map((line) => ({
          moves: inViewAfter(tokens, start, line.moves),
          slot: line.slot ? slotInView(tokens, start, line.slot) : null,
        }));
      }),
    [analysis, spans, solve.scramble, tokens],
  );
  const linesFor = useCallback((index: number): ViewLine[] => bestByStage[index] ?? [], [bestByStage]);

  const drillAfterPause = useCallback(
    (index: number) => {
      const stage = analysis.stages[index];
      return stage ? drillFor(stage, (id) => learnItem(id) !== undefined) : null;
    },
    [analysis],
  );

  const cube = useRef<CubeHandle>(null);
  const [mode, setMode] = useState<"report" | "stepper">("report");
  // `played` counts display tokens (a slice, wide move or rotation is one).
  const [played, setPlayed] = useState(tokens.length);
  const [pinned, setPinned] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const [shown, setShownState] = useState<Shown>(null);
  // The line timers and the key handler read the line through this, so a key between ticks never sees an old `at`.
  const shownRef = useRef<Shown>(null);
  const setShown = useCallback((next: Shown) => {
    shownRef.current = next;
    setShownState(next);
  }, []);
  const frame = useRef<number | undefined>(undefined);
  const lineTimers = useRef<number[]>([]);
  const speedRef = useRef(speed);
  // True while the cube acts out a line from a stage's start instead of showing the solve after `played` tokens.
  const offTrack = useRef(false);

  const focus = focusedStage(spans, played, pinned);
  const current = currentToken(spans, focus, played);

  const stopLine = useCallback(() => {
    lineTimers.current.forEach((timer) => window.clearTimeout(timer));
    lineTimers.current = [];
  }, []);

  const stopPlayback = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    setPlaying(false);
    stopLine();
  }, [stopLine]);

  /** The solve after `count` tokens, without animating; `pin` keeps a stage on show at its start. */
  const snapTo = useCallback(
    (count: number, pin: number | null) => {
      stopPlayback();
      const clamped = Math.max(0, Math.min(tokens.length, count));
      setPlayed(clamped);
      setPinned(pin);
      setShown(null);
      offTrack.current = false;
      cube.current?.setTempo(2);
      cube.current?.show(setupAfter(solve, tokens, clamped));
    },
    [setShown, solve, tokens, stopPlayback],
  );

  const goTo = useCallback((target: Target) => snapTo(target.played, target.stage), [snapTo]);

  useEffect(() => {
    cube.current?.show(setupAfter(solve, tokens, tokens.length));
    return stopPlayback;
  }, [solve, tokens, stopPlayback]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const next = played + direction;
      if (next < 0 || next > tokens.length) return;
      stopPlayback();
      if (offTrack.current) {
        cube.current?.show(setupAfter(solve, tokens, played));
        offTrack.current = false;
      }
      cube.current?.setTempo(2);
      if (direction === 1) cube.current?.turn(tokens[played]?.text ?? "");
      else cube.current?.unturn(tokens[next]?.text ?? "");
      setPlayed(next);
      setPinned(null);
      setShown(null);
    },
    [played, setShown, solve, tokens, stopPlayback],
  );

  const play = useCallback(() => {
    stopPlayback();
    let at = played >= tokens.length ? 0 : played;
    cube.current?.show(setupAfter(solve, tokens, at));
    offTrack.current = false;
    setPinned(null);
    setShown(null);
    cube.current?.setTempo(3 * speedRef.current);
    // Advance a virtual clock frame by frame so a speed change applies mid-playback.
    let clock = at === 0 ? 0 : (tokens[at - 1]?.t ?? 0);
    let lastFrame = performance.now();
    setPlaying(true);
    const tick = () => {
      const now = performance.now();
      clock += (now - lastFrame) * speedRef.current;
      lastFrame = now;
      while (at < tokens.length && (tokens[at]?.t ?? Infinity) <= clock) {
        cube.current?.turn(tokens[at]?.text ?? "");
        at++;
      }
      setPlayed(at);
      if (at >= tokens.length) {
        frame.current = undefined;
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [played, setShown, solve, tokens, stopPlayback]);

  /** A stage's line as moves: his own (as he saw them) or one of the best lines. */
  const lineMoves = useCallback(
    (index: number, line: LineId): string[] | null => {
      const span = spans[index];
      if (!span) return null;
      const text = line === "yours" ? tokens.slice(span.start, span.end).map((t) => t.text).join(" ") : linesFor(index)[line]?.moves;
      return text === undefined ? null : text.split(/\s+/).filter(Boolean);
    },
    [linesFor, spans, tokens],
  );

  /** The cube at a stage's start with the first `at` moves of a line done. */
  const showLineAt = useCallback(
    (index: number, line: LineId, at: number) => {
      const span = spans[index];
      const moves = lineMoves(index, line);
      if (!span || !moves) return;
      stopPlayback();
      const clamped = Math.max(0, Math.min(moves.length, at));
      setPlayed(span.start);
      setPinned(index);
      setShown({ stage: index, line, at: clamped, playing: false });
      offTrack.current = true;
      cube.current?.setTempo(LINE_TEMPO);
      cube.current?.show([setupAfter(solve, tokens, span.start), ...moves.slice(0, clamped)].join(" "));
    },
    [lineMoves, setShown, solve, spans, stopPlayback, tokens],
  );

  /** Puts a line on the cube at its start: he steps through it or presses play; it doesn't run by itself. */
  const playLine = useCallback((index: number, line: LineId) => showLineAt(index, line, 0), [showLineAt]);

  const stepLine = useCallback(
    (direction: 1 | -1) => {
      const shown = shownRef.current;
      if (!shown) return;
      const moves = lineMoves(shown.stage, shown.line);
      const next = shown.at + direction;
      if (!moves || next < 0 || next > moves.length) return;
      stopLine();
      cube.current?.setTempo(LINE_TEMPO);
      if (direction === 1) cube.current?.turn(moves[shown.at] ?? "");
      else cube.current?.unturn(moves[next] ?? "");
      setShown({ ...shown, at: next, playing: false });
    },
    [lineMoves, setShown, stopLine],
  );

  const toggleLinePlay = useCallback(() => {
    const shown = shownRef.current;
    if (!shown) return;
    if (shown.playing) {
      stopLine();
      setShown({ ...shown, playing: false });
      return;
    }
    const moves = lineMoves(shown.stage, shown.line);
    if (!moves || moves.length === 0) return;
    // From the end, play it again from the start.
    const from = shown.at >= moves.length ? 0 : shown.at;
    if (from !== shown.at) showLineAt(shown.stage, shown.line, 0);
    const { stage, line } = shown;
    setShown({ stage, line, at: from, playing: true });
    cube.current?.setTempo(LINE_TEMPO);
    lineTimers.current = moves.slice(from).map((move, i) =>
      window.setTimeout(
        () => {
          cube.current?.turn(move);
          const at = from + i + 1;
          setShown({ stage, line, at, playing: at < moves.length });
        },
        (i === 0 ? 150 : 0) + i * LINE_STEP_MS,
      ),
    );
  }, [lineMoves, setShown, showLineAt, stopLine]);

  const lineControls = useMemo(
    () => ({
      onSeek: (at: number) => shown && showLineAt(shown.stage, shown.line, at),
      onStep: stepLine,
      onTogglePlay: toggleLinePlay,
    }),
    [showLineAt, shown, stepLine, toggleLinePlay],
  );

  useEffect(() => stopLine, [stopLine]);

  const toggleBest = useCallback(
    (index: number) => {
      if (open === index) {
        setOpen(null);
        // Its line comes off the cube too, back to the solve where it was.
        if (shown?.stage === index) snapTo(played, pinned);
        return;
      }
      setOpen(index);
      playLine(index, linesFor(index).length > 0 ? 0 : "yours");
    },
    [linesFor, open, pinned, playLine, played, shown, snapTo],
  );

  const openStepper = useCallback(
    (index: number) => {
      setMode("stepper");
      goTo({ stage: index, played: spans[index]?.start ?? 0 });
    },
    [goTo, spans],
  );

  const previousStage = useCallback(() => goTo(previousStageTarget(spans, focus, played)), [focus, goTo, played, spans]);
  const nextStage = useCallback(() => goTo(nextStageTarget(spans, focus)), [focus, goTo, spans]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const moves: Record<string, () => void> = {
        ArrowRight: () => step(1),
        ArrowLeft: () => step(-1),
        ArrowDown: nextStage,
        ArrowUp: previousStage,
        Home: () => snapTo(0, null),
        End: () => snapTo(tokens.length, null),
      };
      if (shownRef.current && (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.code === "Space")) {
        event.preventDefault();
        if (event.repeat) return;
        if (event.code === "Space") toggleLinePlay();
        else stepLine(event.key === "ArrowRight" ? 1 : -1);
        event.preventDefault();
        return;
      }
      const move = moves[event.key];
      if (move) {
        // The position is shown in the stepper, so moving through the solve opens it.
        setMode("stepper");
        move();
      } else if (event.code === "Space") {
        if (playing) stopPlayback();
        else play();
      } else if (event.key === "Escape") {
        // Off a line first, then out of the stepper, then out of the review.
        if (shown) snapTo(played, pinned);
        else if (mode === "stepper") setMode("report");
        else navigate(back);
      } else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, mode, nextStage, pinned, play, played, playing, previousStage, shown, snapTo, step, stepLine, stopPlayback, toggleLinePlay, tokens.length]);

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    speedRef.current = next;
    cube.current?.setTempo(3 * next);
    setSpeed(next);
  }

  return (
    <div className="rv">
      <section className="rv-replay">
        <div className="rv-back">
          <IconButton icon={ArrowLeft} label="Back" size="lg" onClick={() => navigate(back)} />
        </div>
        <div className="rv-time">{formatMs(solve.totalMs)}</div>
        <p className="rv-scramble" aria-label="Scramble">
          {solve.scramble}
        </p>
        <CubeView ref={cube} setup={setupAfter(solve, tokens, tokens.length)} className="cube rv-cube" />
        <div className="rv-playback">
          <IconButton icon={playing ? Pause : Play} label={playing ? "Pause" : "Play"} variant="soft" size="xl" filled onClick={playing ? stopPlayback : play} />
          {/* The speed is its own label, so this round button shows text where the others show an icon. */}
          <button className="icon-btn soft xl rv-speed" aria-label="Speed" data-tip="Speed" onClick={cycleSpeed}>
            {speed}×
          </button>
        </div>
      </section>

      <aside className="rv-panel">
        {mode === "report" ? (
          <ReportPanel
            accuracy={accuracy(analysis)}
            flow={flow(solve.moves, solve.totalMs)}
            counts={counts}
            moments={moments}
            stages={stages}
            tokens={tokens}
            linesFor={linesFor}
            drillFor={drillAfterPause}
            open={open}
            shown={shown}
            onToggle={toggleBest}
            onPlay={playLine}
            lineControls={lineControls}
            onOpenStage={openStepper}
            onDrill={(id) => navigate(`/learn/${encodeURIComponent(id)}`)}
            onStepThrough={() => openStepper(open ?? 0)}
          />
        ) : (
          <StepperPanel
            stages={stages}
            tokens={tokens}
            focus={focus}
            played={played}
            current={current}
            lines={linesFor(focus)}
            shown={shown}
            onStage={(index) => goTo({ stage: index, played: spans[index]?.start ?? 0 })}
            onToken={(index) => snapTo(index + 1, null)}
            onPlay={playLine}
            lineControls={lineControls}
            onPreviousStage={previousStage}
            onPreviousMove={() => step(-1)}
            onNextMove={() => step(1)}
            onNextStage={nextStage}
            onClose={() => setMode("report")}
          />
        )}
      </aside>
    </div>
  );
}
