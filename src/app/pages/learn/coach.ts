// Coaching an alg on the smart cube: the case is on screen, he turns his own cube (in any state: only its turns
// count), and each turn is checked against the alg as it comes. A turn that keeps to it plays on the case and moves
// him on; one that doesn't plays too (so he sees what he did) and must be undone before he carries on.
//
// His turns arrive named by the centre they turned. Which centre is his R depends on how he holds the cube, which is
// read off the turns themselves: of the 24 ways to hold it, the ones whose reading of his turns keeps to the alg stay
// in the running (with the face on top, by gravity, if the gyro gives it), and a turn or two settles it. Nothing else
// is read from the gyro: a wide move, slice or rotation in the alg is known from the alg, and his turns after it are
// named as they must be if he did it.

import { FrameTracker, SOLVED, applyMove, stateKey, type CubeState } from "@/cube";
import type { Move, Rotation } from "@/cube/types";
import { GRID } from "@/app/smartcube/gyro";

function quarters(move: Move): number {
  return move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
}

function invert(move: Move): Move {
  return move.endsWith("2") ? move : move.endsWith("'") ? move.charAt(0) : `${move}'`;
}

/** One move of the alg as the cube reports it: per face, the quarter turns it adds up to; and the rotation it makes. */
type Step = { target: Map<string, number>; rotation: Rotation | null };

function stepsOf(moves: readonly string[]): Step[] {
  const tracker = new FrameTracker();
  return moves.map((move) => {
    const { turns, rotation } = tracker.apply(move);
    const target = new Map<string, number>();
    for (const turn of turns) target.set(turn.charAt(0), ((target.get(turn.charAt(0)) ?? 0) + quarters(turn)) % 4);
    for (const [face, amount] of target) if (amount === 0) target.delete(face);
    return { target, rotation: rotation ?? null };
  });
}

/** A way he may hold the cube: reads a turn of a centre as the move it is in his view. */
type Grip = { name: (turn: Move) => Move };

const GRIPS: readonly Grip[] = GRID.map((orientation) => {
  const tracker = new FrameTracker();
  for (const rotation of orientation.rotations) tracker.rotate(rotation);
  return { name: (turn: Move) => tracker.name(turn) };
});

/** How far he is, if he holds the cube `grip`: each way of holding it reads his turns differently, so each keeps count. */
type Reading = {
  grip: Grip;
  /** The alg's moves done: the next to do is moves[next]. */
  next: number;
  /** Quarter turns so far, per face, towards the current move. */
  progress: Map<string, number>;
  /** The cube on screen's names: it rotates with the alg's rotations, as he does. */
  screen: FrameTracker;
  /** The case as he's turned it (from solved: only whether he's back where he left the alg matters). */
  state: CubeState;
};

function copy(reading: Reading): Reading {
  return { ...reading, progress: new Map(reading.progress), screen: new FrameTracker(reading.screen.frame) };
}

export type CoachView = {
  /** The alg's moves done: the next to do is moves[next]. */
  next: number;
  /** Off the alg: what undoes it, in his view, in order ("U'", "R'"); empty while on it. */
  undo: string[];
  /** Times this rep left the alg. */
  slips: number;
  /** The rep is done: every move of the alg (a last AUF may be left off). */
  done: boolean;
};

export class AlgCoach {
  readonly #steps: Step[];
  /** The alg is done once this many moves are: a last AUF can be left off (and rotations after it don't count). */
  readonly #required: number;
  /** The ways of holding the cube his turns so far fit, likeliest first (the first is what the screen shows). */
  #readings: Reading[];
  #upKnown = false;
  /** Off the alg: his turns since he left it (read the first reading's way), and where that leaves the case. */
  #off: Move[] = [];
  #offState: CubeState = SOLVED;
  #slips = 0;
  /** Rotations the alg opens with (x R' U R' ...): the cube on screen starts turned by them. */
  readonly opening: readonly string[];

