// A GAN gen4 cube (GAN 16 ui Max, 12 ui MagLev, i4) simulated at the packet level: it encrypts real gen4 MOVE,
// FACELETS, GYRO and BATTERY notifications with the cube's MAC, and answers the driver's encrypted commands. The
// vendored driver decodes it exactly as it would decode the real cube. Test-only (vitest and the Playwright stub).

import { SOLVED, applyMove, type CubeState } from "@/cube/cubie";
import * as def from "@/vendor/smartcube-web-bluetooth/gan-cube-definitions";
import { GanGen4CubeEncrypter } from "@/vendor/smartcube-web-bluetooth/gan-cube-encrypter";
import { macStringToSaltOrThrow } from "@/vendor/smartcube-web-bluetooth/gan-mac-salt";
import { FakeBluetoothDevice, type FakeCharacteristic } from "./fakeBluetooth";

const PACKET_BYTES = 20;
const FACE_BITS: Record<string, number> = { U: 2, R: 32, F: 8, D: 1, L: 16, B: 4 };
/** Any value in GAN_CIC_LIST: (i << 8) | 0x01. */
const COMPANY_ID = 0x0001;

export type Quaternion = { x: number; y: number; z: number; w: number };

type Options = { name?: string; mac?: string; battery?: number; advertiseMac?: boolean; id?: string };

function setBits(bytes: Uint8Array, offset: number, length: number, value: number): void {
  for (let i = 0; i < length; i++) {
    const bit = (value >> (length - 1 - i)) & 1;
    const position = offset + i;
    const index = position >> 3;
    const shift = 7 - (position & 7);
    bytes[index] = (bytes[index]! & ~(1 << shift)) | (bit << shift);
  }
}

function signMagnitude(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return (clamped < 0 ? 0x8000 : 0) | Math.round(Math.abs(clamped) * 0x7fff);
}

function sameBytes(a: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((byte, i) => a[i] === byte);
}

export class FakeGanCube {
  readonly device: FakeBluetoothDevice;
  readonly mac: string;
  battery: number;
  /** Cube-frame state (the cube's own URFDLB, white on U), in the same cubie convention as src/cube. */
  state: CubeState = SOLVED;
  /** Every decrypted command the driver sent, for assertions. */
  readonly commands: Uint8Array[] = [];
  #serial = 0;
  #clock = 1000;
  #encrypter: GanGen4CubeEncrypter;
  #notifyChar: FakeCharacteristic;

