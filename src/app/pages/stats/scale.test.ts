import { describe, expect, it } from "vitest";
import { linear, niceExtent, niceStep, secondsLabel, ticks, timeAxis, timeTicks } from "./scale";

describe("linear", () => {
  it("maps and inverts", () => {
    const scale = linear([10, 20], [100, 300]);
    expect(scale.at(15)).toBe(200);
    expect(scale.invert(250)).toBe(17.5);
  });
});

describe("niceStep", () => {
  it.each([
    { span: 10_000, count: 5, step: 2000 },
    { span: 7000, count: 5, step: 1000 },
    { span: 600, count: 6, step: 100 },
    { span: 450, count: 5, step: 100 },
    { span: 3, count: 5, step: 0.5 },
  ])("$span over $count", ({ span, count, step }) => {
    expect(niceStep(span, count)).toBe(step);
  });
});

describe("ticks", () => {
  it("lists multiples of the step without float drift", () => {
    expect(ticks(0.1, 0.75, 5)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]);
    expect(ticks(12_300, 21_800, 5)).toEqual([14_000, 16_000, 18_000, 20_000]);
  });

  it("widens to nice bounds", () => {
    expect(niceExtent(12_300, 21_800, 5)).toEqual({ domain: [12_000, 22_000], ticks: [12_000, 14_000, 16_000, 18_000, 20_000, 22_000], step: 2000 });
  });
});

describe("secondsLabel", () => {
  it.each([
    { ms: 15_000, step: 1000, label: "15.0" },
    { ms: 16_000, step: 2000, label: "16.0" },
    { ms: 1500, step: 500, label: "1.5" },
    { ms: 1250, step: 250, label: "1.25" },
  ])("$ms ms at a $step ms step", ({ ms, step, label }) => {
    expect(secondsLabel(ms, step)).toBe(label);
  });
});

describe("timeAxis", () => {
  it("leaves the slowest half percent of a long history off the scale", () => {
    const values = [...Array.from({ length: 999 }, (_, i) => 14_000 + (i % 40) * 100), 90_000];
    expect(timeAxis(values, [], 5).domain[1]).toBeLessThan(20_000);
  });

  it("keeps every value of a short stretch, and what it is told to keep", () => {
    expect(timeAxis([15_000, 40_000], [], 5).domain[1]).toBeGreaterThanOrEqual(40_000);
    expect(timeAxis([15_000, 16_000], [11_000], 5).domain[0]).toBeLessThanOrEqual(11_000);
  });

  it("has a default scale with nothing to show", () => {
    expect(timeAxis([], [], 5).domain).toEqual([10_000, 30_000]);
  });
});

describe("timeTicks", () => {
  it("labels days as 'Oct 3'", () => {
    const ticks = timeTicks(new Date(2026, 9, 1, 12).getTime(), new Date(2026, 9, 6, 12).getTime(), 7);
    expect(ticks.map((t) => t.label)).toEqual(["Oct 2", "Oct 3", "Oct 4", "Oct 5", "Oct 6"]);
    expect(new Date(ticks[0]?.value ?? 0)).toEqual(new Date(2026, 9, 2));
  });

  it("uses months over half a year, with the year at January", () => {
    const ticks = timeTicks(new Date(2026, 7, 20).getTime(), new Date(2027, 1, 10).getTime(), 8);
    expect(ticks.map((t) => t.label)).toEqual(["Sep", "Oct", "Nov", "Dec", "2027", "Feb"]);
  });

  it("uses hours within a day, with the date at midnight", () => {
    const ticks = timeTicks(new Date(2026, 9, 3, 20, 10).getTime(), new Date(2026, 9, 4, 2, 50).getTime(), 8);
    expect(ticks.map((t) => t.label)).toEqual(["9 PM", "10 PM", "11 PM", "Oct 4", "1 AM", "2 AM"]);
  });

  it("uses Sunday-aligned weeks for a couple of months", () => {
    const ticks = timeTicks(new Date(2026, 8, 1).getTime(), new Date(2026, 9, 20).getTime(), 8);
    expect(ticks.every((t) => new Date(t.value).getDay() === 0)).toBe(true);
    expect(ticks.length).toBeLessThanOrEqual(8);
  });
});
