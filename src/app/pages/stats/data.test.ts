import { describe, expect, it } from "vitest";
import { averageOf } from "@/app/lib/averages";
import type { RatingStep } from "@/app/lib/ratings";
import type { SolveRecord, Stage } from "@/cube/types";
import {
  bests,
  binWidth,
  calendar,
  calendarLevel,
  chartSolves,
  histogram,
  lastAtOrBefore,
  metricValue,
  nearestIndex,
  rangeStart,
  ratingSeries,
  rollingAverage,
  rollingQuantiles,
  runningBest,
  splitsOf,
  trend,
  type ChartSolve,
} from "./data";

function stage(kind: Stage["kind"], totalMs: number): Stage {
  return { kind, label: kind, startMove: 0, endMove: 1, recognitionMs: 0, executionMs: totalMs, totalMs, moveCount: 1, longestPauseMs: 0 };
}

function record(id: string, totalMs: number, extra: Partial<SolveRecord> = {}): SolveRecord {
  return { id, scramble: "", moves: [], totalMs, penalty: "none", createdAt: 0, source: "keyboard", ...extra };
}

function analysed(id: string, stages: Stage[], extra: Partial<SolveRecord> = {}): SolveRecord {
  const totalMs = stages.reduce((sum, s) => sum + s.totalMs, 0);
  return record(id, totalMs, { source: "smartcube", analysis: { stages, totalMs, moveCount: 1, solved: true }, ...extra });
}

/** A deterministic stream of plausible results with a DNF now and then. */
function results(count: number, seed = 7): number[] {
  let state = seed;
  return Array.from({ length: count }, () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state % 37 === 0 ? Infinity : 12_000 + (state % 9000);
  });
}

describe("rollingAverage", () => {
  it.each([5, 12, 100])("matches averageOf after every result for ao%i", (size) => {
    const values = results(400);
    const rolling = rollingAverage(values, size);
    values.forEach((_, i) => {
      const newestFirst = values.slice(0, i + 1).reverse();
      expect(rolling[i]).toBe(averageOf(newestFirst, size));
    });
  });

  it.each([
    { name: "too few", values: [10, 12], size: 5, expected: [null, null] },
    { name: "drops best and worst", values: [10, 12, 14, 16, 30], size: 5, expected: [null, null, null, null, 14] },
    { name: "one DNF is trimmed", values: [10, 12, 14, 16, Infinity], size: 5, expected: [null, null, null, null, 14] },
    { name: "two DNFs make a DNF", values: [10, Infinity, 14, 16, Infinity], size: 5, expected: [null, null, null, null, Infinity] },
    { name: "slides", values: [10, 12, 14, 16, 30, 100, 20], size: 5, expected: [null, null, null, null, 14, 20, 22] },
  ])("$name", ({ values, size, expected }) => {
    expect(rollingAverage(values, size)).toEqual(expected);
  });
});

describe("runningBest", () => {
  it.each([
    { values: [15, 14, 16, 12, 13], expected: [15, 14, 14, 12, 12] },
    { values: [Infinity, 15, Infinity, 14], expected: [Infinity, 15, 15, 14] },
    { values: [], expected: [] },
  ])("$values", ({ values, expected }) => {
    expect(runningBest(values)).toEqual(expected);
  });
});

describe("rollingQuantiles", () => {
  it("reads quartiles of the last window, using what there is at the start", () => {
    const out = rollingQuantiles([4, 1, 3, 2, 10], 4, [0, 1]);
    expect(out).toEqual([
      [4, 4],
      [1, 4],
      [1, 4],
      [1, 4],
      [1, 10],
    ]);
  });
});

describe("bests", () => {
  it("finds each best and where its window ends", () => {
    const values = [20, 18, 11, 19, 17, 16, 15, 30, 14, 15, 16, 17];
    const found = bests(values);
    expect(found.single).toEqual({ value: 11, end: 2 });
    // 15.33 first appears ending at index 9; a later tie does not replace it.
    expect(found.ao5?.end).toBe(9);
    expect(found.ao5?.value).toBeCloseTo((15 + 15 + 16) / 3);
    expect(found.ao12).toEqual({ value: averageOf([...values].reverse(), 12), end: 11 });
    expect(found.ao100).toBeNull();
  });

  it("ignores DNFs and averages that are DNF", () => {
    expect(bests([Infinity, Infinity, 10, 10, 10]).ao5).toBeNull();
    expect(bests([Infinity]).single).toBeNull();
  });
});

