import { describe, expect, it } from "vitest";
import { isSameAlg } from "./algs";
import { CASE_SETS, caseState, getCase, isGoalReached } from "./cases";
import { applyAlg, toFaceTurns } from "./cubie";
import { algOptions } from "./options";
import { SPEED_COSTS, algSpeed, caseAlgSpeed, recommendAlg } from "./speed";
import { COMMUNITY_VOTES, type CommunityCase } from "./speed-votes";

const SEXY = "R U R' U'";
const SUNE = "R U R' U R U2 R'";
const T_PERM = "(R U R' U') R' F R2 U' R' U' (R U R' F')";
const UA_M2 = "M2 U M U2 M' U M2";
const UA_RU = "R U R' U R' U' R2 U' R' U R' U R";
const AUFS = ["", "U", "U'", "U2"] as const;

function turns(alg: string): string[] {
  return toFaceTurns(alg).split(" ").filter(Boolean);
}

function solvesCase(caseId: string, alg: string): boolean {
  const { set } = getCase(caseId);
  return AUFS.some((auf) => isGoalReached(set, applyAlg(caseState(caseId), [...turns(auf), ...turns(alg)])));
}

describe("algSpeed calibration", () => {
  it("runs an RU trigger at 8–10 TPS", () => {
    const { ms, moves } = algSpeed(SEXY);
    expect(moves).toBe(4);
    const tps = moves / (ms / 1000);
    expect(tps).toBeGreaterThanOrEqual(8);
    expect(tps).toBeLessThanOrEqual(10);
  });

  it("puts T perm at 1.0–1.4 s with no regrips", () => {
    const t = algSpeed(T_PERM);
    expect(t.ms).toBeGreaterThanOrEqual(1000);
    expect(t.ms).toBeLessThanOrEqual(1400);
    expect(t.regrips).toBe(0);
    expect(t.moves).toBe(14);
  });

  it("rates both Ua perms fast and close: the M-slice one and the RU one", () => {
    const m2 = algSpeed(UA_M2).ms;
    const ru = algSpeed(UA_RU).ms;
    expect(Math.max(m2, ru)).toBeLessThan(1300);
    expect(Math.abs(m2 - ru) / Math.max(m2, ru)).toBeLessThan(0.15);
  });

  it("makes a regrip-heavy alg slower than a two-gen alg of the same length", () => {
    const regrip = algSpeed("R U' R U R U R U' R' U' R2");
    const twoGen = algSpeed("R U R' U R U' R' U R U2 R'");
    expect(regrip.moves).toBe(twoGen.moves);
    expect(regrip.regrips).toBeGreaterThan(0);
    expect(twoGen.regrips).toBe(0);
    expect(regrip.ms).toBeGreaterThan(twoGen.ms);
    expect(regrip.notes).toContain("regrip (right hand) before R");
  });

  it.each([
    ["B U B' U'", SEXY],
    ["R D R' D'", SEXY],
    ["R B' R' B", "R U R' U'"],
    ["L' U' L U' L' U2 L", SUNE],
    ["S R U R' U' S'", "F R U R' U' F'"],
    ["x' R U R' D R U' R' D' x", "r U R' U' r' F R F'"],
    ["R U R' y R U R'", "R U R' U R U R'"],
    ["R U R' U' u R U' R'", "R U R' U' U R U' R'"],
  ])("rates %s slower than %s", (slow, fast) => {
    expect(algSpeed(slow).ms).toBeGreaterThan(algSpeed(fast).ms);
  });

  it("keeps the two basic front-right inserts close: U R U' R' vs F R' F' R", () => {
    const flick = algSpeed("U R U' R'").ms;
    const sledge = algSpeed("F R' F' R").ms;
    expect(Math.max(flick, sledge)).toBeLessThan(600);
    expect(Math.abs(flick - sledge) / Math.max(flick, sledge)).toBeLessThan(0.15);
  });
});

