import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";
import { describe, expect, it } from "vitest";
import {
  MOVE_NAMES,
  SOLVED,
  applyAlg,
  invertAlg,
  isSolved,
  parseAlg,
  scrambleToSolverFrame,
  simplifyMoves,
  toFaceTurns,
  toFaceTurnsDetailed,
  type CubeState,
} from "./cubie";
import { createRng, randomScramble } from "./random";

const kpuzzle = await cube3x3x3.kpuzzle();

// cubing.js orders corners UFR URB UBL ULF DRF DFL DLB DBR and edges UF UR UB UL DF DR DB DL FR FL BR BL.
const CORNER_TO_CUBING = [0, 3, 2, 1, 4, 5, 6, 7];
const EDGE_TO_CUBING = [1, 0, 3, 2, 5, 4, 7, 6, 8, 9, 11, 10];

function fromCubing(pattern: KPattern): CubeState {
  const corners = pattern.patternData["CORNERS"]!;
  const edges = pattern.patternData["EDGES"]!;
  const cornerFrom = (cubingIndex: number): number => CORNER_TO_CUBING.indexOf(cubingIndex);
  const edgeFrom = (cubingIndex: number): number => EDGE_TO_CUBING.indexOf(cubingIndex);
  return {
    cp: CORNER_TO_CUBING.map((c) => cornerFrom(corners.pieces[c]!)),
    co: CORNER_TO_CUBING.map((c) => corners.orientation[c]!),
    ep: EDGE_TO_CUBING.map((e) => edgeFrom(edges.pieces[e]!)),
    eo: EDGE_TO_CUBING.map((e) => edges.orientation[e]!),
  };
}

function cubingState(alg: string): CubeState {
  return fromCubing(kpuzzle.defaultPattern().applyAlg(alg));
}

const rng = createRng(2026);
const randomAlgs = Array.from({ length: 25 }, () => randomScramble(rng, 30));

describe("face turns", () => {
  it.each(MOVE_NAMES.map((move) => [move]))("%s matches cubing.js", (move) => {
    expect(applyAlg(SOLVED, move)).toEqual(cubingState(move));
  });

  it.each(randomAlgs.map((alg) => [alg]))("random alg %s matches cubing.js", (alg) => {
    expect(applyAlg(SOLVED, alg)).toEqual(cubingState(alg));
  });

  it.each(randomAlgs.map((alg) => [alg]))("alg then inverse is solved: %s", (alg) => {
    expect(isSolved(applyAlg(applyAlg(SOLVED, alg), invertAlg(alg)))).toBe(true);
  });
});

describe("parseAlg", () => {
  it.each([
    ["R U R' U'", ["R", "U", "R'", "U'"]],
    ["(R2' U'2) R3 F1", ["R2", "U2", "R'", "F"]],
    ["  [R  U]  ", ["R", "U"]],
    ["R4 U", ["U"]],
    ["", []],
  ])("%j → %j", (alg, expected) => {
    expect(parseAlg(alg)).toEqual(expected);
  });

  it.each([["r U"], ["M2"], ["x"], ["Q"], ["R2'2"]])("rejects %j", (alg) => {
    expect(() => parseAlg(alg)).toThrow();
  });
});

describe("simplifyMoves", () => {
  it.each([
    [["R", "R"], ["R2"]],
    [["R", "R'"], []],
    [["U", "R", "R'", "U"], ["U2"]],
    [["U", "D", "U"], ["U", "D", "U"]],
    [["R2'", "R'2", "R3"], ["R'"]],
  ])("%j → %j", (moves, expected) => {
    expect(simplifyMoves(moves)).toEqual(expected);
  });
});

describe("invertAlg", () => {
  it.each([
    ["R U R' U'", ["U", "R", "U'", "R'"]],
    [["R2'", "F"], ["F'", "R2"]],
    ["", []],
  ])("%j → %j", (alg, expected) => {
    expect(invertAlg(alg)).toEqual(expected);
  });
});

describe("toFaceTurns", () => {
  const algs = [
    "r U R' U' r' F R F'",
    "M2 U M U2 M' U M2",
    "M2 U' M2 U' M' U2 M2 U2 M' U2",
    "x R2 D2 R U R' D2 R U' R x'",
    "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
    "f R U R' U' f'",
    "F R U R' U' F' f R U R' U' f'",
    "y R U R' y' L' U' L",
    "Rw U Rw' Lw' U' Lw Uw R Uw' Dw R' Dw' Fw U Fw' Bw' U Bw",
    "l U' l' u' d E S' M x' y2 z",
    "r2 U2 b2 d' f2 l2 u",
    "E2 S2 M2 E' S' M'",
    "R' U L' U2 R U' R' U2 R L",
    "U2 f' L F L' U2 L' U2 L U2 S",
    "r' D' F r U' r' F' D r2 U r' U' r' F r F'",
    "R' U R' U' y R' F' R2 U' R' U R' F R F",
  ];

  it.each(algs.map((alg) => [alg]))("%s equals its face turns plus the leftover rotation", (alg) => {
    const { moves, rotations } = toFaceTurnsDetailed(alg);
    expect(moves.every((move) => /^[URFDLB][2']?$/.test(move))).toBe(true);
    const original = kpuzzle.defaultPattern().applyAlg(alg);
    const rewritten = kpuzzle.defaultPattern().applyAlg([...moves, ...rotations].join(" ") || "U U'");
    expect(rewritten.isIdentical(original)).toBe(true);
  });

  it.each([
    ["r", "L"],
    ["M", "R L'"],
    ["E", "U D'"],
    ["S", "F' B"],
    ["x U", "F"],
    ["R U R'", "R U R'"],
  ])("%s → %s", (alg, expected) => {
    expect(toFaceTurns(alg)).toBe(expected);
  });
});

describe("scrambleToSolverFrame", () => {
  it.each(randomAlgs.slice(0, 8).map((alg) => [alg]))("matches the scramble followed by z2 (%s)", (scramble) => {
    const viaCubing = kpuzzle.defaultPattern().applyAlg(`z2 ${scramble} z2`);
    expect(applyAlg(SOLVED, scrambleToSolverFrame(scramble))).toEqual(fromCubing(viaCubing));
  });
});
