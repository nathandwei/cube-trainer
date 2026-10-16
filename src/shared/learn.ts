// The learn section's settings and drill reps, as stored and sent. Imported by both the app and the Worker, so it
// may only depend on zod.

import { z } from "zod";

/** Largest single rep, as JSON. A case rep is a few hundred bytes. */
export const MAX_REP_BYTES = 8 * 1024;
/** Most reps one POST /api/learn/reps may carry. */
export const MAX_REPS_PER_POST = 200;
/** Per-account rep limits, checked on every POST. */
export const MAX_REPS_PER_ACCOUNT = 100_000;
export const MAX_REP_BYTES_PER_ACCOUNT = 40 * 1024 * 1024;
/** Most reps one GET /api/learn/reps page returns (and the default). */
export const MAX_REP_PAGE_SIZE = 1000;
/** Largest settings document, as JSON. */
export const MAX_SETTINGS_BYTES = 128 * 1024;

/** Client-made, unique per account; newRepId() makes time-sortable ones. */
const repId = z.string().regex(/^[0-9A-Za-z_-]{1,64}$/);
/** What is being learned: a case id such as "PLL-Ua" or "COLL-T3", a case set such as "PLL", or a drill such as "cross". */
const itemId = z.string().min(1).max(64);
const ms = z.number().min(0);
const createdAt = z.number().int().min(0);

export const inputSourceSchema = z.enum(["smartcube", "virtual", "keyboard"]);

// Each kind lists what every rep of that kind has; extra fields pass through untouched, so the UI can record more
// without a schema change.

export const caseRepSchema = z
  .object({
    kind: z.literal("case"),
    id: repId,
    createdAt,
    /** The case id, e.g. "PLL-Ua". */
    item: itemId,
    /** Pre-AUF applied before the case. */
    auf: z.enum(["", "U", "U2", "U'"]),
    recognitionMs: ms,
    executionMs: ms,
    /** The turns actually done. */
    moves: z.array(z.string().max(16)).max(500),
    correct: z.boolean(),
    source: inputSourceSchema,
    /** The alg drilled, as chosen in settings at the time. */
    alg: z.string().max(400).optional(),
  })
  .loose();

export const crossRepSchema = z
  .object({
    kind: z.literal("cross"),
    id: repId,
    createdAt,
    /** "cross" or "xcross". */
    item: itemId,
    scramble: z.string().max(200),
    optimalMoves: z.number().int().min(0).max(30),
    moveCount: z.number().int().min(0).max(500),
    inspectionMs: ms,
    executionMs: ms,
    source: inputSourceSchema.optional(),
  })
  .loose();

export const lookaheadRepSchema = z
  .object({
    kind: z.literal("lookahead"),
    id: repId,
    createdAt,
    item: itemId,
    bpm: z.number().positive().max(1000),
    pauses: z.number().int().min(0),
    source: inputSourceSchema.optional(),
  })
  .loose();

export const repSchema = z.discriminatedUnion("kind", [caseRepSchema, crossRepSchema, lookaheadRepSchema]);

export type CaseRep = z.infer<typeof caseRepSchema>;
export type CrossRep = z.infer<typeof crossRepSchema>;
export type LookaheadRep = z.infer<typeof lookaheadRepSchema>;
export type Rep = z.infer<typeof repSchema>;
export type InputSource = z.infer<typeof inputSourceSchema>;

export const learnSettingsSchema = z
  .object({
    /** Bumped if a field ever changes meaning; readers keep fields they do not know. */
    version: z.number().int().min(1).default(1),
    /** What he is learning: case sets ("PLL", "COLL") and drills ("cross", "lookahead"). */
    items: z.array(itemId).max(1000).default([]),
    /** The alg locked in per case id. */
    algs: z.record(itemId, z.string().max(400)).default({}),
    /** When each case's alg was last chosen (ms); reps before it belong to the previous alg. */
    algChosenAt: z.record(itemId, createdAt).default({}),
    newPerSession: z.number().int().min(0).max(1000).optional(),
    /** How he solves the last layer, which names the review's last-layer steps (src/cube/analyze.ts); unset is OLL → PLL. */
    lastLayer: z.enum(["oll-pll", "eo-coll"]).optional(),
  })
  .loose();

export type LearnSettings = z.infer<typeof learnSettingsSchema>;

export const DEFAULT_LEARN_SETTINGS: LearnSettings = learnSettingsSchema.parse({});

/** GET and PUT /api/learn/settings. updatedAt 0 means nothing has been saved yet. */
export const settingsDocSchema = z.object({ settings: learnSettingsSchema, updatedAt: z.number().int().min(0) });
export type SettingsDoc = z.infer<typeof settingsDocSchema>;

/** POST /api/learn/reps. */
export const repBatchSchema = z.object({ reps: z.array(repSchema).min(1).max(MAX_REPS_PER_POST) });

/** GET /api/learn/reps: newest first; `next` is an opaque cursor for the page after this one, or null at the end. */
export const repPageSchema = z.object({ reps: z.array(z.unknown()), next: z.string().nullable() });
