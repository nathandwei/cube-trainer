// Alg arithmetic shared by the case catalog and the app.

import { tokenizeAlg } from "./cubie";

const ROTATION_FAMILIES = new Set(["x", "y", "z"]);

/**
 * Moves in an alg as written, in the slice turn metric: every outer turn, wide move or slice counts 1 whatever its
 * amount (R, R2, r', M2), rotations count 0, brackets are ignored. Turns are counted as written, so "R R" is 2.
 * Throws on anything that is not a move.
 */
export function algMoveCount(alg: string): number {
  return tokenizeAlg(alg).filter(({ family }) => !ROTATION_FAMILIES.has(family)).length;
}

function algKey(alg: string): string {
  const tokens = tokenizeAlg(alg);
  while (tokens[0]?.family === "U") tokens.shift();
  while (tokens.at(-1)?.family === "U") tokens.pop();
  return tokens.map(({ family, amount }) => `${family}${amount}`).join(" ");
}

/** Same moves, ignoring spelling (R2' = R2, brackets) and a leading or trailing U turn (an AUF). */
export function isSameAlg(a: string, b: string): boolean {
  return algKey(a) === algKey(b);
}
