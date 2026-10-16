import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { ScrambleBand } from "@/app/components/ScrambleBand";
import {
  displayTokens,
  inViewAfter,
  rawIndexAfter,
  tokenCountBefore,
  type TimedToken,
} from "@/app/lib/display";
import { formatMs } from "@/app/lib/format";
import { splitAlg } from "@/app/lib/frame";
import { navigate } from "@/app/lib/router";
import {
  accuracy,
  flow,
  momentsInOrder,
  stageAt,
  verdictCounts,
  VERDICT_MARK,
  VERDICTS,
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

function setupAfter(solve: SolveRecord, tokens: readonly TimedToken[], count: number): string {
  return [solve.scramble, "z2", ...tokens.slice(0, count).map((t) => t.text)].join(" ");
}

function Review({ solve, analysis }: { solve: SolveRecord; analysis: SolveAnalysis }) {
  const tokens = useMemo(() => displayTokens(solve, analysis), [solve, analysis]);
  const moments = useMemo(() => momentsInOrder(analysis), [analysis]);
  const counts = useMemo(() => verdictCounts(analysis), [analysis]);
  const cube = useRef<CubeHandle>(null);
  // `played` counts display tokens (a slice, wide move or rotation is one); the raw index follows from it.
  const [played, setPlayed] = useState(tokens.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [preview, setPreview] = useState<string | null>(null);
  // Index into `moments` while stepping through the key moments; null when browsing freely.
  const [tour, setTour] = useState<number | null>(null);
  const frame = useRef<number | undefined>(undefined);
  const timers = useRef<number[]>([]);
  const speedRef = useRef(speed);
  // True while the cube shows something other than the solve after `played` tokens (a "show best" line).
  const offTrack = useRef(false);

  const raw = rawIndexAfter(tokens, played);
  const currentStage = stageAt(analysis, Math.max(0, raw - 1));

  const stopEverything = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPlaying(false);
    setPreview(null);
  }, []);

  const jump = useCallback(
    (count: number) => {
      stopEverything();
      const clamped = Math.max(0, Math.min(tokens.length, count));
      setPlayed(clamped);
      offTrack.current = false;
      cube.current?.setTempo(2);
      cube.current?.show(setupAfter(solve, tokens, clamped));
    },
    [solve, tokens, stopEverything],
  );

  useEffect(() => {
    cube.current?.show(setupAfter(solve, tokens, tokens.length));
    return stopEverything;
  }, [solve, tokens, stopEverything]);

  const resync = useCallback(() => {
    if (!offTrack.current) return;
    cube.current?.show(setupAfter(solve, tokens, played));
    offTrack.current = false;
  }, [played, solve, tokens]);

  const stepForward = useCallback(() => {
    if (played >= tokens.length) return;
    stopEverything();
    resync();
    cube.current?.setTempo(2);
    cube.current?.turn(tokens[played]?.text ?? "");
    setPlayed(played + 1);
  }, [played, tokens, resync, stopEverything]);

  const stepBack = useCallback(() => {
    if (played <= 0) return;
    stopEverything();
    resync();
    cube.current?.setTempo(2);
    cube.current?.unturn(tokens[played - 1]?.text ?? "");
    setPlayed(played - 1);
  }, [played, tokens, resync, stopEverything]);

  const play = useCallback(() => {
    stopEverything();
    let at = played >= tokens.length ? 0 : played;
    cube.current?.show(setupAfter(solve, tokens, at));
    offTrack.current = false;
    cube.current?.setTempo(3 * speedRef.current);
    // Advance a virtual clock frame by frame so a speed change applies mid-playback.
    let clock = at === 0 ? 0 : (tokens[at - 1]?.t ?? 0);
    let lastFrame = performance.now();
    setPlaying(true);
    const step = () => {
      const now = performance.now();
      clock += (now - lastFrame) * speedRef.current;
      lastFrame = now;
      while (at < tokens.length && (tokens[at]?.t ?? Infinity) <= clock) {
        cube.current?.turn(tokens[at]?.text ?? "");
        at++;
      }
      setPlayed(at);
      if (at >= tokens.length) {
        setPlaying(false);
        return;
      }
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }, [played, solve, tokens, stopEverything]);

  const showBest = useCallback(
    (stage: Stage, line: string) => {
      const start = tokenCountBefore(tokens, stage.startMove);
      jump(start);
      offTrack.current = true;
      const inView = inViewAfter(tokens, start, line);
      setPreview(inView);
      splitAlg(inView).forEach((move, i) => {
        timers.current.push(window.setTimeout(() => cube.current?.turn(move), 450 + i * LINE_STEP_MS));
      });
    },
    [jump, tokens],
  );

  /** Go to a key moment: the cube waits at the start of that stage and plays the better line if there is one. */
  const visit = useCallback(
    (index: number) => {
      const moment = moments[index];
      const stage = moment ? analysis.stages[moment.stageIndex] : undefined;
      if (!moment || !stage) return;
      setTour(index);
      if (moment.line) showBest(stage, moment.line);
      else jump(tokenCountBefore(tokens, stage.startMove));
    },
    [analysis, jump, moments, showBest, tokens],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (tour !== null && event.key === "ArrowDown") visit(Math.min(moments.length - 1, tour + 1));
      else if (tour !== null && event.key === "ArrowUp") visit(Math.max(0, tour - 1));
      else if (event.key === "ArrowRight") stepForward();
      else if (event.key === "ArrowLeft") stepBack();
      else if (event.key === "Home") jump(0);
      else if (event.key === "End") jump(tokens.length);
      else if (event.code === "Space") {
        if (playing) stopEverything();
        else play();
      } else if (event.key === "Escape") {
        if (tour !== null) setTour(null);
        else navigate("/");
      } else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, moments.length, play, playing, stepBack, stepForward, stopEverything, tokens.length, tour, visit]);

  const turns = tokens.filter((t) => t.kind === "turn").length;
  const tps = turns / (solve.totalMs / 1000);
  const accurate = accuracy(analysis);
  const flowing = flow(solve.moves, solve.totalMs);
  const stage = analysis.stages[currentStage];
  const stageTokens = stage
    ? tokens.map((t, i) => ({ t, i })).filter(({ t }) => t.start >= stage.startMove && t.start < stage.endMove)
    : [];

  return (
    <div className="review-report">
      <section className="replay">
        <div className="replay-head">
          <button className="back" aria-label="back to timer" onClick={() => navigate("/")}>
            ←
          </button>
          <span className="total">{formatMs(solve.totalMs)}</span>
          <span className="meta">
            {turns} moves · {tps.toFixed(2)} tps
          </span>
        </div>
        <ScrambleBand scramble={solve.scramble} className="small" />
        <CubeView ref={cube} setup={setupAfter(solve, tokens, tokens.length)} className="cube big" />
        <div className="controls">
          <button aria-label="start" onClick={() => jump(0)}>
            ⏮
          </button>
          <button aria-label="previous move" onClick={stepBack}>
            ◀
          </button>
          <button className="play" aria-label={playing ? "pause" : "play"} onClick={playing ? stopEverything : play}>
            {playing ? "❚❚" : "▶"}
          </button>
          <button aria-label="next move" onClick={stepForward}>
            ▶︎|
          </button>
          <button aria-label="end" onClick={() => jump(tokens.length)}>
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
        <div className="nowline">
          {preview ? (
            <>
              <span className="label">best</span>
              <span className="moves">{preview}</span>
            </>
          ) : (
            <>
              <span className="label">{stage?.label ?? ""}</span>
              <span className="moves">
                {stageTokens.map(({ t, i }) => (
                  <button
                    key={i}
                    className={`${i === played - 1 ? "current" : i >= played ? "future" : ""} ${t.kind === "rotation" ? "rot" : ""}`}
                    onClick={() => jump(i + 1)}
                  >
                    {t.text}
                  </button>
                ))}
              </span>
            </>
          )}
        </div>
      </section>

      <aside className="report">
        <div className="headline">
          <div>
            <span className="label">accuracy</span>
            <span className="num">{accurate ?? "–"}</span>
          </div>
          <div>
            <span className="label">flow</span>
            <span className="num">{flowing ?? "–"}</span>
          </div>
        </div>

        {tour === null ? (
          <>
            <ul className="verdicts">
              {VERDICTS.map((v) => (
                <li key={v}>
                  <span className={`badge ${v}`}>{VERDICT_MARK[v]}</span>
                  <span className="name">{v}</span>
                  <span className="count">{counts[v]}</span>
                </li>
              ))}
            </ul>
            {moments.length > 0 && (
              <ul className="moments-list">
                {moments.map((moment, i) => (
                  <li key={i}>
                    <button className="what" onClick={() => visit(i)}>
                      {moment.title}
                    </button>
                    {moment.line && <span className="hint">show best</span>}
                  </li>
                ))}
              </ul>
            )}
            {moments.length > 0 && (
              <button className="pill primary step" onClick={() => visit(0)}>
                step through
              </button>
            )}
          </>
        ) : (
          <TourPanel
            moment={moments[tour]}
            index={tour}
            total={moments.length}
            analysis={analysis}
            tokens={tokens}
            onPrev={() => visit(Math.max(0, tour - 1))}
            onNext={() => visit(Math.min(moments.length - 1, tour + 1))}
            onReplay={() => visit(tour)}
            onDone={() => {
              setTour(null);
              jump(tokens.length);
            }}
          />
        )}
      </aside>
    </div>
  );
}

