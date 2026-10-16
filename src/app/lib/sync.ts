// What the solve store and the learn store share: talking to the API, and keeping unsent work in localStorage.

import { sessionEnded } from "@/app/lib/account";

export class SaveFailure extends Error {
  constructor(
    readonly reason: string,
    readonly status: number | null,
  ) {
    super(reason);
  }
}

function reasonFor(status: number): string {
  if (status === 401) return "signed out";
  if (status === 413) return "too large";
  if (status === 507) return "account full";
  if (status < 500) return `rejected (${status})`;
  return `server error (${status})`;
}

/** Retrying cannot help: the server will refuse this exact body every time. */
export function isRefusal(failure: SaveFailure): boolean {
  return failure.status === 400 || failure.status === 413 || failure.status === 415;
}

/**
 * Sends one API request on behalf of `accountId`, which the Worker checks against the session. Anything but a 2xx
 * becomes a SaveFailure; a 401 also tells the account module the session is gone.
 */
export async function request(method: string, path: string, accountId: string | null, body?: string): Promise<Response> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (accountId) headers["x-account-id"] = accountId;
  let response: Response;
  try {
    response = await fetch(path, { method, headers, body });
  } catch (error) {
    console.error(`${method} ${path} could not reach the server`, error);
    throw new SaveFailure("offline", null);
  }
  if (response.ok) return response;
  let detail = "";
  try {
    detail = await response.text();
  } catch (error) {
    console.error(`${method} ${path}: could not read the error body`, error);
  }
  console.error(`${method} ${path} failed: HTTP ${response.status} ${detail}`);
  if (response.status === 401) sessionEnded();
  throw new SaveFailure(reasonFor(response.status), response.status);
}

/** The response body as JSON, or a SaveFailure("bad response"). */
export async function responseJson(response: Response, what: string): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    console.error(`${what} is not valid JSON`, error);
    throw new SaveFailure("bad response", response.status);
  }
}

function storageReason(error: unknown): string {
  return error instanceof DOMException && error.name === "QuotaExceededError" ? "storage full" : "storage unavailable";
}

/** A stored JSON value: undefined when absent, null when the key cannot be read or parsed (it is left in place). */
export function readValue(key: string): unknown {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (error) {
    console.error(`Could not read ${key}`, error);
    return null;
  }
  if (raw === null || raw === "") return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    console.error(`${key} is not valid JSON; leaving it in place`, error);
    return null;
  }
}

/** Returns why the value could not be written, or null once it is on disk. undefined removes the key. */
export function writeValue(key: string, value: unknown): string | null {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return null;
  } catch (error) {
    console.error(`Could not write ${key}`, error);
    return storageReason(error);
  }
}

/** Raw entries, unparsed so that nothing unreadable is ever dropped. null when the key cannot be used at all. */
export function readList(key: string): unknown[] | null {
  const value = readValue(key);
  if (value === undefined) return [];
  if (Array.isArray(value)) return value;
  if (value !== null) console.error(`${key} is not a list; leaving it in place`);
  return null;
}

/** Returns why the change could not be written, or null once it is on disk. An emptied list removes its key. */
export function updateList(key: string, change: (entries: unknown[]) => unknown[]): string | null {
  const entries = readList(key);
  if (entries === null) return "storage unreadable";
  const next = change(entries);
  return writeValue(key, next.length === 0 ? undefined : next);
}

export function idOf(entry: unknown): string | undefined {
  if (typeof entry !== "object" || entry === null || !("id" in entry)) return undefined;
  return typeof entry.id === "string" ? entry.id : undefined;
}
