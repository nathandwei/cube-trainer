import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FrameTracker } from "@/cube";
import type { Rotation } from "@/cube/types";
import { humanize } from "@/cube";
import {
  CoreWatch,
  GRID,
  GYRO_TUNING,
  RotationDetector,
  angleBetween,
  multiply,
  newPlacement,
  placeCoreTurn,
  rotationQuaternion,
  rotationSince,
  snap,
  startOrientation,
  wideMoveEnd,
  type CoreTurn,
  type Quaternion,
} from "./gyro";

const S = Math.SQRT1_2;
/** How the cube was resting in a real capture (GAN i4, upstream fixture): tilted, as in a hand. */
const RESTING: Quaternion = { w: 0.9652699362163152, x: -0.25247962889492476, y: -0.05533005767998291, z: -0.037659840693380534 };

/** A rotation by `degrees` about a solver axis (x right, y up, z front), signed like the x/y/z moves at 90. */
function solverTurn(axis: "x" | "y" | "z", degrees: number): Quaternion {
  const half = (-degrees * Math.PI) / 360;
  return { w: Math.cos(half), x: axis === "x" ? Math.sin(half) : 0, y: axis === "y" ? Math.sin(half) : 0, z: axis === "z" ? Math.sin(half) : 0 };
}

/** What the cube would report after turning by `solver` (in the solver's view) from `start`. */
function reportAfter(start: Quaternion, solver: Quaternion): Quaternion {
  const inCubeAxes = { w: solver.w, x: -solver.x, y: -solver.z, z: -solver.y };
  return multiply(start, inCubeAxes);
}

describe("orientation grid", () => {
  it("has the 24 orientations, each reached by its rotations", () => {
    expect(GRID).toHaveLength(24);
    for (const g of GRID) {
      const reached = g.rotations.reduce<Quaternion>((q, r) => multiply(snapRotation(r), q), { w: 1, x: 0, y: 0, z: 0 });
      expect(angleBetween(reached, g.q)).toBeLessThan(0.01);
    }
  });

  it.each([
    ["x", { w: S, x: -S, y: 0, z: 0 }],
    ["y", { w: S, x: 0, y: -S, z: 0 }],
    ["z'", { w: S, x: 0, y: 0, z: S }],
  ] as const)("%s turns the cube like the matching face turn", (rotation, q) => {
    expect(snap(q).orientation.rotations).toEqual([rotation]);
  });
});

function snapRotation(rotation: Rotation): Quaternion {
  const found = GRID.find((g) => g.rotations.length === 1 && g.rotations[0] === rotation);
  if (!found) throw new Error(rotation);
  return found.q;
}

describe("rotationSince", () => {
  it.each([
    ["y", "y", 90],
    ["y'", "y", -90],
    ["x", "x", 90],
    ["z2", "z", 180],
  ] as const)("reads a %s regrip from a tilted start", (name, axis, degrees) => {
    const delta = rotationSince(RESTING, reportAfter(RESTING, solverTurn(axis, degrees)));
    expect(snap(delta).orientation.rotations).toEqual([name]);
    expect(snap(delta).degrees).toBeLessThan(0.01);
  });

  it("calls a turn about the white-yellow axis, clockwise seen from yellow, y", () => {
    // In the solver's grip white faces down, so that is +90° about the cube's own +Z (white) axis.
    const aboutWhite = { w: Math.cos(Math.PI / 4), x: 0, y: 0, z: Math.sin(Math.PI / 4) };
    expect(snap(rotationSince(RESTING, multiply(RESTING, aboutWhite))).orientation.rotations).toEqual(["y"]);
  });
});

type Sample = { t: number; q: Quaternion };

/** Gyro reports every 90 ms: hold, turn about `axis` by `degrees` over `turnMs`, hold. */
function regrip(axis: "x" | "y" | "z", degrees: number, turnMs = 250, holdMs = 600, wobble = 4): Sample[] {
  const samples: Sample[] = [];
  for (let t = 0; t <= 300 + turnMs + holdMs; t += 90) {
    const progress = Math.min(1, Math.max(0, (t - 300) / turnMs));
    const noise = solverTurn("x", Math.sin(t / 37) * wobble);
    samples.push({ t, q: reportAfter(RESTING, multiply(noise, solverTurn(axis, degrees * progress))) });
  }
  return samples;
}

function detect(samples: readonly Sample[]) {
  const detector = new RotationDetector(samples[0]!.q);
  return samples.flatMap(({ t, q }) => {
    const found = detector.sample(q, t);
    return found ? [found] : [];
  });
}

