// One take of one case, recorded from the smart cube: what he turned, how he held it, and when the case was done.
// No React and no Bluetooth: the slide feeds it turns and gyro reports, animates the turns it hands back and holds
// the cube on screen at the attitude it hands back (see follow.ts).
//
//   waiting ──first turn──▶ turning ──goal reached──▶ reached ──seal()──▶ (the take stands)
//   turning ──back to the case──▶ waiting          turning ──too many moves──▶ over
//
// Goal detection runs on the centre-frame state, which rotations never change. Rotations are measured against the
// solver's grip (see grip.ts) from the hold on (the cube reaching the case, or a ghost take starting), so the grip he
// starts from names his turns even when he regripped before the first one; while turning, each detected rotation is
// placed between turns the way the timer places them, so a wide move or slice reads as one move.

import { applyAlg, applyMove, fitCubeClock, getCase, isGoalReached, stateKey, type CaseDef, type CubeState } from "@/cube";
import type { Move, RotationEvent } from "@/cube/types";
import {
  CoreWatch,
  newPlacement,
  placeCoreTurn,
  placeRotation,
  type GridOrientation,
  type Placement,
  type Quaternion,
  type RotationDetector,
} from "@/app/smartcube/gyro";
import { CubeFollower } from "../follow";
import { SCRAMBLE_GRIP, SOLVER_GRIP, detectorAt, leadRotations } from "./grip";
import { asAlg, moveCount, takeTokens, type Take } from "./notation";

