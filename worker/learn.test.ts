// The learn API on the real Worker (workerd + in-memory D1 migrated from migrations/), like api.test.ts.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestHarness } from "wrangler";
import {
  DEFAULT_LEARN_SETTINGS,
  MAX_REP_BYTES_PER_ACCOUNT,
  MAX_REP_PAGE_SIZE,
  MAX_REPS_PER_ACCOUNT,
  MAX_REPS_PER_POST,
  type Rep,
  type SettingsDoc,
} from "../src/shared/learn";
import { hashSessionToken } from "./session";

const ORIGIN = "http://localhost";
const server = createTestHarness({
  workers: [{ configPath: "./worker/wrangler.test.jsonc", secrets: { GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "s" } }],
});
let env: Env;

async function addUser(id: string): Promise<string> {
  const now = Date.now();
  const token = `${id}-token`;
  await env.DB.prepare("INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, NULL, ?)")
    .bind(id, `sub-${id}`, `${id}@example.com`, id, now)
    .run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await hashSessionToken(token), id, now, now + 3_600_000)
    .run();
  return token;
}

function call(path: string, init: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...init.headers };
  if (init.token) headers.cookie = `session=${init.token}`;
  if (init.body !== undefined) headers["content-type"] ??= "application/json";
  return server.fetch(`${ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
}

function caseRep(id: string, createdAt: number, extra: Record<string, unknown> = {}): Rep {
  return {
    kind: "case",
    id,
    createdAt,
    item: "PLL-Ua",
    auf: "U",
    recognitionMs: 800,
    executionMs: 1400,
    moves: ["R", "U'", "R", "U", "R", "U", "R", "U'", "R'", "U'", "R2"],
    correct: true,
    source: "smartcube",
    ...extra,
  } as Rep;
}

const post = (token: string, reps: unknown[], headers?: Record<string, string>) =>
  call("/api/learn/reps", { method: "POST", token, body: { reps }, headers });

async function repPage(token: string, query = ""): Promise<{ reps: Rep[]; next: string | null }> {
  const response = await call(`/api/learn/reps${query}`, { token });
  expect(response.status).toBe(200);
  return (await response.json()) as { reps: Rep[]; next: string | null };
}

async function allRepIds(token: string): Promise<string[]> {
  const ids: string[] = [];
  let page = await repPage(token);
  ids.push(...page.reps.map((r) => r.id));
  while (page.next) {
    page = await repPage(token, `?cursor=${page.next}`);
    ids.push(...page.reps.map((r) => r.id));
  }
  return ids;
}

async function putSettings(token: string, doc: unknown) {
  const response = await call("/api/learn/settings", { method: "PUT", token, body: doc });
  return { status: response.status, body: (await response.json()) as SettingsDoc };
}

beforeAll(async () => {
  await server.listen();
  const worker = server.getWorker<Env>();
  await worker.applyD1Migrations("DB");
  env = await worker.getEnv();
}, 60_000);

afterAll(async () => {
  await server.close();
});

describe("auth", () => {
  it.each([
    { method: "GET", path: "/api/learn/settings" },
    { method: "PUT", path: "/api/learn/settings" },
    { method: "GET", path: "/api/learn/reps" },
    { method: "POST", path: "/api/learn/reps" },
    { method: "DELETE", path: "/api/learn/reps/x" },
  ])("$method $path is 401 without a session", async ({ method, path }) => {
    const body = method === "PUT" ? { settings: {}, updatedAt: 1 } : method === "POST" ? { reps: [caseRep("x", 1)] } : undefined;
    expect((await call(path, { method, body })).status).toBe(401);
  });

  it("refuses writes from another origin or naming another account", async () => {
    const token = await addUser("guarded");
    expect((await post(token, [caseRep("g", 1)], { origin: "https://evil.example" })).status).toBe(403);
    expect((await post(token, [caseRep("g", 1)], { "x-account-id": "someone-else" })).status).toBe(401);
    expect((await post(token, [caseRep("g", 1)], { "x-account-id": "guarded" })).status).toBe(204);
  });
});

describe("settings", () => {
  it("starts as the defaults with updatedAt 0", async () => {
    const token = await addUser("fresh");
    const response = await call("/api/learn/settings", { token });
    expect(await response.json()).toEqual({ settings: DEFAULT_LEARN_SETTINGS, updatedAt: 0 });
  });

  it("keeps the newest write, answers every write with what is stored, and keeps unknown fields", async () => {
    const token = await addUser("lww");
    const first = { settings: { items: ["PLL"], algs: { "PLL-Ua": "R U' R U R U R U' R' U' R2" }, theme: "warm" }, updatedAt: 1_000 };
    const saved = await putSettings(token, first);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({ settings: { ...DEFAULT_LEARN_SETTINGS, ...first.settings }, updatedAt: 1_000 });

    const newer = { settings: { items: ["PLL", "COLL"] }, updatedAt: 2_000 };
    expect((await putSettings(token, newer)).body).toEqual({ settings: { ...DEFAULT_LEARN_SETTINGS, ...newer.settings }, updatedAt: 2_000 });

    // An older write (or one with the same time) loses, and learns the stored version.
    for (const stale of [{ settings: { items: ["OLL"] }, updatedAt: 1_500 }, { settings: { items: ["F2L"] }, updatedAt: 2_000 }]) {
      const answer = await putSettings(token, stale);
      expect(answer.status).toBe(200);
      expect(answer.body.settings.items).toEqual(["PLL", "COLL"]);
      expect(answer.body.updatedAt).toBe(2_000);
    }
    const read = (await (await call("/api/learn/settings", { token })).json()) as SettingsDoc;
    expect(read.settings.items).toEqual(["PLL", "COLL"]);
  });

  it("does not let a clock far in the future lock the settings", async () => {
    const token = await addUser("future");
    const answer = await putSettings(token, { settings: { items: ["PLL"] }, updatedAt: Date.now() + 10 * 365 * 86_400_000 });
    expect(answer.body.updatedAt).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it.each([
    { name: "items that are not a list", doc: { settings: { items: "PLL" }, updatedAt: 1 } },
    { name: "a negative updatedAt", doc: { settings: {}, updatedAt: -1 } },
    { name: "no updatedAt", doc: { settings: {} } },
    { name: "an alg that is not text", doc: { settings: { algs: { "PLL-Ua": 5 } }, updatedAt: 1 } },
  ])("rejects $name", async ({ doc }) => {
    const token = await addUser(`bad-${Math.random().toString(36).slice(2, 8)}`);
    expect((await call("/api/learn/settings", { method: "PUT", token, body: doc })).status).toBe(400);
  });

  it("refuses settings over 128 KB", async () => {
    const token = await addUser("huge-settings");
    const algs = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`ZBLL-${i}`, "R U R' U' ".repeat(40)]));
    expect((await call("/api/learn/settings", { method: "PUT", token, body: { settings: { algs }, updatedAt: 1 } })).status).toBe(413);
  });
});

describe("reps", () => {
  it("stores a batch, lists it newest first, and ignores a resent batch", async () => {
    const token = await addUser("reps");
    const reps = [
      caseRep("r1", 1_000),
      { kind: "cross", id: "r2", createdAt: 2_000, item: "xcross", scramble: "R U F", optimalMoves: 7, moveCount: 9, inspectionMs: 8000, executionMs: 3000 },
      { kind: "lookahead", id: "r3", createdAt: 3_000, item: "lookahead", bpm: 60, pauses: 2, source: "smartcube" },
    ];
    expect((await post(token, reps)).status).toBe(204);
    expect((await post(token, reps)).status).toBe(204);
    const page = await repPage(token);
    expect(page.reps).toEqual([...reps].reverse());
    expect(page.next).toBeNull();
    const totals = await env.DB.prepare("SELECT rep_count FROM users WHERE id = 'reps'").first<{ rep_count: number }>();
    expect(totals?.rep_count).toBe(3);
  });

  it("stores a repeated id within one batch once, and keeps extra fields", async () => {
    const token = await addUser("dupes");
    expect((await post(token, [caseRep("d1", 1, { note: "first" }), caseRep("d1", 1, { note: "second" })])).status).toBe(204);
    const page = await repPage(token);
    expect(page.reps).toEqual([caseRep("d1", 1, { note: "first" })]);
  });

  it("keeps each account's reps and settings to itself", async () => {
    const alice = await addUser("alice");
    const bob = await addUser("bob");
    await post(alice, [caseRep("a1", 1)]);
    await putSettings(alice, { settings: { items: ["PLL"] }, updatedAt: 5 });
    expect((await repPage(bob)).reps).toEqual([]);
    expect(((await (await call("/api/learn/settings", { token: bob })).json()) as SettingsDoc).updatedAt).toBe(0);
    // Bob posting Alice's rep id makes his own copy and leaves hers alone.
    await post(bob, [caseRep("a1", 2, { item: "PLL-Ub" })]);
    expect((await repPage(alice)).reps[0]?.item).toBe("PLL-Ua");
  });

  it(`pages through every rep newest first, ${MAX_REP_PAGE_SIZE} at a time, without repeats`, async () => {
    const token = await addUser("many");
    const total = 2_300;
    for (let start = 0; start < total; start += MAX_REPS_PER_POST) {
      const reps = Array.from({ length: Math.min(MAX_REPS_PER_POST, total - start) }, (_, i) => caseRep(`m${String(start + i).padStart(5, "0")}`, Math.floor((start + i) / 3)));
      expect((await post(token, reps)).status).toBe(204);
    }
    const first = await repPage(token);
    expect(first.reps).toHaveLength(MAX_REP_PAGE_SIZE);
    const ids = await allRepIds(token);
    expect(ids).toHaveLength(total);
    expect(new Set(ids).size).toBe(total);
    expect(ids[0]).toBe("m02299");
    expect(ids.at(-1)).toBe("m00000");
  });

  it.each([
    { name: "an empty batch", body: { reps: [] }, status: 400 },
    { name: "more than 200 reps", body: { reps: Array.from({ length: MAX_REPS_PER_POST + 1 }, (_, i) => caseRep(`x${i}`, i)) }, status: 400 },
    { name: "an unknown kind", body: { reps: [{ ...caseRep("k", 1), kind: "blindfold" }] }, status: 400 },
    { name: "a case rep without correct", body: { reps: [{ ...caseRep("k", 1), correct: undefined }] }, status: 400 },
    { name: "a bad id", body: { reps: [caseRep("has space", 1)] }, status: 400 },
    { name: "a rep over 8 KB", body: { reps: [caseRep("big", 1, { note: "x".repeat(9_000) })] }, status: 413 },
    { name: "a non-JSON body", body: "reps", status: 400 },
  ])("rejects $name with $status", async ({ body, status }) => {
    const token = await addUser(`rej-${Math.random().toString(36).slice(2, 8)}`);
    expect((await call("/api/learn/reps", { method: "POST", token, body })).status).toBe(status);
  });

  it.each(["?limit=0", `?limit=${MAX_REP_PAGE_SIZE + 1}`, "?cursor=nope!"])("rejects the page query %s", async (query) => {
    const token = await addUser(`q-${Math.random().toString(36).slice(2, 8)}`);
    expect((await call(`/api/learn/reps${query}`, { token })).status).toBe(400);
  });
});

describe("rep quota", () => {
  it(`stores none of a batch that would pass ${MAX_REPS_PER_ACCOUNT} reps, but still accepts resent reps`, async () => {
    const token = await addUser("full");
    expect((await post(token, [caseRep("f0", 0)])).status).toBe(204);
    await env.DB.prepare("UPDATE users SET rep_count = ? WHERE id = 'full'").bind(MAX_REPS_PER_ACCOUNT - 1).run();
    const refused = await post(token, [caseRep("f1", 1), caseRep("f2", 2)]);
    expect(refused.status).toBe(507);
    expect(((await refused.json()) as { error: string }).error).toMatch(/account full/);
    expect(await allRepIds(token)).toEqual(["f0"]);
    expect((await post(token, [caseRep("f0", 0)])).status).toBe(204);
    expect((await post(token, [caseRep("f1", 1)])).status).toBe(204);
    expect((await post(token, [caseRep("f2", 2)])).status).toBe(507);
  });

  it(`refuses reps that would take the account past ${MAX_REP_BYTES_PER_ACCOUNT / (1024 * 1024)} MB`, async () => {
    const token = await addUser("heavy");
    await env.DB.prepare("UPDATE users SET rep_bytes = ? WHERE id = 'heavy'").bind(MAX_REP_BYTES_PER_ACCOUNT - 100).run();
    expect((await post(token, [caseRep("h1", 1)])).status).toBe(507);
  });

  it("deletes one rep, only his own, and deleting it again still succeeds", async () => {
    const carol = await addUser("carol");
    const dave = await addUser("dave");
    await post(carol, [caseRep("x1", 1), caseRep("x2", 2)]);
    await post(dave, [caseRep("x1", 1)]);
    expect((await call("/api/learn/reps/x1", { method: "DELETE", token: carol })).status).toBe(204);
    expect((await call("/api/learn/reps/x1", { method: "DELETE", token: carol })).status).toBe(204);
    expect(await allRepIds(carol)).toEqual(["x2"]);
    expect(await allRepIds(dave)).toEqual(["x1"]);
    const totals = await env.DB.prepare("SELECT rep_count FROM users WHERE id = 'carol'").first<{ rep_count: number }>();
    expect(totals?.rep_count).toBe(1);
  });

  it("keeps the per-account totals in step with the reps table", async () => {
    const token = await addUser("counted");
    await post(token, [caseRep("c1", 1), caseRep("c2", 2)]);
    await post(token, [caseRep("c2", 2), caseRep("c3", 3, { note: "ünïcödé" })]);
    const kept = await env.DB.prepare("SELECT rep_count AS count, rep_bytes AS bytes FROM users WHERE id = 'counted'").first();
    const actual = await env.DB.prepare(
      "SELECT COUNT(*) AS count, SUM(length(CAST(payload AS BLOB))) AS bytes FROM reps WHERE user_id = 'counted'",
    ).first();
    expect(kept).toEqual(actual);
    expect(kept).toMatchObject({ count: 3 });
  });
});