  constructor({ name = "GAN16_A1B2", mac = "AB:12:34:56:A1:B2", battery = 87, advertiseMac = false, id = "fake-gan" }: Options = {}) {
    this.mac = mac;
    this.battery = battery;
    this.device = new FakeBluetoothDevice(id, name);
    const key = def.GAN_ENCRYPTION_KEYS[0];
    this.#encrypter = new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), macStringToSaltOrThrow(mac));
    const service = this.device.gatt.addService(def.GAN_GEN4_SERVICE);
    const command = service.add(def.GAN_GEN4_COMMAND_CHARACTERISTIC);
    this.#notifyChar = service.add(def.GAN_GEN4_STATE_CHARACTERISTIC);
    command.onWrite((data) => this.#onCommand(data));
    if (advertiseMac) this.device.watchAdvertisements = () => this.#advertise();
  }

  get serial(): number {
    return this.#serial;
  }

  /** One cube-frame quarter turn ("R", "U'") with the cube's own timestamp; advances the cube clock by `gapMs`. */
  turn(move: string, gapMs = 120): void {
    const face = FACE_BITS[move.charAt(0)];
    const suffix = move.slice(1);
    if (face === undefined || (suffix !== "" && suffix !== "'")) throw new Error(`Fake cube turns are quarter turns, got "${move}"`);
    this.#clock += gapMs;
    this.#serial = (this.#serial + 1) & 0xff;
    this.state = applyMove(this.state, move);
    const bytes = new Uint8Array(PACKET_BYTES);
    bytes[0] = 0x01;
    bytes[1] = 0x09;
    new DataView(bytes.buffer).setUint32(2, this.#clock >>> 0, true);
    new DataView(bytes.buffer).setUint16(6, this.#serial, true);
    bytes[8] = ((suffix === "'" ? 1 : 0) << 6) | face;
    this.#send(bytes);
  }

  /** Orientation report: +X red, +Y blue, +Z white (the driver's convention). */
  gyro(q: Quaternion): void {
    const bytes = new Uint8Array(PACKET_BYTES);
    bytes[0] = 0xec;
    bytes[1] = 0x0b;
    const view = new DataView(bytes.buffer);
    view.setUint16(2, signMagnitude(q.w));
    view.setUint16(4, signMagnitude(q.x));
    view.setUint16(6, signMagnitude(q.y));
    view.setUint16(8, signMagnitude(q.z));
    this.#send(bytes);
  }

  sendFacelets(): void {
    const bytes = new Uint8Array(PACKET_BYTES);
    bytes[0] = 0xed;
    bytes[1] = 0x10;
    new DataView(bytes.buffer).setUint16(2, this.#serial, true);
    for (let i = 0; i < 7; i++) {
      setBits(bytes, 32 + i * 3, 3, this.state.cp[i]!);
      setBits(bytes, 53 + i * 2, 2, this.state.co[i]!);
    }
    for (let i = 0; i < 11; i++) {
      setBits(bytes, 69 + i * 4, 4, this.state.ep[i]!);
      setBits(bytes, 113 + i, 1, this.state.eo[i]!);
    }
    this.#send(bytes);
  }

  sendBattery(): void {
    const bytes = new Uint8Array(PACKET_BYTES);
    bytes[0] = 0xef;
    bytes[1] = 0x01;
    bytes[2] = this.battery;
    this.#send(bytes);
  }

  /** The radio link drops (out of range, battery dead): the browser fires gattserverdisconnected. */
  dropConnection(): void {
    this.device.gatt.disconnect();
  }

  #sendHardware(): void {
    const name = "GAN16uiM";
    const nameBytes = new Uint8Array(PACKET_BYTES);
    nameBytes[0] = 0xfc;
    nameBytes[1] = name.length + 1;
    for (let i = 0; i < name.length; i++) nameBytes[3 + i] = name.charCodeAt(i);
    const date = new Uint8Array(PACKET_BYTES);
    date[0] = 0xfa;
    new DataView(date.buffer).setUint16(3, 2026, true);
    date[5] = 7;
    date[6] = 9;
    const software = new Uint8Array(PACKET_BYTES);
    software[0] = 0xfd;
    software[3] = 0x21;
    const hardware = new Uint8Array(PACKET_BYTES);
    hardware[0] = 0xfe;
    hardware[3] = 0x10;
    for (const packet of [nameBytes, date, software, hardware]) this.#send(packet);
  }

  #onCommand(encrypted: Uint8Array): void {
    const command = this.#encrypter.decrypt(encrypted);
    this.commands.push(command);
    // The real cube answers after a radio round trip, never inside the write call.
    setTimeout(() => {
      if (sameBytes(command, [0xdd, 0x04, 0x00, 0xed])) return this.sendFacelets();
      if (sameBytes(command, [0xdd, 0x04, 0x00, 0xef])) return this.sendBattery();
      if (sameBytes(command, [0xdf, 0x03])) return this.#sendHardware();
      if (sameBytes(command, [0xd2, 0x0d, 0x05])) {
        this.state = SOLVED;
        return;
      }
    }, 5);
  }

  #send(plain: Uint8Array): void {
    this.#notifyChar.notify(this.#encrypter.encrypt(plain));
  }

  async #advertise(): Promise<void> {
    const payload = new Uint8Array(9);
    const macBytes = this.mac.split(":").map((part) => Number.parseInt(part, 16));
    for (let i = 0; i < 6; i++) payload[8 - i] = macBytes[i]!;
    const event = new Event("advertisementreceived");
    Object.defineProperty(event, "manufacturerData", { value: new Map([[COMPANY_ID, new DataView(payload.buffer)]]) });
    setTimeout(() => this.device.dispatchEvent(event), 20);
  }
}
