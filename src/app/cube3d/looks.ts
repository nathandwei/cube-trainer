// How the 3D cube looks. Stickerless is a speed cube like the GAN 16: big pillowed tiles in bright plastic over a
// body of the same colour, so the seams read as shadow. Matte is the muted CaseDiagram palette on a dark body (the
// earlier look); classic is bright stickers on black.

export type CubeLook = "stickerless" | "matte" | "classic";

export const CUBE_LOOKS: readonly CubeLook[] = ["stickerless", "matte", "classic"];

/** Faces as WCA holds the cube: white U, green F, red R, yellow D, blue B, orange L. */
export type FaceName = "U" | "R" | "F" | "D" | "L" | "B";

export type LookSpec = {
  colours: Readonly<Record<FaceName, number>>;
  /** The body under a tile: null for the tile's own colour, darkened (one plastic piece, as on a stickerless cube). */
  body: number | null;
  /** Inside faces of the body, seen mid-turn. */
  core: number;
  /** Tile size on a cubie face of 1, its corner radius, and how proud and rounded its edge is. */
  tile: { size: number; radius: number; centreRadius: number; bevel: number; height: number };
  /** Plastic finish. */
  roughness: number;
  clearcoat: number;
  /** How much the room's reflections light it, relative to the key light. */
  environment: number;
  /** Overall brightness: matte stays near its flat colours, the plastic looks catch more light. */
  exposure: number;
};

export const LOOKS: Readonly<Record<CubeLook, LookSpec>> = {
  stickerless: {
    colours: { U: 0xf2f1ec, R: 0xe0242c, F: 0x20aa45, D: 0xffd21c, L: 0xff7a1c, B: 0x1e6ce6 },
    body: null,
    core: 0x2a2724,
    tile: { size: 0.93, radius: 0.13, centreRadius: 0.24, bevel: 0.04, height: 0.004 },
    roughness: 0.24,
    clearcoat: 0.6,
    environment: 0.7,
    exposure: 0.95,
  },
  matte: {
    colours: { U: 0xf3eee5, R: 0xc2493c, F: 0x4a9461, D: 0xe8c547, L: 0xe07a36, B: 0x3a6fae },
    body: 0x2b2421,
    core: 0x2b2421,
    tile: { size: 0.86, radius: 0.1, centreRadius: 0.1, bevel: 0.015, height: 0.01 },
    roughness: 0.85,
    clearcoat: 0,
    environment: 0.4,
    exposure: 0.78,
  },
  classic: {
    colours: { U: 0xf7f7f2, R: 0xd8202b, F: 0x18a84a, D: 0xffd200, L: 0xff6a10, B: 0x1659d6 },
    body: 0x141414,
    core: 0x141414,
    tile: { size: 0.86, radius: 0.08, centreRadius: 0.08, bevel: 0.02, height: 0.012 },
    roughness: 0.3,
    clearcoat: 0.45,
    environment: 0.75,
    exposure: 1,
  },
};

function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/**
 * A look's colours as CSS, by the face they sit on as the solver holds the cube (yellow U, white D, green F, orange R:
 * WCA turned z2), for the flat pictures that sit beside the 3D cube.
 */
export function solverPalette(look: CubeLook): Readonly<Record<FaceName, string>> {
  const { colours } = LOOKS[look];
  return { U: css(colours.D), D: css(colours.U), R: css(colours.L), L: css(colours.R), F: css(colours.F), B: css(colours.B) };
}