describe("RotationDetector", () => {
  it.each([
    { name: "a y regrip", axis: "y", degrees: 90, expected: ["y"] },
    { name: "a y' regrip", axis: "y", degrees: -90, expected: ["y'"] },
    { name: "an x2", axis: "x", degrees: 180, expected: ["x2"] },
    { name: "a 45° tilt", axis: "x", degrees: 45, expected: [] },
    { name: "a 60° tilt", axis: "z", degrees: 60, expected: [] },
  ] as const)("reports $name as $expected", ({ axis, degrees, expected }) => {
    expect(detect(regrip(axis, degrees)).flatMap((d) => d.rotations)).toEqual(expected);
  });

  it.each([
    { start: "y", axis: "x", degrees: 90, expected: ["x"] },
    { start: "y", axis: "y", degrees: 90, expected: ["y"] },
    { start: "x", axis: "y", degrees: 90, expected: ["y"] },
    { start: "y'", axis: "z", degrees: -90, expected: ["z'"] },
  ] as const)("reads a $axis regrip from a solve that started $start away from the saved grip", ({ start, axis, degrees, expected }) => {
    const initial = GRID.find((g) => g.rotations.length === 1 && g.rotations[0] === start)!;
    const at = (t: number) => {
      const progress = Math.min(1, Math.max(0, (t - 300) / 250));
      return reportAfter(RESTING, multiply(solverTurn(axis, degrees * progress), initial.q));
    };
    const samples: Sample[] = Array.from({ length: 14 }, (_, i) => ({ t: i * 90, q: at(i * 90) }));
    const detector = new RotationDetector(samples[0]!.q, initial);
    const found = samples.flatMap(({ t, q }) => detector.sample(q, t)?.rotations ?? []);
    expect(found).toEqual(expected);
  });

  it("dates a regrip to when the cube first got close, not when it was confirmed", () => {
    const [found] = detect(regrip("y", 90, 250));
    // The turn runs from 300 to 550 ms; the report at 540 is the first within 25° of 90°.
    expect(found?.since).toBeLessThanOrEqual(540);
    expect(found?.since).toBeGreaterThanOrEqual(450);
  });

  it("ignores a brief flick that does not stay", () => {
    const flick: Sample[] = [0, 90, 180].map((t) => ({ t, q: RESTING }));
    flick.push({ t: 270, q: reportAfter(RESTING, solverTurn("y", 90)) });
    flick.push(...[360, 450, 540].map((t) => ({ t, q: RESTING })));
    expect(detect(flick)).toEqual([]);
    expect(GYRO_TUNING.dwellReports).toBeGreaterThan(1);
  });

  it("sees no rotation in a real T-perm held in one grip (GAN i4 capture)", () => {
    const fixture = JSON.parse(
      readFileSync(new URL("../../vendor/smartcube-web-bluetooth/captures/fixture_GANi4_A26E_gan-gen4_2026-04-14T11-38-02.json", import.meta.url), "utf8"),
    ) as { events: { event: { type: string; timestamp: number; quaternion?: Quaternion } }[] };
    const samples = fixture.events.flatMap(({ event }) => (event.quaternion ? [{ t: event.timestamp, q: event.quaternion }] : []));
    expect(samples.length).toBeGreaterThan(100);
    expect(detect(samples)).toEqual([]);
  });
});

describe("startOrientation", () => {
  it.each([
    { name: "no reference", reference: null, turn: solverTurn("y", 0), expected: null },
    { name: "the reference grip", reference: RESTING, turn: solverTurn("y", 5), expected: [] },
    { name: "a y' from it", reference: RESTING, turn: solverTurn("y", -88), expected: ["y'"] },
    { name: "a drifted 45°", reference: RESTING, turn: solverTurn("y", 45), expected: null },
  ])("from $name", ({ reference, turn, expected }) => {
    const found = startOrientation(reference, reportAfter(RESTING, turn));
    expect(found ? found.rotations : null).toEqual(expected);
  });
});

