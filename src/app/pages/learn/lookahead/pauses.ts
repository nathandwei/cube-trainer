/** A gap between turns longer than this many beats is a pause. */
export const PAUSE_BEATS = 1.5;

export function beatMs(bpm: number): number {
  if (!(bpm > 0)) throw new RangeError(`bpm must be positive, got ${bpm}`);
  return 60_000 / bpm;
}

export function pauseThresholdMs(bpm: number): number {
  return PAUSE_BEATS * beatMs(bpm);
}

export type Gap = { from: number; to: number };

/** The pauses between consecutive turn times (ms, ascending): every gap longer than 1.5 beats. */
export function findPauses(times: readonly number[], bpm: number): Gap[] {
  const threshold = pauseThresholdMs(bpm);
  const pauses: Gap[] = [];
  for (let i = 1; i < times.length; i++) {
    const from = times[i - 1]!;
    const to = times[i]!;
    if (to < from) throw new Error(`Turn times go backwards at ${i}: ${from} then ${to}`);
    if (to - from > threshold) pauses.push({ from, to });
  }
  return pauses;
}

/** Pauses so far while solving, counting the gap since the last turn as soon as it is long enough. */
export function livePauseCount(times: readonly number[], bpm: number, now: number): number {
  const closed = findPauses(times, bpm).length;
  const last = times.at(-1);
  if (last === undefined) return 0;
  return closed + (now - last > pauseThresholdMs(bpm) ? 1 : 0);
}
