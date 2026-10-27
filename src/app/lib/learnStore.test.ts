// The learn store against a fake server and a fake localStorage: outbox, batching, refusals, ordering across
// accounts, last-writer-wins settings and paging.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LEARN_SETTINGS, type LearnSettings, type Rep, type SettingsDoc } from "@/shared/learn";

// Outside React: run getSnapshot directly and subscribe immediately, which is what starts the loads.
vi.mock("react", () => ({
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, getSnapshot: () => unknown) => {
    subscribe(() => undefined);
    return getSnapshot();
  },
}));

function rep(id: string, createdAt: number, extra: Record<string, unknown> = {}): Rep {
  return {
    kind: "case",
    id,
    createdAt,
    item: "PLL-Ua",
    auf: "",
    recognitionMs: 500,
    executionMs: 1200,
    moves: ["R", "U'"],
    correct: true,
    source: "virtual",
    ...extra,
  } as Rep;
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
  json(key: string): unknown {
    const raw = this.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }
  ids(key: string): string[] {
    return ((this.json(key) as { id: string }[] | null) ?? []).map((r) => r.id).sort();
  }
}

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

class FakeServer {
  session: string | null = null;
  offline = false;
  full = false;
  holdPosts = 0;
  hold = gate();
  reps = new Map<string, Map<string, Rep>>();
  settings = new Map<string, SettingsDoc>();
  log: string[] = [];
  postSizes: number[] = [];

  of(user: string): Map<string, Rep> {
    let mine = this.reps.get(user);
    if (!mine) this.reps.set(user, (mine = new Map()));
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
    if (url.pathname === "/api/learn/settings") {
      const stored = this.settings.get(user) ?? { settings: DEFAULT_LEARN_SETTINGS, updatedAt: 0 };
      if (method === "GET") return json(200, stored);
      const doc = JSON.parse(String(init.body)) as SettingsDoc;
      if (doc.updatedAt > stored.updatedAt) this.settings.set(user, doc);
      return json(200, this.settings.get(user) ?? stored);
    }
    if (url.pathname === "/api/learn/reps" && method === "GET") {
      const all = [...this.of(user).values()].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1));
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      const offset = Number(url.searchParams.get("cursor") ?? 0);
      const next = offset + limit < all.length ? String(offset + limit) : null;
      return json(200, { reps: all.slice(offset, offset + limit), next });
    }
    if (url.pathname === "/api/learn/reps" && method === "POST") {
      const { reps } = JSON.parse(String(init.body)) as { reps: Rep[] };
      this.postSizes.push(reps.length);
      if (this.holdPosts > 0) {
        this.holdPosts -= 1;
        await this.hold.opened;
      }
      if (reps.some((r) => (r as { bad?: boolean }).bad)) return json(400, { error: "invalid reps" });
      if (this.full) return json(507, { error: "account full" });
      const mine = this.of(user);
      for (const r of reps) if (!mine.has(r.id)) mine.set(r.id, r);
      return new Response(null, { status: 204 });
    }
    if (url.pathname.startsWith("/api/learn/reps/") && method === "DELETE") {
      this.of(user).delete(decodeURIComponent(url.pathname.slice("/api/learn/reps/".length)));
      return new Response(null, { status: 204 });
    }
    return json(404, { error: "not found" });
  };
}

async function flush(rounds = 60): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

let storage: FakeStorage;
let server: FakeServer;

/** A fresh page load: new modules, the account check, then the learn tab subscribing. */
async function boot(open = true) {
  vi.resetModules();
  const account = await import("@/app/lib/account");
  account.useAccount();
  await flush();
  const learn = await import("@/app/lib/learnStore");
  if (open) learn.useReps();
  await flush();
  return { account, learn };
}

type Page = Awaited<ReturnType<typeof boot>>;
const repIds = (page: Page) => page.learn.useReps().map((r) => r.id);
const errorOf = (page: Page) => page.learn.useLearnStatus().saveError;

