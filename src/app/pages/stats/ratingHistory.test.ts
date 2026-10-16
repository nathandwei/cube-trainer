import { describe, expect, it } from "vitest";
import { computeRatings, ratingHistory } from "@/app/lib/ratings";
import type { SolveRecord, Stage } from "@/cube/types";

function stage(kind: Stage["kind"], totalMs: number): Stage {
  return { kind, label: kind, startMove: 0, endMove: 1, recognitionMs: 0, executionMs: totalMs, totalMs, moveCount: 1, longestPauseMs: 0 };
}

function smart(id: string, cross: number, f2l: number, ll: number, createdAt: number): SolveRecord {
  const stages = [stage("cross", cross), stage("pair", f2l), stage("ll", ll)];
  const totalMs = cross + f2l + ll;
  return { id, scramble: "", moves: [], totalMs, penalty: "none", createdAt, source: "smartcube", analysis: { stages, totalMs, moveCount: 1, solved: true } };
}

function keyboard(id: string, totalMs: number, createdAt: number, extra: Partial<SolveRecord> = {}): SolveRecord {
  return { id, scramble: "", moves: [], totalMs, penalty: "none", createdAt, source: "keyboard", ...extra };
}

describe("ratingHistory", () => {
  const newestFirst = [
    keyboard("e", 14_000, 5),
    keyboard("v", 9000, 4, { source: "virtual" }),
    keyboard("d", 15_000, 3, { penalty: "dnf" }),
    smart("b", 1800, 8000, 5000, 2),
    smart("a", 2200, 9000, 6000, 1),
  ];

  it("keeps one step per rated solve, oldest first", () => {
    expect(ratingHistory(newestFirst).map((s) => s.id)).toEqual(["a", "b", "e"]);
  });

  it("ends where computeRatings ends", () => {
    const last = ratingHistory(newestFirst).at(-1);
    const ratings = computeRatings(newestFirst);
    expect(last?.rating).toEqual({ cross: ratings.cross?.rating, f2l: ratings.f2l?.rating, ll: ratings.ll?.rating });
  });

  it.each([1, 2, 3, 5])("matches computeRatings after the oldest %i solves", (count) => {
    const prefix = newestFirst.slice(newestFirst.length - count);
    const history = ratingHistory(prefix);
    const ratings = computeRatings(prefix);
    expect(history.at(-1)?.rating.f2l).toBe(ratings.f2l?.rating);
  });

  it("starts at the first solve's performance", () => {
    const [first] = ratingHistory(newestFirst);
    expect(first?.rating).toEqual(first?.performance);
  });
});