describe("chartSolves", () => {
  const solves = [
    record("v", 9000, { source: "virtual", createdAt: 4 }),
    record("d", 8000, { source: "demo", createdAt: 3 }),
    record("p", 15_000, { penalty: "+2", createdAt: 2 }),
    record("k", 14_000, { createdAt: 1 }),
  ];

  it("keeps real solves oldest first, numbered, with penalties applied", () => {
    expect(chartSolves(solves, false).map((s) => [s.id, s.n, s.result])).toEqual([
      ["k", 0, 14_000],
      ["p", 1, 17_000],
    ]);
  });

  it("keeps virtual solves on their own", () => {
    expect(chartSolves(solves, true).map((s) => s.id)).toEqual(["v"]);
  });
});

describe("splitsOf", () => {
  it("reads cross (or xcross), pairs and last layer like the split chips", () => {
    const solve = analysed("a", [stage("xcross", 2500), stage("pair", 2000), stage("pair", 1800), stage("eo", 900), stage("coll", 1700), stage("epll", 1400)]);
    expect(splitsOf(solve)).toEqual({ cross: 2500, f2l: 3800, ll: 4000 });
  });

  it.each([
    { name: "keyboard solve", solve: record("k", 15_000) },
    { name: "DNF", solve: analysed("d", [stage("cross", 2000)], { penalty: "dnf" }) },
    { name: "unsolved analysis", solve: { ...analysed("u", [stage("cross", 2000)]), analysis: { stages: [stage("cross", 2000)], totalMs: 2000, moveCount: 1, solved: false } } },
  ])("has none for a $name", ({ solve }) => {
    expect(splitsOf(solve)).toBeNull();
  });
});

describe("metricValue", () => {
  const solve: ChartSolve = { id: "a", n: 0, t: 0, result: 15_000, splits: { cross: 2000, f2l: 7000, ll: 6000 } };
  it.each([
    { parts: [] as const, expected: 15_000 },
    { parts: ["cross"] as const, expected: 2000 },
    { parts: ["f2l", "ll"] as const, expected: 13_000 },
  ])("$parts", ({ parts, expected }) => {
    expect(metricValue(solve, parts)).toBe(expected);
  });

  it("has no split value without an analysis", () => {
    expect(metricValue({ ...solve, splits: null }, ["cross"])).toBeNull();
  });
});

describe("trend", () => {
  it("plots a split only for analysed solves, keeping their solve numbers", () => {
    const solves = chartSolves(
      [
        analysed("c", [stage("cross", 1500), stage("pair", 6000), stage("ll", 5000)], { createdAt: 3 }),
        record("b", 14_000, { createdAt: 2 }),
        analysed("a", [stage("cross", 2500), stage("pair", 7000), stage("ll", 6000)], { createdAt: 1 }),
      ],
      false,
    );
    const crosses = trend(solves, ["cross"]);
    expect(crosses.points.map((p) => [p.n, p.value])).toEqual([
      [0, 2500],
      [2, 1500],
    ]);
    expect(crosses.pb).toEqual([2500, 1500]);
    expect(trend(solves, []).points).toHaveLength(3);
  });
});

describe("rangeStart", () => {
  it.each([
    { range: "7d" as const, expected: 1_000_000_000 - 7 * 86_400_000 },
    { range: "30d" as const, expected: 1_000_000_000 - 30 * 86_400_000 },
    { range: "all" as const, expected: -Infinity },
  ])("$range", ({ range, expected }) => {
    expect(rangeStart(range, 1_000_000_000)).toBe(expected);
  });
});

