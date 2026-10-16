import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, getCase, invertAlg, toFaceTurns } from "@/cube";
import type { Slot, Stage } from "@/cube/types";
import { pairCase, stageCase } from "./cases";

const ROTATION: Record<Slot, string> = { FR: "", FL: "y'", BL: "y2", BR: "y" };

/** The state an alg solves, seen from the angle that puts `slot` at front right, after a U turn. */
function caseFor(caseId: string, slot: Slot, auf = "", from = SOLVED) {
  const turns = toFaceTurns([ROTATION[slot], auf, getCase(caseId).algs[0]].filter(Boolean).join(" "));
  return applyAlg(from, invertAlg(turns));
}

function stage(overrides: Partial<Stage>): Stage {
  return {
    kind: "pair",
    label: "p1",
    startMove: 0,
    endMove: 8,
    recognitionMs: 300,
    executionMs: 1000,
    totalMs: 1300,
    moveCount: 8,
    longestPauseMs: 0,
    ...overrides,
  };
}

describe("pairCase", () => {
  const slots: Slot[] = ["FR", "FL", "BL", "BR"];
  it.each(slots.flatMap((slot) => ["F2L-1", "F2L-12", "F2L-25", "F2L-37"].flatMap((caseId) => ["", "U", "U2"].map((auf) => ({ slot, caseId, auf })))))(
    "$caseId in $slot after '$auf'",
    ({ slot, caseId, auf }) => {
      expect(pairCase(caseFor(caseId, slot, auf), slot)).toBe(caseId);
    },
  );

  it("ignores what the other slots hold", () => {
    const brokenNeighbour = applyAlg(SOLVED, "L' U' L B U B'");
    expect(pairCase(caseFor("F2L-12", "FR", "", brokenNeighbour), "FR")).toBe("F2L-12");
  });

  it.each([
    { name: "a solved pair", state: SOLVED },
    { name: "a broken cross", state: applyAlg(SOLVED, "R U R' F") },
  ])("has none for $name", ({ state }) => {
    expect(pairCase(state, "FR")).toBeNull();
  });

  it("has none when the pair's corner sits in another slot", () => {
    // R U R' lifts the front-right pair; L' U' L drops its corner into the front-left slot.
    const state = applyAlg(SOLVED, "R U R' L' U' L");
    expect(pairCase(state, "FR")).toBeNull();
  });
});

describe("stageCase", () => {
  it.each([
    { kind: "coll", id: "COLL-T3" },
    { kind: "epll", id: "EPLL-Ua" },
    { kind: "eo", id: "EO-line" },
    { kind: "pll", id: "PLL-Ga" },
  ] as const)("recognises $id at a $kind stage's start", ({ kind, id }) => {
    const start = applyAlg(SOLVED, invertAlg(toFaceTurns(getCase(id).algs[0] ?? "")));
    expect(stageCase(stage({ kind }), start)).toBe(id);
  });

  it("names a one-pair stage's case and leaves a multislot unnamed", () => {
    const start = caseFor("F2L-12", "BL");
    expect(stageCase(stage({ slots: ["BL"] }), start)).toBe("F2L-12");
    expect(stageCase(stage({ slots: ["BL", "FR"] }), start)).toBeNull();
  });

  it("has none for the cross", () => {
    expect(stageCase(stage({ kind: "cross" }), SOLVED)).toBeNull();
  });
});
