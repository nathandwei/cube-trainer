import { describe, expect, it } from "vitest";
import { reportAt } from "@/app/smartcube/follower";
import { GRID, multiply, type GridOrientation, type Quaternion } from "@/app/smartcube/gyro";
import { FrameTracker, applyAlg, caseScramble, caseState, createRng, getCase, isGoalReached, scrambledState } from "@/cube";
import type { Rotation } from "@/cube/types";
import { SETTLE_MS } from "./ghost";
import { SCRAMBLE_GRIP, SOLVER_GRIP, gridOf } from "./grip";
import { testLine, tidy } from "./notation";
import { MAX_MOVES, Recorder } from "./recorder";

const words = (alg: string) => alg.replace(/[()[\]]/g, " ").split(/\s+/).filter(Boolean);
const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** The gyro report after these rotations from the solver's grip, against a world turned round from the solver's. */
function report(...rotations: Rotation[]): Quaternion {
  const world = gridOf("y'").q;
  return reportAt(multiply(world, rotations.reduce((total, rotation) => multiply(gridOf(rotation).q, total), IDENTITY)));
}

/** How the recorder reads his grip, as rotations from the solver's grip ("" for it); null while it doesn't know. */
function named(grip: GridOrientation | null): string | null {
  return grip ? grip.rotations.join(" ") : null;
}

/**
 * A cube that reports like a GAN: quarter turns only (a half turn is two, 40 ms apart), with the cube's clock, and,
 * once it has been held at all (it has a gyro), where it's held every 90 ms as time passes.
 */
class Hand {
  t = 1000;
  /** Between one move's turns and the next (ms): 160 is a steady pace, 90 about 11 turns a second. */
  pace = 160;
  #held: Rotation[] | null = null;
  #next = 0;
  constructor(readonly recorder: Recorder) {}

