import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";

/**
 * Keyboard layout for the virtual cube, after csTimer's: face turns on the home rows, plus rotations, wide moves
 * and slices so a solve can be done the way it would be on a real cube.
 */
/** In display order (an object would list "5" first: number-like keys sort ahead of the rest). */
export const VIRTUAL_LAYOUT: readonly (readonly [key: string, move: string])[] = [
  ["j", "U"],
  ["f", "U'"],
  ["i", "R"],
  ["k", "R'"],
  ["d", "L"],
  ["e", "L'"],
  ["h", "F"],
  ["g", "F'"],
  ["s", "D"],
  ["l", "D'"],
  ["w", "B"],
  ["o", "B'"],
  [";", "y"],
  ["a", "y'"],
  ["t", "x"],
  ["b", "x'"],
  ["p", "z"],
  ["q", "z'"],
  ["u", "r"],
  ["m", "r'"],
  ["v", "l"],
  ["r", "l'"],
  ["5", "M"],
  ["x", "M'"],
];

export const VIRTUAL_KEYS: Readonly<Record<string, string>> = Object.fromEntries(VIRTUAL_LAYOUT);

export async function scrambledPattern(scramble: string): Promise<KPattern> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  return kpuzzle.defaultPattern().applyAlg(`${scramble} z2`);
}

export function isSolved(pattern: KPattern): boolean {
  return pattern.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
}
