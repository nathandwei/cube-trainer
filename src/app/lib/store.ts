import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { SolveRecord } from "@/cube/types";

const KEY = "cube.solves.v1";

const timedMove = z.object({ move: z.string(), t: z.number() });
const solveRecord = z.object({
  id: z.string(),
  scramble: z.string(),
  moves: z.array(timedMove),
  totalMs: z.number(),
  penalty: z.enum(["none", "+2", "dnf"]),
  createdAt: z.number(),
  source: z.enum(["demo", "keyboard", "smartcube", "virtual"]),
  // The analysis is recomputable from the moves, so only its outline is checked here.
  analysis: z.object({ stages: z.array(z.looseObject({})) }).loose().optional(),
});

type State = { solves: SolveRecord[]; saveError: string | null };

const listeners = new Set<() => void>();
let state: State | null = null;

function read(): SolveRecord[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (error) {
    console.error("Could not read saved solves", error);
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error("Saved solves are not valid JSON", error);
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    const result = solveRecord.safeParse(entry);
    if (result.success) return [result.data as SolveRecord];
    console.warn("Skipping a saved solve that does not match the schema", result.error.issues);
    return [];
  });
}

function current(): State {
  state ??= { solves: read(), saveError: null };
  return state;
}

function publish(next: State): void {
  state = next;
  listeners.forEach((notify) => notify());
}

/** Writes against what is on disk now, so a second tab's solves are never overwritten. */
function write(change: (onDisk: SolveRecord[]) => SolveRecord[]): void {
  const solves = change(read());
  try {
    localStorage.setItem(KEY, JSON.stringify(solves));
    publish({ solves, saveError: null });
  } catch (error) {
    console.error("Could not save solves", error);
    const reason = error instanceof DOMException && error.name === "QuotaExceededError" ? "storage full" : "storage unavailable";
    publish({ solves, saveError: `not saved: ${reason}` });
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY) return;
    publish({ solves: read(), saveError: current().saveError });
  });
}

export function addSolve(solve: SolveRecord): void {
  write((solves) => [solve, ...solves]);
}

export function deleteSolve(id: string): void {
  write((solves) => solves.filter((s) => s.id !== id));
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Newest first. */
export function useSolves(): SolveRecord[] {
  return useSyncExternalStore(subscribe, () => current().solves);
}

export function useSaveError(): string | null {
  return useSyncExternalStore(subscribe, () => current().saveError);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
