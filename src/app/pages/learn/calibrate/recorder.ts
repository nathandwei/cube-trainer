// One take of one case, recorded from the smart cube: what he turned, how he held it, and when the case was done.
// No React and no Bluetooth: the slide feeds it turns and gyro reports and animates what it hands back.
//
//   waiting ──first turn──▶ turning ──goal reached──▶ reached ──seal()──▶ (the take stands)
//   turning ──back to the case──▶ waiting          turning ──too many moves──▶ over
//
// Goal detection runs on the centre-frame state, which rotations never change. Rotations are measured against the
// solver's grip (see grip.ts) from the hold on (the cube reaching the case, or a ghost take starting), so the grip he
// starts from names his turns even when he regripped before the first one; while turning, each detected rotation is
// placed between turns the way the timer places them, so a wide move or slice reads as one move.

import { FrameTracker, applyAlg, applyMove, fitCubeClock, getCase, isGoalReached, stateKey, type CaseDef, type CubeState } from "@/cube";
import type { Move, Rotation, RotationEvent } from "@/cube/types";
import { RotationDetector, rotationsBetween, wideMoveEnd, type GridOrientation, type Quaternion } from "@/app/smartcube/gyro";
import { SCRAMBLE_GRIP, SOLVER_GRIP, keepsYellowUp, leadRotations, solverGripReport } from "./grip";
import { asAlg, moveCount, takeTokens, type Take } from "./notation";

