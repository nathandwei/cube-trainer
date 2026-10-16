import { describe, expect, it } from "vitest";
import { analyzeSolve, createRng, generateDemoSolve, randomScramble } from "@/cube";
import type { SolveRecord } from "@/cube/types";
import { MAX_SOLVE_BYTES, solveRecordSchema } from "@/shared/schema";

describe("MAX_SOLVE_BYTES", () => {
  it("leaves real analysed solves several times below the cap", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const scramble = randomScramble(createRng(seed));
      const { moves, rotations } = generateDemoSolve(scramble, seed);
      const record: SolveRecord = {
        id: `seed-${seed}`,
        scramble,
        moves,
        rotations,
        totalMs: moves.at(-1)?.t ?? 0,
        penalty: "none",
        createdAt: Date.now(),
        source: "virtual",
        analysis: analyzeSolve(scramble, moves),
      };
      expect(solveRecordSchema.safeParse(record).success).toBe(true);
      const bytes = new TextEncoder().encode(JSON.stringify(record)).length;
      expect(bytes * 4).toBeLessThan(MAX_SOLVE_BYTES);
    }
  });
});