describe("wideMoveEnd", () => {
  const turns = (spec: string) =>
    spec.split(" ").map((token) => {
      const [move = "", at = "0"] = token.split("@");
      return { move, hostT: Number(at) };
    });

  it.each([
    { name: "r (L then x)", rotation: "x", spec: "U@0 L@400", since: 450, expected: 1 },
    { name: "r' (L' then x')", rotation: "x'", spec: "L'@400", since: 480, expected: 0 },
    { name: "l (R then x')", rotation: "x'", spec: "R@400", since: 450, expected: 0 },
    { name: "u (D then y)", rotation: "y", spec: "D@400", since: 450, expected: 0 },
    { name: "M (R and L' together, then x')", rotation: "x'", spec: "R@400 L'@420", since: 470, expected: 1 },
    { name: "r2 still as L L", rotation: "x2", spec: "L@400 L@460", since: 520, expected: 1 },
    { name: "M2 as four interleaved quarters", rotation: "x2", spec: "R@400 L'@415 R@430 L'@445", since: 470, expected: 3 },
    { name: "M2 as two pairs", rotation: "x2", spec: "R@400 R@415 L'@430 L'@445", since: 470, expected: 3 },
    { name: "r with later turns already in", rotation: "x", spec: "L@400 U@520 R'@600", since: 470, expected: 0 },
    { name: "a y regrip after R", rotation: "y", spec: "R@400", since: 600, expected: null },
    { name: "an L too long before", rotation: "x", spec: "L@0", since: 900, expected: null },
    { name: "l when R and L' are too far apart for M (L' then l is the same thing)", rotation: "x'", spec: "L'@300 R@400", since: 450, expected: 1 },
  ] as const)("finds $name", ({ rotation, spec, since, expected }) => {
    expect(wideMoveEnd(rotation, turns(spec), 0, new FrameTracker(), since)).toBe(expected);
  });

  it("names turns in the current view (after y, the centre at R is B)", () => {
    const view = new FrameTracker();
    view.rotate("y");
    const centreOnRight = view.frame.R;
    expect(wideMoveEnd("x'", [{ move: centreOnRight, hostT: 400 }], 0, view, 450)).toBe(0);
  });

  it("does not look before the previous rotation", () => {
    expect(wideMoveEnd("x", turns("L@400 U@410"), 1, new FrameTracker(), 450)).toBeNull();
  });
});

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

describe("CoreWatch", () => {
  /** Reports every 90 ms of the core at `at(t)` (solver's view) and the turns at their times, in time order. */
  function watch(turns: readonly (readonly [string, number])[], at: (t: number) => Quaternion, every = 90): CoreTurn[] {
    const core = new CoreWatch();
    const found: CoreTurn[] = [];
    const events = [
      ...turns.map(([move, t], i) => ({ t, run: () => core.turn(i, move, t) })),
      ...Array.from({ length: Math.floor(1500 / every) + 1 }, (_, k) => k * every).map((t) => ({
        t,
        run: () => found.push(...core.sample(reportAfter(RESTING, at(t)), t)),
      })),
    ].sort((a, b) => a.t - b.t);
    for (const event of events) event.run();
    return found;
  }

  /** The core turning `degrees` about `axis` over `ms` from `from` (signed like the x/y/z moves at 90). */
  const turning = (axis: "x" | "y" | "z", degrees: number, from: number, ms = 100) => (t: number) => solverTurn(axis, degrees * clamp01((t - from) / ms));

  it.each([
    { name: "M: R and L' together, the core turning like x'", turns: [["R", 500], ["L'", 510]], at: turning("x", -90, 480), expected: ["x'"] },
    { name: "M2 as four interleaved quarters", turns: [["R", 500], ["L'", 510], ["R", 560], ["L'", 570]], at: turning("x", 180, 480, 120), expected: ["x2"] },
    { name: "a fast M2 the gyro reads as 140°", turns: [["R", 500], ["L'", 510], ["R", 540], ["L'", 550]], at: turning("x", 140, 480, 90), expected: ["x2"] },
    {
      name: "a slow M2: two M halves 150 ms apart",
      turns: [["R", 500], ["L'", 510], ["R", 650], ["L'", 660]],
      at: (t: number) => solverTurn("x", -90 * clamp01((t - 480) / 100) - 90 * clamp01((t - 630) / 100)),
      expected: ["x2"],
    },
    { name: "S2 from F2 and B2", turns: [["F2", 500], ["B2", 505]], at: turning("z", 180, 480), expected: ["z2"] },
    { name: "R and L' turned by two hands, the core still", turns: [["R", 500], ["L'", 510]], at: turning("x", 0, 480), expected: [] },
    { name: "a plain turn while the hand tilts the cube", turns: [["R", 500], ["L'", 510]], at: turning("x", -30, 480), expected: [] },
    { name: "a lone L with the core turning (left to the detector: it may be a gyro spike)", turns: [["L", 500]], at: turning("x", 90, 480), expected: [] },
    {
      name: "r U R' U' r' done fast (the A perm's wide T perm shape)",
      turns: [["L", 500], ["U", 590], ["R'", 680], ["U'", 770], ["L'", 860]],
      at: (t: number) => solverTurn("x", 90 * clamp01((t - 480) / 90) - 90 * clamp01((t - 840) / 90)),
      expected: ["x", "x'"],
    },
    {
      name: "M' U R U' r': a wide move balancing a slice",
      turns: [["R'", 500], ["L", 505], ["U", 600], ["R", 690], ["U'", 780], ["L'", 870]],
      at: (t: number) => solverTurn("x", 90 * clamp01((t - 480) / 90) - 90 * clamp01((t - 850) / 90)),
      expected: ["x", "x'"],
    },
    {
      name: "a plain R the gyro reads as a 90° spike that drifts back with no turn",
      turns: [["R", 500], ["U", 900], ["R'", 1300]],
      at: (t: number) => solverTurn("x", -90 * clamp01((t - 480) / 90) + 90 * clamp01((t - 700) / 1000)),
      expected: [],
    },
  ] as const)("reads $name", ({ turns, at, expected }) => {
    expect(watch(turns, at).map((core) => core.rotation)).toEqual(expected);
  });

  it("won't measure across a report too old to rule out a regrip", () => {
    expect(watch([["R", 700], ["L'", 710]], turning("x", -90, 680), 600)).toEqual([]);
  });

  it("reads a final slice once told no more turns are coming, without waiting for the move gap", () => {
    const core = new CoreWatch();
    core.sample(RESTING, 400);
    core.turn(0, "R", 500);
    core.turn(1, "L'", 510);
    core.close();
    expect(core.sample(reportAfter(RESTING, solverTurn("x", -90)), 560).map((found) => found.rotation)).toEqual(["x'"]);
  });
});

