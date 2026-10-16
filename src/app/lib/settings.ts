import { useSyncExternalStore } from "react";

/** Device-local preferences (the timer reads them directly; nothing here needs to sync). */
export type Settings = { inspection: boolean; hideTime: boolean };

const KEYS = { inspection: "cube.inspection", hideTime: "cube.hideTime" } as const;
const DEFAULTS: Settings = { inspection: false, hideTime: false };
const listeners = new Set<() => void>();
let cache: Settings | null = null;

function read(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "1";
  } catch (error) {
    console.warn(`Could not read ${key}`, error);
    return fallback;
  }
}

function current(): Settings {
  cache ??= { inspection: read(KEYS.inspection, DEFAULTS.inspection), hideTime: read(KEYS.hideTime, DEFAULTS.hideTime) };
  return cache;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  try {
    localStorage.setItem(KEYS[key], value ? "1" : "0");
  } catch (error) {
    console.warn(`Could not save ${KEYS[key]}`, error);
  }
  cache = { ...current(), [key]: value };
  listeners.forEach((notify) => notify());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    current,
  );
}
