// Alg execution speed: how long a competent CFOP solver (15–20 s averages) takes to run an alg once the case is
// recognised, estimated by simulating two hands, and the fastest alg on offer for a case.
//
// The hands. Each wrist has a position: 0 is home grip (thumb on the front), +1 is after an R (left hand: after an
// L', the mirror image), -1 is after an R' ("thumb down"), and +2 is only reachable by turning further up (R R),
// from where the hand has to come back. R, r, L, l and x turn wrists. Every other turn is a finger trick that only
// works with the acting hand's wrist in certain positions: U with the right index from home or after R (or pushed
// by the left index), U' its mirror, U2 a double flick, D and D' with a ring finger, F with the right index from
// thumb down (else an index pull or a thumb push), F' its mirror, B with an index from the R/L' position, M slices
// with the left ring finger (M' is the quick one), S and E slowly. When nothing fits, a hand regrips to any
// position, which is cheaper while the other hand is turning. Rotations are expensive: x rolls the cube in both
// hands (cheaper before the first turn, when it overlaps recognition) unless it pairs with the next R or L into the
// other hand's wide turn (x R' is exactly l'), and y and z are a full regrip. A shortest-path search over (wrist
// positions, last finger used, ...) picks the cheapest way through the whole alg, so R2 goes up or down as suits
// what follows (R2 then R2 is R R then R' R'), U goes to whichever index finger is free, and the starting grip is
// chosen too. Smaller costs: the same finger twice in a row, two finger tricks in a row on one hand, a wrist
// stretched to +2, switching a hand between its R and r grips, and switching which wrist turns (R to L). Left-wrist
// turns cost double: the solver is right-handed and the community almost never prefers an alg's left-handed
// mirror. U' with D on the left hand (or U with D' on the right) is one motion, as in "D U'".
//
// Calibration: an RU trigger (R U R' U') takes about 420 ms (9.6 TPS) and T perm about 1.25 s, start included; the
// constants were then fitted so that the model's fastest alg per PLL, OLL and COLL case is the community's most
// voted one as often as possible without unphysical orderings (a push never beats a flick, and so on). See
// speed-votes.ts for the data and speed.test.ts for the hit rates.
//
// Sources (ideas only; no code was copied):
// - Trangium, "Movecount Coefficient Calculator" (https://trangium.github.io/MovecountCoefficient, source MIT at
//   https://github.com/trangium/trangium.github.io): the wrist-position simulation with regrips when a wrist runs
//   out of range, flick vs push vs ring-finger multipliers, the half-turn multiplier (1.65 there), overwork
//   penalties and rotation costs.
// - Speedsolving wiki, "Metric" / "HTM" and "Finger tricks" (https://www.speedsolving.com/wiki/index.php?title=HTM):
//   move-count metrics (HTM, QTM, STM, ETM) count turns, not how they are fingered.
// - SpeedCubeDB (https://www.speedcubedb.com/a/3x3/PLL, /OLL, /COLL): community vote counts per alg, used only to
//   validate and tune the constants (speed-votes.ts).
// - CubeSkills, "Improving Turning Speed" (https://www.cubeskills.com/blog/improving-turning-speed): pick
//   fingertrick-friendly algs over raw move count.

import { getCase, type CaseSetId } from "./cases";
import { tokenizeAlg, type MoveToken } from "./cubie";
import { algOptions } from "./options";
import { isSameAlg } from "./algs";

