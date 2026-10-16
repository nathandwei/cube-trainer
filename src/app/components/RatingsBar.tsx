import { msForRating, PARTS, type Ratings } from "@/app/lib/ratings";
import { formatSeconds } from "@/app/lib/format";

const LABEL = { cross: "Cross", f2l: "F2L", ll: "LL" } as const;

export function RatingsBar({ ratings }: { ratings: Ratings }) {
  return (
    <div className="ratings" aria-label="ratings">
      {PARTS.map((part) => {
        const r = ratings[part];
        const delta = r ? Math.round(r.delta) : 0;
        return (
          <div
            key={part}
            className="rating"
            title={r ? `As fast as a typical ${formatSeconds(msForRating(r.rating))} s solver` : undefined}
          >
            <span className="label">{LABEL[part]}</span>
            <span className="value">
              {r ? Math.round(r.rating) : "–"}
              {delta !== 0 && <span className={`delta ${delta > 0 ? "up" : "down"}`}>{delta > 0 ? `↑${delta}` : `↓${-delta}`}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
