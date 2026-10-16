import { z } from "zod";
import {
  DEFAULT_LEARN_SETTINGS,
  MAX_REP_BYTES,
  MAX_REP_BYTES_PER_ACCOUNT,
  MAX_REP_PAGE_SIZE,
  MAX_REPS_PER_ACCOUNT,
  MAX_REPS_PER_POST,
  MAX_SETTINGS_BYTES,
  repBatchSchema,
  settingsDocSchema,
} from "../src/shared/learn";
import type { Context } from "./context";
import { type Cursor, decodeCursor, encodeCursor } from "./cursor";
import { errorResponse, json, noContent, readJsonBody } from "./http";
import type { User } from "./session";

/** A client clock this far ahead could otherwise win every later write from other devices. */
const MAX_CLOCK_LEAD_MS = 60_000;

const ACCOUNT_FULL = `account full: the limit is ${MAX_REPS_PER_ACCOUNT} reps or ${MAX_REP_BYTES_PER_ACCOUNT / (1024 * 1024)} MB`;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

type SettingsRow = { payload: string; updated_at: number };

function settingsResponse(row: SettingsRow | null): Response {
  if (!row) return json({ settings: DEFAULT_LEARN_SETTINGS, updatedAt: 0 });
  // The payload was produced by JSON.stringify of validated settings.
  return new Response(`{"settings":${row.payload},"updatedAt":${row.updated_at}}`, { headers: JSON_HEADERS });
}

/** `{ settings, updatedAt }`; the defaults with updatedAt 0 when nothing has been saved. */
export async function getSettings({ env }: Context, user: User): Promise<Response> {
  const row = await env.DB.prepare("SELECT payload, updated_at FROM user_settings WHERE user_id = ?").bind(user.id).first<SettingsRow>();
  return settingsResponse(row);
}

/**
 * Last writer wins: the write is kept only if its updatedAt is newer than the stored one. Either way the answer is
 * what is stored now, so a client whose write lost learns the newer settings.
 */
export async function putSettings({ request, env, now }: Context, user: User): Promise<Response> {
  const body = await readJsonBody(request, MAX_SETTINGS_BYTES);
  if (!body.ok) return body.response;
  const parsed = settingsDocSchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, `invalid settings: ${z.prettifyError(parsed.error)}`);
  const updatedAt = Math.min(parsed.data.updatedAt, now + MAX_CLOCK_LEAD_MS);
  const [, stored] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO user_settings (user_id, payload, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT (user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
       WHERE excluded.updated_at > user_settings.updated_at`,
    ).bind(user.id, JSON.stringify(parsed.data.settings), updatedAt),
    env.DB.prepare("SELECT payload, updated_at FROM user_settings WHERE user_id = ?").bind(user.id),
  ]);
  const row = (stored?.results[0] as SettingsRow | undefined) ?? null;
  if (!row) throw new Error("Settings upsert left no row");
  return settingsResponse(row);
}

const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_REP_PAGE_SIZE).default(MAX_REP_PAGE_SIZE),
  cursor: z.string().optional(),
});

type PageRow = { id: string; created_at: number; payload: string };

/** Newest first, one page at a time: `{ reps: Rep[], next: string | null }`. */
export async function listReps({ env, url }: Context, user: User): Promise<Response> {
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
        `SELECT id, created_at, payload FROM reps
         WHERE user_id = ?1 AND (created_at, id) < (?2, ?3)
         ORDER BY created_at DESC, id DESC LIMIT ?4`,
      ).bind(user.id, after.createdAt, after.id, limit + 1)
    : env.DB.prepare("SELECT id, created_at, payload FROM reps WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2").bind(
        user.id,
        limit + 1,
      );
  const { results } = await statement.all<PageRow>();
  const page = results.slice(0, limit);
  const last = page.at(-1);
  const next = results.length > limit && last ? encodeCursor({ createdAt: last.created_at, id: last.id }) : null;
  const body = `{"reps":[${page.map((row) => row.payload).join(",")}],"next":${JSON.stringify(next)}}`;
  return new Response(body, { headers: JSON_HEADERS });
}

/** A whole batch of maximum-size reps, plus the envelope. */
const MAX_BATCH_BYTES = MAX_REPS_PER_POST * MAX_REP_BYTES + 1024;

/**
 * Appends a batch of reps. A rep whose id is already stored is skipped, so resending a batch is harmless. The quota
 * is all or nothing: if the new reps do not all fit, none are stored and the answer is 507.
 *
 * The batch goes to D1 as one JSON parameter (D1 allows 100 bound parameters per statement), and the quota check
 * and the insert are one statement. Because that statement reads the reps table it writes, SQLite evaluates the
 * whole SELECT, quota included, before inserting anything.
 */
export async function postReps({ request, env }: Context, user: User): Promise<Response> {
  const body = await readJsonBody(request, MAX_BATCH_BYTES);
  if (!body.ok) return body.response;
  const parsed = repBatchSchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, `invalid reps: ${z.prettifyError(parsed.error)}`);
  const encoder = new TextEncoder();
  const unique = new Map<string, string>();
  for (const rep of parsed.data.reps) {
    const text = JSON.stringify(rep);
    if (encoder.encode(text).length > MAX_REP_BYTES) return errorResponse(413, `rep ${rep.id} is over ${MAX_REP_BYTES} bytes`);
    if (!unique.has(rep.id)) unique.set(rep.id, text);
  }
  const batch = `[${[...unique.values()].join(",")}]`;
  const [, check] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO reps (user_id, id, created_at, item, kind, payload)
       SELECT ?1, json_extract(b.value, '$.id'), json_extract(b.value, '$.createdAt'), json_extract(b.value, '$.item'),
              json_extract(b.value, '$.kind'), b.value
       FROM json_each(?2) AS b
       WHERE NOT EXISTS (SELECT 1 FROM reps AS r WHERE r.user_id = ?1 AND r.id = json_extract(b.value, '$.id'))
         AND (
           SELECT u.rep_count + COUNT(f.value) <= ?3
              AND u.rep_bytes + COALESCE(SUM(length(CAST(f.value AS BLOB))), 0) <= ?4
           FROM users AS u
           LEFT JOIN json_each(?2) AS f
             ON NOT EXISTS (SELECT 1 FROM reps AS r2 WHERE r2.user_id = ?1 AND r2.id = json_extract(f.value, '$.id'))
           WHERE u.id = ?1
         )
       ON CONFLICT (user_id, id) DO NOTHING`,
    ).bind(user.id, batch, MAX_REPS_PER_ACCOUNT, MAX_REP_BYTES_PER_ACCOUNT),
    env.DB.prepare(
      `SELECT COUNT(*) AS missing FROM json_each(?2) AS b
       WHERE NOT EXISTS (SELECT 1 FROM reps AS r WHERE r.user_id = ?1 AND r.id = json_extract(b.value, '$.id'))`,
    ).bind(user.id, batch),
  ]);
  const missing = (check?.results[0] as { missing: number } | undefined)?.missing;
  if (missing === undefined) throw new Error("Rep check returned no row");
  if (missing > 0) return errorResponse(507, ACCOUNT_FULL);
  return noContent();
}
