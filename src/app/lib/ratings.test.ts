import { describe, expect, it } from "vitest";
import type { SolveRecord, Stage } from "@/cube/types";
import { computeRatings, lookaheadPerformance, msForRating, partPerformance, partTimes, ratingForMs } from "./ratings";

function stage(kind: Stage["kind"], totalMs: number, slots?: Stage["slots"]): Stage {
  return { kind, label: kind, startMove: 0, endMove: 1, recognitionMs: 0, executionMs: totalMs, totalMs, moveCount: 1, longestPauseMs: 0, slots };
}

function solve(id: string, stages: Stage[], source: SolveRecord["source"] = "smartcube"): SolveRecord {
  const totalMs = stages.reduce((sum, s) => sum + s.totalMs, 0);
  return { id, scramble: "", moves: [], totalMs, penalty: "none", createdAt: 0, source, analysis: { stages, totalMs, moveCount: 1, solved: true } };
}

describe("scale", () => {
  it.each([
    [30_000, 1000],
    [27_000, 1100],
    [18_000, 1485],
    [15_000, 1658],
    [12_000, 1870],
  ])("%i ms is about %i", (ms, rating) => {
    expect(Math.round(ratingForMs(ms))).toBe(rating);
  });

  it("round-trips", () => {
    expect(msForRating(ratingForMs(14_870))).toBeCloseTo(14_870, 6);
  });
});

describe("partTimes", () => {
  it("splits an xcross between cross and F2L", () => {
    const times = partTimes([stage("xcross", 2650, ["FR"]), stage("pair", 2000), stage("eo", 1000), stage("coll", 2000)]);
    expect(times.cross + times.f2l).toBeCloseTo(4650);
    expect(times.cross).toBeCloseTo(2650 * (0.135 / (0.135 + 0.13)));
    expect(times.ll).toBe(3000);
  });
});

describe("computeRatings", () => {
  const typical15 = [stage("cross", 15_000 * 0.135), stage("pair", 15_000 * 0.52), stage("ll", 15_000 * 0.345)];

  it.each(["virtual", "demo", "keyboard"] as const)("ignores %s solves", (source) => {
    expect(computeRatings([solve("a", typical15, source)])).toEqual({ cross: null, f2l: null, ll: null, lookahead: null });
  });

  it("skips a DNF", () => {
    const dnf: SolveRecord = { ...solve("d", typical15), penalty: "dnf" };
    expect(computeRatings([dnf])).toEqual({ cross: null, f2l: null, ll: null, lookahead: null });
  });

  it("starts at the first solve's performance", () => {
    const ratings = computeRatings([solve("a", typical15)]);
    expect(Math.round(ratings.f2l?.rating ?? 0)).toBe(1658);
    expect(ratings.f2l?.delta).toBe(0);
  });

  it("moves less once it has settled", () => {
    const history = Array.from({ length: 60 }, (_, i) => solve(`s${i}`, typical15));
    const fast = [stage("cross", 1500), stage("pair", 6000), stage("ll", 4000)];
    const early = computeRatings([solve("new", fast), solve("old", typical15)]);
    const late = computeRatings([solve("new", fast), ...history]);
    expect(early.f2l!.delta).toBeGreaterThan(late.f2l!.delta);
    expect(late.f2l!.delta).toBeGreaterThan(0);
  });

  it("caps how far one solve can swing a settled rating", () => {
    const history = Array.from({ length: 60 }, (_, i) => solve(`s${i}`, typical15));
    const disaster = [stage("cross", 20_000), stage("pair", 60_000), stage("ll", 30_000)];
    const ratings = computeRatings([solve("bad", disaster), ...history]);
    expect(ratings.f2l!.delta).toBeGreaterThanOrEqual(-400 * 0.04 - 1e-9);
  });

  it("reads performance as the overall time a part is typical of", () => {
    expect(Math.round(partPerformance("cross", 1920))).toBe(Math.round(ratingForMs(1920 / 0.135)));
  });
});

describe("lookahead", () => {
  const typical15 = [stage("cross", 15_000 * 0.135), stage("pair", 15_000 * 0.52), stage("ll", 15_000 * 0.345)];
  const timed = (gaps: number[]): SolveRecord["moves"] => {
    let t = 0;
    return gaps.map((gap) => ({ move: "R", t: (t += gap) }));
  };

  it("rates like the solve speed when pauses are 30% of the solve", () => {
    // 15 s with 4.5 s of pauses (30%) rates like a 15 s solver.
    const moves = timed([...Array(9).fill(500), ...Array(100).fill(105)]);
    const record: SolveRecord = { ...solve("a", typical15), moves };
    expect(Math.round(lookaheadPerformance(record) ?? 0)).toBe(Math.round(ratingForMs(4500 / 0.3)));
  });

  it.each([
    { pausesMs: 2000, better: true },
    { pausesMs: 9000, better: false },
  ])("fewer pauses rate higher ($pausesMs ms)", ({ pausesMs, better }) => {
    const moves = timed([pausesMs, ...Array(80).fill(120)]);
    const performance = lookaheadPerformance({ ...solve("a", typical15), moves }) ?? 0;
    expect(performance > ratingForMs(15_000)).toBe(better);
  });

  it("is capped for a solve with no pauses at all", () => {
    const moves = timed(Array(80).fill(120));
    expect(Number.isFinite(lookaheadPerformance({ ...solve("a", typical15), moves }))).toBe(true);
  });

  it.each(["demo", "keyboard", "virtual"] as const)("doesn't rate %s solves", (source) => {
    expect(lookaheadPerformance(solve("a", typical15, source))).toBeNull();
  });
});
