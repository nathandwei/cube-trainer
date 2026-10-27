import { describe, expect, it } from "vitest";
import { FIRST_PRACTICE, afterRep, type Practice } from "./practice";

/** Reps from the start: "c" clean, "s" with a slip. */
function after(reps: string): Practice {
  return [...reps].reduce((practice, rep) => afterRep(practice, rep === "c"), FIRST_PRACTICE);
}

describe("afterRep", () => {
  it.each([
    { reps: "", stage: "copy", learnt: false },
    { reps: "c", stage: "copy", learnt: false },
    { reps: "cc", stage: "cues", learnt: false },
    { reps: "cccc", stage: "memory", learnt: false },
    { reps: "ccccccc", stage: "memory", learnt: true },
    { reps: "cccccsc", stage: "memory", learnt: false },
    { reps: "ccss", stage: "copy", learnt: false },
    { reps: "ccscs", stage: "cues", learnt: false },
    { reps: "ssss", stage: "copy", learnt: false },
    { reps: "cccccccss", stage: "cues", learnt: true },
  ])("after $reps: $stage, learnt $learnt", ({ reps, stage, learnt }) => {
    expect(after(reps)).toMatchObject({ stage, learnt });
  });
});
