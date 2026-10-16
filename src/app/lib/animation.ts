// How a turn is animated, as opposed to what it does: a half turn spins the way a solver's fingers do it.
// U2, D2, F2 go clockwise twice; B2 counter-clockwise; M2 upwards (the M' way). R2 and L2 depend on the hand's
// previous turn (TurnAnimator); on their own R2 is clockwise and L2 counter-clockwise. Wide moves follow their
// face (r2 like R2, l2 like L2) and rotations their axis (x2 like R2).

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

/** The faces turned by a hand, whose half turns go back the way the wrist last went. */
const HAND_FACES = new Set(["R", "L"]);

type Played = { animated: string; family: string; before: 1 | -1 | undefined };

/**
 * Turns played on one cube since it was last reset, so each half turn spins the way fingers would do it: an R2 or L2
 * goes opposite to that hand's previous turn (R2 then R2 is R R, then R' R'), starting from the face's usual
 * direction; other half turns follow `animatedTurn`. Undoing pops the exact animation back off.
 */
export class TurnAnimator {
  readonly #lastDirection = new Map<string, 1 | -1>();
  readonly #played: Played[] = [];

  reset(): void {
    this.#lastDirection.clear();
    this.#played.length = 0;
  }

  /** The move as it should spin now; remembered so `undo` can retrace it. */
  play(move: string): string {
    const parts = MOVE.exec(move);
    const letter = parts?.[1] ?? "";
    const family = letter.toUpperCase();
    if (!parts || !HAND_FACES.has(family)) {
      const animated = animatedTurn(move);
      this.#played.push({ animated, family: "", before: undefined });
      return animated;
    }
    const [, , wide = "", half, prime] = parts;
    const before = this.#lastDirection.get(family);
    let direction: 1 | -1 = prime ? -1 : 1;
    if (half) direction = before === undefined ? (HALF_TURN_DIRECTION[family] ?? 1) : before === 1 ? -1 : 1;
    this.#lastDirection.set(family, direction);
    const animated = half ? `${letter}${wide}2${direction < 0 ? "'" : ""}` : move;
    this.#played.push({ animated, family, before });
    return animated;
  }

  /** The reverse of the last played move, as it was spun; the hands go back to where they were before it. */
  undo(): string | undefined {
    const last = this.#played.pop();
    if (!last) return undefined;
    if (last.family) {
      if (last.before === undefined) this.#lastDirection.delete(last.family);
      else this.#lastDirection.set(last.family, last.before);
    }
    return reverseOf(last.animated);
  }
}
