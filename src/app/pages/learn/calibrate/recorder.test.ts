import { describe, expect, it } from "vitest";
import { GRID, multiply, type Quaternion } from "@/app/smartcube/gyro";
import { FrameTracker, caseScramble, caseState, createRng, getCase, scrambledState } from "@/cube";
import type { Rotation } from "@/cube/types";
import { SCRAMBLE_GRIP, SOLVER_GRIP, gridOf } from "./grip";
import { testLine, tidy } from "./notation";
import { MAX_MOVES, Recorder } from "./recorder";

const words = (alg: string) => alg.replace(/[()[\]]/g, " ").split(/\s+/).filter(Boolean);
const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

/** The gyro report after these rotations from the solver's grip (the fake GAN cube's __cubeQuat). */
function report(...rotations: Rotation[]): Quaternion {
  const q = rotations.reduce((total, rotation) => multiply(gridOf(rotation).q, total), IDENTITY);
  return { w: q.w, x: -q.x, y: -q.z, z: -q.y };
}

/** A cube that reports like a GAN: quarter turns only (a half turn is two, 40 ms apart), with the cube's clock. */
class Hand {
  t = 1000;
  constructor(readonly recorder: Recorder) {}

  /** Centre-frame turns; returns what the screen animates. */
  turn(...moves: string[]): string[] {
    return moves.flatMap((move) => {
      const quarters = move.endsWith("2") ? [move.charAt(0), move.charAt(0)] : [move];
      return quarters.flatMap((quarter, i) => {
        this.t += i === 0 ? 160 : 40;
        return this.recorder.turn(quarter, this.t, this.t);
      });
    });
  }

  /** A slice's two opposite turns, quarter by quarter and interleaved, 15 ms apart (R L' R L' for M2). */
  together(...moves: string[]): string[] {
    const quarters = moves.map((move) => (move.endsWith("2") ? [move.charAt(0), move.charAt(0)] : [move]));
    const order = [0, 1].flatMap((k) => quarters.flatMap((list) => (list[k] ? [list[k]] : [])));
    return order.flatMap((quarter, i) => {
      this.t += i === 0 ? 160 : 15;
      return this.recorder.turn(quarter, this.t, this.t);
    });
  }

  /** Holds the cube at `rotations` from the solver's grip for three gyro reports. */
  hold(...rotations: Rotation[]): string[] {
    return [0, 1, 2].flatMap(() => {
      this.t += 90;
      return this.recorder.gyro(report(...rotations), this.t);
    });
  }
}

/** Moves in his view done on a cube with a gyro: each wide move, slice or regrip turns the core a moment after its turns. */
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
    // The gyro sees the core settle just after the move's last turn.
    if (step.turns.length > 0) hand.t -= 50;
    hand.hold(...held);
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
    recorder.seal();
    const alg = words(getCase(caseId).algs[0]!);
    expect(recorder.alg()).toBe(tidy(/^[xyz]/.test(alg.at(-1) ?? "") ? alg.slice(0, -1) : alg).join(" "));
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
    expect(hand.hold("z2")).toEqual([]);
    expect(hand.hold()).toEqual([]);
    // He turns the case round with a y: the cube on screen follows.
    expect(hand.hold("y")).toEqual(["y"]);
    // His R is the old back face now; the screen turns its own right face.
    expect(hand.turn("B", "U", "B'")).toEqual(["R", "U", "R'"]);
    expect(recorder.tokens()).toEqual(["y", "R", "U", "R'"]);
  });

  it("reads his grip after turning the cube over the other way", async () => {
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    hand.hold("z2");
    // Flipped with x2 from white on top: blue in front, which is y2 from the solver's grip.
    expect(hand.hold("y2")).toEqual(["y2"]);
    hand.turn("L");
    expect(recorder.tokens()).toEqual(["y2", "R"]);
  });

  it("reads his grip as the solver's when the cube was already in the case", async () => {
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report(), SOLVER_GRIP);
    const hand = new Hand(recorder);
    expect(hand.hold()).toEqual([]);
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
    // The core turns like x a moment after the turn arrives: that's r, and the screen turns with it.
    expect(hand.hold("x")).toEqual(["x"]);
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
    expect(hand.hold()).toEqual([]);
    expect(recorder.alg()).toBe(getCase("EPLL-Ua").algs[0]);
  });

  it("never changes gyro.ts's shared orientation grid", async () => {
    const before = JSON.stringify(GRID.map((g) => g.rotations));
    const { recorder } = await onCase("OLL-27");
    recorder.hold(report("z2"));
    const hand = new Hand(recorder);
    // Tipped over before the first turn: the screen only turns to match at the turn itself.
    hand.hold("x");
    hand.turn("U", "R");
    hand.hold("x", "y");
    hand.turn("U");
    expect(JSON.stringify(GRID.map((g) => g.rotations))).toBe(before);
  });

  describe("ghost takes (the case on screen, his cube in any state)", () => {
    it("reads an unknown grip as the screen's at his first turn, then follows his regrips", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      expect(recorder.hold(report("y'"), null)).toEqual([]);
      const hand = new Hand(recorder);
      // Before his first turn there's nothing to measure his grip against.
      expect(hand.hold("y'", "x")).toEqual([]);
      expect(hand.hold("y'")).toEqual([]);
      hand.turn("R");
      expect(hand.hold("y'", "y")).toEqual(["y"]);
      hand.turn("B");
      expect(recorder.tokens()).toEqual(["R", "y", "R"]);
    });

    it("faces the screen to a grip carried over from the last take, and names his turns in it", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      expect(recorder.hold(report("y"), gridOf("y"))).toEqual(["y"]);
      const hand = new Hand(recorder);
      expect(hand.turn("B", "U", "B'")).toEqual(["R", "U", "R'"]);
      expect(recorder.tokens()).toEqual(["y", "R", "U", "R'"]);
    });

    it("reads the grip from the cube's first report when the hold had none", () => {
      const recorder = new Recorder("OLL-27", caseState("OLL-27"));
      recorder.hold(null, gridOf("y2"));
      expect(new Hand(recorder).hold("y2")).toEqual(["y2"]);
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
      expect(new Hand(recorder).hold("y")).toEqual([]);
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
