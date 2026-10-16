import { callback, login, logout, me } from "./auth";
import type { AuthedHandler, Context, Handler } from "./context";
import { errorResponse } from "./http";
import { getSettings, listReps, postReps, putSettings } from "./learn";
import { createRouter } from "./router";
import { sessionUser } from "./session";
import { deleteSolve, listSolves, patchSolve, upsertSolve } from "./solves";

function authed(handler: AuthedHandler): Handler {
  return async (ctx) => {
    const user = await sessionUser(ctx.env.DB, ctx.request, ctx.url, ctx.now);
    if (!user) return errorResponse(401, "not signed in");
    // The app names the account its solves belong to, so a browser that has since signed in as someone else can
    // never write one account's solves into another.
    const expected = ctx.request.headers.get("x-account-id");
    if (expected !== null && expected !== user.id) return errorResponse(401, "signed in as a different account");
    return handler(ctx, user);
  };
}

const route = createRouter<Handler>([
  { method: "GET", pattern: "/api/auth/login", handler: login },
  { method: "GET", pattern: "/api/auth/callback/google", handler: callback },
  { method: "POST", pattern: "/api/auth/logout", handler: logout },
  { method: "GET", pattern: "/api/me", handler: me },
  { method: "GET", pattern: "/api/solves", handler: authed(listSolves) },
  { method: "POST", pattern: "/api/solves", handler: authed(upsertSolve) },
  { method: "PATCH", pattern: "/api/solves/:id", handler: authed(patchSolve) },
  { method: "DELETE", pattern: "/api/solves/:id", handler: authed(deleteSolve) },
  { method: "GET", pattern: "/api/learn/settings", handler: authed(getSettings) },
  { method: "PUT", pattern: "/api/learn/settings", handler: authed(putSettings) },
  { method: "GET", pattern: "/api/learn/reps", handler: authed(listReps) },
  { method: "POST", pattern: "/api/learn/reps", handler: authed(postReps) },
]);

/** The session cookie is SameSite=Lax; this also refuses writes from other nathanwei.org subdomains. */
function isCrossOriginWrite(request: Request, url: URL): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const origin = request.headers.get("origin");
  return origin !== null && origin !== url.origin;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isCrossOriginWrite(request, url)) return errorResponse(403, "cross-origin request refused");
    const match = route(request.method, url.pathname);
    if (match.kind === "not-found") return errorResponse(404, "not found");
    if (match.kind === "method-not-allowed") {
      return errorResponse(405, "method not allowed", { allow: match.allow.join(", ") });
    }
    const ctx: Context = { request, env, url, params: match.params, now: Date.now() };
    try {
      return await match.handler(ctx);
    } catch (error) {
      console.error(`${request.method} ${url.pathname} failed`, error);
      return errorResponse(500, "internal error");
    }
  },
} satisfies ExportedHandler<Env>;
