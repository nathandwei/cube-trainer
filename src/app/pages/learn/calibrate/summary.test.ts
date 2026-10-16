import { describe, expect, it } from "vitest";
import { caseAlgSpeed, getCase, recommendAlg } from "@/cube";
import { TOP_SAVINGS, biggestSavings, paceOf, type Known } from "./summary";

/** A take turned exactly at the model's pace (× `pace`). */
const known = (caseId: string, alg: string, pace = 1, test = false): Known => ({ caseId, alg, test, executionMs: caseAlgSpeed(caseId, alg).ms * pace });
/** His alg padded with turns that cancel: the same case, slower. */
const padded = (caseId: string, pairs: number) => [getCase(caseId).algs[0], ...Array.from({ length: pairs }, () => "D D'")].join(" ");

describe("paceOf", () => {
  it("is his time over the model's, as a median over takes", () => {
    expect(paceOf([known("PLL-T", getCase("PLL-T").algs[0]!, 1.5), known("OLL-27", "R U R' U R U2 R'", 1.5), known("PLL-Ua", "M2 U M U2 M' U M2", 3)])).toBeCloseTo(1.5, 6);
  });
});

describe("biggestSavings", () => {
  it("ranks the cases by time a faster alg saves at his pace", () => {
    const takes = [known("PLL-T", padded("PLL-T", 6)), known("PLL-Ua", padded("PLL-Ua", 2)), known("OLL-27", "R U R' U R U2 R'")];
    const savings = biggestSavings(takes);
    expect(savings.map((s) => s.caseId)).toEqual(["PLL-T", "PLL-Ua"]);
    expect(savings[0]!.savedMs).toBeGreaterThan(savings[1]!.savedMs);
    expect(savings[0]!.fasterMs).toBeLessThan(savings[0]!.yourMs);
  });

  it.each([
    ["his alg is already about the fastest", [known("OLL-27", "R U R' U R U2 R'")]],
    ["he already uses the model's best, just a little slower", [known("PLL-T", recommendAlg("PLL-T")!.alg, 1.1)]],
    ["there's nothing to compare", []],
  ])("lists nothing when %s", (_, takes) => {
    expect(biggestSavings(takes)).toEqual([]);
  });

  it(`lists at most ${TOP_SAVINGS}, keeping the set's order between equal savings`, () => {
    const pads = ["D D'", "B B'", "L L'", "D' D", "B' B", "L' L", "D2 D2", "B2 B2", "L2 L2", "F F'"];
    const entries = pads.map((pad) => known("PLL-T", `${getCase("PLL-T").algs[0]} ${pad} ${pad} ${pad}`));
    const savings = biggestSavings(entries);
    expect(savings.length).toBeLessThanOrEqual(TOP_SAVINGS);
    expect(savings.length).toBeGreaterThan(0);
  });

  it("never suggests an alg the model rates slower, however slow one take was", () => {
    const takes = [known("PLL-T", getCase("PLL-T").algs[0]!), known("OLL-27", "R U R' U R U2 R'"), known("PLL-Ua", recommendAlg("PLL-Ua")!.alg, 3)];
    for (const saving of biggestSavings(takes, Infinity)) {
      expect(caseAlgSpeed(saving.caseId, saving.faster).ms).toBeLessThan(caseAlgSpeed(saving.caseId, saving.yours).ms);
    }
    expect(biggestSavings(takes, Infinity).map((s) => s.caseId)).not.toContain("PLL-Ua");
  });

  it("reads his pace from real takes when there are any", () => {
    expect(paceOf([known("PLL-T", getCase("PLL-T").algs[0]!, 2), known("OLL-27", "R U R' U R U2 R'", 0.5, true)])).toBeCloseTo(2, 6);
  });

  it("carries the test mark through", () => {
    expect(biggestSavings([known("PLL-T", padded("PLL-T", 6), 1, true)])[0]?.test).toBe(true);
  });
});
