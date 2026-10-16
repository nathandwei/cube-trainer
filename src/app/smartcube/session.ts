// One smart-cube attempt after another, driven by what the cube reports. No React and no Bluetooth here: the
// connection feeds it turns, gyro reports and state reports, and it decides what the timer shows.
//
//   waiting ──state known + scramble──▶ scrambling ──cube matches the scramble──▶ inspecting? ──▶ ready
//   ready / inspecting ──first turn──▶ solving ──cube solved──▶ (saved) waiting
//   solving ──connection lost──▶ lost ──key press or solved report──▶ (saved) waiting
//
// Scramble progress is read from the cube's state, never from matching turns, so any order of turns that reaches a
// scramble prefix counts, and a half turn done as two quarters in either direction counts too.

import {
  FrameTracker,
  SOLVED,
  analyzeSolve,
  applyMove,
  fitCubeClock,
  invertAlg,
  isSolved,
  normalizeStream,
  scrambleToSolverFrame,
  scrambledState,
  simplifyMoves,
  stateKey,
  type CubeState,
  type ReportedMove,
} from "@/cube";
import type { GyroSample, Move, Rotation, RotationEvent, SolveAnalysis, TimedMove } from "@/cube/types";
import { toSolverFrame } from "@/app/lib/frame";
import { MAX_GYRO_SAMPLES } from "@/shared/schema";
import { RotationDetector, startOrientation, wideMoveEnd, type Quaternion } from "./gyro";
import { inspectionPenalty, type Penalty } from "./inspection";

/** A correction this long is replaced by cubing.js's shortest-ish solution (a random state needs about 20). */
const LONGEST_LOCAL_FIX = 22;
/** Three gyro reports: enough to confirm a final M2's rotation (GYRO_TUNING.dwellReports is 2). */
const SETTLE_MS = 300;

export type SessionPhase = "waiting" | "scrambling" | "inspecting" | "ready" | "solving" | "lost";

export type PlanView = {
  /** The turns still to show, in the scramble's notation (white on top). */
  moves: string[];
  /** How many are done. */
  done: number;
  /** The next one is a half turn and one quarter of it is done. */
  half: boolean;
  /** These are corrections, not the scramble as written. */
  fix: boolean;
  /** Waiting for cubing.js to work the corrections out. */
  thinking: boolean;
};

export type SessionView = {
  phase: SessionPhase;
  /** While scrambling. */
  plan: PlanView | null;
  /** inspecting: when inspection began; solving and lost: when the first turn arrived (host ms). */
  startedAt: number | null;
  /** The cube's state is known (a state report has arrived since connecting). */
  hasState: boolean;
  /** A state report disagreed with the turns mid-solve: a turn was lost, so the analysis may be off. */
  desynced: boolean;
  /** solving: the cube is solved and the time stands (host ms of the last turn); saving follows shortly. */
  stoppedAt: number | null;
};

/** A finished attempt, ready to save as a SolveRecord (the caller adds id, createdAt and source). */
export type FinishedSolve = {
  scramble: string;
  moves: TimedMove[];
  rotations: RotationEvent[];
  gyro?: GyroSample[];
  totalMs: number;
  penalty: Penalty;
  analysis?: SolveAnalysis;
};

export type SessionOptions = {
  /** Host clock (ms); defaults to performance.now. */
  now?: () => number;
  /**
   * How long (ms) to keep reading the gyro after the solving turn before saving: a slice or wide move as the last
   * move turns the core after its last face turn arrives. 0 saves at once.
   */
  settleMs?: number;
  /** Read when the cube reaches the scramble: whether WCA inspection runs first. */
  inspection: () => boolean;
  /** Grip saved by "reset orientation", if any. */
  orientationReference: () => Quaternion | null;
  /** Solver-frame turns F with from·F = to (cubing.js in the app). */
  solveFix: (from: CubeState, to: CubeState) => Promise<Move[]>;
  onFinish: (solve: FinishedSolve) => void;
};

type Plan = {
  /** Solver-frame turns from `start` to the scrambled state. */
  moves: Move[];
  /** stateKey after k turns → k (the largest k when a state repeats). */
  keys: Map<string, number>;
  /** stateKey after one quarter of half turn k → k and that quarter. */
  halfKeys: Map<string, { k: number; quarter: Move }>;
  /** The last plan prefix the cube was at, and the turns since. */
  anchor: number;
  sinceAnchor: Move[];
  half: boolean;
  fix: boolean;
  thinking: boolean;
};

type PendingRotation = { rotation: Rotation; after: number; hostT: number; turn: number | null };

