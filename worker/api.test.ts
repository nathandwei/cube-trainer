// Runs the real Worker on workerd with an in-memory local D1 (wrangler's test harness), migrated from
// migrations/, and talks to it over HTTP. The Google callback is the one route that needs Google itself, so its
// handler is called directly in Node against the same D1 with Google's endpoints stubbed.

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestHarness } from "wrangler";
import type { SolveRecord } from "../src/cube/types";
import { MAX_BYTES_PER_ACCOUNT, MAX_PAGE_SIZE, MAX_SOLVES_PER_ACCOUNT } from "../src/shared/schema";
import { callback, login, logout, me } from "./auth";
import { pkceChallenge } from "./crypto";
import { hashSessionToken } from "./session";

const ORIGIN = "http://localhost";
const CLIENT_ID = "test-client-id.apps.googleusercontent.com";

// `secrets` overrides anything a .dev.vars or .env holds, so real credentials never reach these tests.
function harness(secrets: { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string }) {
  return createTestHarness({ workers: [{ configPath: "./worker/wrangler.test.jsonc", secrets }] });
}

const server = harness({ GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: "test-secret" });
let env: Env;

async function addUser(id: string, token: string): Promise<void> {
  const now = Date.now();
  await env.DB.prepare("INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, `sub-${id}`, `${id}@example.com`, `User ${id}`, null, now)
    .run();
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await hashSessionToken(token), id, now, now + 60_000)
    .run();
}

type CallInit = { method?: string; token?: string; body?: unknown; headers?: Record<string, string>; origin?: string };