  constructor(moves: readonly string[]) {
    this.#steps = stepsOf(moves);
    let required = moves.length;
    if (/^U(2|')?$/.test(moves.at(-1) ?? "")) required--;
    while (required > 0 && this.#steps[required - 1]!.target.size === 0) required--;
    this.#required = required;
    this.#readings = GRIPS.map((grip) => ({ grip, next: 0, progress: new Map(), screen: new FrameTracker(), state: SOLVED }));
    const opening = this.#readings.map((reading) => this.#passRotations(reading));
    this.opening = opening[0] ?? [];
  }

  view(): CoachView {
    const reading = this.#readings[0]!;
    return { next: reading.next, undo: this.#off.map(invert).reverse().map((move) => reading.screen.name(move)), slips: this.#slips, done: this.#done() };
  }

  /**
   * One of his turns, named by its centre as the cube reported it; `up` is the centre on top right now by gravity
   * (null without a gyro). Returns what the cube on screen plays: the turn in its own names, and the rotation of a
   * wide move or slice it finished, or of the alg's own rotations that come next.
   */
  turn(reported: Move, up: string | null): string[] {
    if (this.#done()) return [];
    if (!this.#upKnown && up) {
      const level = this.#readings.filter((reading) => reading.grip.name(up) === "U");
      if (level.length > 0) this.#readings = level;
      this.#upKnown = true;
    }
    if (this.#off.length === 0) {
      const kept = this.#readings.flatMap((reading) => {
        const move = reading.grip.name(reported);
        if (!this.#fits(reading, move)) return [];
        const next = copy(reading);
        const shown = [next.screen.name(move)];
        next.state = applyMove(next.state, move);
        shown.push(...this.#advance(next, move), ...this.#passRotations(next));
        return [{ next, shown }];
      });
      if (kept.length > 0) {
        this.#readings = kept.map(({ next }) => next);
        return kept[0]!.shown;
      }
    }
    // Off the alg: read the likeliest way, and back on it once the case is where he left it.
    const reading = this.#readings[0]!;
    const move = reading.grip.name(reported);
    if (this.#off.length === 0) {
      this.#offState = reading.state;
      this.#slips++;
    }
    this.#off.push(move);
    this.#offState = applyMove(this.#offState, move);
    if (stateKey(this.#offState) === stateKey(reading.state)) this.#off = [];
    return [reading.screen.name(move)];
  }

  #done(): boolean {
    return this.#off.length === 0 && this.#readings[0]!.next >= this.#required;
  }

  /** Whether a turn (in his view) keeps to the current move: finishes one of its faces, or is half of a half turn. */
  #fits(reading: Reading, move: Move): boolean {
    const step = this.#steps[reading.next];
    if (!step) return false;
    const face = move.charAt(0);
    const target = step.target.get(face);
    const so = reading.progress.get(face) ?? 0;
    if (target === undefined || so === target) return false;
    const now = (so + quarters(move)) % 4;
    return now === target || (target === 2 && now !== 2);
  }

  /** Counts a turn that keeps to the move; when it finishes a wide move or slice, the rotation it carries (to play). */
  #advance(reading: Reading, move: Move): string[] {
    const face = move.charAt(0);
    reading.progress.set(face, ((reading.progress.get(face) ?? 0) + quarters(move)) % 4);
    const step = this.#steps[reading.next]!;
    if (![...step.target].every(([f, amount]) => reading.progress.get(f) === amount)) return [];
    reading.progress = new Map();
    reading.next++;
    if (!step.rotation) return [];
    reading.screen.rotate(step.rotation);
    return [step.rotation];
  }

  /** Moves past rotations (a regrip in the alg): his turns after one are read as made in the new grip. */
  #passRotations(reading: Reading): string[] {
    const rotations: string[] = [];
    for (let step = this.#steps[reading.next]; step && step.target.size === 0; step = this.#steps[reading.next]) {
      if (step.rotation) {
        rotations.push(step.rotation);
        reading.screen.rotate(step.rotation);
      }
      reading.next++;
    }
    return rotations;
  }
}
