import { useSyncExternalStore } from "react";
import type { SolveRecord } from "@/cube/types";

const KEY = "cube.solves.v1";
const listeners = new Set<() => void>();
let cache: SolveRecord[] | null = null;

function load(): SolveRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SolveRecord[]) : [];
  } catch (error) {
    console.error("Could not read saved solves", error);
    return [];
  }
}

function save(solves: SolveRecord[]): void {
  cache = solves;
  try {
    localStorage.setItem(KEY, JSON.stringify(solves));
  } catch (error) {
    console.error("Could not save solves", error);
  }
  listeners.forEach((notify) => notify());
}

/** Newest first. */
export function getSolves(): SolveRecord[] {
  cache ??= load();
  return cache;
}

export function addSolve(solve: SolveRecord): void {
  save([solve, ...getSolves()]);
}

export function updateSolve(id: string, patch: Partial<SolveRecord>): void {
  save(getSolves().map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function deleteSolve(id: string): void {
  save(getSolves().filter((s) => s.id !== id));
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

export function useSolves(): SolveRecord[] {
  return useSyncExternalStore(subscribe, getSolves);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
