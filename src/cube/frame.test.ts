import { cube3x3x3 } from "cubing/puzzles";
import { describe, expect, it } from "vitest";
import { FACES } from "./cubie";
import { FrameTracker, parseRotation, splitMoves } from "./frame";
import { COLL_ALGS, EO_ALGS, EPLL_ALGS } from "./ll-data";
import { humanize } from "./notation";
import { createRng, randomInt } from "./random";
import type { RotationEvent, TimedMove } from "./types";

const kpuzzle = await cube3x3x3.kpuzzle();

function sameInCubing(a: string, b: string): boolean {
  const solved = kpuzzle.defaultPattern();
  return solved.applyAlg(a || "U U'").isIdentical(solved.applyAlg(b || "U U'"));
}

const FAMILIES = ["R", "U", "F", "L", "D", "B", "r", "l", "u", "d", "f", "b", "Rw", "Uw", "Fw", "M", "E", "S", "x", "y", "z"];
const MOVES = FAMILIES.flatMap((family) => [family, `${family}2`, `${family}'`]);
const ROTATIONS = ["x", "x2", "x'", "y", "y2", "y'", "z", "z2", "z'"] as const;

describe("FrameTracker.apply", () => {
  it.each([
    ["r", ["L"], "x"],
    ["l", ["R"], "x'"],
    ["u", ["D"], "y"],
    ["d", ["U"], "y'"],
    ["f", ["B"], "z"],
    ["b", ["F"], "z'"],
    ["r2", ["L2"], "x2"],
    ["Rw'", ["L'"], "x'"],
    ["M", ["R", "L'"], "x'"],
    ["M'", ["R'", "L"], "x"],
    ["M2", ["R2", "L2"], "x2"],
    ["E", ["U", "D'"], "y'"],
    ["E'", ["U'", "D"], "y"],
    ["S", ["F'", "B"], "z"],
    ["S'", ["F", "B'"], "z'"],
    ["y", [], "y"],
    ["x2", [], "x2"],
    ["R", ["R"], undefined],
    ["U2'", ["U2"], undefined],
  ])("%s from the start is %j then %s", (move, turns, rotation) => {
    expect(new FrameTracker().apply(move)).toEqual(rotation ? { turns, rotation } : { turns });
  });

  it.each(MOVES.map((move) => [move]))("%s equals its centre turns then its rotation in cubing.js", (move) => {
    const { turns, rotation } = new FrameTracker().apply(move);
    expect(sameInCubing(move, [...turns, rotation ?? ""].join(" "))).toBe(true);
  });

  it("names the solver's R after y as the centre-frame B", () => {
    const tracker = new FrameTracker();
    tracker.apply("y");
    expect(tracker.apply("R").turns).toEqual(["B"]);
    expect(tracker.apply("F'").turns).toEqual(["R'"]);
    expect(tracker.apply("U").turns).toEqual(["U"]);
  });

  // After rotations P, a move in the new view is its centre turns T on the original cube: P move ≡ T P rotation.
  const rng = createRng(77);
  const cases = Array.from({ length: 60 }, () => {
    const prefix = Array.from({ length: 1 + randomInt(rng, 3) }, () => ROTATIONS[randomInt(rng, ROTATIONS.length)]!);
    return [prefix.join(" "), MOVES[randomInt(rng, MOVES.length)]!] as const;
  });
  it.each(cases)("after %s, %s converts exactly", (prefix, move) => {
    const tracker = new FrameTracker();
    for (const rotation of prefix.split(" ")) tracker.apply(rotation);
    const { turns, rotation } = tracker.apply(move);
    expect(sameInCubing(`${prefix} ${move}`, [...turns, prefix, rotation ?? ""].join(" "))).toBe(true);
  });

  it("rejects more than one move", () => {
    expect(() => new FrameTracker().apply("R U")).toThrow();
  });
});

describe("FrameTracker.name", () => {
  it.each(ROTATIONS.map((rotation) => [rotation]))("inverts apply for every face after %s", (rotation) => {
    const tracker = new FrameTracker();
    tracker.rotate(rotation);
    for (const face of FACES) expect(tracker.name(tracker.apply(`${face}'`).turns[0]!)).toBe(`${face}'`);
  });

  it("rejects anything but an outer turn", () => {
    expect(() => new FrameTracker().name("M")).toThrow();
  });
});

describe("parseRotation and splitMoves", () => {
  it.each([
    ["y", ["y", 1]],
    ["x2", ["x", 2]],
    ["z'", ["z", 3]],
  ])("%s → %j", (rotation, expected) => {
    expect(parseRotation(rotation)).toEqual(expected);
  });

  it("rejects non-rotations", () => {
    expect(() => parseRotation("R")).toThrow();
  });

  it("canonicalises moves", () => {
    expect(splitMoves("(R2' U) r3 M'2 R4 y")).toEqual(["R2", "U", "r'", "M2", "y"]);
  });
});

/** Types an alg one key every 200 ms, as the keyboard virtual cube would record it. */
function typeAlg(alg: string): { moves: TimedMove[]; rotations: RotationEvent[] } {
  const tracker = new FrameTracker();
  const moves: TimedMove[] = [];
  const rotations: RotationEvent[] = [];
  splitMoves(alg).forEach((move, key) => {
    const t = key * 200;
    const { turns, rotation } = tracker.apply(move);
    for (const turn of turns) moves.push({ move: turn, t });
    if (rotation) rotations.push({ rotation, after: moves.length, t });
  });
  return { moves, rotations };
}

describe("typing through FrameTracker, then humanize", () => {
  const algs = [
    ...[...EO_ALGS, ...COLL_ALGS, ...EPLL_ALGS].map(({ alg }) => alg),
    "y R U R' y' L' U' L",
    "y2 U' L' U L x2 D R",
    "x' R U' R' D R U R' D' x",
    "R' U R' U' y R' F' R2 U' R' U R' F R F",
    "r' D' F r U' r' F' D r2 U r' U' r' F r F'",
    "l U' l' u' d E S' M x' y2 z",
    "E2 S2 M2 E' S' M'",
    "f R U R' U' f' b' U' b",
  ];

  it.each(algs.map((alg) => [alg]))("gives back %s", (alg) => {
    const { moves, rotations } = typeAlg(alg);
    const tokens = humanize(moves, rotations, () => false);
    expect(tokens.map((token) => token.text).join(" ")).toBe(splitMoves(alg).join(" "));
  });
});
