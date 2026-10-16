// Can this browser reach a Bluetooth cube? Chrome and Edge on macOS can; Brave can once its flag is on (it ships
// Web Bluetooth off); Safari and Firefox never will (docs/research/04-smart-cube-payoff.md §5).

export const BRAVE_FLAG = "brave://flags/#brave-web-bluetooth-api";
export const MAC_HINT_COMMAND = "system_profiler SPBluetoothDataType";

export type BluetoothSupport =
  | { kind: "ok" }
  /** Web Bluetooth only exists on https (and localhost). */
  | { kind: "insecure" }
  /** Brave with brave://flags/#brave-web-bluetooth-api off. */
  | { kind: "brave-disabled" }
  /** No Web Bluetooth at all. */
  | { kind: "unsupported"; browser: "safari" | "firefox" | "other" }
  /** The browser has Web Bluetooth but the Mac's Bluetooth is off or the browser is not allowed to use it. */
  | { kind: "off" }
  /** Turned off some other way (an enterprise policy, a Chrome flag). */
  | { kind: "blocked"; message: string };

type BraveNavigator = { brave?: { isBrave?: () => Promise<boolean> } };

export type BrowserEnv = {
  navigator: Pick<Navigator, "userAgent" | "bluetooth"> & BraveNavigator;
  isSecureContext: boolean;
};

const GLOBALLY_DISABLED = /globally disabled/i;

async function isBrave(env: BrowserEnv): Promise<boolean> {
  const check = env.navigator.brave?.isBrave;
  if (typeof check !== "function") return false;
  try {
    return await check.call(env.navigator.brave);
  } catch (error) {
    console.warn("navigator.brave.isBrave() failed", error);
    return false;
  }
}

/** Brave answers navigator.brave.isBrave(); its presence alone is enough to word a hint. */
export function looksLikeBrave(nav: BraveNavigator = navigator as BraveNavigator): boolean {
  return typeof nav.brave?.isBrave === "function";
}

function browserName(userAgent: string): "safari" | "firefox" | "other" {
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/Safari\//.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg)\//.test(userAgent)) return "safari";
  return "other";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function checkBluetooth(env: BrowserEnv = { navigator, isSecureContext: window.isSecureContext }): Promise<BluetoothSupport> {
  if (!env.isSecureContext) return { kind: "insecure" };
  const bluetooth = env.navigator.bluetooth;
  if (!bluetooth) {
    if (await isBrave(env)) return { kind: "brave-disabled" };
    return { kind: "unsupported", browser: browserName(env.navigator.userAgent) };
  }
  if (typeof bluetooth.getAvailability !== "function") return { kind: "ok" };
  try {
    return (await bluetooth.getAvailability()) ? { kind: "ok" } : { kind: "off" };
  } catch (error) {
    const message = messageOf(error);
    if (GLOBALLY_DISABLED.test(message) && (await isBrave(env))) return { kind: "brave-disabled" };
    return { kind: "blocked", message };
  }
}

export type ConnectFailure =
  /** The person closed Chrome's device chooser. */
  | "cancelled"
  /** Web Bluetooth is switched off in this browser (Brave flag, policy). */
  | "disabled"
  /** The cube never answered with a valid state: almost always a wrong MAC address. */
  | "wrong-mac"
  /** The MAC was needed and not given. */
  | "no-mac"
  /** The chosen device is not a cube this build can drive. */
  | "unsupported-cube"
  | "other";

export function classifyConnectError(error: unknown): ConnectFailure {
  const message = messageOf(error);
  if (error instanceof DOMException && error.name === "NotFoundError" && /cancel/i.test(message)) return "cancelled";
  if (GLOBALLY_DISABLED.test(message)) return "disabled";
  if (/Timed out waiting for cube data/i.test(message)) return "wrong-mac";
  if (/Unable to determine cube MAC/i.test(message)) return "no-mac";
  if (/doesn't match any registered smartcube protocol|not supported by this build|unsupported cube device/i.test(message)) {
    return "unsupported-cube";
  }
  return "other";
}

const MAC_RE = /^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i;

/** "ab-12-34-56-78-9a" or "AB:12:..." → "AB:12:34:56:78:9A"; null if it is not a MAC address. */
export function normalizeMac(input: string): string | null {
  const trimmed = input.trim();
  if (!MAC_RE.test(trimmed)) return null;
  return trimmed.toUpperCase().replace(/-/g, ":");
}
