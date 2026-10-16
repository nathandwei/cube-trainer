import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import type { TimedToken } from "@/app/lib/display";
import type { Verdict } from "@/app/lib/review";
import type { Span } from "./model";

/** What the panels show of a stage. `best` is null for steps that are not graded (the last layer, multislots). */
export type StageView = {
  index: number;
  /** As shown: "Cross", "P2", "COLL". */
  name: string;
  caseName?: string;
  verdict: Verdict | null;
  moves: number;
  best: number | null;
  ms: number;
  /** The wait before the stage, when it was long enough to be a key moment. */
  pauseMs: number | null;
  span: Span;
};

/** A best line as the solver would read it: renamed into his view, with the slot it pairs when that matters. */
export type ViewLine = { moves: string; slot: string | null };

/** The line the cube is acting out for a stage: his own moves, or best line `n`. */
export type LineId = "yours" | number;
/** A line on the cube, stepped through move by move: `at` moves of it are done; `playing` while it plays itself. */
export type Shown = { stage: number; line: LineId; at: number; playing: boolean } | null;

/** Moving through the line that's on the cube. */
export type LineControls = {
  onSeek: (at: number) => void;
  onStep: (direction: 1 | -1) => void;
  onTogglePlay: () => void;
};

export function VerdictDot({ verdict }: { verdict: Verdict | null }) {
  return <span className={`rv-dot ${verdict ?? "none"}`} aria-hidden="true" />;
}

type TokenNav = { played: number; current: number | null; onToken: (index: number) => void };

type LinesProps = {
  /** The stage's own tokens, with their index in the whole solve. */
  yours: readonly { token: TimedToken; index: number }[];
  lines: readonly ViewLine[];
  /** The line on the cube for this stage, if any. */
  shown: { line: LineId; at: number; playing: boolean } | null;
  /** Puts a line on the cube at its first move (it doesn't play by itself). */
  onPlay: (line: LineId) => void;
  controls: LineControls;
  /** In the stepper, his moves are the position: each one is a step to jump to. */
  nav?: TokenNav;
};

/** His moves for a stage over its best lines, one aligned row each. */
export function StageLines({ yours, lines, shown, onPlay, controls, nav }: LinesProps) {
  const lineState = (line: LineId) => (shown?.line === line ? shown : null);
  const showSlots = new Set(lines.map((line) => line.slot)).size > 1;
  return (
    <div className="rv-lines">
      {nav ? (
        <div className="rv-line">
          <span className="rv-line-label">Yours</span>
          <span className="rv-line-moves rv-tokens">
            {yours.map(({ token, index }) => (
              <button
                key={index}
                className={tokenClass(token, index, nav)}
                aria-current={index === nav.current ? "step" : undefined}
                onClick={() => nav.onToken(index)}
              >
                {token.text}
              </button>
            ))}
          </span>
        </div>
      ) : (
        <PlayableLine
          label="Yours"
          className="yours"
          moves={yours.map(({ token }) => token.text).join(" ")}
          state={lineState("yours")}
          onShow={() => onPlay("yours")}
          controls={controls}
        />
      )}
      {lines.map((line, i) => (
        <PlayableLine
          key={i}
          label={i === 0 ? "Best" : ""}
          moves={line.moves}
          tag={showSlots ? line.slot : null}
          state={lineState(i)}
          onShow={() => onPlay(i)}
          controls={controls}
        />
      ))}
    </div>
  );
}

function tokenClass(token: TimedToken, index: number, nav: TokenNav): string {
  const classes = ["rv-token"];
  if (index === nav.current) classes.push("current");
  else if (index >= nav.played) classes.push("future");
  if (token.kind === "rotation") classes.push("rotation");
  return classes.join(" ");
}

type PlayableProps = {
  label: string;
  className?: string;
  moves: string;
  tag?: string | null;
  state: { at: number; playing: boolean } | null;
  onShow: () => void;
  controls: LineControls;
};

/**
 * One line. Once it's on the cube its moves become steps (click one to go there; the last one done is marked) with
 * back / forward / play beside them, so he can go through it at his own pace rather than watch it fly by.
 */
function PlayableLine({ label, className = "", moves, tag = null, state, onShow, controls }: PlayableProps) {
  const steps = moves.split(/\s+/).filter(Boolean);
  return (
    <div className={["rv-line", className, state ? "shown" : ""].filter(Boolean).join(" ")}>
      <span className="rv-line-label">{label}</span>
      {state ? (
        <span className="rv-line-moves rv-tokens">
          {steps.map((step, i) => (
            <button
              key={i}
              className={["rv-token", i === state.at - 1 ? "current" : i >= state.at ? "future" : ""].filter(Boolean).join(" ")}
              aria-current={i === state.at - 1 ? "step" : undefined}
              onClick={() => controls.onSeek(i + 1)}
            >
              {step}
            </button>
          ))}
        </span>
      ) : (
        <button className="rv-line-moves rv-line-show" onClick={onShow}>
          {moves}
        </button>
      )}
      <span className="rv-line-end">
        {tag && <span className="rv-line-tag">{tag}</span>}
        {state ? (
          <>
            <IconButton icon={ChevronLeft} label="Previous move" size="sm" disabled={state.at === 0} onClick={() => controls.onStep(-1)} />
            <IconButton icon={ChevronRight} label="Next move" size="sm" disabled={state.at >= steps.length} onClick={() => controls.onStep(1)} />
            <IconButton icon={state.playing ? Pause : Play} label={state.playing ? "Pause" : "Play"} size="sm" filled={!state.playing} onClick={controls.onTogglePlay} />
          </>
        ) : (
          <IconButton icon={Play} label="Show on the cube" size="sm" filled onClick={onShow} />
        )}
      </span>
    </div>
  );
}
