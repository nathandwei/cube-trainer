import { describe, expect, it } from "vitest";
import { algMoveCount, isSameAlg } from "./algs";
import {
  CASES_BY_ID,
  CASE_SETS,
  FASTER_ALG_RULES,
  caseState,
  fasterAlg,
  getCase,
  getCaseSet,
  isGoalReached,
  recognizeCase,
  type CaseSetId,
} from "./cases";
import { SOLVED, applyAlg, invertAlg, isSolved, toFaceTurns, type CubeState } from "./cubie";
import { recognizeEPLL } from "./ll";
import { COLL_ALGS, EO_ALGS, EPLL_ALGS, OCLL_REFERENCE } from "./ll-data";
import {
  isCOLLDone,
  isEODone,
  isF2LSolved,
  isOLLDone,
  isSolvedUpToAuf,
  llCornerAlignment,
  llCornersOriented,
  llEdgesOriented,
} from "./milestones";
import { isCrossSolved, isSlotSolved } from "./pieces";
import { createRng, randomInt, shuffled } from "./random";

const ALL_CASES = CASE_SETS.flatMap((set) => set.cases);
const AUFS = ["", "U", "U'", "U2"] as const;

function apply(state: CubeState, ...algs: string[]): CubeState {
  return applyAlg(
    state,
    algs.flatMap((alg) => toFaceTurns(alg).split(" ").filter(Boolean)),
  );
}

function parity(perm: readonly number[]): number {
  let inversions = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i]! > perm[j]!) inversions++;
  return inversions % 2;
}