  /** Time passes. */
  wait(ms: number): void {
    const until = this.t + ms;
    if (this.#held) for (; this.#next <= until; this.#next += 90) this.recorder.gyro(report(...this.#held), this.#next);
    this.t = until;
  }

  /** Centre-frame turns; returns what the screen animates. */
  turn(...moves: string[]): string[] {
    return moves.flatMap((move) => {
      const quarters = move.endsWith("2") ? [move.charAt(0), move.charAt(0)] : [move];
      return quarters.flatMap((quarter, i) => {
        this.wait(i === 0 ? this.pace : 40);
        return this.recorder.turn(quarter, this.t, this.t);
      });
    });
  }

  /** A slice's two opposite turns, quarter by quarter and interleaved, 15 ms apart (R L' R L' for M2). */
  together(...moves: string[]): string[] {
    const quarters = moves.map((move) => (move.endsWith("2") ? [move.charAt(0), move.charAt(0)] : [move]));
    const order = [0, 1].flatMap((k) => quarters.flatMap((list) => (list[k] ? [list[k]] : [])));
    return order.flatMap((quarter, i) => {
      this.wait(i === 0 ? this.pace : 15);
      return this.recorder.turn(quarter, this.t, this.t);
    });
  }

  /**
   * Holds the cube at `rotations` from the solver's grip from now on, long enough for even a tip (x, z) to read as
   * held: six reports. How the recorder reads his grip after.
   */
  hold(...rotations: Rotation[]): GridOrientation | null {
    if (!this.#held) this.#next = this.t + 90;
    this.#held = rotations;
    this.wait(540);
    return this.recorder.grip;
  }

  /** The core is at `rotations` from now on: a slice or wide move just turned it with its last turn. */
  turned(...rotations: Rotation[]): void {
    this.#held = rotations;
  }
}

/** Moves in his view done on a cube with a gyro: each wide move or slice turns the core with its turns; a regrip is held. */
function perform(hand: Hand, tokens: readonly string[], grip: Rotation[] = []): Rotation[] {
  const view = new FrameTracker();
  for (const rotation of grip) view.rotate(rotation);
  let held = [...grip];
  for (const token of tokens) {
    const step = view.apply(token);
    if (step.turns.length === 2) hand.together(...step.turns);
    else hand.turn(...step.turns);
    if (!step.rotation) continue;
    held = [...held, step.rotation];
    if (step.turns.length > 0) hand.turned(...held);
    else hand.hold(...held);
  }
  return held;
}

async function onCase(caseId: string, seed = 3): Promise<{ recorder: Recorder; scramble: string }> {
  const { scramble } = await caseScramble(caseId, createRng(seed));
  return { recorder: new Recorder(caseId, scrambledState(scramble)), scramble };
}

/** Centre-frame turns for moves done in the solver's grip. */
function centre(alg: string): string[] {
  const view = new FrameTracker();
  return words(alg).flatMap((token) => view.apply(token).turns);
}

describe("Recorder", () => {
  it.each(["OLL-27", "PLL-T", "F2L-1"])("records %s done on a cube without a gyro as its catalog alg", async (caseId) => {
    const { recorder, scramble } = await onCase(caseId);
    recorder.hold(null);
    const line = testLine(caseId, scrambledState(scramble));
    expect(line).not.toBeNull();
    const hand = new Hand(recorder);
    hand.turn(...centre((line ?? []).join(" ")));
    expect(recorder.phase).toBe("reached");
    expect(recorder.alg()).toBe(tidy(words(getCase(caseId).algs[0]!)).join(" "));
  });

  it.each(["COLL-T3", "EPLL-Ua", "PLL-Aa", "OLL-27"])("records %s done on a cube with a gyro as its catalog alg", async (caseId) => {
    const { recorder, scramble } = await onCase(caseId, 5);
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    hand.hold("z2");
    hand.hold();
    perform(hand, testLine(caseId, scrambledState(scramble)) ?? []);
    expect(recorder.phase).toBe("reached");
    // As the slide does: the take stands once the gyro has had a moment to settle.
    hand.wait(SETTLE_MS);
    recorder.seal();
    const alg = words(getCase(caseId).algs[0]!);
    expect(recorder.alg()).toBe(tidy(/^[xyz]/.test(alg.at(-1) ?? "") ? alg.slice(0, -1) : alg).join(" "));
  });

  it("records an A perm's wide T perm done fast, r and r' and all", () => {
    const alg = "R U R' F' r U R' U' r' F R2 U' R'";
    const start = caseState("PLL-Aa");
    // The angle the case is drawn from may need a U first.
    const line = ["", "U", "U'", "U2"].map((auf) => words(`${auf} ${alg}`)).find((tokens) => isGoalReached("PLL", applyAlg(start, centre(tokens.join(" ")))));
    expect(line).toBeDefined();
    const recorder = new Recorder("PLL-Aa", start);
    recorder.hold(report(), SOLVER_GRIP);
    const hand = new Hand(recorder);
    hand.hold();
    hand.pace = 90;
    perform(hand, line ?? []);
    expect(recorder.phase).toBe("reached");
    hand.wait(SETTLE_MS);
    recorder.seal();
    // Too quick for the tip reading (r' comes 0.4 s after r): CoreWatch reads the pair from the core's own turns.
    expect(recorder.alg()).toBe((line ?? []).join(" "));
  });

  it("ignores turns until the cube is in the case", async () => {
    const { recorder } = await onCase("OLL-27");
    expect(new Hand(recorder).turn("R")).toEqual([]);
    expect(recorder.turnCount).toBe(0);
  });

  it("starts over when he turns back to the case", async () => {
    const { recorder } = await onCase("OLL-27");
    recorder.hold(null);
    const hand = new Hand(recorder);
    hand.turn("R", "U");
    expect(recorder.phase).toBe("turning");
    hand.turn("U'", "R'");
    expect(recorder.phase).toBe("waiting");
    expect(recorder.turnCount).toBe(0);
  });

  it(`stops past ${MAX_MOVES} moves`, async () => {
    const { recorder } = await onCase("PLL-T");
    recorder.hold(null);
    const hand = new Hand(recorder);
    for (let i = 0; i <= MAX_MOVES && recorder.phase !== "over"; i++) hand.turn("R", "F");
    expect(recorder.phase).toBe("over");
    expect(hand.turn("U")).toEqual([]);
  });

  it("doesn't count turning the cube over from scrambling, and starts the alg from his regrip", async () => {
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    // His grip as he holds it: white on top, then turned over.
    expect(named(hand.hold("z2"))).toBe("z2");
    expect(named(hand.hold())).toBe("");
    // He turns the case round with a y.
    expect(named(hand.hold("y"))).toBe("y");
    // His R is the old back face now: the screen turns that layer (the y has put it on his right), named R in the take.
    expect(hand.turn("B", "U", "B'")).toEqual(["B", "U", "B'"]);
    expect(recorder.tokens()).toEqual(["y", "R", "U", "R'"]);
  });

  it("reads his grip after turning the cube over the other way", async () => {
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    hand.hold("z2");
    // Flipped with x2 from white on top: blue in front, which is y2 from the solver's grip.
    expect(named(hand.hold("y2"))).toBe("y2");
    hand.turn("L");
    expect(recorder.tokens()).toEqual(["y2", "R"]);
  });

  it("reads his grip as the solver's when the cube was already in the case", async () => {
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report(), SOLVER_GRIP);
    const hand = new Hand(recorder);
    expect(named(hand.hold())).toBe("");
    hand.turn("R");
    expect(recorder.tokens()).toEqual(["R"]);
  });

  it("reads a wide move from the core's rotation right after the turn", async () => {
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    hand.hold();
    expect(hand.turn("L")).toEqual(["L"]);
    hand.t -= 100;
    // The core turns like x a moment after the turn arrives: that's r.
    expect(named(hand.hold("x"))).toBe("x");
    expect(recorder.tokens()).toEqual(["r"]);
  });

  it("keeps a final slice's rotation that arrives after the goal, until sealed", async () => {
    const { recorder, scramble } = await onCase("EPLL-Ua", 5);
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    hand.hold();
    const line = testLine("EPLL-Ua", scrambledState(scramble)) ?? [];
    const last = line.at(-1) ?? "";
    // The last slice: its turns reach the goal, and only then does the core's rotation arrive.
    const held = perform(hand, line.slice(0, -1));
    const view = new FrameTracker();
    for (const rotation of held) view.rotate(rotation);
    const step = view.apply(last);
    hand.together(...step.turns);
    expect(recorder.phase).toBe("reached");
    hand.t -= 50;
    hand.hold(...held, ...(step.rotation ? [step.rotation] : []));
    recorder.seal();
    hand.hold();
    expect(recorder.alg()).toBe(getCase("EPLL-Ua").algs[0]);
  });

  it("never changes gyro.ts's shared orientation grid", async () => {
    const before = JSON.stringify(GRID.map((g) => g.rotations));
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    // Tipped over before the first turn, then turning.
    hand.hold("x");
    hand.turn("U", "R");
    hand.hold("x", "y");
    hand.turn("U");
    expect(JSON.stringify(GRID.map((g) => g.rotations))).toBe(before);
  });

  describe("ghost takes (the case on screen, his cube in any state)", () => {
    it("reads an unknown grip as the screen's at his first turn, then follows his regrips", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      recorder.hold(report("y'"), null);
      expect(recorder.grip).toBeNull();
      const hand = new Hand(recorder);
      // Before his first turn there's nothing to measure his grip against.
      expect(hand.hold("y'", "x")).toBeNull();
      expect(hand.hold("y'")).toBeNull();
      hand.turn("R");
      expect(named(hand.hold("y'", "y"))).toBe("y");
      hand.turn("B");
      expect(recorder.tokens()).toEqual(["R", "y", "R"]);
    });

    it("reads a grip carried over from the last take, and names his turns in it", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      recorder.hold(report("y"), gridOf("y"));
      expect(named(recorder.grip)).toBe("y");
      const hand = new Hand(recorder);
      expect(hand.turn("B", "U", "B'")).toEqual(["B", "U", "B'"]);
      expect(recorder.tokens()).toEqual(["y", "R", "U", "R'"]);
    });

    it("reads the grip from the cube's first report when the hold had none", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      recorder.hold(null, gridOf("y2"));
      expect(named(new Hand(recorder).hold("y2"))).toBe("y2");
      expect(recorder.grip).toBe(gridOf("y2"));
    });

    it("keeps following his grip after the take stands, for the next take", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      recorder.hold(report(), SOLVER_GRIP);
      recorder.play("R", 0);
      recorder.play("U", 150);
      recorder.play("R'", 300);
      recorder.play("U", 450);
      recorder.play("R", 600);
      recorder.play("U2", 750);
      recorder.play("R'", 900);
      expect(recorder.phase).toBe("reached");
      recorder.seal();
      expect(named(new Hand(recorder).hold("y"))).toBe("y");
      expect(recorder.grip).toBe(gridOf("y"));
    });

