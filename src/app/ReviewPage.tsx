import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { PaceChart } from "@/app/components/PaceChart";
import { PauseBar } from "@/app/components/PauseBar";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import { formatMs, formatSeconds } from "@/app/lib/format";
import { splitAlg } from "@/app/lib/frame";
import { humanize, type DisplayMove } from "@/app/lib/notation";
import { navigate } from "@/app/lib/router";
import {
  bestPossibleMoves,
  efficiency,
  flow,
  keyMoments,
  PAUSE_MS,
  stageAt,
  stageVerdict,
  VERDICT_MARK,
  type Moment,
} from "@/app/lib/review";
import type { SolveAnalysis, SolveRecord, Stage } from "@/cube/types";

const SPEEDS = [0.5, 1, 2];
const LINE_STEP_MS = 320;

type Props = { solve: SolveRecord | undefined };

export function ReviewPage({ solve }: Props) {
  if (!solve?.analysis || solve.moves.length === 0) {
    return (
      <div className="timer">
        <p className="empty">–</p>
        <button className="pill" onClick={() => navigate("/")}>
          timer
        </button>
      </div>
    );
  }
  return <Review key={solve.id} solve={solve} analysis={solve.analysis} />;
}

function setupAfter(solve: SolveRecord, index: number): string {
  const done = solve.moves.slice(0, index).map((m) => m.move);
  return [solve.scramble, "z2", ...done].join(" ");
}

