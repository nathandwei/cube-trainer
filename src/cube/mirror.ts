// Left/right mirror of an alg: the moves a left hand makes doing what the right hand does in the original, so the
// mirrored alg solves the mirror image of the original's case (Sune's mirror solves Antisune).
//
// Reflecting through the M plane swaps the R and L layers and reverses the sense of every turn about the y and z
// axes, but keeps the sense of turns about the x axis (the reflection only negates x). So R becomes L' (L turns
// the way R' does), U, D, F, B, E, S, y and z keep their layer and reverse direction, and M and x stay exactly as
// they are.

import { tokenizeAlg } from "./cubie";

const SWAPPED: Readonly<Record<string, string>> = {
  R: "L",
  L: "R",
  r: "l",
  l: "r",
  Rw: "Lw",
  Lw: "Rw",
};

const KEEPS_DIRECTION = new Set(["M", "x"]);

const SUFFIXES = ["", "2", "'"] as const;

const SEPARATOR = /^(\s+|[()[\]])$/;

function mirrorToken(raw: string): string {
  return tokenizeAlg(raw)
    .map(({ family, amount }) => {
      const mirroredAmount = KEEPS_DIRECTION.has(family) ? amount : 4 - amount;
      return (SWAPPED[family] ?? family) + SUFFIXES[mirroredAmount - 1];
    })
    .join(" ");
}

/**
 * The left/right mirror of `alg`: R ↔ L with the direction reversed (R → L', R' → L, R2 → L2), wide moves likewise
 * (r → l', Rw → Lw'), U D F B E S y z reversed in place (U → U', y → y'), M and x unchanged. Brackets and spacing are
 * kept; each move is written in canonical form (R2' → L2, R3 → L), so mirroring twice gives back any alg written
 * that way. Throws on anything that is not a move.
 */
export function mirrorAlg(alg: string): string {
  return alg
    .split(/(\s+|[()[\]])/)
    .map((piece) => (piece === "" || SEPARATOR.test(piece) ? piece : mirrorToken(piece)))
    .join("");
}