type Attempt = {
  startedAt: number;
  stoppedAt: number | null;
  penalty: Penalty;
  raw: ReportedMove[];
  rotations: PendingRotation[];
  gyro: [number, Quaternion][];
  detector: RotationDetector | null;
  view: FrameTracker;
  lastAfter: number;
  initial: Rotation[];
};

const quarterOf = (half: Move) => [half.charAt(0), `${half.charAt(0)}'`];

function buildPlan(start: CubeState, moves: Move[], fix: boolean): Plan {
  const keys = new Map<string, number>();
  const halfKeys = new Map<string, { k: number; quarter: Move }>();
  let state = start;
  keys.set(stateKey(state), 0);
  moves.forEach((move, k) => {
    if (move.endsWith("2")) for (const quarter of quarterOf(move)) halfKeys.set(stateKey(applyMove(state, quarter)), { k, quarter });
    state = applyMove(state, move);
    keys.set(stateKey(state), k + 1);
  });
  return { moves, keys, halfKeys, anchor: 0, sinceAnchor: [], half: false, fix, thinking: false };
}

/** Evenly thinned to at most `limit`, keeping the first and last. */
function thin<T>(items: readonly T[], limit: number): T[] {
  if (items.length <= limit) return [...items];
  return Array.from({ length: limit }, (_, i) => items[Math.round((i * (items.length - 1)) / (limit - 1))]!);
}

const q4 = (v: number) => Math.round(v * 10_000);

function analysisOf(scramble: string, moves: TimedMove[]): { analysis?: SolveAnalysis } {
  try {
    return { analysis: analyzeSolve(scramble, moves) };
  } catch (error) {
    // The time still counts; only the breakdown is lost.
    console.error("Could not analyse the smart-cube solve", error);
    return {};
  }
}

export class CubeSession {
  readonly #options: SessionOptions;
  readonly #listeners = new Set<() => void>();
  #phase: SessionPhase = "waiting";
  #scramble = "";
  #target: CubeState | null = null;
  #cube: CubeState | null = null;
  #plan: Plan | null = null;
  #planToken = 0;
  #inspectionStart: number | null = null;
  #attempt: Attempt | null = null;
  #lastGyro: Quaternion | null = null;
  #desynced = false;
  #view: SessionView;

