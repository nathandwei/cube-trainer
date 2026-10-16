import type { CubeState } from "@/cube";

// Kociemba's facelet layout for the engine's cubie conventions (corner positions URF UFL ULB UBR DFR DLF DBL DRB,
// edges UR UF UL UB DR DF DL DB FR FL BL BR, twist 0 = the U/D sticker faces U/D). Faces are numbered 0..8 row by
// row as seen from outside: U with B at the top, F/R/B/L with U at the top, D with F at the top.

export type Face = "U" | "R" | "F" | "D" | "L" | "B";
export const FACES: readonly Face[] = ["U", "R", "F", "D", "L", "B"];

type Sticker = [Face, number];

const CORNER_FACELETS: readonly (readonly Sticker[])[] = [
  [["U", 8], ["R", 0], ["F", 2]],
  [["U", 6], ["F", 0], ["L", 2]],
  [["U", 0], ["L", 0], ["B", 2]],
  [["U", 2], ["B", 0], ["R", 2]],
  [["D", 2], ["F", 8], ["R", 6]],
  [["D", 0], ["L", 8], ["F", 6]],
  [["D", 6], ["B", 8], ["L", 6]],
  [["D", 8], ["R", 8], ["B", 6]],
];

const EDGE_FACELETS: readonly (readonly Sticker[])[] = [
  [["U", 5], ["R", 1]],
  [["U", 7], ["F", 1]],
  [["U", 3], ["L", 1]],
  [["U", 1], ["B", 1]],
  [["D", 5], ["R", 7]],
  [["D", 1], ["F", 7]],
  [["D", 3], ["L", 7]],
  [["D", 7], ["B", 7]],
  [["F", 5], ["R", 3]],
  [["F", 3], ["L", 5]],
  [["B", 5], ["L", 3]],
  [["B", 3], ["R", 5]],
];

/** Which face's colour each sticker shows, for a state in the solver frame (white D, green F). */
export function facelets(state: CubeState): Record<Face, Face[]> {
  const out = Object.fromEntries(FACES.map((f) => [f, Array<Face>(9).fill(f)])) as Record<Face, Face[]>;
  state.cp.forEach((cubie, position) => {
    const twist = state.co[position] ?? 0;
    const home = CORNER_FACELETS[cubie];
    CORNER_FACELETS[position]?.forEach((_, k) => {
      const [face, index] = CORNER_FACELETS[position]?.[(k + twist) % 3] ?? ["U", 0];
      const color = home?.[k]?.[0];
      if (color) out[face][index] = color;
    });
  });
  state.ep.forEach((cubie, position) => {
    const flip = state.eo[position] ?? 0;
    const home = EDGE_FACELETS[cubie];
    EDGE_FACELETS[position]?.forEach((_, k) => {
      const [face, index] = EDGE_FACELETS[position]?.[(k + flip) % 2] ?? ["U", 0];
      const color = home?.[k]?.[0];
      if (color) out[face][index] = color;
    });
  });
  return out;
}
