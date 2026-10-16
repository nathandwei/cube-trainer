import { describe, expect, it } from "vitest";
import { inspectionDisplay, inspectionPenalty } from "./inspection";

describe("inspectionPenalty", () => {
  it.each([
    [0, "none"],
    [14_999, "none"],
    [15_000, "none"],
    [15_001, "+2"],
    [17_000, "+2"],
    [17_001, "dnf"],
  ] as const)("%i ms → %s", (elapsed, penalty) => {
    expect(inspectionPenalty(elapsed)).toBe(penalty);
  });
});

describe("inspectionDisplay", () => {
  it.each([
    [0, "15", null],
    [400, "15", null],
    [1_000, "14", null],
    [7_999, "8", null],
    [8_000, "7", "8s"],
    [11_999, "4", "8s"],
    [12_000, "3", "12s"],
    [14_999, "1", "12s"],
    [15_000, "1", null],
    [15_500, "+2", null],
    [17_500, "DNF", null],
  ] as const)("%i ms shows %s with cue %s", (elapsed, text, cue) => {
    expect(inspectionDisplay(elapsed)).toEqual({ text, cue });
  });
});