/** Every cost in the model, in ms. */
export const SPEED_COSTS = {
  /** Getting the first turn going: the start of an alg overlaps with nothing. */
  start: 130,
  /** Starting with a hand away from home grip, per hand (set up while recognising). */
  startOffHome: 35,
  /** R, R', L, L', r, ... quarter wrist turn. */
  wrist: 62,
  /** R2, L2: a double wrist turn. */
  wristHalf: 155,
  /** Multiplies left-wrist turns: a right-handed solver's left wrist is slower. */
  leftWrist: 2.0,
  /** Switching a hand between its R grip and its r grip (or L and l). */
  wideSwitch: 60,
  /** A wrist turn by the other hand than the last wrist turn (R then L): the holding hand changes. */
  wristSwap: 60,
  /** U with the right index, U' with the left, F from thumb down: the basic flick. */
  flick: 82,
  /** U2: a double flick. */
  flickHalf: 145,
  /** F2 from thumb down (or its mirror): a double flick on the front, harder to keep stable than U2. */
  frontHalf: 215,
  /** U pushed by the left index (U' by the right). */
  push: 90,
  /** D with the left ring finger, D' with the right. */
  ring: 105,
  /** D pushed by the right ring finger (D' by the left). */
  ringPush: 165,
  /** D2: a double ring flick. */
  ringHalf: 175,
  /** F pulled by the right index from home grip (F' by the left index). */
  frontPull: 100,
  /** F pushed by the left thumb, F' by the right. */
  thumb: 175,
  /** B with the right index from the R position (B' with the left from L'). */
  back: 180,
  /** B2. */
  backHalf: 280,
  /** M' with the left ring finger. */
  sliceFlick: 100,
  /** M pushed back. */
  slicePush: 185,
  /** M2. */
  sliceHalf: 190,
  /** S, S', E, E'. */
  sliceSE: 210,
  /** S2, E2. */
  sliceSEHalf: 300,
  /** Multiplies f and b: two layers by finger. */
  wideFace: 1.7,
  /** Multiplies u and d: two layers by finger, from a grip that suits neither U nor D flicks. */
  wideUpDown: 2.5,
  /** x mid-alg: both wrists roll the cube. */
  xRotation: 260,
  /** x before the first turn: rolled into the grip while recognising (a trailing x is never done). */
  xStart: 220,
  /** y or z mid-alg: let go and re-grab the cube. */
  rotation: 380,
  /** y2 or z2 mid-alg. */
  rotationHalf: 520,
  /** One hand lets go and re-grabs at another wrist position. */
  regrip: 190,
  /** The same, done while the other hand is turning. */
  regripOverlapped: 150,
  /** The same finger for two turns in a row: it has to reset first. */
  sameFinger: 80,
  /** Two finger tricks in a row on one hand (different fingers). */
  sameHand: 30,
  /** U' with D on the left hand (U with D' on the right): the second turn of the pair. */
  pairedTurn: 25,
  /** A finger trick while a wrist is stretched to +2. */
  stretch: 45,
} as const;

export type AlgSpeed = {
  /** Estimated execution time in ms. */
  ms: number;
  /** Turns executed (slice turn metric, rotations not counted). */
  moves: number;
  /** Hand regrips plus y/z rotations along the cheapest fingering. */
  regrips: number;
  /** The costly bits in order: "regrip (right hand) before F'", "B'", "y rotation", ... */
  notes: string[];
};

export type AlgSpeedOptions = {
  /**
   * Skip the alg's pre-AUF (leading U turns and y rotations) and post-AUF (trailing U turns): for last-layer algs,
   * whose AUF depends on the angle the case comes in at, not on the alg.
   */
  ignoreAuf?: boolean;
};

type Hand = "right" | "left";

type Finger = "none" | "rWrist" | "lWrist" | "rIndex" | "rRing" | "rThumb" | "lIndex" | "lRing" | "lThumb";

type Action =
  | { kind: "wrist"; hand: Hand; delta: number; ms: number; wide: boolean }
  | { kind: "finger"; hand: Hand; finger: Finger; from: readonly number[]; ms: number; note?: string }
  | { kind: "x"; delta: number; ms: number }
  | { kind: "rotation"; ms: number };

type Grip = {
  right: number;
  left: number;
  finger: Finger;
  rightWide: boolean;
  leftWide: boolean;
  /** The previous turn when it was a U or D turn ("U'", "D", ...), for pairing U' with D; "" otherwise. */
  last: string;
  /** The hand of the last wrist turn, null before any. */
  wristHand: Hand | null;
};

type Event =
  | { kind: "regrip"; hand: Hand }
  | { kind: "turn"; label: string; action: Action; extra: string | null };

type Node = { grip: Grip; ms: number; prev: Node | null; event: Event | null };