beforeEach(() => {
  storage = new FakeStorage();
  server = new FakeServer();
  server.session = "A";
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("fetch", server.fetch);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("loading", () => {
  it("asks the server for nothing until the learn tab subscribes", async () => {
    const page = await boot(false);
    expect(server.log.filter((line) => line.includes("/api/learn"))).toEqual([]);
    page.learn.useLearnSettings();
    await flush();
    expect(server.log).toContain("GET /api/learn/settings");
    expect(server.log).toContain("GET /api/learn/reps");
    expect(page.learn.useLearnStatus()).toEqual({ loaded: true, allRepsLoaded: true, saveError: null });
  });

  it("lists reps oldest first and pages through everything on loadAllReps", async () => {
    for (let i = 0; i < 2_500; i++) server.of("A").set(`r${String(i).padStart(4, "0")}`, rep(`r${String(i).padStart(4, "0")}`, i));
    const page = await boot();
    expect(repIds(page)).toHaveLength(1_000);
    expect(repIds(page)[0]).toBe("r1500");
    expect(page.learn.useLearnStatus().allRepsLoaded).toBe(false);
    await page.learn.loadAllReps();
    expect(repIds(page)).toHaveLength(2_500);
    expect(repIds(page)[0]).toBe("r0000");
    expect(repIds(page).at(-1)).toBe("r2499");
    expect(page.learn.useLearnStatus().allRepsLoaded).toBe(true);
  });

  it("a 401 while loading shows the sign-in page", async () => {
    vi.resetModules();
    const account = await import("@/app/lib/account");
    account.useAccount();
    await flush();
    server.session = null;
    const learn = await import("@/app/lib/learnStore");
    learn.useReps();
    await flush();
    expect(account.useAccount().status).toBe("signed-out");
  });
});

describe("reps", () => {
  it("sends new reps and empties the outbox", async () => {
    const page = await boot();
    page.learn.addReps([rep("b", 2), rep("a", 1)]);
    expect(repIds(page)).toEqual(["a", "b"]);
    await flush();
    expect(server.ids("A")).toEqual(["a", "b"]);
    expect(storage.getItem("cube.learn.pending.A")).toBeNull();
  });

  it("keeps reps made offline across a reload and sends them once back online", async () => {
    const page = await boot();
    server.offline = true;
    page.learn.addReps([rep("off-1", 1), rep("off-2", 2)]);
    await flush();
    expect(errorOf(page)).toBe("not saved: offline (kept on this device)");
    expect(storage.ids("cube.learn.pending.A")).toEqual(["off-1", "off-2"]);

    server.offline = false;
    const next = await boot();
    expect(server.ids("A")).toEqual(["off-1", "off-2"]);
    expect(repIds(next)).toEqual(["off-1", "off-2"]);
    expect(storage.getItem("cube.learn.pending.A")).toBeNull();
  });

  it("sends a big outbox in batches of 200", async () => {
    storage.setItem("cube.learn.pending.A", JSON.stringify(Array.from({ length: 450 }, (_, i) => rep(`q${i}`, i))));
    await boot();
    expect(server.postSizes).toEqual([200, 200, 50]);
    expect(server.ids("A")).toHaveLength(450);
    expect(storage.getItem("cube.learn.pending.A")).toBeNull();
  });

  it("finds the rep the server refuses, sets it aside, saves the rest, and never resends it", async () => {
    const page = await boot();
    page.learn.addReps([rep("ok-1", 1), rep("bad", 2, { bad: true }), rep("ok-2", 3)]);
    await flush();
    expect(server.ids("A")).toEqual(["ok-1", "ok-2"]);
    expect(storage.ids("cube.learn.rejected.A")).toEqual(["bad"]);
    expect(storage.getItem("cube.learn.pending.A")).toBeNull();
    expect(errorOf(page)).toBe("not saved: 1 reps refused by the server (set aside on this device)");
    const posts = server.postSizes.length;
    page.learn.addReps([rep("ok-3", 4)]);
    await flush();
    expect(server.postSizes.slice(posts)).toEqual([1]);
    expect(errorOf(page)).toBeNull();
  });

  it("keeps everything when the account is full", async () => {
    const page = await boot();
    server.full = true;
    page.learn.addReps([rep("f1", 1)]);
    await flush();
    expect(errorOf(page)).toBe("not saved: account full (kept on this device)");
    expect(storage.ids("cube.learn.pending.A")).toEqual(["f1"]);
  });

  it("sends reps added while a send is in flight", async () => {
    const page = await boot();
    server.holdPosts = 1;
    page.learn.addReps([rep("first", 1)]);
    await flush();
    page.learn.addReps([rep("second", 2)]);
    page.learn.addReps([rep("third", 3)]);
    await flush();
    server.hold.open();
    await flush();
    expect(server.ids("A")).toEqual(["first", "second", "third"]);
    expect(storage.getItem("cube.learn.pending.A")).toBeNull();
  });

  it("deletes a rep here at once and on the server, and a reload doesn't bring it back", async () => {
    const page = await boot();
    page.learn.addReps([rep("keep", 1), rep("gone", 2)]);
    await flush();
    page.learn.deleteRep("gone");
    expect(repIds(page)).toEqual(["keep"]);
    await flush();
    expect(server.ids("A")).toEqual(["keep"]);
    expect(repIds(await boot())).toEqual(["keep"]);
  });

  it("deletes a rep whose send is still in flight once that send lands", async () => {
    const page = await boot();
    server.holdPosts = 1;
    page.learn.addReps([rep("racing", 1)]);
    await flush();
    page.learn.deleteRep("racing");
    expect(repIds(page)).toEqual([]);
    server.hold.open();
    await flush();
    expect(server.ids("A")).toEqual([]);
    expect(storage.getItem("cube.learn.pending.A")).toBeNull();
    expect(server.log.filter((line) => line.startsWith("DELETE"))).toEqual(["DELETE /api/learn/reps/racing"]);
  });

  it("puts a rep back, unsent ones in the outbox, when the server can't be told", async () => {
    const page = await boot();
    server.offline = true;
    page.learn.addReps([rep("stays", 1)]);
    await flush();
    page.learn.deleteRep("stays");
    await flush();
    expect(repIds(page)).toEqual(["stays"]);
    expect(storage.ids("cube.learn.pending.A")).toEqual(["stays"]);
    expect(errorOf(page)).toBe("not deleted: offline");
  });

  it("throws on a rep that does not match the schema", async () => {
    const page = await boot();
    expect(() => page.learn.addReps([{ ...rep("x", 1), auf: "U3" } as unknown as Rep])).toThrow(/Invalid rep x/);
  });
});

describe("accounts", () => {
  it("a page still signed in as A cannot send A's reps once the browser has switched to B", async () => {
    const page = await boot();
    server.offline = true;
    page.learn.addReps([rep("a-rep", 1)]);
    await flush();
    server.session = "B";
    server.offline = false;
    page.learn.addReps([rep("a-rep-2", 2)]);
    await flush();
    expect(server.ids("B")).toEqual([]);
    expect(page.account.useAccount().status).toBe("signed-out");
    expect(storage.ids("cube.learn.pending.A")).toEqual(["a-rep", "a-rep-2"]);

    // B's own page never sees or sends them.
    const b = await boot();
    expect(repIds(b)).toEqual([]);
    expect(server.ids("B")).toEqual([]);
  });

  it("signing out sends unsent reps and settings first", async () => {
    const page = await boot();
    server.offline = true;
    page.learn.addReps([rep("late", 1)]);
    page.learn.updateLearnSettings({ items: ["PLL"] });
    await flush();
    server.offline = false;
    await page.account.signOut();
    expect(server.ids("A")).toEqual(["late"]);
    expect(server.settings.get("A")?.settings.items).toEqual(["PLL"]);
    expect(server.log.lastIndexOf("POST /api/learn/reps")).toBeLessThan(server.log.indexOf("POST /api/auth/logout"));
    expect(storage.getItem("cube.learn.pending.A")).toBeNull();
    expect(storage.getItem("cube.learn.settings.A")).toBeNull();
  });
});

describe("settings", () => {
  it("starts from the defaults and saves a change", async () => {
    const page = await boot();
    expect(page.learn.useLearnSettings()).toEqual(DEFAULT_LEARN_SETTINGS);
    page.learn.updateLearnSettings({ items: ["PLL", "cross"], algs: { "PLL-Ua": "R U' R U R U R U' R' U' R2" } });
    expect(page.learn.useLearnSettings().items).toEqual(["PLL", "cross"]);
    await flush();
    expect(server.settings.get("A")?.settings).toMatchObject({ items: ["PLL", "cross"], algs: { "PLL-Ua": "R U' R U R U R U' R' U' R2" } });
    expect(storage.getItem("cube.learn.settings.A")).toBeNull();
  });

  it("takes a function for nested changes, and keeps fields it does not know", async () => {
    server.settings.set("A", { settings: { ...DEFAULT_LEARN_SETTINGS, algs: { "PLL-Ua": "a" }, theme: "warm" } as LearnSettings, updatedAt: 5 });
    const page = await boot();
    page.learn.updateLearnSettings((current) => ({
      ...current,
      algs: { ...current.algs, "PLL-Ub": "b" },
      algChosenAt: { ...current.algChosenAt, "PLL-Ub": 1_000 },
    }));
    await flush();
    expect(server.settings.get("A")?.settings).toMatchObject({ algs: { "PLL-Ua": "a", "PLL-Ub": "b" }, algChosenAt: { "PLL-Ub": 1_000 }, theme: "warm" });
  });

  it("coalesces quick changes and ends on the last one", async () => {
    const page = await boot();
    for (let n = 1; n <= 5; n++) page.learn.updateLearnSettings({ newPerSession: n });
    await flush();
    expect(server.settings.get("A")?.settings.newPerSession).toBe(5);
    expect(server.log.filter((line) => line === "PUT /api/learn/settings").length).toBeLessThanOrEqual(5);
    expect(page.learn.useLearnSettings().newPerSession).toBe(5);
  });

  it("keeps a change made offline and sends it on the next load", async () => {
    const page = await boot();
    server.offline = true;
    page.learn.updateLearnSettings({ items: ["OLL"] });
    await flush();
    expect(errorOf(page)).toBe("not saved: offline (kept on this device)");
    server.offline = false;
    const next = await boot();
    expect(server.settings.get("A")?.settings.items).toEqual(["OLL"]);
    expect(next.learn.useLearnSettings().items).toEqual(["OLL"]);
    expect(storage.getItem("cube.learn.settings.A")).toBeNull();
  });

  it("drops an unsent change when another device saved a newer one", async () => {
    const page = await boot();
    server.offline = true;
    page.learn.updateLearnSettings({ items: ["OLL"] });
    await flush();
    server.offline = false;
    server.settings.set("A", { settings: { ...DEFAULT_LEARN_SETTINGS, items: ["COLL"] }, updatedAt: Date.now() + 10_000 });
    const next = await boot();
    expect(next.learn.useLearnSettings().items).toEqual(["COLL"]);
    expect(server.settings.get("A")?.settings.items).toEqual(["COLL"]);
    expect(storage.getItem("cube.learn.settings.A")).toBeNull();
  });

  it("adopts the server's newer settings when its own write loses", async () => {
    const page = await boot();
    server.settings.set("A", { settings: { ...DEFAULT_LEARN_SETTINGS, items: ["EPLL"] }, updatedAt: Date.now() + 10_000 });
    page.learn.updateLearnSettings({ items: ["F2L"] });
    await flush();
    expect(page.learn.useLearnSettings().items).toEqual(["EPLL"]);
    // A change made after seeing the newer version wins, even though this clock is behind.
    page.learn.updateLearnSettings({ items: ["EPLL", "F2L"] });
    await flush();
    expect(server.settings.get("A")?.settings.items).toEqual(["EPLL", "F2L"]);
  });

  it("throws on settings that do not match the schema", async () => {
    const page = await boot();
    expect(() => page.learn.updateLearnSettings({ items: "PLL" as unknown as string[] })).toThrow(/Invalid learn settings/);
  });
});

describe("newRepId", () => {
  it("is a 26-character ULID that sorts by time", async () => {
    const { learn } = await boot(false);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_760_000_000_000);
    const earlier = learn.newRepId();
    vi.setSystemTime(1_760_000_000_001);
    const later = learn.newRepId();
    expect(earlier).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(earlier < later).toBe(true);
    expect(earlier.slice(0, 10)).toBe("01K742SG00");
    expect(new Set(Array.from({ length: 1000 }, () => learn.newRepId())).size).toBe(1000);
  });
});
