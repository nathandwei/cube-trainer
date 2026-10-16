import { describe, expect, it } from "vitest";
import { getCaseSet } from "./cases";
import { toFaceTurns } from "./cubie";
import { algIndex, recognizeAlgs } from "./llAlgs";

function turns(alg: string): string[] {
  return toFaceTurns(alg).split(" ").filter(Boolean);
}

/** The sets of each alg recognised in `algs` done one after another (turns not merged across them). */
function sets(algs: string | string[], own?: Record<string, string>, times?: number[]): string[][] | null {
  const moves = (typeof algs === "string" ? [algs] : algs).flatMap(turns);
  return recognizeAlgs(moves, algIndex(own), times)?.map((found) => [...found].sort()) ?? null;
}

const SUNE = "R U R' U R U2 R'";
const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";

describe("recognizeAlgs", () => {
  it("knows Sune as both an OLL and a COLL alg", () => {
    expect(sets(SUNE)).toEqual([["COLL", "OLL"]]);
  });

  it.each([
    ["an AUF before and after", `U ${SUNE} U'`],
    ["a y regrip", `y ${SUNE} y'`],
    ["a merged double turn", "R U R' U R U R U' R' R'".replace("R U' R' R'", "U R'")],
    ["the left-hand mirror", "L' U' L U' L' U2 L"],
  ])("sees through %s", (_, alg) => {
    expect(sets(alg)).not.toBeNull();
  });

  it("finds a PLL (the T perm is COLL's O-adj alg too)", () => {
    expect(sets(T_PERM)).toEqual([["COLL", "PLL"]]);
  });

  it("splits two algs at the pause between them", () => {
    const second = "U2 R2 U R U R' U' R' U' R' U R'";
    const times = [...turns(SUNE), ...turns(second)].map((_, i) => i * 100 + (i >= turns(SUNE).length ? 900 : 0));
    expect(sets([SUNE, second], undefined, times)).toEqual([["COLL", "OLL"], ["EPLL", "PLL"]]);
  });

  it("splits two algs whose meeting turns cancelled", () => {
    // Sune's last R' and the T perm's first R cancel when done in one go.
    expect(sets(["R U R' U R U2", "U R' U' R' F R2 U' R' U' R U R' F'"])).toEqual([["COLL", "OLL"], ["COLL", "PLL"]]);
  });

  it("returns null for turns that are no known alg", () => {
    expect(sets("R U R' F2 D")).toBeNull();
  });

  it("knows his own alg once he has picked it", () => {
    // An OLL 27 alg that permutes differently from every catalog alg: Sune with a T perm on the end.
    expect(sets([SUNE, T_PERM])).toEqual([["COLL", "OLL"], ["COLL", "PLL"]]);
    expect(sets([SUNE, T_PERM], { "OLL-27": `${SUNE} ${T_PERM}` })).toEqual([["OLL"]]);
  });

  it("skips a stored alg that no longer parses", () => {
    expect(sets(SUNE, { "OLL-27": "R U Q" })).toEqual([["COLL", "OLL"]]);
  });

  it("recognises every catalog alg of the last-layer sets as its own set", () => {
    for (const id of ["EO", "OLL", "COLL", "PLL", "EPLL"] as const) {
      for (const caseDef of getCaseSet(id).cases) {
        for (const alg of caseDef.algs) expect(sets(alg)?.[0], `${caseDef.id}: ${alg}`).toContain(id);
      }
    }
  });
});
