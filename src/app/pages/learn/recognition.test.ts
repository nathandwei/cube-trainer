import { describe, expect, it } from "vitest";
import { applyAlg, caseState, getCase, getCaseSet, isGoalReached, playback, toFaceTurns } from "@/cube";
import { quartersOf, recognitionAngles } from "./recognition";

const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
const CASES = [...getCaseSet("PLL").cases, ...getCaseSet("EPLL").cases].map((c) => ({ caseId: c.id, alg: c.algs[0]! }));

describe("recognitionAngles", () => {
  it.each(CASES)("tells $caseId apart from every case that shows the same, from every angle", ({ caseId, alg }) => {
    for (const angle of recognitionAngles(caseId, alg)) {
      for (const lookalike of angle.lookalikes) expect(lookalike.differ, `${lookalike.caseId} from ${angle.auf || "–"}`).not.toEqual([]);
    }
  });

  it.each(CASES)("gets $caseId's alg to solve it from every angle", ({ caseId, alg }) => {
    const { set } = getCase(caseId);
    const { moves } = playback(caseId, alg);
    for (const { auf, preAuf } of recognitionAngles(caseId, alg)) {
      expect(isGoalReached(set, applyAlg(caseState(caseId), toFaceTurns(`${auf} ${preAuf} ${moves}`)))).toBe(true);
    }
  });

  it.each([
    { caseId: "PLL-T", preAufs: ["", "U", "U'", "U2"] },
    // Symmetric cases start from more than one angle.
    { caseId: "PLL-E", preAufs: ["", "", "U", "U"] },
    { caseId: "PLL-H", preAufs: ["", "", "", ""] },
  ])("lists $caseId's angles from where the alg starts", ({ caseId, preAufs }) => {
    const alg = caseId === "PLL-T" ? T_PERM : getCase(caseId).algs[0]!;
    expect(recognitionAngles(caseId, alg).map((angle) => angle.preAuf)).toEqual(preAufs);
  });

  it("reads H perm as headlights on both sides in four colours from every angle", () => {
    for (const angle of recognitionAngles("PLL-H", getCase("PLL-H").algs[0]!)) {
      expect(angle.features).toEqual({ left: "Headlights", right: "Headlights", colours: 4, bookends: false });
    }
  });

  it("shows Ub beside Ua where Ua has a 3-bar and headlights", () => {
    const angles = recognitionAngles("PLL-Ua", getCase("PLL-Ua").algs[0]!);
    const barAndLights = angles.find(({ features }) => features.left === "3-bar" && features.right === "Headlights");
    expect(barAndLights?.lookalikes.map((l) => l.caseId)).toEqual(["PLL-Ub"]);
  });
});

describe("quartersOf", () => {
  it.each([
    { move: "U", quarters: 1 },
    { move: "U2", quarters: 2 },
    { move: "U'", quarters: 3 },
    { move: "R", quarters: null },
    { move: "", quarters: null },
  ])("counts $move as $quarters", ({ move, quarters }) => {
    expect(quartersOf(move)).toBe(quarters);
  });
});
