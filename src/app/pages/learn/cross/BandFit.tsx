import type { CSSProperties, ReactNode } from "react";

/** Holds a scramble band and tells drills.css how many moves it carries, so the band can fit them on one line. */
export function BandFit({ moves, children }: { moves: number; children: ReactNode }) {
  return (
    <div className="band-fit" style={{ "--moves": Math.max(1, moves) } as CSSProperties}>
      {children}
    </div>
  );
}
