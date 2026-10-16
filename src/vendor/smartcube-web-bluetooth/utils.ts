// Vendored from poliva/smartcube-web-bluetooth src/utils.ts (see README.md in this folder).
// Changes: cubeTimestampLinearFit / cubeTimestampCalcSkew left out (the app fits the cube clock itself, in
// src/cube/normalize.ts); strict-TS fixes.

/**
 * Return current host clock timestamp with millisecond precision
 * Use monotonic clock when available
 * @returns Current host clock timestamp in milliseconds
 */
const now: () => number =
    typeof window != 'undefined' && typeof window.performance?.now == 'function' ?
        () => Math.floor(window.performance.now()) :
        typeof process != 'undefined' && typeof process.hrtime?.bigint == 'function' ?
            () => Number(process.hrtime.bigint() / 1_000_000n) :
            () => Date.now();

const CORNER_FACELET_MAP = [
    [8, 9, 20], // URF
    [6, 18, 38], // UFL
    [0, 36, 47], // ULB
    [2, 45, 11], // UBR
    [29, 26, 15], // DFR
    [27, 44, 24], // DLF
    [33, 53, 42], // DBL
    [35, 17, 51]  // DRB
] as const;

const EDGE_FACELET_MAP = [
    [5, 10], // UR
    [7, 19], // UF
    [3, 37], // UL
    [1, 46], // UB
    [32, 16], // DR
    [28, 25], // DF
    [30, 43], // DL
    [34, 52], // DB
    [23, 12], // FR
    [21, 41], // FL
    [50, 39], // BL
    [48, 14]  // BR
] as const;

/**
 *
 * Convert Corner/Edge Permutation/Orientation cube state to the Kociemba facelets representation string
 *
 * Example - solved state:
 *   cp = [0, 1, 2, 3, 4, 5, 6, 7]
 *   co = [0, 0, 0, 0, 0, 0, 0, 0]
 *   ep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
 *   eo = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
 *   facelets = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
 * Example - state after F R moves made:
 *   cp = [0, 5, 2, 1, 7, 4, 6, 3]
 *   co = [1, 2, 0, 2, 1, 1, 0, 2]
 *   ep = [1, 9, 2, 3, 11, 8, 6, 7, 4, 5, 10, 0]
 *   eo = [1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]
 *   facelets = "UUFUUFLLFUUURRRRRRFFRFFDFFDRRBDDBDDBLLDLLDLLDLBBUBBUBB"
 *
 * @param cp Corner Permutation
 * @param co Corner Orientation
 * @param ep Egde Permutation
 * @param eo Edge Orientation
 * @returns Cube state in the Kociemba facelets representation string
 *
 */
function toKociembaFacelets(cp: Array<number>, co: Array<number>, ep: Array<number>, eo: Array<number>): string {
    const faces = "URFDLB";
    const facelets: Array<string> = [];
    for (let i = 0; i < 54; i++) {
        facelets[i] = faces.charAt(~~(i / 9));
    }
    for (let i = 0; i < 8; i++) {
        for (let p = 0; p < 3; p++) {
            facelets[CORNER_FACELET_MAP[i]![(p + co[i]!) % 3]!] = faces.charAt(~~(CORNER_FACELET_MAP[cp[i]!]![p]! / 9));
        }
    }
    for (let i = 0; i < 12; i++) {
        for (let p = 0; p < 2; p++) {
            facelets[EDGE_FACELET_MAP[i]![(p + eo[i]!) % 2]!] = faces.charAt(~~(EDGE_FACELET_MAP[ep[i]!]![p]! / 9));
        }
    }
    return facelets.join('');
}

export {
    now,
    toKociembaFacelets,
}
