import { cube3x3x3 } from "cubing/puzzles";
import { describe, expect, it } from "vitest";
import { analyzeSolve } from "./analyze";
import { parseAlg } from "./cubie";
import { generateDemoPlan, generateDemoSolve } from "./demo";
import { createRng, randomScramble } from "./random";

const rng = createRng(2024);
const scrambles = Array.from({ length: 20 }, () => randomScramble(rng));

describe("generateDemoSolve", () => {
  it.each(scrambles.map((scramble, i) => [i, scramble]))("solve %i is analysed exactly as generated", (i, scramble) => {
    const { moves, stages } = generateDemoPlan(scramble, i);
    const analysis = analyzeSolve(scramble, moves);
    expect(analysis.solved).toBe(true);
    const reported = analysis.stages.map(({ kind, label, startMove, endMove, slots, caseName }) => ({
      kind,
      label,
      startMove,
      endMove,
      ...(slots ? { slots } : {}),
      ...(caseName ? { caseName } : {}),
    }));
    expect(reported).toEqual(stages);
  });

  it("looks like a 14–19 s human solve", () => {
    const totals = scrambles.map((scramble, i) => analyzeSolve(scramble, generateDemoSolve(scramble, i)).totalMs);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    console.info(`demo totals (s): ${totals.map((t) => (t / 1000).toFixed(1)).join(" ")}; mean ${(mean / 1000).toFixed(1)}`);
    expect(mean).toBeGreaterThan(13_000);
    expect(mean).toBeLessThan(19_000);
    expect(Math.max(...totals)).toBeLessThan(25_000);
  });

  // The same setup the app gives TwistyPlayer: experimental-setup-alg = scramble + " z2", alg = the moves.
  it.each(scrambles.slice(0, 5).map((s, i) => [i, s]))("solve %i also ends solved in cubing.js", async (i, scramble) => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const moves = generateDemoSolve(scramble, i).map(({ move }) => move);
    const end = kpuzzle.defaultPattern().applyAlg(`${scramble} z2 ${moves.join(" ")}`);
    expect(end.isIdentical(kpuzzle.defaultPattern().applyAlg("z2"))).toBe(true);
  });

  it("starts at t = 0 with outer face turns in time order", () => {
    const moves = generateDemoSolve(scrambles[0]!, 1);
    expect(moves[0]!.t).toBe(0);
    for (let i = 1; i < moves.length; i++) expect(moves[i]!.t).toBeGreaterThanOrEqual(moves[i - 1]!.t);
    expect(moves.every(({ move }) => parseAlg(move).length === 1)).toBe(true);
  });

  it("follows the CFOP order and pauses between stages", () => {
    const { stages } = generateDemoPlan(scrambles[1]!, 3);
    const order = ["cross", "xcross", "pair", "eo", "ll", "coll", "epll"];
    const ranks = stages.map((s) => order.indexOf(s.kind));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const analysis = analyzeSolve(scrambles[1]!, generateDemoSolve(scrambles[1]!, 3));
    for (const stage of analysis.stages.slice(1)) expect(stage.recognitionMs).toBeGreaterThanOrEqual(300);
  });

  it.each([[""], ["U"], ["R U R' U'"]])("handles the near-solved scramble %j", (scramble) => {
    const { moves, stages } = generateDemoPlan(scramble, 1);
    expect(analyzeSolve(scramble, moves).solved).toBe(true);
    expect(stages.at(-1)?.endMove ?? 0).toBe(moves.length);
  });

  it("is deterministic per seed and varies across seeds", () => {
    expect(generateDemoSolve(scrambles[2]!, 5)).toEqual(generateDemoSolve(scrambles[2]!, 5));
    expect(generateDemoSolve(scrambles[2]!)).toEqual(generateDemoSolve(scrambles[2]!));
    expect(generateDemoSolve(scrambles[2]!, 5)).not.toEqual(generateDemoSolve(scrambles[2]!, 6));
  });
});
