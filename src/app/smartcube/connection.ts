// The one place the app talks to a Bluetooth cube. Wraps the vendored driver (src/vendor/smartcube-web-bluetooth)
// behind a small typed surface and keeps the connection's state for the UI.
//
// Everything leaving this module is in the solver frame (src/cube/types.ts): turns are renamed from the cube's own
// white-on-top frame, and the cube's state reports become CubeStates.

import { useSyncExternalStore } from "react";
import { SOLVED, applyMove, type CubeState } from "@/cube";
import type { Move } from "@/cube/types";
import {
  buildRequestDeviceOptions,
  connectSmartCube,
  getRegisteredProtocols,
  type SmartCubeConnection,
  type SmartCubeEvent,
} from "@/vendor/smartcube-web-bluetooth/smartcube/index";
import type { Subscription } from "@/vendor/smartcube-web-bluetooth/rx";
import { classifyConnectError, normalizeMac, type ConnectFailure } from "./browser";
import type { Quaternion } from "./gyro";
import { cubeMoveToSolver, solverStateFromFacelets } from "./state";

export type CubeStatus =
  | "idle"
  /** Chooser open, GATT connecting, or waiting for the first valid packet. */
  | "connecting"
  /** The cube needs its MAC address typed in (GAN gen2-4 on stock Chrome). */
  | "need-mac"
  | "connected"
  /** The link dropped; trying to get it back without the chooser. */
  | "reconnecting"
  /** The link dropped and could not be restored. */
  | "lost";

export type ConnectionState = {
  status: CubeStatus;
  /** As the cube advertises itself, e.g. "GANi4_A26E". */
  deviceName: string | null;
  battery: number | null;
  /** The cube's state: its last report, followed turn by turn since (solver frame). */
  cube: CubeState | null;
  /** The driver's progress line while connecting ("Connecting…"). */
  progress: string | null;
  failure: ConnectFailure | null;
  error: string | null;
  /** Set while status is "need-mac": which cube, and whether a MAC was just rejected. */
  macRequest: { deviceName: string; rejected: boolean } | null;
  /** The cube has sent orientation reports. */
  hasGyro: boolean;
};

export type MoveListener = (move: Move, hostT: number, cubeT: number | null) => void;
export type GyroListener = (q: Quaternion, hostT: number) => void;
export type FaceletsListener = (state: CubeState, hostT: number) => void;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export type LinkOptions = {
  bluetooth?: () => Bluetooth | undefined;
  storage?: () => Storage | null;
  now?: () => number;
  /** Waits before each automatic reconnect attempt. */
  retryDelaysMs?: readonly number[];
};

const MAC_KEY_PREFIX = "cube.mac.";
/** A state report counts only after the cube has been still this long; mid-turn reports can predate turns in flight. */
const STILL_MS = 600;
const BATTERY_POLL_MS = 5 * 60_000;
const RETRY_DELAYS_MS = [500, 2000, 5000];

const INITIAL: ConnectionState = {
  status: "idle",
  deviceName: null,
  battery: null,
  cube: null,
  progress: null,
  failure: null,
  error: null,
  macRequest: null,
  hasGyro: false,
};

const FAILURE_TEXT: Record<ConnectFailure, string> = {
  cancelled: "",
  disabled: "Web Bluetooth is switched off in this browser.",
  "wrong-mac": "The cube did not answer. Check the MAC address.",
  "no-mac": "",
  "unsupported-cube": "That device is not a cube this trainer can drive (GAN gen2 to gen4 cubes).",
  other: "Could not connect to the cube.",
};

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    console.warn("localStorage is unavailable", error);
    return null;
  }
}

/** "GANi4_A26E" → "GAN i4": the advertised name without its serial suffix, spaced like the box says it. */
export function shortCubeName(name: string): string {
  const bare = name.replace(/[_-][0-9A-F]{4}$/i, "");
  return /^GAN\S/.test(bare) ? `GAN ${bare.slice(3)}` : bare;
}

export class SmartCubeLink {
  readonly #options: Required<LinkOptions>;
  #state: ConnectionState = INITIAL;
  readonly #listeners = new Set<() => void>();
  readonly #moveListeners = new Set<MoveListener>();
  readonly #gyroListeners = new Set<GyroListener>();
  readonly #faceletsListeners = new Set<FaceletsListener>();
  readonly #lostListeners = new Set<() => void>();
  #conn: SmartCubeConnection | null = null;
  #subscription: Subscription | null = null;
  #device: BluetoothDevice | null = null;
  #lastMoveAt = -Infinity;
  #stateRequested = false;
  #lastGyro: Quaternion | null = null;
  #reference: Quaternion | null = null;
  #macAnswer: ((mac: string | null) => void) | null = null;
  #batteryTimer: ReturnType<typeof setInterval> | undefined;
  #attempt = 0;

