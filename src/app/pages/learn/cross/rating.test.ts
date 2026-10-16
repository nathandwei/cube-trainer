import { describe, expect, it } from "vitest";
import type { CrossRep } from "@/shared/learn";
import { crossPerformance, crossRating, extraMoves, levelForMoves, movesForRating } from "./rating";

let counter = 0;

function rep(optimalMoves: number, moveCount: number, executionMs: number, extra: Partial<CrossRep> = {}): CrossRep {
  counter += 1;
  return {
    kind: "cross",
    id: `r${counter}`,
    createdAt: counter,
    item: "cross",
    scramble: "R U",
    optimalMoves,
    moveCount,
    inspectionMs: 5000,
    executionMs,
    ...extra,
  };
}

/** 300 ms a move: the pace that adds nothing. */
const neutral = (optimal: number, moves: number) => rep(optimal, moves, moves * 300);

describe("crossPerformance", () => {
  it.each([
    { name: "optimal at 6", r: neutral(6, 6), expected: 1600 },
    { name: "+1 at 7 equals optimal at 6", r: neutral(7, 8), expected: 1600 },
    { name: "+2 at 6", r: neutral(6, 8), expected: 1400 },
    { name: "+10 at 6 is far below +2", r: neutral(6, 16), expected: 600 },
    { name: "fewer moves than optimal counts as optimal", r: neutral(6, 5), expected: 1600 },
  ])("$name", ({ r, expected }) => {
    expect(crossPerformance(r)).toBeCloseTo(expected, 6);
  });

  it.each([
    { name: "twice the reference pace", ms: 900, bonus: 30 },
    { name: "half the reference pace", ms: 3600, bonus: -30 },
    { name: "very fast is capped", ms: 100, bonus: 45 },
    { name: "very slow is capped", ms: 60_000, bonus: -45 },
  ])("time moves it a little: $name", ({ ms, bonus }) => {
    expect(crossPerformance(rep(6, 6, ms))).toBeCloseTo(1600 + bonus, 6);
  });

  it("never lets time outweigh a move: the fastest +1 is below the slowest optimum", () => {
    expect(crossPerformance(rep(6, 7, 100))).toBeLessThan(crossPerformance(rep(6, 6, 60_000)));
  });
});

describe("scale", () => {
  it.each([
    [0, 1000],
    [6, 1600],
    [8, 1800],
  ])("%i moves is level %i", (moves, level) => {
    expect(levelForMoves(moves)).toBe(level);
    expect(movesForRating(level)).toBe(moves);
  });

  it.each([
    [6, 6, 0],
    [6, 9, 3],
    [6, 4, 0],
  ])("%i optimal, %i made: %i extra", (optimalMoves, moveCount, extra) => {
    expect(extraMoves({ optimalMoves, moveCount })).toBe(extra);
  });
});

describe("crossRating", () => {
  it("is null with no reps", () => {
    expect(crossRating([])).toBeNull();
  });

  it("starts at the first rep's performance", () => {
    expect(crossRating([neutral(5, 5)])).toEqual({ rating: 1500, delta: 0, reps: 1 });
  });

  it("moves fast at first and slowly later", () => {
    const early = crossRating([neutral(5, 5), neutral(7, 7)]);
    expect(early?.rating).toBeCloseTo(1600, 6);
    expect(early?.delta).toBeCloseTo(100, 6);
    const settled = Array.from({ length: 40 }, () => neutral(6, 6));
    const late = crossRating([...settled, neutral(8, 8)]);
    expect(late?.delta).toBeCloseTo(0.05 * 200, 6);
  });

  it("caps one wild rep's swing", () => {
    const settled = Array.from({ length: 40 }, () => neutral(6, 6));
    const late = crossRating([...settled, neutral(6, 30)]);
    expect(late?.delta).toBeCloseTo(-0.05 * 400, 6);
  });

  it("skips retries, which come after seeing the answer", () => {
    const rating = crossRating([neutral(5, 5), neutral(8, 8), { ...neutral(8, 8), retry: true }]);
    expect(rating?.reps).toBe(2);
  });
});
