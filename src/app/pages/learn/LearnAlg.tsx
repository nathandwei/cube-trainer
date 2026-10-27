import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { smartCube, useSmartCube } from "@/app/smartcube/connection";
import { upFace } from "@/app/smartcube/follower";
import { algChunks, algFingering, getCase, playback, type Fingering } from "@/cube";
import { AlgCoach, type CoachView } from "./coach";
import { CLEAN_TO_PASS, FIRST_PRACTICE, STAGES, afterRep, type Practice, type Stage } from "./practice";

/** Each chunk plays at the case page's pace for algs: slow enough to follow every turn. */
const STEP_MS = 760;
const TEMPO = 0.9;
/** His own turns play quickly, as on the record page. */
const PRACTICE_TEMPO = 3;
/** How long a finished rep's verdict shows before the case is back for the next. */
const REP_PAUSE_MS = 900;
/** Past this many moves to undo, starting the rep over is quicker (his cube's state doesn't matter, only its turns). */
const LONG_UNDO = 2;

const LL_SETS = new Set(["PLL", "OLL", "COLL", "EPLL", "EO"]);

const TOOLS: Readonly<Record<Fingering["tool"], string>> = { wrist: "Wrist", index: "Index", ring: "Ring", thumb: "Thumb", rotation: "Rotate" };
// A move with no fingering isn't done in the alg: the AUF (a U turn), or a rotation at the end that only regrips.

const STAGE_LABEL: Readonly<Record<Stage, string>> = { copy: "Copy it", cues: "From cues", memory: "From memory" };

type Props = { caseId: string; alg: string; onDrill: () => void; onBack: () => void };

/** Watch: the alg stepped through on screen. Practice: done on his own cube, with less shown each time. */
type Mode = "watch" | "practice";

/** The alg he plays: the angle it starts from (pre-AUF), then its moves and the U turn that lines the cube up. */
function lesson(caseId: string, alg: string) {
  const { preAuf, moves } = playback(caseId, alg);
  const ignoreAuf = LL_SETS.has(getCase(caseId).set);
  const chunks = algChunks(moves);
  return { preAuf, chunks, moves: chunks.flatMap((chunk) => chunk.moves), fingering: algFingering(moves, { ignoreAuf }) };
}

/**
 * Learning a newly chosen alg, before drilling it. Watch: the alg in the chunks it's learned by, each move with the
 * hand and finger the speed model's fingering uses (and a mark where a hand regrips), stepped through on the cube a
 * chunk at a time. Practice (with a smart cube): the case is on screen and he does the alg on his own cube, in any
 * state, as often as it takes: each turn that keeps to the alg plays on the case and lights the next move; a wrong
 * one plays too, in red, with what undoes it. Every move shows at first, then only each chunk's first, then nothing,
 * until three clean reps from memory say it's learnt. Drill goes on to timed reps.
 * Keys: → next chunk, ← back one, Space plays it all (practising: starts the rep over), Enter drills.
 */
