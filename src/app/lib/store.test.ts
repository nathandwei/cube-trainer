// The solve store and the account module against a fake server and a fake localStorage. Includes the races found
// in review: stale outbox copies resurrecting deletes or reverting penalties, and one account's unsent solves
// reaching another account on a shared browser.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolveRecord } from "@/cube/types";

// Outside React: run getSnapshot directly and subscribe immediately, which is what starts the account check and
// the solve load.
vi.mock("react", () => ({
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, getSnapshot: () => unknown) => {
    subscribe(() => undefined);
    return getSnapshot();
  },
}));

type Solve = SolveRecord;

function solve(id: string, createdAt: number, penalty: Solve["penalty"] = "none"): Solve {
  return { id, scramble: "R U", moves: [], totalMs: 1000, penalty, createdAt, source: "keyboard" };
}

class FakeStorage {
  map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  list(key: string): Solve[] | null {
    const raw = this.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as Solve[]);
  }
}

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

/** One server, many accounts; `session` is whose cookie the browser currently holds. */
class FakeServer {
  session: string | null = null;
  offline = false;
  meStatus: number | null = null;
  solves = new Map<string, Map<string, Solve>>();
  /** POST bodies with these ids get this status instead of being stored. */
  postStatus = new Map<string, number>();
  holdPosts = 0;
  hold = gate();
  log: string[] = [];

  of(user: string): Map<string, Solve> {
    let mine = this.solves.get(user);
    if (!mine) this.solves.set(user, (mine = new Map()));
    return mine;
  }

  ids(user: string): string[] {
    return [...this.of(user).keys()].sort();
  }

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const method = init.method ?? "GET";
    const url = new URL(String(input), "http://localhost");
    this.log.push(`${method} ${url.pathname}`);
    if (this.offline) throw new TypeError("Failed to fetch");
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    if (url.pathname === "/api/me") {
      if (this.meStatus !== null) return json(this.meStatus, { error: "down" });
      if (!this.session) return json(401, { error: "not signed in" });
      return json(200, { id: this.session, email: `${this.session}@example.com`, name: this.session, picture: null });
    }
    if (url.pathname === "/api/auth/logout") {
      this.session = null;
      return new Response(null, { status: 204 });
    }
    const user = this.session;
    if (!user) return json(401, { error: "not signed in" });
    const named = new Headers(init.headers).get("x-account-id");
    if (named !== null && named !== user) return json(401, { error: "signed in as a different account" });
    const mine = this.of(user);
    if (method === "GET") {
      const all = [...mine.values()].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
      const limit = Number(url.searchParams.get("limit") ?? 500);
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      const next = offset + limit < all.length ? String(offset + limit) : null;
      return json(200, { solves: all.slice(offset, offset + limit), next });
    }
    if (method === "POST") {
      const body = JSON.parse(String(init.body)) as Solve;
      if (this.holdPosts > 0) {
        this.holdPosts -= 1;
        await this.hold.opened;
      }
      const status = this.postStatus.get(body.id);
      if (status) return json(status, { error: "no" });
      // The write lands for whoever holds the session when the request arrives.
      this.of(user).set(body.id, body);
      return new Response(null, { status: 204 });
    }
    const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    if (method === "PATCH") {
      const current = mine.get(id);
      if (!current) return json(404, { error: "no such solve" });
      mine.set(id, { ...current, penalty: (JSON.parse(String(init.body)) as Pick<Solve, "penalty">).penalty });
      return new Response(null, { status: 204 });
    }
    if (method === "DELETE") {
      mine.delete(id);
      return new Response(null, { status: 204 });
    }
    return json(405, { error: "method not allowed" });
  };
}

async function flush(rounds = 60): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

let storage: FakeStorage;
let server: FakeServer;

/** A fresh page load: new module instances, the account check, then the shell mounting. */
async function boot() {
  vi.resetModules();
  const account = await import("@/app/lib/account");
  account.useAccount();
  await flush();
  const store = await import("@/app/lib/store");
  if (account.currentAccount()) store.useSolves();
  await flush();
  return { account, store };
}

type Booted = Awaited<ReturnType<typeof boot>>;

const ids = (booted: Booted) => booted.store.useSolves().map((s) => s.id);
const statusOf = (booted: Booted) => booted.account.useAccount().status;

