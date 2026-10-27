import { describe, expect, it } from "vitest";
import { FrameTracker, SOLVED, applyAlg, invertAlg, isGoalReached } from "@/cube";
import type { Rotation } from "@/cube/types";
import { caseDone, readCase, turnCase } from "./caseTurns";

const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'".split(" ");
/** The T perm case, as the screen shows it. */
const CASE = applyAlg(SOLVED, invertAlg(T_PERM));

/** He does `alg` on the case as he sees it, holding his cube `off` from how the screen shows it: what it reports. */
function reported(alg: readonly string[], off: readonly Rotation[]): string[] {
  const hand = new FrameTracker();
  for (const rotation of off) hand.rotate(rotation);
  return alg.flatMap((move) => hand.apply(move).turns);
}

describe("caseTurns", () => {
  it.each([[], ["y"], ["y2"], ["y'"]] as Rotation[][])("counts the case done with the gyro's heading off by %j", (...off) => {
    const turns = reported(T_PERM, off);
    expect(caseDone("PLL", turnCase(readCase(CASE), turns))).toBe(true);
  });

  it("would not with the heading taken at its word", () => {
    expect(isGoalReached("PLL", applyAlg(CASE, reported(T_PERM, ["y"])))).toBe(false);
  });

  it("doesn't count a case left undone", () => {
    expect(caseDone("PLL", turnCase(readCase(CASE), reported(T_PERM.slice(0, -1), ["y"])))).toBe(false);
  });
});
