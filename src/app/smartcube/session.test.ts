import { describe, expect, it, onTestFinished, vi } from "vitest";
import {
  SOLVED,
  applyAlg,
  createRng,
  generateDemoSolve,
  humanize,
  invertAlg,
  randomScramble,
  scrambleToSolverFrame,
  scrambledState,
  type CubeState,
} from "@/cube";
import type { Move } from "@/cube/types";
import { splitAlg, toSolverFrame } from "@/app/lib/frame";
import { MAX_GYRO_SAMPLES, MAX_SOLVE_BYTES, solveRecordSchema } from "@/shared/schema";
import { CubeSession, type FinishedSolve, type SessionOptions } from "./session";
import { GYRO_TUNING, multiply, type Quaternion } from "./gyro";

const SCRAMBLE = randomScramble(createRng(7));

type Harness = { session: CubeSession; finished: FinishedSolve[]; clock: { t: number } };

function harness(options: Partial<SessionOptions> = {}): Harness {
  const finished: FinishedSolve[] = [];
  const clock = { t: 10_000 };
  const session = new CubeSession({
    inspection: () => false,
    orientationReference: () => null,
    solveFix: async () => [],
    onFinish: (solve) => finished.push(solve),
    now: () => clock.t,
    settleMs: 0,
    ...options,
  });
  return { session, finished, clock };
}

/** The cube reports quarter turns in its own frame (white on U, like the scramble); a half turn is two quarters. */
function turnCube(h: Harness, wcaMove: string, gapMs = 150, quarterGapMs = 40): void {
  const quarters = wcaMove.endsWith("2") ? [wcaMove.charAt(0), wcaMove.charAt(0)] : [wcaMove];
  quarters.forEach((quarter, i) => {
    h.clock.t += i === 0 ? gapMs : quarterGapMs;
    // Cube clock: 0.5% slow and offset; arrival 15 ms after the turn.
    h.session.move(toSolverFrame(quarter), h.clock.t + 15, Math.round(3_000 + h.clock.t * 0.995));
  });
}

function start(h: Harness, cube: CubeState = SOLVED): void {
  h.session.setScramble(SCRAMBLE);
  h.session.facelets(cube, h.clock.t);
}

function scrambleCube(h: Harness): void {
  for (const move of splitAlg(SCRAMBLE)) turnCube(h, move);
}

/** Solver-frame solution, as the cube would report it after the solver turns it over (z2). */
function solutionInWca(): string[] {
  return invertAlg(scrambleToSolverFrame(SCRAMBLE)).map(toSolverFrame);
}

