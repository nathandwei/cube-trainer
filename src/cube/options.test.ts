import { describe, expect, it } from "vitest";
import { algMoveCount, isSameAlg } from "./algs";
import { CASE_SETS, caseState, getCase, isGoalReached, type CaseSetId } from "./cases";
import { SOLVED, applyAlg, stateKey, toFaceTurns, type CubeState } from "./cubie";
import { llCornerAlignment } from "./milestones";
import { mirrorAlg } from "./mirror";
import { F2L_SEARCH, algOptions, caseArrows, mirrorCaseId, playback, splitLeadingAuf, viewState, type AlgOption } from "./options";
import { solveSlots } from "./solvers";

const ALL_CASES = CASE_SETS.flatMap((set) => set.cases);
const AUFS = ["", "U", "U'", "U2"] as const;
const SOURCE_ORDER = { catalog: 0, pro: 1, jperm: 2, community: 3, mirror: 4, search: 5 } as const;
const SUNE = "R U R' U R U2 R'";

function apply(state: CubeState, ...algs: string[]): CubeState {
  return applyAlg(
    state,
    algs.flatMap((alg) => toFaceTurns(alg).split(" ").filter(Boolean)),
  );
}

function workingPreAufs(set: CaseSetId, state: CubeState, alg: string): string[] {
  return AUFS.filter((pre) => isGoalReached(set, apply(state, pre, alg)));
}

const OPTIONS = ALL_CASES.flatMap((c) => algOptions(c.id).map((option) => [c.id, option.source, option.alg] as const));

describe("algOptions over the whole catalog", () => {
  it.each(OPTIONS)("%s: %s option %s reaches the goal from the case state", (id, source, alg) => {
    const { set } = getCase(id);
    const working = workingPreAufs(set, caseState(id), alg);
    expect(working.length).toBeGreaterThan(0);
    if (source === "search") expect(working).toContain("");
  });

  it.each(OPTIONS)("%s: viewState for %s option %s is an AUF of the case its body solves directly", (id, _s, alg) => {
    const { set } = getCase(id);
    const view = viewState(id, alg);
    const angles = AUFS.map((auf) => stateKey(apply(caseState(id), auf)));
    expect(angles).toContain(stateKey(view));
    expect(isGoalReached(set, apply(view, splitLeadingAuf(set, alg).body))).toBe(true);
  });

  it.each(ALL_CASES.map((c) => [c.id, c] as const))(
    "%s: catalog algs kept, sorted, no duplicates, honest move counts",
    (id, c) => {
      const options = algOptions(id);
      const catalog = options.filter((o) => o.source === "catalog").map((o) => o.alg);
      expect([...catalog].sort()).toEqual([...c.algs].sort());
      // Equally long catalog algs keep the dataset's order.
      for (const alg of catalog) {
        const sameLength = c.algs.filter((other) => algMoveCount(other) === algMoveCount(alg));
        expect(catalog.filter((other) => sameLength.includes(other))).toEqual(sameLength);
      }
      for (const option of options) expect(option.moves).toBe(algMoveCount(option.alg));
      const order = (o: AlgOption): [number, number] => [o.moves, SOURCE_ORDER[o.source]];
      for (let i = 1; i < options.length; i++) {
        const [moves, source] = order(options[i]!);
        const [prevMoves, prevSource] = order(options[i - 1]!);
        expect(moves > prevMoves || (moves === prevMoves && source >= prevSource)).toBe(true);
      }
      options.forEach((a, i) =>
        options.slice(i + 1).forEach((b) => expect(isSameAlg(a.alg, b.alg), `${a.alg} vs ${b.alg}`).toBe(false)),
      );
    },
  );

  it.each(ALL_CASES.map((c) => [c.id, c] as const))("%s: mirror options mirror the sibling's algs", (id, c) => {
    const mirrors = algOptions(id).filter((o) => o.source === "mirror");
    const sibling = mirrorCaseId(id);
    if (sibling === null) {
      expect(mirrors).toEqual([]);
      return;
    }
    expect(getCase(sibling).set).toBe(c.set);
    const mirroredSiblingAlgs = getCase(sibling).algs.map(mirrorAlg);
    for (const option of mirrors) expect(mirroredSiblingAlgs).toContain(option.alg);
  });

  it("finds the mirror case symmetrically, and never for F2L", () => {
    for (const c of ALL_CASES) {
      const sibling = mirrorCaseId(c.id);
      if (c.set === "F2L") expect(sibling).toBeNull();
      if (sibling !== null) expect(mirrorCaseId(sibling)).toBe(c.id);
    }
  });

  it("searches F2L only, within the slack, up to the option cap", () => {
    for (const c of ALL_CASES) {
      const options = algOptions(c.id);
      const searched = options.filter((o) => o.source === "search");
      if (c.set !== "F2L") {
        expect(searched).toEqual([]);
        continue;
      }
      const shortest = solveSlots(caseState(c.id), ["FR"], ["FL", "BL", "BR"], { faces: F2L_SEARCH.faces })!;
      expect(options.length).toBeLessThanOrEqual(Math.max(F2L_SEARCH.maxOptions, c.algs.length));
      // A shortest solution is always on offer, from the catalog or the search.
      expect(options.some((o) => o.moves === shortest.moves && o.source !== "mirror")).toBe(true);
      for (const option of searched) {
        expect(option.moves).toBeGreaterThanOrEqual(shortest.moves);
        expect(option.moves).toBeLessThanOrEqual(shortest.moves + F2L_SEARCH.slack);
        expect(option.alg.split(" ").every((turn) => F2L_SEARCH.faces.some((face) => turn.startsWith(face)))).toBe(
          true,
        );
      }
    }
  });
});

