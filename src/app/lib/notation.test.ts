import { describe, expect, it } from "vitest";
import { humanize } from "./notation";

const always = () => true;
const text = (moves: string) => humanize(moves.split(" "), always).map((m) => m.text).join(" ");

describe("humanize", () => {
  it.each([
    { name: "Ua perm as reported", reported: "U R2 L2 D R L' F2 R' L D R2 L2", expected: "U M2 U M U2 M' U M2" },
    { name: "plain turns stay", reported: "R U R' U'", expected: "R U R' U'" },
    { name: "pair in either order", reported: "L' R", expected: "M" },
    { name: "E slice", reported: "U D'", expected: "E" },
    { name: "S slice", reported: "F' B", expected: "S" },
    { name: "two quarter turns are a half turn", reported: "R R U' U'", expected: "R2 U2" },
    { name: "a quarter turn and its inverse stay apart", reported: "R R'", expected: "R R'" },
  ])("$name", ({ reported, expected }) => {
    expect(text(reported)).toBe(expected);
  });

  it("only merges where allowed", () => {
    const out = humanize(["R", "L'", "U"], () => false).map((m) => m.text);
    expect(out).toEqual(["R", "L'", "U"]);
  });

  it("keeps the index span of a merged slice", () => {
    expect(humanize(["U", "R", "L'"], always)[1]).toEqual({ text: "M", from: 1, to: 2 });
  });
});
