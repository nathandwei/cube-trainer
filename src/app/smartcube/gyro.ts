// Whole-cube rotations from the smart cube's gyro.
//
// The gyro sits on the cube's core, which carries the centres, so it sees exactly what a RotationEvent means: a
// regrip (y), and also the centre movement inside a wide move or slice (r turns the core like x; M like x'). The
// driver reports the core's orientation as a quaternion in the cube's axes (+X red, +Y blue, +Z white) at about
// 10 Hz, and it drifts. So orientation is measured relative to a reference taken at a known grip (white down, green
// front: the start of a solve, or "reset orientation"), snapped to the nearest of the 24 cube orientations, and a
// change counts only once it is close to a new orientation and stays there (hysteresis plus dwell).
//
// That absolute reading wanders, though: a fast slice reads short (an M2 as 140° rather than 180°) and the error
// stays, so by the last layer a real solve can sit 50° from every orientation and nothing more is recognised. Slices
// are read another way too (CoreWatch): how far the core turned across just that slice's own turns, which a GAN cube
// measures to within about 10°. A slice read that way also sets the detector's reading straight.
//
// Tuning once the cube arrives: GYRO_TUNING below, and GYRO_INVERTED if a y regrip shows up as y'.

import { FrameTracker, parseRotation } from "@/cube";
import type { Move, Rotation } from "@/cube/types";

export type Quaternion = { w: number; x: number; y: number; z: number };

export const GYRO_TUNING = {
  /** A new 90° orientation counts once the cube is within this many degrees of it. Lower is stricter. */
  enterDegrees: 25,
  /** ...for this many reports in a row (~90 ms apart, faster in bursts). Two rejects a single noisy report. */
  dwellReports: 2,
  /**
   * A tip (x, z: the last layer no longer on top) needs more: a hand tilts the cube that way all through a solve, for
   * a wrist turn or a look at the back, and comes back, whereas a y regrip is held. Replaying 17 real solves, these
   * cut the rotations found from 44 to 14, nearly all of the dropped ones tips that came back; the solves read as
   * CFOP should after it (a third or more of the turns U), where before 5 of them read mostly sideways.
   */
  tipEnterDegrees: 15,
  tipDwellReports: 5,
  /** A rotation detected this soon after a face turn (ms) may be that turn's wide move or slice. */
  lookbackMs: 450,
  /** The two turns of a slice arrive this close together (ms). */
  slicePairMs: 50,
  /** Two equal quarter turns this close together (ms) are one half turn (matches src/cube HALF_TURN_MS). */
  halfTurnMs: 80,
  /**
   * CoreWatch: a slice's core rotation reads as that slice when it's within this many degrees of the slice's rotation
   * and at least `coreTurnDegrees` from no rotation at all. From 17 real solves: 56 of 64 opposite pairs read as
   * slices this way; the rest barely moved the core (two hands turning together).
   */
  coreMatchDegrees: 45,
  coreTurnDegrees: 55,
  /**
   * Same-axis turns this close together (ms) are one move: a slow M2's two halves, a wide half turn's quarters. A
   * slice's two turns can arrive further apart still (4–377 ms measured on a GAN by the Cubalyze project), but a
   * longer window swallows a turn and the wide move after it (F f in an OLL, read as nothing): replaying 17 real
   * solves, 400 ms found 3 more slices and lost 6 wide moves.
   */
  moveGapMs: 200,
  /**
   * A wide move CoreWatch reads (a lone turn with the core turning) counts when the core turns back with a turn of
   * its own within this long (ms): r ... r', f ... f', or M' ... r'. Held longer, the detector's tip reading has it.
   */
  widePairMs: 1500,
};

/**
 * Whether the driver's quaternion maps world to cube instead of cube to world. Derived from afedotov's GAN sample
 * app (which renders q0⁻¹·q as the cube's rotation); flip it if a clean y regrip is recorded as y'.
 */
export const GYRO_INVERTED = false;

const IDENTITY: Quaternion = { w: 1, x: 0, y: 0, z: 0 };

export function multiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function conjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

function normalize(q: Quaternion): Quaternion {
  const length = Math.hypot(q.w, q.x, q.y, q.z);
  if (length === 0 || !Number.isFinite(length)) throw new Error("Gyro quaternion has no length");
  return { w: q.w / length, x: q.x / length, y: q.y / length, z: q.z / length };
}

