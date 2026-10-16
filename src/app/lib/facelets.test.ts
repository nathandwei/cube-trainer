import { describe, expect, it } from "vitest";
import { applyAlg, SOLVED } from "@/cube";
import { facelets } from "./facelets";

describe("facelets", () => {
  it("shows every face in its own colour when solved", () => {
    const f = facelets(SOLVED);
    for (const face of ["U", "R", "F", "D", "L", "B"] as const) expect(f[face].every((c) => c === face)).toBe(true);
  });

  it.each([
    // After R, the front-right column of U shows the old F stickers, and F's right column shows D.
    { alg: "R", face: "U" as const, index: 8, color: "F" },
    { alg: "R", face: "F" as const, index: 2, color: "D" },
    { alg: "R", face: "B" as const, index: 6, color: "U" },
    // After U, the front row shows what was on the right.
    { alg: "U", face: "F" as const, index: 0, color: "R" },
    { alg: "U", face: "L" as const, index: 1, color: "F" },
    // After F, the bottom-right of U shows L.
    { alg: "F", face: "U" as const, index: 8, color: "L" },
  ])("after $alg, $face[$index] shows $color", ({ alg, face, index, color }) => {
    expect(facelets(applyAlg(SOLVED, alg))[face][index]).toBe(color);
  });

  it("keeps nine of each colour after a scramble", () => {
    const f = facelets(applyAlg(SOLVED, "R U2 F' L D B2 R' U F2 D'"));
    const counts = new Map<string, number>();
    for (const face of Object.values(f)) for (const c of face) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect([...counts.values()]).toEqual([9, 9, 9, 9, 9, 9]);
  });
});
