import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { Part } from "@/app/lib/ratings";

/** The stats tab's controls, shared by its sidebar and page, remembered on this device. */
const STORAGE_KEY = "cube.stats.prefs.v1";

export type XAxis = "solve" | "date";
export type Range = "7d" | "30d" | "all";
export type Line = "ao12" | "ao100" | "pb";

export const X_AXES: readonly XAxis[] = ["solve", "date"];
export const RANGES: readonly Range[] = ["7d", "30d", "all"];
export const LINES: readonly Line[] = ["ao12", "ao100", "pb"];

// Each field falls back on its own, so one unreadable choice (or a renamed option) never resets the others.
const prefsSchema = z.object({
  x: z.enum(["solve", "date"]).catch("solve"),
  range: z.enum(["7d", "30d", "all"]).catch("all"),
  lines: z
    .object({ ao12: z.boolean().catch(false), ao100: z.boolean().catch(true), pb: z.boolean().catch(true) })
    .catch({ ao12: false, ao100: true, pb: true }),
  splits: z
    .object({ cross: z.boolean().catch(false), f2l: z.boolean().catch(false), ll: z.boolean().catch(false) })
    .catch({ cross: false, f2l: false, ll: false }),
});

export type StatsPrefs = z.infer<typeof prefsSchema>;

export const DEFAULT_PREFS: StatsPrefs = prefsSchema.parse({});

export function parsePrefs(raw: string | null): StatsPrefs {
  if (raw === null) return DEFAULT_PREFS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn("The saved stats settings are not valid JSON; using the defaults", error);
    return DEFAULT_PREFS;
  }
  const result = prefsSchema.safeParse(parsed);
  if (result.success) return result.data;
  console.warn("The saved stats settings have an unexpected shape; using the defaults", result.error.issues);
  return DEFAULT_PREFS;
}

function load(): StatsPrefs {
  try {
    return parsePrefs(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.warn("Could not read the saved stats settings", error);
    return DEFAULT_PREFS;
  }
}

function save(prefs: StatsPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn("Could not save the stats settings", error);
  }
}

const listeners = new Set<() => void>();
let prefs: StatsPrefs | null = null;

function current(): StatsPrefs {
  prefs ??= load();
  return prefs;
}

function update(change: (previous: StatsPrefs) => StatsPrefs): void {
  prefs = change(current());
  save(prefs);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStatsPrefs(): StatsPrefs {
  return useSyncExternalStore(subscribe, current);
}

export function setXAxis(x: XAxis): void {
  update((p) => ({ ...p, x }));
}

export function setRange(range: Range): void {
  update((p) => ({ ...p, range }));
}

export function toggleLine(line: Line): void {
  update((p) => ({ ...p, lines: { ...p.lines, [line]: !p.lines[line] } }));
}

export function toggleSplit(part: Part): void {
  update((p) => ({ ...p, splits: { ...p.splits, [part]: !p.splits[part] } }));
}
