import { describe, expect, it } from "vitest";
import { animatedTurn, reverseOf, TurnAnimator } from "./animation";

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

describe("TurnAnimator", () => {
  it.each([
    [["R2", "R2"], ["R2", "R2'"]],
    [["L2", "L2"], ["L2'", "L2"]],
    [["R", "R2"], ["R", "R2'"]],
    [["R'", "R2"], ["R'", "R2"]],
    [["R2", "U", "R2", "U'", "R2"], ["R2", "U", "R2'", "U'", "R2"]],
    [["R2", "L2", "R2", "L2"], ["R2", "L2'", "R2'", "L2"]],
    [["r2", "R2"], ["r2", "R2'"]],
    [["U2", "U2"], ["U2", "U2"]],
    [["B2", "M2"], ["B2'", "M2'"]],
  ])("%j spins as %j", (moves, expected) => {
    const animator = new TurnAnimator();
    expect(moves.map((move) => animator.play(move))).toEqual(expected);
  });

  it("undoes in reverse, putting the hand back", () => {
    const animator = new TurnAnimator();
    animator.play("R2");
    animator.play("R2");
    expect(animator.undo()).toBe("R2");
    expect(animator.undo()).toBe("R2'");
    expect(animator.play("R2")).toBe("R2");
  });

  it("forgets the hands on reset", () => {
    const animator = new TurnAnimator();
    animator.play("R2");
    animator.reset();
    expect(animator.play("R2")).toBe("R2");
    expect(animator.undo()).toBe("R2'");
    expect(animator.undo()).toBeUndefined();
  });
});
