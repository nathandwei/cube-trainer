import { describe, expect, it } from "vitest";
import { createRng } from "@/cube";
import type { CrossRep } from "@/shared/learn";
import { comfortableLength, LADDER, lengthAround } from "./ladder";

function rep(optimalMoves: number, moveCount: number, extra: Partial<CrossRep> = {}): CrossRep {
  return { kind: "cross", id: "r", createdAt: 0, item: "cross", scramble: "", optimalMoves, moveCount, inspectionMs: 0, executionMs: 1000, ...extra };
}

describe("comfortableLength", () => {
  it.each([
    { variant: "cross", reps: [], length: 5 },
    { variant: "xcross", reps: [], length: 7 },
    { variant: "cross", reps: [rep(5, 5), rep(5, 6)], length: 6 },
    { variant: "cross", reps: [rep(5, 9), rep(5, 9)], length: 4 },
    { variant: "cross", reps: [rep(5, 7)], length: 5 },
    { variant: "cross", reps: Array.from({ length: 40 }, () => rep(6, 6)), length: LADDER.cross.max },
    { variant: "cross", reps: Array.from({ length: 40 }, () => rep(6, 12)), length: LADDER.cross.min },
  ] as const)("$variant after $reps.length attempts: $length", ({ variant, reps, length }) => {
    expect(comfortableLength(reps, variant)).toBe(length);
  });

  it.each([{ retry: true }, { test: true }])("ignores %j attempts", (flags) => {
    expect(comfortableLength([rep(5, 5, flags), rep(5, 5, flags), rep(5, 5, flags)], "cross")).toBe(5);
  });

  it("comes back down quickly after a run of misses", () => {
    const climbed = Array.from({ length: 20 }, () => rep(6, 6));
    const missed = Array.from({ length: 4 }, () => rep(8, 12));
    expect(comfortableLength([...climbed, ...missed], "cross")).toBeLessThan(comfortableLength(climbed, "cross"));
  });
});

describe("lengthAround", () => {
  it.each([
    { roll: 0.1, length: 5 },
    { roll: 0.3, length: 7 },
    { roll: 0.5, length: 6 },
    { roll: 0.99, length: 6 },
  ])("roll $roll around 6: $length", ({ roll, length }) => {
    expect(lengthAround(6, "cross", () => roll)).toBe(length);
  });

  it("is mostly the comfortable length and sometimes one either side", () => {
    const rng = createRng(7);
    const counts = new Map<number, number>();
    for (let i = 0; i < 2000; i++) {
      const length = lengthAround(6, "cross", rng);
      counts.set(length, (counts.get(length) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([5, 6, 7]);
    expect(counts.get(6)! / 2000).toBeGreaterThan(0.5);
  });

  it.each(["cross", "xcross"] as const)("never leaves the %s ladder", (variant) => {
    const rng = createRng(11);
    for (const comfortable of [LADDER[variant].min, LADDER[variant].max]) {
      for (let i = 0; i < 50; i++) {
        const length = lengthAround(comfortable, variant, rng);
        expect(length).toBeGreaterThanOrEqual(LADDER[variant].min);
        expect(length).toBeLessThanOrEqual(LADDER[variant].max);
      }
    }
  });
});