describe("placeCoreTurn", () => {
  const still: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
  /** A slice CoreWatch read from these centre-frame turns, carrying `rotation` (centre frame). */
  const coreTurn = (turns: readonly string[], rotation: Rotation, after: Quaternion = still): CoreTurn => ({
    start: 0,
    end: turns.length - 1,
    rotation,
    before: { q: still, t: 900 },
    after: { q: after, t: 1100 },
    t: 1000 + (turns.length - 1) * 10,
  });

  it.each([
    { lead: [], move: "M" },
    { lead: ["y"], move: "M" },
    { lead: ["y'"], move: "M2" },
    { lead: ["y2"], move: "S'" },
    { lead: ["x"], move: "E" },
    { lead: ["x", "y"], move: "S2" },
    { lead: ["z'"], move: "M'" },
  ] as { lead: Rotation[]; move: string }[])("reads $move held $lead away from the solver's grip as $move", ({ lead, move }) => {
    // The turns the cube reports for the move, and the core's own rotation, from a tracker in the cube's frame.
    const view = new FrameTracker();
    for (const rotation of lead) view.rotate(rotation);
    const step = view.apply(move);
    const centre = ["M", "M'", "M2", "E", "E'", "E2", "S", "S'", "S2"].map((slice) => new FrameTracker().apply(slice)).find((found) => [...found.turns].sort().join() === [...step.turns].sort().join())!;
    const turns = step.turns.map((m, i) => ({ move: m, hostT: 1000 + i * 10 }));
    const placement = newPlacement(turns, lead);
    placeCoreTurn(placement, new RotationDetector(still), coreTurn(step.turns, centre.rotation!));
    const events = [
      ...lead.map((rotation) => ({ rotation, after: 0, t: 0 })),
      ...placement.placed.map((p) => ({ rotation: p.rotation, after: p.after, t: turns[p.turn!]!.hostT })),
    ];
    const texts = humanize(turns.map((turn) => ({ move: turn.move, t: turn.hostT })), events, () => false).map((token) => token.text);
    expect(texts.filter((text) => !/^[xyz]/.test(text))).toEqual([move]);
  });

  it("takes the place of a regrip the detector made of the slice's core turn", () => {
    const turns = [{ move: "R", hostT: 1000 }, { move: "L'", hostT: 1010 }];
    const placement = newPlacement(turns, []);
    placement.placed.push({ rotation: "x'", after: 2, hostT: 1050, turn: null });
    placeCoreTurn(placement, new RotationDetector(still), coreTurn(["R", "L'"], "x'"));
    expect(placement.placed).toEqual([{ rotation: "x'", after: 2, hostT: 1010, turn: 1 }]);
  });

  it("sets the detector's reading straight: a slice the gyro read short turned exactly its rotation", () => {
    const short = reportAfter(still, solverTurn("x", -60));
    const detector = new RotationDetector(still);
    placeCoreTurn(newPlacement([{ move: "R", hostT: 1000 }, { move: "L'", hostT: 1010 }], []), detector, coreTurn(["R", "L'"], "x'", short));
    expect(angleBetween(detector.reading(short), rotationQuaternion("x'"))).toBeLessThan(0.01);
    expect(detector.orientation.rotations).toEqual(["x'"]);
  });
});
