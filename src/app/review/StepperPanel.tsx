import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import type { TimedToken } from "@/app/lib/display";
import { formatMs } from "@/app/lib/format";
import { StageLines, VerdictDot, type LineControls, type LineId, type Shown, type StageView, type ViewLine } from "./parts";

type Props = {
  stages: readonly StageView[];
  tokens: readonly TimedToken[];
  focus: number;
  played: number;
  current: number | null;
  lines: ViewLine[];
  shown: Shown;
  onStage: (stage: number) => void;
  onToken: (index: number) => void;
  onPlay: (stage: number, line: LineId) => void;
  lineControls: LineControls;
  onPreviousStage: () => void;
  onPreviousMove: () => void;
  onNextMove: () => void;
  onNextStage: () => void;
  onClose: () => void;
};

/** The right panel while stepping through: one stage at a time, its moves as the position, controls underneath. */
export function StepperPanel(props: Props) {
  const { stages, tokens, focus, played, current, lines, shown, onStage, onToken, onPlay, lineControls, onClose } = props;
  const stage = stages[focus];
  if (!stage) return null;
  const atStart = played === 0;
  const atEnd = played >= tokens.length;
  return (
    <div className="rv-stepper">
      <div className="rv-stepper-top">
        <nav className="rv-tabs" aria-label="Stages">
          {stages.map((s) => (
            <button key={s.index} className={s.index === focus ? "on" : undefined} aria-current={s.index === focus ? "step" : undefined} onClick={() => onStage(s.index)}>
              {s.name}
            </button>
          ))}
        </nav>
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>

      <div className="rv-head">
        <VerdictDot verdict={stage.verdict} />
        <span className="rv-head-label">
          {stage.name}
          {stage.caseName && <span className="rv-head-case">{stage.caseName}</span>}
        </span>
        <span className="rv-head-moves">{stage.best === null ? stage.moves : `${stage.moves} / ${stage.best}`}</span>
        <span className="rv-head-time">{formatMs(stage.ms)}</span>
        {stage.pauseMs !== null && <span className="rv-head-pause">Pause {formatMs(stage.pauseMs)}</span>}
      </div>

      <StageLines
        yours={tokens.slice(stage.span.start, stage.span.end).map((token, i) => ({ token, index: stage.span.start + i }))}
        lines={lines}
        shown={shown?.stage === focus ? shown : null}
        onPlay={(line) => onPlay(focus, line)}
        controls={lineControls}
        nav={{ played, current, onToken }}
      />

      <div className="rv-nav">
        <IconButton icon={ChevronsLeft} label="Previous stage" variant="soft" onClick={props.onPreviousStage} disabled={atStart} />
        <IconButton icon={ChevronLeft} label="Previous move" variant="soft" onClick={props.onPreviousMove} disabled={atStart} />
        <IconButton icon={ChevronRight} label="Next move" variant="soft" onClick={props.onNextMove} disabled={atEnd} />
        <IconButton icon={ChevronsRight} label="Next stage" variant="soft" onClick={props.onNextStage} disabled={atEnd} />
      </div>
    </div>
  );
}