describe("CubeSession scrambling", () => {
  it("waits for both a scramble and the cube's state", () => {
    const h = harness();
    expect(h.session.view().phase).toBe("waiting");
    h.session.setScramble(SCRAMBLE);
    expect(h.session.view().phase).toBe("waiting");
    h.session.facelets(SOLVED, 0);
    expect(h.session.view()).toMatchObject({ phase: "scrambling", plan: { moves: splitAlg(SCRAMBLE), done: 0, fix: false } });
  });

  it("follows the scramble turn by turn, half turns quarter by quarter", () => {
    const h = harness();
    start(h);
    const moves = splitAlg(SCRAMBLE);
    const half = moves.findIndex((m) => m.endsWith("2"));
    for (const move of moves.slice(0, half)) turnCube(h, move);
    expect(h.session.view().plan).toMatchObject({ done: half, half: false });
    h.session.move(toSolverFrame(`${moves[half]!.charAt(0)}'`), h.clock.t + 100, null);
    expect(h.session.view().plan).toMatchObject({ done: half, half: true, fix: false });
    h.session.move(toSolverFrame(`${moves[half]!.charAt(0)}'`), h.clock.t + 200, null);
    expect(h.session.view().plan).toMatchObject({ done: half + 1, half: false });
  });

  it.each([
    { inspection: false, phase: "ready" },
    { inspection: true, phase: "inspecting" },
  ])("is $phase once the cube matches the scramble (inspection $inspection)", ({ inspection, phase }) => {
    const h = harness({ inspection: () => inspection });
    start(h);
    scrambleCube(h);
    expect(h.session.view().phase).toBe(phase);
    expect(h.session.view().plan).toBeNull();
  });

  it("shows the undo of a stray turn followed by the rest of the scramble", () => {
    const h = harness();
    start(h);
    const moves = splitAlg(SCRAMBLE);
    turnCube(h, moves[0]!);
    const wrong = moves[1]!.startsWith("U") || moves[1]!.startsWith("D") ? "F" : "U";
    turnCube(h, wrong);
    const plan = h.session.view().plan!;
    expect(plan.fix).toBe(true);
    expect(plan.done).toBe(0);
    expect(plan.moves[0]).toBe(`${wrong}'`);
    expect(plan.moves.slice(1)).toEqual(moves.slice(1));
    for (const move of plan.moves) turnCube(h, move);
    expect(h.session.view().phase).toBe("ready");
  });

  it("asks cubing.js when the cube starts unsolved, and shows its answer", async () => {
    const answer = ["R", "U"];
    const solveFix = vi.fn(async () => answer.map(toSolverFrame));
    const h = harness({ solveFix });
    start(h, applyAlg(SOLVED, ["F"]));
    expect(h.session.view().plan).toMatchObject({ thinking: true, moves: [] });
    await vi.waitFor(() => expect(h.session.view().plan?.thinking).toBe(false));
    expect(h.session.view().plan?.moves).toEqual(answer);
  });

  it("drops cubing.js's answer if the cube moved meanwhile", async () => {
    const pending: ((moves: Move[]) => void)[] = [];
    const solveFix = vi.fn(() => new Promise<Move[]>((resolve) => pending.push(resolve)));
    const h = harness({ solveFix });
    start(h, applyAlg(SOLVED, ["F"]));
    h.session.move("R", h.clock.t + 100, null);
    expect(solveFix).toHaveBeenCalledTimes(2);
    pending[0]!(["U"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(h.session.view().plan).toMatchObject({ thinking: true, moves: [] });
    pending[1]!(["B"]);
    await vi.waitFor(() => expect(h.session.view().plan?.moves).toEqual(["B"]));
  });

  it("re-plans from solved after mark solved", () => {
    const h = harness();
    start(h);
    turnCube(h, "F");
    turnCube(h, "F");
    h.session.markSolved();
    expect(h.session.view().plan).toMatchObject({ moves: splitAlg(SCRAMBLE), done: 0, fix: false });
  });
});

describe("CubeSession solving", () => {
  it("times from the first turn to solved and hands over a normalised, analysed solve", () => {
    const h = harness();
    start(h);
    scrambleCube(h);
    const solution = solutionInWca();
    for (const move of solution) turnCube(h, move, 210, 45);
    expect(h.finished).toHaveLength(1);
    const solve = h.finished[0]!;
    expect(solve.scramble).toBe(SCRAMBLE);
    expect(solve.penalty).toBe("none");
    // Each half turn arrived as two quarters and is saved as one.
    expect(solve.moves.map((m) => m.move)).toEqual(invertAlg(scrambleToSolverFrame(SCRAMBLE)));
    expect(solve.moves[0]!.t).toBe(0);
    expect(solve.totalMs).toBe(solve.moves.at(-1)!.t);
    const expectedMs = solution.reduce((sum, m, i) => sum + (i === 0 ? 0 : 210) + (m.endsWith("2") ? 45 : 0), 0);
    expect(Math.abs(solve.totalMs - expectedMs)).toBeLessThan(5);
    expect(solve.analysis?.solved).toBe(true);
    expect(h.session.view().phase).toBe("waiting");
  });

  it("charges +2 for starting 16 s into inspection", () => {
    const h = harness({ inspection: () => true });
    start(h);
    scrambleCube(h);
    expect(h.session.view().phase).toBe("inspecting");
    h.clock.t += 16_000;
    for (const move of solutionInWca()) turnCube(h, move);
    expect(h.finished[0]?.penalty).toBe("+2");
  });

  it("keeps timing when the cube drops out, and saves the time without an analysis", () => {
    const h = harness();
    start(h);
    scrambleCube(h);
    const solution = solutionInWca();
    for (const move of solution.slice(0, 5)) turnCube(h, move);
    const startedAt = h.session.view().startedAt!;
    h.session.connectionLost();
    expect(h.session.view().phase).toBe("lost");
    h.session.stopLost(startedAt + 12_345);
    expect(h.finished[0]).toMatchObject({ totalMs: 12_345, penalty: "none" });
    expect(h.finished[0]?.analysis).toBeUndefined();
    expect(h.finished[0]?.moves.length).toBeGreaterThan(0);
  });

  it("drops the attempt on cancel", () => {
    const h = harness();
    start(h);
    scrambleCube(h);
    turnCube(h, "R");
    h.session.cancel();
    expect(h.finished).toHaveLength(0);
    expect(h.session.view().phase).toBe("scrambling");
  });

  it("resyncs from a state report that disagrees mid-solve and flags it", () => {
    const h = harness();
    start(h);
    scrambleCube(h);
    turnCube(h, "R");
    h.session.facelets(applyAlg(SOLVED, ["U"]), h.clock.t + 900);
    expect(h.session.view()).toMatchObject({ phase: "solving", desynced: true });
  });
});

describe("CubeSession gyro", () => {
  const S = Math.SQRT1_2;
  const REST: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
  /** The cube's report after the solver turns it: solver axes (x right, y up, z front) → cube axes. */
  const after = (solver: Quaternion): Quaternion => ({ w: solver.w, x: -solver.x, y: -solver.z, z: -solver.y });
  const Y = after({ w: S, x: 0, y: -S, z: 0 });
  const X = after({ w: S, x: -S, y: 0, z: 0 });

  function solveWith(gyro: (h: Harness, i: number, move: string) => void): FinishedSolve {
    const h = harness();
    start(h);
    scrambleCube(h);
    h.session.gyro(REST, h.clock.t);
    solutionInWca().forEach((move, i) => {
      gyro(h, i, move);
      turnCube(h, move, 300);
    });
    return h.finished[0]!;
  }

  it("records a regrip as a y between the right turns", () => {
    const solve = solveWith((h, i) => {
      if (i !== 3) return;
      for (const dt of [20, 110, 200]) h.session.gyro(Y, h.clock.t + dt);
    });
    expect(solve.rotations).toEqual([{ rotation: "y", after: 3, t: expect.any(Number) }]);
    expect(solve.gyro?.length).toBeGreaterThan(3);
  });

  it("ties a centre rotation right after an L turn to it, so the replay reads r", () => {
    const solve = solveWith((h, i, move) => {
      if (i !== 4) return;
      h.session.move(toSolverFrame("R"), h.clock.t + 100, Math.round(3_000 + (h.clock.t + 85) * 0.995));
      // An x is a tip: it reads once held for five reports.
      for (const dt of [150, 240, 330, 420, 510]) h.session.gyro(X, h.clock.t + dt);
      h.session.move(toSolverFrame("R'"), h.clock.t + 400, Math.round(3_000 + (h.clock.t + 385) * 0.995));
      void move;
    });
    // The cube's R is the solver's L (white is down); with the x it is the solver's r.
    const rotation = solve.rotations[0]!;
    const turn = solve.moves[rotation.after - 1]!;
    expect(turn.move).toBe("L");
    expect(rotation).toMatchObject({ rotation: "x", t: turn.t });
    const texts = humanize(solve.moves, solve.rotations, () => false).map((token) => token.text);
    expect(texts).toContain("r");
  });

  it("keeps reading the gyro briefly after the solving turn, so a final M2 reads as M2", async () => {
    const finished: FinishedSolve[] = [];
    const session = new CubeSession({
      inspection: () => false,
      orientationReference: () => null,
      solveFix: async () => [],
      onFinish: (solve) => finished.push(solve),
      settleMs: 60,
    });
    session.setScramble("R2 L2");
    session.facelets(applyAlg(SOLVED, scrambleToSolverFrame("R2 L2")), 0);
    expect(session.view().phase).toBe("ready");
    session.gyro(REST, 900);
    // The cube's own R and L (the solver's L and R), two quarters each; the core turns x2 as the slice finishes.
    [["R", 1000], ["L", 1010], ["R", 1040], ["L", 1050]].forEach(([move, t]) => session.move(toSolverFrame(move as string), t as number, t as number));
    expect(session.view().stoppedAt).toBe(1050);
    expect(finished).toHaveLength(0);
    const X2 = after({ w: 0, x: -1, y: 0, z: 0 });
    session.gyro(X2, 1080);
    session.gyro(X2, 1110);
    await vi.waitFor(() => expect(finished).toHaveLength(1));
    const solve = finished[0]!;
    expect(solve.moves.map((m) => m.move)).toEqual(["L2", "R2"]);
    expect(solve.rotations).toEqual([{ rotation: "x2", after: 2, t: 50 }]);
    expect(humanize(solve.moves, solve.rotations, () => false).map((token) => token.text)).toEqual(["M2"]);
  });

  it("thins long gyro traces so the saved solve stays well under the size cap", () => {
    const tilted = after({ w: 0.97, x: 0.1736, y: 0.1, z: 0.05 });
    const solve = solveWith((h) => {
      for (let k = 0; k < 120; k++) h.session.gyro(tilted, h.clock.t + k);
    });
    expect(solve.gyro).toHaveLength(MAX_GYRO_SAMPLES);
    const record = { ...solve, id: "mvaaijcy-i4xh9q", createdAt: 1_792_114_185_346, source: "smartcube" as const };
    expect(solveRecordSchema.safeParse(record).success).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(record)).length).toBeLessThan(MAX_SOLVE_BYTES * 0.75);
  });
});

