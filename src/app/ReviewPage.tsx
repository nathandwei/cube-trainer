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

type Props = { solve: SolveRecord | undefined };

export function ReviewPage({ solve }: Props) {
  if (!solve?.analysis || solve.moves.length === 0) {
    return (
      <div className="timer">
        <p className="empty">–</p>
        <button className="pill" onClick={() => navigate("/")}>
          Timer
        </button>
      </div>
    );
  }
  return <Review key={solve.id} solve={solve} analysis={solve.analysis} />;
}

function setupAfter(solve: SolveRecord, tokens: readonly TimedToken[], count: number): string {
  return [solve.scramble, "z2", ...tokens.slice(0, count).map((t) => t.text)].join(" ");
}

function Review({ solve, analysis }: { solve: SolveRecord; analysis: SolveAnalysis }) {
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
  const [shown, setShown] = useState<Shown>(null);
  const frame = useRef<number | undefined>(undefined);
  const speedRef = useRef(speed);
  // True while the cube acts out a line from a stage's start instead of showing the solve after `played` tokens.
  const offTrack = useRef(false);

  const focus = focusedStage(spans, played, pinned);
  const current = currentToken(spans, focus, played);

  const stopPlayback = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
    setPlaying(false);
  }, []);

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
    [solve, tokens, stopPlayback],
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
    [played, solve, tokens, stopPlayback],
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
  }, [played, solve, tokens, stopPlayback]);

  /** Acts out a line on the cube from the stage's start: his own moves or one of the best lines. */
  const playLine = useCallback(
    (index: number, line: LineId) => {
      const span = spans[index];
      if (!span) return;
      const moves =
        line === "yours"
          ? tokens
              .slice(span.start, span.end)
              .map((t) => t.text)
              .join(" ")
          : linesFor(index)[line]?.moves;
      if (moves === undefined) return;
      stopPlayback();
      setPlayed(span.start);
      setPinned(index);
      setShown({ stage: index, line });
      offTrack.current = true;
      cube.current?.setTempo(2);
      cube.current?.play(setupAfter(solve, tokens, span.start), moves);
    },
    [linesFor, solve, spans, tokens, stopPlayback],
  );

  const toggleBest = useCallback(
    (index: number) => {
      if (open === index) {
        setOpen(null);
        return;
      }
      setOpen(index);
      playLine(index, linesFor(index).length > 0 ? 0 : "yours");
    },
    [linesFor, open, playLine],
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
      const move = moves[event.key];
      if (move) {
        // The position is shown in the stepper, so moving through the solve opens it.
        setMode("stepper");
        move();
      } else if (event.code === "Space") {
        if (playing) stopPlayback();
        else play();
      } else if (event.key === "Escape") {
        if (mode === "stepper") setMode("report");
        else navigate("/");
      } else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, nextStage, play, playing, previousStage, snapTo, step, stopPlayback, tokens.length]);

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
          <IconButton icon={ArrowLeft} label="Back" size="lg" onClick={() => navigate("/")} />
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