  constructor(options: SessionOptions) {
    this.#options = options;
    this.#view = this.#buildView();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** The current view; the same object until something changes (for useSyncExternalStore). */
  view(): SessionView {
    return this.#view;
  }

  /** The tracked cube state, solver frame. */
  get cube(): CubeState | null {
    return this.#cube;
  }

  setScramble(scramble: string): void {
    if (this.#phase === "solving" || this.#phase === "lost") return;
    this.#scramble = scramble;
    this.#target = scramble ? scrambledState(scramble) : null;
    this.#startScrambling();
  }

  /** The cube's own report of its state. Trusted over the tracked state, except that it never starts a solve. */
  facelets(state: CubeState, hostT: number): void {
    const differs = this.#cube === null || stateKey(state) !== stateKey(this.#cube);
    switch (this.#phase) {
      case "solving":
        if (!differs) return;
        if (this.#attempt?.stoppedAt != null) return;
        this.#cube = state;
        this.#desynced = true;
        if (isSolved(state)) return this.#stop(hostT);
        return this.#changed();
      case "lost":
        if (isSolved(state)) return this.stopLost(hostT);
        return;
      default:
        if (!differs) return;
        this.#cube = state;
        this.#startScrambling();
    }
  }

  /** A solver-frame turn as the cube reported it. */
  move(move: Move, hostT: number, cubeT: number | null): void {
    if (!this.#cube) return;
    this.#cube = applyMove(this.#cube, move);
    switch (this.#phase) {
      case "scrambling":
        return this.#trackScramble(move, hostT);
      case "inspecting":
      case "ready":
        this.#beginAttempt(hostT);
        this.#record(move, hostT, cubeT);
        return this.#changed();
      case "solving":
        // Turns after the solved one are the next scramble's, not this solve's.
        if (this.#attempt?.stoppedAt != null) return;
        this.#record(move, hostT, cubeT);
        if (isSolved(this.#cube)) return this.#stop(hostT);
        return;
      default:
        return;
    }
  }

  gyro(q: Quaternion, hostT: number): void {
    this.#lastGyro = q;
    const attempt = this.#attempt;
    if (this.#phase !== "solving" || !attempt) return;
    attempt.gyro.push([hostT, q]);
    const found = attempt.detector?.sample(q, hostT);
    if (!found) return;
    for (const rotation of found.rotations) this.#placeRotation(attempt, rotation, found.since, found.rotations.length === 1);
  }

  /** The cube was solved by hand (or the tracked state drifted): treat it as solved now. */
  markSolved(): void {
    this.#cube = SOLVED;
    if (this.#phase === "solving") return this.#finish();
    this.#startScrambling();
  }

  /** Abandon the attempt (nothing is saved) and scramble again from wherever the cube is. */
  cancel(): void {
    if (this.#phase === "lost") this.#cube = null;
    this.#attempt = null;
    this.#desynced = false;
    this.#phase = "waiting";
    this.#startScrambling();
  }

  connectionLost(): void {
    if (this.#phase === "solving" && this.#attempt?.stoppedAt != null) this.#finish();
    if (this.#phase === "solving") {
      this.#phase = "lost";
      return this.#changed();
    }
    this.#cube = null;
    this.#attempt = null;
    this.#phase = "waiting";
    this.#plan = null;
    this.#changed();
  }

  /** Stops a solve whose cube went away: the time stands, the turns are incomplete, so there is no analysis. */
  stopLost(hostT: number): void {
    const attempt = this.#attempt;
    if (this.#phase !== "lost" || !attempt) return;
    const { moves, rotations } = this.#timeline(attempt);
    this.#attempt = null;
    this.#cube = null;
    this.#phase = "waiting";
    this.#plan = null;
    this.#changed();
    this.#options.onFinish({
      scramble: this.#scramble,
      moves,
      rotations,
      totalMs: Math.max(0, Math.round(hostT - attempt.startedAt)),
      penalty: attempt.penalty,
    });
  }

  #startScrambling(): void {
    if (this.#phase === "solving" || this.#phase === "lost") return;
    this.#inspectionStart = null;
    const cube = this.#cube;
    const target = this.#target;
    if (!cube || !target) {
      this.#phase = "waiting";
      this.#plan = null;
      return this.#changed();
    }
    this.#phase = "scrambling";
    if (stateKey(cube) === stateKey(target)) return this.#reachedScramble((this.#options.now ?? (() => performance.now()))());
    if (isSolved(cube)) this.#setPlan(buildPlan(cube, scrambleToSolverFrame(this.#scramble), false));
    else this.#askSolver(cube, null);
    this.#changed();
  }

  #trackScramble(move: Move, hostT: number): void {
    const cube = this.#cube!;
    if (stateKey(cube) === stateKey(this.#target!)) return this.#reachedScramble(hostT);
    const plan = this.#plan;
    if (!plan || plan.thinking) {
      this.#askSolver(cube, null);
      return this.#changed();
    }
    const key = stateKey(cube);
    const at = plan.keys.get(key);
    if (at !== undefined) {
      Object.assign(plan, { anchor: at, sinceAnchor: [], half: false });
      return this.#changed();
    }
    const halfway = plan.halfKeys.get(key);
    if (halfway !== undefined) {
      Object.assign(plan, { anchor: halfway.k, sinceAnchor: [halfway.quarter], half: true });
      return this.#changed();
    }
    // Off the plan: undo the stray turns, then carry on with the rest of it.
    const fix = simplifyMoves([...invertAlg([...plan.sinceAnchor, move]), ...plan.moves.slice(plan.anchor)]);
    this.#setPlan(buildPlan(cube, fix, true));
    if (fix.length > LONGEST_LOCAL_FIX) this.#askSolver(cube, this.#plan);
    this.#changed();
  }

  #setPlan(plan: Plan): void {
    this.#planToken++;
    this.#plan = plan;
  }

  /** Asks cubing.js for a route from `from` to the scramble; `fallback` stays on screen meanwhile. */
  #askSolver(from: CubeState, fallback: Plan | null): void {
    const target = this.#target!;
    const placeholder = fallback ?? { ...buildPlan(from, [], true), thinking: true };
    this.#setPlan(placeholder);
    const token = this.#planToken;
    this.#options
      .solveFix(from, target)
      .then((moves) => {
        const unchanged = this.#cube !== null && stateKey(this.#cube) === stateKey(from);
        if (token !== this.#planToken || this.#phase !== "scrambling" || !unchanged) return;
        if (fallback && moves.length >= fallback.moves.length) return;
        this.#setPlan(buildPlan(from, moves, true));
        this.#changed();
      })
      .catch((error: unknown) => {
        console.error("Could not work out the moves to the scramble", error);
        if (token !== this.#planToken) return;
        this.#plan = { ...placeholder, thinking: false };
        this.#changed();
      });
  }

  #reachedScramble(hostT: number): void {
    this.#plan = null;
    this.#planToken++;
    if (this.#options.inspection()) {
      this.#phase = "inspecting";
      this.#inspectionStart = hostT;
    } else {
      this.#phase = "ready";
    }
    this.#changed();
  }

  #beginAttempt(hostT: number): void {
    const penalty = this.#phase === "inspecting" && this.#inspectionStart !== null ? inspectionPenalty(hostT - this.#inspectionStart) : "none";
    const gyroAtStart = this.#lastGyro;
    const initial = gyroAtStart ? startOrientation(this.#options.orientationReference(), gyroAtStart) : null;
    const view = new FrameTracker();
    for (const rotation of initial?.rotations ?? []) view.rotate(rotation);
    this.#attempt = {
      startedAt: hostT,
      stoppedAt: null,
      penalty,
      raw: [],
      rotations: [],
      gyro: gyroAtStart ? [[hostT, gyroAtStart]] : [],
      detector: gyroAtStart ? new RotationDetector(gyroAtStart, initial ?? undefined) : null,
      view,
      lastAfter: 0,
      initial: initial?.rotations ?? [],
    };
    this.#desynced = false;
    this.#phase = "solving";
  }

  #record(move: Move, hostT: number, cubeT: number | null): void {
    this.#attempt?.raw.push({ move, hostT, cubeT });
  }

  /** Puts a detected rotation after the turn it belongs to: a wide move's or slice's last turn, else when it began. */
  #placeRotation(attempt: Attempt, rotation: Rotation, since: number, single: boolean): void {
    const turns = attempt.raw;
    const wideEnd = single ? wideMoveEnd(rotation, turns, attempt.lastAfter, attempt.view, since) : null;
    const before = turns.filter((turn) => turn.hostT <= since).length;
    const after = wideEnd !== null ? wideEnd + 1 : Math.max(attempt.lastAfter, before);
    attempt.rotations.push({ rotation, after, hostT: since, turn: wideEnd });
    attempt.view.rotate(rotation);
    attempt.lastAfter = after;
  }

  /** The attempt's turns and rotations on the solve clock (ms from the first turn), normalised. */
  #timeline(attempt: Attempt): { moves: TimedMove[]; rotations: RotationEvent[]; t0: number } {
    const fitted = fitCubeClock(attempt.raw);
    const t0 = fitted[0]?.t ?? attempt.startedAt;
    const moves = fitted.map(({ move, t }) => ({ move, t: t - t0 }));
    const end = moves.at(-1)?.t ?? 0;
    const rotations: RotationEvent[] = [
      ...attempt.initial.map((rotation) => ({ rotation, after: 0, t: 0 })),
      ...attempt.rotations.map(({ rotation, after, hostT, turn }) => ({
        rotation,
        after,
        t: turn !== null ? moves[turn]!.t : Math.min(end, Math.max(0, Math.round(hostT - t0))),
      })),
    ];
    return { ...normalizeStream(moves, rotations), t0 };
  }

  /** The cube is solved: the time stands now; the solve is saved once the gyro has had a moment to settle. */
  #stop(hostT: number): void {
    const attempt = this.#attempt;
    if (!attempt) return;
    attempt.stoppedAt = hostT;
    const settleMs = this.#options.settleMs ?? SETTLE_MS;
    if (settleMs <= 0) return this.#finish();
    this.#changed();
    setTimeout(() => {
      if (this.#attempt === attempt) this.#finish();
    }, settleMs);
  }

  #finish(): void {
    const attempt = this.#attempt;
    if (!attempt) return;
    const { moves, rotations, t0 } = this.#timeline(attempt);
    const gyro = thin(attempt.gyro, MAX_GYRO_SAMPLES).map(
      ([t, q]): GyroSample => [Math.round(t - t0), q4(q.w), q4(q.x), q4(q.y), q4(q.z)],
    );
    const solve: FinishedSolve = {
      scramble: this.#scramble,
      moves,
      rotations,
      ...(gyro.length > 0 ? { gyro } : {}),
      totalMs: moves.at(-1)?.t ?? 0,
      penalty: attempt.penalty,
      ...analysisOf(this.#scramble, moves),
    };
    this.#attempt = null;
    this.#phase = "waiting";
    this.#plan = null;
    this.#target = null;
    this.#changed();
    this.#options.onFinish(solve);
  }

  #buildView(): SessionView {
    const plan = this.#plan;
    const attempt = this.#attempt;
    return {
      phase: this.#phase,
      plan: plan && this.#phase === "scrambling"
        ? {
            moves: plan.moves.map(toSolverFrame),
            done: plan.anchor,
            half: plan.half,
            fix: plan.fix,
            thinking: plan.thinking,
          }
        : null,
      startedAt: this.#phase === "inspecting" ? this.#inspectionStart : (attempt?.startedAt ?? null),
      hasState: this.#cube !== null,
      desynced: this.#desynced,
      stoppedAt: attempt?.stoppedAt ?? null,
    };
  }

  #changed(): void {
    this.#view = this.#buildView();
    for (const listener of this.#listeners) listener();
  }
}
