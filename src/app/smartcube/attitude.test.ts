import { describe, expect, it } from "vitest";
import type { Rotation } from "@/cube/types";
import { AmbientAttitude, type AttitudeSource } from "./attitude";
import type { ConnectionState, GyroListener, MoveListener } from "./connection";
import { SCRAMBLE_GRIP, reportAt } from "./follower";
import { GRID, angleBetween, multiply, snap, type Quaternion } from "./gyro";

const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
const grid = (rotation: Rotation) => GRID.find((g) => g.rotations.length === 1 && g.rotations[0] === rotation)!.q;

/** A turn of `degrees` about one of the solver's axes (right-hand rule). */
function tilt(axis: "x" | "y" | "z", degrees: number): Quaternion {
  const half = (degrees * Math.PI) / 360;
  return { ...IDENTITY, w: Math.cos(half), [axis]: Math.sin(half) };
}

/** The gyro's own heading is arbitrary: the world it reads against is turned this far round from the solver. */
const WORLD = tilt("y", -52);

/** The gyro report after turning by `turns` (solver's axes, in order) from the solver's grip. */
function reportAfter(...turns: Quaternion[]): Quaternion {
  return reportAt(multiply(WORLD, turns.reduce((total, turn) => multiply(turn, total), IDENTITY)));
}

function shownAs(attitude: Quaternion | null): string | null {
  if (!attitude) return null;
  const { orientation, degrees } = snap(attitude);
  return degrees < 1 ? orientation.rotations.join(" ") : `${degrees.toFixed(1)}° from ${orientation.rotations.join(" ")}`;
}

/** A cube link that reports what the test tells it to. */
class FakeLink implements AttitudeSource {
  orientationReference: Quaternion | null = null;
  state = { hasGyro: true, status: "connected", deviceName: "GAN 16ui" } as ConnectionState;
  t = 1000;
  readonly #gyro = new Set<GyroListener>();
  readonly #moves = new Set<MoveListener>();
  readonly #state = new Set<() => void>();

  onGyro(listener: GyroListener): () => void {
    this.#gyro.add(listener);
    return () => this.#gyro.delete(listener);
  }

  onMove(listener: MoveListener): () => void {
    this.#moves.add(listener);
    return () => this.#moves.delete(listener);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#state.add(listener);
    return () => this.#state.delete(listener);
  };

