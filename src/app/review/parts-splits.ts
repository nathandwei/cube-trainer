// The report's split rows: the solve's cross, F2L and last layer as the ratings count them, each with how this solve
// moved that rating.

import { chipsFor } from "@/app/components/SplitChips";
import { PARTS, partTimes, ratingHistory, type Part } from "@/app/lib/ratings";
import type { SolveAnalysis, SolveRecord } from "@/cube/types";

export type PartSplit = {
  part: Part;
  /** "Cross" or "XCross", "F2L", "LL". */
  label: string;
  ms: number;
  /** The rating after this solve and how far this solve moved it; null when the solve doesn't rate (a test solve). */
  rating: { value: number; delta: number } | null;
};

const LABELS: Readonly<Record<Part, string>> = { cross: "Cross", f2l: "F2L", ll: "LL" };

/**
 * One row per part. Times are the ratings' own split (an xcross shares its time between cross and F2L), so each row's
 * time is the one its rating moved on; the cross row says XCross when the solve opened with one.
 */
export function partSplits(solve: SolveRecord, analysis: SolveAnalysis, solvesNewestFirst: readonly SolveRecord[]): PartSplit[] {
  const times = partTimes(analysis.stages);
  const opensWithXCross = chipsFor(analysis.stages)[0]?.label === "xcross";
  const history = ratingHistory(solvesNewestFirst);
  const at = history.findIndex((step) => step.id === solve.id);
  const after = at >= 0 ? history[at] : undefined;
  const before = at > 0 ? history[at - 1] : undefined;
  return PARTS.map((part) => ({
    part,
    label: part === "cross" && opensWithXCross ? "XCross" : LABELS[part],
    ms: times[part],
    rating: after ? { value: after.rating[part], delta: before ? after.rating[part] - before.rating[part] : 0 } : null,
  }));
}
