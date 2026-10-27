import { describe, expect, it } from "vitest";
import { FrameTracker } from "@/cube";
import type { Rotation } from "@/cube/types";
import { AlgCoach } from "./coach";

const words = (alg: string) => alg.split(/\s+/).filter(Boolean);

/** He holds his cube `grip` away from how the alg is written and does `alg`: the quarter turns the cube reports. */
function reported(alg: string, grip: readonly Rotation[] = [], reverseSlices = false): { turns: string[]; up: string } {
  const hand = new FrameTracker();
  for (const rotation of grip) hand.rotate(rotation);
  const up = hand.frame.U;
  const turns = words(alg).flatMap((move) => {
    const quarters = hand.apply(move).turns.map((turn) => (turn.endsWith("2") ? [turn.charAt(0), turn.charAt(0)] : [turn]));
    // A slice's two layers arrive interleaved, quarter by quarter, in either order.
    const order = reverseSlices ? [...quarters].reverse() : quarters;
    return [0, 1].flatMap((k) => order.flatMap((list) => (list[k] ? [list[k]] : [])));
  });
  return { turns, up };
}

function run(coach: AlgCoach, turns: readonly string[], up: string | null): string[] {
  return turns.flatMap((turn) => coach.turn(turn, up));
}

const ALGS = {
  "T perm": "R U R' U' R' F R2 U' R' U' R U R' F'",
  "his A perm, a wide T perm": "R U R' F' r U R' U' r' F R2 U' R'",
  "H perm, slices": "M2 U M2 U2 M2 U M2",
  "Aa from x": "x R' U R' D2 R U' R' D2 R2",
  "an OLL with f": "f R U R' U' f'",
  "Ua with M": "M2 U M U2 M' U M2",
};

describe("AlgCoach", () => {
  it.each(Object.entries(ALGS).flatMap(([name, alg]) => [[], ["y"], ["z2"], ["x", "y'"]].map((grip) => ({ name, alg, grip: grip as Rotation[] }))))(
    "follows $name done held $grip, clean",
    ({ alg, grip }) => {
      const coach = new AlgCoach(words(alg));
      const { turns, up } = reported(alg, grip, true);
      run(coach, turns, up);
      expect(coach.view()).toMatchObject({ done: true, slips: 0, undo: [] });
    },
  );

  it.each(Object.entries(ALGS).map(([name, alg]) => ({ name, alg })))("works out his grip from his turns alone, without a gyro: $name", ({ alg }) => {
    const coach = new AlgCoach(words(alg));
    run(coach, reported(alg, ["y2"]).turns, null);
    expect(coach.view()).toMatchObject({ done: true, slips: 0 });
  });

  it("plays his turns on screen as he sees them, whichever way round he holds his cube", () => {
    const coach = new AlgCoach(words("R U R' F"));
    const { turns, up } = reported("R U R' F", ["y"]);
    expect(run(coach, turns, up)).toEqual(["R", "U", "R'", "F"]);
  });

  it("plays a slice as its two layers, then the rotation it carries", () => {
    const coach = new AlgCoach(words("M2 F"));
    const { turns, up } = reported("M2 F");
    expect(run(coach, turns, up)).toEqual(["R", "L", "R", "L", "x2", "F"]);
  });

  it("starts the cube on screen turned by the rotations the alg opens with", () => {
    expect(new AlgCoach(words("x R' U R'")).opening).toEqual(["x"]);
  });

  it("catches a wrong turn, says how to undo it, and carries on once it's undone", () => {
    const alg = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const coach = new AlgCoach(words(alg));
    const { turns, up } = reported(alg);
    run(coach, turns.slice(0, 2), up);
    // F where R' belongs, then U on top of it.
    run(coach, ["F", "U"], up);
    expect(coach.view()).toMatchObject({ next: 2, slips: 1, undo: ["U'", "F'"] });
    run(coach, ["U'", "F'"], up);
    expect(coach.view()).toMatchObject({ next: 2, undo: [] });
    run(coach, turns.slice(2), up);
    expect(coach.view()).toMatchObject({ done: true, slips: 1 });
  });

  it("asks him to undo only what's left once his own back-and-forth cancels", () => {
    const ePerm = "R' U' R' D' R U' R' D R U R' D' R U R' D R2";
    const coach = new AlgCoach(words(ePerm));
    // U where U' belongs, the next moves from memory, one of them undone, then U' U wiggled while working it out.
    run(coach, [...words("R' U' R' D' R U R' D R U R' R"), ...Array.from({ length: 8 }, () => ["U'", "U"]).flat()], "U");
    expect(coach.view()).toMatchObject({ next: 5, slips: 1, undo: words("U' R' D' R U'") });
  });

  it.each([
    { name: "a wrong U put right with U2", turns: ["U", "U2"] },
    { name: "U' done as three quarters", turns: ["U", "U", "U"] },
  ])("carries on from further along the alg after $name", ({ turns }) => {
    const coach = new AlgCoach(words("R U' R' F"));
    run(coach, ["R", ...turns], "U");
    expect(coach.view()).toMatchObject({ next: 2, slips: 1, undo: [] });
    run(coach, ["R'", "F"], "U");
    expect(coach.view()).toMatchObject({ done: true, slips: 1 });
  });

  it.each([
    { name: "a quarter the wrong way", turns: ["R'"], slip: true },
    { name: "a half turn done the other way round", turns: ["U", "U"], slip: false },
    { name: "a half turn started one way, undone, then done", turns: ["U", "U'", "U'", "U'"], slip: false },
  ])("reads $name", ({ turns, slip }) => {
    const coach = new AlgCoach(words(slip ? "R" : "U2"));
    run(coach, turns, "U");
    expect(coach.view().slips).toBe(slip ? 1 : 0);
  });

  it("lets a last AUF be left off", () => {
    const coach = new AlgCoach(words("R U R' U"));
    run(coach, ["R", "U", "R'"], "U");
    expect(coach.view().done).toBe(true);
  });
});
