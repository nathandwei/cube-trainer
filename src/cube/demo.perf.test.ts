// Kept in its own file so the pruning tables are cold: the timing includes their first-time build.
import { expect, it } from "vitest";
import { analyzeSolve } from "./analyze";
import { generateDemoSolve } from "./demo";

it("generates and analyses a demo solve in under 1.5 s from a cold start", () => {
  const scramble = "D2 F' L2 U2 B2 R2 F' D2 F2 U2 F2 L' B U' L D' F R' D2 B'";
  const started = performance.now();
  const moves = generateDemoSolve(scramble, 1);
  const generated = performance.now();
  const analysis = analyzeSolve(scramble, moves);
  const finished = performance.now();
  console.info(
    `cold demo: generate ${(generated - started).toFixed(0)} ms, analyse ${(finished - generated).toFixed(0)} ms, ` +
      `total ${(finished - started).toFixed(0)} ms`,
  );
  expect(analysis.solved).toBe(true);
  expect(finished - started).toBeLessThan(1500);
});