describe("algSpeed fingering", () => {
  it.each(["R2 U2 R2 U2 R2", "R2 U R2 U R2", "R2 D R2 D' R2"])(
    "turns %s's R2s alternately up and down, so no regrip",
    (alg) => {
      expect(algSpeed(alg).regrips).toBe(0);
    },
  );

  it("does U' with D on one hand as a single motion", () => {
    const paired = algSpeed("R2 U' D R2").ms - algSpeed("R2 U' R2").ms;
    expect(paired).toBeLessThan(SPEED_COSTS.ring);
  });

  it("charges a mid-alg y as a regrip and notes it", () => {
    const rotated = algSpeed("R U R' y R U R'");
    expect(rotated.regrips).toBe(1);
    expect(rotated.notes).toContain("y rotation");
    expect(rotated.moves).toBe(6);
  });

  it("charges a leading x but never a trailing rotation", () => {
    expect(algSpeed(`${SUNE} x'`).ms).toBe(algSpeed(SUNE).ms);
    expect(algSpeed(`${SUNE} y2`).ms).toBe(algSpeed(SUNE).ms);
    expect(algSpeed(`x ${SUNE}`).ms).toBeGreaterThan(algSpeed(SUNE).ms);
  });

  it("does x R' as l' (the same turn), so the spelling does not change the estimate", () => {
    expect(algSpeed("x R' U R' D2 R U' R' D2 R2 x'").ms).toBe(algSpeed("l' U R' D2 R U' R' D2 R2 x'").ms);
    expect(algSpeed("x' R U' R' D R U R' D'").ms).toBe(algSpeed("l U' R' D R U R' D'").ms);
    expect(algSpeed("x L U R").ms).toBe(algSpeed("r U R").ms);
  });

  it("drops the AUF of a last-layer alg only when asked", () => {
    const sune = algSpeed(SUNE).ms;
    expect(algSpeed(`U ${SUNE} U'`, { ignoreAuf: true }).ms).toBe(sune);
    expect(algSpeed(`y ${SUNE}`, { ignoreAuf: true }).ms).toBe(sune);
    expect(algSpeed(`U ${SUNE}`).ms).toBeGreaterThan(sune);
    expect(algSpeed(`y ${SUNE}`).ms).toBeGreaterThan(sune);
  });

  it("notes B turns and the same finger used twice in a row", () => {
    const { notes } = algSpeed("B U B' U'");
    expect(notes).toEqual(["B", "same finger twice (U)", "B'"]);
  });

  it("reads brackets and odd spellings like the catalog, counting slice-turn moves", () => {
    expect(algSpeed("(R U R') U (R U2' R')").ms).toBe(algSpeed(SUNE).ms);
    expect(algSpeed("R2' U R U R' U' R3 U' R' U R'").moves).toBe(11);
    expect(algSpeed("x R2 F R F' R U2 r' U r U2 x'").moves).toBe(10);
  });

  it("takes no time for an empty alg and throws on a non-move", () => {
    expect(algSpeed("")).toEqual({ ms: 0, moves: 0, regrips: 0, notes: [] });
    expect(algSpeed("x y'")).toEqual({ ms: 0, moves: 0, regrips: 0, notes: [] });
    expect(() => algSpeed("R Q")).toThrow();
  });

  it("estimates every option of every case", () => {
    for (const set of CASE_SETS) {
      for (const { id } of set.cases) {
        for (const { alg } of algOptions(id)) {
          const speed = caseAlgSpeed(id, alg);
          expect(speed.ms, `${id} ${alg}`).toBeGreaterThan(0);
          expect(speed.ms, `${id} ${alg}`).toBeLessThan(5000);
        }
      }
    }
  });

  it("drops the AUF for last-layer cases but not for F2L", () => {
    expect(caseAlgSpeed("PLL-Ua", `U ${UA_RU}`).ms).toBe(algSpeed(UA_RU).ms);
    expect(caseAlgSpeed("F2L-1", "U R U' R'").ms).toBe(algSpeed("U R U' R'").ms);
    expect(caseAlgSpeed("F2L-1", "U R U' R'").ms).toBeGreaterThan(algSpeed("R U' R'").ms);
  });
});