describe("histogram", () => {
  it("counts whole-second rows from the fastest time, leaving DNFs out", () => {
    const bins = histogram([13_400, 13_900, 14_100, 16_000, Infinity], 1000);
    expect(bins.map((b) => [b.from, b.count])).toEqual([
      [13_000, 2],
      [14_000, 1],
      [15_000, 0],
      [16_000, 1],
    ]);
  });

  it("folds anything past the 99th percentile into an open last row", () => {
    const values = [...Array.from({ length: 199 }, (_, i) => 14_000 + (i % 3) * 1000), 60_000];
    const bins = histogram(values, 1000);
    const last = bins[bins.length - 1];
    expect(bins).toHaveLength(3);
    expect(last).toMatchObject({ from: 16_000, open: true });
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(200);
  });

  it("caps the number of rows", () => {
    const values = Array.from({ length: 100 }, (_, i) => 10_000 + i * 1000);
    const bins = histogram(values, 1000, 5);
    expect(bins).toHaveLength(5);
    expect(bins[4]?.open).toBe(true);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(100);
  });

  it("is empty without times", () => {
    expect(histogram([Infinity], 1000)).toEqual([]);
  });
});

describe("binWidth", () => {
  it.each([
    { name: "solve times", values: [13_000, 15_500, 21_000], expected: 1000 },
    { name: "cross splits", values: [1200, 2400, 4200], expected: 500 },
    { name: "slow solves", values: [40_000, 70_000, 95_000], expected: 5000 },
    { name: "nothing", values: [], expected: 1000 },
  ])("$name", ({ values, expected }) => {
    expect(binWidth(values)).toBe(expected);
  });
});

describe("calendar", () => {
  // Thursday 15 October 2026, local time.
  const now = new Date(2026, 9, 15, 18, 30).getTime();

  it("lays out Sunday-first weeks ending today", () => {
    const columns = calendar([], now, 26);
    expect(columns).toHaveLength(26);
    expect(columns.slice(0, 25).every((week) => week.length === 7)).toBe(true);
    expect(columns[25]).toHaveLength(5);
    expect(new Date(columns[0]?.[0]?.start ?? 0)).toEqual(new Date(2026, 3, 19));
    expect(new Date(columns[25]?.[4]?.start ?? 0)).toEqual(new Date(2026, 9, 15));
  });

  it("counts solves by local day and ignores ones outside the weeks", () => {
    const stamps = [
      new Date(2026, 9, 15, 0, 5).getTime(),
      new Date(2026, 9, 15, 23, 55).getTime(),
      new Date(2026, 9, 14, 23, 59).getTime(),
      new Date(2025, 0, 1).getTime(),
    ];
    const days = calendar(stamps, now, 26).flat();
    expect(days.at(-1)?.count).toBe(2);
    expect(days.at(-2)?.count).toBe(1);
    expect(days.reduce((sum, d) => sum + d.count, 0)).toBe(3);
  });

  it.each([
    { count: 0, max: 10, level: 0 },
    { count: 1, max: 10, level: 1 },
    { count: 5, max: 10, level: 2 },
    { count: 7, max: 10, level: 3 },
    { count: 10, max: 10, level: 4 },
  ])("shades $count of $max as level $level", ({ count, max, level }) => {
    expect(calendarLevel(count, max)).toBe(level);
  });
});

describe("ratingSeries", () => {
  const history: RatingStep[] = [1500, 1600, 1400, 1700, 1500, 1600, 1400, 1700, 1500, 1600, 1400, 1700].map((p, i) => ({
    id: String(i),
    createdAt: i,
    performance: { cross: p, f2l: 1000, ll: 1000 },
    rating: { cross: 1500 + i, f2l: 1000, ll: 1000 },
  }));

  it("follows one part's rating", () => {
    expect(ratingSeries(history, "cross").map((p) => p.rating)).toEqual(history.map((_, i) => 1500 + i));
  });

  it("bands the middle half of recent performances once there are ten", () => {
    const series = ratingSeries(history, "cross");
    expect(series[8]).toMatchObject({ low: null, high: null });
    expect(series[9]).toMatchObject({ low: 1500, high: 1600 });
    expect(series[11]).toMatchObject({ low: 1500, high: 1600 });
  });
});

describe("lookups", () => {
  const keys = [1, 3, 3, 7];
  it.each([
    { x: 0, before: -1, nearest: 0 },
    { x: 3, before: 2, nearest: 2 },
    { x: 4, before: 2, nearest: 2 },
    { x: 5.5, before: 2, nearest: 3 },
    { x: 9, before: 3, nearest: 3 },
  ])("at $x", ({ x, before, nearest }) => {
    expect(lastAtOrBefore(keys, x)).toBe(before);
    expect(nearestIndex(keys, x)).toBe(nearest);
  });
});
