import { describe, expect, it } from "vitest";
import { animatedTurn, reverseOf } from "./animation";

describe("animatedTurn", () => {
  it.each([
    ["U2", "U2"],
    ["U2'", "U2"],
    ["D2", "D2"],
    ["F2", "F2"],
    ["R2", "R2"],
    ["R2'", "R2"],
    ["B2", "B2'"],
    ["L2", "L2'"],
    ["M2", "M2'"],
    ["r2", "r2"],
    ["l2", "l2'"],
    ["Rw2", "Rw2"],
    ["x2", "x2"],
    ["R", "R"],
    ["U'", "U'"],
  ])("%s spins as %s", (move, expected) => {
    expect(animatedTurn(move)).toBe(expected);
  });
});

describe("reverseOf", () => {
  it.each([
    ["R", "R'"],
    ["R'", "R"],
    ["R2", "R2'"],
    ["B2'", "B2"],
    ["M2'", "M2"],
    ["y", "y'"],
  ])("%s reverses to %s", (move, expected) => {
    expect(reverseOf(move)).toBe(expected);
  });

  it("retraces an animated half turn", () => {
    expect(reverseOf(animatedTurn("L2"))).toBe("L2");
  });
});