describe("recommendAlg", () => {
  it.each(CASE_SETS.flatMap((set) => set.cases.map(({ id }) => [id] as const)))(
    "%s: recommends its fastest option",
    (id) => {
      const recommended = recommendAlg(id);
      expect(recommended).not.toBeNull();
      const times = algOptions(id).map(({ alg }) => caseAlgSpeed(id, alg).ms);
      expect(recommended!.ms).toBe(Math.min(...times));
      expect(algOptions(id).some(({ alg }) => alg === recommended!.alg)).toBe(true);
    },
  );

  it("picks a T-perm alg for COLL O-adj, ahead of the shorter x/r alg (Nathan: what people use)", () => {
    const xAlg = "x R2 F R F' R U2 r' U r U2 x'";
    const tBased = [T_PERM, "(R U R' F') (R U R' U') R' F R2 U' R' U'"];
    const options = algOptions("COLL-O-adj").map(({ alg }) => alg);
    for (const alg of [xAlg, ...tBased]) expect(options).toContain(alg);
    expect(tBased).toContain(recommendAlg("COLL-O-adj")!.alg);
    expect(caseAlgSpeed("COLL-O-adj", T_PERM).ms).toBeLessThan(caseAlgSpeed("COLL-O-adj", xAlg).ms);
  });

  it("uses a measured time that beats the solver's usual pace", () => {
    expect(recommendAlg("PLL-Ua")!.alg).toBe(UA_M2);
    // He runs Sune and T perm 30% slower than the model, but the RU Ua 14% faster: his RU Ua is his best.
    const personalMs = {
      [SUNE]: algSpeed(SUNE).ms * 1.3,
      [T_PERM]: algSpeed(T_PERM).ms * 1.3,
      "(R U R' U) (R' U' R2 U') (R' U R' U R)": 1000,
    };
    expect(recommendAlg("PLL-Ua", { personalMs })).toEqual({ alg: UA_RU, ms: 1000 });
  });

  it("scales estimates to the solver's pace, so one timed alg leaves the model's order", () => {
    const slow = algSpeed(UA_RU).ms * 1.5;
    const recommended = recommendAlg("PLL-Ua", { personalMs: { [UA_RU]: slow } });
    expect(recommended!.alg).toBe(UA_M2);
    expect(recommended!.ms).toBe(Math.round(algSpeed(UA_M2).ms * 1.5));
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])("rejects a measured time of %s", (ms) => {
    expect(() => recommendAlg("PLL-Ua", { personalMs: { [UA_RU]: ms } })).toThrow(RangeError);
  });

  it("throws on an unknown case", () => {
    expect(() => recommendAlg("PLL-Q")).toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Validation against community preference (speed-votes.ts)

const COMMUNITY_ALGS = Object.values(COMMUNITY_VOTES).flatMap((cases) =>
  cases.flatMap(({ caseId, algs }) => algs.map(([alg]) => [caseId, alg] as const)),
);

describe("community data", () => {
  it.each(COMMUNITY_ALGS)("%s: %s solves its case", (caseId, alg) => {
    expect(solvesCase(caseId, alg)).toBe(true);
  });
});

function withoutAuf(alg: string): string {
  return alg.replace(/^(\s*(y2|y'|y|U2|U'|U)\s+)+/, "");
}

// Spellings of one alg for validation: the same face turns once leading and trailing U and D turns are dropped (a D
// moved from one end to the other only shifts the alg cyclically, and the site splits its votes between such
// spellings) and adjacent U/D pairs are put in one order (they commute). "x R'" and "l'" come out the same.
function spellingKey(alg: string): string {
  const t = turns(withoutAuf(alg));
  while (t.length > 0 && /^[UD]/.test(t[0]!)) t.shift();
  while (t.length > 0 && /^[UD]/.test(t.at(-1)!)) t.pop();
  for (let i = 0; i + 1 < t.length; i++) {
    if (t[i]![0] === "D" && t[i + 1]![0] === "U") [t[i], t[i + 1]] = [t[i + 1]!, t[i]!];
  }
  return t.join(" ");
}

type Candidate = { algs: string[]; votes: number; ms: number };

// The case's options plus the site's top algs, spellings of one alg merged (votes summed, the faster spelling's time).
function candidates({ caseId, algs }: CommunityCase): Candidate[] {
  const groups: { algs: string[]; votes: number }[] = [];
  const add = (alg: string, votes: number): void => {
    const same = (other: string): boolean =>
      isSameAlg(withoutAuf(other), withoutAuf(alg)) || spellingKey(other) === spellingKey(alg);
    const group = groups.find((g) => g.algs.some(same));
    if (!group) {
      groups.push({ algs: [alg], votes });
      return;
    }
    group.algs.push(alg);
    group.votes += votes;
  };
  for (const [alg, votes] of algs) add(alg, votes);
  for (const { alg } of algOptions(caseId)) add(alg, 0);
  return groups.map((g) => ({ ...g, ms: Math.min(...g.algs.map((alg) => caseAlgSpeed(caseId, alg).ms)) }));
}

type Outcome = { caseId: string; rank: number; size: number; favourite: Candidate; rival: Candidate | null };

// The favourite's rank by estimated time, 1-based; an equally fast alg counts as ahead of it. The rival is the
// fastest of the other algs.
function outcome(entry: CommunityCase): Outcome {
  const all = candidates(entry);
  const favourite = all.reduce((a, b) => (b.votes > a.votes ? b : a));
  const others = all.filter((c) => c !== favourite);
  const rival = others.length === 0 ? null : others.reduce((a, b) => (b.ms < a.ms ? b : a));
  const rank = 1 + others.filter((c) => c.ms <= favourite.ms).length;
  return { caseId: entry.caseId, rank, size: all.length, favourite, rival };
}

// Hit rates measured when the constants were fitted (2026-10-16): PLL 15/21 top-1 and 19/21 top-2, OLL 33/57 and
// 47/57, COLL 23/40 and 34/40. The floors below leave a little room for retuning without letting the model drift.
const FLOORS = {
  PLL: { top1: 0.7, top2: 0.9 },
  OLL: { top1: 0.55, top2: 0.8 },
  COLL: { top1: 0.55, top2: 0.8 },
} as const;

describe("speed model vs the community's most-voted alg", () => {
  it.each(Object.keys(FLOORS) as (keyof typeof FLOORS)[])("%s: ranks the favourite first often enough", (set) => {
    const outcomes = COMMUNITY_VOTES[set].map(outcome).filter(({ size }) => size > 1);
    const top1 = outcomes.filter(({ rank }) => rank === 1).length / outcomes.length;
    const top2 = outcomes.filter(({ rank }) => rank <= 2).length / outcomes.length;
    const misses = outcomes
      .filter(({ rank }) => rank > 1)
      .map(
        ({ caseId, rank, size, favourite, rival }) =>
          `  ${caseId}: favourite ${favourite.algs[0]} (${favourite.votes} votes, ${favourite.ms} ms) ranked ` +
          `${rank}/${size}; fastest other ${rival?.algs[0]} (${rival?.votes} votes, ${rival?.ms} ms)`,
      );
    console.info(
      `${set}: favourite first in ${(top1 * 100).toFixed(0)}%, top two in ${(top2 * 100).toFixed(0)}% ` +
        `of ${outcomes.length} cases\n${misses.join("\n")}`,
    );
    expect(top1).toBeGreaterThanOrEqual(FLOORS[set].top1);
    expect(top2).toBeGreaterThanOrEqual(FLOORS[set].top2);
  });
});