describe("CubeSession over simulated CFOP solves", () => {
  const S = Math.SQRT1_2;
  const QUARTER: Record<string, Quaternion> = { x: { w: S, x: -S, y: 0, z: 0 }, y: { w: S, x: 0, y: -S, z: 0 }, z: { w: S, x: 0, y: 0, z: -S } };
  /** The gyro report after these rotations (solver's view), wobbling a few degrees like a hand. */
  function report(rotations: readonly string[], t: number): Quaternion {
    let total: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
    for (const r of rotations) for (let i = 0; i < (r.endsWith("2") ? 2 : r.endsWith("'") ? 3 : 1); i++) total = multiply(QUARTER[r.charAt(0)]!, total);
    const half = (Math.sin(t / 53) * 6 * Math.PI) / 360;
    total = multiply({ w: Math.cos(half), x: Math.sin(half), y: 0, z: 0 }, total);
    return { w: total.w, x: -total.x, y: -total.z, z: -total.y };
  }

  // The demo generator plays realistic solves: y regrips, z rotations, wide moves and slices (M2 included), each
  // as a smart cube reports them. Gyro reports every 90 ms follow its rotations. Its last-layer algs fire wide moves
  // faster than a tip is held to count (GYRO_TUNING.tipDwellReports, tuned on real solves, where hand tilts were the
  // bigger problem); where each rotation lands is what's tested here, so tips read like y regrips.
  it.each([1, 2, 3, 4, 5, 6])("puts every rotation of demo solve %i after the right turn", async (seed) => {
    const tuning = { ...GYRO_TUNING };
    Object.assign(GYRO_TUNING, { tipDwellReports: GYRO_TUNING.dwellReports, tipEnterDegrees: GYRO_TUNING.enterDegrees });
    onTestFinished(() => void Object.assign(GYRO_TUNING, tuning));
    const scramble = randomScramble(createRng(seed));
    const demo = generateDemoSolve(scramble, seed);
    const finished: FinishedSolve[] = [];
    const session = new CubeSession({ inspection: () => false, orientationReference: () => null, solveFix: async () => [], onFinish: (solve) => finished.push(solve), settleMs: 30 });
    session.setScramble(scramble);
    session.facelets(scrambledState(scramble), 0);
    type Step = { t: number; move?: string; rotation?: string };
    const steps: Step[] = [];
    demo.moves.forEach((m, i) => {
      for (const r of demo.rotations.filter((r) => r.after === i)) steps.push({ t: r.t, rotation: r.rotation });
      if (!m.move.endsWith("2")) return void steps.push({ t: m.t, move: m.move });
      steps.push({ t: m.t, move: m.move.charAt(0) }, { t: m.t + 40, move: m.move.charAt(0) });
    });
    for (const r of demo.rotations.filter((r) => r.after === demo.moves.length)) steps.push({ t: r.t, rotation: r.rotation });
    const applied: string[] = [];
    let clock = 0;
    let nextReport = 0;
    for (const step of steps) {
      clock = Math.max(clock, step.t);
      for (; nextReport <= clock; nextReport += 90) session.gyro(report(applied, nextReport), nextReport);
      if (step.rotation) applied.push(step.rotation);
      else session.move(step.move!, clock + 15, clock);
    }
    for (let k = 0; k < 4; k++, nextReport += 90) session.gyro(report(applied, nextReport), nextReport);
    await vi.waitFor(() => expect(finished).toHaveLength(1));
    const solve = finished[0]!;
    expect(solve.moves.map((m) => m.move)).toEqual(demo.moves.map((m) => m.move));
    expect(solve.analysis?.solved).toBe(true);
    expect(solve.rotations.map((r) => `${r.rotation}@${r.after}`)).toEqual(demo.rotations.map((r) => `${r.rotation}@${r.after}`));
  });
});
