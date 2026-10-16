import { describe, expect, it } from "vitest";
import { displayTokens } from "@/app/lib/display";
import { createRng, isSolved, applyAlg, scrambledState } from "@/cube";
import type { TimedMove } from "@/cube/types";
import { findPauses } from "./pauses";
import { paceToBeat, retimeRotations, simulateSolve } from "./simulate";

const SCRAMBLE = "R' U2 F2 L2 D' F2 U L2 D2 B2 U' R B' D' F' R2 U' L' F R";

function steady(count: number): TimedMove[] {
  return Array.from({ length: count }, (_, i) => ({ move: i % 2 ? "R" : "U", t: i * 120 }));
}

describe("paceToBeat", () => {
  it.each([
    { bpm: 60, pauses: 0 },
    { bpm: 60, pauses: 2 },
    { bpm: 90, pauses: 3 },
    { bpm: 120, pauses: 1 },
  ])("$bpm bpm with $pauses pauses: exactly that many pauses", ({ bpm, pauses }) => {
    const paced = paceToBeat(steady(40), bpm, pauses, createRng(bpm + pauses));
    expect(findPauses(paced.map((m) => m.t), bpm)).toHaveLength(pauses);
    expect(paced[0]?.t).toBe(0);
    expect(paced.map((m) => m.move)).toEqual(steady(40).map((m) => m.move));
  });

  it("keeps the two turns of a slice together", () => {
    const moves: TimedMove[] = [...steady(10), { move: "L'", t: 1100 }, ...steady(10).map((m) => ({ ...m, t: m.t + 1400 }))];
    const paced = paceToBeat(moves, 60, 0, createRng(1));
    expect(paced[10]!.t - paced[9]!.t).toBe(20);
  });
});

describe("simulateSolve", () => {
  it("solves the cube at the beat with the pauses asked for", () => {
    const { moves } = simulateSolve(SCRAMBLE, 72, 2, createRng(5));
    expect(isSolved(applyAlg(scrambledState(SCRAMBLE), moves.map((m) => m.move)))).toBe(true);
    expect(findPauses(moves.map((m) => m.t), 72)).toHaveLength(2);
  });

  it("keeps the solver's rotations, each between the turns it came between", () => {
    const { moves, rotations } = simulateSolve(SCRAMBLE, 72, 2, createRng(5));
    expect(rotations.length).toBeGreaterThan(0);
    for (const { after, t } of rotations) {
      expect(t).toBeGreaterThanOrEqual(moves[after - 1]?.t ?? 0);
      expect(t).toBeLessThanOrEqual(moves[after]?.t ?? Infinity);
    }
  });
});

describe("retimeRotations", () => {
  const original: TimedMove[] = [
    { move: "R", t: 0 },
    { move: "U", t: 300 },
  ];
  const paced: TimedMove[] = [
    { move: "R", t: 0 },
    { move: "U", t: 1000 },
  ];
  it.each([
    { after: 0, t: 0, expected: 0 },
    { after: 1, t: 150, expected: 500 },
    { after: 1, t: 30, expected: 30 },
    { after: 2, t: 450, expected: 1001 },
    { after: 2, t: 320, expected: 1020 },
  ])("a rotation after turn $after at $t ms lands at $expected ms", ({ after, t, expected }) => {
    expect(retimeRotations([{ rotation: "y", after, t }], original, paced)[0]?.t).toBe(expected);
  });

  it("keeps slices and wide moves whole in the test playback", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const solve = simulateSolve(SCRAMBLE, 60, 2, createRng(seed));
      const text = displayTokens(solve, undefined).map((token) => token.text).join(" ");
      expect(text).not.toMatch(/R2 L2 x2|L2 R2 x2/);
    }
  });
});
