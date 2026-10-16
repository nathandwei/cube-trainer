import { describe, expect, it } from "vitest";
import { algOptions, analyzeSolve, applyAlg, caseAlgSpeed, invertAlg, scrambledState, toFaceTurns } from "@/cube";
import type { TimedMove } from "@/cube/types";
import { algUse, yourAlg } from "./algUse";
import { stageCase } from "./cases";

const SWAP: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "F", B: "B" };
const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";

function turns(alg: string): string[] {
  return toFaceTurns(alg).split(" ").filter(Boolean);
}

/** The PLL stage of a solve that is OLL (Sune) then `pll`, with his algs. */
function pllUse(pll: string, algs: Record<string, string>) {
  const moves = [...turns("R U R' U R U2 R'"), ...turns(pll)];
  const scramble = invertAlg(moves).map((m) => SWAP[m[0]!]! + m.slice(1)).join(" ");
  const timed: TimedMove[] = moves.map((move, i) => ({ move, t: i * 100 }));
  const analysis = analyzeSolve(scramble, timed, { method: "oll-pll" });
  const index = analysis.stages.findIndex((s) => s.kind === "pll");
  const stage = analysis.stages[index]!;
  const start = applyAlg(scrambledState(scramble), moves.slice(0, stage.startMove));
  const stageTurns = moves.slice(stage.startMove, stage.endMove);
  return algUse(stage, stageCase(stage, start), algs, stageTurns, stageTurns);
}

describe("algUse", () => {
  it("knows when he used his alg", () => {
    expect(pllUse(T_PERM, { "PLL-T": T_PERM })).toMatchObject({ caseId: "PLL-T", used: true, verdict: "best" });
  });

  it("offers a faster alg he did instead, without marking it down", () => {
    const slower = algOptions("PLL-T")
      .map((o) => o.alg)
      .filter((alg) => caseAlgSpeed("PLL-T", alg).ms > caseAlgSpeed("PLL-T", T_PERM).ms * 1.05)[0]!;
    expect(slower).toBeDefined();
    expect(pllUse(T_PERM, { "PLL-T": slower })).toMatchObject({ used: false, faster: true, switchable: true, verdict: "excellent" });
  });

  it("marks down a slower alg than his", () => {
    const slower = algOptions("PLL-T")
      .map((o) => o.alg)
      .filter((alg) => caseAlgSpeed("PLL-T", alg).ms > caseAlgSpeed("PLL-T", T_PERM).ms * 1.05)[0]!;
    const use = pllUse(slower, { "PLL-T": T_PERM });
    expect(use).toMatchObject({ used: false, faster: false });
    expect(["inaccuracy", "mistake"]).toContain(use!.verdict);
  });

  it("counts moves alike on both sides, so a slice alg isn't marked down for its slices", () => {
    // His Ua is the M-slice one; he did the RU one, which the model rates a little slower.
    const ua = "M2 U M U2 M' U M2";
    const moves = [...turns("R U R' U R U2 R'"), ...turns("R U R' U R' U' R2 U' R' U R' U R")];
    const scramble = invertAlg(moves).map((m) => SWAP[m[0]!]! + m.slice(1)).join(" ");
    const timed: TimedMove[] = moves.map((move, i) => ({ move, t: i * 100 }));
    const analysis = analyzeSolve(scramble, timed, { method: "oll-pll" });
    const stage = analysis.stages.find((s) => s.kind === "pll")!;
    const start = applyAlg(scrambledState(scramble), moves.slice(0, stage.startMove));
    const stageTurns = moves.slice(stage.startMove, stage.endMove);
    const use = algUse(stage, stageCase(stage, start), { "PLL-Ua": ua }, stageTurns, stageTurns);
    expect(use?.used).toBe(false);
    expect(use?.verdict).not.toBe("mistake");
  });

  it("switches under the id his alg is saved under", () => {
    expect(pllUse(T_PERM, { "PLL-T": T_PERM })?.storedId).toBe("PLL-T");
    expect(yourAlg("EPLL-Ua", { "PLL-Ua": "M2 U M U2 M' U M2" })?.id).toBe("PLL-Ua");
  });

  it("says nothing without an alg for the case", () => {
    expect(pllUse(T_PERM, {})).toBeNull();
  });

  it("shares U, H and Z perm picks between PLL and EPLL", () => {
    expect(yourAlg("EPLL-Ua", { "PLL-Ua": "M2 U M U2 M' U M2" })).toEqual({ id: "PLL-Ua", alg: "M2 U M U2 M' U M2" });
    expect(yourAlg("PLL-H", { "EPLL-H": "M2 U M2 U2 M2 U M2" })).toEqual({ id: "EPLL-H", alg: "M2 U M2 U2 M2 U M2" });
  });
});