/** Angle in degrees between two orientations (a quaternion and its negation are the same orientation). */
export function angleBetween(a: Quaternion, b: Quaternion): number {
  const dot = Math.abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z);
  return (2 * Math.acos(Math.min(1, dot)) * 180) / Math.PI;
}

/**
 * A rotation in the cube's own axes re-expressed in the solver's (x right, y up, z towards the solver). In the
 * reference grip the cube's +X (red) points left, +Y (blue) away and +Z (white) down.
 */
function cubeAxesToSolver(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.z, z: -q.y };
}

/**
 * The reference that reads `report` as `reading` (an attitude in the solver's view): rotationSince(result, report)
 * is `reading`.
 */
export function referenceFor(report: Quaternion, reading: Quaternion): Quaternion {
  const offset = cubeAxesToSolver(reading);
  return GYRO_INVERTED ? multiply(offset, report) : multiply(report, conjugate(offset));
}

/** How the cube has turned in the solver's view since `reference` was read. */
export function rotationSince(reference: Quaternion, current: Quaternion): Quaternion {
  const ref = normalize(reference);
  const now = normalize(current);
  const delta = GYRO_INVERTED ? multiply(ref, conjugate(now)) : multiply(conjugate(ref), now);
  return cubeAxesToSolver(delta);
}

// x, y and z turn the cube like R, U and F: a quarter turn clockwise seen from that side, i.e. -90° about +x/+y/+z.
const S = Math.SQRT1_2;
const QUARTER: Record<"x" | "y" | "z", Quaternion> = {
  x: { w: S, x: -S, y: 0, z: 0 },
  y: { w: S, x: 0, y: -S, z: 0 },
  z: { w: S, x: 0, y: 0, z: -S },
};

export function rotationQuaternion(rotation: Rotation): Quaternion {
  const [axis, amount] = parseRotation(rotation);
  let q = IDENTITY;
  for (let i = 0; i < amount; i++) q = multiply(QUARTER[axis], q);
  return q;
}

/** One of the 24 orientations, with the fewest whole-cube rotations (applied in order) that reach it. */
export type GridOrientation = { q: Quaternion; rotations: Rotation[] };

const SINGLE: readonly Rotation[] = ["x", "x2", "x'", "y", "y2", "y'", "z", "z2", "z'"];

function buildGrid(): GridOrientation[] {
  const grid: GridOrientation[] = [{ q: IDENTITY, rotations: [] }];
  const known = (q: Quaternion) => grid.some((g) => angleBetween(g.q, q) < 1);
  for (const r of SINGLE) {
    const q = rotationQuaternion(r);
    if (!known(q)) grid.push({ q, rotations: [r] });
  }
  for (const first of SINGLE) {
    for (const second of SINGLE) {
      const q = multiply(rotationQuaternion(second), rotationQuaternion(first));
      if (!known(q)) grid.push({ q, rotations: [first, second] });
    }
  }
  if (grid.length !== 24) throw new Error(`Expected 24 cube orientations, built ${grid.length}`);
  return grid;
}

export const GRID: readonly GridOrientation[] = buildGrid();

/** The nearest of the 24 orientations and how far away it is (degrees). */
export function snap(q: Quaternion): { orientation: GridOrientation; degrees: number } {
  let best = GRID[0]!;
  let bestDegrees = angleBetween(best.q, q);
  for (const g of GRID) {
    const degrees = angleBetween(g.q, q);
    if (degrees < bestDegrees) {
      best = g;
      bestDegrees = degrees;
    }
  }
  return { orientation: best, degrees: bestDegrees };
}

/** The rotations that take orientation `from` to `to`, in the solver's view. */
export function rotationsBetween(from: GridOrientation, to: GridOrientation): Rotation[] {
  return snap(multiply(to.q, conjugate(from.q))).orientation.rotations;
}

/** Rotations the detector is sure of, and when the cube first came close to the new orientation (host ms). */
export type Detection = { rotations: Rotation[]; since: number };

/**
 * Follows one attempt: feed it every gyro report and it answers with the rotations it is sure of. `reference` is the
 * report at the start of the attempt and `initial` the orientation the cube had then, relative to the reference
 * grip (identity when unknown).
 */
