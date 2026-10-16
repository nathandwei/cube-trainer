import { useSyncExternalStore } from "react";
import { CUBE_LOOKS, type CubeLook } from "@/app/cube3d/looks";

/** Device-local preferences (the timer and the cube read them directly; nothing here needs to sync). */
export type Settings = { inspection: boolean; hideTime: boolean; cubeLook: CubeLook };

const KEYS: Readonly<Record<keyof Settings, string>> = { inspection: "cube.inspection", hideTime: "cube.hideTime", cubeLook: "cube.look" };
const DEFAULTS: Settings = { inspection: false, hideTime: false, cubeLook: "stickerless" };

type Codec<T> = { decode: (raw: string) => T | undefined; encode: (value: T) => string };

const flag: Codec<boolean> = { decode: (raw) => (raw === "1" ? true : raw === "0" ? false : undefined), encode: (on) => (on ? "1" : "0") };
const look: Codec<CubeLook> = { decode: (raw) => CUBE_LOOKS.find((name) => name === raw), encode: (name) => name };

const CODECS: { [K in keyof Settings]: Codec<Settings[K]> } = { inspection: flag, hideTime: flag, cubeLook: look };

const listeners = new Set<() => void>();
let cache: Settings | null = null;

function read<K extends keyof Settings>(key: K): Settings[K] {
  try {
    const raw = localStorage.getItem(KEYS[key]);
    return (raw === null ? undefined : CODECS[key].decode(raw)) ?? DEFAULTS[key];
  } catch (error) {
    console.warn(`Could not read ${KEYS[key]}`, error);
    return DEFAULTS[key];
  }
}

function current(): Settings {
  cache ??= { inspection: read("inspection"), hideTime: read("hideTime"), cubeLook: read("cubeLook") };
  return cache;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  try {
    localStorage.setItem(KEYS[key], CODECS[key].encode(value));
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
