import { useSyncExternalStore } from "react";

// Which set to calibrate next: asked for by the sidebar when he ticks a set he has no algs for, or by the set page's
// Calibrate button; the learn page shows calibration for it once that set is open.
let pending: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function requestCalibration(setId: string): void {
  pending = setId;
  notify();
}

export function clearCalibration(): void {
  if (pending === null) return;
  pending = null;
  notify();
}

export function usePendingCalibration(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
  );
}