const ROTATION = /^[xyz](2|')?$/;

/** Past this many moves (slice turn metric) the take has wandered off; he redoes it. */
export const MAX_MOVES = 30;

export type RecorderPhase = "waiting" | "turning" | "reached" | "over";

type Turn = { move: Move; hostT: number; cubeT: number | null };
type Placed = { rotation: Rotation; after: number; hostT: number; turn: number | null };

export class Recorder {
  readonly #caseDef: CaseDef;
  readonly #start: CubeState;
  readonly #startKey: string;
  #state: CubeState;
  #phase: RecorderPhase = "waiting";
  #holding = false;
  #sealed = false;
  #turns: Turn[] = [];
  #placed: Placed[] = [];
  #lead: Rotation[] = [];
  /** His view since the first turn: the lead rotations and every placed one. */
  #view = new FrameTracker();
  #lastAfter = 0;
  #detector: RotationDetector | null = null;
  /** The cube's latest gyro report, and the grip the take was held in (null: read it at the first turn). */
  #report: Quaternion | null = null;
  #grip: GridOrientation | null = null;
  /** Where the cube on screen faces, relative to the solver's grip, and the names its faces have. */
  #shown: GridOrientation = SOLVER_GRIP;
  #screen = new FrameTracker();

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

  /**
   * Turns count from now: the case is on the cube (or on screen, for a ghost take). `grip` is how he holds the cube
   * relative to the solver's grip: as it was scrambled (white on top) after following the band, a grip carried over
   * from the take before, or null when unknown, in which case he's taken to hold it the way the screen shows the case
   * when he makes his first turn. `report` is the cube's latest gyro report; null for a cube without a gyro (or a test
   * take), whose turns are then read in the solver's grip. Returns the rotations that turn the cube on screen to face
   * like his.
   */
  hold(report: Quaternion | null, grip: GridOrientation | null = SCRAMBLE_GRIP): string[] {
    this.#holding = true;
    this.#report = report;
    this.#grip = grip;
    this.#detector = null;
    if (!report || !grip) return [];
    this.#anchor(report, grip);
    return keepsYellowUp(grip) ? this.#face(grip) : [];
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

  /** A gyro report: the rotations to animate on screen, if the cube on screen should turn with him. */
  gyro(q: Quaternion, hostT: number): string[] {
    this.#report = q;
    if (!this.#detector) {
      // The cube's first report since the hold: the grip it was held in can be read from now.
      if (!this.#holding || !this.#grip || this.#phase !== "waiting") return [];
      this.#anchor(q, this.#grip);
      return keepsYellowUp(this.#grip) ? this.#face(this.#grip) : [];
    }
    const detector = this.#detector;
    // Sampled even once the take stands, so his grip is still known when the next take starts.
    const found = detector.sample(q, hostT);
    if (!found || this.#sealed) return [];
    if (this.#phase === "waiting") {
      // Turning the cube over from scrambling isn't part of his alg, so until the first turn the cube on screen
      // only follows him round the last layer.
      return keepsYellowUp(detector.orientation) ? this.#face(detector.orientation) : [];
    }
    if (this.#phase !== "over") for (const rotation of found.rotations) this.#place(rotation, found.since, found.rotations.length === 1);
    return this.#face(detector.orientation);
  }

  /** A centre-frame turn from the cube: the moves to animate on screen. */
  turn(move: Move, hostT: number, cubeT: number | null): string[] {
    if (!this.#holding || this.#phase === "reached" || this.#phase === "over") return [];
    const shown = this.#phase === "waiting" ? this.#begin() : [];
    this.#turns.push({ move, hostT, cubeT });
    this.#state = applyMove(this.#state, move);
    shown.push(this.#screen.name(move));
    this.#judge();
    return shown;
  }

  /** Test takes: one move as he would write it ("R", "M'", "y"), done at `t` as if on the cube. */
  play(token: string, t: number): string[] {
    if (!this.#holding || this.#phase === "over") return [];
    if (this.#phase === "reached") {
      // A rotation after the goal (Aa's closing x') still turns the cube on screen; it isn't part of the take.
      if (this.#sealed || !ROTATION.test(token)) return [];
      this.#screen.apply(token);
      return [token];
    }
    if (this.#phase === "waiting") this.#begin();
    const step = this.#view.apply(token);
    for (const move of step.turns) this.#turns.push({ move, hostT: t, cubeT: null });
    if (step.rotation) {
      const after = this.#turns.length;
      this.#placed.push({ rotation: step.rotation, after, hostT: t, turn: step.turns.length > 0 ? after - 1 : null });
      this.#lastAfter = after;
    }
    this.#state = applyAlg(this.#state, step.turns);
    this.#screen.apply(token);
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
      ...this.#lead.map((rotation) => ({ rotation, after: 0, t: 0 })),
      ...this.#placed.map(({ rotation, after, hostT, turn }) => ({
        rotation,
        after,
        t: turn !== null ? moves[turn]!.t : Math.min(end, Math.max(0, Math.round(hostT - t0))),
      })),
    ];
    return { moves, rotations };
  }

  /** The first turn: the grip he holds now is where his alg starts from. */
  #begin(): string[] {
    if (!this.#detector && this.#report) this.#anchor(this.#report, this.#grip ?? SOLVER_GRIP);
    const grip = this.#detector?.orientation ?? SOLVER_GRIP;
    this.#phase = "turning";
    this.#lead = leadRotations(grip);
    this.#view = new FrameTracker();
    for (const rotation of this.#lead) this.#view.rotate(rotation);
    this.#lastAfter = 0;
    return this.#face(grip);
  }

  /** A detector reading `report` as `grip`, already settled there (it would otherwise start from the solver's grip). */
  #anchor(report: Quaternion, grip: GridOrientation): void {
    const detector = new RotationDetector(solverGripReport(report, grip));
    for (let i = 0; i < 8 && detector.orientation !== grip; i++) detector.sample(report, 0);
    if (detector.orientation !== grip) throw new Error(`The gyro reference doesn't read back as ${grip.rotations.join(" ") || "the solver's grip"}`);
    this.#detector = detector;
  }

  /** Turns the cube on screen to face like his. */
  #face(target: GridOrientation): string[] {
    if (target === this.#shown) return [];
    // A copy: the list belongs to gyro.ts's shared orientation grid, and callers append turns to what this returns.
    const rotations = [...rotationsBetween(this.#shown, target)];
    this.#shown = target;
    for (const rotation of rotations) this.#screen.rotate(rotation);
    return rotations;
  }

  /** Puts a detected rotation after the turn it belongs to: a wide move's or slice's last turn, else when it began. */
  #place(rotation: Rotation, since: number, single: boolean): void {
    const turns = this.#turns;
    const wideEnd = single ? wideMoveEnd(rotation, turns, this.#lastAfter, this.#view, since) : null;
    const before = turns.filter((turn) => turn.hostT <= since).length;
    const after = wideEnd !== null ? wideEnd + 1 : Math.max(this.#lastAfter, before);
    this.#placed.push({ rotation, after, hostT: since, turn: wideEnd });
    this.#view.rotate(rotation);
    this.#lastAfter = after;
  }

  #judge(): void {
    if (isGoalReached(this.#caseDef.set, this.#state)) {
      this.#phase = "reached";
      return;
    }
    if (this.#turns.length > 0 && stateKey(this.#state) === this.#startKey) {
      // He turned it back to the case: the next turn starts the take afresh. (A regrip alone changes nothing.)
      this.#phase = "waiting";
      this.#turns = [];
      this.#placed = [];
      this.#lead = [];
      this.#state = this.#start;
      return;
    }
    if (moveCount(this.tokens()) > MAX_MOVES) this.#phase = "over";
  }
}
