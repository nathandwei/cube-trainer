import { splitAlg } from "@/app/lib/frame";

type Props = {
  scramble: string;
  /** How many moves have been done; undefined hides progress. */
  progress?: number;
  dim?: boolean;
  className?: string;
};

export function ScrambleBand({ scramble, progress, dim = false, className = "" }: Props) {
  const moves = splitAlg(scramble);
  const classes = ["scramble", dim ? "dim" : "", className].filter(Boolean).join(" ");
  if (moves.length === 0) return <div className={classes}>&nbsp;</div>;
  return (
    <div className={classes} aria-label="scramble">
      {moves.map((move, i) => {
        const state = progress === undefined ? "" : i < progress ? "done" : i === progress ? "next" : "";
        return (
          <span key={i} className={`mv ${state}`}>
            {move}
          </span>
        );
      })}
    </div>
  );
}
