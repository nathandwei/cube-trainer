import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, invertAlg, isSolved, toFaceTurns, type CubeState } from "./cubie";
import { EPLL_REFERENCE, OCLL_REFERENCE } from "./ll-data";
import {
  COLL_CASES,
  EO_CASES,
  EPLL_CASES,
  matchFaceTurns,
  recognizeCOLL,
  recognizeEO,
  recognizeEPLL,
  type LLCase,
} from "./ll";
import {
  isCOLLDone,
  isEODone,
  isF2LSolved,
  isOLLDone,
  isSolvedUpToAuf,
  llCornerAlignment,
  llEdgesOriented,
} from "./milestones";
import { createRng, randomInt, type Rng } from "./random";

const ALL_CASES = [...EO_CASES, ...COLL_CASES, ...EPLL_CASES];

function caseState(llCase: LLCase): CubeState {
  return applyAlg(SOLVED, invertAlg(llCase.faceTurns));
}

function permutations(items: readonly number[]): number[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

function parity(perm: readonly number[]): number {
  let inversions = 0;
  for (let i = 0; i < perm.length; i++) for (let j = i + 1; j < perm.length; j++) if (perm[i]! > perm[j]!) inversions++;
  return inversions % 2;
}

const PERMS_4 = permutations([0, 1, 2, 3]);

/** A legal state with F2L solved and the given last-layer pieces. */
function llState(cp: number[], co: number[], ep: number[], eo: number[]): CubeState {
  if (parity(cp) !== parity(ep)) throw new Error("Corner and edge parity must match");
  if (co.reduce((a, b) => a + b, 0) % 3 !== 0 || eo.reduce((a, b) => a + b, 0) % 2 !== 0) {
    throw new Error("Illegal twist or flip");
  }
  return {
    cp: [...cp, 4, 5, 6, 7],
    co: [...co, 0, 0, 0, 0],
    ep: [...ep, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [...eo, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

function edgePermWithParity(rng: Rng, wanted: number): number[] {
  const candidates = PERMS_4.filter((perm) => parity(perm) === wanted);
  return candidates[randomInt(rng, candidates.length)]!;
}

function twistsSummingToZero(): number[][] {
  const out: number[][] = [];
  for (let a = 0; a < 3; a++)
    for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) out.push([a, b, c, (6 - a - b - c) % 3]);
  return out;
}

function lastNonUIndex(moves: readonly string[]): number {
  for (let i = moves.length - 1; i >= 0; i--) if (!moves[i]!.startsWith("U")) return i;
  return -1;
}

describe("dataset shape", () => {
  it("has the expected case names", () => {
    expect(EO_CASES.map((c) => c.name)).toEqual(["line", "L", "dot"]);
    expect(EPLL_CASES.map((c) => c.name)).toEqual(["Ua", "Ub", "H", "Z"]);
    expect(COLL_CASES).toHaveLength(42);
    expect(new Set(COLL_CASES.map((c) => c.name)).size).toBe(42);
    const subsets = new Map<string, number>();
    for (const c of COLL_CASES) subsets.set(c.subset!, (subsets.get(c.subset!) ?? 0) + 1);
    expect(Object.fromEntries(subsets)).toEqual({ Antisune: 6, Sune: 6, L: 6, U: 6, T: 6, Pi: 6, H: 4, O: 2 });
  });
});

describe("every alg keeps what it must keep", () => {
  it.each(ALL_CASES.map((c) => [c.name, c]))("%s keeps F2L", (_name, llCase) => {
    expect(isF2LSolved(applyAlg(SOLVED, llCase.faceTurns))).toBe(true);
  });

  it.each([...COLL_CASES, ...EPLL_CASES].map((c) => [c.name, c]))("%s keeps edges oriented", (_name, llCase) => {
    expect(llEdgesOriented(applyAlg(SOLVED, llCase.faceTurns))).toBe(true);
  });

  it.each(EPLL_CASES.map((c) => [c.name, c]))("%s keeps corners solved", (_name, llCase) => {
    expect(llCornerAlignment(applyAlg(SOLVED, llCase.faceTurns))).toBeGreaterThanOrEqual(0);
  });
});

describe("case names match the case shapes", () => {
  function flipped(state: CubeState): number[] {
    return [0, 1, 2, 3].filter((i) => state.eo[i] === 1);
  }

  it.each([
    ["line", (f: number[]) => f.length === 2 && (f[1]! - f[0]!) % 2 === 0],
    ["L", (f: number[]) => f.length === 2 && (f[1]! - f[0]!) % 2 === 1],
    ["dot", (f: number[]) => f.length === 4],
  ] as const)("EO %s", (name, shape) => {
    const llCase = EO_CASES.find((c) => c.name === name)!;
    expect(shape(flipped(caseState(llCase)))).toBe(true);
  });

  // Twist pattern of the four U corners, compared up to a U turn.
  function twistClass(state: CubeState): string {
    const twists = state.co.slice(0, 4);
    return [0, 1, 2, 3]
      .map((r) => [...twists.slice(r), ...twists.slice(0, r)].join(""))
      .sort()[0]!;
  }

  it.each(COLL_CASES.filter((c) => c.subset !== "O").map((c) => [c.name, c]))(
    "COLL %s has its subset's corner orientation",
    (_name, llCase) => {
      const reference = applyAlg(SOLVED, invertAlg(toFaceTurns(OCLL_REFERENCE[llCase.subset!]!)));
      expect(twistClass(caseState(llCase))).toBe(twistClass(reference));
    },
  );

  function swapKind(state: CubeState): "adjacent" | "diagonal" | null {
    for (let auf = 0; auf < 4; auf++) {
      const turned = applyAlg(state, Array<string>(auf).fill("U"));
      const moved = [0, 1, 2, 3].filter((i) => turned.cp[i] !== i);
      if (moved.length !== 2) continue;
      return (moved[1]! - moved[0]!) % 2 === 1 ? "adjacent" : "diagonal";
    }
    return null;
  }

  it.each([
    ["O-adj", "adjacent"],
    ["O-diag", "diagonal"],
  ])("COLL %s is an oriented %s corner swap", (name, kind) => {
    const state = caseState(COLL_CASES.find((c) => c.name === name)!);
    expect(state.co.slice(0, 4)).toEqual([0, 0, 0, 0]);
    expect(swapKind(state)).toBe(kind);
  });

  it.each(Object.entries(EPLL_REFERENCE))("EPLL %s agrees with the dataset's R-U alg (%s)", (name, reference) => {
    const state = applyAlg(SOLVED, invertAlg(toFaceTurns(reference)));
    expect(recognizeEPLL(state)?.caseName).toBe(name);
  });

  it.each([
    ["H", [2, 3, 0, 1]],
    ["Z", [1, 0, 3, 2]],
  ])("EPLL %s swaps edges as named", (name, edges) => {
    const state = llState([0, 1, 2, 3], [0, 0, 0, 0], edges, [0, 0, 0, 0]);
    expect(recognizeEPLL(state)?.caseName).toBe(name);
  });
});

describe("recognition solves every last-layer state", () => {
  const rng = createRng(7);

  const eoStates = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => {
    const eo = [mask & 1, (mask >> 1) & 1, (mask >> 2) & 1, 0];
    eo[3] = eo.reduce((a, b) => a + b, 0) % 2;
    return eo;
  });

  it.each(eoStates.map((eo) => [eo.join(""), eo]))("EO pattern %s, with random corners and edges", (_label, eo) => {
    for (let trial = 0; trial < 6; trial++) {
      const cp = PERMS_4[randomInt(rng, 24)]!;
      const co = twistsSummingToZero()[randomInt(rng, 27)]!;
      const state = llState(cp, co, edgePermWithParity(rng, parity(cp)), eo);
      const match = recognizeEO(state);
      if (eo.every((f) => f === 0)) {
        expect(match).toBeNull();
        continue;
      }
      expect(match).not.toBeNull();
      expect(isEODone(applyAlg(state, matchFaceTurns(match!)))).toBe(true);
    }
  });

  it("COLL: all 648 corner configurations, with random edges", () => {
    const seen = new Set<string>();
    for (const cp of PERMS_4) {
      for (const co of twistsSummingToZero()) {
        const state = llState(cp, co, edgePermWithParity(rng, parity(cp)), [0, 0, 0, 0]);
        const match = recognizeCOLL(state);
        if (llCornerAlignment(state) >= 0) {
          expect(match).toBeNull();
          continue;
        }
        expect(match, `corners ${cp} ${co}`).not.toBeNull();
        const after = applyAlg(state, matchFaceTurns(match!));
        expect(isCOLLDone(after)).toBe(true);
        expect(llCornerAlignment(after)).toBe(0);
        seen.add(match!.caseName);
      }
    }
    expect(seen.size).toBe(42);
  });

  it("EPLL: every edge permutation for every corner alignment", () => {
    const seen = new Set<string>();
    for (let shift = 0; shift < 4; shift++) {
      const cp = [0, 1, 2, 3].map((i) => (i + shift) % 4);
      for (const ep of PERMS_4.filter((perm) => parity(perm) === parity(cp))) {
        const state = llState(cp, [0, 0, 0, 0], ep, [0, 0, 0, 0]);
        const match = recognizeEPLL(state);
        if (isSolvedUpToAuf(state)) {
          expect(match).toBeNull();
          continue;
        }
        expect(match).not.toBeNull();
        expect(isSolved(applyAlg(state, matchFaceTurns(match!)))).toBe(true);
        seen.add(match!.caseName);
      }
    }
    expect([...seen].sort()).toEqual(["H", "Ua", "Ub", "Z"]);
  });

  it("returns null when F2L is broken", () => {
    const broken = applyAlg(SOLVED, "R U R'");
    expect(recognizeEO(broken)).toBeNull();
    expect(recognizeCOLL(broken)).toBeNull();
    expect(recognizeEPLL(broken)).toBeNull();
  });

  // Every pre/post-AUF variant of a case is recognised as that case, so no two cases share a state.
  it("names the same case whatever the AUFs", () => {
    const aufs = ["", "U", "U2", "U'"];
    for (const llCase of [...COLL_CASES, ...EPLL_CASES, ...EO_CASES]) {
      for (const pre of aufs) {
        for (const post of aufs) {
          const state = applyAlg(SOLVED, invertAlg([pre, ...llCase.faceTurns, post].filter(Boolean)));
          const match = recognizeEO(state) ?? recognizeCOLL(state) ?? recognizeEPLL(state);
          expect(match?.caseName, `${pre} ${llCase.name} ${post}`).toBe(llCase.name);
        }
      }
    }
  });
});

describe("algs reach their milestone only on their last non-U turn", () => {
  // The solve analysis ends a stage the first time its milestone holds, so an alg that passed through the
  // milestone midway would be split in two.
  function firstReached(start: CubeState, moves: readonly string[], done: (s: CubeState) => boolean): number {
    let state = start;
    for (let i = 0; i < moves.length; i++) {
      state = applyAlg(state, [moves[i]!]);
      if (done(state)) return i;
    }
    return -1;
  }

  it.each(EO_CASES.map((c) => [c.name, c]))("EO %s", (_name, llCase) => {
    expect(firstReached(caseState(llCase), llCase.faceTurns, isEODone)).toBe(lastNonUIndex(llCase.faceTurns));
  });

  it.each(COLL_CASES.map((c) => [c.name, c]))("COLL %s", (_name, llCase) => {
    const start = caseState(llCase);
    const last = lastNonUIndex(llCase.faceTurns);
    expect(firstReached(start, llCase.faceTurns, isCOLLDone)).toBe(last);
    if (llCase.subset !== "O") expect(firstReached(start, llCase.faceTurns, isOLLDone)).toBe(last);
  });

  it.each(EPLL_CASES.map((c) => [c.name, c]))("EPLL %s", (_name, llCase) => {
    const reached = firstReached(caseState(llCase), llCase.faceTurns, isSolvedUpToAuf);
    expect(reached).toBe(lastNonUIndex(llCase.faceTurns));
  });
});
