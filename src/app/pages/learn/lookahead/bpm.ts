export const MIN_BPM = 20;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 60;
export const BPM_STEP = 5;
/** Solves in a row at one bpm before it changes (docs/research/01: add 5 bpm after 3 clean solves). */
export const STREAK = 3;
/** A solve with at least this many pauses is messy; between clean (none) and messy it leaves the bpm alone. */
export const MESSY_PAUSES = 3;

export type BpmResult = { bpm: number; pauses: number };

export function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

export function isClean(pauses: number): boolean {
  return pauses === 0;
}

export function isMessy(pauses: number): boolean {
  return pauses >= MESSY_PAUSES;
}

/**
 * The bpm to use next, from the solves so far (oldest first): 5 faster after the last three at `bpm` were all clean,
 * 5 slower after they were all messy, otherwise the same. Only an unbroken run at `bpm` counts, so a change of bpm
 * starts a fresh streak.
 */
export function suggestBpm(history: readonly BpmResult[], bpm: number): number {
  const run: BpmResult[] = [];
  for (let i = history.length - 1; i >= 0 && run.length < STREAK; i--) {
    const result = history[i]!;
    if (result.bpm !== bpm) break;
    run.push(result);
  }
  if (run.length < STREAK) return bpm;
  if (run.every((r) => isClean(r.pauses))) return clampBpm(bpm + BPM_STEP);
  if (run.every((r) => isMessy(r.pauses))) return clampBpm(bpm - BPM_STEP);
  return bpm;
}

/** Where to start when nothing is saved on this device: what the last solve suggests, or the default. */
export function startingBpm(history: readonly BpmResult[]): number {
  const last = history.at(-1);
  return last ? suggestBpm(history, last.bpm) : DEFAULT_BPM;
}
