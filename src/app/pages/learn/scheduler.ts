import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import { getCase } from "@/cube";
import type { CaseRep, LearnSettings } from "@/shared/learn";
import { casesOf } from "./items";
import { setOf, targetMs, totalMs } from "./progress";

const scheduler = fsrs({ enable_fuzz: false });
const DAY_MS = 86_400_000;
/** A new case is shown this many times in its first session so it gets past "seen once". */
const NEW_CASE_REPEATS = 3;

/** Slow but correct is a miss (his ruling): the point is to remove the pause, not just remember the alg. */
export function gradeRep(rep: CaseRep, target: number): Grade {
  if (!rep.correct) return Rating.Again;
  const total = totalMs(rep);
  if (total > target) return Rating.Again;
  return total <= target * 0.6 ? Rating.Easy : Rating.Good;
}

/**
 * Replays each case's reps into an FSRS card. Only the first rep of a day moves the card; later reps that day are
 * practice, so a long session doesn't fake months of spacing.
 */
export function buildCards(reps: readonly CaseRep[]): Map<string, Card> {
  const cards = new Map<string, Card>();
  const lastDay = new Map<string, number>();
  for (const rep of reps) {
    const day = Math.floor(rep.createdAt / DAY_MS);
    if (lastDay.get(rep.item) === day) continue;
    lastDay.set(rep.item, day);
    const before: Card = cards.get(rep.item) ?? createEmptyCard<Card>(new Date(rep.createdAt));
    const target = targetMs(setOf(rep.item), reps.filter((r) => r.createdAt <= rep.createdAt));
    cards.set(rep.item, scheduler.next(before, new Date(rep.createdAt), gradeRep(rep, target)).card);
  }
  return cards;
}

export type SessionOptions = { size?: number; newMax?: number; only?: readonly string[] };

/**
 * What "learn now" drills: overdue cases first (most overdue first), then a few new ones from the sets he has
 * added, then his slowest known cases. A case with no chosen alg is new; the session asks him to pick one.
 */
export function pickSession(settings: LearnSettings, reps: readonly CaseRep[], now: number, options: SessionOptions = {}): string[] {
  const size = options.size ?? 20;
  const newMax = options.newMax ?? settings.newPerSession ?? 3;
  const pool = options.only ?? casesOf(settings.items).map((c) => c.id);
  const cards = buildCards(reps);
  const learned = pool.filter((id) => settings.algs[id] !== undefined);
  const fresh = pool.filter((id) => settings.algs[id] === undefined);

  const due = learned
    .filter((id) => (cards.get(id)?.due.getTime() ?? 0) <= now)
    .sort((a, b) => (cards.get(a)?.due.getTime() ?? 0) - (cards.get(b)?.due.getTime() ?? 0));
  const newOnes = fresh.slice(0, newMax);
  const slowest = learned
    .filter((id) => !due.includes(id))
    .sort((a, b) => lastTotal(b, reps) - lastTotal(a, reps));

  const order: string[] = [];
  const add = (id: string) => {
    if (order.length < size) order.push(id);
  };
  due.forEach(add);
  newOnes.forEach(add);
  slowest.forEach(add);
  for (let round = 1; round < NEW_CASE_REPEATS; round++) newOnes.forEach(add);
  return spreadRepeats(order);
}

function lastTotal(caseId: string, reps: readonly CaseRep[]): number {
  const last = reps.filter((r) => r.item === caseId).at(-1);
  return last ? totalMs(last) : 0;
}

/** Keeps the same case from coming up twice in a row, so repeats test recall rather than short-term memory. */
export function spreadRepeats(order: readonly string[]): string[] {
  const out: string[] = [];
  const pending = [...order];
  while (pending.length > 0) {
    const index = pending.findIndex((id) => id !== out.at(-1));
    const [next] = pending.splice(index === -1 ? 0 : index, 1);
    if (next) out.push(next);
  }
  return out;
}

export function isReview(card: Card | undefined): boolean {
  return card?.state === State.Review;
}

export function caseLabel(caseId: string): string {
  return getCase(caseId).label;
}
