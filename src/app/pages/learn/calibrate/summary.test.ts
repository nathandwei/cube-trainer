import { describe, expect, it } from "vitest";
import { getCase } from "@/cube";
import { TOP_SAVINGS, biggestSavings, type Known } from "./summary";

const known = (caseId: string, alg: string, test = false): Known => ({ caseId, alg, test, executionMs: 2000 });
/** His alg padded with turns that cancel: the same case, more moves. */
const padded = (caseId: string, pairs: number) => [getCase(caseId).algs[0], ...Array.from({ length: pairs }, () => "D D'")].join(" ");

describe("biggestSavings", () => {
  it("ranks the cases by moves a shorter alg saves", () => {
    const savings = biggestSavings([known("PLL-Na", getCase("PLL-Na").algs[0]!), known("OLL-36", getCase("OLL-36").algs[0]!), known("PLL-T", padded("PLL-T", 4))]);
    expect(savings.map((s) => [s.caseId, s.saved])).toEqual([
      ["PLL-T", 8],
      ["OLL-36", 6],
      ["PLL-Na", 5],
    ]);
    expect(savings[1]).toMatchObject({ yours: getCase("OLL-36").algs[0], yourMoves: 16, shorter: getCase("OLL-36").algs[1], moves: 10 });
  });

  it.each([
    ["his alg is already the shortest", known("OLL-27", "R U R' U R U2 R'")],
    ["a shorter alg saves only one move", known("PLL-T", `${getCase("PLL-T").algs[0]} D`)],
    ["his own alg is shorter than any in the catalog", known("OLL-27", "R U R'")],
  ])("lists nothing when %s", (_, entry) => {
    expect(biggestSavings([entry])).toEqual([]);
  });

  it(`lists at most ${TOP_SAVINGS}, keeping the set's order between equal savings`, () => {
    const pads = ["D D'", "B B'", "L L'", "D' D", "B' B", "L' L", "D2 D2", "B2 B2", "L2 L2", "F F'"];
    const entries = pads.map((pad) => known("PLL-T", `${getCase("PLL-T").algs[0]} ${pad} ${pad} ${pad}`));
    const savings = biggestSavings(entries);
    expect(savings).toHaveLength(TOP_SAVINGS);
    expect(savings.map((s) => s.yours)).toEqual(entries.slice(0, TOP_SAVINGS).map((e) => e.alg));
  });

  it("carries the test mark through", () => {
    expect(biggestSavings([known("PLL-T", padded("PLL-T", 4), true)])[0]?.test).toBe(true);
  });
});
