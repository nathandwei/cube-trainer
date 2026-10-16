import { describe, expect, it, vi } from "vitest";
import { SOLVED, applyAlg, createRng, invertAlg, randomScramble, scrambleToSolverFrame } from "@/cube";
import { splitAlg, toSolverFrame } from "@/app/lib/frame";
import { SmartCubeLink, shortCubeName, type LinkOptions } from "./connection";
import { CubeSession, type FinishedSolve } from "./session";
import { FakeGanCube } from "./testing/fakeGanCube";

// End to end below the UI: a GAN gen4 cube simulated at the packet level (encrypted with its MAC), the vendored
// driver decoding it, and the link and session on top, exactly as in the browser.

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

function setup(cube = new FakeGanCube(), options: LinkOptions = {}) {
  const requestDevice = vi.fn(async () => cube.device.asBluetoothDevice());
  const bluetooth = { requestDevice, getAvailability: async () => true } as unknown as Bluetooth;
  const storage = memoryStorage();
  const link = new SmartCubeLink({ bluetooth: () => bluetooth, storage: () => storage, retryDelaysMs: [5, 5, 5], ...options });
  return { cube, link, requestDevice, storage };
}

async function connectTyping(link: SmartCubeLink, mac: string): Promise<void> {
  const connecting = link.connect();
  await vi.waitFor(() => expect(link.status).toBe("need-mac"));
  expect(link.submitMac(mac)).toBe(true);
  await connecting;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SmartCubeLink", () => {
  it("asks for the MAC when the cube does not advertise it, then connects", async () => {
    const { cube, link } = setup();
    await connectTyping(link, cube.mac.toLowerCase());
    expect(link.state).toMatchObject({ status: "connected", deviceName: "GAN16_A1B2", macRequest: null, error: null });
    await vi.waitFor(() => expect(link.battery).toBe(87));
    await vi.waitFor(() => expect(link.state.cube).toEqual(SOLVED));
  });

  it("reads the MAC from advertisements when the browser exposes them", async () => {
    const { link } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    expect(link.status).toBe("connected");
  });

  it("remembers the MAC per cube name", async () => {
    const { cube, link, storage } = setup();
    await connectTyping(link, cube.mac);
    await link.disconnect();
    expect(link.status).toBe("idle");
    const again = new SmartCubeLink({
      bluetooth: () => ({ requestDevice: async () => cube.device.asBluetoothDevice() }) as unknown as Bluetooth,
      storage: () => storage,
    });
    await again.connect();
    expect(again.status).toBe("connected");
  });

  it.each(["nope", "AB:12:34:56:78", ""])("refuses %j as a MAC", async (input) => {
    const { link } = setup();
    expect(link.submitMac(input)).toBe(false);
  });

  it("goes back to idle without an error when the chooser is closed", async () => {
    const { link, requestDevice } = setup();
    requestDevice.mockRejectedValueOnce(new DOMException("User cancelled the requestDevice() chooser.", "NotFoundError"));
    await link.connect();
    expect(link.state).toMatchObject({ status: "idle", error: null, failure: null });
  });

  it("explains a browser with Web Bluetooth switched off", async () => {
    const { link, requestDevice } = setup();
    requestDevice.mockRejectedValueOnce(new DOMException("Web Bluetooth API globally disabled.", "NotFoundError"));
    await link.connect();
    expect(link.state).toMatchObject({ status: "idle", failure: "disabled" });
  });

  it("reports turns in the solver frame with the host and cube clocks", async () => {
    const { cube, link } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    await vi.waitFor(() => expect(link.state.cube).toEqual(SOLVED));
    const moves: [string, number, number | null][] = [];
    link.onMove((move, hostT, cubeT) => moves.push([move, hostT, cubeT]));
    cube.turn("U", 100);
    cube.turn("R'", 100);
    await vi.waitFor(() => expect(moves).toHaveLength(2));
    // The cube's U is the white face, which the solver holds down; its R is on the solver's left.
    expect(moves.map(([move]) => move)).toEqual(["D", "L'"]);
    expect(moves[1]![2]! - moves[0]![2]!).toBe(100);
    expect(link.state.cube).toEqual(applyAlg(SOLVED, ["D", "L'"]));
  });

  it("trusts a state report only when the cube is still or it was asked for", async () => {
    const { cube, link } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    await vi.waitFor(() => expect(link.state.cube).toEqual(SOLVED));
    const reports: unknown[] = [];
    link.onFacelets((state) => reports.push(state));
    cube.turn("F");
    await pause(10);
    cube.sendFacelets();
    await pause(10);
    expect(reports).toHaveLength(0);
    await link.requestState();
    await vi.waitFor(() => expect(reports).toEqual([applyAlg(SOLVED, ["F"])]));
  });

  it("gets a dropped cube back without the chooser", async () => {
    const { cube, link, requestDevice } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    const lost = vi.fn();
    link.onLost(lost);
    cube.dropConnection();
    await vi.waitFor(() => expect(lost).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(link.status).toBe("connected"));
    expect(requestDevice).toHaveBeenCalledOnce();
  });

  it("gives up after its retries and says the cube is lost", async () => {
    const { cube, link } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    cube.device.gatt.refuseConnections = true;
    const seen = new Set<string>();
    link.subscribe(() => seen.add(link.status));
    cube.dropConnection();
    await vi.waitFor(() => expect(link.status).toBe("lost"), { timeout: 5000 });
    // Never idle on the way: the timer would read that as "disconnected on purpose" and leave cube mode.
    expect([...seen].sort()).toEqual(["lost", "reconnecting"]);
    cube.device.gatt.refuseConnections = false;
    await link.reconnect();
    expect(link.status).toBe("connected");
  });

  it("marks the cube solved on the cube itself and for listeners", async () => {
    const { cube, link } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    cube.turn("R");
    const reports: unknown[] = [];
    link.onFacelets((state) => reports.push(state));
    await link.markSolved();
    expect(reports).toEqual([SOLVED]);
    await vi.waitFor(() => expect(cube.state).toEqual(SOLVED));
  });

  it("saves an orientation reference only once the gyro has spoken", async () => {
    const { cube, link } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    expect(link.resetOrientation()).toBe(false);
    cube.gyro({ w: 1, x: 0, y: 0, z: 0 });
    await vi.waitFor(() => expect(link.state.hasGyro).toBe(true));
    expect(link.resetOrientation()).toBe(true);
    expect(link.orientationReference).toMatchObject({ w: 1 });
  });
});