function Review({ solve, analysis }: { solve: SolveRecord; analysis: SolveAnalysis }) {
  const { moves } = solve;
  const cube = useRef<CubeHandle>(null);
  const [index, setIndex] = useState(moves.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  const frame = useRef<number | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const speedRef = useRef(speed);
  // True while the cube shows something other than the solve after `index` moves (a "show" line).
  const offTrack = useRef(false);

  const moments = useMemo(() => keyMoments(analysis), [analysis]);
  const currentStage = stageAt(analysis, Math.max(0, index - 1));

  const stopEverything = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPlaying(false);
    setPreview(null);
  }, []);

  const seek = useCallback(
    (target: number) => {
      stopEverything();
      const clamped = Math.max(0, Math.min(moves.length, target));
      setIndex(clamped);
      offTrack.current = false;
      cube.current?.setTempo(2);
      cube.current?.show(setupAfter(solve, clamped));
    },
    [moves.length, solve, stopEverything],
  );

  useEffect(() => {
    cube.current?.show(setupAfter(solve, moves.length));
    return stopEverything;
  }, [solve, moves.length, stopEverything]);

  const stepForward = useCallback(() => {
    if (index >= moves.length) return;
    stopEverything();
    cube.current?.setTempo(2);
    if (offTrack.current) {
      cube.current?.show(setupAfter(solve, index));
      offTrack.current = false;
    }
    cube.current?.turn(moves[index]?.move ?? "");
    setIndex(index + 1);
  }, [index, moves, solve, stopEverything]);

  const play = useCallback(() => {
    stopEverything();
    let at = index >= moves.length ? 0 : index;
    cube.current?.show(setupAfter(solve, at));
    offTrack.current = false;
    cube.current?.setTempo(3 * speedRef.current);
    // Advance a virtual clock frame by frame so a speed change applies mid-playback.
    let clock = at === 0 ? 0 : (moves[at - 1]?.t ?? 0);
    let lastFrame = performance.now();
    setPlaying(true);
    const step = () => {
      const now = performance.now();
      clock += (now - lastFrame) * speedRef.current;
      lastFrame = now;
      while (at < moves.length && (moves[at]?.t ?? Infinity) <= clock) {
        cube.current?.turn(moves[at]?.move ?? "");
        at++;
      }
      setIndex(at);
      if (at >= moves.length) {
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [index, moves, solve, stopEverything]);

  const showLine = useCallback(
    (stage: Stage, line: string) => {
      seek(stage.startMove);
      offTrack.current = true;
      setPreview(line);
      splitAlg(line).forEach((move, i) => {
        timers.current.push(window.setTimeout(() => cube.current?.turn(move), 450 + i * LINE_STEP_MS));
      });
    },
    [seek],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") stepForward();
      else if (event.key === "ArrowLeft") seek(index - 1);
      else if (event.key === "Home") seek(0);
      else if (event.key === "End") seek(moves.length);
      else if (event.code === "Space") {
        if (playing) stopEverything();
        else play();
      } else if (event.key === "Escape") navigate("/");
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, moves.length, play, playing, seek, stepForward, stopEverything]);

  const totalMoves = moves.length;
  const tps = totalMoves / (solve.totalMs / 1000);
  const efficient = efficiency(analysis);
  const flowing = flow(moves, solve.totalMs);

  return (
    <div className="review">
      <div className="review-head">
        <button className="back" aria-label="back to timer" onClick={() => navigate("/")}>
          ←
        </button>
        <span className="total">{formatMs(solve.totalMs)}</span>
        <ScrambleBand scramble={solve.scramble} />
      </div>

      <div className="stagecard">
        <CubeView ref={cube} setup={setupAfter(solve, moves.length)} className="cube" />
        <div className="now">
          <span>{preview ? `best: ${preview}` : (analysis.stages[currentStage]?.label ?? "")}</span>
          <span>
            {index} / {totalMoves}
          </span>
        </div>
        <PauseBar moves={moves} totalMs={solve.totalMs} analysis={analysis} index={index} onSeek={seek} height={12} />
        <div className="controls">
          <button aria-label="start" onClick={() => seek(0)}>
            ⏮
          </button>
          <button aria-label="previous move" onClick={() => seek(index - 1)}>
            ◀
          </button>
          <button aria-label={playing ? "pause" : "play"} onClick={playing ? stopEverything : play}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button aria-label="next move" onClick={stepForward}>
            ▶︎|
          </button>
          <button aria-label="end" onClick={() => seek(moves.length)}>
            ⏭
          </button>
          <button
            className="speed"
            onClick={() => {
              const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
              speedRef.current = next;
              cube.current?.setTempo(3 * next);
              setSpeed(next);
            }}
          >
            {speed}×
          </button>
        </div>
        <MoveList solve={solve} analysis={analysis} index={index} onSeek={seek} />
      </div>

      <div className="panel">
        <PaceChart moves={moves} totalMs={solve.totalMs} analysis={analysis} index={index} onSeek={seek} />
        <div className="scores">
          <div className="score">
            <div className="num">{efficient === null ? "–" : `${efficient}%`}</div>
            <div className="label">efficiency</div>
          </div>
          <div className="score">
            <div className="num">{flowing === null ? "–" : `${flowing}%`}</div>
            <div className="label">flow</div>
          </div>
          <div className="score">
            <div className="num">{totalMoves}</div>
            <div className="label">moves</div>
          </div>
          <div className="score">
            <div className="num">{tps.toFixed(2)}</div>
            <div className="label">tps</div>
          </div>
        </div>

        <p className="section-label">stages</p>
        <div className="stages">
          {analysis.stages.map((stage, i) => (
            <StageRow key={i} stage={stage} active={i === currentStage} onClick={() => seek(stage.startMove)} />
          ))}
        </div>

        {moments.length > 0 && (
          <>
            <p className="section-label">key moments</p>
            <div className="moments">
              {moments.map((moment, i) => (
                <MomentRow key={i} moment={moment} analysis={analysis} onSeek={seek} onShowLine={showLine} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StageRow({ stage, active, onClick }: { stage: Stage; active: boolean; onClick: () => void }) {
  const verdict = stageVerdict(stage);
  const best = bestPossibleMoves(stage);
  const detail = [
    `${stage.moveCount} moves${best === null ? "" : ` · best ${best}`}`,
    stage.caseName,
    stage.slots?.join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button className={`stage ${active ? "active" : ""}`} onClick={onClick}>
      <span className={`badge ${verdict ?? "none"}`} title={verdict ?? undefined}>
        {verdict ? VERDICT_MARK[verdict] : "·"}
      </span>
      <span className="name">{stage.label}</span>
      <span className="detail">{detail}</span>
      <span className="t">
        {formatSeconds(stage.totalMs)}
        <small>
          {formatSeconds(stage.recognitionMs)} + {formatSeconds(stage.executionMs)}
        </small>
      </span>
    </button>
  );
}

function MomentRow({
  moment,
  analysis,
  onSeek,
  onShowLine,
}: {
  moment: Moment;
  analysis: SolveAnalysis;
  onSeek: (index: number) => void;
  onShowLine: (stage: Stage, line: string) => void;
}) {
  const stage = analysis.stages[moment.stageIndex];
  if (!stage) return null;
  const line = moment.line;
  return (
    <div className="moment">
      <button className="what" style={{ textAlign: "left" }} onClick={() => onSeek(stage.startMove)}>
        {moment.title}
        {line && (
          <>
            <br />
            <code>{line}</code>
          </>
        )}
      </button>
      {line && (
        <button className="pill" onClick={() => onShowLine(stage, line)}>
          show
        </button>
      )}
    </div>
  );
}

/** Two turns this close together are one move on a smart cube: a slice (R L') or a half turn (R R). */
const SLICE_GAP_MS = 60;

function displayMoves(solve: SolveRecord, analysis: SolveAnalysis): DisplayMove[] {
  return humanize(
    solve.moves.map((m) => m.move),
    (i) => {
      const gap = (solve.moves[i + 1]?.t ?? Infinity) - (solve.moves[i]?.t ?? 0);
      return gap <= SLICE_GAP_MS && stageAt(analysis, i) === stageAt(analysis, i + 1);
    },
  );
}

function MoveList({
  solve,
  analysis,
  index,
  onSeek,
}: {
  solve: SolveRecord;
  analysis: SolveAnalysis;
  index: number;
  onSeek: (index: number) => void;
}) {
  const tokens = useMemo(() => displayMoves(solve, analysis), [solve, analysis]);
  return (
    <div className="movelist">
      {analysis.stages.map((stage, s) => (
        <div className="row" key={s}>
          <span className="label">{stage.label}</span>
          <span className="moves">
            {tokens
              .filter((token) => token.from >= stage.startMove && token.from < stage.endMove)
              .map((token) => {
                const gap = (solve.moves[token.from]?.t ?? 0) - (solve.moves[token.from - 1]?.t ?? 0);
                const state = index - 1 >= token.from && index - 1 <= token.to ? "current" : token.from >= index ? "future" : "";
                return (
                  <span key={token.from} style={{ display: "contents" }}>
                    {token.from > stage.startMove && gap > PAUSE_MS && <span className="gap">{(gap / 1000).toFixed(1)}</span>}
                    <button className={state} onClick={() => onSeek(token.to + 1)}>
                      {token.text}
                    </button>
                  </span>
                );
              })}
          </span>
        </div>
      ))}
    </div>
  );
}
