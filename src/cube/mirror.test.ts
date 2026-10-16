import { describe, expect, it } from "vitest";
import { CASE_SETS, caseState, isGoalReached } from "./cases";
import { SOLVED, applyAlg, stateKey, toFaceTurns, tokenizeAlg, type CubeState } from "./cubie";
import { mirrorAlg } from "./mirror";

const CATALOG_ALGS = CASE_SETS.flatMap((set) => set.cases.flatMap((c) => c.algs.map((alg) => [c.id, alg] as const)));
const AUFS = ["", "U", "U'", "U2"] as const;

function apply(state: CubeState, ...algs: string[]): CubeState {
  return applyAlg(
    state,
    algs.flatMap((alg) => toFaceTurns(alg).split(" ").filter(Boolean)),
  );
}

function tokens(alg: string): string[] {
  return tokenizeAlg(alg).map(({ family, amount }) => `${family}${amount}`);
}

describe("mirrorAlg", () => {
  it.each([
    ["R", "L'"],
    ["R'", "L"],
    ["R2", "L2"],
    ["L", "R'"],
    ["L'", "R"],
    ["L2", "R2"],
    ["U", "U'"],
    ["U'", "U"],
    ["U2", "U2"],
    ["D", "D'"],
    ["F", "F'"],
    ["B'", "B"],
    ["M", "M"],
    ["M'", "M'"],
    ["M2", "M2"],
    ["E", "E'"],
    ["S", "S'"],
    ["r", "l'"],
    ["l'", "r"],
    ["r2", "l2"],
    ["Rw", "Lw'"],
    ["Lw'", "Rw"],
    ["u", "u'"],
    ["Uw2", "Uw2"],
    ["f'", "f"],
    ["x", "x"],
    ["x'", "x'"],
    ["y", "y'"],
    ["y2", "y2"],
    ["z", "z'"],
  ])("%s → %s", (move, mirrored) => {
    expect(mirrorAlg(move)).toBe(mirrored);
  });

  it.each([
    ["R2'", "L2"],
    ["R'2", "L2"],
    ["R3", "L"],
    ["U2'", "U2"],
    ["R’", "L"],
  ])("writes %s canonically as %s", (move, mirrored) => {
    expect(mirrorAlg(move)).toBe(mirrored);
  });

  it("keeps brackets and spacing", () => {
    expect(mirrorAlg("(R U R' U') F")).toBe("(L' U' L U) F'");
    expect(mirrorAlg("F (R U R' U') F'  f (R U R' U') f'")).toBe("F' (L' U' L U) F  f' (L' U' L U) f");
    expect(mirrorAlg("[R U R'] U")).toBe("[L' U' L] U'");
    expect(mirrorAlg("")).toBe("");
  });

  it("throws on anything that is not a move", () => {
    expect(() => mirrorAlg("R Q")).toThrow(/Q/);
  });

  it("turns Sune into the left-hand Sune", () => {
    expect(mirrorAlg("R U R' U R U2 R'")).toBe("L' U' L U' L' U2 L");
  });

  it.each(CATALOG_ALGS)("%s: mirroring %s twice gives it back", (_id, alg) => {
    expect(tokens(mirrorAlg(mirrorAlg(alg)))).toEqual(tokens(alg));
    if (!/2'|'2|3|’/.test(alg)) expect(mirrorAlg(mirrorAlg(alg))).toBe(alg);
  });

  // The mirror must not depend on how the alg is written: mirroring the fixed-centre face turns of an alg (wide
  // moves, slices and rotations expanded) gives the same cube as expanding the mirrored alg.
  it.each(CATALOG_ALGS)("%s: %s mirrors the same way as its face turns", (_id, alg) => {
    const viaFaceTurns = applyAlg(SOLVED, toFaceTurns(mirrorAlg(toFaceTurns(alg))));
    const viaAlg = applyAlg(SOLVED, toFaceTurns(mirrorAlg(alg)));
    expect(stateKey(viaAlg)).toBe(stateKey(viaFaceTurns));
  });

  it("solves Antisune with the mirror of Sune, and Sune with the mirror of Antisune", () => {
    const sune = "R U R' U R U2 R'";
    const antisune = "R U2 R' U' R U' R'";
    expect(AUFS.filter((pre) => isGoalReached("OLL", apply(caseState("OLL-26"), pre, mirrorAlg(sune))))).not.toEqual(
      [],
    );
    expect(
      AUFS.filter((pre) => isGoalReached("OLL", apply(caseState("OLL-27"), pre, mirrorAlg(antisune)))),
    ).not.toEqual([]);
    // Not by accident: the mirror of Sune does not solve Sune from any angle.
    expect(AUFS.some((pre) => isGoalReached("OLL", apply(caseState("OLL-27"), pre, mirrorAlg(sune))))).toBe(false);
  });

  it("is a reflection: the mirrored alg sets up the mirror image of the original's case", () => {
    // Sune's case has its one oriented corner front left; the mirror image has it front right.
    const suneCase = apply(SOLVED, "R U2 R' U' R U' R'");
    const mirrorCase = apply(SOLVED, mirrorAlg("R U2 R' U' R U' R'"));
    expect(suneCase.co.slice(0, 4)).toEqual([2, 0, 2, 2]);
    expect(mirrorCase.co.slice(0, 4)).toEqual([0, 1, 1, 1]);
  });
});