describe("reference options' closing rotations", () => {
  it("adds nothing where the alg ends in the grip it started (M slices, r moves)", () => {
    for (const id of ["PLL-H", "EPLL-H", "PLL-Z", "OLL-5", "F2L-8", "PLL-Gb"]) {
      for (const { alg, source } of algOptions(id)) {
        if (source === "catalog" || source === "mirror" || source === "search") continue;
        expect(alg, `${id}: ${alg}`).not.toMatch(/([xyz]2?'?\s+){2,}[xyz]2?'?\s*$/);
      }
    }
  });

  it("undoes a grip the alg leaves open with one rotation", () => {
    expect(algOptions("PLL-Aa").map((o) => o.alg)).toContain("x L2 D2 L' U' L D2 L' U L' x'");
  });
});

describe("algOptions", () => {
  it("offers F2L 2's U' F' U F next to the catalog's F R' F' R", () => {
    const options = algOptions("F2L-2");
    expect(options[0]).toEqual({ alg: "F R' F' R", moves: 4, source: "catalog" });
    expect(options).toContainEqual({ alg: "U' F' U F", moves: 4, source: "community" });
    // The sequence as first reported (U F' U' F) solves F2L 2 from no angle, so it is rightly not on offer.
    expect(workingPreAufs("F2L", caseState("F2L-2"), "U F' U' F")).toEqual([]);
  });

  it.each([
    ["OLL-26", "L' U' L U' L' U2 L"],
    ["OLL-27", "L' U2 L U L' U L"],
  ])("gives %s the left-hand mirror %s", (id, alg) => {
    expect(algOptions(id)).toContainEqual({ alg, moves: 7, source: "mirror" });
  });

  it.each([
    ["OLL-26", "OLL-27"],
    ["PLL-Aa", "PLL-Ab"],
    ["PLL-Ga", "PLL-Gc"],
    ["PLL-Gb", "PLL-Gd"],
    ["PLL-Ja", "PLL-Jb"],
    ["PLL-Na", "PLL-Nb"],
    ["PLL-Ra", "PLL-Rb"],
    ["PLL-Ua", "PLL-Ub"],
    ["EPLL-Ua", "EPLL-Ub"],
    ["COLL-AS1", "COLL-S1"],
    ["COLL-T3", "COLL-T5"],
  ])("pairs %s with its mirror %s", (a, b) => {
    expect(mirrorCaseId(a)).toBe(b);
    expect(mirrorCaseId(b)).toBe(a);
  });

  it.each(["PLL-T", "PLL-H", "PLL-E", "OLL-21", "OLL-57", "EO-line", "COLL-H1", "COLL-O-adj", "F2L-1"])(
    "%s has no mirror sibling",
    (id) => {
      expect(mirrorCaseId(id)).toBeNull();
    },
  );

  it("caches, and hands out copies", () => {
    const first = algOptions("OLL-26");
    first.pop();
    expect(algOptions("OLL-26")).toHaveLength(first.length + 1);
  });

  it("throws on an unknown case", () => {
    expect(() => algOptions("PLL-Q")).toThrow(/Unknown case/);
  });
});

describe("splitLeadingAuf", () => {
  it.each([
    ["OLL", SUNE, "", SUNE],
    ["OLL", `U ${SUNE}`, "U", SUNE],
    ["OLL", `U2' ${SUNE}`, "U2'", SUNE],
    ["OLL", `y U' ${SUNE}`, "y U'", SUNE],
    ["OLL", "(U2) R U R'", "U2", "R U R'"],
    ["PLL", "U (R U' R U)", "U", "(R U' R U)"],
    ["PLL", "(U R U' R U)", "U", "(R U' R U)"],
    ["COLL", "U x R' U R D' R' U' R D x'", "U", "x R' U R D' R' U' R D x'"],
    ["F2L", "U R U' R'", "U", "R U' R'"],
    ["F2L", "y' U R' U' R U R' U2 R (y)", "U", "y' R' U' R U R' U2 R (y)"],
    ["F2L", "y' R' U2 R U R' U2 R y", "", "y' R' U2 R U R' U2 R y"],
    ["F2L", "U' r U' R' U R U r'", "U'", "r U' R' U R U r'"],
  ] as const)("%s: %s → AUF %s, body %s", (set, alg, auf, body) => {
    expect(splitLeadingAuf(set, alg)).toEqual({ auf, body });
  });
});

describe("viewState", () => {
  it("shows Sune at the catalog angle for the catalog Sune, with or without a leading U or y", () => {
    const catalog = stateKey(caseState("OLL-27"));
    expect(stateKey(viewState("OLL-27", SUNE))).toBe(catalog);
    expect(stateKey(viewState("OLL-27", `U ${SUNE}`))).toBe(catalog);
    expect(stateKey(viewState("OLL-27", `y ${SUNE}`))).toBe(catalog);
    // Sune is held with its one oriented corner front left (URF UFL ULB UBR).
    expect(viewState("OLL-27", SUNE).co.slice(0, 4)).toEqual([2, 0, 2, 2]);
  });

  it("holds Antisune the mirror way round for the left-hand Sune", () => {
    const leftSune = mirrorAlg(SUNE);
    const view = viewState("OLL-26", leftSune);
    expect(view.co.slice(0, 4)).toEqual([0, 1, 1, 1]);
    expect(isGoalReached("OLL", apply(view, leftSune))).toBe(true);
    // The catalog Antisune expects another angle (oriented corner back right).
    expect(viewState("OLL-26", "R U2 R' U' R U' R'").co.slice(0, 4)).toEqual([1, 1, 1, 0]);
    expect(stateKey(viewState("OLL-26", `U2 ${leftSune}`))).toBe(stateKey(view));
  });

  it("turns the case to the angle an alternative alg is learnt from", () => {
    // COLL S1's second alg is Antisune from the back: it solves the case only after a U turn the solver makes first.
    const alg = "U' R' U2 R U R' U R";
    const { body } = splitLeadingAuf("COLL", alg);
    expect(isGoalReached("COLL", apply(caseState("COLL-S1"), body))).toBe(false);
    expect(isGoalReached("COLL", apply(viewState("COLL-S1", alg), body))).toBe(true);
  });

  it("throws when the alg does not solve the case", () => {
    expect(() => viewState("F2L-2", "U F' U' F")).toThrow(/does not solve F2L-2/);
    expect(() => viewState("OLL-27", mirrorAlg(SUNE))).toThrow(/does not solve OLL-27/);
  });
});

describe("playback", () => {
  const llCases = CASE_SETS.filter((set) => set.id === "PLL" || set.id === "EPLL" || set.id === "COLL").flatMap((set) => set.cases);
  it.each(llCases.flatMap((caseDef) => algOptions(caseDef.id).map((option) => [caseDef.id, option.alg] as const)))(
    "%s: %s ends with the last layer lined up",
    (caseId, alg) => {
      const { preAuf, moves } = playback(caseId, alg);
      const end = applyAlg(applyAlg(caseState(caseId), preAuf), toFaceTurns(moves));
      expect(llCornerAlignment(end)).toBe(0);
    },
  );

  it.each(CASE_SETS.find((set) => set.id === "PLL")!.cases.map((caseDef) => caseDef.id))("%s: every option ends fully solved", (caseId) => {
    for (const option of algOptions(caseId)) {
      const { preAuf, moves } = playback(caseId, option.alg);
      expect(stateKey(applyAlg(applyAlg(caseState(caseId), preAuf), toFaceTurns(moves)))).toBe(stateKey(SOLVED));
    }
  });
});

describe("caseArrows", () => {
  it.each([
    { caseId: "PLL-Ua", corners: 0, edges: 3 },
    { caseId: "PLL-Ub", corners: 0, edges: 3 },
    { caseId: "PLL-H", corners: 0, edges: 4 },
    { caseId: "PLL-Z", corners: 0, edges: 4 },
    { caseId: "PLL-Aa", corners: 3, edges: 0 },
    { caseId: "PLL-E", corners: 4, edges: 0 },
    { caseId: "PLL-T", corners: 2, edges: 2 },
  ])("$caseId: $corners corner and $edges edge arrows", ({ caseId, corners, edges }) => {
    const arrows = caseArrows(caseId, getCase(caseId).algs[0]!);
    expect(arrows.filter((a) => a.piece === "corner")).toHaveLength(corners);
    expect(arrows.filter((a) => a.piece === "edge")).toHaveLength(edges);
  });

  it("gives the same cycle whichever Ua alg draws it", () => {
    const shape = (alg: string) => caseArrows("PLL-Ua", alg).map((a) => `${a.from}>${a.to}`).sort().join(" ");
    const options = algOptions("PLL-Ua").map((option) => option.alg);
    // Different algs may start from different angles, but each draws a 3-cycle of edges with no corners.
    for (const alg of options) expect(shape(alg).split(" ")).toHaveLength(3);
  });

  it.each(["OLL-27", "COLL-S1", "F2L-1"])("%s has none", (caseId) => {
    expect(caseArrows(caseId, getCase(caseId).algs[0]!)).toEqual([]);
  });
});
