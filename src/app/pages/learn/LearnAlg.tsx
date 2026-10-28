import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { ScrambleProgress } from "@/app/smartcube/ScrambleProgress";
import { smartCube, useSmartCube } from "@/app/smartcube/connection";
import { upFace } from "@/app/smartcube/follower";
import { algChunks, algFingering, getCase, playback, type Fingering } from "@/cube";
import { AlgCoach, type CoachView } from "./coach";
import { CLEAN_TO_PASS, FIRST_PRACTICE, STAGES, afterRep, type Practice, type Stage } from "./practice";
import { Recognise } from "./Recognise";
import { quartersOf, RECOGNISED_SETS, recognitionAngles } from "./recognition";

/** Each chunk plays at the case page's pace for algs: slow enough to follow every turn. */
const STEP_MS = 760;
const TEMPO = 0.9;
/** His own turns play quickly, as on the record page. */
const PRACTICE_TEMPO = 3;
/** How long a finished rep's verdict shows before the case is back for the next. */
const REP_PAUSE_MS = 900;
/** Past this many moves back the way can't be followed: the rep ends and starts over (only his cube's turns count). */
const LONG_UNDO = 2;

const LL_SETS = new Set(["PLL", "OLL", "COLL", "EPLL", "EO"]);

const TOOLS: Readonly<Record<Fingering["tool"], string>> = { wrist: "Wrist", index: "Index", ring: "Ring", thumb: "Thumb", rotation: "Rotate" };
// A move with no fingering isn't done in the alg: the AUF (a U turn), or a rotation at the end that only regrips.

const STAGE_LABEL: Readonly<Record<Stage, string>> = { copy: "Copy it", cues: "From cues", memory: "From memory" };

type Props = { caseId: string; alg: string; onDrill: () => void; onBack: () => void };

/**
 * Recognise: how to tell the case from two sides, and where the alg starts from. Watch: the alg stepped through on
 * screen. Practice: done on his own cube, with less shown each time.
 */
type Mode = "recognise" | "watch" | "practice";

const MODE_LABEL: Readonly<Record<Mode, string>> = { recognise: "Recognise", watch: "Watch", practice: "Practice" };

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
 * one plays too, in red, with what undoes it (more than a couple of moves to undo, and the rep starts over). Every
 * move shows at first, then only each chunk's first, then nothing, until three clean reps from memory say it's learnt.
 * Drill goes on to timed reps. A case told apart from two sides (PLL, EPLL) opens on Recognise first: knowing when to
 * do the alg comes before doing it.
 * Keys: → next chunk, ← back one, Space plays it all (practising: starts the rep over), Enter drills. Recognising:
 * ← and → step through the angles, and so does a U turn on his cube.
 */
export function LearnAlg({ caseId, alg, onDrill, onBack }: Props) {
  const caseDef = getCase(caseId);
  const { preAuf, chunks, moves, fingering } = useMemo(() => lesson(caseId, alg), [caseId, alg]);
  const cube = useRef<CubeHandle>(null);
  const link = useSmartCube();
  const connected = link.status === "connected";
  const recognisable = RECOGNISED_SETS.has(caseDef.set);
  const modes: readonly Mode[] = recognisable ? ["recognise", "watch", "practice"] : ["watch", "practice"];
  const [mode, setMode] = useState<Mode>(recognisable ? "recognise" : connected ? "practice" : "watch");
  const angles = useMemo(() => (recognisable ? recognitionAngles(caseId, alg) : []), [alg, caseId, recognisable]);
  // The angle picked, in U turns from where the alg starts.
  const [angleAt, setAngleAt] = useState(0);
  // Watching: chunks done, the cube shows the case after them.
  const [done, setDone] = useState(0);
  const start = `z2 ${caseDef.setup} ${preAuf}`.trim();
  const movesBefore = useCallback((count: number) => chunks.slice(0, count).flatMap((chunk) => chunk.moves), [chunks]);
  const practising = mode === "practice";
  const recognising = mode === "recognise";

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

  /** The angle `step` places along from the one picked, in the order the angles are listed. */
  const stepAngle = useCallback(
    (step: number) => {
      const index = angles.findIndex((angle) => angle.quarters === angleAt);
      const next = angles[(index + step + angles.length) % angles.length];
      if (next) setAngleAt(next.quarters);
    },
    [angleAt, angles],
  );

  useEffect(() => {
    if (!recognising) return;
    return smartCube.onMove((move) => {
      const quarters = quartersOf(move);
      if (quarters !== null) setAngleAt((at) => (at + quarters) % 4);
    });
  }, [recognising]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Enter") onDrill();
      else if (event.key === "Escape") onBack();
      else if (recognising) {
        if (event.key === "ArrowRight") stepAngle(1);
        else if (event.key === "ArrowLeft") stepAngle(-1);
      } else if (event.code === "Space") {
        event.preventDefault();
        if (practising) practice.restart();
        else playAll();
      } else if (practising) return;
      else if (event.key === "ArrowRight") goTo(done + 1, true);
      else if (event.key === "ArrowLeft") goTo(done - 1, false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, goTo, onBack, onDrill, playAll, practice, practising, recognising, stepAngle]);

  const coach = practice.view;
  const back = practising && practice.verdict === null ? (coach?.back ?? null) : null;
  const off = back !== null;
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
        {modes.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={mode === tab}
            className={mode === tab ? "on" : ""}
            disabled={tab === "practice" && !connected}
            data-tip={tab === "practice" && !connected ? "Connect your cube to practise on it" : undefined}
            onClick={() => {
              setMode(tab);
              // The cube comes back showing the case, so stepping through starts over too.
              setDone(0);
            }}
          >
            {MODE_LABEL[tab]}
          </button>
        ))}
      </div>
      {recognising ? (
        <Recognise caseId={caseId} angles={angles} at={angleAt} onAt={setAngleAt} />
      ) : (
        <CubeView ref={cube} className="cube big" setup={start} follow={!practising} />
      )}
      <h2 className="learn-alg-title">{caseDef.label}</h2>
      {practising && <PracticeSteps practice={practice.progress} />}
      {!recognising && (
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
      )}
      {practising ? (
        <div className="learn-coach" role="status">
          {back ? (
            <ScrambleProgress plan={{ ...back, fix: true, thinking: false }} to="the alg" />
          ) : (
            <p className={`learn-coach-line ${practice.verdict === 0 ? "good" : ""}`}>{onAlg}</p>
          )}
        </div>
      ) : (
        !recognising && (
          <div className="learn-alg-legend" aria-hidden="true">
            <span className="right">Right</span>
            <span className="left">Left</span>
          </div>
        )
      )}
      <div className="learn-alg-controls">
        {practising ? (
          <IconButton icon={RotateCcw} label="Start over" variant="soft" onClick={practice.restart} />
        ) : recognising ? (
          <>
            <IconButton icon={ChevronLeft} label="Previous angle" variant="soft" onClick={() => stepAngle(-1)} />
            <IconButton icon={ChevronRight} label="Next angle" variant="soft" onClick={() => stepAngle(1)} />
          </>
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
      if (!current) return;
      const report = smartCube.lastGyro;
      for (const token of current.turn(move, report ? upFace(report) : null)) cube.current?.turn(token);
      const seen = current.view();
      setView(seen);
      setVerdict(null);
      const lost = seen.back !== null && seen.back.moves.length - seen.back.done > LONG_UNDO;
      if (!seen.done && !lost) return;
      // Turns while the verdict shows are not part of this rep or the next.
      coach.current = null;
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
