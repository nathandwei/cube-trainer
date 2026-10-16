import { describe, expect, it } from "vitest";
import { checkBluetooth, classifyConnectError, normalizeMac, type BrowserEnv } from "./browser";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15";
const FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0";

function bluetooth(availability: () => Promise<boolean>): Bluetooth {
  return { getAvailability: availability } as unknown as Bluetooth;
}

const brave = { isBrave: async () => true };
const disabled = () => Promise.reject(new DOMException("Web Bluetooth API globally disabled.", "NotFoundError"));

describe("checkBluetooth", () => {
  it.each<{ name: string; env: BrowserEnv; kind: string }>([
    { name: "Chrome with Bluetooth on", env: { isSecureContext: true, navigator: { userAgent: CHROME, bluetooth: bluetooth(async () => true) } }, kind: "ok" },
    { name: "Chrome with Bluetooth off", env: { isSecureContext: true, navigator: { userAgent: CHROME, bluetooth: bluetooth(async () => false) } }, kind: "off" },
    { name: "plain http", env: { isSecureContext: false, navigator: { userAgent: CHROME, bluetooth: bluetooth(async () => true) } }, kind: "insecure" },
    { name: "Brave without the API", env: { isSecureContext: true, navigator: { userAgent: CHROME, brave } }, kind: "brave-disabled" },
    { name: "Brave with it globally disabled", env: { isSecureContext: true, navigator: { userAgent: CHROME, brave, bluetooth: bluetooth(disabled) } }, kind: "brave-disabled" },
    { name: "Chrome disabled by policy", env: { isSecureContext: true, navigator: { userAgent: CHROME, bluetooth: bluetooth(disabled) } }, kind: "blocked" },
    { name: "Safari", env: { isSecureContext: true, navigator: { userAgent: SAFARI } }, kind: "unsupported" },
    { name: "Firefox", env: { isSecureContext: true, navigator: { userAgent: FIREFOX } }, kind: "unsupported" },
  ])("$name → $kind", async ({ env, kind }) => {
    expect((await checkBluetooth(env)).kind).toBe(kind);
  });

  it.each([
    [SAFARI, "safari"],
    [FIREFOX, "firefox"],
    [CHROME, "other"],
  ])("names the browser for %s", async (userAgent, browser) => {
    expect(await checkBluetooth({ isSecureContext: true, navigator: { userAgent } })).toEqual({ kind: "unsupported", browser });
  });
});

describe("classifyConnectError", () => {
  it.each([
    [new DOMException("User cancelled the requestDevice() chooser.", "NotFoundError"), "cancelled"],
    [new DOMException("Web Bluetooth API globally disabled.", "NotFoundError"), "disabled"],
    [new Error("Timed out waiting for cube data. Check the Bluetooth MAC address and try again."), "wrong-mac"],
    [new Error("Unable to determine cube MAC address, connection is not possible!"), "no-mac"],
    [new Error("Selected device doesn't match any registered smartcube protocol"), "unsupported-cube"],
    [new Error("GATT connection timeout"), "other"],
  ])("%s → %s", (error, kind) => {
    expect(classifyConnectError(error)).toBe(kind);
  });
});

describe("normalizeMac", () => {
  it.each([
    ["ab:12:34:56:78:9a", "AB:12:34:56:78:9A"],
    ["  AB-12-34-56-78-9A ", "AB:12:34:56:78:9A"],
    ["AB:12:34:56:78", null],
    ["AB:12:34:56:78:9G", null],
    ["", null],
  ])("%j → %j", (input, output) => {
    expect(normalizeMac(input)).toBe(output);
  });
});
