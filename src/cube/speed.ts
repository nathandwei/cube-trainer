// Alg execution speed: how long a competent CFOP solver (15–20 s averages) takes to run an alg once the case is
// recognised, estimated by simulating two hands, and the fastest alg on offer for a case.
//
// The hands. Each wrist has a position: 0 is home grip (thumb on the front), +1 is after an R (left hand: after an
// L', the mirror image), -1 is after an R' ("thumb down"), and +2 is only reachable by turning further up (R R),
// from where the hand has to come back. R, r, L, l and x turn wrists. Every other turn is a finger trick that only
// works with the acting hand's wrist in certain positions: U with the right index from home or after R (or pushed
// by the left index), U' its mirror, U2 a double flick, D and D' with a ring finger, F with the right index from
// thumb down (else a thumb push), F' its mirror, B with an index from the R/L' position, M slices with the left
// ring finger (M' is the quick one), S and E slowly. When nothing fits, a hand regrips to any position, which is
// cheaper while the other hand is turning; y and z rotations are a full regrip. A shortest-path search over (wrist
// positions, last finger used) picks the cheapest way through the whole alg, so R2 goes up or down as suits what
// follows (R2 then R2 is R R then R' R'), U goes to whichever index finger is free, and the starting grip is chosen
// too. Smaller costs: the same finger twice in a row, two finger tricks in a row on one hand, a wrist stretched to
// +2, left-wrist turns (a right-handed solver), and switching a hand between its R and r grips. U' with D on the
// left hand (or U with D' on the right) is one motion, as in the G perms' "D U'".
//
// Calibration: an RU trigger (R U R' U') runs at about 9 TPS and T perm takes about 1.3 s; constants were then
// tuned so that the model's fastest alg for each PLL, OLL and COLL case matches the community's most-voted one as
// often as possible (see speed-votes.ts and speed.test.ts for the data and the hit rates).
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
  start: 100,
  /** Starting with a hand away from home grip, per hand (set up while recognising). */
  startOffHome: 25,
  /** R, R', L, L', r, ... quarter wrist turn. */
  wrist: 72,
  /** R2, L2: a double wrist turn. */
  wristHalf: 120,
  /** Multiplies left-wrist turns: a right-handed solver's left wrist is slower. */
  leftWrist: 1.15,
  /** Switching a hand between its R grip and its r grip (or L and l). */
  wideSwitch: 50,
  /** U with the right index, U' with the left, F from thumb down: the basic flick. */
  flick: 90,
  /** U2 (or F2 from thumb down): a double flick. */
  flickHalf: 150,
  /** U pushed by the left index (U' by the right). */
  push: 120,
  /** D with the left ring finger, D' with the right. */
  ring: 125,
  /** D pushed by the right ring finger (D' by the left). */
  ringPush: 165,
  /** D2: a double ring flick. */
  ringHalf: 200,
  /** F pushed by the left thumb, F' by the right. */
  thumb: 135,
  /** B with the right index from the R position (B' with the left from L'). */
  back: 150,
  /** B2. */
  backHalf: 230,
  /** M' with the left ring finger. */
  sliceFlick: 105,
  /** M pushed back. */
  slicePush: 135,
  /** M2. */
  sliceHalf: 170,
  /** S, S', E, E'. */
  sliceSE: 140,
  /** S2, E2. */
  sliceSEHalf: 220,
  /** Multiplies u, d, f, b (wide turns other than r and l): two layers by finger. */
  wideFace: 1.35,
  /** x mid-alg: both wrists roll the cube (a leading or trailing x is part of the grip). */
  xRotation: 70,
  /** y or z mid-alg: let go and re-grab the cube. */
  rotation: 300,
  /** y2 or z2 mid-alg. */
  rotationHalf: 420,
  /** One hand lets go and re-grabs at another wrist position. */
  regrip: 190,
  /** The same, done while the other hand is turning. */
  regripOverlapped: 100,
  /** The same finger for two turns in a row: it has to reset first. */
  sameFinger: 90,
  /** Two finger tricks in a row on one hand (different fingers). */
  sameHand: 35,
  /** U' with D on the left hand (U with D' on the right): the second turn of the pair. */
  pairedTurn: 30,
  /** A finger trick while a wrist is stretched to +2. */
  stretch: 40,
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
  return note === undefined ? { kind: "finger", hand, finger: which, from, ms } : { kind: "finger", hand, finger: which, from, ms, note };
}

// U-like turns (U, u): amount 1 = clockwise from above, 3 = counter-clockwise, 2 = half.
function upTurns(amount: number, factor: number, note?: string): Action[] {
  const near = [0, 1] as const;
  switch (amount) {
    case 1:
      return [finger("right", "rIndex", near, C.flick * factor, note), finger("left", "lIndex", near, C.push * factor, note)];
    case 3:
      return [finger("left", "lIndex", near, C.flick * factor, note), finger("right", "rIndex", near, C.push * factor, note)];
    default:
      return [finger("right", "rIndex", near, C.flickHalf * factor, note), finger("left", "lIndex", near, C.flickHalf * factor, note)];
  }
}

function downTurns(amount: number, factor: number, note?: string): Action[] {
  const home = [0] as const;
  switch (amount) {
    case 1:
      return [finger("left", "lRing", home, C.ring * factor, note), finger("right", "rRing", home, C.ringPush * factor, note)];
    case 3:
      return [finger("right", "rRing", home, C.ring * factor, note), finger("left", "lRing", home, C.ringPush * factor, note)];
    default:
      return [finger("right", "rRing", home, C.ringHalf * factor, note), finger("left", "lRing", home, C.ringHalf * factor, note)];
  }
}

