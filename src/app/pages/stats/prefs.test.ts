import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, parsePrefs } from "./prefs";

describe("parsePrefs", () => {
  it("defaults to solve numbers, everything, ao100 and pb on", () => {
    expect(DEFAULT_PREFS).toEqual({
      x: "solve",
      range: "all",
      lines: { ao12: false, ao100: true, pb: true },
      splits: { cross: false, f2l: false, ll: false },
    });
  });

  it.each([
    { name: "nothing saved", raw: null, expected: DEFAULT_PREFS },
    { name: "not JSON", raw: "{oops", expected: DEFAULT_PREFS },
    { name: "not an object", raw: "42", expected: DEFAULT_PREFS },
    {
      name: "saved choices",
      raw: JSON.stringify({ x: "date", range: "7d", lines: { ao12: true, ao100: false, pb: true }, splits: { cross: true, f2l: false, ll: false } }),
      expected: { x: "date", range: "7d", lines: { ao12: true, ao100: false, pb: true }, splits: { cross: true, f2l: false, ll: false } },
    },
    {
      name: "a retired choice is dropped",
      raw: JSON.stringify({ x: "date", virtual: true }),
      expected: { ...DEFAULT_PREFS, x: "date" },
    },
    {
      name: "one bad choice keeps the others",
      raw: JSON.stringify({ x: "sideways", range: "30d", lines: { ao12: "yes", ao100: true, pb: false } }),
      expected: { ...DEFAULT_PREFS, range: "30d", lines: { ao12: false, ao100: true, pb: false } },
    },
  ])("$name", ({ raw, expected }) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(parsePrefs(raw)).toEqual(expected);
  });
});
