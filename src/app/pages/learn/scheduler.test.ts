import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import type { CaseRep, LearnSettings } from "@/shared/learn";
import { DEFAULT_LEARN_SETTINGS } from "@/shared/learn";
import { buildCards, gradeRep, pickSession, spreadRepeats } from "./scheduler";

const DAY = 86_400_000;

function rep(item: string, createdAt: number, ms: number, correct = true): CaseRep {
  return { kind: "case", id: `${item}-${createdAt}`, createdAt, item, auf: "", recognitionMs: 0, executionMs: ms, moves: [], correct, source: "virtual" };
}

describe("gradeRep", () => {
  it.each([
    { name: "wrong", r: rep("PLL-Ua", 0, 1000, false), grade: Rating.Again },
    { name: "slow but correct is a miss", r: rep("PLL-Ua", 0, 3000), grade: Rating.Again },
    { name: "on target", r: rep("PLL-Ua", 0, 2000), grade: Rating.Good },
    { name: "fast", r: rep("PLL-Ua", 0, 1000), grade: Rating.Easy },
  ])("$name", ({ r, grade }) => {
    expect(gradeRep(r, 2500)).toBe(grade);
  });
});

describe("buildCards", () => {
  it("counts only the first rep of a day toward spacing", () => {
    const sameDay = buildCards([rep("PLL-Ua", 0, 1500), rep("PLL-Ua", 1000, 1500), rep("PLL-Ua", 2000, 1500)]);
    const once = buildCards([rep("PLL-Ua", 0, 1500)]);
    expect(sameDay.get("PLL-Ua")?.reps).toBe(once.get("PLL-Ua")?.reps);
  });

  it("spaces a case further after fast reps on separate days", () => {
    const cards = buildCards([rep("PLL-Ua", 0, 1200), rep("PLL-Ua", 2 * DAY, 1200), rep("PLL-Ua", 6 * DAY, 1200)]);
    const card = cards.get("PLL-Ua");
    expect(card && card.due.getTime() - 6 * DAY).toBeGreaterThan(2 * DAY);
  });
});

describe("pickSession", () => {
  const settings: LearnSettings = { ...DEFAULT_LEARN_SETTINGS, items: ["EPLL"], algs: { "EPLL-Ua": "R U' R U R U R U' R' U' R2" } };

  it("puts overdue cases first, then new ones, repeated but never back to back", () => {
    const session = pickSession(settings, [rep("EPLL-Ua", 0, 1500)], 30 * DAY, { size: 20, newMax: 2 });
    expect(session[0]).toBe("EPLL-Ua");
    expect(session.filter((id) => id !== "EPLL-Ua")).toHaveLength(6);
    for (let i = 1; i < session.length; i++) expect(session[i]).not.toBe(session[i - 1]);
  });

  it("drills only the requested cases for a custom session", () => {
    const session = pickSession(settings, [], 0, { only: ["EPLL-Ua"], size: 5 });
    expect(new Set(session)).toEqual(new Set(["EPLL-Ua"]));
  });
});

describe("spreadRepeats", () => {
  it.each([
    [["a", "a", "b", "b"], ["a", "b", "a", "b"]],
    [["a", "b"], ["a", "b"]],
  ])("%j becomes %j", (input, expected) => {
    expect(spreadRepeats(input)).toEqual(expected);
  });
});
