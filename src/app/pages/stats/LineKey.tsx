import type { Line } from "./prefs";

/** A short sample of a line's stroke, so the toggles and the readout name each line the way it is drawn. */
export function LineKey({ line }: { line: Line }) {
  return (
    <svg className={`line-key line-key-${line}`} width={16} height={8} viewBox="0 0 16 8" aria-hidden="true">
      <path d={line === "pb" ? "M0,2.5H8V6.5H16" : "M0,4H16"} />
    </svg>
  );
}
