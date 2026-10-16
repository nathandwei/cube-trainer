import { useSyncExternalStore } from "react";
import { accountSchema } from "@/shared/schema";

export type Account = { id: string; email: string; name: string; picture: string | null };

export type AccountState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; account: Account };

/** The last account the server confirmed, so the app still opens (and keeps saving locally) while offline. */
const CACHE_KEY = "cube.account";

const listeners = new Set<() => void>();
let state: AccountState = { status: "loading" };

function publish(next: AccountState): void {
  state = next;
  listeners.forEach((notify) => notify());
}

function cachedAccount(): Account | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(CACHE_KEY);
  } catch (error) {
    console.error("Could not read the remembered account", error);
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("The remembered account is not valid JSON", error);
    return null;
  }
  const account = accountSchema.safeParse(parsed);
  if (account.success) return account.data;
  console.error("The remembered account has an unexpected shape", account.error.issues);
  return null;
}

function remember(account: Account | null): void {
  try {
    if (account) localStorage.setItem(CACHE_KEY, JSON.stringify(account));
    else localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error("Could not update the remembered account", error);
  }
}

/** Only a 401 means signed out. When the server cannot be asked, the last confirmed account carries on. */
function unconfirmed(why: string, error?: unknown): AccountState {
  console.error(`Could not check sign-in: ${why}`, ...(error === undefined ? [] : [error]));
  const account = cachedAccount();
  return account ? { status: "signed-in", account } : { status: "signed-out" };
}

async function check(): Promise<AccountState> {
  let response: Response;
  try {
    response = await fetch("/api/me", { headers: { accept: "application/json" } });
  } catch (error) {
    return unconfirmed("the server is unreachable", error);
  }
  if (response.status === 401) {
    remember(null);
    return { status: "signed-out" };
  }
  if (!response.ok) return unconfirmed(`HTTP ${response.status}`);
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return unconfirmed("the answer is not JSON", error);
  }
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) return unconfirmed(`unexpected account: ${parsed.error.message}`);
  remember(parsed.data);
  return { status: "signed-in", account: parsed.data };
}

let started = false;

function start(): void {
  if (started) return;
  started = true;
  void check().then(publish);
}

if (typeof window !== "undefined") start();

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  start();
  return () => listeners.delete(notify);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Leaves the app for Google; the callback brings the browser back to "/" signed in. */
export function signIn(): void {
  window.location.assign("/api/auth/login");
}

const beforeSignOutTasks = new Set<() => Promise<void>>();

/**
 * Rejects, leaving the account signed in, when the server could not end the session. Unsaved solves are sent
 * first if possible; whatever is still unsent stays on this device under this account, for its next sign-in.
 */
export async function signOut(): Promise<void> {
  for (const task of beforeSignOutTasks) {
    try {
      await task();
    } catch (error) {
      console.error("Could not finish saving before signing out; the rest stays on this device", error);
    }
  }
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) throw new Error(`Sign-out failed: HTTP ${response.status}`);
  remember(null);
  publish({ status: "signed-out" });
}

// ---------- for store.ts ----------

/** The signed-in account, or null while loading or signed out. */
export function currentAccount(): Account | null {
  return state.status === "signed-in" ? state.account : null;
}

/** The server answered 401 to a request: the session is gone, so show the sign-in page. */
export function sessionEnded(): void {
  if (state.status === "signed-out") return;
  remember(null);
  publish({ status: "signed-out" });
}

/** Registers work that sign-out waits for (sending unsaved solves). */
export function beforeSignOut(task: () => Promise<void>): void {
  beforeSignOutTasks.add(task);
}
