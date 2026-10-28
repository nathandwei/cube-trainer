import { describe, expect, it } from "vitest";
import { FrameTracker, SOLVED, applyAlg, invertAlg } from "@/cube";
import type { Rotation } from "@/cube/types";
import { caseOutcome, readCase, turnCase } from "./caseTurns";

const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'".split(" ");
/** The T perm case, as the screen shows it. */
const CASE = applyAlg(SOLVED, invertAlg(T_PERM));

const E_PERM = "R' U' R' D' R U' R' D R U R' D' R U R' D R2";
/** An E perm that needs a U before the alg: the angle it's easy to get wrong. */
const E_CASE = applyAlg(SOLVED, [...invertAlg(E_PERM), "U'"]);

/** He does `alg` on the case as he sees it, holding his cube `off` from how the screen shows it: what it reports. */
function reported(alg: readonly string[], off: readonly Rotation[]): string[] {
  const hand = new FrameTracker();
  for (const rotation of off) hand.rotate(rotation);
  return alg.flatMap((move) => hand.apply(move).turns);
}

describe("caseOutcome", () => {
  it("counts the case solved when his turns solve it as shown", () => {
    expect(caseOutcome("PLL", turnCase(readCase(CASE), reported(T_PERM, [])))).toBe("solved");
  });

  it.each([["y"], ["y2"], ["y'"]] as Rotation[][])("calls the alg done %j off the case as shown the wrong side", (...off) => {
    expect(caseOutcome("PLL", turnCase(readCase(CASE), reported(T_PERM, off)))).toBe("wrong side");
  });

  it("doesn't count a case left undone", () => {
    expect(caseOutcome("PLL", turnCase(readCase(CASE), reported(T_PERM.slice(0, -1), [])))).toBeNull();
  });

  it.each([
    { what: "with its U first", turns: `U ${E_PERM}`, outcome: "solved" },
    // What his cube reported for a rep that used to pass: the alg, with a slip undone, but no U.
    { what: "without its U", turns: "R' U' R' D' R U R' R U' U' R' D R U R' D' R U R' D R R", outcome: "wrong side" },
  ])("grades an E perm done $what as $outcome", ({ turns, outcome }) => {
    expect(caseOutcome("PLL", turnCase(readCase(E_CASE), turns.split(" ")))).toBe(outcome);
  });
});
