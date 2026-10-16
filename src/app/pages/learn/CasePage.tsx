import { ArrowLeft, Check, Disc, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { median } from "@/app/lib/averages";
import { formatSeconds } from "@/app/lib/format";
import { useReps } from "@/app/lib/learnStore";
import { algMoveCount, algOptions, caseAlgSpeed, getCase, isSameAlg, playback, recommendAlg, viewAuf, type AlgSource } from "@/cube";
import type { CaseRep } from "@/shared/learn";
import { CaseDiagram } from "./CaseDiagram";
import { totalMs } from "./progress";

/** Algs play at half the cube's usual pace (his call): slow enough to follow every turn. */
const ALG_STEP_MS = 840;
const ALG_TEMPO = 0.8;

/** Cards shown before "More": his own alg and the two best others, as in round-8 13. */
const FIRST_CARDS = 3;

type Card = { alg: string; moves: number; source: AlgSource | "yours" };

type Props = {
  caseId: string;
  /** His alg for the case, if he has one. */
  current?: string;
  onChoose: (alg: string) => void;
  onBack: () => void;
  /** The page's main action beside the title (Drill on a case page); none while picking for a new case. */
  action?: ReactNode;
  /** Record his own way on the smart cube; shown when recording is possible here. */
  onRecord?: () => void;
};

/** The angle his alg starts from (catalog angle when it can't be placed), as a pre-AUF for the 3D cube. */
function angleOf(caseId: string, alg: string | undefined): string {
  if (!alg) return "";
  try {
    return viewAuf(caseId, alg);
  } catch (error) {
    console.warn(`Can't place ${alg} on ${caseId}`, error);
    return "";
  }
}

/**
 * Best overall: the option the fingertrick model expects to run fastest (moves and how they sit in the hands), with
 * his own measured times standing in for the estimate where he has them. Fewest moves if the model can't say.
 */
function recommended(caseId: string, options: readonly Card[], personalMs: Record<string, number>): Card | undefined {
  try {
    const pick = recommendAlg(caseId, { personalMs });
    const card = pick && options.find((option) => sameAlg(option.alg, pick.alg));
    if (card) return card;
  } catch (error) {
    console.warn(`No recommendation for ${caseId}`, error);
  }
  const fewest = Math.min(...options.map((option) => option.moves));
  return options.find((option) => option.moves === fewest);
}

/** The model's execution time for an alg, or null when it can't read it. */
function estimateMs(caseId: string, alg: string): number | null {
  try {
    return caseAlgSpeed(caseId, alg).ms;
  } catch (error) {
    console.warn(`No estimate for ${alg}`, error);
    return null;
  }
}

/** isSameAlg that treats text it can't read (stored or recorded data) as a different alg instead of crashing the page. */
function sameAlg(a: string, b: string): boolean {
  try {
    return isSameAlg(a, b);
  } catch (error) {
    console.warn(`Can't compare ${a} and ${b}`, error);
    return false;
  }
}

/** "≈1.17 s": what the model thinks the alg takes once recognised; blank when it can't say. */
function formatEstimate(ms: number | null): string {
  return ms === null ? "" : `≈${formatSeconds(ms)} s`;
}

function movesOf(alg: string): number {
  try {
    return algMoveCount(alg);
  } catch (error) {
    console.warn(`Can't count the moves of ${alg}`, error);
    return 0;
  }
}

/**
 * A case and its algs (round-8 13): the cube at his angle, his alg first, then the other options (catalog, mirrors of
 * the sibling case, searched F2L lines), each playable, with Choose. Used to pick an alg for a new case in a session
 * and as the page a case opens to from the grid, where he can switch algs or record his own at any time.
 */
export function CasePage({ caseId, current, onChoose, onBack, action, onRecord }: Props) {
  const caseDef = getCase(caseId);
  const reps = useReps();
  const preview = useRef<CubeHandle>(null);
  const [more, setMore] = useState(false);
  const setup = `z2 ${caseDef.setup} ${angleOf(caseId, current)}`.trim();

  // His median per alg he has drilled on this case: his real speed beats the model's estimate.
  const personalMs = useMemo(() => {
    const byAlg = new Map<string, number[]>();
    for (const rep of reps) {
      if (rep.kind !== "case" || rep.item !== caseId || !rep.correct || !rep.alg) continue;
      byAlg.set(rep.alg, [...(byAlg.get(rep.alg) ?? []), totalMs(rep)]);
    }
    const medians: Record<string, number> = {};
    for (const [alg, times] of byAlg) {
      const middle = median(times);
      if (middle !== null && middle > 0) medians[alg] = middle;
    }
    return medians;
  }, [caseId, reps]);

  // His alg, then the recommended one, then the rest (his ask), each option once.
  const { cards, recommendedAlg } = useMemo(() => {
    const options = algOptions(caseId).map((option): Card => ({ alg: option.alg, moves: option.moves, source: option.source }));
    const best = recommended(caseId, options, personalMs);
    const mine: Card[] = current ? [{ alg: current, moves: movesOf(current), source: "yours" }] : [];
    const rest = options.filter((option) => option !== best && !(current && sameAlg(option.alg, current)));
    const bestIsMine = best !== undefined && current !== undefined && sameAlg(best.alg, current);
    return { cards: [...mine, ...(best && !bestIsMine ? [best] : []), ...rest], recommendedAlg: bestIsMine ? current : best?.alg };
  }, [caseId, current, personalMs]);
  const shown = more ? cards : cards.slice(0, FIRST_CARDS);

  useEffect(() => {
    preview.current?.show(setup);
  }, [setup]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  /** Plays an alg from the angle it starts from, through to a lined-up finish, so every option visibly solves it. */
  function play(alg: string) {
    try {
      const { preAuf, moves } = playback(caseId, alg);
      preview.current?.setTempo(ALG_TEMPO);
      preview.current?.play(`z2 ${caseDef.setup} ${preAuf}`.trim(), moves, ALG_STEP_MS);
    } catch (error) {
      console.error(`Can't play ${alg} on ${caseId}`, error);
    }
  }

  /** His median with an alg, if he has drilled it. */
  function yours(alg: string): number | null {
    return median(reps.filter((r): r is CaseRep => r.kind === "case" && r.item === caseId && r.correct && r.alg !== undefined && sameAlg(r.alg, alg)).map(totalMs));
  }

  return (
    <div className="learn-pick">
      <IconButton icon={ArrowLeft} label="Back" className="pick-back" onClick={onBack} />
      <div className="case-views">
        <div className="case-cube">
          <CubeView ref={preview} className="cube pick-cube" setup={setup} />
          <IconButton icon={RotateCcw} label="Reset" size="sm" className="case-reset" onClick={() => preview.current?.show(setup)} />
        </div>
        {/* The flat picture to recognise it by (top face and its sides, arrows for PLLs), as on jperm.net. */}
        {caseDef.set !== "F2L" && <CaseDiagram caseDef={caseDef} size={180} view="top" alg={current ?? recommendedAlg} arrows />}
      </div>
      <div className="case-head">
        <h2 className="case-title">{caseDef.label}</h2>
        {onRecord && <IconButton icon={Disc} label="Record mine" variant="soft" onClick={onRecord} />}
        {action}
      </div>
      <div className="alg-options">
        {shown.map((card) => {
          const mine = yours(card.alg);
          const isCurrent = card.source === "yours";
          const isRecommended = card.alg === recommendedAlg && cards.length > 1;
          return (
            <div key={card.alg} className={`alg-option ${isCurrent || (!current && isRecommended) ? "best" : ""}`}>
              <code>{card.alg}</code>
              <span className="moves">{card.moves}</span>
              <span className="estimate">{formatEstimate(estimateMs(caseId, card.alg))}</span>
              <span className="note">
                {isCurrent && <span className="tag neutral">{mine !== null ? `Yours ${formatSeconds(mine)}` : "Yours"}</span>}
                {isRecommended && <span className="tag">Recommended</span>}
                {!isCurrent && !isRecommended && mine !== null && `Yours ${formatSeconds(mine)}`}
                {!isCurrent && !isRecommended && mine === null && card.source === "mirror" && <span className="tag neutral">Mirror</span>}
              </span>
              <div className="alg-actions">
                <IconButton icon={Play} label="Play" filled className="outline" onClick={() => play(card.alg)} />
                {isCurrent ? (
                  <span className="chosen" aria-label="Chosen">
                    <Check strokeWidth={2.5} aria-hidden="true" />
                  </span>
                ) : (
                  <button className={`pill ${!current && isRecommended ? "primary" : ""}`} onClick={() => onChoose(card.alg)}>
                    Choose
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {cards.length > FIRST_CARDS && (
        <button className="pill small more" onClick={() => setMore(!more)}>
          {more ? "Fewer" : "More"}
        </button>
      )}
    </div>
  );
}
