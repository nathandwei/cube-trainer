import { Play, RotateCcw } from "lucide-react";
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
export type Shown = { stage: number; line: LineId } | null;

export function VerdictDot({ verdict }: { verdict: Verdict | null }) {
  return <span className={`rv-dot ${verdict ?? "none"}`} aria-hidden="true" />;
}

type TokenNav = { played: number; current: number | null; onToken: (index: number) => void };

type LinesProps = {
  /** The stage's own tokens, with their index in the whole solve. */
  yours: readonly { token: TimedToken; index: number }[];
  lines: readonly ViewLine[];
  shownLine: LineId | null;
  onPlay: (line: LineId) => void;
  /** In the stepper, his moves are the position: each one is a step to jump to. */
  nav?: TokenNav;
};

/** His moves for a stage over its best lines, one aligned row each. */
export function StageLines({ yours, lines, shownLine, onPlay, nav }: LinesProps) {
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
          shown={shownLine === "yours"}
          onPlay={() => onPlay("yours")}
        />
      )}
      {lines.map((line, i) => (
        <PlayableLine
          key={i}
          label={i === 0 ? "Best" : ""}
          moves={line.moves}
          tag={showSlots ? line.slot : null}
          shown={shownLine === i}
          onPlay={() => onPlay(i)}
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

type PlayableProps = { label: string; className?: string; moves: string; tag?: string | null; shown: boolean; onPlay: () => void };

function PlayableLine({ label, className = "", moves, tag = null, shown, onPlay }: PlayableProps) {
  return (
    <div className={["rv-line", className].filter(Boolean).join(" ")}>
      <span className="rv-line-label">{label}</span>
      <span className="rv-line-moves">{moves}</span>
      <span className="rv-line-end">
        {tag && <span className="rv-line-tag">{tag}</span>}
        <IconButton icon={shown ? RotateCcw : Play} label={shown ? "Replay" : "Play"} size="sm" aria-pressed={shown} onClick={onPlay} />
      </span>
    </div>
  );
}
