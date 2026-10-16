import { formatMs } from "@/app/lib/format";

/** The main chart's plot margins, shared by the overview strip so the two x axes line up exactly. */
export const MARGIN = { left: 44, right: 14, top: 10, bottom: 28 };

export function showTime(ms: number | null | undefined): string {
  if (ms == null) return "–";
  return Number.isFinite(ms) ? formatMs(ms) : "DNF";
}

export function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/** Puts a 1px line on a pixel boundary so it renders crisp instead of smeared over two rows. */
export function crisp(value: number): number {
  return Math.round(value) + 0.5;
}
