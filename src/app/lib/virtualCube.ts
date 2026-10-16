import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";

/**
 * csTimer's virtual-cube keyboard layout, key for key (its qcubennn.js keymap, 3x3): face turns on the home rows,
 * plus rotations, wide moves and slices. Listed in display order, since an object would sort "5" and "1" first.
 */
export const VIRTUAL_LAYOUT: readonly (readonly [key: string, move: string])[] = [
  ["i", "R"],
  ["k", "R'"],
  ["d", "L"],
  ["e", "L'"],
  ["j", "U"],
  ["f", "U'"],
  ["s", "D"],
  ["l", "D'"],
  ["h", "F"],
  ["g", "F'"],
  ["w", "B"],
  ["o", "B'"],
  [";", "y"],
  ["a", "y'"],
  ["t", "x"],
  ["y", "x"],
  ["b", "x'"],
  ["n", "x'"],
  ["p", "z"],
  ["q", "z'"],
  ["u", "r"],
  ["m", "r'"],
  ["v", "l"],
  ["r", "l'"],
  [",", "u"],
  ["c", "u'"],
  ["z", "d"],
  ["/", "d'"],
  ["5", "M"],
  ["6", "M"],
  ["x", "M'"],
  [".", "M'"],
  ["2", "E"],
  ["9", "E'"],
  ["0", "S"],
  ["1", "S'"],
];

export const VIRTUAL_KEYS: Readonly<Record<string, string>> = Object.fromEntries(VIRTUAL_LAYOUT);

export async function scrambledPattern(scramble: string): Promise<KPattern> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  return kpuzzle.defaultPattern().applyAlg(`${scramble} z2`);
}

export function isSolved(pattern: KPattern): boolean {
  return pattern.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
}
