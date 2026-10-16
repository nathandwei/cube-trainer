import { Dumbbell, Footprints, Lightbulb } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import type { TimedToken } from "@/app/lib/display";
import { formatMs } from "@/app/lib/format";
import { VERDICTS, type Moment, type Verdict } from "@/app/lib/review";
import { sentenceCase } from "./model";
import { StageLines, VerdictDot, type LineId, type Shown, type StageView, type ViewLine } from "./parts";

type Props = {
  accuracy: number | null;
  flow: number | null;
  counts: Record<Verdict, number>;
  moments: readonly Moment[];
  stages: readonly StageView[];
  tokens: readonly TimedToken[];
  linesFor: (stage: number) => ViewLine[];
  drillFor: (stage: number) => string | null;
  /** The stage whose best lines are open, if any. */
  open: number | null;
  shown: Shown;
  onToggle: (stage: number) => void;
  onPlay: (stage: number, line: LineId) => void;
  onOpenStage: (stage: number) => void;
  onDrill: (id: string) => void;
  onStepThrough: () => void;
};

/** The right panel's default: the scores, the verdict counts, and the moments worth a second look. */
export function ReportPanel(props: Props) {
  const { accuracy, flow, counts, moments, onStepThrough } = props;
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

      {moments.length > 0 && (
        <ul className="rv-moments">
          {moments.map((moment) => (
            <MomentRow key={`${moment.kind}-${moment.stageIndex}`} moment={moment} {...props} />
          ))}
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

function MomentRow({ moment, ...props }: Props & { moment: Moment }) {
  const { stages, tokens, linesFor, drillFor, open, shown, onToggle, onPlay, onOpenStage, onDrill } = props;
  const stage = stages[moment.stageIndex];
  if (!stage) return null;

  if (moment.kind === "pause") {
    const before = stages[moment.stageIndex - 1];
    const drill = drillFor(moment.stageIndex);
    return (
      <li className="rv-moment">
        <button className="rv-moment-open" onClick={() => onOpenStage(moment.stageIndex)}>
          <span className="rv-moment-label">Pause</span>
          <span className="rv-moment-value">{formatMs(moment.ms)}</span>
          <span className="rv-moment-detail">
            {before ? `${before.name} → ` : "→ "}
            {stage.name}
          </span>
        </button>
        {drill && <IconButton icon={Dumbbell} label="Drill" variant="soft" onClick={() => onDrill(drill)} />}
      </li>
    );
  }

  const isOpen = open === moment.stageIndex;
  return (
    <li className="rv-moment">
      <button className="rv-moment-open" onClick={() => onOpenStage(moment.stageIndex)}>
        <span className="rv-moment-label">{stage.name}</span>
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
            lines={linesFor(moment.stageIndex)}
            shownLine={shown?.stage === moment.stageIndex ? shown.line : null}
            onPlay={(line) => onPlay(moment.stageIndex, line)}
          />
        </div>
      )}
    </li>
  );
}
