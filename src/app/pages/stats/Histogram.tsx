import { memo, useState } from "react";
import type { Bin } from "./data";

const EMPTY_ROWS = 6;

function rowLabel(bin: Bin, width: number): string {
  const decimals = width >= 1000 ? 0 : width % 100 === 0 ? 1 : 2;
  return (bin.from / 1000).toFixed(decimals) + (bin.open ? "+" : "");
}

/** Solve times in rows of `width` ms, fastest at the top. */
export const Histogram = memo(function Histogram({ bins, width }: { bins: readonly Bin[]; width: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...bins.map((b) => b.count));
  if (bins.length === 0) {
    return (
      <div className="histogram" aria-hidden="true">
        {Array.from({ length: EMPTY_ROWS }, (_, i) => (
          <div key={i} className="histogram-row">
            <span className="label">–</span>
            <span className="track" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="histogram" role="list" aria-label="Solve times" onPointerLeave={() => setHovered(null)}>
      {bins.map((bin, i) => (
        <div
          key={bin.from}
          role="listitem"
          className={`histogram-row ${hovered === i ? "hover" : ""}`}
          onPointerEnter={() => setHovered(i)}
          aria-label={`${rowLabel(bin, width)}: ${bin.count}`}
        >
          <span className="label">{rowLabel(bin, width)}</span>
          <span className="track">
            <span className="bar" style={{ width: `${(bin.count / max) * 100}%` }} />
            {hovered === i && <span className="count">{bin.count}</span>}
          </span>
        </div>
      ))}
    </div>
  );
});