const C = SPEED_COSTS;
const WRIST_MIN = -1;
const WRIST_MAX = 2;
const GRIP_POSITIONS = [-1, 0, 1] as const;
const SUFFIXES = ["", "2", "'"] as const;
const ROTATIONS = new Set(["x", "y", "z"]);

function label({ family, amount }: MoveToken): string {
  return family + SUFFIXES[amount - 1];
}

function handOf(finger: Finger): Hand | null {
  if (finger === "none") return null;
  return finger.startsWith("r") ? "right" : "left";
}

function isWrist(finger: Finger): boolean {
  return finger === "rWrist" || finger === "lWrist";
}

// ---------------------------------------------------------------------------------------------------------------
// The ways to do each turn

// Quarter turns move the wrist one step; a half turn can go either way (R2 = R R or R' R').
function wristDeltas(amount: number, clockwiseDelta: number): number[] {
  if (amount === 2) return [2, -2];
  return [amount === 1 ? clockwiseDelta : -clockwiseDelta];
}

function wristTurns(hand: Hand, amount: number, wide: boolean): Action[] {
  // L is the mirror image of R': it turns the left wrist the way R' turns the right one.
  const clockwiseDelta = hand === "right" ? 1 : -1;
  const base = amount === 2 ? C.wristHalf : C.wrist;
  const ms = hand === "left" ? base * C.leftWrist : base;
  return wristDeltas(amount, clockwiseDelta).map((delta) => ({ kind: "wrist", hand, delta, ms, wide }));
}

function finger(hand: Hand, which: Finger, from: readonly number[], ms: number, note?: string): Action {
  const action: Action = { kind: "finger", hand, finger: which, from, ms };
  return note === undefined ? action : { ...action, note };
}

// U-like turns (U, u): amount 1 = clockwise from above, 3 = counter-clockwise, 2 = half.
function upTurns(amount: number, factor: number, note?: string): Action[] {
  const near = [0, 1] as const;
  switch (amount) {
    case 1:
      return [
        finger("right", "rIndex", near, C.flick * factor, note),
        finger("left", "lIndex", near, C.push * factor, note),
      ];
    case 3:
      return [
        finger("left", "lIndex", near, C.flick * factor, note),
        finger("right", "rIndex", near, C.push * factor, note),
      ];
    default:
      return [
        finger("right", "rIndex", near, C.flickHalf * factor, note),
        finger("left", "lIndex", near, C.flickHalf * factor, note),
      ];
  }
}

// A ring finger reaches the bottom layer from home grip or with its wrist turned up (after R, the right ring finger
// sits under the cube).
function downTurns(amount: number, factor: number, note?: string): Action[] {
  const reach = [0, 1] as const;
  const home = [0] as const;
  switch (amount) {
    case 1:
      return [
        finger("left", "lRing", reach, C.ring * factor, note),
        finger("right", "rRing", home, C.ringPush * factor, note),
      ];
    case 3:
      return [
        finger("right", "rRing", reach, C.ring * factor, note),
        finger("left", "lRing", home, C.ringPush * factor, note),
      ];
    default:
      return [
        finger("right", "rRing", reach, C.ringHalf * factor, note),
        finger("left", "lRing", reach, C.ringHalf * factor, note),
      ];
  }
}

function frontTurns(amount: number, factor: number, note?: string): Action[] {
  const thumbDown = [-1] as const;
  const thumbFront = [0, 1] as const;
  switch (amount) {
    case 1:
      return [
        finger("right", "rIndex", thumbDown, C.flick * factor, note),
        finger("right", "rIndex", [0], C.frontPull * factor, note),
        finger("left", "lThumb", thumbFront, C.thumb * factor, note),
      ];
    case 3:
      return [
        finger("left", "lIndex", thumbDown, C.flick * factor, note),
        finger("left", "lIndex", [0], C.frontPull * factor, note),
        finger("right", "rThumb", thumbFront, C.thumb * factor, note),
      ];
    default:
      return [
        finger("right", "rIndex", thumbDown, C.frontHalf * factor, note),
        finger("left", "lIndex", thumbDown, C.frontHalf * factor, note),
      ];
  }
}

