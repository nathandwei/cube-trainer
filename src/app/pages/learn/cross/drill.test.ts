import { describe, expect, it } from "vitest";
import { sentenceCase } from "./drill";

describe("sentenceCase", () => {
  it.each([
    ["inaccuracy", "Inaccuracy"],
    ["best", "Best"],
    ["", ""],
  ])("%j → %j", (word, shown) => {
    expect(sentenceCase(word)).toBe(shown);
  });
});
