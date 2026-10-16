import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FakeBluetoothDevice } from "@/app/smartcube/testing/fakeBluetooth";
import * as def from "./gan-cube-definitions";
import { GanGen2CubeEncrypter, GanGen4CubeEncrypter } from "./gan-cube-encrypter";
import { macStringToSaltOrThrow } from "./gan-mac-salt";
import { connectSmartCube, type SmartCubeEvent } from "./smartcube/index";

// Upstream's own captures from real cubes: encrypted notifications as the cube sent them, and the events
// upstream's driver decoded from them. Replaying them through this copy (with rx.ts and aes.ts standing in for
// rxjs and aes-js) must give the same events.

const fixtureSchema = z.object({
  device: z.object({ name: z.string(), mac: z.string() }),
  protocol: z.object({ id: z.string() }),
  traffic: z.array(z.object({ op: z.string(), service: z.string(), characteristic: z.string().optional(), data: z.string().optional() })),
  events: z.array(z.object({ event: z.looseObject({ type: z.string() }) })),
});
type Fixture = z.infer<typeof fixtureSchema>;

function loadFixture(name: string): Fixture {
  return fixtureSchema.parse(JSON.parse(readFileSync(new URL(`./captures/${name}`, import.meta.url), "utf8")));
}

function hexBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
}

type Comparable = { type: string; value: unknown };

function comparable(event: { type: string } & Record<string, unknown>): Comparable | null {
  switch (event.type) {
    case "MOVE":
      return { type: "MOVE", value: [event.move, event.cubeTimestamp] };
    case "FACELETS":
      return { type: "FACELETS", value: event.facelets };
    case "GYRO":
      return { type: "GYRO", value: event.quaternion };
    case "BATTERY":
      return { type: "BATTERY", value: event.batteryLevel };
    default:
      return null;
  }
}

type Case = {
  file: string;
  service: string;
  command: string;
  state: string;
  isFacelets: (plain: Uint8Array) => boolean;
  decrypt: (mac: string, data: Uint8Array) => Uint8Array;
};

const key = def.GAN_ENCRYPTION_KEYS[0];
const CASES: Case[] = [
  {
    file: "fixture_GANi4_A26E_gan-gen4_2026-04-14T11-38-02.json",
    service: def.GAN_GEN4_SERVICE,
    command: def.GAN_GEN4_COMMAND_CHARACTERISTIC,
    state: def.GAN_GEN4_STATE_CHARACTERISTIC,
    isFacelets: (plain) => plain[0] === 0xed,
    decrypt: (mac, data) =>
      new GanGen4CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), macStringToSaltOrThrow(mac)).decrypt(data),
  },
  {
    file: "fixture_GANicXXX_gan-gen2_2026-04-14T11-39-47.json",
    service: def.GAN_GEN2_SERVICE,
    command: def.GAN_GEN2_COMMAND_CHARACTERISTIC,
    state: def.GAN_GEN2_STATE_CHARACTERISTIC,
    isFacelets: (plain) => plain[0]! >> 4 === 0x04,
    decrypt: (mac, data) =>
      new GanGen2CubeEncrypter(new Uint8Array(key.key), new Uint8Array(key.iv), macStringToSaltOrThrow(mac)).decrypt(data),
  },
];

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe.each(CASES)("replaying $file", ({ file, service, command, state, isFacelets, decrypt }) => {
  it("decodes the same events upstream decoded from the real cube", async () => {
    const fixture = loadFixture(file);
    const notifies = fixture.traffic.filter((entry) => entry.op === "notify" && entry.data).map((entry) => hexBytes(entry.data!));
    const firstFacelets = notifies.findIndex((data) => isFacelets(decrypt(fixture.device.mac, data)));
    expect(firstFacelets).toBeGreaterThanOrEqual(0);

    const device = new FakeBluetoothDevice("replay", fixture.device.name);
    const gattService = device.gatt.addService(service);
    const stateChar = gattService.add(state);
    let sent = 0;
    const sendUpTo = async (end: number) => {
      while (sent < end) {
        stateChar.notify(notifies[sent++]!);
        await settle();
      }
    };
    // The driver's verification asks for facelets; answer with the capture up to its first facelets report.
    gattService.add(command).onWrite(() => void sendUpTo(firstFacelets + 1));

    const conn = await connectSmartCube({ device: device.asBluetoothDevice(), macAddressProvider: async () => fixture.device.mac });
    expect(conn.protocol.id).toBe(fixture.protocol.id);

    const seen: SmartCubeEvent[] = [];
    conn.events$.subscribe((event) => seen.push(event));
    await sendUpTo(notifies.length);

    // Like ours, upstream's capture subscribed once connected, so neither list has the verification reply.
    const decoded = seen.map((event) => comparable(event as never)).filter((event) => event !== null);
    const expected = fixture.events.map(({ event }) => comparable(event)).filter((event) => event !== null);
    expect(decoded.filter((e) => e.type === "MOVE")).toHaveLength(30);
    expect(decoded).toEqual(expected);
    await conn.disconnect();
  });
});