function backTurns(amount: number, factor: number, note: string): Action[] {
  const up = [1] as const;
  switch (amount) {
    case 1:
      return [finger("right", "rIndex", up, C.back * factor, note)];
    case 3:
      return [finger("left", "lIndex", up, C.back * factor, note)];
    default:
      return [
        finger("right", "rIndex", up, C.backHalf * factor, note),
        finger("left", "lIndex", up, C.backHalf * factor, note),
      ];
  }
}

function middleTurns(amount: number): Action[] {
  const ms = amount === 3 ? C.sliceFlick : amount === 1 ? C.slicePush : C.sliceHalf;
  return [finger("left", "lRing", [0], ms)];
}

// S follows F and E follows D.
function standingTurns(amount: number, note: string): Action[] {
  if (amount === 2) {
    return [finger("right", "rIndex", [0], C.sliceSEHalf, note), finger("left", "lIndex", [0], C.sliceSEHalf, note)];
  }
  if (amount === 1) return [finger("right", "rIndex", [0], C.sliceSE, note)];
  return [finger("left", "lIndex", [0], C.sliceSE, note)];
}

function equatorTurns(amount: number, note: string): Action[] {
  if (amount === 2) {
    return [finger("right", "rRing", [0], C.sliceSEHalf, note), finger("left", "lRing", [0], C.sliceSEHalf, note)];
  }
  if (amount === 1) return [finger("left", "lRing", [0], C.sliceSE, note)];
  return [finger("right", "rRing", [0], C.sliceSE, note)];
}

