// Shared contract between the cube engine (src/cube) and the app (src/app).
//
// Frames: a scramble is written in WCA orientation (white top, green front). The solver then holds
// the cube with white on the bottom and green in front, i.e. the scramble followed by "z2". Every
// move in a solve, and every solution the engine returns, is in that solver frame and uses outer
// face turns only (U D R L F B with ' or 2), because that is what a smart cube reports.

/** An outer face turn in the solver frame, e.g. "R", "U'", "F2". */
export type Move = string;

/** One turn as the cube reported it. `t` is ms since the timer started. */
export type TimedMove = { move: Move; t: number };

export type Slot = "FR" | "FL" | "BR" | "BL";

export type StageKind = "cross" | "xcross" | "pair" | "eo" | "coll" | "epll" | "oll" | "pll" | "ll";

export type Stage = {
  kind: StageKind;
  /** Breakdown label: "cross", "xcross", "p1".."p4", "eo", "coll", "epll", ... */
  label: string;
  /** This stage owns moves[startMove, endMove). */
  startMove: number;
  endMove: number;
  /** ms from the previous stage's last move (or the timer start) to this stage's first move. */
  recognitionMs: number;
  /** ms from this stage's first move to its last move. */
  executionMs: number;
  /** recognitionMs + executionMs; stage totals sum to the solve's totalMs (minus any trailing gap). */
  totalMs: number;
  moveCount: number;
  /** Longest gap between two consecutive moves inside the stage. */
  longestPauseMs: number;
  /** cross / xcross / pair: fewest moves that would have done this step from where it began. */
  optimalMoves?: number;
  /** cross / xcross / pair: one shortest solution from where the step began. */
  optimalSolution?: string;
  /** pair / xcross: the slot(s) this stage solved. */
  slots?: Slot[];
  /** pair: the shortest single pair available in any unsolved slot when this stage began. */
  bestAlternative?: { slot: Slot; moves: number; solution: string };
  /** Last-layer stages: the case, e.g. "dot", "line", "L" (eo), "T3" (coll), "Ua" (epll). */
  caseName?: string;
};

export type SolveAnalysis = {
  stages: Stage[];
  totalMs: number;
  moveCount: number;
  /** True when the final state is solved. */
  solved: boolean;
};

export type Rotation = "x" | "x'" | "x2" | "y" | "y'" | "y2" | "z" | "z'" | "z2";

/**
 * How the cube body (and so its centres) turned relative to the solver: an explicit rotation like y, or
 * the centre movement inside a wide move (r = L with x) or a slice (M = R L' with x'). A smart cube's gyro
 * sees exactly this. It never changes the state relative to the centres, so analysis ignores it; display
 * and animation use it to name turns the way the solver saw them. `after` = number of turns done before it.
 */
export type RotationEvent = { rotation: Rotation; after: number; t: number };

export type SolveSource = "demo" | "keyboard" | "smartcube" | "virtual";

export type SolveRecord = {
  id: string;
  /** WCA-orientation scramble. */
  scramble: string;
  /** Solver-frame turns; empty for a keyboard-timed solve. */
  moves: TimedMove[];
  /** Whole-cube rotations, when known (generator or gyro). */
  rotations?: RotationEvent[];
  totalMs: number;
  penalty: "none" | "+2" | "dnf";
  createdAt: number;
  source: SolveSource;
  analysis?: SolveAnalysis;
};
