import type { Linear } from "./scale";

function point(px: number, py: number): string {
  return `${px.toFixed(1)},${py.toFixed(1)}`;
}

/**
 * A polyline through the finite values at indexes [from, to], broken where a value is missing. Points closer than
 * half a pixel to the last one drawn are skipped, so a long history costs about two points per pixel.
 */
export function linePath(
  keys: readonly number[],
  values: readonly (number | null)[],
  from: number,
  to: number,
  x: Linear,
  y: Linear,
): string {
  const last = Math.min(to, keys.length - 1);
  let d = "";
  let drawing = false;
  let lastPx = -Infinity;
  for (let i = Math.max(0, from); i <= last; i++) {
    const value = values[i];
    const key = keys[i];
    if (value == null || !Number.isFinite(value) || key === undefined) {
      drawing = false;
      continue;
    }
    const px = x.at(key);
    if (drawing && px - lastPx < 0.5 && i !== last) continue;
    d += (drawing ? "L" : "M") + point(px, y.at(value));
    drawing = true;
    lastPx = px;
  }
  return d;
}

/** A step line that holds each value until the next change (a running best), to the last index. */
export function stepPath(keys: readonly number[], values: readonly number[], from: number, to: number, x: Linear, y: Linear): string {
  const last = Math.min(to, keys.length - 1);
  let d = "";
  let held: number | null = null;
  let endPx = 0;
  for (let i = Math.max(0, from); i <= last; i++) {
    const value = values[i];
    const key = keys[i];
    if (value === undefined || !Number.isFinite(value) || key === undefined) continue;
    const px = x.at(key);
    endPx = px;
    if (held === null) d += "M" + point(px, y.at(value));
    else if (value !== held) d += `H${px.toFixed(1)}V${y.at(value).toFixed(1)}`;
    held = value;
  }
  return held === null ? "" : `${d}H${endPx.toFixed(1)}`;
}

/** A filled band between two series over indexes [from, to], wherever both edges are known. */
export function bandPath(
  keys: readonly number[],
  lows: readonly (number | null)[],
  highs: readonly (number | null)[],
  from: number,
  to: number,
  x: Linear,
  y: Linear,
): string {
  const top: string[] = [];
  const bottom: string[] = [];
  const last = Math.min(to, keys.length - 1);
  for (let i = Math.max(0, from); i <= last; i++) {
    const key = keys[i];
    const low = lows[i];
    const high = highs[i];
    if (key === undefined || low == null || high == null) continue;
    const px = x.at(key);
    top.push(point(px, y.at(high)));
    bottom.push(point(px, y.at(low)));
  }
  if (top.length === 0) return "";
  return `M${top.join("L")}L${bottom.reverse().join("L")}Z`;
}
