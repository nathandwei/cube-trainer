import { FrameTracker, humanize, type DisplayToken } from "@/cube";
import type { RotationEvent, Slot, SolveAnalysis, TimedMove } from "@/cube/types";
import { stageAt } from "@/app/lib/review";

/** Two turns this close together are one move on a smart cube: a slice (R L') or a half turn (R R). */
const TOGETHER_MS = 60;

/** A display token with the moment it happened, for playback in real time. */
export type TimedToken = DisplayToken & { t: number };

type Solve = { moves: readonly TimedMove[]; rotations?: readonly RotationEvent[] };

/** The solve as the solver saw it: slices, wide moves and rotations, each with its time. */
export function displayTokens(solve: Solve, analysis: SolveAnalysis | undefined): TimedToken[] {
  const { moves } = solve;
  const rotations = solve.rotations ?? [];
  const tokens = humanize(moves, rotations, (i) => {
    const gap = (moves[i + 1]?.t ?? Infinity) - (moves[i]?.t ?? 0);
    const sameStage = !analysis || stageAt(analysis, i) === stageAt(analysis, i + 1);
    return gap <= TOGETHER_MS && sameStage;
  });
  let nextRotation = 0;
  return tokens.map((token) => {
    if (token.kind === "turn") return { ...token, t: moves[token.end - 1]?.t ?? 0 };
    // A rotation token stands for one or more events at its position (y y → y2): take the first one's time.
    while (nextRotation < rotations.length && (rotations[nextRotation]?.after ?? Infinity) < token.start) nextRotation++;
    const t = rotations[nextRotation]?.t ?? moves[token.start - 1]?.t ?? 0;
    while (nextRotation < rotations.length && rotations[nextRotation]?.after === token.start) nextRotation++;
    return { ...token, t };
  });
}

/** How many tokens to play to reach the state just before raw turn `raw` (rotations right before it stay unplayed). */
export function tokenCountBefore(tokens: readonly TimedToken[], raw: number): number {
  const index = tokens.findIndex((token) => token.start >= raw);
  return index === -1 ? tokens.length : index;
}

/** How many tokens to play so that at least `raw` raw turns are done (for scrubbing to a time). */
export function tokenCountAtLeast(tokens: readonly TimedToken[], raw: number): number {
  if (raw <= 0) return 0;
  const index = tokens.findIndex((token) => token.end >= raw);
  return index === -1 ? tokens.length : index + 1;
}

function viewAfter(tokens: readonly TimedToken[], count: number): FrameTracker {
  const tracker = new FrameTracker();
  for (const token of tokens.slice(0, count)) tracker.apply(token.text);
  return tracker;
}

/** Centre-frame turns (as the solvers return them) renamed for the view the solver has after `count` tokens. */
export function inViewAfter(tokens: readonly TimedToken[], count: number, line: string): string {
  const tracker = viewAfter(tokens, count);
  return line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((move) => tracker.name(move))
    .join(" ");
}

/**
 * A centre-frame F2L slot ("BR") named for the view after `count` tokens. A view tipped by x or z puts the slot
 * outside the bottom layer, where it has no slot name; the centre-frame name is kept then.
 */
export function slotInView(tokens: readonly TimedToken[], count: number, slot: Slot): string {
  const tracker = viewAfter(tokens, count);
  const faces = [...slot].map((face) => tracker.name(face).charAt(0));
  const frontBack = faces.find((face) => face === "F" || face === "B");
  const side = faces.find((face) => face === "R" || face === "L");
  return frontBack && side ? frontBack + side : slot;
}
