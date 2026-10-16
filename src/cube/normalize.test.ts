import { describe, expect, it } from "vitest";
import { HALF_TURN_MS, cubeClockLine, fitCubeClock, normalizeStream, normalizeTurns, type ReportedMove } from "./normalize";
import type { RotationEvent, TimedMove } from "./types";

// A T-perm as a GAN i4 reported it (upstream capture fixture_GANi4_A26E): moves, host arrival, cube clock.
// The R2 arrives as two R quarter turns 59 ms apart on the cube clock.
const I4_TPERM: ReportedMove[] = [
  ["R", 12866, 17901],
  ["U", 13079, 18073],
  ["R'", 13137, 18172],
  ["U'", 13259, 18274],
  ["R'", 13346, 18386],
  ["F", 13468, 18497],
  ["R", 13558, 18591],
  ["R", 13616, 18650],
  ["U'", 13706, 18749],
  ["R'", 13828, 18866],
  ["U'", 14038, 19027],
  ["R", 14129, 19121],
  ["U", 14218, 19213],
  ["R'", 14369, 19376],
  ["F'", 14457, 19472],
].map(([move, hostT, cubeT]) => ({ move: move as string, hostT: hostT as number, cubeT: cubeT as number }));

/** Arrival jitter seen on real GAN cubes is p95 13–23 ms (cubetrace); the capture's own spread is wider. */
const MAX_JITTER = 60;

function stream(spec: string, gapMs = 150): TimedMove[] {
  return spec
    .split(" ")
    .filter(Boolean)
    .map((token, i) => {
      const [move = "", at] = token.split("@");
      return { move, t: at === undefined ? i * gapMs : Number(at) };
    });
}