  /** Reports `q` every 90 ms for `ms`. */
  report(q: Quaternion, ms = 90): void {
    const until = this.t + ms;
    for (; this.t < until; this.t += 90) for (const listener of this.#gyro) listener(q, this.t);
  }

  turn(move: string): void {
    for (const listener of this.#moves) listener(move, this.t, null);
  }

  loseGyro(): void {
    this.state = { ...this.state, hasGyro: false, status: "reconnecting" };
    for (const listener of this.#state) listener();
  }

  /** Connected (again), before the cube has reported. */
  connect(deviceName = "GAN 16ui"): void {
    this.state = { ...this.state, hasGyro: false, status: "connected", deviceName };
    for (const listener of this.#state) listener();
  }
}

describe("AmbientAttitude", () => {
  it("knows nothing until the cube reports", () => {
    expect(new AmbientAttitude(new FakeLink(), null).current).toBeNull();
  });

  it("shows the cube's real tilt from its first report, and turns it round with the cube", () => {
    const link = new FakeLink();
    const attitude = new AmbientAttitude(link, null);
    link.report(reportAfter(grid("x")));
    expect(shownAs(attitude.current)).toBe("x");
    link.report(reportAfter(grid("x"), grid("y")));
    expect(shownAs(attitude.current)).toBe("x y");
  });

  it("stands upright from the grip saved by reset orientation", () => {
    const link = new FakeLink();
    link.orientationReference = reportAfter();
    const attitude = new AmbientAttitude(link, null);
    link.report(reportAfter(grid("y'")));
    expect(shownAs(attitude.current)).toBe("y'");
  });

  it("follows from the grip a scramble left the cube in", () => {
    const link = new FakeLink();
    const attitude = new AmbientAttitude(link, null);
    link.report(reportAfter(tilt("x", 40)));
    attitude.hold({ report: reportAfter(grid("z2")), grip: SCRAMBLE_GRIP });
    expect(shownAs(attitude.current)).toBe("z2");
    // Turned over to solve: upright.
    link.report(reportAfter());
    expect(shownAs(attitude.current)).toBe("");
  });

  it("tells its listeners, and stops when the gyro goes, reading the grip afresh when it's back", () => {
    const link = new FakeLink();
    const attitude = new AmbientAttitude(link, null);
    let heard = 0;
    attitude.subscribe(() => heard++);
    link.report(reportAfter());
    expect(heard).toBeGreaterThan(0);
    link.loseGyro();
    expect(attitude.current).toBeNull();
    link.report(reportAfter(grid("y")));
    expect(shownAs(attitude.current)).toBe("");
    link.report(reportAfter(grid("y"), grid("y")));
    expect(shownAs(attitude.current)).toBe("y");
  });

  it.each([
    { name: "guessed from the first report", reference: false, hold: false, anchored: false },
    { name: "saved by reset orientation", reference: true, hold: false, anchored: true },
    { name: "learnt from a scramble", reference: false, hold: true, anchored: true },
  ])("knows which way round the cube faces only when $name: $anchored", ({ reference, hold, anchored }) => {
    const link = new FakeLink();
    if (reference) link.orientationReference = reportAfter();
    const attitude = new AmbientAttitude(link, null);
    link.report(reportAfter(grid("y")));
    if (hold) attitude.hold({ report: reportAfter(grid("z2")), grip: SCRAMBLE_GRIP });
    expect(attitude.anchored).toBe(anchored);
    expect(attitude.grip !== null).toBe(anchored);
    link.loseGyro();
    expect(attitude.anchored).toBe(false);
  });

  it("leaves the cube square after an E slice the gyro read short", () => {
    const link = new FakeLink();
    const attitude = new AmbientAttitude(link, null);
    link.report(reportAfter(), 180);
    link.turn("U");
    link.turn("D'");
    link.report(reportAfter(tilt("y", 70)), 450);
    expect(angleBetween(attitude.current!, grid("y'"))).toBeLessThan(0.01);
  });

  describe("from one page load to the next", () => {
    class MemoryStorage {
      readonly items = new Map<string, string>();
      getItem(key: string): string | null {
        return this.items.get(key) ?? null;
      }
      setItem(key: string, value: string): void {
        this.items.set(key, value);
      }
    }

    /** A page load that lined the cube up from a scramble, then left it held at `pose`; when it ended (ms). */
    function earlierLoad(storage: MemoryStorage, pose: Quaternion): number {
      const link = new FakeLink();
      const start = 1_000_000;
      const attitude = new AmbientAttitude(link, storage, () => start + link.t);
      link.report(reportAfter(grid("z2")));
      attitude.hold({ report: reportAfter(grid("z2")), grip: SCRAMBLE_GRIP });
      link.report(reportAt(pose), 1200);
      return start + link.t;
    }

    it.each([
      { name: "the same cube, soon after", device: "GAN 16ui", later: 60_000, resumes: true },
      { name: "a cube left for half an hour", device: "GAN 16ui", later: 30 * 60_000, resumes: false },
      { name: "another cube", device: "GAN 12 ui", later: 60_000, resumes: false },
    ])("faces $name as it was left before it reports: $resumes", ({ device, later, resumes }) => {
      const storage = new MemoryStorage();
      const ended = earlierLoad(storage, multiply(WORLD, grid("y")));
      const link = new FakeLink();
      const attitude = new AmbientAttitude(link, storage, () => ended + later);
      link.connect(device);
      expect(attitude.anchored).toBe(resumes);
      expect(resumes ? shownAs(attitude.current) : attitude.current).toBe(resumes ? "y" : null);
    });
  });
});
