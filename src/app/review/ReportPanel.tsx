import { Dumbbell, Footprints, Lightbulb } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import type { TimedToken } from "@/app/lib/display";
import { formatMs } from "@/app/lib/format";
import { VERDICTS, type MovesMoment, type PauseSummary, type Verdict } from "@/app/lib/review";
import { PAUSE_DRILL, sentenceCase } from "./model";
import { PairChips, StageLines, VerdictDot, type LineControls, type LineId, type Shown, type StageView, type ViewLine } from "./parts";

type Props = {
  accuracy: number | null;
  flow: number | null;
  counts: Record<Verdict, number>;
  moves: readonly MovesMoment[];
  pauses: PauseSummary | null;
  stages: readonly StageView[];
  tokens: readonly TimedToken[];
  linesFor: (stage: number) => ViewLine[];
  /** The stage whose best lines are open, if any. */
  open: number | null;
  shown: Shown;
  onToggle: (stage: number) => void;
  onPlay: (stage: number, line: LineId) => void;
  lineControls: LineControls;
  onOpenStage: (stage: number) => void;
  onDrill: (path: string) => void;
  onStepThrough: () => void;
};

/** The right panel's default: the scores, the verdict counts, and the moments worth a second look. */
export function ReportPanel(props: Props) {
  const { accuracy, flow, counts, moves, pauses, stages, onOpenStage, onDrill, onStepThrough } = props;
  return (
    <div className="rv-report">
      <div className="rv-scores">
        <Score label="Accuracy" value={accuracy} />
        <span className="rv-scores-rule" aria-hidden="true" />
        <Score label="Flow" value={flow} />
      </div>

      <ul className="rv-verdicts">
        {VERDICTS.map((verdict) => (
          <li key={verdict} className={counts[verdict] === 0 ? "zero" : undefined}>
            <VerdictDot verdict={verdict} />
            <span>{sentenceCase(verdict)}</span>
            <span className="rv-count">{counts[verdict]}</span>
          </li>
        ))}
      </ul>

      {(moves.length > 0 || pauses) && (
        <ul className="rv-moments">
          {moves.map((moment) => (
            <MovesRow key={moment.stageIndex} moment={moment} {...props} />
          ))}
          {pauses && <PausesRow pauses={pauses} stages={stages} onOpenStage={onOpenStage} onDrill={onDrill} />}
        </ul>
      )}

      <div className="rv-foot">
        <button className="pill large primary" onClick={onStepThrough}>
          <Footprints strokeWidth={1.75} aria-hidden="true" />
          Steps
        </button>
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rv-score">
      <span className="rv-score-label">{label}</span>
      <span className="rv-score-num">{value ?? "–"}</span>
    </div>
  );
}

function MovesRow({ moment, ...props }: Props & { moment: MovesMoment }) {
  const { stages, tokens, linesFor, open, shown, onToggle, onPlay, lineControls, onOpenStage } = props;
  const stage = stages[moment.stageIndex];
  if (!stage) return null;
  const isOpen = open === moment.stageIndex;
  return (
    <li className="rv-moment">
      <button className="rv-moment-open" onClick={() => onOpenStage(moment.stageIndex)}>
        <span className="rv-moment-label">
          {stage.name}
          <PairChips pairs={stage.pairs} />
        </span>
        <span className="rv-moment-value">
          {moment.moves} / {moment.best}
        </span>
        <span className="rv-moment-detail" />
      </button>
      <IconButton icon={Lightbulb} label="Show best" variant="soft" aria-pressed={isOpen} onClick={() => onToggle(moment.stageIndex)} />
      {isOpen && (
        <div className="rv-moment-lines">
          <StageLines
            yours={tokens.slice(stage.span.start, stage.span.end).map((token, i) => ({ token, index: stage.span.start + i }))}
            yoursPairs={stage.pairs}
            lines={linesFor(moment.stageIndex)}
            shown={shown?.stage === moment.stageIndex ? shown : null}
            onPlay={(line) => onPlay(moment.stageIndex, line)}
            controls={lineControls}
          />
        </div>
      )}
    </li>
  );
}

type PausesProps = Pick<Props, "stages" | "onOpenStage" | "onDrill"> & { pauses: PauseSummary };

/**
 * Every long pause in one row: how many and how long in all, then the longest by its transition. A single pause
 * reads like the mockup's row (time, then where). Opening it goes to the stage after the longest pause.
 */
function PausesRow({ pauses, stages, onOpenStage, onDrill }: PausesProps) {
  const { count, totalMs, longest } = pauses;
  const after = stages[longest.stageIndex];
  if (!after) return null;
  const before = stages[longest.stageIndex - 1];
  const transition = `${before ? `${before.name} → ` : "→ "}${after.name}`;
  const single = count === 1;
  return (
    <li className="rv-moment">
      <button
        className="rv-moment-open"
        aria-label={single ? `Pause ${formatMs(totalMs)}, ${transition}` : `${count} pauses, ${formatMs(totalMs)} in all, longest ${transition} ${formatMs(longest.ms)}`}
        onClick={() => onOpenStage(longest.stageIndex)}
      >
        <span className="rv-moment-label">{single ? "Pause" : `${count} pauses`}</span>
        <span className="rv-moment-value">{formatMs(totalMs)}</span>
        <span className="rv-moment-detail">
          {transition}
          {!single && <span className="rv-moment-detail-ms">{formatMs(longest.ms)}</span>}
        </span>
      </button>
      <IconButton icon={Dumbbell} label={PAUSE_DRILL.label} variant="soft" onClick={() => onDrill(PAUSE_DRILL.path)} />
    </li>
  );
}