beforeEach(() => {
  storage = new FakeStorage();
  server = new FakeServer();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("fetch", server.fetch);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("outbox races", () => {
  beforeEach(() => {
    server.session = "A";
    storage.setItem("cube.solves.v1", JSON.stringify(Array.from({ length: 8 }, (_, i) => solve(`s${i + 1}`, 1000 + i))));
    server.holdPosts = 4;
  });

  it("a solve deleted while the outbox is uploading stays deleted", async () => {
    const page = await boot();
    page.store.deleteSolve("s8");
    await flush();
    server.hold.open();
    await flush(200);
    expect(server.ids("A")).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]);
    expect(ids(page)).not.toContain("s8");
    expect(storage.getItem("cube.pending.A")).toBeNull();
  });

  it("a penalty set while the outbox is uploading is not reverted", async () => {
    const page = await boot();
    page.store.setPenalty("s8", "dnf");
    await flush();
    server.hold.open();
    await flush(200);
    expect(server.of("A").get("s8")?.penalty).toBe("dnf");
    expect(page.store.useSolves().find((s) => s.id === "s8")?.penalty).toBe("dnf");
    expect(storage.getItem("cube.pending.A")).toBeNull();
  });
});

describe("outbox per account", () => {
  it("a solve left unsent when A's session ended never reaches B, and stays with A", async () => {
    server.session = "A";
    const a = await boot();
    server.session = null;
    a.store.addSolve(solve("a-private", 5000));
    await flush();
    expect(statusOf(a)).toBe("signed-out");
    expect(storage.list("cube.pending.A")?.map((s) => s.id)).toEqual(["a-private"]);

    server.session = "B";
    const b = await boot();
    expect(statusOf(b)).toBe("signed-in");
    expect(server.ids("B")).toEqual([]);
    expect(ids(b)).toEqual([]);
    expect(storage.list("cube.pending.A")?.map((s) => s.id)).toEqual(["a-private"]);

    // Back as A, it is finally sent.
    server.session = "A";
    await boot();
    expect(server.ids("A")).toEqual(["a-private"]);
    expect(storage.getItem("cube.pending.A")).toBeNull();
  });

  it("a page still signed in as A cannot send A's solves once the browser has switched to B", async () => {
    server.session = "A";
    const a = await boot();
    server.offline = true;
    a.store.addSolve(solve("a-offline", 6000));
    await flush();
    // Another tab signs out and signs in as B; this page comes back online.
    server.session = "B";
    server.offline = false;
    a.store.addSolve(solve("a-next", 7000));
    await flush();
    expect(server.ids("B")).toEqual([]);
    expect(statusOf(a)).toBe("signed-out");
    expect(storage.list("cube.pending.A")?.map((s) => s.id).sort()).toEqual(["a-next", "a-offline"]);
  });

  it("signing out sends the outbox first", async () => {
    server.session = "A";
    const a = await boot();
    server.offline = true;
    a.store.addSolve(solve("late", 8000));
    await flush();
    server.offline = false;
    await a.account.signOut();
    expect(server.ids("A")).toEqual(["late"]);
    expect(server.log.indexOf("POST /api/solves")).toBeLessThan(server.log.indexOf("POST /api/auth/logout"));
    expect(storage.getItem("cube.pending.A")).toBeNull();
    expect(statusOf(a)).toBe("signed-out");
    expect(storage.getItem("cube.account")).toBeNull();
  });

  it("signing out still works when the outbox cannot be sent, and keeps it under A", async () => {
    server.session = "A";
    const a = await boot();
    server.postStatus.set("stuck", 503);
    a.store.addSolve(solve("stuck", 9000));
    await flush();
    await a.account.signOut();
    expect(statusOf(a)).toBe("signed-out");
    expect(storage.list("cube.pending.A")?.map((s) => s.id)).toEqual(["stuck"]);
  });

  it("solves saved before accounts go to the first account only, once", async () => {
    storage.setItem("cube.solves.v1", JSON.stringify([solve("old-1", 1), solve("old-2", 2)]));
    server.session = "A";
    const a = await boot();
    expect(server.ids("A")).toEqual(["old-1", "old-2"]);
    expect(ids(a)).toEqual(["old-2", "old-1"]);
    expect(storage.getItem("cube.solves.v1")).toBeNull();
    expect(storage.getItem("cube.solves.v1.adopted-by")).toBe("A");

    // An old tab writes the legacy key again; B signs in on this browser.
    storage.setItem("cube.solves.v1", JSON.stringify([solve("old-3", 3)]));
    server.session = "B";
    await boot();
    expect(server.ids("B")).toEqual([]);
    expect(storage.list("cube.solves.v1")?.map((s) => s.id)).toEqual(["old-3"]);
  });
});

