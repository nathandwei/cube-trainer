// How a turn is animated, as opposed to what it does: a half turn spins the way a solver's fingers do it.
// U2, D2, F2, R2 go clockwise twice; B2 and L2 counter-clockwise; M2 upwards (the M' way). Wide moves follow
// their face (r2 like R2, l2 like L2) and rotations their axis (x2 like R2).

const HALF_TURN_DIRECTION: Readonly<Record<string, 1 | -1>> = {
  U: 1,
  D: 1,
  F: 1,
  R: 1,
  B: -1,
  L: -1,
  M: -1,
  E: 1,
  S: 1,
  x: 1,
  y: 1,
  z: 1,
};

const MOVE = /^([A-Za-z])(w?)(2?)('?)$/;

/** The same move, with a half turn written in the direction it should spin. */
export function animatedTurn(move: string): string {
  const parts = MOVE.exec(move);
  if (!parts) return move;
  const [, letter = "", wide = "", half, prime] = parts;
  if (!half) return move;
  const family = "xyz".includes(letter) ? letter : letter.toUpperCase();
  const direction = HALF_TURN_DIRECTION[family] ?? (prime ? -1 : 1);
  return `${letter}${wide}2${direction < 0 ? "'" : ""}`;
}

/** The exact reverse of a move as animated, so stepping back retraces the same path. */
export function reverseOf(move: string): string {
  const parts = MOVE.exec(move);
  if (!parts) return move;
  const [, letter = "", wide = "", half, prime] = parts;
  return `${letter}${wide}${half}${prime ? "" : "'"}`;
}