function permutations(items: readonly number[]): number[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

const PERMS_4 = permutations([0, 1, 2, 3]);

/** F2L solved, last layer as given. */
function llState(cp: number[], co: number[], ep: number[], eo: number[]): CubeState {
  return {
    cp: [...cp, 4, 5, 6, 7],
    co: [...co, 0, 0, 0, 0],
    ep: [...ep, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [...eo, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

/** What the set's case states must satisfy (and recognizeCase requires). */
const PRECONDITIONS: Record<CaseSetId, (s: CubeState) => boolean> = {
  PLL: (s) => isOLLDone(s) && !isSolvedUpToAuf(s),
  OLL: (s) => isF2LSolved(s) && !(llCornersOriented(s) && llEdgesOriented(s)),
  COLL: (s) => isEODone(s) && !isCOLLDone(s),
  EPLL: (s) => isCOLLDone(s) && !isSolvedUpToAuf(s),
  EO: (s) => isF2LSolved(s) && !isEODone(s),
  F2L: (s) =>
    isCrossSolved(s) && (["FL", "BL", "BR"] as const).every((slot) => isSlotSolved(s, slot)) && !isSlotSolved(s, "FR"),
};

/** After preAuf + alg + postAuf: the set's goal with nothing left to align. */
function fullyDone(set: CaseSetId, state: CubeState): boolean {
  switch (set) {
    case "PLL":
    case "EPLL":
      return isSolved(state);
    case "COLL":
      return isCOLLDone(state) && llCornerAlignment(state) === 0;
    default:
      return isGoalReached(set, state);
  }
}

describe("catalog", () => {
  it.each([
    ["PLL", 21],
    ["OLL", 57],
    ["COLL", 42],
    ["EPLL", 4],
    ["EO", 3],
    ["F2L", 41],
  ] as const)("%s has %i cases", (set, count) => {
    expect(getCaseSet(set).cases).toHaveLength(count);
  });

  it("names every PLL, numbers every OLL and F2L case", () => {
    const pllNames = "Aa Ab E F Ga Gb Gc Gd H Ja Jb Na Nb Ra Rb T Ua Ub V Y Z".split(" ");
    expect(getCaseSet("PLL").cases.map((c) => c.name)).toEqual(pllNames);
    expect(getCaseSet("OLL").cases.map((c) => c.name)).toEqual(Array.from({ length: 57 }, (_, i) => String(i + 1)));
    expect(getCaseSet("F2L").cases.map((c) => c.name)).toEqual(Array.from({ length: 41 }, (_, i) => String(i + 1)));
  });

  it("has unique ids of the form set-name, all indexed", () => {
    expect(new Set(ALL_CASES.map((c) => c.id)).size).toBe(ALL_CASES.length);
    expect(CASES_BY_ID.size).toBe(ALL_CASES.length);
    for (const c of ALL_CASES) {
      expect(c.id).toBe(`${c.set}-${c.name}`);
      expect(getCase(c.id)).toBe(c);
    }
    expect(getCase("PLL-Ga").label).toBe("Ga perm");
    expect(getCase("OLL-27").label).toBe("OLL 27");
    expect(getCase("COLL-T3").group).toBe("T");
    expect(() => getCase("PLL-Q")).toThrow();
  });

  it.each(ALL_CASES.map((c) => [c.id, c] as const))("%s: 1–4 distinct algs with their move counts", (_id, c) => {
    expect(c.algs.length).toBeGreaterThanOrEqual(1);
    expect(c.algs.length).toBeLessThanOrEqual(4);
    expect(c.moves).toEqual(c.algs.map(algMoveCount));
    expect(c.group).not.toBe("");
    c.algs.forEach((a, i) => c.algs.slice(i + 1).forEach((b) => expect(isSameAlg(a, b), `${a} vs ${b}`).toBe(false)));
  });

  it("keeps the solve analysis' algs as the COLL, EO and EPLL defaults", () => {
    expect(getCaseSet("COLL").cases.map((c) => [c.name, c.algs[0]])).toEqual(COLL_ALGS.map((e) => [e.name, e.alg]));
    expect(getCaseSet("EO").cases.map((c) => [c.name, c.algs[0]])).toEqual(EO_ALGS.map((e) => [e.name, e.alg]));
    expect(getCaseSet("EPLL").cases.map((c) => [c.name, c.algs[0]])).toEqual(EPLL_ALGS.map((e) => [e.name, e.alg]));
  });

  it("gives EPLL the PLL algs of the same case", () => {
    for (const c of getCaseSet("EPLL").cases) {
      const pll = getCase(`PLL-${c.name}`);
      for (const alg of c.algs) expect(pll.algs.some((other) => isSameAlg(other, alg)), alg).toBe(true);
    }
  });

  it("groups PLL, OLL and F2L as their datasets do", () => {
    const groups = (set: CaseSetId): Record<string, string[]> => {
      const out: Record<string, string[]> = {};
      for (const c of getCaseSet(set).cases) (out[c.group] ??= []).push(c.name);
      return out;
    };
    expect(groups("PLL")).toEqual({
      "Adjacent corners": ["Aa", "Ab", "F", "Ja", "Jb", "Ra", "Rb", "T"],
      "Diagonal corners": ["E", "Na", "Nb", "V", "Y"],
      "G perms": ["Ga", "Gb", "Gc", "Gd"],
      "Edge perms": ["H", "Ua", "Ub", "Z"],
    });
    expect(groups("OLL")["Dot"]).toEqual(["1", "2", "3", "4", "17", "18", "19", "20"]);
    expect(groups("OLL")["Edges oriented"]).toEqual(["21", "22", "23", "24", "25", "26", "27"]);
    expect(groups("OLL")["Corners oriented"]).toEqual(["28", "57"]);
    expect(Object.keys(groups("F2L"))).toEqual([
      "Basic insert",
      "Split",
      "Connected",
      "Corner in slot",
      "Edge in slot",
      "Both in slot",
    ]);
  });
});

describe("case states", () => {
  it.each(ALL_CASES.map((c) => [c.id, c] as const))("%s is a case of its set", (id, c) => {
    expect(PRECONDITIONS[c.set](caseState(id))).toBe(true);
  });

  // An alg solves a case when, after some pre-AUF, it takes the case state to the set's goal.
  it.each(ALL_CASES.flatMap((c) => c.algs.map((alg, i) => [c.id, i, alg] as const)))(
    "%s alg %i (%s) reaches the goal up to AUF",
    (id, i, alg) => {
      const { set } = getCase(id);
      const working = AUFS.filter((pre) => isGoalReached(set, apply(caseState(id), pre, alg)));
      expect(working.length).toBeGreaterThan(0);
      if (i === 0) expect(working).toContain("");
    },
  );

  // F2L goal, spelled out: every D-layer and E-slice piece home and unturned; U-layer pieces anywhere.
  it.each(getCaseSet("F2L").cases.flatMap((c) => c.algs.map((alg) => [c.id, alg] as const)))(
    "%s: %s inserts the pair and leaves the rest of F2L alone",
    (id, alg) => {
      const pre = AUFS.find((p) => isF2LSolved(apply(caseState(id), p, alg)));
      expect(pre).toBeDefined();
      const end = apply(caseState(id), pre!, alg);
      for (const p of [4, 5, 6, 7]) expect([end.cp[p], end.co[p]]).toEqual([p, 0]);
      for (const p of [4, 5, 6, 7, 8, 9, 10, 11]) expect([end.ep[p], end.eo[p]]).toEqual([p, 0]);
    },
  );
});

describe("case shapes match their names", () => {
  // Corner swap the PLL needs, read after the best U turn: none, adjacent or diagonal.
  function cornerSwap(state: CubeState): string {
    let best = { moved: 5, kind: "" };
    for (const auf of AUFS) {
      const turned = apply(state, auf);
      const moved = [0, 1, 2, 3].filter((i) => turned.cp[i] !== i);
      if (moved.length >= best.moved) continue;
      const kind = moved.length === 0 ? "none" : (moved[1]! - moved[0]!) % 2 === 1 ? "adjacent" : "diagonal";
      best = { moved: moved.length, kind };
    }
    return best.kind;
  }

  it.each(getCaseSet("PLL").cases.map((c) => [c.id, c.group] as const))("%s (%s)", (id, group) => {
    const expected: Record<string, string> = {
      "Adjacent corners": "adjacent",
      "G perms": "adjacent",
      "Diagonal corners": "diagonal",
      "Edge perms": "none",
    };
    expect(cornerSwap(caseState(id))).toBe(expected[group]);
  });

  it.each(["Ua", "Ub", "H", "Z"])("PLL %s is the EPLL case of that name", (name) => {
    expect(recognizeEPLL(caseState(`PLL-${name}`))?.caseName).toBe(name);
  });

  function flipped(state: CubeState): number[] {
    return [0, 1, 2, 3].filter((i) => state.eo[i] === 1);
  }

  const ollGroups = getCaseSet("OLL").cases.map((c) => [c.id, c.group] as const);
  it.each(ollGroups)("%s (%s) flips the right edges", (id, group) => {
    const state = caseState(id);
    const edges = flipped(state);
    switch (group) {
      case "Dot":
        return expect(edges).toHaveLength(4);
      case "Edges oriented":
        return expect(edges).toHaveLength(0);
      case "Corners oriented":
        expect(llCornersOriented(state)).toBe(true);
        return expect(edges.length).toBeGreaterThan(0);
      case "Line":
        return expect(edges.length === 2 && (edges[1]! - edges[0]!) % 2 === 0).toBe(true);
      case "L shape":
        return expect(edges.length === 2 && (edges[1]! - edges[0]!) % 2 === 1).toBe(true);
      default:
        return expect(edges).toHaveLength(2);
    }
  });

  // Twist pattern of the four U corners, compared up to a U turn.
  function twistClass(state: CubeState): string {
    const twists = state.co.slice(0, 4);
    return [0, 1, 2, 3].map((r) => [...twists.slice(r), ...twists.slice(0, r)].join("")).sort()[0]!;
  }

  it.each([
    ["H", "21"],
    ["Pi", "22"],
    ["U", "23"],
    ["T", "24"],
    ["L", "25"],
    ["Antisune", "26"],
    ["Sune", "27"],
  ])("OLL %s is OLL %s", (shape, number) => {
    const reference = applyAlg(SOLVED, invertAlg(toFaceTurns(OCLL_REFERENCE[shape]!)));
    expect(twistClass(caseState(`OLL-${number}`))).toBe(twistClass(reference));
  });

  it.each(getCaseSet("F2L").cases.map((c) => [c.id, c.group] as const))("%s (%s) has its pieces there", (id, group) => {
    const state = caseState(id);
    const cornerInSlot = state.cp.indexOf(4) === 4;
    const edgeInSlot = state.ep.indexOf(8) === 8;
    const expected: Record<string, [boolean, boolean]> = {
      "Corner in slot": [true, false],
      "Edge in slot": [false, true],
      "Both in slot": [true, true],
    };
    expect([cornerInSlot, edgeInSlot]).toEqual(expected[group] ?? [false, false]);
  });
});

describe("recognizeCase", () => {
  // Every pre/post-AUF variant of a case reads as that case, so no two cases share a state.
  it.each(ALL_CASES.map((c) => [c.id, c] as const))("%s under every AUF", (id, c) => {
    for (const pre of AUFS) {
      for (const post of AUFS) {
        const state = apply(SOLVED, post && invertAlg(post).join(" "), c.setup, pre && invertAlg(pre).join(" "));
        const match = recognizeCase(c.set, state);
        expect(match?.caseId, `${pre} ${id} ${post}`).toBe(id);
        expect(fullyDone(c.set, apply(state, match!.preAuf, c.algs[0]!, match!.postAuf))).toBe(true);
      }
    }
  });

  it.each(ALL_CASES.flatMap((c) => c.algs.map((_, i) => [c.id, i] as const)))(
    "%s alg %i gets AUFs that work for it",
    (id, i) => {
      const c = getCase(id);
      for (const pre of AUFS) {
        const state = apply(caseState(id), pre);
        const match = recognizeCase(c.set, state, i);
        expect(match?.caseId).toBe(id);
        expect(fullyDone(c.set, apply(state, match!.preAuf, c.algs[i]!, match!.postAuf))).toBe(true);
      }
    },
  );

  it("PLL: all 288 permutations of an oriented last layer", () => {
    const seen = new Set<string>();
    for (const cp of PERMS_4) {
      for (const ep of PERMS_4.filter((perm) => parity(perm) === parity(cp))) {
        const state = llState(cp, [0, 0, 0, 0], ep, [0, 0, 0, 0]);
        const match = recognizeCase("PLL", state);
        if (isSolvedUpToAuf(state)) {
          expect(match).toBeNull();
          continue;
        }
        expect(match, `${cp} ${ep}`).not.toBeNull();
        expect(isSolved(apply(state, match!.preAuf, getCase(match!.caseId).algs[0]!, match!.postAuf))).toBe(true);
        seen.add(match!.caseId);
      }
    }
    expect(seen.size).toBe(21);
  });

  it("OLL: all 216 orientation patterns, with random permutations", () => {
    const rng = createRng(11);
    const seen = new Set<string>();
    for (let mask = 0; mask < 27 * 8; mask++) {
      const co = [mask % 3, Math.floor(mask / 3) % 3, Math.floor(mask / 9) % 3];
      co.push((6 - co[0]! - co[1]! - co[2]!) % 3);
      const flips = Math.floor(mask / 27);
      const eo = [flips & 1, (flips >> 1) & 1, (flips >> 2) & 1];
      eo.push((eo[0]! + eo[1]! + eo[2]!) % 2);
      const cp = PERMS_4[randomInt(rng, 24)]!;
      const edgePerms = PERMS_4.filter((perm) => parity(perm) === parity(cp));
      const state = llState(cp, co, edgePerms[randomInt(rng, edgePerms.length)]!, eo);
      const match = recognizeCase("OLL", state);
      if (llCornersOriented(state) && llEdgesOriented(state)) {
        expect(match).toBeNull();
        continue;
      }
      expect(match, `${co} ${eo}`).not.toBeNull();
      expect(isOLLDone(apply(state, match!.preAuf, getCase(match!.caseId).algs[0]!))).toBe(true);
      seen.add(match!.caseId);
    }
    expect(seen.size).toBe(57);
  });

  /** Cross and the FL, BL, BR slots solved; the FR corner and edge at the given piece states; parity kept. */
  function f2lState(cornerAt: number, twist: number, edgeAt: number, flip: number, rng: () => number): CubeState {
    const cp = [...SOLVED.cp];
    const co = [...SOLVED.co];
    const ep = [...SOLVED.ep];
    const eo = [...SOLVED.eo];
    [cp[cornerAt], cp[4]] = [cp[4]!, cp[cornerAt]!];
    [ep[edgeAt], ep[8]] = [ep[8]!, ep[edgeAt]!];
    co[cornerAt] = twist;
    co[cornerAt === 4 ? 0 : 4] = (3 - twist) % 3;
    eo[edgeAt] = flip;
    eo[edgeAt === 8 ? 0 : 8] = flip;
    const lastLayerEdges = shuffled(
      rng,
      [0, 1, 2, 3].filter((position) => position !== edgeAt),
    );
    const [a, b] = lastLayerEdges as [number, number];
    if (parity(cp) !== parity(ep)) [ep[a], ep[b]] = [ep[b]!, ep[a]!];
    return { cp, co, ep, eo };
  }

  it("F2L: all 150 placements of the front-right pair", () => {
    const rng = createRng(5);
    const seen = new Set<string>();
    for (const cornerAt of [0, 1, 2, 3, 4]) {
      for (const twist of [0, 1, 2]) {
        for (const edgeAt of [0, 1, 2, 3, 8]) {
          for (const flip of [0, 1]) {
            const state = f2lState(cornerAt, twist, edgeAt, flip, rng);
            const match = recognizeCase("F2L", state);
            if (isSlotSolved(state, "FR")) {
              expect(match).toBeNull();
              continue;
            }
            expect(match, `${cornerAt}/${twist} ${edgeAt}/${flip}`).not.toBeNull();
            expect(isF2LSolved(apply(state, match!.preAuf, getCase(match!.caseId).algs[0]!))).toBe(true);
            seen.add(match!.caseId);
          }
        }
      }
    }
    expect(seen.size).toBe(41);
  });

  it.each(CASE_SETS.map((set) => [set.id] as const))("%s: null on a solved cube and when F2L is broken", (set) => {
    expect(recognizeCase(set, SOLVED)).toBeNull();
    expect(recognizeCase(set, apply(SOLVED, "L U L'"))).toBeNull();
  });

  it("F2L: null once the cross moves, a case again after an F2L-safe trigger", () => {
    expect(recognizeCase("F2L", apply(caseState("F2L-4"), "D"))).toBeNull();
    expect(recognizeCase("F2L", apply(SOLVED, "R U R' U'"))).not.toBeNull();
  });

  it("rejects an alg index the case does not have", () => {
    expect(() => recognizeCase("PLL", caseState("PLL-T"), 4)).toThrow(RangeError);
  });
});

describe("fasterAlg", () => {
  // PLL-Ja: 10, 13, 10 and 11 moves.
  const ja = getCase("PLL-Ja");

  it("has the move counts these tests assume", () => {
    expect(ja.moves).toEqual([10, 13, 10, 11]);
  });

  it("suggests the first shortest alternative when a long alg runs slow", () => {
    const suggestion = fasterAlg("PLL-Ja", 1600, 10, ja.algs[1]);
    expect(suggestion).toEqual({
      alg: ja.algs[0],
      algIndex: 0,
      moves: 10,
      currentMoves: 13,
      predictedMs: 1000,
      savedMs: 600,
    });
  });

  it.each([
    ["the alg is already quick", 1200, 10, ja.algs[1]],
    ["nothing is shorter than the default", 5000, 10, undefined],
    ["the saving at this tps is too small", 1100, 9, ja.algs[1]],
  ])("returns null when %s", (_why, measuredMs, tps, current) => {
    expect(fasterAlg("PLL-Ja", measuredMs, tps, current)).toBeNull();
  });

  it("treats a respelled alg in use as the same alg", () => {
    expect(fasterAlg("PLL-Ja", 5000, 10, "(x R2 F R F') (R U2' r' U r U2 x')")).toBeNull();
  });

  it("compares against a custom alg that is not in the catalog", () => {
    const custom = "R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'";
    const suggestion = fasterAlg("PLL-Ja", 2500, 10, custom);
    expect(suggestion?.algIndex).toBe(0);
    expect(suggestion?.currentMoves).toBe(20);
  });

  it("documents its thresholds", () => {
    expect(FASTER_ALG_RULES).toEqual({ minFewerMoves: 2, maxMoveRatio: 0.85, minTimeSaving: 0.2 });
  });

  it.each([
    [0, 10],
    [-5, 10],
    [Number.NaN, 10],
    [1000, 0],
    [1000, Number.POSITIVE_INFINITY],
  ])("rejects measuredMs %d with tps %d", (measuredMs, tps) => {
    expect(() => fasterAlg("PLL-Ja", measuredMs, tps)).toThrow(RangeError);
  });

  it("rejects an unknown case", () => {
    expect(() => fasterAlg("PLL-Q", 1000, 10)).toThrow();
  });
});
