import type { SolveRecord } from "@/cube/types";
import { formatMs } from "./format";

/** A solve's result for averaging: ms, or Infinity for a DNF. */
export function resultMs(solve: Pick<SolveRecord, "totalMs" | "penalty">): number {
  if (solve.penalty === "dnf") return Number.POSITIVE_INFINITY;
  return solve.totalMs + (solve.penalty === "+2" ? 2000 : 0);
}

/**
 * WCA-style trimmed mean of the most recent `n` results (newest first): drop the best and worst 5%
 * (at least one each), then average the rest. Returns null when there are too few solves, and
 * Infinity (DNF) when a DNF survives the trim.
 */
export function averageOf(resultsNewestFirst: readonly number[], n: number): number | null {
  if (resultsNewestFirst.length < n) return null;
  const trim = Math.max(1, Math.ceil(n * 0.05));
  const kept = [...resultsNewestFirst.slice(0, n)].sort((a, b) => a - b).slice(trim, n - trim);
  if (kept.some((r) => !Number.isFinite(r))) return Number.POSITIVE_INFINITY;
  return kept.reduce((sum, r) => sum + r, 0) / kept.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] ?? null) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** An average as shown: "–" when there are too few results, DNF when a DNF counts. */
export function formatAverage(ms: number | null): string {
  if (ms === null) return "–";
  return Number.isFinite(ms) ? formatMs(ms) : "DNF";
}
