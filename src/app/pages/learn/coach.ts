// Coaching an alg on the smart cube: the case is on screen, he turns his own cube (in any state: only its turns
// count), and each turn is checked against the alg as it comes. A turn that keeps to it plays on the case and moves
// him on; one that doesn't plays too (so he sees what he did), and the way back to where he left the alg is led like
// the scramble is (smartcube/route.ts): he carries on once he's there, or where the alg would be further on.
//
// His turns arrive named by the centre they turned. Which centre is his R depends on how he holds the cube, which is
// read off the turns themselves: of the 24 ways to hold it, the ones whose reading of his turns keeps to the alg stay
// in the running (with the face on top, by gravity, if the gyro gives it), and a turn or two settles it. Nothing else
// is read from the gyro: a wide move, slice or rotation in the alg is known from the alg, and his turns after it are
// named as they must be if he did it.

import { FrameTracker, SOLVED, applyMove, stateKey, type CubeState } from "@/cube";
import type { Move, Rotation } from "@/cube/types";
import { GRID } from "@/app/smartcube/gyro";
import { followRoute, routeFrom, type Route } from "@/app/smartcube/route";

function quarters(move: Move): number {
  return move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
}

function turnOf(face: string, amount: number): Move {
  return amount === 2 ? `${face}2` : amount === 3 ? `${face}'` : face;
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

/** Whether a turn keeps to `step` with `progress` towards it: finishes one of its faces, or is half of a half turn. */
function fits(step: Step | undefined, progress: ReadonlyMap<string, number>, move: Move): boolean {
  if (!step) return false;
  const face = move.charAt(0);
  const target = step.target.get(face);
  const so = progress.get(face) ?? 0;
  if (target === undefined || so === target) return false;
  const now = (so + quarters(move)) % 4;
  return now === target || (target === 2 && now !== 2);
}

function complete(step: Step, progress: ReadonlyMap<string, number>): boolean {
  return [...step.target].every(([face, amount]) => progress.get(face) === amount);
}

const OPPOSITE: Readonly<Record<string, string>> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

/** Two moves he can flick together, either landing first (a G perm's D U'): turns of opposite faces, nothing else. */
function together(a: Step | undefined, b: Step | undefined): boolean {
  if (!a || !b || a.rotation || b.rotation || a.target.size !== 1 || b.target.size !== 1) return false;
  const [face] = a.target.keys();
  const [other] = b.target.keys();
  return face !== undefined && OPPOSITE[face] === other;
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
  /** Towards the move after it, when the two go together and that one's turn landed first. */
  ahead: Map<string, number>;
  /** The cube on screen's names: it rotates with the alg's rotations, as he does. */
  screen: FrameTracker;
  /** The case as he's turned it (from solved: only whether he's back where he left the alg matters). */
  state: CubeState;
};

function copy(reading: Reading): Reading {
  return { ...reading, progress: new Map(reading.progress), ahead: new Map(reading.ahead), screen: new FrameTracker(reading.screen.frame) };
}

/** Off the alg: the way back to where he left it, in his view, and how far along it he is (as the scramble shows). */
export type WayBack = {
  moves: string[];
  done: number;
  /** One quarter of the next move, a half turn, is done. */
  half: boolean;
};

export type CoachView = {
  /** The alg's moves done: the next to do is moves[next]. */
  next: number;
  /** Off the alg: the way back onto it; null while on it. */
  back: WayBack | null;
  /** Times this rep left the alg. */
  slips: number;
  /** The rep is done: every move of the alg (a last AUF may be left off). */
  done: boolean;
};

export class AlgCoach {
  readonly #steps: Step[];
  /** Per move: it and the next go together, so either's turn may come first. */
  readonly #together: boolean[];
  /** The alg is done once this many moves are: a last AUF can be left off (and rotations after it don't count). */
  readonly #required: number;
  /** The ways of holding the cube his turns so far fit, likeliest first (the first is what the screen shows). */
  #readings: Reading[];
  #upKnown = false;
  /** Off the alg: the way back to where he left it (read the first reading's way), and where his turns leave the case. */
  #back: Route | null = null;
  #offState: CubeState = SOLVED;
  #slips = 0;
  /** Rotations the alg opens with (x R' U R' ...): the cube on screen starts turned by them. */
  readonly opening: readonly string[];

  constructor(moves: readonly string[]) {
    this.#steps = stepsOf(moves);
    this.#together = this.#steps.map((step, i) => together(step, this.#steps[i + 1]));
    let required = moves.length;
    if (/^U(2|')?$/.test(moves.at(-1) ?? "")) required--;
    while (required > 0 && this.#steps[required - 1]!.target.size === 0) required--;
    this.#required = required;
    this.#readings = GRIPS.map((grip) => ({ grip, next: 0, progress: new Map(), ahead: new Map(), screen: new FrameTracker(), state: SOLVED }));
    const opening = this.#readings.map((reading) => this.#passRotations(reading));
    this.opening = opening[0] ?? [];
  }

  view(): CoachView {
    const reading = this.#readings[0]!;
    const route = this.#back;
    const back = route && { moves: route.moves.map((move) => reading.screen.name(move)), done: route.anchor, half: route.half };
    return { next: reading.next, back, slips: this.#slips, done: this.#done() };
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
    if (!this.#back) {
      const kept = this.#readings.flatMap((reading) => {
        const move = reading.grip.name(reported);
        const towards = this.#towards(reading, move);
        if (!towards) return [];
        const next = copy(reading);
        const shown = [next.screen.name(move)];
        next.state = applyMove(next.state, move);
        shown.push(...this.#advance(next, move, towards), ...this.#passRotations(next));
        return [{ next, shown }];
      });
      if (kept.length > 0) {
        this.#readings = kept.map(({ next }) => next);
        return kept[0]!.shown;
      }
    }
    // Off the alg: read the likeliest way, and back on it once the case is where he left it, or where the alg would
    // have it further on (a U' done as U U U, or a wrong U put right with U2).
    const reading = this.#readings[0]!;
    const move = reading.grip.name(reported);
    if (!this.#back) {
      this.#back = routeFrom(reading.state, []);
      this.#offState = reading.state;
      this.#slips++;
    }
    this.#offState = applyMove(this.#offState, move);
    const shown = [reading.screen.name(move)];
    if (stateKey(this.#offState) === stateKey(reading.state)) {
      this.#back = null;
      return shown;
    }
    const rejoined = this.#rejoin(reading, this.#offState);
    if (rejoined) {
      this.#readings = [reading];
      this.#back = null;
      return [...shown, ...rejoined];
    }
    this.#back = followRoute(this.#back, this.#offState, move);
    return shown;
  }

  #done(): boolean {
    return !this.#back && this.#readings[0]!.next >= this.#required;
  }

  /** Which move a turn (in his view) keeps to: the current one, or the next when the two go together; null if neither. */
  #towards(reading: Reading, move: Move): "current" | "ahead" | null {
    if (fits(this.#steps[reading.next], reading.progress, move)) return "current";
    if (this.#together[reading.next] && fits(this.#steps[reading.next + 1], reading.ahead, move)) return "ahead";
    return null;
  }

  /**
   * Counts a turn that keeps to the move; when it finishes a wide move or slice, the rotation it carries (to play).
   * Finishing the current move can finish the next as well, if that one's turn landed first.
   */
  #advance(reading: Reading, move: Move, towards: "current" | "ahead"): string[] {
    const face = move.charAt(0);
    const progress = towards === "current" ? reading.progress : reading.ahead;
    progress.set(face, ((progress.get(face) ?? 0) + quarters(move)) % 4);
    const rotations: string[] = [];
    for (let step = this.#steps[reading.next]; step && step.target.size > 0 && complete(step, reading.progress); step = this.#steps[reading.next]) {
      reading.progress = reading.ahead;
      reading.ahead = new Map();
      reading.next++;
      if (!step.rotation) continue;
      reading.screen.rotate(step.rotation);
      rotations.push(step.rotation);
    }
    return rotations;
  }

  /**
   * Whether `state` is where the alg would have the case some moves on from `reading`; if so, moves the reading there
   * and returns the rotations it passed (to play), else null.
   */
  #rejoin(reading: Reading, state: CubeState): string[] | null {
    const key = stateKey(state);
    let ahead = reading.state;
    for (let at = reading.next; at < this.#steps.length; at++) {
      const progress = at === reading.next ? reading.progress : at === reading.next + 1 ? reading.ahead : new Map<string, number>();
      for (const [face, amount] of this.#steps[at]!.target) {
        const left = (amount - (progress.get(face) ?? 0) + 4) % 4;
        if (left > 0) ahead = applyMove(ahead, turnOf(face, left));
      }
      if (stateKey(ahead) !== key) continue;
      const rotations: string[] = [];
      for (const step of this.#steps.slice(reading.next, at + 1)) {
        if (!step.rotation) continue;
        rotations.push(step.rotation);
        reading.screen.rotate(step.rotation);
      }
      reading.next = at + 1;
      reading.progress = new Map();
      reading.ahead = new Map();
      reading.state = state;
      return [...rotations, ...this.#passRotations(reading)];
    }
    return null;
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