export function LearnAlg({ caseId, alg, onDrill, onBack }: Props) {
  const caseDef = getCase(caseId);
  const { preAuf, chunks, moves, fingering } = useMemo(() => lesson(caseId, alg), [caseId, alg]);
  const cube = useRef<CubeHandle>(null);
  const link = useSmartCube();
  const connected = link.status === "connected";
  const [mode, setMode] = useState<Mode>(connected ? "practice" : "watch");
  // Watching: chunks done, the cube shows the case after them.
  const [done, setDone] = useState(0);
  const start = `z2 ${caseDef.setup} ${preAuf}`.trim();
  const movesBefore = useCallback((count: number) => chunks.slice(0, count).flatMap((chunk) => chunk.moves), [chunks]);
  const practising = mode === "practice";

  useEffect(() => {
    if (practising) return;
    cube.current?.setTempo(TEMPO);
    cube.current?.show(start);
  }, [practising, start]);

  const goTo = useCallback(
    (count: number, animate: boolean) => {
      const target = Math.max(0, Math.min(chunks.length, count));
      const chunk = chunks[target - 1];
      cube.current?.setTempo(TEMPO);
      if (animate && chunk) cube.current?.play(`${start} ${movesBefore(target - 1).join(" ")}`, chunk.moves.join(" "), STEP_MS);
      else cube.current?.show(`${start} ${movesBefore(target).join(" ")}`);
      setDone(target);
    },
    [chunks, movesBefore, start],
  );

  const playAll = useCallback(() => {
    cube.current?.setTempo(TEMPO);
    cube.current?.play(start, movesBefore(chunks.length).join(" "), STEP_MS);
    setDone(chunks.length);
  }, [chunks.length, movesBefore, start]);

  const practice = usePractice({ cube, moves, start, active: practising });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Enter") onDrill();
      else if (event.key === "Escape") onBack();
      else if (event.code === "Space") {
        event.preventDefault();
        if (practising) practice.restart();
        else playAll();
      } else if (practising) return;
      else if (event.key === "ArrowRight") goTo(done + 1, true);
      else if (event.key === "ArrowLeft") goTo(done - 1, false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, goTo, onBack, onDrill, playAll, practice, practising]);

  const coach = practice.view;
  const off = practising && coach !== null && coach.undo.length > 0;
  const onAlg =
    practice.verdict !== null
      ? practice.verdict === 0
        ? "Clean"
        : `${practice.verdict} slip${practice.verdict === 1 ? "" : "s"}`
      : practice.progress.learnt
        ? "Learnt: keep it fresh, or drill it"
        : "Do it on your cube";
  /** What shows of move `index` while practising: the stage's cues, what's done, and the move he missed. */
  const shows = (index: number, chunkStart: boolean): boolean => {
    if (!practising || practice.stage === "copy") return true;
    const next = coach?.next ?? 0;
    if (index < next || (off && index === next)) return true;
    return practice.stage === "cues" && chunkStart;
  };

  return (
    <div className="learn-session learn-alg">
      <IconButton icon={ArrowLeft} label="Back" size="lg" className="learn-alg-back" onClick={onBack} />
      <div className="tabs learn-modes" role="tablist">
        {(["watch", "practice"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={mode === tab}
            className={mode === tab ? "on" : ""}
            disabled={tab === "practice" && !connected}
            data-tip={tab === "practice" && !connected ? "Connect your cube to practise on it" : undefined}
            onClick={() => setMode(tab)}
          >
            {tab === "watch" ? "Watch" : "Practice"}
          </button>
        ))}
      </div>
      <CubeView ref={cube} className="cube big" setup={start} follow={!practising} />
      <h2 className="learn-alg-title">{caseDef.label}</h2>
      {practising && <PracticeSteps practice={practice.progress} />}
      <div className="learn-alg-chunks">
        {chunks.map((chunk, i) => {
          const end = chunk.start + chunk.moves.length;
          const at = practising ? (coach?.next ?? 0) : null;
          const chunkDone = at === null ? i < done : end <= at;
          const current = at === null ? i === done : chunk.start <= at && at < end;
          return (
            <button
              key={chunk.start}
              className={`learn-chunk ${chunkDone ? "done" : ""} ${current ? "current" : ""}`}
              aria-label={`Chunk ${i + 1}`}
              disabled={practising}
              onClick={() => goTo(i + 1, true)}
            >
              {chunk.moves.map((move, k) => {
                const index = chunk.start + k;
                const how = fingering[index] ?? null;
                const shown = shows(index, k === 0);
                const state = at === null ? "" : index < at ? "did" : index === at ? (off ? "missed" : "next") : "";
                return (
                  <span key={k} className={`learn-move ${how?.hand ?? "none"} ${state}`}>
                    <span className="learn-move-name">
                      {shown && (how?.regrips.length ?? 0) > 0 && <RotateCw className="learn-regrip" aria-label="Regrip" strokeWidth={2} />}
                      {shown ? move : "·"}
                    </span>
                    <span className="learn-move-how">{!shown || (practising && practice.stage !== "copy") ? "" : how ? TOOLS[how.tool] : /^U/.test(move) ? "AUF" : ""}</span>
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>
      {practising ? (
        <p className={`learn-coach-line ${off ? "bad" : practice.verdict === 0 ? "good" : ""}`} role="status">
          {off ? (
            <>
              Undo: {coach.undo.join(" ")}
              {coach.undo.length > LONG_UNDO && <span className="learn-coach-hint"> or Space to start over</span>}
            </>
          ) : (
            onAlg
          )}
        </p>
      ) : (
        <div className="learn-alg-legend" aria-hidden="true">
          <span className="right">Right</span>
          <span className="left">Left</span>
        </div>
      )}
      <div className="learn-alg-controls">
        {practising ? (
          <IconButton icon={RotateCcw} label="Start over" variant="soft" onClick={practice.restart} />
        ) : (
          <>
            <IconButton icon={ChevronLeft} label="Previous" variant="soft" disabled={done === 0} onClick={() => goTo(done - 1, false)} />
            <IconButton icon={RotateCcw} label="Play all" variant="soft" onClick={playAll} />
            <IconButton icon={ChevronRight} label="Next" variant="soft" disabled={done >= chunks.length} onClick={() => goTo(done + 1, true)} />
          </>
        )}
        <button className={`pill ${!practising || practice.progress.learnt ? "primary" : ""}`} onClick={onDrill}>
          Drill
        </button>
      </div>
    </div>
  );
}

/** The three stages, with the one he's on and how many clean reps it still wants. */
function PracticeSteps({ practice }: { practice: Practice }) {
  const at = STAGES.indexOf(practice.stage);
  return (
    <ol className="learn-stages" aria-label="Practice">
      {STAGES.map((stage, i) => {
        const passed = i < at || (practice.learnt && i === at);
        return (
          <li key={stage} className={`${passed ? "passed" : ""} ${i === at && !practice.learnt ? "on" : ""}`}>
            <span className="name">{STAGE_LABEL[stage]}</span>
            {i === at && !practice.learnt && (
              <span className="count">
                {practice.streak}/{CLEAN_TO_PASS[stage]}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

type PracticeOptions = {
  cube: React.RefObject<CubeHandle | null>;
  /** The alg's moves, as the chunks list them. */
  moves: readonly string[];
  /** The case as the screen shows it (the setup alg). */
  start: string;
  active: boolean;
};

/** Reps of the alg on his cube while `active`: the coach checks each turn, and each rep moves his practice on. */
function usePractice({ cube, moves, start, active }: PracticeOptions) {
  const [progress, setProgress] = useState<Practice>(FIRST_PRACTICE);
  const [view, setView] = useState<CoachView | null>(null);
  /** The last rep's slips while its verdict shows; null during a rep. */
  const [verdict, setVerdict] = useState<number | null>(null);
  const [rep, setRep] = useState(0);
  const coach = useRef<AlgCoach | null>(null);

  const restart = useCallback(() => {
    setView(null);
    setVerdict(null);
    setRep((n) => n + 1);
  }, []);

  // A fresh rep: a new coach, and the case back on screen as the alg starts it.
  useEffect(() => {
    if (!active) return;
    const next = new AlgCoach(moves);
    coach.current = next;
    cube.current?.setTempo(PRACTICE_TEMPO);
    cube.current?.show(`${start} ${next.opening.join(" ")}`.trim());
    return () => {
      coach.current = null;
    };
  }, [active, cube, moves, rep, start]);

  useEffect(() => {
    if (!active) return;
    let pause: number | undefined;
    const off = smartCube.onMove((move) => {
      const current = coach.current;
      if (!current || current.view().done) return;
      const report = smartCube.lastGyro;
      for (const token of current.turn(move, report ? upFace(report) : null)) cube.current?.turn(token);
      const seen = current.view();
      setView(seen);
      setVerdict(null);
      if (!seen.done) return;
      setProgress((was) => afterRep(was, seen.slips === 0));
      setVerdict(seen.slips);
      pause = window.setTimeout(() => {
        setView(null);
        setVerdict(null);
        setRep((n) => n + 1);
      }, REP_PAUSE_MS);
    });
    return () => {
      off();
      window.clearTimeout(pause);
    };
  }, [active, cube]);

  return { progress, stage: progress.stage, view, verdict, restart };
}
