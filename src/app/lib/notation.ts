// A smart cube reports turns relative to its own centres, so a slice move arrives as two outer turns
// (M as R L') and every later turn is named after a centre that has moved. These helpers rewrite such
// a stream into the notation a person would use: slices back as M/E/S, later turns renamed.

type Face = "U" | "D" | "R" | "L" | "F" | "B";
const FACES: readonly Face[] = ["U", "D", "R", "L", "F", "B"];

/** Where each centre ends up, from the solver's point of view, after the centres turn this way. */
type Rotation = Record<Face, Face>;

const X_PRIME: Rotation = { U: "F", F: "D", D: "B", B: "U", R: "R", L: "L" };
const Y_PRIME: Rotation = { F: "R", R: "B", B: "L", L: "F", U: "U", D: "D" };
const Z: Rotation = { U: "R", R: "D", D: "L", L: "U", F: "F", B: "B" };

function invert(rotation: Rotation): Rotation {
  const out = {} as Rotation;
  for (const face of FACES) out[rotation[face]] = face;
  return out;
}

function twice(rotation: Rotation): Rotation {
  const out = {} as Rotation;
  for (const face of FACES) out[face] = rotation[rotation[face]];
  return out;
}

type Slice = { slice: string; rotation: Rotation };

/** Outer-turn pair (in the solver's frame, either order) → the slice it really was. */
const SLICES: Record<string, Slice> = {
  "R L'": { slice: "M", rotation: X_PRIME },
  "R' L": { slice: "M'", rotation: invert(X_PRIME) },
  "R2 L2": { slice: "M2", rotation: twice(X_PRIME) },
  "U D'": { slice: "E", rotation: Y_PRIME },
  "U' D": { slice: "E'", rotation: invert(Y_PRIME) },
  "U2 D2": { slice: "E2", rotation: twice(Y_PRIME) },
  "F' B": { slice: "S", rotation: Z },
  "F B'": { slice: "S'", rotation: invert(Z) },
  "F2 B2": { slice: "S2", rotation: twice(Z) },
};

const PAIR_ORDER: Record<Face, number> = { R: 0, L: 1, U: 0, D: 1, F: 0, B: 1 };

function sliceFor(a: string, b: string): Slice | undefined {
  const [first, second] = PAIR_ORDER[a.charAt(0) as Face] === 0 ? [a, b] : [b, a];
  return SLICES[`${first} ${second}`];
}

function isQuarter(move: string): boolean {
  return move.length === 1 || move.endsWith("'");
}

export type DisplayMove = {
  /** What to print, e.g. "M2", "U". */
  text: string;
  /** Indices of the reported turns this token stands for. */
  from: number;
  to: number;
};

/**
 * Rewrite reported outer turns for display. `mergeable(i)` says whether turns i and i+1 may be read as
 * one slice move (e.g. they arrived together, or they sit inside a last-layer alg).
 */
export function humanize(moves: readonly string[], mergeable: (i: number) => boolean): DisplayMove[] {
  // centreAt[face]: which centre currently sits at that face from the solver's point of view.
  let centreAt: Record<Face, Face> = { U: "U", D: "D", R: "R", L: "L", F: "F", B: "B" };
  const out: DisplayMove[] = [];
  const named = (move: string): string => {
    const face = FACES.find((f) => centreAt[f] === move.charAt(0));
    return (face ?? move.charAt(0)) + move.slice(1);
  };

  for (let i = 0; i < moves.length; i++) {
    const current = named(moves[i] ?? "");
    const next = moves[i + 1];
    // A half turn arrives as two quarter turns of the same face in the same direction.
    if (next !== undefined && mergeable(i) && isQuarter(current) && named(next) === current) {
      out.push({ text: `${current.charAt(0)}2`, from: i, to: i + 1 });
      i++;
      continue;
    }
    const slice = next !== undefined && mergeable(i) ? sliceFor(current, named(next)) : undefined;
    if (!slice) {
      out.push({ text: current, from: i, to: i });
      continue;
    }
    out.push({ text: slice.slice, from: i, to: i + 1 });
    const moved = {} as Record<Face, Face>;
    for (const face of FACES) moved[slice.rotation[face]] = centreAt[face];
    centreAt = moved;
    i++;
  }
  return out;
}
