import type { KPattern, KTransformation } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { describe, expect, it } from "vitest";
import { generateDemoPlan } from "./demo";
import { FrameTracker, splitMoves } from "./frame";
import { EPLL_CASES } from "./ll";
import { countDisplayTurns, humanize, type DisplayToken } from "./notation";
import { createRng, randomScramble } from "./random";
import type { RotationEvent, TimedMove } from "./types";

const kpuzzle = await cube3x3x3.kpuzzle();

const always = (): boolean => true;
const never = (): boolean => false;

/** Turns `gap` ms apart; "R+L'" is a slice-like pair reported 10 ms apart. */
function timed(sequence: string, gap = 150): TimedMove[] {
  let t = 0;
  return sequence.split(" ").flatMap((group, i) => {
    if (i > 0) t += gap;
    return group.split("+").map((move, k) => ({ move, t: (t += k > 0 ? 10 : 0) }));
  });
}

function texts(tokens: readonly DisplayToken[]): string {
  return tokens.map((token) => token.text).join(" ");
}

describe("humanize without rotation events (old solves)", () => {
  const text = (moves: string): string => texts(humanize(timed(moves), [], always));

  it.each([
    { name: "Ua perm as reported", reported: "U R2 L2 D R L' F2 R' L D R2 L2", expected: "U M2 U M U2 M' U M2" },
    { name: "plain turns stay", reported: "R U R' U'", expected: "R U R' U'" },
    { name: "pair in either order", reported: "L' R", expected: "M" },
    { name: "E slice", reported: "U D'", expected: "E" },
    { name: "S slice", reported: "F' B", expected: "S" },
    { name: "two quarter turns are a half turn", reported: "R R U' U'", expected: "R2 U2" },
    { name: "a quarter turn and its inverse stay apart", reported: "R R'", expected: "R R'" },
  ])("$name", ({ reported, expected }) => {
    expect(text(reported)).toBe(expected);
  });

  it("only merges where allowed", () => {
    expect(texts(humanize(timed("R L' U U"), [], never))).toBe("R L' U U");
  });

  it("keeps the index span of a merged slice", () => {
    expect(humanize(timed("U R L'"), [], always)[1]).toEqual({ kind: "turn", text: "M", start: 1, end: 3 });
  });
});

describe("humanize with rotation events", () => {
  /** `rotations` maps an `after` index to the rotation, timed with the turn before it (as part of that turn). */
  function withRotations(sequence: string, rotations: [number, RotationEvent["rotation"]][], lag = 0) {
    const moves = timed(sequence);
    const events = rotations.map(([after, rotation]) => ({ rotation, after, t: (moves[after - 1]?.t ?? 0) + lag }));
    return humanize(moves, events, never);
  }

  it.each([
    ["L", 1, "x", "r"],
    ["R", 1, "x'", "l"],
    ["D", 1, "y", "u"],
    ["U", 1, "y'", "d"],
    ["B", 1, "z", "f"],
    ["F", 1, "z'", "b"],
    ["L2", 1, "x2", "r2"],
    ["L'", 1, "x'", "r'"],
    ["R+L'", 2, "x'", "M"],
    ["L'+R", 2, "x'", "M"],
    ["R'+L", 2, "x", "M'"],
    ["R2+L2", 2, "x2", "M2"],
    ["U+D'", 2, "y'", "E"],
    ["D+U'", 2, "y", "E'"],
    ["F'+B", 2, "z", "S"],
    ["F2+B2", 2, "z2", "S2"],
  ] as const)("%s then %s at %i reads as %s", (sequence, after, rotation, expected) => {
    expect(texts(withRotations(sequence, [[after, rotation]]))).toBe(expected);
  });

  it("renames turns into the solver's view as rotations accumulate", () => {
    expect(texts(withRotations("B U B' R", [[0, "y"]]))).toBe("y R U R' F");
    expect(texts(withRotations("R+L' U", [[2, "x'"]]))).toBe("M F");
  });

  it("keeps a rotation that comes well after the turn apart from it", () => {
    expect(texts(withRotations("D R", [[1, "y"]], 300))).toBe("D y F");
  });

  it("does not read turns that arrive apart as a slice", () => {
    expect(texts(withRotations("F' B", [[2, "z"]]))).toBe("F' f");
  });

  it("gives rotations an empty span at their place in the stream", () => {
    const tokens = withRotations("U R+L' F", [[0, "x2"], [3, "x'"]]);
    expect(tokens).toEqual([
      { kind: "rotation", text: "x2", start: 0, end: 0 },
      { kind: "turn", text: "D", start: 0, end: 1 },
      { kind: "turn", text: "M", start: 1, end: 3 },
      { kind: "turn", text: "U", start: 3, end: 4 },
    ]);
  });

  it("keeps a trailing rotation", () => {
    expect(withRotations("R", [[1, "y"]], 500).at(-1)).toEqual({ kind: "rotation", text: "y", start: 1, end: 1 });
  });

  it("merges back-to-back rotations about one axis", () => {
    expect(texts(withRotations("R", [[0, "y"], [0, "y"]]))).toBe("y2 L");
    expect(texts(withRotations("R", [[0, "y"], [0, "y'"]]))).toBe("R");
    expect(texts(withRotations("R", [[0, "y"], [0, "x"]]))).toBe("y x U");
  });

  it("merges half turns only where allowed and never across a rotation", () => {
    const moves = timed("U U R R");
    expect(texts(humanize(moves, [{ rotation: "y", after: 0, t: 0 }], always))).toBe("y U2 F2");
    expect(texts(humanize(moves, [{ rotation: "y", after: 1, t: 400 }], always))).toBe("U y U F2");
  });

  it.each([
    [[{ rotation: "y", after: 3, t: 0 }]],
    [[{ rotation: "y", after: -1, t: 0 }]],
    [
      [
        { rotation: "y", after: 1, t: 0 },
        { rotation: "y", after: 0, t: 0 },
      ],
    ],
  ] as const)("rejects misplaced rotation events %j", (rotations) => {
    expect(() => humanize(timed("R U"), rotations, never)).toThrow();
  });
});