describe("shortCubeName", () => {
  it.each([
    ["GANi4_A26E", "GAN i4"],
    ["GAN16_A1B2", "GAN 16"],
    ["GANicXXX", "GAN icXXX"],
    ["MG3-AB12", "MG3"],
  ])("%s → %s", (name, short) => {
    expect(shortCubeName(name)).toBe(short);
  });
});

describe("a whole attempt over the simulated cube", () => {
  it("tracks the scramble, times the solve and hands over normalised moves", async () => {
    const { cube, link } = setup(new FakeGanCube({ advertiseMac: true }));
    await link.connect();
    const finished: FinishedSolve[] = [];
    const session = new CubeSession({
      inspection: () => false,
      orientationReference: () => null,
      solveFix: async () => [],
      onFinish: (solve) => finished.push(solve),
    });
    link.onMove((move, hostT, cubeT) => session.move(move, hostT, cubeT));
    link.onFacelets((state, hostT) => session.facelets(state, hostT));
    const scramble = randomScramble(createRng(3));
    session.setScramble(scramble);
    await vi.waitFor(() => expect(session.view().phase).toBe("scrambling"));

    // The cube reports quarter turns: a half turn is two, 40 ms apart on its clock and in real time.
    const turn = async (move: string, gapMs: number) => {
      const quarters = move.endsWith("2") ? [move.charAt(0), move.charAt(0)] : [move];
      for (const [i, quarter] of quarters.entries()) {
        const gap = i === 0 ? gapMs : 40;
        await pause(gap);
        cube.turn(quarter, gap);
      }
    };
    for (const move of splitAlg(scramble)) await turn(move, 5);
    await vi.waitFor(() => expect(session.view().phase).toBe("ready"));

    const solution = invertAlg(scrambleToSolverFrame(scramble)).map(toSolverFrame);
    for (const move of solution) await turn(move, 30);
    await vi.waitFor(() => expect(finished).toHaveLength(1));

    const solve = finished[0]!;
    expect(solve.moves.map((m) => m.move)).toEqual(invertAlg(scrambleToSolverFrame(scramble)));
    expect(solve.analysis?.solved).toBe(true);
    const cubeClockMs = solution.reduce((sum, m, i) => sum + (i === 0 ? 0 : 30) + (m.endsWith("2") ? 40 : 0), 0);
    expect(Math.abs(solve.totalMs - cubeClockMs)).toBeLessThan(cubeClockMs * 0.1 + 20);
  });
});
