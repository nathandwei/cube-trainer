import { FACES } from "./cubie";

export type Rng = () => number;

/** Small seeded PRNG (mulberry32): deterministic demos and tests. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function uniform(rng: Rng, low: number, high: number): number {
  return low + (high - low) * rng();
}

export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** A random-move scramble string (WCA notation, no consecutive turns of one face or its opposite pair repeated). */
export function randomScramble(rng: Rng, length = 20): string {
  const moves: string[] = [];
  let prev = -1;
  let prevPrev = -1;
  while (moves.length < length) {
    const face = randomInt(rng, 6);
    if (face === prev) continue;
    const opposite = (face + 3) % 6;
    if (opposite === prev && face === prevPrev) continue;
    moves.push(FACES[face]! + ["", "2", "'"][randomInt(rng, 3)]!);
    prevPrev = prev;
    prev = face;
  }
  return moves.join(" ");
}
