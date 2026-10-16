import { describe, expect, it } from "vitest";
import { beatMs, findPauses, livePauseCount, pauseThresholdMs } from "./pauses";

describe("beats", () => {
  it.each([
    [60, 1000, 1500],
    [120, 500, 750],
    [80, 750, 1125],
  ])("%i bpm: a beat is %i ms and a pause is over %i ms", (bpm, beat, threshold) => {
    expect(beatMs(bpm)).toBe(beat);
    expect(pauseThresholdMs(bpm)).toBe(threshold);
  });

  it.each([0, -5, Number.NaN])("rejects %s bpm", (bpm) => {
    expect(() => beatMs(bpm)).toThrow(RangeError);
  });
});

describe("findPauses", () => {
  it.each([
    { name: "no turns", times: [], bpm: 60, pauses: [] },
    { name: "one turn", times: [0], bpm: 60, pauses: [] },
    { name: "on the beat", times: [0, 1000, 2000, 3000], bpm: 60, pauses: [] },
    { name: "exactly 1.5 beats is not a pause", times: [0, 1500], bpm: 60, pauses: [] },
    { name: "just over 1.5 beats", times: [0, 1501], bpm: 60, pauses: [{ from: 0, to: 1501 }] },
    { name: "two pauses", times: [0, 400, 2400, 2800, 4000], bpm: 120, pauses: [{ from: 400, to: 2400 }, { from: 2800, to: 4000 }] },
    { name: "faster bpm, shorter allowance", times: [0, 800], bpm: 120, pauses: [{ from: 0, to: 800 }] },
  ])("$name", ({ times, bpm, pauses }) => {
    expect(findPauses(times, bpm)).toEqual(pauses);
  });

  it("rejects turn times out of order", () => {
    expect(() => findPauses([0, 500, 300], 60)).toThrow(/backwards/);
  });
});

describe("livePauseCount", () => {
  it.each([
    { name: "not started", times: [], now: 9000, count: 0 },
    { name: "turning on the beat", times: [0, 1000], now: 1200, count: 0 },
    { name: "a gap still open and already too long", times: [0, 1000], now: 2600, count: 1 },
    { name: "a closed pause and an open one", times: [0, 2000], now: 4000, count: 2 },
  ])("$name", ({ times, now, count }) => {
    expect(livePauseCount(times, 60, now)).toBe(count);
  });
});