    it("takes a new reading of his grip", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      recorder.hold(report("x"), null);
      recorder.anchor(report("x"), SCRAMBLE_GRIP);
      expect(recorder.grip).toBe(SCRAMBLE_GRIP);
    });
  });

  it("plays a test take that starts with a rotation", () => {
    // The case as drawn needs no U turn, so the take's first move is Aa's x.
    const recorder = new Recorder("PLL-Aa", caseState("PLL-Aa"));
    recorder.hold(null);
    const line = testLine("PLL-Aa", caseState("PLL-Aa")) ?? [];
    expect(line[0]).toBe("x");
    const shown = line.flatMap((token, i) => recorder.play(token, 1000 + i * 150));
    expect(recorder.phase).toBe("reached");
    expect(recorder.alg()).toBe("x R' U R' D2 R U' R' D2 R2");
    // The closing x' comes after the goal: the cube on screen still turns back.
    expect(shown.at(-1)).toBe("x'");
  });

  it("plays a test take token by token, slices and all", async () => {
    const { recorder, scramble } = await onCase("EPLL-Ua", 5);
    recorder.hold(null);
    const line = testLine("EPLL-Ua", scrambledState(scramble)) ?? [];
    const shown = line.flatMap((token, i) => recorder.play(token, 1000 + i * 150));
    expect(shown).toEqual(line);
    expect(recorder.phase).toBe("reached");
    expect(recorder.alg()).toBe(getCase("EPLL-Ua").algs[0]);
    expect(recorder.executionMs()).toBe((line.length - 1) * 150);
  });
});
