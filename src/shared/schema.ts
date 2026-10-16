// Shapes that cross the network or come back out of storage. Imported by both the app and the Worker, so it
// may only depend on zod and on types.

import { z } from "zod";

/** Largest solve body the API accepts. An analysed solve is 3.4 to 4.2 KB. */
export const MAX_SOLVE_BYTES = 32 * 1024;

/** Per-account storage limits, checked on every new or replaced solve. */
export const MAX_SOLVES_PER_ACCOUNT = 20_000;
export const MAX_BYTES_PER_ACCOUNT = 40 * 1024 * 1024;

/** Most solves one GET /api/solves page returns (and the default). */
export const MAX_PAGE_SIZE = 500;

/** Most raw gyro reports one solve keeps (about 30 bytes each; ~45 s at the gyro's 11 Hz before thinning). */
export const MAX_GYRO_SAMPLES = 500;

export const penaltySchema = z.enum(["none", "+2", "dnf"]);

const timedMove = z.object({ move: z.string(), t: z.number() });

const rotationEvent = z.object({
  rotation: z.enum(["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"]),
  after: z.number(),
  t: z.number(),
});

// Unknown top-level keys are stripped, so a field added to SolveRecord must be added here too
// (schema.test.ts fails the typecheck until it is).
export const solveRecordSchema = z.object({
  id: z.string().min(1).max(64),
  scramble: z.string(),
  moves: z.array(timedMove),
  rotations: z.array(rotationEvent).optional(),
  gyro: z.array(z.tuple([z.number(), z.number(), z.number(), z.number(), z.number()])).max(MAX_GYRO_SAMPLES).optional(),
  totalMs: z.number(),
  penalty: penaltySchema,
  createdAt: z.number(),
  source: z.enum(["demo", "keyboard", "smartcube", "virtual"]),
  // The analysis is recomputable from the moves, so only its outline is checked; the rest passes through.
  analysis: z.object({ stages: z.array(z.looseObject({})) }).loose().optional(),
});

export const penaltyPatchSchema = z.object({ penalty: penaltySchema });

/** GET /api/solves: newest first; `next` is an opaque cursor for the page after this one, or null at the end. */
export const solvePageSchema = z.object({ solves: z.array(z.unknown()), next: z.string().nullable() });

export const accountSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  picture: z.string().nullable(),
});
