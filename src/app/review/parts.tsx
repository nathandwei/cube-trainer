import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import type { TimedToken } from "@/app/lib/display";
import type { Verdict } from "@/app/lib/review";
import type { Slot } from "@/cube/types";
import type { AlgUse } from "./algUse";
import type { Drill, LineGroup, Span } from "./model";

/** A pair as the review names it: the slot its pieces belong to (so its colours) and that slot's name in his view. */
export type PairTag = { slot: Slot; name: string };

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
  /** The pairs a pair or xcross stage made. */
  pairs: readonly PairTag[];
  drill: Drill | null;
  /** A last-layer step against his alg for its case; null when there's nothing to compare. */
  algUse: AlgUse | null;
};

/** A best line as the solver would read it: renamed into his view, with the pairs it solves. */
export type ViewLine = { moves: string; count: number; group: LineGroup; pairs: readonly PairTag[] };

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

/** The two side colours of each slot with yellow up and green in front: front or back first, then the side. */
const SLOT_COLOURS: Record<Slot, readonly [string, string]> = {
  FR: ["green", "orange"],
  FL: ["green", "red"],
  BR: ["blue", "orange"],
  BL: ["blue", "red"],
};

function pairLabel({ slot, name }: PairTag): string {
  const [first, second] = SLOT_COLOURS[slot];
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}-${second} · ${name}`;
}

/** Which pair: its two colours as stickers, the slot's name in his view on hover. */
function PairChip({ pair, size = "sm" }: { pair: PairTag; size?: "xs" | "sm" | "lg" }) {
  const label = pairLabel(pair);
  return (
    <span className={`rv-pair ${size}`} role="img" aria-label={label} data-tip={label}>
      {SLOT_COLOURS[pair.slot].map((colour) => (
        <span key={colour} className={`rv-sticker ${colour}`} />
      ))}
    </span>
  );
}

export function PairChips({ pairs, size }: { pairs: readonly PairTag[]; size?: "xs" | "sm" | "lg" }) {
  if (pairs.length === 0) return null;
  return (
    <span className="rv-pairs">
      {pairs.map((pair) => (
        <PairChip key={pair.slot} pair={pair} size={size} />
      ))}
    </span>
  );
}

type TokenNav = { played: number; current: number | null; onToken: (index: number) => void };

type LinesProps = {
  /** The stage's own tokens, with their index in the whole solve. */
  yours: readonly { token: TimedToken; index: number }[];
  /** The pairs he made, for his row. */
  yoursPairs: readonly PairTag[];
  lines: readonly ViewLine[];
  /** The line on the cube for this stage, if any. */
  shown: { line: LineId; at: number; playing: boolean } | null;
  /** Puts a line on the cube at its first move (it doesn't play by itself). */
  onPlay: (line: LineId) => void;
  controls: LineControls;
  /** In the stepper, his moves are the position: each one is a step to jump to. */
  nav?: TokenNav;
};

const GROUP_LABELS: Record<LineGroup, string> = { best: "Best", xcross: "XCross" };

/**
 * His moves for a stage over its best lines, one aligned row each, each labelled with the pairs it solves. An xcross
 * line also shows its length: the cross's own count in the report and the header doesn't cover it.
 */
export function StageLines({ yours, yoursPairs, lines, shown, onPlay, controls, nav }: LinesProps) {
  const lineState = (line: LineId) => (shown?.line === line ? shown : null);
  return (
    <div className="rv-lines">
      {nav ? (
        <div className="rv-line">
          <LineLabel label="Yours" pairs={yoursPairs} />
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
          <span className="rv-line-end" />
        </div>
      ) : (
        <PlayableLine
          label="Yours"
          className="yours"
          moves={yours.map(({ token }) => token.text).join(" ")}
          count={null}
          pairs={yoursPairs}
          state={lineState("yours")}
          onShow={() => onPlay("yours")}
          controls={controls}
        />
      )}
      {lines.map((line, i) => (
        <PlayableLine
          key={i}
          label={lines[i - 1]?.group === line.group ? "" : GROUP_LABELS[line.group]}
          className={line.group === "xcross" && lines[i - 1]?.group !== "xcross" ? "first-xcross" : ""}
          moves={line.moves}
          count={line.group === "xcross" ? line.count : null}
          pairs={line.pairs}
          state={lineState(i)}
          onShow={() => onPlay(i)}
          controls={controls}
        />
      ))}
    </div>
  );
}

/** A line's label with its pair chips at the column's right edge, so the chips of every row line up. */
function LineLabel({ label, pairs }: { label: string; pairs: readonly PairTag[] }) {
  return (
    <span className="rv-line-label">
      {label}
      <PairChips pairs={pairs} />
    </span>
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
  /** Shown at the end of the line, when its length is news. */
  count: number | null;
  pairs: readonly PairTag[];
  state: { at: number; playing: boolean } | null;
  onShow: () => void;
  controls: LineControls;
};

/**
 * One line. Once it's on the cube its moves become steps (click one to go there; the last one done is marked) with
 * back / forward / play beside them, so he can go through it at his own pace rather than watch it fly by.
 */
function PlayableLine({ label, className = "", moves, count, pairs, state, onShow, controls }: PlayableProps) {
  const steps = moves.split(/\s+/).filter(Boolean);
  return (
    <div className={["rv-line", className, state ? "shown" : ""].filter(Boolean).join(" ")}>
      <LineLabel label={label} pairs={pairs} />
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
        {count !== null && <span className="rv-line-count">{count}</span>}
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