function frontTurns(amount: number, factor: number, note?: string): Action[] {
  const thumbDown = [-1] as const;
  const thumbFront = [0, 1] as const;
  switch (amount) {
    case 1:
      return [
        finger("right", "rIndex", thumbDown, C.flick * factor, note),
        finger("left", "lThumb", thumbFront, C.thumb * factor, note),
      ];
    case 3:
      return [
        finger("left", "lIndex", thumbDown, C.flick * factor, note),
        finger("right", "rThumb", thumbFront, C.thumb * factor, note),
      ];
    default:
      return [
        finger("right", "rIndex", thumbDown, C.flickHalf * factor, note),
        finger("left", "lIndex", thumbDown, C.flickHalf * factor, note),
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
      return [finger("right", "rIndex", up, C.backHalf * factor, note), finger("left", "lIndex", up, C.backHalf * factor, note)];
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
  return amount === 1 ? [finger("right", "rIndex", [0], C.sliceSE, note)] : [finger("left", "lIndex", [0], C.sliceSE, note)];
}

function equatorTurns(amount: number, note: string): Action[] {
  if (amount === 2) {
    return [finger("right", "rRing", [0], C.sliceSEHalf, note), finger("left", "lRing", [0], C.sliceSEHalf, note)];
  }
  return amount === 1 ? [finger("left", "lRing", [0], C.sliceSE, note)] : [finger("right", "rRing", [0], C.sliceSE, note)];
}

function actionsFor(token: MoveToken): Action[] {
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
      return upTurns(amount, C.wideFace, name);
    case "D":
      return downTurns(amount, 1);
    case "d":
    case "Dw":
      return downTurns(amount, C.wideFace, name);
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
    case "x":
      return wristDeltas(amount, 1).map((delta) => ({ kind: "x", delta, ms: amount === 2 ? 2 * C.xRotation : C.xRotation }));
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
  return `${g.right},${g.left},${g.finger},${g.rightWide ? 1 : 0}${g.leftWide ? 1 : 0},${g.last}`;
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
          const grip: Grip = { right, left, finger: "none", rightWide, leftWide, last: "" };
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
  return { grip, ms: node.ms + (overlapped ? C.regripOverlapped : C.regrip), prev: node, event: { kind: "regrip", hand } };
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

function isPairedTurn(prev: Grip, action: Action & { kind: "finger" }, name: string): boolean {
  const pairs: Record<string, [Finger, string]> = {
    "lRing D": ["lIndex", "U'"],
    "lIndex U'": ["lRing", "D"],
    "rRing D'": ["rIndex", "U"],
    "rIndex U": ["rRing", "D'"],
  };
  const pair = pairs[`${action.finger} ${name}`];
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
  const last = /^[UD]/.test(name) && name.length <= 2 ? name : "";
  return {
    grip: { ...g, finger: action.finger, last },
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
  const ms = action.ms + (wasWide === action.wide ? 0 : C.wideSwitch);
  const grip: Grip = right
    ? { ...g, right: position, rightWide: action.wide, finger: "rWrist", last: "" }
    : { ...g, left: position, leftWide: action.wide, finger: "lWrist", last: "" };
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
          grip: { right, left, finger: "none" as const, rightWide: false, leftWide: false, last: "" },
          ms: node.ms + action.ms,
          prev: node,
          event,
        })),
      );
  }
}

function step(layer: Map<string, Node>, token: MoveToken): Map<string, Node> {
  const actions = actionsFor(token);
  const name = label(token);
  const from = actions.some((action) => action.kind === "rotation") ? layer : withRegrips(layer);
  const next = new Map<string, Node>();
  for (const node of from.values()) for (const action of actions) for (const after of turn(node, action, name)) relax(next, after);
  if (next.size === 0) throw new Error(`No way to finger "${name}"`);
  return next;
}

// ---------------------------------------------------------------------------------------------------------------
// What gets executed, and the report

// Rotations before the first turn set up the grip and rotations after the last turn are never done, so neither
// costs anything (with ignoreAuf, a leading y is part of the AUF and is dropped along with it).
function executedTokens(alg: string, ignoreAuf: boolean): MoveToken[] {
  const tokens = tokenizeAlg(alg);
  const skipsAtStart = ({ family }: MoveToken): boolean => family === "x" || (ignoreAuf && (family === "U" || family === "y"));
  const skipsAtEnd = ({ family }: MoveToken): boolean => ROTATIONS.has(family) || (ignoreAuf && family === "U");
  let first = 0;
  let end = tokens.length;
  while (first < end && skipsAtStart(tokens[first]!)) first++;
  while (end > first && skipsAtEnd(tokens[end - 1]!)) end--;
  return tokens.slice(first, end);
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
 * on its costly bits. Leading rotations are part of the grip and trailing ones are never done, so neither counts;
 * a leading y or z mid-solve (F2L) does unless ignoreAuf. An empty alg takes 0 ms. Throws on anything that is not
 * a move.
 */
export function algSpeed(alg: string, options: AlgSpeedOptions = {}): AlgSpeed {
  const tokens = executedTokens(alg, options.ignoreAuf ?? false);
  const moves = tokens.filter(({ family }) => !ROTATIONS.has(family)).length;
  if (tokens.length === 0) return { ms: 0, moves: 0, regrips: 0, notes: [] };
  let layer = startLayer();
  for (const token of tokens) layer = step(layer, token);
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
 * speed relative to the model (median measured / estimated over the algs he has timed; 1 when none). Ties go to
 * fewer moves, then to algOptions' order. Throws on an unknown case or a measured time that is not a positive
 * number; null only when the case has no options.
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
