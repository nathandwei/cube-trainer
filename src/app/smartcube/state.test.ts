import { cube3x3x3 } from "cubing/puzzles";
import { describe, expect, it } from "vitest";
import { MOVE_NAMES, SOLVED, applyAlg, createRng, isSolved, parseAlg, randomScramble } from "@/cube";
import { CubieCube } from "@/vendor/smartcube-web-bluetooth/smartcube/cubie-cube";
import { cubeMoveToSolver, solverFacelets, solverStateFromFacelets, swapFrame, toKPattern } from "./state";

const kpuzzle = await cube3x3x3.kpuzzle();
const ALGS = [1, 2, 3, 4, 5, 6].map((seed) => randomScramble(createRng(seed)));

/** Facelets the way the cube's driver produces them: the vendored CubieCube, turned with its own move tables. */
function vendorFacelets(alg: string): string {
  let cube = new CubieCube();
  for (const move of parseAlg(alg)) {
    const index = "URFDLB".indexOf(move.charAt(0)) * 3 + (move.endsWith("2") ? 1 : move.endsWith("'") ? 2 : 0);
    const next = new CubieCube();
    CubieCube.CubeMult(cube, CubieCube.moveCube[index]!, next);
    cube = next;
  }
  return cube.toFaceCube();
}

const inSolverFrame = (alg: string) => parseAlg(alg).map(cubeMoveToSolver);

describe("swapFrame", () => {
  it.each(ALGS.map((alg) => [alg]))("describes %s in the solver frame as the z2-renamed alg", (alg) => {
    expect(swapFrame(applyAlg(SOLVED, alg))).toEqual(applyAlg(SOLVED, inSolverFrame(alg)));
  });

  it("is its own inverse", () => {
    const state = applyAlg(SOLVED, ALGS[0]!);
    expect(swapFrame(swapFrame(state))).toEqual(state);
  });
});

describe("solverStateFromFacelets", () => {
  it.each([...MOVE_NAMES.map((m) => [m]), ...ALGS.map((alg) => [alg])])("reads the cube's report after %s", (alg) => {
    expect(solverStateFromFacelets(vendorFacelets(alg))).toEqual(applyAlg(SOLVED, inSolverFrame(alg)));
  });

  it("reads a real GAN i4 report (upstream capture, taken after R U)", () => {
    const report = "UUUUUUFFFUBBRRRRRRRRRFFDFFDDDBDDBDDBFFDLLLLLLLLLUBBUBB";
    expect(solverStateFromFacelets(report)).toEqual(applyAlg(SOLVED, inSolverFrame("R U")));
  });

  it.each([
    ["too short", "UUU"],
    ["a sticker that is no centre's colour", "X" + "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB".slice(1)],
    ["ten U stickers", "UUUUUUUUURRRRRRRRRUFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"],
  ])("refuses %s", (_name, facelets) => {
    expect(solverStateFromFacelets(facelets)).toBeNull();
  });

  it("round-trips through solverFacelets", () => {
    const state = applyAlg(SOLVED, ALGS[1]!);
    expect(solverStateFromFacelets(solverFacelets(swapFrame(state)))).toEqual(state);
  });
});

describe("toKPattern", () => {
  it.each([...MOVE_NAMES.map((m) => [m]), ...ALGS.map((alg) => [alg])])("matches cubing.js after %s", (alg) => {
    expect(toKPattern(kpuzzle, applyAlg(SOLVED, alg)).isIdentical(kpuzzle.defaultPattern().applyAlg(alg))).toBe(true);
  });

  it("is the solved pattern by default", () => {
    expect(toKPattern(kpuzzle).isIdentical(kpuzzle.defaultPattern())).toBe(true);
  });

  it("feeds cubing.js's solver a state it solves", async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import("cubing/search");
    const state = applyAlg(SOLVED, ALGS[2]!);
    const solution = await experimentalSolve3x3x3IgnoringCenters(toKPattern(kpuzzle, state));
    expect(isSolved(applyAlg(state, solution.toString()))).toBe(true);
  }, 30_000);
});