const ROTATION = /^[xyz](2|')?$/;

/** Past this many moves (slice turn metric) the take has wandered off; he redoes it. */
export const MAX_MOVES = 30;

export type RecorderPhase = "waiting" | "turning" | "reached" | "over";

type Turn = { move: Move; hostT: number; cubeT: number | null };

export class Recorder {
  readonly #caseDef: CaseDef;
  readonly #start: CubeState;
  readonly #startKey: string;
  #state: CubeState;
  #phase: RecorderPhase = "waiting";
  #holding = false;
  #sealed = false;
  #turns: Turn[] = [];
  /** The rotations among the turns since the first, and his view: the lead rotations and every placed one. */
  #placement: Placement = newPlacement(this.#turns, []);
  /** Reads wide moves and slices from the core's own turn. */
  #core = new CoreWatch();
  /** Bumped whenever a rotation is placed or replaced, so the take's tokens are read again. */
  #revision = 0;
  /** The take was played by Test, its rotations typed rather than read from the gyro. */
  #played = false;
  #detector: RotationDetector | null = null;
  /** The cube's latest gyro report, and the grip the take was held in (null: read it at the first turn). */
  #report: Quaternion | null = null;
  #grip: GridOrientation | null = null;
  /** The cube on screen's attitude, measured from the same grip as the detector. */
  readonly #follower = new CubeFollower();

  /** `start`: the case on the cube, centre frame (scrambledState of its scramble). */
  constructor(caseId: string, start: CubeState) {
    this.#caseDef = getCase(caseId);
    this.#start = start;
    this.#startKey = stateKey(start);
    this.#state = start;
  }

  get phase(): RecorderPhase {
    return this.#phase;
  }

  /** The cube is in the case and turns count from now. */
  get holding(): boolean {
    return this.#holding;
  }

  get turnCount(): number {
    return this.#turns.length;
  }

  /** Changes whenever a gyro report changes the take (a rotation placed, or a slice read in place of one). */
  get revision(): number {
    return this.#revision;
  }

  /**
   * Turns count from now: the case is on the cube (or on screen, for a ghost take). `grip` is how he holds the cube
   * relative to the solver's grip: as it was scrambled (white on top) after following the band, a grip carried over
   * from the take before, or null when unknown, in which case he's taken to hold it the way the screen shows the case
   * when he makes his first turn. `report` is the cube's latest gyro report; null for a cube without a gyro (or a test
   * take), whose turns are then read in the solver's grip. Returns the cube on screen's attitude, once known.
   */
  hold(report: Quaternion | null, grip: GridOrientation | null = SCRAMBLE_GRIP): Quaternion | null {
    this.#holding = true;
    this.#report = report;
    this.#grip = grip;
    this.#detector = null;
    this.#follower.reset();
    if (!report || !grip) return null;
    return this.#anchor(report, grip);
  }

  /** From now on the cube is `grip` away from the solver's grip (it was just read some other way). */
  anchor(report: Quaternion, grip: GridOrientation): void {
    this.#report = report;
    this.#grip = grip;
    this.#anchor(report, grip);
  }

  /** How he holds the cube now, relative to the solver's grip; null while that isn't known. */
  get grip(): GridOrientation | null {
    return this.#detector?.orientation ?? null;
  }

  /** A gyro report: the cube on screen's attitude, once known. */
  gyro(q: Quaternion, hostT: number): Quaternion | null {
    this.#report = q;
    if (!this.#detector) {
      // The cube's first report since the hold: the grip it was held in can be read from now.
      if (!this.#holding || !this.#grip || this.#phase !== "waiting") return null;
      return this.#anchor(q, this.#grip);
    }
    const detector = this.#detector;
    // Sampled even once the take stands, so his grip is still known when the next take starts.
    const found = detector.sample(q, hostT);
    const cores = this.#core.sample(q, hostT);
    // Turning the cube over from scrambling isn't part of his alg: rotations count from the first turn.
    if (!this.#sealed && (this.#phase === "turning" || this.#phase === "reached")) {
      if (found) for (const rotation of found.rotations) placeRotation(this.#placement, rotation, found.since, found.rotations.length === 1);
      for (const core of cores) placeCoreTurn(this.#placement, detector, core);
      if (found || cores.length > 0) this.#revision++;
    }
    return this.#follower.gyro(q, hostT);
  }

  /** A centre-frame turn from the cube: the moves to animate on screen (the turn itself, named as reported). */
  turn(move: Move, hostT: number, cubeT: number | null): string[] {
    if (this.#holding) this.#follower.turn(move, hostT);
    if (!this.#holding || this.#phase === "reached" || this.#phase === "over") return [];
    if (this.#phase === "waiting") this.#begin();
    this.#turns.push({ move, hostT, cubeT });
    this.#core.turn(this.#turns.length - 1, move, hostT);
    this.#state = applyMove(this.#state, move);
    this.#judge();
    return [move];
  }

  /** Test takes: one move as he would write it ("R", "M'", "y"), done at `t` as if on the cube. */
  play(token: string, t: number): string[] {
    if (!this.#holding || this.#phase === "over") return [];
    if (this.#phase === "reached") {
      // A rotation after the goal (Aa's closing x') still turns the cube on screen; it isn't part of the take.
      if (this.#sealed || !ROTATION.test(token)) return [];
      return [token];
    }
    if (this.#phase === "waiting") this.#begin();
    this.#played = true;
    const placement = this.#placement;
    const step = placement.view.apply(token);
    for (const move of step.turns) this.#turns.push({ move, hostT: t, cubeT: null });
    if (step.rotation) {
      const after = this.#turns.length;
      placement.placed.push({ rotation: step.rotation, after, hostT: t, turn: step.turns.length > 0 ? after - 1 : null });
      placement.lastAfter = after;
    }
    this.#state = applyAlg(this.#state, step.turns);
    this.#judge();
    return [token];
  }

  /** Ends the take once the last move's rotation (a final slice or wide move) has had time to arrive. */
  seal(): void {
    this.#sealed = true;
  }

  /** The take as he did it, so far. */
  tokens(): string[] {
    return takeTokens(this.take());
  }

  /** The take written as the case's alg (see notation.ts asAlg). */
  alg(): string {
    return asAlg(this.#caseDef.id, this.tokens()).join(" ");
  }

  /** First turn to last, on the cube's clock. */
  executionMs(): number {
    const moves = this.take().moves;
    return moves.at(-1)?.t ?? 0;
  }

  take(): Take {
    const fitted = fitCubeClock(this.#turns);
    const t0 = fitted[0]?.t ?? 0;
    const moves = fitted.map(({ move, t }) => ({ move, t: t - t0 }));
    const end = moves.at(-1)?.t ?? 0;
    const rotations: RotationEvent[] = [
      ...this.#placement.lead.map((rotation) => ({ rotation, after: 0, t: 0 })),
      ...this.#placement.placed.map(({ rotation, after, hostT, turn }) => ({
        rotation,
        after,
        t: turn !== null ? moves[turn]!.t : Math.min(end, Math.max(0, Math.round(hostT - t0))),
      })),
    ];
    return { moves, rotations, source: this.#played ? "demo" : "smartcube" };
  }

  /** The first turn: the grip he holds now is where his alg starts from. */
  #begin(): void {
    if (!this.#detector && this.#report) this.#anchor(this.#report, this.#grip ?? SOLVER_GRIP);
    const grip = this.#detector?.orientation ?? SOLVER_GRIP;
    this.#phase = "turning";
    this.#placement = newPlacement(this.#turns, leadRotations(grip));
  }

  /** Reads the cube as held `grip` away from the solver's grip from `report` on; the cube on screen's attitude. */
  #anchor(report: Quaternion, grip: GridOrientation): Quaternion | null {
    this.#detector = detectorAt(report, grip);
    return this.#follower.hold({ report, grip });
  }

  #judge(): void {
    if (isGoalReached(this.#caseDef.set, this.#state)) {
      this.#phase = "reached";
      // No more turns count: the last move's core turn can be read as soon as its report is in.
      this.#core.close();
      return;
    }
    if (this.#turns.length > 0 && stateKey(this.#state) === this.#startKey) {
      // He turned it back to the case: the next turn starts the take afresh. (A regrip alone changes nothing.)
      this.#phase = "waiting";
      this.#turns = [];
      this.#placement = newPlacement(this.#turns, []);
      this.#core = new CoreWatch();
      this.#state = this.#start;
      return;
    }
    if (moveCount(this.tokens()) > MAX_MOVES) this.#phase = "over";
  }
}