describe("countDisplayTurns", () => {
  it("counts slices and wide moves once and rotations not at all", () => {
    const tracker = new FrameTracker();
    const moves: TimedMove[] = [];
    const rotations: RotationEvent[] = [];
    splitMoves(`y ${EPLL_CASES.find((c) => c.name === "Ua")!.alg} r`).forEach((move, key) => {
      const { turns, rotation } = tracker.apply(move);
      for (const turn of turns) moves.push({ move: turn, t: key * 200 });
      if (rotation) rotations.push({ rotation, after: moves.length, t: key * 200 });
    });
    const tokens = humanize(moves, rotations, never);
    expect(moves).toHaveLength(12);
    expect(countDisplayTurns(tokens, { startMove: 0, endMove: moves.length })).toBe(8);
    expect(countDisplayTurns(tokens, { startMove: 0, endMove: 2 })).toBe(1);
  });
});

// The invariant the review animation relies on: the tokens, played after the scramble and z2, are the solve.
describe("display tokens replay the solve in cubing.js", () => {
  // Each of the six faces on top, then each of four turns about the vertical.
  const ORIENTATIONS: KTransformation[] = ["", "x", "x'", "x2", "z", "z'"].flatMap((up) =>
    ["", "y", "y2", "y'"].map((spin) => kpuzzle.algToTransformation(`${up} ${spin}`.trim() || "x x'")),
  );

  function sameUpToOrientation(a: KPattern, b: KPattern): boolean {
    return ORIENTATIONS.some((orientation) => a.applyTransformation(orientation).isIdentical(b));
  }

  /** Mirrors the app: two turns this close together may be one move. */
  const mergeable = (moves: readonly TimedMove[]) => (i: number) => moves[i + 1]!.t - moves[i]!.t <= 60;

  const rng = createRng(4242);
  const scrambles = Array.from({ length: 25 }, () => randomScramble(rng));

  it("covers all 24 orientations", () => {
    const solved = kpuzzle.defaultPattern();
    const distinct = new Set(ORIENTATIONS.map((o) => JSON.stringify(solved.applyTransformation(o).patternData)));
    expect(distinct.size).toBe(24);
  });

  const cases: [number, string, boolean][] = [
    ...scrambles.map((scramble, i): [number, string, boolean] => [i, scramble, true]),
    ...scrambles.slice(0, 8).map((scramble, i): [number, string, boolean] => [i, scramble, false]),
  ];

  it.each(cases)("solve %i (%s, rotations %s): every prefix matches the reported state", (i, scramble, useRotations) => {
    const { moves, rotations } = generateDemoPlan(scramble, i);
    const tokens = humanize(moves, useRotations ? rotations : [], mergeable(moves));
    const start = kpuzzle.defaultPattern().applyAlg(`${scramble} z2`);
    let shown = start;
    let reported = start;
    let done = 0;
    for (const token of tokens) {
      shown = shown.applyAlg(token.text);
      for (; done < token.end; done++) reported = reported.applyMove(moves[done]!.move);
      expect(sameUpToOrientation(shown, reported)).toBe(true);
    }
    expect(done).toBe(moves.length);
    expect(shown.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true })).toBe(true);
  });
});
