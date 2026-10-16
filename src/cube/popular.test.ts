import { describe, expect, it } from "vitest";
import { caseState, getCase, isGoalReached } from "./cases";
import { applyAlg, toFaceTurns } from "./cubie";
import { JPERM_ALGS } from "./jperm-data";
import { PRO_ALGS } from "./pro-data";
import { RULINGS, jpermAlgs, referenceAlgs, referencePick, sameAlgLoose, spellingKey, turnsMatchAlg, votedAlgs, withoutAuf } from "./popular";

const AUFS = ["", "U", "U'", "U2"] as const;

function solvesCase(caseId: string, alg: string): boolean {
  const { set } = getCase(caseId);
  const turns = toFaceTurns(alg).split(" ").filter(Boolean);
  return AUFS.some((auf) => isGoalReached(set, applyAlg(caseState(caseId), [...(auf ? [auf] : []), ...turns])));
}

describe("J Perm's algs", () => {
  const all = Object.entries(JPERM_ALGS).flatMap(([caseId, algs]) => algs.map((alg) => [caseId, alg] as const));

  it("cover every PLL, OLL and COLL case but COLL's O cases", () => {
    const ids = new Set(Object.keys(JPERM_ALGS));
    expect([...ids].filter((id) => id.startsWith("PLL-"))).toHaveLength(21);
    expect([...ids].filter((id) => id.startsWith("OLL-"))).toHaveLength(57);
    expect([...ids].filter((id) => id.startsWith("COLL-"))).toHaveLength(40);
    expect(ids.has("COLL-O-adj")).toBe(false);
  });

  it.each(all)("%s: %s solves its case", (caseId, alg) => {
    expect(solvesCase(caseId, alg)).toBe(true);
  });

  it("serves EPLL cases from their PLL", () => {
    expect(jpermAlgs("EPLL-Ua")).toEqual(JPERM_ALGS["PLL-Ua"]);
  });
});

describe("what top solvers use", () => {
  it.each(Object.entries(PRO_ALGS))("%s: %s solves its case", (caseId, alg) => {
    expect(solvesCase(caseId, alg)).toBe(true);
  });

  it("comes before J Perm's 2019 pick", () => {
    expect(referencePick("PLL-Ua")).toEqual({ alg: PRO_ALGS["PLL-Ua"], source: "pros" });
    expect(referencePick("EPLL-Ua")?.source).toBe("pros");
    expect(referenceAlgs("PLL-Ua")[0]).toEqual({ alg: PRO_ALGS["PLL-Ua"], source: "pro" });
  });
});

describe("rulings", () => {
  it.each(Object.entries(RULINGS))("%s: %s solves its case", (caseId, alg) => {
    expect(solvesCase(caseId, alg)).toBe(true);
  });
});

describe("spellings", () => {
  it.each([
    ["x R' U R' D2 R U' R' D2 R2 x'", "l' U R' D2 R U' R' D2 R2"],
    ["y R U R' U R U2 R'", "U R U R' U R U2 R'"],
    ["(R U R') U (R U2 R')", "R U R' U R U2 R'"],
  ])("%s is %s", (a, b) => {
    expect(sameAlgLoose(a, b)).toBe(true);
  });

  it("tells different algs apart", () => {
    expect(sameAlgLoose("R U R' U R U2 R'", "R U2 R' U' R U' R'")).toBe(false);
  });

  it("drops the opening angle", () => {
    expect(withoutAuf("y' U2 R U R'")).toBe("R U R'");
    expect(spellingKey("D R U R' D'")).toBe(spellingKey("R U R'"));
  });
});

describe("turnsMatchAlg", () => {
  const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const turns = (alg: string) => toFaceTurns(alg).split(" ").filter(Boolean);

  it.each([
    ["as written", T_PERM],
    ["with AUFs", `U ${T_PERM} U'`],
    ["from another angle", `y ${T_PERM}`],
  ])("knows his alg done %s", (_, done) => {
    expect(turnsMatchAlg(turns(done), T_PERM)).toBe(true);
  });

  it("tells another alg for the same case apart", () => {
    expect(turnsMatchAlg(turns("R2 U R U R' U' R' U' R' U R'"), "M2 U M U2 M' U M2")).toBe(false);
  });
});

describe("referencePick", () => {
  it("takes his ruling, then J Perm, then the most voted", () => {
    expect(referencePick("F2L-2")).toEqual({ alg: "U' F' U F", source: "ruling" });
    expect(referencePick("PLL-T")?.source).toBe("jperm");
    expect(referencePick("PLL-Aa")?.source).toBe("pros");
    expect(referencePick("PLL-T")?.alg).toBe(JPERM_ALGS["PLL-T"]![0]);
    expect(referencePick("F2L-1")).toEqual({ alg: "U R U' R'", source: "votes" });
    expect(referencePick("EO-line")).toBeNull();
    expect(referencePick("COLL-O-adj")).toBeNull();
  });

  it("counts the votes of one alg's spellings together", () => {
    const [top] = votedAlgs("PLL-Aa");
    expect(top?.algs).toEqual(expect.arrayContaining(["x R' U R' D2 R U' R' D2 R2 x'", "l' U R' D2 R U' R' D2 R2 x'"]));
    expect(top!.votes).toBeGreaterThan(201);
  });

  it("offers J Perm's algs before the voted ones", () => {
    const refs = referenceAlgs("PLL-T");
    expect(refs[0]).toEqual({ alg: JPERM_ALGS["PLL-T"]![0], source: "jperm" });
    expect(refs.at(-1)?.source).toBe("community");
  });
});
