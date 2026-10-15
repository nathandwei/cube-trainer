import { describe, expect, it } from "vitest";
import { averageOf, median, resultMs } from "./averages";

describe("averageOf", () => {
  it.each([
    { name: "ao5 drops best and worst", results: [10, 12, 14, 16, 30], n: 5, expected: 14 },
    { name: "too few solves", results: [10, 12], n: 5, expected: null },
    { name: "one DNF is trimmed", results: [10, 12, 14, 16, Infinity], n: 5, expected: 14 },
    { name: "two DNFs make a DNF", results: [10, 12, 14, Infinity, Infinity], n: 5, expected: Infinity },
    { name: "uses only the newest n", results: [10, 10, 10, 10, 10, 99, 99], n: 5, expected: 10 },
  ])("$name", ({ results, n, expected }) => {
    expect(averageOf(results, n)).toBe(expected);
  });

  it("trims 5 each side for ao100", () => {
    const results = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(averageOf(results, 100)).toBe(50.5);
  });
});

describe("resultMs", () => {
  it.each([
    { penalty: "none" as const, expected: 15000 },
    { penalty: "+2" as const, expected: 17000 },
    { penalty: "dnf" as const, expected: Infinity },
  ])("applies $penalty", ({ penalty, expected }) => {
    expect(resultMs({ totalMs: 15000, penalty })).toBe(expected);
  });
});

describe("median", () => {
  it.each([
    { values: [3, 1, 2], expected: 2 },
    { values: [4, 1, 3, 2], expected: 2.5 },
    { values: [], expected: null },
  ])("of $values", ({ values, expected }) => {
    expect(median(values)).toBe(expected);
  });
});
