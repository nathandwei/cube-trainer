import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";

/** csTimer's keyboard layout for its virtual cube, without rotations: every key is an outer face turn. */
export const VIRTUAL_KEYS: Record<string, string> = {
  j: "U",
  f: "U'",
  i: "R",
  k: "R'",
  d: "L",
  e: "L'",
  h: "F",
  g: "F'",
  s: "D",
  l: "D'",
  w: "B",
  o: "B'",
};

export async function scrambledPattern(scramble: string): Promise<KPattern> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  return kpuzzle.defaultPattern().applyAlg(`${scramble} z2`);
}

export function isSolved(pattern: KPattern): boolean {
  return pattern.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
}
