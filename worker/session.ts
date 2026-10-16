import { parseCookies, serializeCookie } from "./cookies";
import { randomToken, sha256Hex } from "./crypto";

/** 400 days: the longest lifetime browsers allow a cookie. */
export const SESSION_MAX_AGE_S = 400 * 24 * 60 * 60;

export type User = { id: string; email: string; name: string; picture: string | null };

/** Session tokens are stored only as this hash, so the table alone cannot sign anyone in. */
export function hashSessionToken(token: string): Promise<string> {
  return sha256Hex(token);
}

// Plain-http localhost is the only non-https origin this Worker serves, and Safari drops Secure cookies there.
export function isSecure(url: URL): boolean {
  return url.protocol === "https:";
}

/**
 * On https the name carries the __Host- prefix: browsers only accept such a cookie from this exact host (Secure,
 * Path=/, no Domain), so a cookie of the same name planted by nathanwei.org or a sibling subdomain is never read.
 */
export function cookieName(base: string, url: URL): string {
  return isSecure(url) ? `__Host-${base}` : base;
}

const SESSION = "session";

export function sessionCookie(token: string, url: URL): string {
  return serializeCookie(cookieName(SESSION, url), token, {
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
    httpOnly: true,
    secure: isSecure(url),
    sameSite: "Lax",
  });
}

export function clearedSessionCookie(url: URL): string {
  return serializeCookie(cookieName(SESSION, url), "", { maxAge: 0, path: "/", httpOnly: true, secure: isSecure(url), sameSite: "Lax" });
}

export function sessionToken(request: Request, url: URL): string | null {
  return parseCookies(request.headers.get("cookie")).get(cookieName(SESSION, url)) || null;
}

export async function createSession(db: D1Database, userId: string, now: number): Promise<string> {
  const token = randomToken();
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await hashSessionToken(token), userId, now, now + SESSION_MAX_AGE_S * 1000)
    .run();
  return token;
}

type SessionRow = { id: string; email: string; name: string; picture: string | null; expires_at: number };

export async function sessionUser(db: D1Database, request: Request, url: URL, now: number): Promise<User | null> {
  const token = sessionToken(request, url);
  if (!token) return null;
  const tokenHash = await hashSessionToken(token);
  const row = await db
    .prepare(
      `SELECT users.id, users.email, users.name, users.picture, sessions.expires_at
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, picture: row.picture };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashSessionToken(token)).run();
}

export async function deleteExpiredSessions(db: D1Database, now: number): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
}
