import { describe, expect, it } from "vitest";
import { FrameTracker } from "@/cube";
import { VIRTUAL_KEYS, VIRTUAL_LAYOUT } from "./virtualCube";

describe("virtual cube keys", () => {
  it("matches csTimer's 36 bindings with no duplicate keys", () => {
    expect(VIRTUAL_LAYOUT).toHaveLength(36);
    expect(new Set(VIRTUAL_LAYOUT.map(([key]) => key)).size).toBe(36);
  });

  it.each([
    ["i", "R"],
    [";", "y"],
    ["u", "r"],
    [",", "u"],
    ["/", "d'"],
    [".", "M'"],
    ["0", "S"],
    ["2", "E"],
  ])("%s is %s", (key, move) => {
    expect(VIRTUAL_KEYS[key]).toBe(move);
  });

  it("can record every move", () => {
    for (const [, move] of VIRTUAL_LAYOUT) expect(() => new FrameTracker().apply(move)).not.toThrow();
  });
});
