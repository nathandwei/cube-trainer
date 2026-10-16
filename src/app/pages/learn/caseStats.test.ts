import { describe, expect, it } from "vitest";
import { analyzeSolve, createRng, generateDemoPlan, getCase, randomScramble } from "@/cube";
import type { SolveRecord } from "@/cube/types";
import type { CaseRep } from "@/shared/learn";
import { drillStats, solveStats } from "./caseStats";

function rep(item: string, recognitionMs: number, executionMs: number, correct = true): CaseRep {
  return { kind: "case", id: `r${recognitionMs}${executionMs}`, createdAt: 1, item, auf: "", recognitionMs, executionMs, moves: [], correct, source: "smartcube" };
}

describe("drillStats", () => {
  it("takes medians of his correct reps, recognition only where it was timed", () => {
    const stats = drillStats("PLL-T", [rep("PLL-T", 0, 1200), rep("PLL-T", 600, 1000), rep("PLL-T", 0, 1100), rep("PLL-T", 0, 900, false), rep("PLL-Ua", 0, 500)]);
    expect(stats).toEqual({ reps: 3, executionMs: 1100, recognitionMs: 600, bestMs: 1100 });
  });

  it("has nothing to say without reps", () => {
    expect(drillStats("PLL-T", [])).toEqual({ reps: 0, executionMs: null, recognitionMs: null, bestMs: null });
  });
});

describe("solveStats", () => {
  // Demo solves (OLL → PLL), saved as if done on the cube.
  const solves: SolveRecord[] = Array.from({ length: 12 }, (_, i) => {
    const scramble = randomScramble(createRng(500 + i));
    const plan = generateDemoPlan(scramble, i, "oll-pll");
    return { id: `s${i}`, scramble, moves: plan.moves, totalMs: plan.moves.at(-1)!.t, penalty: "none", createdAt: 1000 + i, source: "smartcube", analysis: analyzeSolve(scramble, plan.moves, { method: "oll-pll" }) };
  });
  const plls = solves.flatMap((s) => {
    const stage = s.analysis!.stages.find((st) => st.kind === "pll");
    return stage?.caseName ? [`PLL-${stage.caseName}`] : [];
  });

  it("finds each PLL the solves did, with his alg recognised", () => {
    const caseId = plls[0]!;
    const stats = solveStats(caseId, getCase(caseId).algs[0], solves, { method: "oll-pll" });
    expect(stats.sightings.length).toBe(plls.filter((id) => id === caseId).length);
    expect(stats.usedAlgShare).toBe(1);
    expect(stats.executionMs).toBeGreaterThan(0);
    expect(stats.sightings.map((s) => s.createdAt)).toEqual([...stats.sightings.map((s) => s.createdAt)].sort((a, b) => b - a));
  });

  it("tells when he did the case with another alg", () => {
    const caseId = plls[0]!;
    const other = getCase(caseId).algs.find((_, i) => i > 0);
    if (!other) return;
    const stats = solveStats(caseId, other, solves, { method: "oll-pll" });
    expect(stats.usedAlgShare).toBeLessThan(1);
  });

  it("skips test solves", () => {
    const tests = solves.map((s) => ({ ...s, source: "demo" as const }));
    expect(solveStats(plls[0]!, undefined, tests, { method: "oll-pll" }).sightings).toEqual([]);
  });
});
