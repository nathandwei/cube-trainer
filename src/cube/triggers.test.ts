import { describe, expect, it } from "vitest";
import { tokenizeAlg } from "./cubie";
import { algChunks } from "./triggers";

const moves = (alg: string) => algChunks(alg).map((c) => c.moves.join(" "));

describe("algChunks", () => {
  it("keeps the alg's own brackets", () => {
    expect(moves("(R U R' U') R' F R2 U' R' U' (R U R' F')")).toEqual(["R U R' U'", "R' F R2 U' R' U'", "R U R' F'"]);
  });

  it("finds triggers in an alg without brackets", () => {
    expect(moves("R U R' U' R' F R F'")).toEqual(["R U R' U'", "R' F R F'"]);
    expect(moves("F R U R' U' F' f R U R' U' f'")).toEqual(["F R U R' U' F'", "f R U R' U' f'"]);
  });

  it("groups the moves between triggers, a few at a time", () => {
    expect(moves("x R' U R' D2 R U' R' D2 R2 x'")).toEqual(["x R' U R'", "D2 R U' R'", "D2 R2 x'"]);
  });

  it("numbers moves the way tokenizeAlg does", () => {
    for (const alg of ["(R U R' U') R' F R2 U' R' U' (R U R' F')", "M2 U M U2 M' U M2", "R2' U R U R' U' R3 U' R' U R'"]) {
      const chunks = algChunks(alg);
      expect(chunks.flatMap((c) => c.moves)).toHaveLength(tokenizeAlg(alg).length);
      chunks.forEach((c, i) => expect(c.start).toBe(chunks.slice(0, i).reduce((n, p) => n + p.moves.length, 0)));
    }
  });
});
