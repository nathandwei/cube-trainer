// Learning an alg by doing it on the cube, with less shown each time: every move (copy it), then only each chunk's
// first move (cues), then nothing (memory). Clean reps move him on; a run of reps with a slip takes him back a
// stage. Three clean from memory and it's learnt.

export type Stage = "copy" | "cues" | "memory";

export type Practice = {
  stage: Stage;
  /** Clean reps in a row at this stage. */
  streak: number;
  /** Reps with a slip in a row at this stage. */
  slipped: number;
  /** He's done it from memory enough to drill it (stays so once reached). */
  learnt: boolean;
};

export const STAGES: readonly Stage[] = ["copy", "cues", "memory"];

/** Clean reps in a row that pass each stage. */
export const CLEAN_TO_PASS: Readonly<Record<Stage, number>> = { copy: 2, cues: 2, memory: 3 };

/** Reps with a slip in a row that take him back a stage. */
export const SLIPS_TO_STEP_BACK = 2;

export const FIRST_PRACTICE: Practice = { stage: "copy", streak: 0, slipped: 0, learnt: false };

/** Where he is after a rep, clean or with a slip. */
export function afterRep(practice: Practice, clean: boolean): Practice {
  const at = STAGES.indexOf(practice.stage);
  if (clean) {
    const streak = practice.streak + 1;
    if (streak < CLEAN_TO_PASS[practice.stage]) return { ...practice, streak, slipped: 0 };
    if (practice.stage === "memory") return { ...practice, streak, slipped: 0, learnt: true };
    return { ...practice, stage: STAGES[at + 1]!, streak: 0, slipped: 0 };
  }
  const slipped = practice.slipped + 1;
  if (slipped < SLIPS_TO_STEP_BACK || at === 0) return { ...practice, streak: 0, slipped };
  return { ...practice, stage: STAGES[at - 1]!, streak: 0, slipped: 0 };
}
