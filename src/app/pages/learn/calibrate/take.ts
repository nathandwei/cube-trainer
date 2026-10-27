// The slide's take as a store for useSyncExternalStore: the Recorder does the work; this hands React a snapshot that
// only changes when something on screen does.

import type { GridOrientation, Quaternion } from "@/app/smartcube/gyro";
import { algMoveCount, caseState, scrambledState } from "@/cube";
import type { Move } from "@/cube/types";
import { moveCount } from "./notation";
import { Recorder, type RecorderPhase } from "./recorder";

export type TakeView = {
  /** The case's scramble the take runs on; null for a ghost take or before one is set. */
  scramble: string | null;
  /** The cube is in the case and turns are being recorded. */
  holding: boolean;
  phase: RecorderPhase;
  /** The take stands: `alg` is final. */
  sealed: boolean;
  /** The take as he did it, so far. */
  tokens: readonly string[];
  /** Moves in `tokens`. */
  moves: number;
  /** Once sealed: the take as the case's alg, and its moves. */
  alg: string | null;
  algMoves: number;
  executionMs: number;
};

const EMPTY: TakeView = { scramble: null, holding: false, phase: "waiting", sealed: false, tokens: [], moves: 0, alg: null, algMoves: 0, executionMs: 0 };

export class TakeStore {
  #recorder: Recorder | null = null;
  #scramble: string | null = null;
  #sealed = false;
  #view: TakeView = EMPTY;
  readonly #listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  view = (): TakeView => this.#view;

  get started(): boolean {
    return this.#recorder !== null;
  }

  get holding(): boolean {
    return this.#recorder?.holding ?? false;
  }

  /** How he holds the cube now, relative to the solver's grip; null while that isn't known. */
  get grip(): GridOrientation | null {
    return this.#recorder?.grip ?? null;
  }

  /** A fresh take on `scramble`'s case (not yet holding: the cube may still need scrambling into it). */
  start(caseId: string, scramble: string): void {
    this.#recorder = new Recorder(caseId, scrambledState(scramble));
    this.#scramble = scramble;
    this.#sealed = false;
    this.#changed();
  }

  /** A fresh ghost take: the case as the catalog draws it, recording at once (see Recorder.hold for the rest). */
  startAsDrawn(caseId: string, report: Quaternion | null, grip: GridOrientation | null): void {
    this.#recorder = new Recorder(caseId, caseState(caseId));
    this.#scramble = null;
    this.#sealed = false;
    this.#recorder.hold(report, grip);
    this.#changed();
  }

  /** No take: the next case is loading. */
  clear(): void {
    this.#recorder = null;
    this.#scramble = null;
    this.#sealed = false;
    this.#changed();
  }

  hold(report: Quaternion | null, grip?: GridOrientation | null): void {
    if (!this.#recorder || this.#recorder.holding) return;
    this.#recorder.hold(report, grip);
    this.#changed();
  }

  anchor(report: Quaternion, grip: GridOrientation): void {
    this.#recorder?.anchor(report, grip);
  }

  turn(move: Move, hostT: number, cubeT: number | null): string[] {
    const shown = this.#recorder?.turn(move, hostT, cubeT) ?? [];
    if (shown.length > 0) this.#changed();
    return shown;
  }

  gyro(q: Quaternion, hostT: number): void {
    const recorder = this.#recorder;
    if (!recorder) return;
    const revision = recorder.revision;
    recorder.gyro(q, hostT);
    if (recorder.revision !== revision) this.#changed();
  }

  play(token: string, t: number): string[] {
    const shown = this.#recorder?.play(token, t) ?? [];
    if (shown.length > 0) this.#changed();
    return shown;
  }

  seal(): void {
    if (!this.#recorder || this.#recorder.phase !== "reached" || this.#sealed) return;
    this.#recorder.seal();
    this.#sealed = true;
    this.#changed();
  }

  #changed(): void {
    const recorder = this.#recorder;
    if (!recorder) {
      this.#view = EMPTY;
    } else {
      const tokens = recorder.tokens();
      const alg = this.#sealed ? recorder.alg() : null;
      this.#view = {
        scramble: this.#scramble,
        holding: recorder.holding,
        phase: recorder.phase,
        sealed: this.#sealed,
        tokens,
        moves: moveCount(tokens),
        alg,
        algMoves: alg ? algMoveCount(alg) : 0,
        executionMs: this.#sealed ? recorder.executionMs() : 0,
      };
    }
    for (const listener of this.#listeners) listener();
  }
}