describe("fitCubeClock", () => {
  it("maps a skewed cube clock onto host time within radio jitter", () => {
    // Cube clock 0.7% slow (cubetrace measured this on a GAN 12 ui), host arrival = true time + 0..20 ms jitter.
    const trueTimes = [0, 180, 260, 410, 650, 700, 1120, 1300, 1890, 2400, 3100, 3350];
    const jitter = [12, 3, 18, 7, 0, 15, 9, 20, 4, 11, 6, 14];
    const moves = trueTimes.map((t, i) => ({ move: "R", hostT: 50_000 + t + jitter[i]!, cubeT: 9_000 + t * 0.993 }));
    const fitted = fitCubeClock(moves);
    fitted.forEach(({ t }, i) => expect(Math.abs(t - (50_000 + trueTimes[i]! + 10))).toBeLessThan(12));
    // Gaps between turns come from the cube clock, not the jittery arrivals.
    expect(fitted[5]!.t - fitted[4]!.t).toBeCloseTo(50, -1);
  });

  it("reproduces the i4 capture's spacing and keeps the moves", () => {
    const fitted = fitCubeClock(I4_TPERM);
    expect(fitted.map((m) => m.move)).toEqual(I4_TPERM.map((m) => m.move));
    expect(fitted[7]!.t - fitted[6]!.t).toBeGreaterThan(50);
    expect(fitted[7]!.t - fitted[6]!.t).toBeLessThan(70);
    fitted.forEach(({ t }, i) => expect(Math.abs(t - I4_TPERM[i]!.hostT)).toBeLessThan(MAX_JITTER));
  });

  it.each([
    { name: "no cube clock at all", cubeT: [null, null, null] },
    { name: "a clock that restarts mid-attempt", cubeT: [5000, 5200, 10] },
    { name: "a clock running 10% fast", cubeT: [0, 330, 660] },
  ])("falls back to arrival times for $name", ({ cubeT }) => {
    const moves = [1000, 1300, 1600].map((hostT, i) => ({ move: "U", hostT, cubeT: cubeT[i] ?? null }));
    expect(fitCubeClock(moves).map((m) => m.t)).toEqual([1000, 1300, 1600]);
  });

  it("uses the offset alone when only one turn has a cube time", () => {
    const moves = [
      { move: "R", hostT: 1000, cubeT: 400 },
      { move: "U", hostT: 1500, cubeT: null },
    ];
    expect(cubeClockLine(moves)).toEqual({ slope: 1, intercept: 600 });
  });

  it("places a recovered turn (no cube time, late arrival) between its neighbours", () => {
    const moves: ReportedMove[] = [
      { move: "R", hostT: 1000, cubeT: 100 },
      { move: "U", hostT: 1650, cubeT: null },
      { move: "F", hostT: 1400, cubeT: 500 },
      { move: "L", hostT: 1500, cubeT: 600 },
    ];
    expect(fitCubeClock(moves).map((m) => m.t)).toEqual([1000, 1200, 1400, 1500]);
  });

  it("never returns decreasing times", () => {
    const moves = [100, 90, 300].map((cubeT, i) => ({ move: "R", hostT: 1000 + i * 100, cubeT }));
    const times = fitCubeClock(moves).map((m) => m.t);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});


describe("normalizeTurns", () => {
  it.each([
    ["R@0 R@59", "R2@59"],
    ["R'@0 R'@40", "R2@40"],
    [`R@0 R@${HALF_TURN_MS}`, `R2@${HALF_TURN_MS}`],
    [`R@0 R@${HALF_TURN_MS + 1}`, `R@0 R@${HALF_TURN_MS + 1}`],
    ["R@0 R'@20", "R@0 R'@20"],
    ["R@0 L@20", "R@0 L@20"],
    ["R2@0 R@20", "R2@0 R@20"],
    ["R@0 R@30 R@60", "R2@30 R@60"],
    ["U@0 R@200 R@250 U@400", "U@0 R2@250 U@400"],
    ["R@0 U@30 R@60", "R@0 U@30 R@60"],
    ["R@0 L@10 R@40 L@50", "R2@40 L2@50"],
    ["R@0 L'@10 R@40 L'@50", "R2@40 L2@50"],
    ["R@0 L@10 R@40", "L@10 R2@40"],
    ["U@0 D'@20 U@200", "U@0 D'@20 U@200"],
    ["R@0 L@10 L@30 R@60", "L2@30 R2@60"],
  ])("%s → %s", (input, output) => {
    expect(normalizeTurns(stream(input))).toEqual(stream(output));
  });

  it("turns the i4 T-perm's R R into R2, giving the human 14 moves", () => {
    const moves = normalizeTurns(fitCubeClock(I4_TPERM));
    expect(moves.map((m) => m.move).join(" ")).toBe("R U R' U' R' F R2 U' R' U' R U R' F'");
  });
});

describe("normalizeStream", () => {
  const rotation = (r: RotationEvent["rotation"], after: number, t: number): RotationEvent => ({ rotation: r, after, t });

  it.each([
    {
      name: "shifts rotations past a merged half turn",
      moves: "U@0 R@200 R@250 F@400",
      rotations: [rotation("y", 4, 450)],
      expected: [rotation("y", 3, 450)],
    },
    {
      name: "keeps a rotation that sits before the pair",
      moves: "U@0 R@200 R@250 F@400",
      rotations: [rotation("y", 1, 100)],
      expected: [rotation("y", 1, 100)],
    },
    {
      name: "joins a wide half turn's two quarter rotations (L L with x x → L2 with x2)",
      moves: "L@0 L@60",
      rotations: [rotation("x", 1, 0), rotation("x", 2, 60)],
      expected: [rotation("x2", 1, 60)],
    },
    {
      name: "puts a slice's rotation after both of its half turns (R L R L with x2 → R2 L2 with x2)",
      moves: "R@0 L@10 R@40 L@50",
      rotations: [rotation("x2", 4, 80)],
      expected: [rotation("x2", 2, 80)],
    },
    {
      name: "drops a rotation undone at the same place",
      moves: "R@0 U@300",
      rotations: [rotation("y", 1, 100), rotation("y'", 1, 200)],
      expected: [],
    },
    {
      name: "keeps different axes apart",
      moves: "R@0 U@300",
      rotations: [rotation("y", 1, 100), rotation("x", 1, 200)],
      expected: [rotation("y", 1, 100), rotation("x", 1, 200)],
    },
  ])("$name", ({ moves, rotations, expected }) => {
    expect(normalizeStream(stream(moves), rotations).rotations).toEqual(expected);
  });

  it("refuses a rotation placed after more turns than exist", () => {
    expect(() => normalizeStream(stream("R U"), [rotation("y", 3, 0)])).toThrow();
  });
});
