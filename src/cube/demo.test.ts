import { cube3x3x3 } from "cubing/puzzles";
import { describe, expect, it } from "vitest";
import { analyzeSolve } from "./analyze";
import { parseAlg } from "./cubie";
import { generateDemoPlan, generateDemoSolve, type DemoStage } from "./demo";
import { splitMoves } from "./frame";
import { COLL_CASES, EO_CASES, EPLL_CASES } from "./ll";
import { humanize, type DisplayToken } from "./notation";
import { createRng, randomScramble } from "./random";

const rng = createRng(2024);
const scrambles = Array.from({ length: 20 }, () => randomScramble(rng));

function tokensIn(tokens: readonly DisplayToken[], stage: DemoStage): DisplayToken[] {
  return tokens.filter((token) => token.start >= stage.startMove && token.start < stage.endMove);
}

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
    const totals = scrambles.map((scramble, i) => analyzeSolve(scramble, generateDemoSolve(scramble, i).moves).totalMs);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    console.info(`demo totals (s): ${totals.map((t) => (t / 1000).toFixed(1)).join(" ")}; mean ${(mean / 1000).toFixed(1)}`);
    expect(mean).toBeGreaterThan(13_000);
    expect(mean).toBeLessThan(19_000);
    expect(Math.max(...totals)).toBeLessThan(25_000);
  });

  // The setup TwistyPlayer gets from the raw stream: experimental-setup-alg = scramble + " z2", alg = the moves.
  it.each(scrambles.slice(0, 5).map((s, i) => [i, s]))("solve %i also ends solved in cubing.js", async (i, scramble) => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const moves = generateDemoSolve(scramble, i).moves.map(({ move }) => move);
    const end = kpuzzle.defaultPattern().applyAlg(`${scramble} z2 ${moves.join(" ")}`);
    expect(end.isIdentical(kpuzzle.defaultPattern().applyAlg("z2"))).toBe(true);
  });

  it("starts at t = 0 with outer face turns in time order", () => {
    const { moves } = generateDemoSolve(scrambles[0]!, 1);
    expect(moves[0]!.t).toBe(0);
    for (let i = 1; i < moves.length; i++) expect(moves[i]!.t).toBeGreaterThanOrEqual(moves[i - 1]!.t);
    expect(moves.every(({ move }) => parseAlg(move).length === 1)).toBe(true);
  });

  it.each(scrambles.slice(0, 10).map((s, i) => [i, s]))("solve %i places each rotation between its turns", (i, scramble) => {
    const { moves, rotations } = generateDemoSolve(scramble, i);
    rotations.forEach(({ after, t }, k) => {
      if (k > 0) expect(after).toBeGreaterThanOrEqual(rotations[k - 1]!.after);
      expect(t).toBeGreaterThanOrEqual(moves[after - 1]?.t ?? 0);
      expect(t).toBeLessThanOrEqual(moves[after]?.t ?? Infinity);
    });
  });

  // A wide move's or slice's rotation shares its last turn's time; a cube rotation stands apart, then the solver
  // regrips for 150–300 ms.
  it.each(scrambles.slice(0, 10).map((s, i) => [i, s]))("solve %i times rotations like a person", (i, scramble) => {
    const { moves, rotations } = generateDemoSolve(scramble, i);
    const tokens = humanize(moves, rotations, () => false);
    const cubeRotations = tokens.filter((token) => token.kind === "rotation");
    const inside = rotations.length - cubeRotations.length;
    expect(rotations.filter(({ after, t }) => after > 0 && t === moves[after - 1]!.t)).toHaveLength(inside);
    for (const { start } of cubeRotations) {
      const event = rotations.find((r) => r.after === start && (start === 0 || r.t > moves[start - 1]!.t))!;
      const next = moves[start];
      if (next) expect(next.t - event.t).toBeGreaterThanOrEqual(150);
    }
  });

  it("solves pairs with U, R, F and L in the solver's view, rotating to reach the back slots", () => {
    let pairTurns = 0;
    let backOrDown = 0;
    let rotatedPairs = 0;
    let pairs = 0;
    scrambles.forEach((scramble, i) => {
      const { moves, rotations, stages } = generateDemoPlan(scramble, i);
      const tokens = humanize(moves, rotations, () => false);
      for (const stage of stages.filter((s) => s.kind === "pair")) {
        const inStage = tokensIn(tokens, stage);
        const turns = inStage.filter((token) => token.kind === "turn");
        const stageRotations = inStage.filter((token) => token.kind === "rotation").map((token) => token.text);
        expect(stageRotations.every((text) => ["y", "y2", "y'"].includes(text))).toBe(true);
        pairs++;
        if (stageRotations.length > 0) rotatedPairs++;
        pairTurns += turns.length;
        backOrDown += turns.filter((token) => /^[BD]/.test(token.text)).length;
      }
    });
    expect(backOrDown / pairTurns).toBeLessThan(0.02);
    expect(rotatedPairs / pairs).toBeGreaterThan(0.3);
  });

  it("runs last-layer algs as written, wide moves and slices included", () => {
    const algs = new Map([...EO_CASES, ...COLL_CASES, ...EPLL_CASES].map(({ name, alg }) => [name, alg]));
    let checked = 0;
    scrambles.forEach((scramble, i) => {
      const { moves, rotations, stages } = generateDemoPlan(scramble, i);
      const tokens = humanize(moves, rotations, () => false);
      for (const stage of stages.filter((s) => ["eo", "coll", "epll"].includes(s.kind))) {
        const shown = ` ${tokensIn(tokens, stage).map((token) => token.text).join(" ")} `;
        // The first and last moves may merge with an AUF.
        const core = splitMoves(algs.get(stage.caseName!)!).slice(1, -1).join(" ");
        expect(shown).toContain(` ${core} `);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(30);
  });

  it("follows the CFOP order and pauses between stages", () => {
    const { stages } = generateDemoPlan(scrambles[1]!, 3);
    const order = ["cross", "xcross", "pair", "eo", "ll", "coll", "epll"];
    const ranks = stages.map((s) => order.indexOf(s.kind));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const analysis = analyzeSolve(scrambles[1]!, generateDemoSolve(scrambles[1]!, 3).moves);
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
