import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";
import { loadMoreSolves, useHasMoreSolves, useSolves } from "@/app/lib/store";
import type { SolveRecord } from "@/cube/types";

/** Every solve on the server, newest first, growing page by page while older ones arrive. */
export function useFullHistory(): SolveRecord[] {
  const solves = useSolves();
  const hasMore = useHasMoreSolves();
  const loaded = solves.length;
  useEffect(() => {
    if (!hasMore) return;
    // Each page that lands changes `loaded`, which asks for the next one; a failed page stops the chain (the store
    // reports the error) until something else changes.
    loadMoreSolves().catch((error: unknown) => console.error("Could not load older solves for stats", error));
  }, [hasMore, loaded]);
  return solves;
}

// The clock the ranges and the calendar read: a snapshot, so rendering stays pure, refreshed once a minute.
let now = Date.now();

function subscribeNow(listener: () => void): () => void {
  now = Date.now();
  const timer = setInterval(() => {
    now = Date.now();
    listener();
  }, 60_000);
  return () => clearInterval(timer);
}

export function useNow(): number {
  return useSyncExternalStore(subscribeNow, () => now);
}

/** The element's border-box size in CSS pixels ({0, 0} until it has been laid out). */
export function useBoxSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.borderBoxSize[0];
      if (!box) return;
      const next = { width: Math.round(box.inlineSize), height: Math.round(box.blockSize) };
      setSize((previous) => (previous.width === next.width && previous.height === next.height ? previous : next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** The element's width in CSS pixels (0 until it has been laid out). */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  return useBoxSize(ref).width;
}