function TourPanel({
  moment,
  index,
  total,
  analysis,
  tokens,
  onPrev,
  onNext,
  onReplay,
  onDone,
}: {
  moment: Moment | undefined;
  index: number;
  total: number;
  analysis: SolveAnalysis;
  tokens: readonly TimedToken[];
  onPrev: () => void;
  onNext: () => void;
  onReplay: () => void;
  onDone: () => void;
}) {
  const stage = moment ? analysis.stages[moment.stageIndex] : undefined;
  if (!moment || !stage) return null;
  const best = moment.line ? inViewAfter(tokens, tokenCountBefore(tokens, stage.startMove), moment.line) : null;
  return (
    <div className="tour">
      <span className="count">
        {index + 1} / {total}
      </span>
      <p className="title">{moment.title}</p>
      {best && (
        <>
          <code className="line">{best}</code>
          <button className="pill" onClick={onReplay}>
            show best
          </button>
        </>
      )}
      <div className="tour-nav">
        <button onClick={onPrev} disabled={index === 0}>
          ‹ prev
        </button>
        {index < total - 1 ? (
          <button className="pill primary" onClick={onNext}>
            next ›
          </button>
        ) : (
          <button className="pill primary" onClick={onDone}>
            done
          </button>
        )}
      </div>
    </div>
  );
}