export class RotationDetector {
  #reference: Quaternion;
  #initial: Quaternion;
  #current: GridOrientation;
  #candidate: { orientation: GridOrientation; since: number; reports: number } | null = null;

  constructor(reference: Quaternion, initial: GridOrientation = GRID[0]!) {
    this.#reference = reference;
    this.#initial = initial.q;
    this.#current = initial;
  }

  get orientation(): GridOrientation {
    return this.#current;
  }

  /** How `q` reads: the cube's attitude from the solver's grip, in the solver's view. */
  reading(q: Quaternion): Quaternion {
    // The regrip is measured about the cube's axes at the start, which sit `initial` away from the solver's grip, so
    // it applies after `initial`: initial · since (the other order misreads e.g. an x from a y start as z').
    return multiply(this.#initial, rotationSince(this.#reference, q));
  }

  /** From now on `report` reads as `reading`, and the cube is held at the orientation nearest it. */
  rebase(report: Quaternion, reading: Quaternion): void {
    this.#reference = referenceFor(report, reading);
    this.#initial = IDENTITY;
    this.#current = snap(reading).orientation;
    this.#candidate = null;
  }

  sample(q: Quaternion, t: number): Detection | null {
    const { orientation, degrees } = snap(this.reading(q));
    const rotations = rotationsBetween(this.#current, orientation);
    const tip = rotations.some((rotation) => !rotation.startsWith("y"));
    if (orientation === this.#current || degrees > (tip ? GYRO_TUNING.tipEnterDegrees : GYRO_TUNING.enterDegrees)) {
      this.#candidate = null;
      return null;
    }
    if (this.#candidate?.orientation === orientation) this.#candidate.reports++;
    else this.#candidate = { orientation, since: t, reports: 1 };
    if (this.#candidate.reports < (tip ? GYRO_TUNING.tipDwellReports : GYRO_TUNING.dwellReports)) return null;
    const detection = { rotations, since: this.#candidate.since };
    this.#current = orientation;
    this.#candidate = null;
    return detection;
  }
}

/**
 * Where the cube was at the start of a solve relative to the grip saved by "reset orientation": a grid orientation
 * only when it is clearly one (drift since the reset can be large), else null (assume the reference grip).
 */
export function startOrientation(reference: Quaternion | null, atStart: Quaternion): GridOrientation | null {
  if (!reference) return null;
  const { orientation, degrees } = snap(rotationSince(reference, atStart));
  return degrees <= GYRO_TUNING.enterDegrees ? orientation : null;
}

type Turn = { move: Move; hostT: number };

function turnsKey(turns: readonly Move[]): string {
  return [...turns].sort().join(" ");
}

/** "view-named turns|rotation" → that wide move or slice, from the engine's own expansion of each move. */
const COMBINED: ReadonlySet<string> = new Set(
  ["r", "l", "u", "d", "f", "b", "M", "E", "S"].flatMap((family) =>
    ["", "2", "'"].map((suffix) => {
      const { turns, rotation } = new FrameTracker().apply(family + suffix);
      return `${turnsKey(turns)}|${rotation}`;
    }),
  ),
);

/** A turn may arrive this long (ms) after the gyro report that already shows its centres turned. */
const TURN_SLACK_MS = 120;

/**
 * The index of the last turn of a wide move or slice that `rotation` completes, or null. Candidates are the turns
 * from `from` on (those after the previous rotation event) that arrived within GYRO_TUNING.lookbackMs before
 * `since`, when the gyro first saw the new orientation. `view` names reported turns as the solver saw them. A wide
 * half turn may still be two quarter turns here, and a slice is two opposite turns arriving together.
 */
export function wideMoveEnd(
  rotation: Rotation,
  turns: readonly Turn[],
  from: number,
  view: FrameTracker,
  since: number,
): number | null {
  const named = (i: number) => view.name(turns[i]!.move);
  const matches = (names: readonly Move[]) => COMBINED.has(`${turnsKey(names)}|${rotation}`);
  for (let i = turns.length - 1; i >= from; i--) {
    if (turns[i]!.hostT > since + TURN_SLACK_MS) continue;
    if (since - turns[i]!.hostT > GYRO_TUNING.lookbackMs) return null;
    if (matches([named(i)])) return i;
    if (i - 1 < from) continue;
    const gap = turns[i]!.hostT - turns[i - 1]!.hostT;
    const [a, b] = [named(i - 1), named(i)];
    if (a === b && !a.endsWith("2") && gap <= GYRO_TUNING.halfTurnMs && matches([`${a.charAt(0)}2`])) return i;
    if (gap <= GYRO_TUNING.slicePairMs && matches([a, b])) return i;
    if (i - 3 >= from && isQuarteredSliceHalf(turns, i, named) && matches(quarteredSliceHalf(i, named))) return i;
  }
  return null;
}

/** The two half turns a slice half turn reported as four interleaved quarters (M2 = R L' R L') stands for. */
function quarteredSliceHalf(i: number, named: (i: number) => Move): Move[] {
  return [`${named(i - 3).charAt(0)}2`, `${named(i - 2).charAt(0)}2`];
}

/**
 * Four quarters ending at `i` that are two opposite faces turned twice each, the same way each time, close enough
 * to be one slice half turn: some cubes report M2 that way rather than as two pairs.
 */
function isQuarteredSliceHalf(turns: readonly Turn[], i: number, named: (i: number) => Move): boolean {
  const names = [named(i - 3), named(i - 2), named(i - 1), named(i)];
  if (names.some((name) => name.endsWith("2"))) return false;
  const [first, second] = names;
  if (!first || !second || first.charAt(0) === second.charAt(0)) return false;
  const pairs = names.filter((name) => name === first).length === 2 && names.filter((name) => name === second).length === 2;
  const span = turns[i]!.hostT - turns[i - 3]!.hostT;
  return pairs && span <= GYRO_TUNING.halfTurnMs + GYRO_TUNING.slicePairMs;
}

// ---------------------------------------------------------------------------------------------------------------
// Wide moves and slices from the core's own turn

/** Net same-axis turns (sorted, centre frame) → the rotation their wide move or slice carries ("L2 R2" → x2). */
const CORE_TURNS: ReadonlyMap<string, Rotation> = new Map(
  ["r", "l", "u", "d", "f", "b", "M", "E", "S"].flatMap((family) =>
    ["", "2", "'"].map((suffix): [string, Rotation] => {
      const { turns, rotation } = new FrameTracker().apply(family + suffix);
      if (!rotation) throw new Error(`${family}${suffix} should carry a rotation`);
      return [turnsKey(turns), rotation];
    }),
  ),
);

const AXIS_OF: Readonly<Record<string, "x" | "y" | "z">> = { R: "x", L: "x", U: "y", D: "y", F: "z", B: "z" };

function quartersOf(move: Move): number {
  return move.endsWith("2") ? 2 : move.endsWith("'") ? 3 : 1;
}

/** A gyro report a move's turns are measured between, this long (ms) before the first and after the last... */
const CORE_BEFORE_MS = 20;
const CORE_AFTER_MS = 40;
/** ...but no further off than this (ms): an older report could take in a regrip as well. */
const CORE_REACH_MS = 300;
/** Reports kept for measuring moves (ms). */
const CORE_KEEP_MS = 3000;

type Sample = { q: Quaternion; t: number };

type Group = { start: number; end: number; firstT: number; lastT: number; axis: string; quarters: Map<string, number>; closed: boolean };

/** A slice read from how far the core turned across its turns. */
export type CoreTurn = {
  /** Its turns, by index among the turns fed in: start..end. */
  start: number;
  end: number;
  /** The rotation the slice carries, in the cube's own (centre) frame. */
  rotation: Rotation;
  /** The gyro reports either side of it, and when its last turn arrived (host ms). */
  before: Sample;
  after: Sample;
  t: number;
};

/**
 * Groups turns into moves (same-axis turns close together) and, once a gyro report from just after a move is in,
 * reports the moves whose core turned like the wide move or slice their turns would make: R and L' with the core
 * turning like x' is M, L with it turning like x is r. Two hands turning R and L' together barely move the core, nor
 * does a plain turn, so they never match.
 *
 * A slice counts as soon as it's read. A wide move needs more: in real solves a hard flick can make the gyro read a
 * quick 90° on a plain turn that drifts back, over a second or more, with no turn at all, and a wide move read wrongly
 * names every turn after it. So a wide move counts only when it's balanced: the core turns back with a turn of its
 * own soon after (r U R' U' r', the A perm's wide T perm shape) or had just turned that way (M' U R U' r'). A wide
 * move held on its own (l' U R' D2 ...) is left to the detector, which reads it once the tip is held.
 */
export class CoreWatch {
  #samples: Sample[] = [];
  #groups: Group[] = [];
  /** Moves already reported, for balancing a wide move against one just before it. */
  #recent: CoreTurn[] = [];

  /** Turn `index` (counting every turn fed in), centre frame, as the cube reported it. */
  turn(index: number, move: Move, hostT: number): void {
    const axis = AXIS_OF[move.charAt(0)];
    if (!axis) throw new Error(`Not an outer turn: ${move}`);
    const open = this.#groups.at(-1);
    if (open && !open.closed && open.axis === axis && open.end === index - 1 && hostT - open.lastT <= GYRO_TUNING.moveGapMs) {
      open.end = index;
      open.lastT = hostT;
      open.quarters.set(move.charAt(0), (open.quarters.get(move.charAt(0)) ?? 0) + quartersOf(move));
      return;
    }
    if (open) open.closed = true;
    this.#groups.push({ start: index, end: index, firstT: hostT, lastT: hostT, axis, quarters: new Map([[move.charAt(0), quartersOf(move)]]), closed: false });
  }

  /** No more turns are coming (the solve or take is done): the last move can be read as soon as its report is in. */
  close(): void {
    const open = this.#groups.at(-1);
    if (open) open.closed = true;
  }

  /** A gyro report: the slices it settles, oldest first. */
  sample(q: Quaternion, hostT: number): CoreTurn[] {
    this.#samples.push({ q, t: hostT });
    const found: CoreTurn[] = [];
    while (this.#groups.length > 0) {
      const group = this.#groups[0]!;
      if (!group.closed && hostT - group.lastT > GYRO_TUNING.moveGapMs) group.closed = true;
      if (!group.closed) break;
      const after = this.#samples.find((s) => s.t >= group.lastT + CORE_AFTER_MS);
      if (!after && hostT - group.lastT <= CORE_REACH_MS) break;
      const core = this.#read(group, after);
      const balance = core && group.quarters.size === 1 ? this.#balance(group, core, hostT) : "counts";
      if (balance === "wait") break;
      this.#groups.shift();
      if (!core || balance === "spike") continue;
      found.push(core);
      this.#recent.push(core);
    }
    this.#recent = this.#recent.filter((core) => hostT - core.t <= 2 * GYRO_TUNING.widePairMs);
    const oldest = Math.min(hostT, ...this.#groups.map((group) => group.firstT)) - CORE_KEEP_MS;
    while (this.#samples.length > 1 && this.#samples[1]!.t < oldest) this.#samples.shift();
    return found;
  }

  /**
   * Whether a wide move's core turn is balanced by an opposite one, a turn's own, just before it or within
   * GYRO_TUNING.widePairMs after: "counts"; "spike" when it can't be; "wait" while a later move may still say.
   */
  #balance(group: Group, core: CoreTurn, hostT: number): "counts" | "spike" | "wait" {
    const back = conjugate(rotationQuaternion(core.rotation));
    const undoes = (other: CoreTurn | null) => other !== null && angleBetween(rotationQuaternion(other.rotation), back) < 1;
    if (this.#recent.some((earlier) => undoes(earlier) && core.before.t - earlier.t <= GYRO_TUNING.widePairMs)) return "counts";
    for (const later of this.#groups.slice(1)) {
      if (later.firstT > group.lastT + GYRO_TUNING.widePairMs) return "spike";
      const after = this.#samples.find((s) => s.t >= later.lastT + CORE_AFTER_MS);
      const closed = later.closed || hostT - later.lastT > GYRO_TUNING.moveGapMs;
      if (!closed || (!after && hostT - later.lastT <= CORE_REACH_MS)) return "wait";
      if (undoes(this.#read(later, after))) return "counts";
    }
    return hostT - group.lastT > GYRO_TUNING.widePairMs ? "spike" : "wait";
  }

  #read(group: Group, after: Sample | undefined): CoreTurn | null {
    const net = [...group.quarters].flatMap(([face, quarters]) => (quarters % 4 === 0 ? [] : [`${face}${["", "2", "'"][(quarters % 4) - 1]}`]));
    const rotation = CORE_TURNS.get(turnsKey(net));
    if (!rotation || !after || after.t > group.lastT + CORE_REACH_MS) return null;
    const before = this.#samples.findLast((s) => s.t <= group.firstT - CORE_BEFORE_MS);
    if (!before || before.t < group.firstT - CORE_REACH_MS) return null;
    const turned = rotationSince(before.q, after.q);
    const fits = angleBetween(turned, rotationQuaternion(rotation)) < GYRO_TUNING.coreMatchDegrees;
    if (!fits || angleBetween(turned, IDENTITY) < GYRO_TUNING.coreTurnDegrees) return null;
    return { start: group.start, end: group.end, rotation, before, after, t: group.lastT };
  }
}

/** A whole-cube rotation placed among the turns: after `after` of them; `turn` is the turn it belongs to (r, M). */
export type PlacedRotation = { rotation: Rotation; after: number; hostT: number; turn: number | null };

/** Where an attempt's rotations fall among its turns, and the view they leave the solver in. */
export type Placement = {
  readonly turns: readonly Turn[];
  /** How the cube was held at the first turn, as rotations from the solver's grip. */
  readonly lead: readonly Rotation[];
  readonly placed: PlacedRotation[];
  /** Names reported turns as the solver saw them: the lead, then every placed rotation. */
  view: FrameTracker;
  /** Rotations go no earlier than this many turns (the last one placed). */
  lastAfter: number;
};

export function newPlacement(turns: readonly Turn[], lead: readonly Rotation[]): Placement {
  const view = new FrameTracker();
  for (const rotation of lead) view.rotate(rotation);
  return { turns, lead, placed: [], view, lastAfter: 0 };
}

/** Puts a detected rotation after the turn it belongs to: a wide move's or slice's last turn, else when it began. */
export function placeRotation(placement: Placement, rotation: Rotation, since: number, single: boolean): void {
  const { turns, placed } = placement;
  const wideEnd = single ? wideMoveEnd(rotation, turns, placement.lastAfter, placement.view, since) : null;
  const before = turns.filter((turn) => turn.hostT <= since).length;
  const after = wideEnd !== null ? wideEnd + 1 : Math.max(placement.lastAfter, before);
  placed.push({ rotation, after, hostT: since, turn: wideEnd });
  placement.view.rotate(rotation);
  placement.lastAfter = after;
}

function attitudeOf(rotations: readonly Rotation[]): Quaternion {
  return rotations.reduce((total, rotation) => multiply(rotationQuaternion(rotation), total), IDENTITY);
}

/**
 * Places a slice CoreWatch read, unless the detector already placed it with its turns. Whatever else the detector
 * made of that core turn meanwhile (a regrip, from a reading that had wandered) gives way to it, and the detector's
 * reading is set straight: the core turned exactly the slice's rotation.
 */
export function placeCoreTurn(placement: Placement, detector: RotationDetector, core: CoreTurn): void {
  const { placed } = placement;
  if (placed.some((rotation) => rotation.turn !== null && rotation.turn >= core.start && rotation.turn <= core.end)) return;
  const kept = placed.filter((rotation) => rotation.turn !== null || rotation.hostT < core.before.t);
  const after = core.end + 1;
  if (kept.some((rotation) => rotation.after > after)) return;
  // The move's rotation in the solver's view: its centre-frame rotation, seen from how the cube was held.
  const held = attitudeOf([...placement.lead, ...kept.map((rotation) => rotation.rotation)]);
  const inView = snap(multiply(multiply(held, rotationQuaternion(core.rotation)), conjugate(held))).orientation.rotations;
  const rotation = inView[0];
  if (inView.length !== 1 || !rotation) throw new Error(`${core.rotation} doesn't stay one rotation in the solver's view`);
  placed.splice(0, placed.length, ...kept, { rotation, after, hostT: core.t, turn: core.end });
  placement.view = new FrameTracker();
  for (const lead of placement.lead) placement.view.rotate(lead);
  for (const event of placed) placement.view.rotate(event.rotation);
  placement.lastAfter = Math.max(...placed.map((event) => event.after), 0);
  detector.rebase(core.after.q, multiply(detector.reading(core.before.q), rotationQuaternion(core.rotation)));
}