describe("errors", () => {
  it("sets aside what the server refuses, says so once, and never resends it", async () => {
    server.session = "A";
    storage.setItem("cube.pending.A", JSON.stringify([solve("bad", 1), solve("good", 2), { id: "junk" }]));
    server.postStatus.set("bad", 400);
    const a = await boot();
    expect(server.ids("A")).toEqual(["good"]);
    expect(storage.getItem("cube.pending.A")).toBeNull();
    expect(storage.list("cube.rejected.A")?.map((s) => s.id).sort()).toEqual(["bad", "junk"]);
    expect(a.store.useSaveError()).toBe("not saved: 2 refused by the server (set aside on this device)");

    a.store.addSolve(solve("next", 3));
    await flush();
    expect(server.log.filter((line) => line === "POST /api/solves")).toHaveLength(3);
    expect(a.store.useSaveError()).toBeNull();
  });

  it("an upload finishing late does not clear a newer error", async () => {
    server.session = "A";
    storage.setItem("cube.pending.A", JSON.stringify([solve("slow", 1)]));
    server.holdPosts = 1;
    const a = await boot();
    server.postStatus.set("broken", 500);
    a.store.addSolve(solve("broken", 2));
    await flush();
    expect(a.store.useSaveError()).toBe("not saved: server error (500) (kept on this device)");
    server.hold.open();
    await flush();
    expect(server.ids("A")).toEqual(["slow"]);
    expect(a.store.useSaveError()).toBe("not saved: server error (500) (kept on this device)");
  });

  it("a 401 while loading shows the sign-in page instead of an empty list", async () => {
    server.session = "A";
    vi.resetModules();
    const account = await import("@/app/lib/account");
    account.useAccount();
    await flush();
    server.session = null;
    const store = await import("@/app/lib/store");
    store.useSolves();
    await flush();
    expect(account.useAccount().status).toBe("signed-out");
  });
});

describe("account", () => {
  it.each([
    { name: "unreachable", offline: true, meStatus: null, kept: ["offline-solve"], sent: [] },
    { name: "failing to say who is signed in", offline: false, meStatus: 503, kept: null, sent: ["offline-solve"] },
  ])("stays signed in from the remembered account while the server is $name, and keeps saving", async ({ offline, meStatus, kept, sent }) => {
    server.session = "A";
    await boot();
    server.offline = offline;
    server.meStatus = meStatus;
    const page = await boot();
    expect(page.account.useAccount()).toEqual({
      status: "signed-in",
      account: { id: "A", email: "A@example.com", name: "A", picture: null },
    });
    page.store.addSolve(solve("offline-solve", 1));
    await flush();
    expect(storage.list("cube.pending.A")?.map((s) => s.id) ?? null).toEqual(kept);
    expect(server.ids("A")).toEqual(sent);
  });

  it("is signed out on a 401, and forgets the remembered account", async () => {
    server.session = "A";
    await boot();
    expect(storage.getItem("cube.account")).not.toBeNull();
    server.session = null;
    const page = await boot();
    expect(statusOf(page)).toBe("signed-out");
    expect(storage.getItem("cube.account")).toBeNull();
  });

  it("is signed out when the server is unreachable and no account is remembered", async () => {
    server.offline = true;
    const page = await boot();
    expect(statusOf(page)).toBe("signed-out");
  });
});

describe("paging", () => {
  it("loads the newest page first and older pages on demand", async () => {
    server.session = "A";
    for (let i = 0; i < 1200; i++) server.of("A").set(`p${i}`, solve(`p${i}`, i));
    const page = await boot();
    expect(ids(page)).toHaveLength(500);
    expect(ids(page)[0]).toBe("p1199");
    expect(page.store.useHasMoreSolves()).toBe(true);
    await page.store.loadMoreSolves();
    expect(ids(page)).toHaveLength(1000);
    await page.store.loadMoreSolves();
    expect(ids(page)).toHaveLength(1200);
    expect(ids(page).at(-1)).toBe("p0");
    expect(page.store.useHasMoreSolves()).toBe(false);
  });
});
