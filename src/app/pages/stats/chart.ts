import { formatMs } from "@/app/lib/format";

/** The main chart's plot margins, shared by the overview strip so the two x axes line up exactly. */
// Wide enough on the left for "20.0" in the axis type at its largest (15u at 1.25px per u).
export const MARGIN = { left: 56, right: 14, top: 10, bottom: 32 };

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
