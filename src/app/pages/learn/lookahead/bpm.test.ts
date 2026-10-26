import { describe, expect, it } from "vitest";
import { clampBpm, DEFAULT_BPM, MAX_BPM, MIN_BPM, startingBpm, suggestBpm, type BpmResult } from "./bpm";

const at = (bpm: number, ...stalls: number[]): BpmResult[] => stalls.map((stall) => ({ bpm, stalls: stall }));

describe("suggestBpm", () => {
  it.each([
    { name: "nothing yet", history: [], bpm: 60, next: 60 },
    { name: "two clean is not enough", history: at(60, 0, 0), bpm: 60, next: 60 },
    { name: "three clean in a row", history: at(60, 0, 0, 0), bpm: 60, next: 65 },
    { name: "three messy in a row", history: at(60, 3, 5, 4), bpm: 60, next: 55 },
    { name: "a middling solve breaks a clean run", history: at(60, 0, 1, 0), bpm: 60, next: 60 },
    { name: "a middling solve breaks a messy run", history: at(60, 4, 2, 4), bpm: 60, next: 60 },
    { name: "only the last three count", history: at(60, 5, 0, 0, 0), bpm: 60, next: 65 },
    { name: "older clean solves at another bpm do not count", history: [...at(55, 0, 0), ...at(60, 0)], bpm: 60, next: 60 },
    { name: "a fresh bpm starts a fresh streak", history: at(60, 0, 0, 0), bpm: 65, next: 65 },
    { name: "never above the top", history: at(MAX_BPM, 0, 0, 0), bpm: MAX_BPM, next: MAX_BPM },
    { name: "never below the bottom", history: at(MIN_BPM, 9, 9, 9), bpm: MIN_BPM, next: MIN_BPM },
  ])("$name", ({ history, bpm, next }) => {
    expect(suggestBpm(history, bpm)).toBe(next);
  });
});

describe("startingBpm", () => {
  it.each([
    { name: "default with no solves", history: [], bpm: DEFAULT_BPM },
    { name: "the last solve's bpm", history: at(72, 1), bpm: 72 },
    { name: "what the last three suggest", history: at(72, 0, 0, 0), bpm: 77 },
  ])("$name", ({ history, bpm }) => {
    expect(startingBpm(history)).toBe(bpm);
  });
});

describe("clampBpm", () => {
  it.each([
    [10, MIN_BPM],
    [61.4, 61],
    [999, MAX_BPM],
  ])("%s → %s", (input, output) => {
    expect(clampBpm(input)).toBe(output);
  });
});
