import { ArrowLeftRight, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Dumbbell, X } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import type { TimedToken } from "@/app/lib/display";
import { formatMs } from "@/app/lib/format";
import { PairChips, StageLines, VerdictDot, type LineControls, type LineId, type Shown, type StageView, type ViewLine } from "./parts";

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
  onDrill: (path: string) => void;
  /** Make the alg he did on a step his alg for its case. */
  onSwitchAlg: (stage: StageView) => void;
  onClose: () => void;
};

/** The right panel while stepping through: one stage at a time, its moves as the position, controls underneath. */
export function StepperPanel(props: Props) {
  const { stages, tokens, focus, played, current, lines, shown, onStage, onToken, onPlay, lineControls, onDrill, onSwitchAlg, onClose } = props;
  const stage = stages[focus];
  if (!stage) return null;
  const { drill } = stage;
  const atStart = played === 0;
  const atEnd = played >= tokens.length;
  return (
    <div className="rv-stepper">
      <div className="rv-stepper-top">
        <nav className="rv-tabs" aria-label="Stages">
          {stages.map((s) => (
            <button key={s.index} className={s.index === focus ? "on" : undefined} aria-current={s.index === focus ? "step" : undefined} onClick={() => onStage(s.index)}>
              {s.name}
              <PairChips pairs={s.pairs} size="xs" />
            </button>
          ))}
        </nav>
        <IconButton icon={X} label="Close" onClick={onClose} />
      </div>

      <div className="rv-head">
        <VerdictDot verdict={stage.verdict} />
        <span className="rv-head-label">
          {stage.name}
          <PairChips pairs={stage.pairs} size="lg" />
          {stage.caseName && <span className="rv-head-case">{stage.caseName}</span>}
          {stage.algUse?.used && <span className="tag">Yours</span>}
          {stage.algUse && !stage.algUse.used && <span className="tag neutral">{stage.algUse.faster ? "Faster alg" : "Other alg"}</span>}
        </span>
        <span className="rv-head-moves">{stage.best === null ? stage.moves : `${stage.moves} / ${stage.best}`}</span>
        <span className="rv-head-time">{formatMs(stage.ms)}</span>
        {stage.pauseMs !== null && <span className="rv-head-pause">Pause {formatMs(stage.pauseMs)}</span>}
      </div>

      <StageLines
        yours={tokens.slice(stage.span.start, stage.span.end).map((token, i) => ({ token, index: stage.span.start + i }))}
        yoursPairs={stage.pairs}
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
        {/* The stage's drill closes the row: the head is full once a stage has a pair chip and a pause. */}
        {stage.algUse && !stage.algUse.used && stage.algUse.faster && stage.algUse.switchable && (
          <IconButton icon={ArrowLeftRight} label="Use this alg" variant="soft" className="rv-nav-drill" onClick={() => onSwitchAlg(stage)} />
        )}
        {drill && <IconButton icon={Dumbbell} label={drill.label} variant="soft" className="rv-nav-drill" onClick={() => onDrill(drill.path)} />}
      </div>
    </div>
  );
}
