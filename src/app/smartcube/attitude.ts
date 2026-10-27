// Where the smart cube points, for every cube on screen: it's held the way the real one is, so the centre on top on
// screen is the one on top in his hands and his R is the screen's R. Tilt is read against gravity and always right
// (see follower.ts). Which way round the cube faces him is not something the gyro can know, so it's learnt whenever
// the cube is held a known way: "reset orientation" (white down, green front), or a scramble just followed on the
// band (white on top, green front), in the timer, a drill or "Set up my cube". Until then the side facing him at the
// first report is taken to be green.
//
// What's learnt outlives the page: which way round each cube faces and its last report are remembered, so after a
// reload the cube on screen already faces as the cube does, before it has reported (a still cube may not), and
// Line up isn't asked again.

import { smartCube, type SmartCubeLink } from "./connection";
import { CubeFollower, SCRAMBLE_GRIP, SOLVER_GRIP, type Hold } from "./follower";
import { GYRO_TUNING, snap, type GridOrientation, type Quaternion } from "./gyro";

/**
 * The hold the moment the cube reaches a scramble, when it's known: as scrambled (white on top, green in front) when
 * the band led it there. Reached any other way (he scrambled it himself, or it was already there), how it's held
 * isn't known: null.
 */
export function heldAtScramble(followedBand: boolean): Hold | null {
  return followedBand ? { report: smartCube.lastGyro, grip: SCRAMBLE_GRIP } : null;
}

/** What the attitude follows: the app's cube link (or a stand-in in tests). */
export type AttitudeSource = Pick<SmartCubeLink, "onGyro" | "onMove" | "subscribe" | "state" | "orientationReference">;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

/** Which way round a cube faced (learnt) and its last report, remembered for the next page load. */
type Remembered = { device: string; heading: Quaternion; report: Quaternion; at: number };

const STORAGE_KEY = "cube.attitude";
/** A cube left this long (ms) may have slept and lost its own sense of direction: what's remembered is dropped. */
const REMEMBER_MS = 20 * 60_000;
/** The last report is written down at most this often (ms). */
const SAVE_EVERY_MS = 1000;

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch (error) {
    console.warn("No storage to remember the cube's attitude in", error);
    return null;
  }
}

function isQuaternion(value: unknown): value is Quaternion {
  const q = value as Quaternion | null;
  return !!q && [q.w, q.x, q.y, q.z].every((v) => typeof v === "number" && Number.isFinite(v));
}

export class AmbientAttitude {
  readonly #link: AttitudeSource;
  readonly #storage: Storage | null;
  readonly #now: () => number;
  readonly #follower = new CubeFollower();
  #current: Quaternion | null = null;
  /** Which way round the cube faces is known from a hold, not guessed. */
  #anchored = false;
  #savedAt = 0;
  readonly #listeners = new Set<() => void>();

  constructor(link: AttitudeSource, storage: Storage | null = browserStorage(), now: () => number = Date.now) {
    this.#link = link;
    this.#storage = storage;
    this.#now = now;
    link.onGyro((q, hostT) => {
      if (!this.#follower.holding && !this.#resume()) {
        const reference = link.orientationReference;
        if (reference) this.hold({ report: reference, grip: SOLVER_GRIP });
        else this.#follower.hold({ report: q, grip: SOLVER_GRIP });
      }
      this.#set(this.#follower.gyro(q, hostT));
      if (this.#anchored && this.#now() - this.#savedAt >= SAVE_EVERY_MS) this.#save(q);
    });
    link.onMove((move, hostT) => this.#follower.turn(move, hostT));
    link.subscribe(() => {
      // Connected again: face the cube as it was left, before it reports.
      if (link.state.status === "connected") {
        if (!this.#follower.holding) this.#resume();
        return;
      }
      // Gone: nothing to follow until it's back.
      if (!this.#follower.holding) return;
      this.#follower.reset();
      this.#anchored = false;
      this.#set(null);
    });
  }

  /**
   * How the cube is held now, as the nearest of the 24 orientations from the solver's grip, when that's known: the
   * way round it faces has been learnt, and it's clearly at one.
   */
  get grip(): GridOrientation | null {
    if (!this.#anchored || !this.#current) return null;
    const { orientation, degrees } = snap(this.#current);
    return degrees <= GYRO_TUNING.enterDegrees ? orientation : null;
  }

  /** The cube's attitude from the solver's grip; null while there's no gyro to follow. */
  get current(): Quaternion | null {
    return this.#current;
  }

  /** Which way round the cube faces has been learnt (a hold), not guessed from its first report. */
  get anchored(): boolean {
    return this.#anchored;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** The cube is held as `hold` says now (it reached a scramble, or "reset orientation"); null: not known. */
  hold(hold: Hold | null): void {
    if (!hold?.report) return;
    const learnt = !this.#anchored;
    this.#anchored = true;
    this.#set(this.#follower.hold(hold));
    this.#save(hold.report);
    if (learnt) for (const listener of this.#listeners) listener();
  }

  /** Picks up where this cube was left on an earlier page load, if that's recent; whether it could. */
  #resume(): boolean {
    const device = this.#link.state.deviceName;
    const remembered = this.#remembered();
    if (!device || !remembered || remembered.device !== device || this.#now() - remembered.at > REMEMBER_MS) return false;
    this.#follower.resume(remembered.heading);
    this.#anchored = true;
    this.#set(this.#follower.attitudeOf(remembered.report));
    for (const listener of this.#listeners) listener();
    return true;
  }

  #remembered(): Remembered | null {
    try {
      const raw = this.#storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Remembered>;
      const ok = typeof parsed.device === "string" && typeof parsed.at === "number" && isQuaternion(parsed.heading) && isQuaternion(parsed.report);
      return ok ? (parsed as Remembered) : null;
    } catch (error) {
      console.warn("Could not read the cube's remembered attitude", error);
      return null;
    }
  }

  #save(report: Quaternion): void {
    const device = this.#link.state.deviceName;
    const heading = this.#follower.heading;
    if (!this.#storage || !device || !heading) return;
    this.#savedAt = this.#now();
    try {
      this.#storage.setItem(STORAGE_KEY, JSON.stringify({ device, heading, report, at: this.#savedAt } satisfies Remembered));
    } catch (error) {
      console.warn("Could not remember the cube's attitude", error);
    }
  }

  #set(attitude: Quaternion | null): void {
    if (attitude === this.#current) return;
    this.#current = attitude;
    for (const listener of this.#listeners) listener();
  }
}

export const ambientAttitude = new AmbientAttitude(smartCube);

/**
 * He's holding the cube white down, green in front: remember that grip for every solve (the cube link's reference)
 * and face every cube on screen that way from now. False before the cube's first gyro report.
 */
export function lineUp(): boolean {
  if (!smartCube.resetOrientation()) return false;
  ambientAttitude.hold({ report: smartCube.lastGyro, grip: SOLVER_GRIP });
  return true;
}
