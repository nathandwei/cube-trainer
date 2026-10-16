import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CubeView, type CubeHandle } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { algChunks, algFingering, getCase, playback, type Fingering } from "@/cube";

/** Each chunk plays at the case page's pace for algs: slow enough to follow every turn. */
const STEP_MS = 760;
const TEMPO = 0.9;

const LL_SETS = new Set(["PLL", "OLL", "COLL", "EPLL", "EO"]);

const TOOLS: Readonly<Record<Fingering["tool"], string>> = { wrist: "Wrist", index: "Index", ring: "Ring", thumb: "Thumb", rotation: "Rotate" };

type Props = { caseId: string; alg: string; onDrill: () => void; onBack: () => void };

/** The alg he plays: the angle it starts from (pre-AUF), then its moves and the U turn that lines the cube up. */
function lesson(caseId: string, alg: string) {
  const { preAuf, moves } = playback(caseId, alg);
  const ignoreAuf = LL_SETS.has(getCase(caseId).set);
  return { preAuf, chunks: algChunks(moves), fingering: algFingering(moves, { ignoreAuf }) };
}

/**
 * Learning a newly chosen alg, before drilling it: the alg in the chunks it's learned by, each move with the hand and
 * finger the speed model's fingering uses (and a mark where a hand regrips), stepped through on the cube a chunk at
 * a time. Drill goes on to timed reps. Keys: → next chunk, ← back one, Space plays it all, Enter drills.
 */
export function LearnAlg({ caseId, alg, onDrill, onBack }: Props) {
  const caseDef = getCase(caseId);
  const { preAuf, chunks, fingering } = useMemo(() => lesson(caseId, alg), [caseId, alg]);
  const cube = useRef<CubeHandle>(null);
  // Chunks done: the cube shows the case after them.
  const [done, setDone] = useState(0);
  const start = `z2 ${caseDef.setup} ${preAuf}`.trim();
  const movesBefore = useCallback((count: number) => chunks.slice(0, count).flatMap((chunk) => chunk.moves), [chunks]);

  useEffect(() => {
    cube.current?.setTempo(TEMPO);
    cube.current?.show(start);
  }, [start]);

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

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goTo(done + 1, true);
      else if (event.key === "ArrowLeft") goTo(done - 1, false);
      else if (event.code === "Space") {
        event.preventDefault();
        playAll();
      } else if (event.key === "Enter") onDrill();
      else if (event.key === "Escape") onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, goTo, onBack, onDrill, playAll]);

  return (
    <div className="learn-session learn-alg">
      <IconButton icon={ArrowLeft} label="Back" size="lg" className="learn-alg-back" onClick={onBack} />
      <CubeView ref={cube} className="cube big" setup={start} />
      <h2 className="learn-alg-title">{caseDef.label}</h2>
      <div className="learn-alg-chunks">
        {chunks.map((chunk, i) => (
          <button
            key={chunk.start}
            className={`learn-chunk ${i < done ? "done" : ""} ${i === done ? "current" : ""}`}
            aria-label={`Chunk ${i + 1}: ${chunk.moves.join(" ")}`}
            onClick={() => goTo(i + 1, true)}
          >
            {chunk.moves.map((move, k) => {
              const how = fingering[chunk.start + k] ?? null;
              return (
                <span key={k} className={`learn-move ${how?.hand ?? "none"}`}>
                  <span className="learn-move-name">
                    {(how?.regrips.length ?? 0) > 0 && <RotateCw className="learn-regrip" aria-label="Regrip" strokeWidth={2} />}
                    {move}
                  </span>
                  <span className="learn-move-how">{how ? TOOLS[how.tool] : "AUF"}</span>
                </span>
              );
            })}
          </button>
        ))}
      </div>
      <div className="learn-alg-legend" aria-hidden="true">
        <span className="right">Right</span>
        <span className="left">Left</span>
      </div>
      <div className="learn-alg-controls">
        <IconButton icon={ChevronLeft} label="Previous" variant="soft" disabled={done === 0} onClick={() => goTo(done - 1, false)} />
        <IconButton icon={RotateCcw} label="Play all" variant="soft" onClick={playAll} />
        <IconButton icon={ChevronRight} label="Next" variant="soft" disabled={done >= chunks.length} onClick={() => goTo(done + 1, true)} />
        <button className="pill primary" onClick={onDrill}>
          Drill
        </button>
      </div>
    </div>
  );
}