  constructor(options: LinkOptions = {}) {
    this.#options = {
      bluetooth: options.bluetooth ?? (() => (typeof navigator === "undefined" ? undefined : navigator.bluetooth)),
      storage: options.storage ?? defaultStorage,
      now: options.now ?? (() => performance.now()),
      retryDelaysMs: options.retryDelaysMs ?? RETRY_DELAYS_MS,
    };
  }

  // ---------- state for the UI ----------

  get state(): ConnectionState {
    return this.#state;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getState = (): ConnectionState => this.#state;

  get status(): CubeStatus {
    return this.#state.status;
  }

  get deviceName(): string | null {
    return this.#state.deviceName;
  }

  get battery(): number | null {
    return this.#state.battery;
  }

  /** The grip saved by resetOrientation(), as a raw gyro report. */
  get orientationReference(): Quaternion | null {
    return this.#reference;
  }

  /** The latest gyro report, if the cube has sent one since connecting. */
  get lastGyro(): Quaternion | null {
    return this.#lastGyro;
  }

  // ---------- events ----------

  /** Every turn, in the solver frame: host arrival time and the cube's own timestamp (null if recovered). */
  onMove(listener: MoveListener): () => void {
    this.#moveListeners.add(listener);
    return () => this.#moveListeners.delete(listener);
  }

  /** Every orientation report (cube axes: +X red, +Y blue, +Z white), with its arrival time. */
  onGyro(listener: GyroListener): () => void {
    this.#gyroListeners.add(listener);
    return () => this.#gyroListeners.delete(listener);
  }

  /** The cube's own state reports (solver frame), when they can be trusted over the turn-by-turn state. */
  onFacelets(listener: FaceletsListener): () => void {
    this.#faceletsListeners.add(listener);
    return () => this.#faceletsListeners.delete(listener);
  }

  /** The link dropped without being asked to (fires once per drop, before any reconnect attempt). */
  onLost(listener: () => void): () => void {
    this.#lostListeners.add(listener);
    return () => this.#lostListeners.delete(listener);
  }

  // ---------- commands ----------

  /**
   * Opens the browser's device chooser and connects. Must run straight from a click: Chrome only opens the
   * chooser during a user gesture, so nothing is awaited before requestDevice().
   */
  async connect(): Promise<void> {
    const bluetooth = this.#options.bluetooth();
    if (!bluetooth) {
      this.#fail("disabled", new Error("Web Bluetooth is not available"));
      return;
    }
    const attempt = ++this.#attempt;
    this.#closeQuietly();
    this.#set({ status: "connecting", progress: "Choose your cube…", failure: null, error: null, macRequest: null });
    let device: BluetoothDevice;
    try {
      device = await bluetooth.requestDevice(buildRequestDeviceOptions(getRegisteredProtocols(), "filtered"));
    } catch (error) {
      if (attempt === this.#attempt) this.#fail(classifyConnectError(error), error);
      return;
    }
    this.#device = device;
    await this.#open(device, attempt);
  }

  /** Reconnects to the cube chosen earlier, without the chooser. */
  async reconnect(): Promise<void> {
    const device = this.#device;
    if (!device) return this.connect();
    const attempt = ++this.#attempt;
    this.#set({ status: "reconnecting", progress: "Reconnecting…", failure: null, error: null });
    await this.#open(device, attempt, "lost");
  }

  async disconnect(): Promise<void> {
    this.#attempt++;
    this.#macAnswer?.(null);
    const conn = this.#conn;
    // Detach first, so the stream ending reads as asked-for rather than as a dropped link.
    this.#teardown();
    this.#reference = null;
    this.#lastGyro = null;
    this.#set({ ...INITIAL });
    try {
      await conn?.disconnect();
    } catch (error) {
      console.error("Disconnecting the cube failed", error);
    }
  }

  /** Drops any current connection without waiting (connect() must reach requestDevice inside the click). */
  #closeQuietly(): void {
    const conn = this.#conn;
    if (!conn) return;
    this.#teardown();
    conn.disconnect().catch((error: unknown) => console.error("Disconnecting the previous cube failed", error));
  }

  /** The MAC typed into the connect sheet. */
  submitMac(input: string): boolean {
    const mac = normalizeMac(input);
    if (!mac) return false;
    const answer = this.#macAnswer;
    if (answer) {
      this.#macAnswer = null;
      answer(mac);
      return true;
    }
    // The previous MAC was rejected and that attempt is over: try again on the same device with this one.
    const device = this.#device;
    if (!device) return false;
    this.#remember(device.name ?? "", mac);
    this.#set({ status: "connecting", macRequest: null, progress: "Connecting…" });
    void this.#open(device, ++this.#attempt);
    return true;
  }

  cancelMac(): void {
    const answer = this.#macAnswer;
    this.#macAnswer = null;
    if (answer) answer(null);
    else this.#set({ status: "idle", macRequest: null, progress: null });
  }

  /** Asks the cube for its state; the answer goes to onFacelets listeners even mid-turn. */
  async requestState(): Promise<void> {
    const conn = this.#conn;
    if (!conn) return;
    this.#stateRequested = true;
    await this.#send(conn, { type: "REQUEST_FACELETS" });
  }

  /** The cube is solved in your hands: tell the cube (GAN resets its own state) and everyone listening. */
  async markSolved(): Promise<void> {
    const conn = this.#conn;
    if (conn?.capabilities.reset) await this.#send(conn, { type: "REQUEST_RESET" });
    this.#set({ cube: SOLVED });
    this.#emitFacelets(SOLVED, this.#options.now());
  }

  /** You are holding the cube white down, green front: remember that grip (the gyro drifts, so do it now and then). */
  resetOrientation(): boolean {
    if (!this.#lastGyro) return false;
    this.#reference = this.#lastGyro;
    return true;
  }

  // ---------- internals ----------

  /** `failedStatus`: where a failure leaves the link (idle after a fresh connect, lost or reconnecting otherwise). */
  async #open(device: BluetoothDevice, attempt: number, failedStatus: CubeStatus = "idle"): Promise<boolean> {
    let conn: SmartCubeConnection;
    try {
      conn = await connectSmartCube({
        device,
        macAddressProvider: (d, isFallback) => this.#provideMac(d, isFallback ?? false, attempt),
        onStatus: (message) => {
          if (attempt === this.#attempt) this.#set({ progress: message });
        },
      });
    } catch (error) {
      if (attempt !== this.#attempt) return false;
      const failure = classifyConnectError(error);
      if (failure === "wrong-mac") {
        this.#forget(device.name ?? "");
        this.#set({ status: "need-mac", macRequest: { deviceName: device.name ?? "cube", rejected: true }, progress: null });
        return false;
      }
      this.#fail(failure, error, failedStatus);
      return false;
    }
    if (attempt !== this.#attempt) {
      await conn.disconnect().catch((error: unknown) => console.error("Closing a superseded cube connection failed", error));
      return false;
    }
    this.#attach(conn);
    if (conn.deviceMAC) this.#remember(conn.deviceName, conn.deviceMAC);
    this.#set({
      status: "connected",
      deviceName: conn.deviceName,
      progress: null,
      failure: null,
      error: null,
      macRequest: null,
      hasGyro: false,
    });
    await this.requestState();
    if (conn.capabilities.battery) await this.#send(conn, { type: "REQUEST_BATTERY" });
    return true;
  }

  async #provideMac(device: BluetoothDevice, isFallback: boolean, attempt: number): Promise<string | null> {
    const remembered = this.#recall(device.name ?? "");
    if (!isFallback || remembered) return remembered;
    if (attempt !== this.#attempt) return null;
    // The driver could not read the MAC from advertisements (stock Chrome cannot): ask the person.
    this.#set({ status: "need-mac", macRequest: { deviceName: device.name ?? "cube", rejected: false }, progress: null });
    const mac = await new Promise<string | null>((resolve) => (this.#macAnswer = resolve));
    if (attempt !== this.#attempt) return null;
    if (mac) {
      this.#remember(device.name ?? "", mac);
      this.#set({ status: "connecting", macRequest: null, progress: "Connecting…" });
    } else {
      this.#set({ status: "idle", macRequest: null, progress: null });
    }
    return mac;
  }

  #attach(conn: SmartCubeConnection): void {
    this.#teardown();
    this.#conn = conn;
    this.#subscription = conn.events$.subscribe({
      next: (event) => this.#onEvent(event),
      complete: () => this.#onClosed(conn),
    });
    if (conn.capabilities.battery) {
      this.#batteryTimer = setInterval(() => void this.#send(conn, { type: "REQUEST_BATTERY" }), BATTERY_POLL_MS);
    }
  }

  #teardown(): void {
    this.#subscription?.unsubscribe();
    this.#subscription = null;
    this.#conn = null;
    clearInterval(this.#batteryTimer);
  }

  #onEvent(event: SmartCubeEvent): void {
    switch (event.type) {
      case "MOVE": {
        const move = cubeMoveToSolver(event.move);
        const hostT = event.localTimestamp ?? event.timestamp;
        this.#lastMoveAt = hostT;
        if (this.#state.cube) this.#set({ cube: applyMove(this.#state.cube, move) });
        for (const listener of this.#moveListeners) listener(move, hostT, event.cubeTimestamp);
        return;
      }
      case "FACELETS": {
        const state = solverStateFromFacelets(event.facelets);
        if (!state) {
          console.warn("The cube reported an impossible state", event.facelets);
          return;
        }
        const requested = this.#stateRequested;
        const still = event.timestamp - this.#lastMoveAt >= STILL_MS;
        if (!requested && !still) return;
        this.#stateRequested = false;
        this.#set({ cube: state });
        this.#emitFacelets(state, event.timestamp);
        return;
      }
      case "GYRO":
        this.#lastGyro = event.quaternion;
        if (!this.#state.hasGyro) this.#set({ hasGyro: true });
        for (const listener of this.#gyroListeners) listener(event.quaternion, event.timestamp);
        return;
      case "BATTERY":
        this.#set({ battery: event.batteryLevel });
        return;
      case "HARDWARE":
      case "DISCONNECT":
        return;
    }
  }

  #emitFacelets(state: CubeState, hostT: number): void {
    for (const listener of this.#faceletsListeners) listener(state, hostT);
  }

  /** The driver's event stream ended: we closed it, or the radio link dropped. */
  #onClosed(conn: SmartCubeConnection): void {
    if (this.#conn !== conn) return;
    this.#teardown();
    this.#set({ status: "reconnecting", cube: null, progress: "Reconnecting…" });
    for (const listener of this.#lostListeners) listener();
    void this.#retry(++this.#attempt);
  }

  async #retry(attempt: number): Promise<void> {
    const device = this.#device;
    for (const delay of this.#options.retryDelaysMs) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (attempt !== this.#attempt || !device) return;
      if (await this.#open(device, attempt, "reconnecting")) return;
      if (attempt !== this.#attempt || this.#state.status === "need-mac") return;
      this.#set({ failure: null, error: null, progress: "Reconnecting…" });
    }
    if (attempt === this.#attempt) this.#set({ status: "lost", progress: null });
  }

  async #send(conn: SmartCubeConnection, command: Parameters<SmartCubeConnection["sendCommand"]>[0]): Promise<void> {
    try {
      await conn.sendCommand(command);
    } catch (error) {
      console.error(`Cube command ${command.type} failed`, error);
    }
  }

  #fail(failure: ConnectFailure, error: unknown, status: CubeStatus = "idle"): void {
    if (failure !== "cancelled" && failure !== "no-mac") console.error("Cube connection failed", error);
    const detail = failure === "other" && error instanceof Error ? ` (${error.message})` : "";
    this.#set({
      status,
      progress: null,
      macRequest: null,
      failure: failure === "cancelled" || failure === "no-mac" ? null : failure,
      error: FAILURE_TEXT[failure] ? FAILURE_TEXT[failure] + detail : null,
    });
  }

  #recall(deviceName: string): string | null {
    try {
      return this.#options.storage()?.getItem(MAC_KEY_PREFIX + deviceName) ?? null;
    } catch (error) {
      console.warn("Could not read the saved cube MAC", error);
      return null;
    }
  }

  #remember(deviceName: string, mac: string): void {
    try {
      this.#options.storage()?.setItem(MAC_KEY_PREFIX + deviceName, mac);
    } catch (error) {
      console.warn("Could not save the cube MAC", error);
    }
  }

  #forget(deviceName: string): void {
    try {
      this.#options.storage()?.removeItem(MAC_KEY_PREFIX + deviceName);
    } catch (error) {
      console.warn("Could not clear the saved cube MAC", error);
    }
  }

  #set(patch: Partial<ConnectionState>): void {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener();
  }
}

/** The app's cube link. */
export const smartCube = new SmartCubeLink();

export function useSmartCube(): ConnectionState {
  return useSyncExternalStore(smartCube.subscribe, smartCube.getState);
}