function actionsFor(token: MoveToken, first: boolean): Action[] {
  const { family, amount } = token;
  const name = label(token);
  switch (family) {
    case "R":
      return wristTurns("right", amount, false);
    case "r":
    case "Rw":
      return wristTurns("right", amount, true);
    case "L":
      return wristTurns("left", amount, false);
    case "l":
    case "Lw":
      return wristTurns("left", amount, true);
    case "U":
      return upTurns(amount, 1);
    case "u":
    case "Uw":
      return upTurns(amount, C.wideUpDown, name);
    case "D":
      return downTurns(amount, 1);
    case "d":
    case "Dw":
      return downTurns(amount, C.wideUpDown, name);
    case "F":
      return frontTurns(amount, 1);
    case "f":
    case "Fw":
      return frontTurns(amount, C.wideFace, name);
    case "B":
      return backTurns(amount, 1, name);
    case "b":
    case "Bw":
      return backTurns(amount, C.wideFace, name);
    case "M":
      return middleTurns(amount);
    case "S":
      return standingTurns(amount, name);
    case "E":
      return equatorTurns(amount, name);
    case "x": {
      const quarter = first ? C.xStart : C.xRotation;
      return wristDeltas(amount, 1).map((delta) => ({ kind: "x", delta, ms: amount === 2 ? 2 * quarter : quarter }));
    }
    case "y":
    case "z":
      return [{ kind: "rotation", ms: amount === 2 ? C.rotationHalf : C.rotation }];
    default:
      throw new Error(`No fingering for "${name}"`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The search

function gripKey(g: Grip): string {
  return `${g.right},${g.left},${g.finger},${g.rightWide ? 1 : 0}${g.leftWide ? 1 : 0},${g.last},${g.wristHand ?? ""}`;
}

function relax(layer: Map<string, Node>, node: Node): void {
  const key = gripKey(node.grip);
  const existing = layer.get(key);
  if (!existing || node.ms < existing.ms) layer.set(key, node);
}

function startLayer(): Map<string, Node> {
  const layer = new Map<string, Node>();
  for (const right of GRIP_POSITIONS) {
    for (const left of GRIP_POSITIONS) {
      for (const rightWide of [false, true]) {
        for (const leftWide of [false, true]) {
          const offHome = (right === 0 ? 0 : 1) + (left === 0 ? 0 : 1);
          const grip: Grip = { right, left, finger: "none", rightWide, leftWide, last: "", wristHand: null };
          relax(layer, { grip, ms: offHome * C.startOffHome, prev: null, event: null });
        }
      }
    }
  }
  return layer;
}

function regripped(node: Node, hand: Hand, position: number): Node {
  const overlapped = handOf(node.grip.finger) !== null && handOf(node.grip.finger) !== hand;
  const grip: Grip =
    hand === "right"
      ? { ...node.grip, right: position, rightWide: false, finger: "none", last: "" }
      : { ...node.grip, left: position, leftWide: false, finger: "none", last: "" };
  const ms = node.ms + (overlapped ? C.regripOverlapped : C.regrip);
  return { grip, ms, prev: node, event: { kind: "regrip", hand } };
}

// Adds every way of regripping one hand, then the other, before the next turn.
function withRegrips(layer: Map<string, Node>): Map<string, Node> {
  let current = layer;
  for (const hand of ["right", "left"] as const) {
    const next = new Map(current);
    for (const node of current.values()) {
      const position = hand === "right" ? node.grip.right : node.grip.left;
      for (const target of GRIP_POSITIONS) if (target !== position) relax(next, regripped(node, hand, target));
    }
    current = next;
  }
  return current;
}

function inRange(position: number): boolean {
  return position >= WRIST_MIN && position <= WRIST_MAX;
}

// "<finger> <turn>" → the finger and turn just before that make one motion with it.
const PAIRED_TURNS: Readonly<Record<string, readonly [Finger, string]>> = {
  "lRing D": ["lIndex", "U'"],
  "lIndex U'": ["lRing", "D"],
  "rRing D'": ["rIndex", "U"],
  "rIndex U": ["rRing", "D'"],
};

const PAIRABLE = new Set(["U", "U'", "D", "D'"]);

function isPairedTurn(prev: Grip, action: Action & { kind: "finger" }, name: string): boolean {
  const pair = PAIRED_TURNS[`${action.finger} ${name}`];
  return pair !== undefined && prev.finger === pair[0] && prev.last === pair[1];
}

function fingerTurn(node: Node, action: Action & { kind: "finger" }, name: string): Node | null {
  const g = node.grip;
  const wrist = action.hand === "right" ? g.right : g.left;
  if (!action.from.includes(wrist)) return null;
  let ms = action.ms;
  let extra: string | null = null;
  if (isPairedTurn(g, action, name)) {
    ms = C.pairedTurn;
  } else if (g.finger === action.finger) {
    ms += C.sameFinger;
    extra = `same finger twice (${name})`;
  } else if (handOf(g.finger) === action.hand && !isWrist(g.finger)) {
    ms += C.sameHand;
  }
  if (g.right === WRIST_MAX || g.left === WRIST_MAX) ms += C.stretch;
  return {
    grip: { ...g, finger: action.finger, last: PAIRABLE.has(name) ? name : "" },
    ms: node.ms + ms,
    prev: node,
    event: { kind: "turn", label: name, action, extra },
  };
}

function wristTurn(node: Node, action: Action & { kind: "wrist" }, name: string): Node | null {
  const g = node.grip;
  const right = action.hand === "right";
  const position = (right ? g.right : g.left) + action.delta;
  if (!inRange(position)) return null;
  const wasWide = right ? g.rightWide : g.leftWide;
  const swapped = g.wristHand !== null && g.wristHand !== action.hand;
  const ms = action.ms + (wasWide === action.wide ? 0 : C.wideSwitch) + (swapped ? C.wristSwap : 0);
  const grip: Grip = right
    ? { ...g, right: position, rightWide: action.wide, finger: "rWrist", last: "", wristHand: "right" }
    : { ...g, left: position, leftWide: action.wide, finger: "lWrist", last: "", wristHand: "left" };
  return { grip, ms: node.ms + ms, prev: node, event: { kind: "turn", label: name, action, extra: null } };
}

function turn(node: Node, action: Action, name: string): Node[] {
  const g = node.grip;
  const event: Event = { kind: "turn", label: name, action, extra: null };
  switch (action.kind) {
    case "finger": {
      const next = fingerTurn(node, action, name);
      return next ? [next] : [];
    }
    case "wrist": {
      const next = wristTurn(node, action, name);
      return next ? [next] : [];
    }
    case "x": {
      const right = g.right + action.delta;
      const left = g.left + action.delta;
      if (!inRange(right) || !inRange(left)) return [];
      return [{ grip: { ...g, right, left, finger: "none", last: "" }, ms: node.ms + action.ms, prev: node, event }];
    }
    case "rotation":
      return GRIP_POSITIONS.flatMap((right) =>
        GRIP_POSITIONS.map((left) => ({
          grip: { right, left, finger: "none" as const, rightWide: false, leftWide: false, last: "", wristHand: null },
          ms: node.ms + action.ms,
          prev: node,
          event,
        })),
      );
  }
}

function step(layer: Map<string, Node>, token: MoveToken, first: boolean): Map<string, Node> {
  const actions = actionsFor(token, first);
  const name = label(token);
  const from = actions.some((action) => action.kind === "rotation") ? layer : withRegrips(layer);
  const next = new Map<string, Node>();
  for (const node of from.values()) {
    for (const action of actions) for (const after of turn(node, action, name)) relax(next, after);
  }
  if (next.size === 0) throw new Error(`No way to finger "${name}"`);
  return next;
}

// ---------------------------------------------------------------------------------------------------------------
// What gets executed, and the report

// x with R' is exactly l' (x' with R is l, x with L is r, x2 with R2 is l2, ...): the other hand's wide turn, which
// is how solvers do "x R'", so such an x costs a wrist turn rather than a rotation.
function wideTurnFor(rotation: MoveToken, turn: MoveToken): MoveToken | null {
  if (rotation.family !== "x") return null;
  if (turn.family === "R" && turn.amount === (4 - rotation.amount) % 4) return { family: "l", amount: turn.amount };
  if (turn.family === "L" && turn.amount === rotation.amount) return { family: "r", amount: turn.amount };
  return null;
}

function mergeRotations(tokens: readonly MoveToken[]): MoveToken[] {
  const merged: MoveToken[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1];
    const wide = next === undefined ? null : (wideTurnFor(token, next) ?? wideTurnFor(next, token));
    merged.push(wide ?? token);
    if (wide) i++;
  }
  return merged;
}

// Rotations after the last turn are never done. With ignoreAuf, leading U turns and y rotations are the pre-AUF (a y
// in front of a last-layer alg only picks the angle) and trailing U turns the post-AUF, so they are dropped too.
function executedTokens(alg: string, ignoreAuf: boolean): MoveToken[] {
  const tokens = tokenizeAlg(alg);
  const skipsAtStart = ({ family }: MoveToken): boolean => ignoreAuf && (family === "U" || family === "y");
  const skipsAtEnd = ({ family }: MoveToken): boolean => ROTATIONS.has(family) || (ignoreAuf && family === "U");
  let first = 0;
  let end = tokens.length;
  while (first < end && skipsAtStart(tokens[first]!)) first++;
  while (end > first && skipsAtEnd(tokens[end - 1]!)) end--;
  return mergeRotations(tokens.slice(first, end));
}

function eventsOf(node: Node): Event[] {
  const events: Event[] = [];
  for (let current: Node | null = node; current; current = current.prev) if (current.event) events.push(current.event);
  return events.reverse();
}

function report(events: readonly Event[]): { regrips: number; notes: string[] } {
  const notes: string[] = [];
  let regrips = 0;
  let pending: Hand[] = [];
  for (const event of events) {
    if (event.kind === "regrip") {
      regrips++;
      pending.push(event.hand);
      continue;
    }
    if (pending.length > 0) {
      const hands = pending.length > 1 ? "both hands" : `${pending[0]} hand`;
      notes.push(`regrip (${hands}) before ${event.label}`);
      pending = [];
    }
    const { action } = event;
    if (action.kind === "rotation") {
      regrips++;
      notes.push(`${event.label} rotation`);
    }
    if (action.kind === "finger" && action.note !== undefined) notes.push(action.note);
    if (event.extra !== null) notes.push(event.extra);
  }
  return { regrips, notes };
}

/**
 * Estimated execution time of `alg` for a competent CFOP solver, from the cheapest fingering a two-hand simulation
 * finds (see the top of this file), with the turns executed, the regrips and rotations on that fingering, and notes
 * on its costly bits. Trailing rotations are free (never done); a leading x costs SPEED_COSTS.xStart and a leading y
 * or z a full rotation, unless ignoreAuf drops a leading y as part of the AUF. An empty alg takes 0 ms. Throws on
 * anything that is not a move.
 */
export function algSpeed(alg: string, options: AlgSpeedOptions = {}): AlgSpeed {
  const tokens = executedTokens(alg, options.ignoreAuf ?? false);
  const moves = tokens.filter(({ family }) => !ROTATIONS.has(family)).length;
  if (tokens.length === 0) return { ms: 0, moves: 0, regrips: 0, notes: [] };
  let layer = startLayer();
  tokens.forEach((token, index) => {
    layer = step(layer, token, index === 0);
  });
  let best: Node | null = null;
  for (const node of layer.values()) if (!best || node.ms < best.ms) best = node;
  if (!best) throw new Error(`No fingering for "${alg}"`);
  const { regrips, notes } = report(eventsOf(best));
  return { ms: Math.round(C.start + best.ms), moves, regrips, notes };
}

// ---------------------------------------------------------------------------------------------------------------
// Recommendation

const LL_SETS: ReadonlySet<CaseSetId> = new Set(["PLL", "OLL", "COLL", "EPLL", "EO"]);

/** algSpeed as the trainer uses it for a case: last-layer algs without their AUFs, F2L algs whole. */
export function caseAlgSpeed(caseId: string, alg: string): AlgSpeed {
  return algSpeed(alg, { ignoreAuf: LL_SETS.has(getCase(caseId).set) });
}

export type RecommendOptions = {
  /** The solver's measured median execution time per alg, in ms (keys in any spelling isSameAlg accepts). */
  personalMs?: Readonly<Record<string, number>>;
};

export type Recommendation = { alg: string; ms: number };

function measuredFor(alg: string, personal: readonly (readonly [string, number])[]): number | undefined {
  return personal.find(([key]) => isSameAlg(key, alg))?.[1];
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// The solver's speed relative to the model: the median of measured / estimated over his measured algs, so
// estimates for algs he has not timed are on his scale, not the model's.
function personalFactor(caseId: string, personal: readonly (readonly [string, number])[]): number {
  const ratios = personal.flatMap(([alg, ms]) => {
    const estimate = caseAlgSpeed(caseId, alg).ms;
    return estimate > 0 ? [ms / estimate] : [];
  });
  return ratios.length === 0 ? 1 : median(ratios);
}

/**
 * "Best overall" alg for a case: the option (algOptions) with the lowest execution time, where an alg's time is the
 * solver's measured median when personalMs has one, and otherwise the model's estimate (caseAlgSpeed) scaled by his
 * speed relative to the model: the median of measured / estimated over every alg in personalMs (1 when empty). The
 * scaling keeps measured and estimated times comparable for a solver slower or faster than the model; pass medians
 * from other cases too for a steadier factor (with only one alg timed, the factor makes that alg's estimate equal
 * its time and the model's order stands). Ties go to fewer moves, then algOptions' order. Throws on an unknown case,
 * a personalMs key that is not an alg, or a time that is not a positive number; null only when the case has no
 * options.
 */
export function recommendAlg(caseId: string, options: RecommendOptions = {}): Recommendation | null {
  const personal = Object.entries(options.personalMs ?? {});
  for (const [alg, ms] of personal) {
    if (!Number.isFinite(ms) || ms <= 0) throw new RangeError(`personalMs for "${alg}" must be positive: ${ms}`);
  }
  const factor = personalFactor(caseId, personal);
  let best: (Recommendation & { moves: number }) | null = null;
  for (const option of algOptions(caseId)) {
    const ms = measuredFor(option.alg, personal) ?? caseAlgSpeed(caseId, option.alg).ms * factor;
    if (best && (ms > best.ms || (ms === best.ms && option.moves >= best.moves))) continue;
    best = { alg: option.alg, ms, moves: option.moves };
  }
  return best && { alg: best.alg, ms: Math.round(best.ms) };
}
