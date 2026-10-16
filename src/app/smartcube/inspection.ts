// WCA inspection (Regulations A3a1, 10e2): 15 seconds; starting the solve after 15 s costs +2, after 17 s it is a
// DNF. Judges call out "8 seconds" and "12 seconds"; here those are small text cues, no audio.

import type { SolveRecord } from "@/cube/types";

export const INSPECTION_MS = 15_000;
export const INSPECTION_DNF_MS = 17_000;

export type Penalty = SolveRecord["penalty"];

/** The penalty for starting the solve `elapsedMs` into inspection. */
export function inspectionPenalty(elapsedMs: number): Penalty {
  if (elapsedMs > INSPECTION_DNF_MS) return "dnf";
  if (elapsedMs > INSPECTION_MS) return "+2";
  return "none";
}

/** What the clock shows during inspection: seconds left (15 → 1), then "+2", then "DNF"; and the judge's cue. */
export function inspectionDisplay(elapsedMs: number): { text: string; cue: "8s" | "12s" | null } {
  const cue = elapsedMs >= 12_000 && elapsedMs < INSPECTION_MS ? "12s" : elapsedMs >= 8_000 && elapsedMs < 12_000 ? "8s" : null;
  if (elapsedMs > INSPECTION_DNF_MS) return { text: "DNF", cue };
  if (elapsedMs > INSPECTION_MS) return { text: "+2", cue };
  return { text: String(Math.max(1, Math.ceil((INSPECTION_MS - elapsedMs) / 1000))), cue };
}
