import { median } from "@/app/lib/averages";
import type { CaseSetId } from "@/cube";
import type { CaseRep, LearnSettings, Rep } from "@/shared/learn";

/** Starting targets per set (ms, recognition + execution) until there are enough reps to use his own median. */
const DEFAULT_TARGET_MS: Record<CaseSetId, number> = { PLL: 2500, OLL: 2200, COLL: 2500, EPLL: 1800, EO: 1500, F2L: 2000 };
const TARGET_SAMPLE = 30;
const MIN_FOR_OWN_TARGET = 10;

export function totalMs(rep: CaseRep): number {
  return rep.recognitionMs + rep.executionMs;
}

/** Case reps for the alg currently chosen: changing a case's alg starts its history over. */
export function currentCaseReps(reps: readonly Rep[], settings: LearnSettings): CaseRep[] {
  return reps.filter((rep): rep is CaseRep => rep.kind === "case" && rep.createdAt >= (settings.algChosenAt[rep.item] ?? 0));
}

export function setOf(caseId: string): CaseSetId {
  return caseId.slice(0, caseId.indexOf("-")) as CaseSetId;
}

/**
 * "Known" means correct and fast, not just correct (his ruling): the target is his own recent median for the set,
 * so it tightens as he improves.
 */
export function targetMs(set: CaseSetId, reps: readonly CaseRep[]): number {
  const recent = reps.filter((r) => r.correct && setOf(r.item) === set).slice(-TARGET_SAMPLE).map(totalMs);
  if (recent.length < MIN_FOR_OWN_TARGET) return DEFAULT_TARGET_MS[set];
  return Math.min(4000, Math.max(800, median(recent) ?? DEFAULT_TARGET_MS[set]));
}

export type CaseProgress = { caseId: string; attempts: number; medianMs: number | null; lastMs: number | null; fluent: boolean };

export function caseProgress(caseId: string, reps: readonly CaseRep[], target: number): CaseProgress {
  const own = reps.filter((r) => r.item === caseId);
  const correct = own.filter((r) => r.correct).map(totalMs);
  const last = own.at(-1);
  return {
    caseId,
    attempts: own.length,
    medianMs: median(correct.slice(-10)),
    lastMs: last ? totalMs(last) : null,
    fluent: Boolean(last?.correct && totalMs(last) <= target),
  };
}

/** One point per practice day: the median time of that day's correct reps in the set. */
export function sessionMedians(set: CaseSetId, reps: readonly CaseRep[]): { day: number; ms: number }[] {
  const byDay = new Map<number, number[]>();
  for (const rep of reps) {
    if (!rep.correct || setOf(rep.item) !== set) continue;
    const day = Math.floor(rep.createdAt / 86_400_000);
    byDay.set(day, [...(byDay.get(day) ?? []), totalMs(rep)]);
  }
  return [...byDay.entries()].sort(([a], [b]) => a - b).map(([day, times]) => ({ day, ms: median(times) ?? 0 }));
}
