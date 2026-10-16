import { z } from "zod";
import {
  MAX_BYTES_PER_ACCOUNT,
  MAX_PAGE_SIZE,
  MAX_SOLVE_BYTES,
  MAX_SOLVES_PER_ACCOUNT,
  penaltyPatchSchema,
  solveRecordSchema,
} from "../src/shared/schema";
import type { Context } from "./context";
import { type Cursor, decodeCursor, encodeCursor } from "./cursor";
import { errorResponse, noContent, readJsonBody } from "./http";
import type { User } from "./session";

const MAX_PATCH_BYTES = 1024;

const ACCOUNT_FULL = `account full: the limit is ${MAX_SOLVES_PER_ACCOUNT} solves or ${MAX_BYTES_PER_ACCOUNT / (1024 * 1024)} MB`;

const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(MAX_PAGE_SIZE),
  cursor: z.string().optional(),
});

type PageRow = { id: string; created_at: number; payload: string };

/** Newest first, one page at a time: `{ solves: SolveRecord[], next: string | null }`. */
export async function listSolves({ env, url }: Context, user: User): Promise<Response> {
  const query = pageQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) return errorResponse(400, `invalid page query: ${z.prettifyError(query.error)}`);
  const { limit } = query.data;
  let after: Cursor | null = null;
  if (query.data.cursor !== undefined) {
    after = decodeCursor(query.data.cursor);
    if (!after) return errorResponse(400, "invalid cursor");
  }
  // One extra row says whether another page follows.
  const statement = after
    ? env.DB.prepare(
        `SELECT id, created_at, payload FROM solves
         WHERE user_id = ?1 AND (created_at, id) < (?2, ?3)
         ORDER BY created_at DESC, id DESC LIMIT ?4`,
      ).bind(user.id, after.createdAt, after.id, limit + 1)
    : env.DB.prepare("SELECT id, created_at, payload FROM solves WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2").bind(
        user.id,
        limit + 1,
      );
  const { results } = await statement.all<PageRow>();
  const page = results.slice(0, limit);
  const last = page.at(-1);
  const next = results.length > limit && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null;
  // Every payload was produced by JSON.stringify of a validated solve, so it is spliced in rather than parsed and
  // re-serialised.
  const body = `{"solves":[${page.map((row) => row.payload).join(",")}],"next":${JSON.stringify(next)}}`;
  return new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * Idempotent: posting the same solve again replaces it. The quota check and the write are one statement, so
 * concurrent posts cannot slip past it; users.solve_count and solve_bytes are kept current by triggers
 * (migrations/0002).
 */
export async function upsertSolve({ request, env }: Context, user: User): Promise<Response> {
  const body = await readJsonBody(request, MAX_SOLVE_BYTES);
  if (!body.ok) return body.response;
  const parsed = solveRecordSchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, `invalid solve: ${z.prettifyError(parsed.error)}`);
  const solve = parsed.data;
  const result = await env.DB.prepare(
    `INSERT INTO solves (user_id, id, created_at, payload)
     SELECT ?1, ?2, ?3, ?4
     FROM users AS u LEFT JOIN solves AS old ON old.user_id = ?1 AND old.id = ?2
     WHERE u.id = ?1
       AND (old.id IS NOT NULL OR u.solve_count < ?5)
       AND u.solve_bytes - COALESCE(length(CAST(old.payload AS BLOB)), 0) + length(CAST(?4 AS BLOB)) <= ?6
     ON CONFLICT (user_id, id) DO UPDATE SET created_at = excluded.created_at, payload = excluded.payload`,
  )
    .bind(user.id, solve.id, solve.createdAt, JSON.stringify(solve), MAX_SOLVES_PER_ACCOUNT, MAX_BYTES_PER_ACCOUNT)
    .run();
  if (result.meta.changes === 0) return errorResponse(507, ACCOUNT_FULL);
  return noContent();
}

export async function patchSolve({ request, env, params }: Context, user: User): Promise<Response> {
  const body = await readJsonBody(request, MAX_PATCH_BYTES);
  if (!body.ok) return body.response;
  const parsed = penaltyPatchSchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, `invalid patch: ${z.prettifyError(parsed.error)}`);
  const result = await env.DB.prepare("UPDATE solves SET payload = json_set(payload, '$.penalty', ?) WHERE user_id = ? AND id = ?")
    .bind(parsed.data.penalty, user.id, params.id)
    .run();
  if (result.meta.changes === 0) return errorResponse(404, "no such solve");
  return noContent();
}

/** Idempotent: deleting a solve that is already gone still succeeds. */
export async function deleteSolve({ env, params }: Context, user: User): Promise<Response> {
  await env.DB.prepare("DELETE FROM solves WHERE user_id = ? AND id = ?").bind(user.id, params.id).run();
  return noContent();
}