function call(path: string, init: CallInit = {}) {
  const headers: Record<string, string> = { ...init.headers };
  if (init.token) headers.cookie = `session=${init.token}`;
  if (init.body !== undefined) headers["content-type"] ??= "application/json";
  return server.fetch(`${init.origin ?? ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
    redirect: "manual",
  });
}

function solve(id: string, createdAt: number, penalty: SolveRecord["penalty"] = "none"): SolveRecord {
  return {
    id,
    scramble: "R U R' U'",
    moves: [
      { move: "R", t: 100 },
      { move: "U", t: 250 },
    ],
    totalMs: 8_000,
    penalty,
    createdAt,
    source: "virtual",
    analysis: { stages: [], totalMs: 8_000, moveCount: 2, solved: false },
  };
}

type Page = { solves: SolveRecord[]; next: string | null };

async function listPage(token: string, query = ""): Promise<Page> {
  const response = await call(`/api/solves${query}`, { token });
  expect(response.status).toBe(200);
  return (await response.json()) as Page;
}

async function listIds(token: string): Promise<string[]> {
  return (await listPage(token)).solves.map((s) => s.id);
}

/** What the triggers keep in users, next to what the solves table actually holds. */
async function totals(userId: string) {
  const kept = await env.DB.prepare("SELECT solve_count AS count, solve_bytes AS bytes FROM users WHERE id = ?")
    .bind(userId)
    .first<{ count: number; bytes: number }>();
  const actual = await env.DB.prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(length(CAST(payload AS BLOB))), 0) AS bytes FROM solves WHERE user_id = ?",
  )
    .bind(userId)
    .first<{ count: number; bytes: number }>();
  return { kept, actual };
}

beforeAll(async () => {
  await server.listen();
  const worker = server.getWorker<Env>();
  await worker.applyD1Migrations("DB");
  env = await worker.getEnv();
  await addUser("alice", "alice-token");
  await addUser("bob", "bob-token");
}, 60_000);

afterAll(async () => {
  await server.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/me", () => {
  it("is 401 without a cookie", async () => {
    const response = await call("/api/me");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not signed in" });
  });

  it("is 401 for an unknown token", async () => {
    expect((await call("/api/me", { token: "nope" })).status).toBe(401);
  });

  it("returns the signed-in user", async () => {
    const response = await call("/api/me", { token: "alice-token" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "alice", email: "alice@example.com", name: "User alice", picture: null });
  });

  it("is 401 once the session has expired, and drops the row", async () => {
    const past = Date.now() - 1_000;
    await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(await hashSessionToken("old-token"), "alice", past - 1_000, past)
      .run();
    expect((await call("/api/me", { token: "old-token" })).status).toBe(401);
    const row = await env.DB.prepare("SELECT 1 FROM sessions WHERE token_hash = ?").bind(await hashSessionToken("old-token")).first();
    expect(row).toBeNull();
  });
});

describe("/api/solves", () => {
  it.each([
    { method: "GET", path: "/api/solves" },
    { method: "POST", path: "/api/solves" },
    { method: "PATCH", path: "/api/solves/x" },
    { method: "DELETE", path: "/api/solves/x" },
  ])("$method $path is 401 without a session", async ({ method, path }) => {
    const body = method === "POST" ? solve("x", 1) : method === "PATCH" ? { penalty: "dnf" } : undefined;
    expect((await call(path, { method, body })).status).toBe(401);
  });

  it("round-trips POST, GET, PATCH and DELETE", async () => {
    const first = solve("s-1", 1_000);
    expect((await call("/api/solves", { method: "POST", token: "alice-token", body: first })).status).toBe(204);
    expect((await call("/api/solves", { method: "POST", token: "alice-token", body: solve("s-2", 2_000) })).status).toBe(204);

    const listed = await call("/api/solves", { token: "alice-token" });
    expect(((await listed.json()) as { solves: SolveRecord[] }).solves).toEqual([solve("s-2", 2_000), first]);

    // Posting the same id again replaces it rather than adding a second copy.
    const edited = { ...first, totalMs: 7_000 };
    expect((await call("/api/solves", { method: "POST", token: "alice-token", body: edited })).status).toBe(204);
    const afterUpsert = (await (await call("/api/solves", { token: "alice-token" })).json()) as { solves: SolveRecord[] };
    expect(afterUpsert.solves).toEqual([solve("s-2", 2_000), edited]);

    expect((await call("/api/solves/s-1", { method: "PATCH", token: "alice-token", body: { penalty: "+2" } })).status).toBe(204);
    const afterPatch = (await (await call("/api/solves", { token: "alice-token" })).json()) as { solves: SolveRecord[] };
    expect(afterPatch.solves.find((s) => s.id === "s-1")).toEqual({ ...edited, penalty: "+2" });

    expect((await call("/api/solves/s-1", { method: "DELETE", token: "alice-token" })).status).toBe(204);
    expect(await listIds("alice-token")).toEqual(["s-2"]);
    expect((await call("/api/solves/s-1", { method: "DELETE", token: "alice-token" })).status).toBe(204);
  });

  it("keeps each user's solves to themselves", async () => {
    await call("/api/solves", { method: "POST", token: "alice-token", body: solve("mine", 5_000) });
    expect(await listIds("bob-token")).not.toContain("mine");
    expect((await call("/api/solves/mine", { method: "PATCH", token: "bob-token", body: { penalty: "dnf" } })).status).toBe(404);
    await call("/api/solves/mine", { method: "DELETE", token: "bob-token" });
    expect(await listIds("alice-token")).toContain("mine");
  });

  it.each<{ name: string; body: unknown; headers: Record<string, string>; status: number }>([
    { name: "a solve missing fields", body: { id: "bad" }, headers: {}, status: 400 },
    { name: "a bad penalty", body: { ...solve("bad", 1), penalty: "+4" }, headers: {}, status: 400 },
    { name: "invalid JSON", body: "{not json", headers: {}, status: 400 },
    { name: "a non-JSON content type", body: solve("bad", 1), headers: { "content-type": "text/plain" }, status: 415 },
    { name: "a body over the cap", body: { ...solve("big", 1), scramble: "R ".repeat(200_000) }, headers: {}, status: 413 },
    { name: "a body just over 32 KB", body: { ...solve("big", 1), scramble: "R".repeat(33 * 1024) }, headers: {}, status: 413 },
    { name: "a write from another origin", body: solve("bad", 1), headers: { origin: "https://evil.example" }, status: 403 },
    { name: "a write from an opaque origin", body: solve("bad", 1), headers: { origin: "null" }, status: 403 },
    { name: "a write naming another account", body: solve("bad", 1), headers: { "x-account-id": "bob" }, status: 401 },
  ])("POST rejects $name with $status", async ({ body, headers, status }) => {
    expect((await call("/api/solves", { method: "POST", token: "alice-token", body, headers })).status).toBe(status);
  });

  it.each([
    { body: { penalty: "DNF" }, id: "s-2", status: 400 },
    { body: { penalty: "dnf" }, id: "missing", status: 404 },
  ])("PATCH $id with $body is $status", async ({ body, id, status }) => {
    expect((await call(`/api/solves/${id}`, { method: "PATCH", token: "alice-token", body })).status).toBe(status);
  });

  it("accepts a write naming its own account", async () => {
    const response = await call("/api/solves", { method: "POST", token: "alice-token", body: solve("named", 1), headers: { "x-account-id": "alice" } });
    expect(response.status).toBe(204);
  });

  it("refuses a streamed body that passes the cap without a Content-Length", async () => {
    // Small enough to be fully sent before the Worker answers; http.test.ts covers the cancel itself.
    const chunk = new Uint8Array(8 * 1024).fill(32);
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 8; i++) controller.enqueue(chunk);
        controller.close();
      },
    });
    const response = await server.fetch(`${ORIGIN}/api/solves`, {
      method: "POST",
      headers: { cookie: "session=alice-token", "content-type": "application/json" },
      body,
      duplex: "half",
    } as Parameters<typeof server.fetch>[1]);
    expect(response.status).toBe(413);
  });

  it("answers unknown routes and methods with JSON errors", async () => {
    expect((await call("/api/nope")).status).toBe(404);
    const wrongMethod = await call("/api/solves", { method: "PUT", token: "alice-token", body: {} });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("GET, POST");
  });
});

describe("paging", () => {
  beforeAll(async () => {
    await addUser("pager", "pager-token");
    // Two solves share a millisecond, so the id has to break the tie.
    const times = [1_000, 2_000, 3_000, 3_000, 4_000, 5_000, 6_000];
    for (const [i, createdAt] of times.entries()) {
      const response = await call("/api/solves", { method: "POST", token: "pager-token", body: solve(`p${i}`, createdAt) });
      expect(response.status).toBe(204);
    }
  });

  it("walks every solve newest first, a page at a time, without repeats", async () => {
    const seen: string[] = [];
    let page = await listPage("pager-token", "?limit=3");
    seen.push(...page.solves.map((s) => s.id));
    while (page.next) {
      expect(page.solves).toHaveLength(3);
      page = await listPage("pager-token", `?limit=3&cursor=${page.next}`);
      seen.push(...page.solves.map((s) => s.id));
    }
    expect(seen).toEqual(["p6", "p5", "p4", "p3", "p2", "p1", "p0"]);
  });

  it(`defaults to ${MAX_PAGE_SIZE} and says when nothing follows`, async () => {
    const page = await listPage("pager-token");
    expect(page.solves).toHaveLength(7);
    expect(page.next).toBeNull();
  });

  it.each(["?limit=0", `?limit=${MAX_PAGE_SIZE + 1}`, "?limit=abc", "?cursor=not!base64", "?cursor=WzEsMl0"])("rejects %s", async (query) => {
    expect((await call(`/api/solves${query}`, { token: "pager-token" })).status).toBe(400);
  });
});

describe("quota", () => {
  beforeAll(async () => {
    await addUser("full", "full-token");
    await addUser("heavy", "heavy-token");
  });

  it("keeps the per-account totals in step with every kind of write", async () => {
    await addUser("counted", "counted-token");
    const token = "counted-token";
    await call("/api/solves", { method: "POST", token, body: solve("c1", 1) });
    await call("/api/solves", { method: "POST", token, body: solve("c2", 2) });
    await call("/api/solves", { method: "POST", token, body: { ...solve("c1", 1), scramble: "R U R' U' R' F R2 U' R' U' R U R' F'" } });
    await call("/api/solves/c2", { method: "PATCH", token, body: { penalty: "dnf" } });
    await call("/api/solves/c2", { method: "DELETE", token });
    const { kept, actual } = await totals("counted");
    expect(kept).toEqual(actual);
    expect(kept?.count).toBe(1);
  });

  it(`refuses a new solve past ${MAX_SOLVES_PER_ACCOUNT} solves but still accepts edits`, async () => {
    expect((await call("/api/solves", { method: "POST", token: "full-token", body: solve("f1", 1) })).status).toBe(204);
    await env.DB.prepare("UPDATE users SET solve_count = ? WHERE id = 'full'").bind(MAX_SOLVES_PER_ACCOUNT - 1).run();
    expect((await call("/api/solves", { method: "POST", token: "full-token", body: solve("f2", 2) })).status).toBe(204);
    const refused = await call("/api/solves", { method: "POST", token: "full-token", body: solve("f3", 3) });
    expect(refused.status).toBe(507);
    expect(((await refused.json()) as { error: string }).error).toMatch(/account full/);
    expect((await call("/api/solves", { method: "POST", token: "full-token", body: solve("f1", 1, "+2") })).status).toBe(204);
  });

  it(`refuses a solve that would take the account past ${MAX_BYTES_PER_ACCOUNT / (1024 * 1024)} MB`, async () => {
    expect((await call("/api/solves", { method: "POST", token: "heavy-token", body: solve("h1", 1) })).status).toBe(204);
    await env.DB.prepare("UPDATE users SET solve_bytes = ? WHERE id = 'heavy'").bind(MAX_BYTES_PER_ACCOUNT - 100).run();
    expect((await call("/api/solves", { method: "POST", token: "heavy-token", body: solve("h2", 2) })).status).toBe(507);
    expect(await listIds("heavy-token")).toEqual(["h1"]);
  });
});

// The local runtime serves plain http, so these call the handlers directly with an https URL, as production sees it.
describe("cookies on https", () => {
  const ctx = (path: string, cookie?: string) => {
    const url = new URL(`https://cube.example${path}`);
    return { request: new Request(url, { headers: cookie ? { cookie } : {} }), env, url, params: {}, now: Date.now() };
  };

  it("uses __Host- names, Secure and Path=/", async () => {
    const response = await login(ctx("/api/auth/login"));
    expect(response.headers.get("set-cookie")).toMatch(/^__Host-oauth=[\w-]+\.[\w-]+; Max-Age=600; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
    const loggedOut = await logout(ctx("/api/auth/logout"));
    expect(loggedOut.headers.get("set-cookie")).toBe("__Host-session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
  });

  it.each([
    { cookie: "session=alice-token", status: 401 },
    { cookie: "session=alice-token; __Host-session=nope", status: 401 },
    { cookie: "session=nope; __Host-session=alice-token", status: 200 },
  ])("reads only __Host-session, which no parent domain can set: $cookie is $status", async ({ cookie, status }) => {
    expect((await me(ctx("/api/me", cookie))).status).toBe(status);
  });

  it("reads only __Host-oauth on the callback", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await callback(ctx("/api/auth/callback/google?code=c&state=s", "oauth=s.v"));
    expect(response.headers.get("location")).toBe("/?auth=failed");
    expect(response.headers.get("set-cookie")).toMatch(/^__Host-oauth=; Max-Age=0; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
  });
});

describe("Google sign-in", () => {
  it("redirects to Google with PKCE and a state cookie", async () => {
    const response = await call("/api/auth/login");
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback/google`);
    expect(location.searchParams.get("scope")).toBe("openid email profile");
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");

    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^oauth=[\w-]+\.[\w-]+; Max-Age=600; Path=\/; HttpOnly; SameSite=Lax$/);
    const [state, verifier] = (/^oauth=([^;]+)/.exec(cookie)?.[1] ?? "").split(".");
    expect(location.searchParams.get("state")).toBe(state);
    expect(location.searchParams.get("code_challenge")).toBe(await pkceChallenge(verifier ?? ""));
  });

  it("is a 503 with a clear message when Google is not configured", async () => {
    const bare = harness({ GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    try {
      await bare.listen();
      const response = await bare.fetch(`${ORIGIN}/api/auth/login`, { redirect: "manual" });
      expect(response.status).toBe(503);
      expect(((await response.json()) as { error: string }).error).toMatch(/GOOGLE_CLIENT_ID/);
    } finally {
      await bare.close();
    }
  }, 60_000);

  it.each([
    { name: "no state cookie", query: "code=c&state=s", cookie: "", location: "/?auth=failed" },
    { name: "a state mismatch", query: "code=c&state=other", cookie: "oauth=s.v", location: "/?auth=failed" },
    { name: "a missing code", query: "state=s", cookie: "oauth=s.v", location: "/?auth=failed" },
    { name: "Google refusing", query: "error=server_error", cookie: "oauth=s.v", location: "/?auth=failed" },
    { name: "the person cancelling", query: "error=access_denied", cookie: "oauth=s.v", location: "/" },
  ])("callback with $name goes back to $location", async ({ query, cookie, location }) => {
    const response = await call(`/api/auth/callback/google?${query}`, { headers: cookie ? { cookie } : {} });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(location);
    expect(response.headers.get("set-cookie")).toMatch(/^oauth=; Max-Age=0/);
  });

  it("treats Google being unreachable as a failed sign-in, not a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    const url = new URL(`${ORIGIN}/api/auth/callback/google?code=c&state=s`);
    const request = new Request(url, { headers: { cookie: "oauth=s.v" } });
    const response = await callback({ request, env, url, params: {}, now: Date.now() });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?auth=failed");
    expect(response.headers.get("set-cookie")).toMatch(/^oauth=; Max-Age=0/);
  });

  it("exchanges the code, upserts the user and starts a session that /api/me accepts", async () => {
    const google = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        const form = new URLSearchParams(String(init?.body));
        expect(Object.fromEntries(form)).toEqual({
          grant_type: "authorization_code",
          code: "the-code",
          code_verifier: "the-verifier",
          client_id: CLIENT_ID,
          client_secret: "test-secret",
          redirect_uri: `${ORIGIN}/api/auth/callback/google`,
        });
        return Response.json({ access_token: "the-access-token", token_type: "Bearer", expires_in: 3599 });
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer the-access-token");
        return Response.json({ sub: "google-123", email: "carol@example.com", name: "Carol", picture: "https://lh3/p.png" });
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", google);

    const signIn = async (previousSession?: string) => {
      const url = new URL(`${ORIGIN}/api/auth/callback/google?code=the-code&state=the-state`);
      const cookie = ["oauth=the-state.the-verifier", ...(previousSession ? [`session=${previousSession}`] : [])].join("; ");
      return callback({ request: new Request(url, { headers: { cookie } }), env, url, params: {}, now: Date.now() });
    };
    const response = await signIn();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(google).toHaveBeenCalledTimes(2);
    const cookies = response.headers.getSetCookie();
    expect(cookies[0]).toMatch(/^oauth=; Max-Age=0/);
    expect(cookies[1]).toMatch(/^session=[\w-]{43}; Max-Age=34560000; Path=\/; HttpOnly; SameSite=Lax$/);
    const token = /^session=([\w-]+)/.exec(cookies[1] ?? "")?.[1] ?? "";

    const stored = await env.DB.prepare("SELECT token_hash FROM sessions WHERE token_hash = ?").bind(await hashSessionToken(token)).first();
    expect(stored).not.toBeNull();
    const plain = await env.DB.prepare("SELECT 1 FROM sessions WHERE token_hash = ?").bind(token).first();
    expect(plain).toBeNull();

    vi.unstubAllGlobals();
    const me = await call("/api/me", { token });
    expect(me.status).toBe(200);
    const account = (await me.json()) as { id: string; email: string; name: string; picture: string | null };
    expect(account).toMatchObject({ email: "carol@example.com", name: "Carol", picture: "https://lh3/p.png" });

    // Signing in again keeps the same user row and replaces this browser's previous session.
    vi.stubGlobal("fetch", google);
    await signIn(token);
    const users = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE google_sub = ?").bind("google-123").first<{ n: number }>();
    expect(users?.n).toBe(1);
    vi.unstubAllGlobals();
    expect((await call("/api/me", { token })).status).toBe(401);
  });

  it("logs out by deleting the session and clearing the cookie", async () => {
    await addUser("dave", "dave-token");
    expect((await call("/api/me", { token: "dave-token" })).status).toBe(200);
    const response = await call("/api/auth/logout", { method: "POST", token: "dave-token" });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toBe("session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
    expect((await call("/api/me", { token: "dave-token" })).status).toBe(401);
  });
});
