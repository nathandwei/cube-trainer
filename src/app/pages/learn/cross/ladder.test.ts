import { describe, expect, it } from "vitest";
import { createRng } from "@/cube";
import { chooseLength, comfortableLength, LADDER } from "./ladder";

describe("comfortableLength", () => {
  it.each([
    { variant: "cross", rating: null, length: 5 },
    { variant: "xcross", rating: null, length: 7 },
    { variant: "cross", rating: 1600, length: 6 },
    { variant: "cross", rating: 1649, length: 6 },
    { variant: "cross", rating: 1651, length: 7 },
    { variant: "cross", rating: 900, length: 3 },
    { variant: "cross", rating: 2400, length: 8 },
    { variant: "xcross", rating: 2400, length: 9 },
    { variant: "xcross", rating: 1200, length: 4 },
  ] as const)("$variant at $rating: $length", ({ variant, rating, length }) => {
    expect(comfortableLength(rating, variant)).toBe(length);
  });
});

describe("chooseLength", () => {
  it.each([
    { roll: 0.1, length: 5 },
    { roll: 0.3, length: 7 },
    { roll: 0.5, length: 6 },
    { roll: 0.99, length: 6 },
  ])("roll $roll at 1600: $length", ({ roll, length }) => {
    expect(chooseLength(1600, "cross", () => roll)).toBe(length);
  });

  it.each([
    { variant: "cross", rating: 2400, roll: 0.3, length: 8 },
    { variant: "cross", rating: 800, roll: 0.1, length: 3 },
  ] as const)("stays on the ladder: $variant at $rating", ({ variant, rating, roll, length }) => {
    expect(chooseLength(rating, variant, () => roll)).toBe(length);
  });

  it("is mostly the comfortable length and sometimes one either side", () => {
    const rng = createRng(7);
    const counts = new Map<number, number>();
    for (let i = 0; i < 2000; i++) {
      const length = chooseLength(1600, "cross", rng);
      counts.set(length, (counts.get(length) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([5, 6, 7]);
    expect(counts.get(6)! / 2000).toBeGreaterThan(0.5);
    expect(counts.get(5)! / 2000).toBeGreaterThan(0.12);
    expect(counts.get(7)! / 2000).toBeGreaterThan(0.12);
  });

  it.each(["cross", "xcross"] as const)("never leaves the %s ladder", (variant) => {
    const rng = createRng(11);
    for (const rating of [null, 0, 1000, 1500, 2000, 5000]) {
      for (let i = 0; i < 50; i++) {
        const length = chooseLength(rating, variant, rng);
        expect(length).toBeGreaterThanOrEqual(LADDER[variant].min);
        expect(length).toBeLessThanOrEqual(LADDER[variant].max);
      }
    }
  });
});
