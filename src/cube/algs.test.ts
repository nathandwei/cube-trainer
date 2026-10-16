import { describe, expect, it } from "vitest";
import { algMoveCount, isSameAlg } from "./algs";

describe("algMoveCount", () => {
  it.each([
    ["", 0],
    ["R U R' U'", 4],
    ["(R U R' U) (R U2' R')", 7],
    ["x (R' U R') D2 (R U' R') D2 R2 x'", 9],
    ["M2 U M U2 M' U M2", 7],
    ["r U R' U' r' F R F'", 8],
    ["Rw U Rw'", 3],
    ["y' R' U2 R U R' U2 R (y)", 7],
    ["R U'2 R'2 U' R2", 5],
    ["R R", 2],
    ["R4 U", 1],
    ["S R U R' U' R' F R f'", 9],
  ])("%s → %i", (alg, moves) => {
    expect(algMoveCount(alg)).toBe(moves);
  });

  it.each([["D+U'"], ["R Q"]])("rejects %s", (alg) => {
    expect(() => algMoveCount(alg)).toThrow();
  });
});

describe("isSameAlg", () => {
  it.each([
    ["R U R' U'", "(R U R' U')", true],
    ["R2' U", "R2 U", true],
    ["U R U' R'", "R U' R'", true],
    ["R U' R' U2", "R U' R'", true],
    ["R U R'", "R U' R'", false],
    ["y R U R'", "R U R'", false],
    ["R U R'", "r U R'", false],
  ])("%s vs %s → %s", (a, b, same) => {
    expect(isSameAlg(a, b)).toBe(same);
  });
});
