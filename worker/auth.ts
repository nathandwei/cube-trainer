import type { Context } from "./context";
import { parseCookies, serializeCookie } from "./cookies";
import { pkceChallenge, randomToken, timingSafeEqual } from "./crypto";
import { authorizeUrl, exchangeCode, fetchProfile, GoogleError, type GoogleProfile, googleConfig } from "./google";
import { errorResponse, json, noContent, redirect } from "./http";
import {
  clearedSessionCookie,
  cookieName,
  createSession,
  deleteExpiredSessions,
  deleteSession,
  isSecure,
  sessionCookie,
  sessionToken,
  sessionUser,
} from "./session";

/** Holds "<state>.<PKCE verifier>" between the redirect to Google and the callback. */
const OAUTH = "oauth";
const OAUTH_MAX_AGE_S = 10 * 60;
/** Where a failed sign-in lands: the sign-in page, which says it did not work. */
const FAILED = "/?auth=failed";

const NOT_CONFIGURED =
  "Google sign-in is not configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (.dev.vars locally, Worker secrets in production)";

function oauthCookie(value: string, url: URL, maxAge: number): string {
  // Lax still sends it on Google's top-level redirect back to the callback; Path=/ is required by __Host-.
  return serializeCookie(cookieName(OAUTH, url), value, { maxAge, path: "/", httpOnly: true, secure: isSecure(url), sameSite: "Lax" });
}

export async function login({ env, url }: Context): Promise<Response> {
  const config = googleConfig(env);
  if (!config) return errorResponse(503, NOT_CONFIGURED);
  const state = randomToken();
  const verifier = randomToken();
  const location = authorizeUrl(config, url.origin, state, await pkceChallenge(verifier));
  return redirect(location, [oauthCookie(`${state}.${verifier}`, url, OAUTH_MAX_AGE_S)]);
}

export async function callback({ request, env, url, now }: Context): Promise<Response> {
  const clearOauth = oauthCookie("", url, 0);
  const fail = (why: string, error?: unknown) => {
    console.error(`Sign-in failed: ${why}`, ...(error === undefined ? [] : [error]));
    return redirect(FAILED, [clearOauth]);
  };

  const config = googleConfig(env);
  if (!config) return fail(NOT_CONFIGURED);
  const googleError = url.searchParams.get("error");
  // The person backed out on Google's account screen: back to the sign-in page, nothing went wrong.
  if (googleError === "access_denied") return redirect("/", [clearOauth]);
  if (googleError) return fail(`Google answered ${googleError}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const [expectedState, verifier] = (parseCookies(request.headers.get("cookie")).get(cookieName(OAUTH, url)) ?? "").split(".");
  if (!code || !state || !expectedState || !verifier) return fail("no code, state or state cookie (expired, or another browser)");
  if (!timingSafeEqual(state, expectedState)) return fail("state does not match the cookie");

  let profile: GoogleProfile;
  try {
    profile = await fetchProfile(await exchangeCode(config, url.origin, code, verifier));
  } catch (error) {
    if (!(error instanceof GoogleError)) throw error;
    return fail("Google exchange", error);
  }

  const userId = await upsertUser(env.DB, profile, now);
  // This browser's previous session, if any, is replaced rather than left valid alongside the new one.
  const previous = sessionToken(request, url);
  if (previous) await deleteSession(env.DB, previous);
  await deleteExpiredSessions(env.DB, now);
  const token = await createSession(env.DB, userId, now);
  return redirect("/", [clearOauth, sessionCookie(token, url)]);
}

async function upsertUser(db: D1Database, profile: GoogleProfile, now: number): Promise<string> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture
       RETURNING id`,
    )
    .bind(crypto.randomUUID(), profile.sub, profile.email, profile.name, profile.picture, now)
    .first<{ id: string }>();
  if (!row) throw new Error("User upsert returned no row");
  return row.id;
}

export async function me({ request, env, url, now }: Context): Promise<Response> {
  const user = await sessionUser(env.DB, request, url, now);
  if (!user) return errorResponse(401, "not signed in");
  return json(user);
}

export async function logout({ request, env, url }: Context): Promise<Response> {
  const token = sessionToken(request, url);
  if (token) await deleteSession(env.DB, token);
  return noContent({ "set-cookie": clearedSessionCookie(url) });
}
