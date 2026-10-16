import { describe, expect, it } from "vitest";
import { clampView, convertView, extentOf, isFull, panView, windowFor, zoomView } from "./view";

describe("clampView", () => {
  it.each([
    { name: "inside stays", view: [10, 20] as const, expected: [10, 20] },
    { name: "past the end slides back", view: [95, 110] as const, expected: [85, 100] },
    { name: "before the start slides forward", view: [-5, 5] as const, expected: [0, 10] },
    { name: "too narrow widens around its centre", view: [50, 52] as const, expected: [47, 55] },
    { name: "wider than everything is everything", view: [-50, 200] as const, expected: [0, 100] },
  ])("$name", ({ view, expected }) => {
    expect(clampView(view, [0, 100], 8)).toEqual(expected);
  });
});

describe("zoomView", () => {
  it("keeps the anchor in place", () => {
    const zoomed = zoomView([0, 100], [0, 100], 0.5, 80, 8);
    expect(zoomed).toEqual([40, 90]);
  });

  it("zooming out past everything stops at everything", () => {
    expect(zoomView([40, 60], [0, 100], 10, 50, 8)).toEqual([0, 100]);
  });
});

describe("panView", () => {
  it("moves the window and stops at the edges", () => {
    expect(panView([10, 30], [0, 100], 15, 8)).toEqual([25, 45]);
    expect(panView([10, 30], [0, 100], -50, 8)).toEqual([0, 20]);
  });
});

describe("isFull", () => {
  it.each([
    { view: [0, 100] as const, full: true },
    { view: [0, 99] as const, full: false },
  ])("$view", ({ view, full }) => {
    expect(isFull(view, [0, 100])).toBe(full);
  });
});

describe("extentOf", () => {
  const placed = [3, 4, 5, 6, 9].map((n) => ({ n, t: 1_000_000 + (n - 3) * 20_000_000 }));

  it("spans the solves with half a solve either side", () => {
    expect(extentOf(placed, "solve", 0)).toEqual([2.5, 9.5]);
  });

  it("leaves room after a handful of solves", () => {
    expect(extentOf(placed.slice(0, 2), "solve", 0)).toEqual([2.5, 52.5]);
  });

  it("pads dates by at least half an hour", () => {
    expect(extentOf(placed, "date", 0)).toEqual([1_000_000 - 1_800_000, 121_000_000 + 1_800_000]);
  });

  it("has an empty axis to draw with no solves", () => {
    expect(extentOf([], "solve", 0)).toEqual([-0.5, 49.5]);
  });
});

describe("convertView", () => {
  const placed = Array.from({ length: 10 }, (_, n) => ({ n, t: 1_000_000 + n * 600_000 }));

  it("turns a stretch of solve numbers into the time they took", () => {
    const view = convertView([2.5, 5.5], "solve", placed);
    expect(view).toEqual(windowFor({ n: 3, t: 2_800_000 }, { n: 5, t: 4_000_000 }, "date"));
  });

  it("turns a time window into the solves inside it", () => {
    expect(convertView([2_000_000, 4_100_000], "date", placed)).toEqual([1.5, 5.5]);
  });

  it("is null when no solve falls inside", () => {
    expect(convertView([1_100_000, 1_200_000], "date", placed)).toBeNull();
  });
});
