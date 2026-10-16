// Community preference data for validating the speed model (speed.ts): for each PLL, OLL and COLL case, the four
// most-voted algs on SpeedCubeDB with their community vote counts, retrieved 2026-10-16 from
// https://www.speedcubedb.com/a/3x3/PLL, https://www.speedcubedb.com/a/3x3/OLL and
// https://www.speedcubedb.com/a/3x3/COLL (the case list pages show each case's top four algs).
//
// Vote counts are facts recorded for testing only; the app does not show them. SpeedCubeDB publishes no licence, so
// nothing else from the site is copied. Algs are written as the site writes them (leading y rotations included).
// Each entry is filed under the catalog case its algs solve (checked by speed.test.ts), since the site's case
// names and angles are not always the catalog's; SpeedCubeDB has no COLL entries for O-adj and O-diag.

/** One case: its catalog id and the site's top algs, most-voted first, as [alg, votes]. */
export type CommunityCase = { caseId: string; algs: readonly (readonly [alg: string, votes: number])[] };

export const COMMUNITY_VOTES: Readonly<Record<"PLL" | "OLL" | "COLL", readonly CommunityCase[]>> = {
  PLL: [
    {
      caseId: "PLL-Aa",
      algs: [
        ["x R' U R' D2 R U' R' D2 R2 x'", 201],
        ["y' x L2 D2 L' U' L D2 L' U L'", 47],
        ["l' U R' D2 R U' R' D2 R2 x'", 43],
        ["y x' R2 D2 R' U' R D2 R' U R' x", 43],
      ],
    },
    {
      caseId: "PLL-Ab",
      algs: [
        ["x R2 D2 R U R' D2 R U' R x'", 164],
        ["y' x L U' L D2 L' U L D2 L2", 32],
        ["y x' R U' R D2 R' U R D2 R2 x", 25],
        ["R' B' R U' R D R' U R D' R2 B R", 18],
      ],
    },
    {
      caseId: "PLL-E",
      algs: [
        ["y x' R U' R' D R U R' D' R U R' D R U' R' D' x", 166],
        ["y R' U' R' D' R U' R' D R U R' D' R U R' D R2", 51],
        ["R2 U F' R' U R U' R' U R U' R' U R U' F U' R2", 33],
        ["y x' L' U L D' L' U' L D L' U' L D' L' U L D", 18],
      ],
    },
    {
      caseId: "PLL-F",
      algs: [
        ["y R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", 194],
        ["y R' F R f' R' F R2 U R' U' R' F' R2 U R' S", 55],
        ["R' U R U' R2 F' U' F U R F R' F' R2", 42],
        ["y R2 F R F' R' U' F' U F R2 U R' U' R", 16],
      ],
    },
    {
      caseId: "PLL-Ga",
      algs: [
        ["R2 U R' U R' U' R U' R2 D U' R' U R D'", 119],
        ["R2 u R' U R' U' R u' R2 F' U F", 22],
        ["y R U R' F' R U R' U' R' F R U' R' F R2 U' R' U' R U R' F'", 16],
        ["D' R2 U R' U R' U' R U' R2 U' D R' U R", 11],
      ],
    },
    {
      caseId: "PLL-Gb",
      algs: [
        ["D R' U' R U D' R2 U R' U R U' R U' R2", 143],
        ["R' U' R U D' R2 U R' U R U' R U' R2 D", 112],
        ["y F' U' F R2 u R' U R U' R u' R2", 57],
        ["R' d' F R2 u R' U R U' R u' R2", 39],
      ],
    },
    {
      caseId: "PLL-Gc",
      algs: [
        ["R2 U' R U' R U R' U R2 D' U R U' R' D", 99],
        ["y2 R2 F2 R U2 R U2 R' F R U R' U' R' F R2", 91],
        ["D R2 U' R U' R U R' U R2 D' U R U' R'", 75],
        ["R2 u' R U' R U R' u R2 f R' f'", 25],
      ],
    },
    {
      caseId: "PLL-Gd",
      algs: [
        ["R U R' U' D R2 U' R U' R' U R' U R2 D'", 109],
        ["D' R U R' U' D R2 U' R U' R' U R' U R2", 35],
        ["R U R' y' R2 u' R U' R' U R' u R2", 16],
        ["y R2 F' R U R U' R' F' R U2 R' U2 R' F2 R2", 14],
      ],
    },
    {
      caseId: "PLL-H",
      algs: [
        ["M2 U M2 U2 M2 U M2", 142],
        ["M2 U' M2 U2 M2 U' M2", 138],
        ["R2 S2 R2 U' R2 S2 R2", 17],
        ["M2 U2 M2 U M2 U2 M2", 15],
      ],
    },
    {
      caseId: "PLL-Ja",
      algs: [
        ["y2 x R2 F R F' R U2 r' U r U2 x'", 150],
        ["y R' U L' U2 R U' R' U2 R L", 67],
        ["L' U' L F L' U' L U L F' L2 U L", 65],
        ["R U' L' U R' U2 L U' L' U2 L", 24],
      ],
    },
    {
      caseId: "PLL-Jb",
      algs: [
        ["R U R' F' R U R' U' R' F R2 U' R'", 211],
        ["R U2 R' U' R U2 L' U R' U' L", 13],
        ["r' F R F' r U2 R' U R U2 R'", 8],
        ["L' U R U' L U2 R' U R U2 R'", 7],
      ],
    },
    {
      caseId: "PLL-Na",
      algs: [
        ["R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", 154],
        ["F' R U R' U' R' F R2 F U' R' U' R U F' R'", 61],
        ["R F U' R' U R U F' R2 F' R U R U' R' F", 39],
        ["r' D r U2 r' D r U2 r' D r U2 r' D r U2 r' D r", 32],
      ],
    },
    {
      caseId: "PLL-Nb",
      algs: [
        ["R' U R U' R' F' U' F R U R' F R' F' R U' R", 124],
        ["r' D' F r U' r' F' D r2 U r' U' r' F r F'", 110],
        ["R' U L' U2 R U' L R' U L' U2 R U' L", 34],
        ["R' U R U' R' F' U' F R U R' U' R U' f R f'", 23],
      ],
    },
    {
      caseId: "PLL-Ra",
      algs: [
        ["y R U' R' U' R U R D R' U' R D' R' U2 R'", 152],
        ["y R U R' F' R U2 R' U2 R' F R U R U2 R'", 64],
        ["L U2 L' U2 L F' L' U' L U L F L2", 31],
        ["y R U' R' U' R U R' U R' D' R U' R' D R2 U R'", 18],
      ],
    },
    {
      caseId: "PLL-Rb",
      algs: [
        ["R' U2 R U2 R' F R U R' U' R' F' R2", 113],
        ["y R2 F R U R U' R' F' R U2 R' U2 R", 76],
        ["R' U2 R' D' R U' R' D R U R U' R' U' R", 50],
        ["y R' U R U R' U' R' D' R U R' D R U2 R", 8],
      ],
    },
    {
      caseId: "PLL-T",
      algs: [
        ["R U R' U' R' F R2 U' R' U' R U R' F'", 224],
        ["l b d' L' U' F U2 L' U' L' U L U' f' S M r u E U' R'", 34],
        ["R U R' U' R' F R2 U' R' U F' L' U L", 19],
        ["R2 u R2 u' R2 F2 u' F2 u F2", 19],
      ],
    },
    {
      caseId: "PLL-Ua",
      algs: [
        ["y2 M2 U M U2 M' U M2", 137],
        ["R U R' U R' U' R2 U' R' U R' U R", 120],
        ["y R2 U' S' U2 S U' R2", 81],
        ["y2 R U' R U R U R U' R' U' R2", 72],
      ],
    },
    {
      caseId: "PLL-Ub",
      algs: [
        ["y2 M2 U' M U2 M' U' M2", 131],
        ["R' U R' U' R' U' R' U R U R2", 59],
        ["R2' U R U R' U' R3 U' R' U R'", 55],
        ["y2 R2 U R U R' U' R' U' R' U R'", 43],
      ],
    },
    {
      caseId: "PLL-V",
      algs: [
        ["R' U R' U' R D' R' D R' U D' R2 U' R2 D R2", 107],
        ["R' U R U' R' f' U' R U2 R' U' R U' R' f R", 96],
        ["R' U R' U' y R' F' R2 U' R' U R' F R F", 83],
        ["y R U' R U R' D R D' R U' D R2 U R2 D' R2", 82],
      ],
    },
    {
      caseId: "PLL-Y",
      algs: [
        ["F R U' R' U' R U R' F' R U R' U' R' F R F'", 171],
        ["F R' F R2 U' R' U' R U R' F' R U R' U' F'", 59],
        ["R2 U' R2 U' R2 U F U F' R2 F U' F'", 15],
        ["F R' F' R U R U' R2 U' R U R f' U' f", 9],
      ],
    },
    {
      caseId: "PLL-Z",
      algs: [
        ["M' U' M2 U' M2 U' M' U2 M2", 92],
        ["M2 U M2 U M' U2 M2 U2 M'", 83],
        ["y M2 U' M2 U' M' U2 M2 U2 M'", 43],
        ["y M' U M2 U M2 U M' U2 M2", 41],
      ],
    },
  ],
  OLL: [
    {
      caseId: "OLL-1",
      algs: [
        ["R U2 R2 F R F' U2 R' F R F'", 143],
        ["y R U' R2 D' r U' r' D R2 U R'", 34],
        ["f R U R' U' R f' U' r' U' R U M'", 12],
        ["L' U2 L2 F' L' F U2 L F' L' F", 6],
      ],
    },
    {
      caseId: "OLL-2",
      algs: [
        ["y' R U' R2 D' r U r' D R2 U R'", 89],
        ["F R U R' U' S R U R' U' f'", 64],
        ["F R U R' U' F' f R U R' U' f'", 38],
        ["y r U r' U2 R U2 R' U2 r U' r'", 38],
      ],
    },
    {
      caseId: "OLL-3",
      algs: [
        ["y' f R U R' U' f' U' F R U R' U' F'", 43],
        ["y R' F2 R2 U2 R' F R U2 R2 F2 R", 36],
        ["r' R2 U R' U r U2 r' U M'", 29],
        ["M R U R' U r U2 r' U M'", 19],
      ],
    },
    {
      caseId: "OLL-4",
      algs: [
        ["y' R' F2 R2 U2 R' F' R U2 R2 F2 R", 42],
        ["y' f R U R' U' f' U F R U R' U' F'", 27],
        ["R' F R F' U' S R' U' R U R S'", 16],
        ["y F U R U' R' F' U' F R U R' U' F'", 14],
      ],
    },
    {
      caseId: "OLL-5",
      algs: [
        ["r' U2 R U R' U r", 77],
        ["y2 l' U2 L U L' U l", 35],
        ["y2 R' F2 r U r' F R", 22],
        ["y2 R' F2 L F L' F R", 4],
      ],
    },
    {
      caseId: "OLL-6",
      algs: [
        ["r U2 R' U' R U' r'", 86],
        ["F U' R2 D R' U' R D' R2 U F'", 3],
        ["y2 l U2 L' U' L U' l'", 3],
        ["L F2 l' U' l F' L'", 2],
      ],
    },
    {
      caseId: "OLL-7",
      algs: [
        ["r U R' U R U2 r'", 77],
        ["S' R U R' U R U2 R' U S", 8],
        ["L' U2 L U2 L F' L' F", 6],
        ["y2 f R U R' U' f' y2 F R' F' r U R U' r'", 5],
      ],
    },
    {
      caseId: "OLL-8",
      algs: [
        ["y2 r' U' R U' R' U2 r", 52],
        ["l' U' L U' L' U2 l", 46],
        ["R U2 R' U2 R' F R F'", 26],
        ["R' F' r U' r' F2 R", 22],
      ],
    },
    {
      caseId: "OLL-9",
      algs: [
        ["y R U R' U' R' F R2 U R' U' F'", 89],
        ["R U2 R' U' S' R U' R' S", 22],
        ["y2 F' U' F r U' r' U r U r'", 7],
        ["y' L' U' L U' L F' L' F L' U2 L", 7],
      ],
    },
    {
      caseId: "OLL-10",
      algs: [
        ["R U R' U R' F R F' R U2 R'", 58],
        ["y F U F' R' F R U' R' F' R", 16],
        ["y M' R' U2 R U R' U R U M", 9],
        ["y2 L' U' L U L F' L2 U' L U F", 6],
      ],
    },
    {
      caseId: "OLL-11",
      algs: [
        ["r' R2 U R' U R U2 R' U M'", 45],
        ["y2 r U R' U R' F R F' R U2 r'", 37],
        ["S R U R' U R U2 R' U2 S'", 29],
        ["M R U R' U R U2 R' U M'", 29],
      ],
    },
    {
      caseId: "OLL-12",
      algs: [
        ["y' M' R' U' R U' R' U2 R U' M", 37],
        ["F R U R' U' F' U F R U R' U' F'", 29],
        ["y' S R' U' R U' R' U2 R U2 S'", 18],
        ["y M L' U' L U' L' U2 L U' M'", 11],
      ],
    },
    {
      caseId: "OLL-13",
      algs: [
        ["F U R U2 R' U' R U R' F'", 48],
        ["F U R U' R2 F' R U R U' R'", 44],
        ["r U' r' U' r U r' F' U F", 28],
        ["y2 f R U R2 U' R' U R U' f'", 7],
      ],
    },
    {
      caseId: "OLL-14",
      algs: [
        ["R' F R U R' F' R F U' F'", 56],
        ["r U R' U' r' F R2 U R' U' F'", 30],
        ["l' U l U l' U' l F U' F'", 9],
        ["S R U R' U' R' F R2 U R' U' f'", 8],
      ],
    },
    {
      caseId: "OLL-15",
      algs: [
        ["r' U' r R' U' R U r' U r", 40],
        ["y2 l' U' l L' U' L U l' U l", 35],
        ["r' U' M' U' R U r' U r", 14],
        ["y2 R' F' R L' U' L U R' F R", 12],
      ],
    },
    {
      caseId: "OLL-16",
      algs: [
        ["r U r' R U R' U' r U' r'", 76],
        ["r U M U R' U' r U' r'", 11],
        ["y2 R' F R U R' U' F' R U' R' U2 R", 7],
        ["y2 l U l' L U L' U' l U' l'", 4],
      ],
    },
    {
      caseId: "OLL-17",
      algs: [
        ["R U R' U R' F R F' U2 R' F R F'", 58],
        ["y2 F R' F' R U S' R U' R' S", 51],
        ["y2 F R' F' R2 r' U R U' R' U' M'", 12],
        ["y' F' r U r' U' S r' F r S'", 8],
      ],
    },
    {
      caseId: "OLL-18",
      algs: [
        ["y R U2 R2 F R F' U2 M' U R U' r'", 42],
        ["r U R' U R U2 r2 U' R U' R' U2 r", 23],
        ["y F S' R U' R' S R U2 R' U' F'", 23],
        ["R D r' U' r D' R' U' R2 F R F' R", 10],
      ],
    },
    {
      caseId: "OLL-19",
      algs: [
        ["y S' R U R' S U' R' F R F'", 48],
        ["M U R U R' U' M' R' F R F'", 38],
        ["R' U2 F R U R' U' F2 U2 F R", 14],
        ["r' R U R U R' U' r R2 F R F'", 8],
      ],
    },
    {
      caseId: "OLL-20",
      algs: [
        ["r U R' U' M2 U R U' R' U' M'", 57],
        ["M' U2 M U2 M' U M U2 M' U2 M", 42],
        ["S' R U R' S U' M' U R U' r'", 28],
        ["S R' U' R U R U R U' R' S'", 25],
      ],
    },
    {
      caseId: "OLL-21",
      algs: [
        ["R U R' U R U' R' U R U2 R'", 82],
        ["y R U2 R' U' R U R' U' R U' R'", 48],
        ["y F R U R' U' R U R' U' R U R' U' F'", 40],
        ["R' U' R U' R' U R U' R' U2 R", 13],
      ],
    },
    {
      caseId: "OLL-22",
      algs: [
        ["R U2 R2 U' R2 U' R2 U2 R", 100],
        ["R' U2 R2 U R2 U R2 U2 R'", 18],
        ["f R U R' U' S' R U R' U' F'", 17],
        ["f R U R' U' f' F R U R' U' F'", 6],
      ],
    },
    {
      caseId: "OLL-23",
      algs: [
        ["R2 D R' U2 R D' R' U2 R'", 104],
        ["y2 R2 D' R U2 R' D R U2 R", 41],
        ["R U R' U R U2 R2 U' R U' R' U2 R", 13],
        ["y R U R' U' R U' R' U2 R U' R' U2 R U R'", 5],
      ],
    },
    {
      caseId: "OLL-24",
      algs: [
        ["r U R' U' r' F R F'", 117],
        ["y2 R' F' r U R U' r' F", 14],
        ["y R U R D R' U' R D' R2", 14],
        ["y' x' R U R' D R U' R' D' x", 12],
      ],
    },
    {
      caseId: "OLL-25",
      algs: [
        ["R U2 R D R' U2 R D' R2", 97],
        ["y F' r U R' U' r' F R", 78],
        ["F R' F' r U R U' r'", 65],
        ["x R' U R D' R' U' R D x'", 13],
      ],
    },
    {
      caseId: "OLL-26",
      algs: [
        ["y R U2 R' U' R U' R'", 83],
        ["R' U' R U' R' U2 R", 44],
        ["y2 L' U' L U' L' U2 L", 24],
        ["y2 L' U R U' L U R'", 4],
      ],
    },
    {
      caseId: "OLL-27",
      algs: [
        ["R U R' U R U2 R'", 112],
        ["y' R' U2 R U R' U R", 14],
        ["y L' U2 L U L' U L", 8],
        ["y2 L U L' U L U2 L'", 7],
      ],
    },
    {
      caseId: "OLL-28",
      algs: [
        ["r U R' U' M U R U' R'", 113],
        ["R' F R S R' F' R S'", 26],
        ["r U R' U' r' R U R U' R'", 26],
        ["y2 M' U M U2 M' U M", 17],
      ],
    },
    {
      caseId: "OLL-29",
      algs: [
        ["r2 D' r U r' D r2 U' r' U' r", 57],
        ["y R U R' U' R U' R' F' U' F R U R'", 40],
        ["y S' R U R' U' R' F R F' U S", 25],
        ["M U R U R' U' R' F R F' M'", 20],
      ],
    },
    {
      caseId: "OLL-30",
      algs: [
        ["y2 F U R U2 R' U' R U2 R' U' F'", 46],
        ["y' r' D' r U' r' D r2 U' r' U r U r'", 46],
        ["y2 F R' F R2 U' R' U' R U R' F2", 29],
        ["y S' R' U' R f R' U R U' F'", 15],
      ],
    },
    {
      caseId: "OLL-31",
      algs: [
        ["R' U' F U R U' R' F' R", 78],
        ["y2 S' L' U' L U L F' L' f", 13],
        ["y S R U R' U' f' U' F", 12],
        ["y' F R' F' R U R U R' U' R U' R'", 7],
      ],
    },
    {
      caseId: "OLL-32",
      algs: [
        ["S R U R' U' R' F R f'", 74],
        ["y2 L U F' U' L' U L F L'", 22],
        ["R U B' U' R' U R B R'", 14],
        ["y' R' F R F' U' r U' r' U r U r'", 6],
      ],
    },
    {
      caseId: "OLL-33",
      algs: [
        ["R U R' U' R' F R F'", 116],
        ["y2 L' U' L U L F' L' F", 5],
        ["y2 r' F' r U r U' r' F", 3],
        ["R U R' F' U' F R U' R'", 2],
      ],
    },
    {
      caseId: "OLL-34",
      algs: [
        ["y f R f' U' r' U' R U M'", 80],
        ["y2 R U R2 U' R' F R U R U' F'", 57],
        ["F R U R' U' R' F' r U R U' r'", 32],
        ["y2 R U R' U' B' R' F R F' B", 18],
      ],
    },
    {
      caseId: "OLL-35",
      algs: [
        ["R U2 R2 F R F' R U2 R'", 56],
        ["f R U R' U' f' R U R' U R U2 R'", 6],
        ["R U2 R' d' R' F R U' R' F' R", 3],
        ["y L' U2 L2 F' L' F L' U2 L", 2],
      ],
    },
    {
      caseId: "OLL-36",
      algs: [
        ["y R U R2 F' U' F U R2 U2 R'", 59],
        ["y2 L' U' L U' L' U L U L F' L' F", 53],
        ["y2 R U R' F' R U R' U' R' F R U' R' F R F'", 36],
        ["R U R' U' F' U2 F U R U R'", 16],
      ],
    },
    {
      caseId: "OLL-37",
      algs: [
        ["F R' F' R U R U' R'", 77],
        ["F R U' R' U' R U R' F'", 72],
        ["y F' r U r' U' r' F r", 8],
        ["y2 r2 D' r U' r' D r U r", 3],
      ],
    },
    {
      caseId: "OLL-38",
      algs: [
        ["R U R' U R U' R' U' R' F R F'", 92],
        ["y F R U' R' S U' R U R' f'", 7],
        ["r U R' U' r' F R U R U' R' F'", 2],
        ["y2 L U L' U L U' L' U' L' B L B'", 2],
      ],
    },
    {
      caseId: "OLL-39",
      algs: [
        ["y' f' r U r' U' r' F r S", 46],
        ["y' R U R' F' U' F U R U2 R'", 42],
        ["y L F' L' U' L U F U' L'", 32],
        ["y' f' L F L' U' L' U L S", 17],
      ],
    },
    {
      caseId: "OLL-40",
      algs: [
        ["y R' F R U R' U' F' U R", 68],
        ["y' f R' F' R U R U' R' S'", 38],
        ["R r D r' U r D' r' U' R'", 2],
        ["y' L' U' L F U F' U' L' U2 L", 1],
      ],
    },
    {
      caseId: "OLL-41",
      algs: [
        ["y2 R U R' U R U2 R' F R U R' U' F'", 54],
        ["y2 F U R2 D R' U' R D' R2 F'", 21],
        ["y' S U' R' F' U' F U R S'", 12],
        ["M U' F' L' U' L U F M'", 10],
      ],
    },
    {
      caseId: "OLL-42",
      algs: [
        ["R' U' R U' R' U2 R F R U R' U' F'", 41],
        ["y F S' R U R' U' F' U S", 26],
        ["y R' F R F' R' F R F' R U R' U' R U R'", 23],
        ["y R' U' F2 u' R U R' D R2 B", 16],
      ],
    },
    {
      caseId: "OLL-43",
      algs: [
        ["y R' U' F' U F R", 63],
        ["y2 F' U' L' U L F", 26],
        ["f' L' U' L U f", 24],
        ["B' U' R' U R B", 7],
      ],
    },
    {
      caseId: "OLL-44",
      algs: [
        ["f R U R' U' f'", 75],
        ["y2 F U R U' R' F'", 68],
        ["y R U B U' B' R'", 6],
        ["y' L U F U' F' L'", 2],
      ],
    },
    {
      caseId: "OLL-45",
      algs: [
        ["F R U R' U' F'", 104],
        ["y R' F' U' F U R", 17],
        ["y2 f U R U' R' f'", 5],
        ["y2 F' L' U' L U F", 4],
      ],
    },
    {
      caseId: "OLL-46",
      algs: [
        ["R' U' R' F R F' U R", 76],
        ["R' F' U' F R U' R' U2 R", 6],
        ["y F R U R' U' F' U' R U R' U R U2 R'", 5],
        ["l' U2 L2 F' L' F U L' U l", 3],
      ],
    },
    {
      caseId: "OLL-47",
      algs: [
        ["y' F R' F' R U2 R U' R' U R U2 R'", 40],
        ["F' L' U' L U L' U' L U F", 38],
        ["R' U' R' F R F' R' F R F' U R", 28],
        ["y' R' F' U' F U F' U' F U R", 9],
      ],
    },
    {
      caseId: "OLL-48",
      algs: [
        ["F R U R' U' R U R' U' F'", 69],
        ["y2 f U R U' R' U R U' R' f'", 8],
        ["R U2 R' U' R U R' U2 R' F R F'", 3],
        ["F R' F' U2 R U R' U R2 U2 R'", 1],
      ],
    },
    {
      caseId: "OLL-49",
      algs: [
        ["y2 r U' r2 U r2 U r2 U' r", 59],
        ["l U' l2 U l2 U l2 U' l", 14],
        ["R B' R2 F R2 B R2 F' R", 8],
        ["y2 R' F R' F' R2 U2 B' R B R'", 4],
      ],
    },
    {
      caseId: "OLL-50",
      algs: [
        ["r' U r2 U' r2 U' r2 U r'", 51],
        ["y2 R' F R2 B' R2 F' R2 B R'", 11],
        ["y' R U2 R' U' R U' R' F R U R' U' F'", 11],
        ["y2 l' U l2 U' l2 U' l2 U l'", 11],
      ],
    },
    {
      caseId: "OLL-51",
      algs: [
        ["y2 F U R U' R' U R U' R' F'", 64],
        ["f R U R' U' R U R' U' f'", 55],
        ["y' R' U' R' F R F' R U' R' U2 R", 5],
        ["y r' F' U' F U F' U' F U r", 3],
      ],
    },
    {
      caseId: "OLL-52",
      algs: [
        ["y2 R' F' U' F U' R U R' U R", 56],
        ["R U R' U R U' B U' B' R'", 44],
        ["R U R' U R d' R U' R' F'", 19],
        ["R U R' U R U' y R U' R' F'", 12],
      ],
    },
    {
      caseId: "OLL-53",
      algs: [
        ["r' U' R U' R' U R U' R' U2 r", 33],
        ["y2 l' U' L U' L' U L U' L' U2 l", 25],
        ["y r' U2 R U R' U' R U R' U r", 24],
        ["y' l' U2 L U L' U' L U L' U l", 13],
      ],
    },
    {
      caseId: "OLL-54",
      algs: [
        ["r U R' U R U' R' U R U2 r'", 45],
        ["y' r U2 R' U' R U R' U' R U' r'", 26],
        ["y' r U r' R U R' U' R U R' U' r U' r'", 4],
        ["y2 l U L' U L U' L' U L U2 l'", 3],
      ],
    },
    {
      caseId: "OLL-55",
      algs: [
        ["y R' F U R U' R2 F' R2 U R' U' R", 51],
        ["y R' F R U R U' R2 F' R2 U' R' U R U R'", 34],
        ["R U2 R2 U' R U' R' U2 F R F'", 22],
        ["r U2 R2 F R F' U2 r' F R F'", 19],
      ],
    },
    {
      caseId: "OLL-56",
      algs: [
        ["r U r' U R U' R' U R U' R' r U' r'", 33],
        ["r U r' U R U' R' M' U R U2 r'", 32],
        ["F R U R' U' R F' r U R' U' r'", 19],
        ["r' U' r U' R' U R U' R' U R r' U r", 17],
      ],
    },
    {
      caseId: "OLL-57",
      algs: [
        ["R U R' U' M' U R U' r'", 96],
        ["y R U' R' S' R U R' S", 12],
        ["y R U R' S' R U' R' S", 8],
        ["R U R' U' R' r U R U' r'", 7],
      ],
    },
  ],
  COLL: [
    {
      caseId: "COLL-AS1",
      algs: [
        ["y R U2 R' U' R U' R'", 16],
        ["R' U' R U' R' U2 R", 15],
        ["y2 L' U' L U' L' U2 L", 6],
        ["y' L U2 L' U' L U' L'", 2],
      ],
    },
    {
      caseId: "COLL-AS2",
      algs: [
        ["y2 R2 D R' U R D' R' U R' U' R U' R'", 6],
        ["y R' U' R U' R' U R' D' R U R' D R2", 4],
        ["U2 R2 D R' U R D' R' U R' U' R U' R'", 3],
        ["R U R' f' U' R U2 R' U' R U' R' f R U' R'", 0],
      ],
    },
    {
      caseId: "COLL-AS3",
      algs: [
        ["y2 R2 D R' U2 R D' R2 U' R U' R'", 5],
        ["R' U' F' R U R' U' R' F R2 U' R' U R", 3],
        ["y2 M F' r U R' U2 r' F2 r", 2],
        ["U2 f' L F L' U2 L' U2 L U2 S", 1],
      ],
    },
    {
      caseId: "COLL-AS4",
      algs: [
        ["y2 R' U' R U' R2 D' R U2 R' D R2", 4],
        ["y2 R U2 R' U2 r' F R F' M'", 3],
        ["R' U' R U R' F R U R' U' R' F' R2", 2],
        ["y2 R U2 R' U2 L' U R U' R' L", 2],
      ],
    },
    {
      caseId: "COLL-AS5",
      algs: [
        ["y2 r' F R F' r U R'", 10],
        ["R' U L U' R U L'", 8],
        ["y2 L' U R U' L U R'", 6],
        ["U2 R' F R F' r U R' U' M", 0],
      ],
    },
    {
      caseId: "COLL-AS6",
      algs: [
        ["R U' R' U2 R U' R' U2 R' D' R U R' D R", 5],
        ["R U2 r' F R' F' r U' R U' R'", 4],
        ["R U R' F' R U2 R' U' R U' R' F R U' R'", 3],
        ["y2 L U2 R' U L' U' R U' L U' L'", 2],
      ],
    },
    {
      caseId: "COLL-S1",
      algs: [
        ["R U R' U R U2 R'", 12],
        ["y' R' U2 R U R' U R", 4],
        ["y L' U2 L U L' U L", 3],
        ["y2 L U L' U L U2 L'", 2],
      ],
    },
    {
      caseId: "COLL-S2",
      algs: [
        ["y2 R U R' U R2 D R' U2 R D' R2", 7],
        ["r' F2 r U2 R U' r' F M'", 6],
        ["L' U2 L U2 R U' L' U L R'", 1],
        ["L' U2 L U2 l F' L' F M'", 1],
      ],
    },
    {
      caseId: "COLL-S3",
      algs: [
        ["L' R U R' U' L U2 R U2 R'", 5],
        ["M F R' F' r U2 R U2 R'", 5],
        ["y2 R2 D' R U2 R' D R2 U R' U R", 4],
        ["f R' F' R U2 R U2 R' U2 S'", 2],
      ],
    },
    {
      caseId: "COLL-S4",
      algs: [
        ["y' R U R' U R U' R D R' U' R D' R2", 5],
        ["R U R' U' R' F R F' r U R' U R U2 r'", 2],
        ["y' F R' U2 R F' R' F U2 F' R", 2],
        ["L F' U2 F L' F' L U2 L' F", 0],
      ],
    },
    {
      caseId: "COLL-S5",
      algs: [
        ["R U' L' U R' U' L", 8],
        ["R U' r' F R' F' r", 7],
        ["l F' L' F l' U' L", 0],
        ["r U' r' F R' F' r U M", 0],
      ],
    },
    {
      caseId: "COLL-S6",
      algs: [
        ["y2 R U R' F' R U R' U R U2 R' F R U' R'", 5],
        ["y2 R U R' U r' F R F' r U2 R'", 4],
        ["y2 R U R' U L' U R U' L U2 R'", 2],
        ["F' R U2 R' U2 R' F2 R U R U' R' F'", 2],
      ],
    },
    {
      caseId: "COLL-L1",
      algs: [
        ["y' R U R' U R U' R' U R U' R' U R U2 R'", 21],
        ["y' R U2 R' U' R U R' U' R U R' U' R U' R'", 9],
        ["y2 R' U2 R U R' U' R U R' U' R U R' U R", 3],
        ["R' U' R U' R' U2 R U' R U R' U R U2 R'", 2],
      ],
    },
    {
      caseId: "COLL-L2",
      algs: [
        ["R' U2 R' D' R U2 R' D R2", 25],
        ["R U R' U2 L U' R U L' U R'", 0],
        ["y2 L' U2 L' D' L U2 L' D L2", 0],
        ["y' R' U2 R U R2 D' R U R' D R2", 0],
      ],
    },
    {
      caseId: "COLL-L3",
      algs: [
        ["y R U2 R D R' U2 R D' R2", 17],
        ["U2 R U2 R2 D' R U' R' D R2 U' R'", 3],
        ["R' F' R U R' U' R' F R2 U' R' U2 R", 3],
        ["y R' U' R U2 L' U R' U' L U' R", 0],
      ],
    },
    {
      caseId: "COLL-L4",
      algs: [
        ["y F R' F' r U R U' r'", 22],
        ["y2 R2 D R' U R D' R' U' R'", 3],
        ["R U R' U' R' F R U R U' R' F'", 1],
        ["y F l' U' L U R U' r'", 1],
      ],
    },
    {
      caseId: "COLL-L5",
      algs: [
        ["y2 F' r U R' U' r' F R", 21],
        ["y x R' U R D' R' U' R D x'", 3],
        ["r U R U' r' F R' F'", 3],
        ["y' R2 D' R U' R' D R U R", 2],
      ],
    },
    {
      caseId: "COLL-L6",
      algs: [
        ["y r U2 R2 F R F' R U2 r'", 17],
        ["y' R' U' R U R' F' R U R' U' R' F R2", 4],
        ["U' R' U' R U R' F' R U R' U' R' F R2", 3],
        ["y F R U R2 F R F' R U' R' F'", 2],
      ],
    },
    {
      caseId: "COLL-U1",
      algs: [
        ["R' U' R U' R' U2 R2 U R' U R U2 R'", 22],
        ["y2 R U R' U R U2 R2 U' R U' R' U2 R", 3],
        ["y R U2 R' U' R U' R' U' R U R' U R U2 R'", 2],
        ["y' R U R' U' R U' R' U2 R U' R' U2 R U R'", 2],
      ],
    },
    {
      caseId: "COLL-U2",
      algs: [
        ["R' F R U' R' U' R U R' F' R U R' U' R' F R F' R", 20],
        ["y' r U R' U' r' F R2 U' R' U' R U2 R' U' F'", 10],
        ["y' R' U' R F R2 D' R U R' D R2 U' F'", 6],
        ["y F U R U2 R' U R U R2 F' r U R U' r'", 6],
      ],
    },
    {
      caseId: "COLL-U3",
      algs: [
        ["y2 R2 D R' U2 R D' R' U2 R'", 17],
        ["L2 D L' U2 L D' L' U2 L'", 3],
        ["R U' R' U' R U2 R' U' R' D' R U2 R' D R", 2],
        ["R' U R U R' F' R U R' U' R' F R2 U' R' U' R", 2],
      ],
    },
    {
      caseId: "COLL-U4",
      algs: [
        ["F R U' R' U R U R' U R U' R' F'", 18],
        ["y2 R' F2 R U2 R U2 R' F2 R U2 R'", 4],
        ["y' F U2 R' D' R U2 R' D R F'", 2],
        ["y2 R U2 R' U2 L' U2 R U2 R' U2 L", 1],
      ],
    },
    {
      caseId: "COLL-U5",
      algs: [
        ["R2 D' R U2 R' D R U2 R", 17],
        ["y2 L2 D' L U2 L' D L U2 L", 4],
        ["L U' R U' L' U R' U2 L U' L'", 0],
        ["y2 x R' U R D' R' U2 R D R' U R x'", 0],
      ],
    },
    {
      caseId: "COLL-U6",
      algs: [
        ["R2 D' R U R' D R U R U' R' U' R", 17],
        ["R' U2 R F U' R' U' R U F'", 13],
        ["R U' R' U' R U R D R' U R D' R2", 4],
        ["R' U2 R U2 R' F' R U R' U' R' F R2", 3],
      ],
    },
    {
      caseId: "COLL-T1",
      algs: [
        ["R U2 R' U' R U' R2 U2 R U R' U R", 19],
        ["y' R U R2 U' R2 U' R2 U2 R U' R U' R'", 2],
        ["R U2 R' r' F2 r U' R U' R' U' r' F r", 2],
        ["y' R U R' U R U2 R' L' U' L U' L' U2 L", 2],
      ],
    },
    {
      caseId: "COLL-T2",
      algs: [
        ["R' U R U2 R' L' U R U' L", 11],
        ["R' U R U2 r' R' F R F' r", 5],
        ["y2 R' F R U R' U' R' F' R2 U' R' U2 R", 5],
        ["y2 R U' R' U2 L R U' R' U L'", 3],
      ],
    },
    {
      caseId: "COLL-T3",
      algs: [
        ["y R' F' r U R U' r' F", 11],
        ["y l' U' L U R U' r' F", 8],
        ["y2 R' U' R' D' R U R' D R2", 5],
        ["y l' U' L U l F' L' F", 5],
      ],
    },
    {
      caseId: "COLL-T4",
      algs: [
        ["y2 F R U R' U' R U' R' U' R U R' F'", 14],
        ["y2 F R' D' R U2 R' D R U2 F'", 2],
        ["y2 R F R' U R U2 R' U R U F' R'", 2],
        ["y R U2 R' F2 R U2 R' U2 R' F2 R", 2],
      ],
    },
    {
      caseId: "COLL-T5",
      algs: [
        ["y' r U R' U' r' F R F'", 17],
        ["R U R D R' U' R D' R2", 4],
        ["y2 x' D R U' R' D' R U R' x", 1],
        ["R U R' U R' D' R U' R' D R2 U' R'", 1],
      ],
    },
    {
      caseId: "COLL-T6",
      algs: [
        ["R' U R2 D r' U2 r D' R2 U' R", 18],
        ["y2 R U' R2 D' r U2 r' D R2 U R'", 5],
        ["y R' U' R U R2 D' R U2 R' D R2 U' R' U R", 2],
        ["y R U R' U' R2 D R' U2 R D' R2 U R U' R'", 2],
      ],
    },
    {
      caseId: "COLL-Pi1",
      algs: [
        ["R U2 R2 U' R2 U' R2 U2 R", 9],
        ["R' U2 R2 U R2 U R2 U2 R'", 4],
        ["y2 L' U2 L2 U L2 U L2 U2 L'", 1],
        ["R U R' U R U2 R' U' R U R' U R U2 R'", 0],
      ],
    },
    {
      caseId: "COLL-Pi2",
      algs: [
        ["y F U R U' R' U R U' R2 F' R U R U' R'", 12],
        ["R' F2 R U2 R U2 R' F2 U' R U' R'", 9],
        ["y2 L' U' L U L F' L2 U' L U L' U' L U F", 2],
        ["R U R' U R' F R2 U' R' U' R U R' F' U R U' R'", 1],
      ],
    },
    {
      caseId: "COLL-Pi3",
      algs: [
        ["R' U' F' R U R' U' R' F R2 U2 R' U2 R", 13],
        ["y F U R U' R' U R U2 R' U' R U R' F'", 11],
        ["y F R2 U' R2 U R2 U S R2 f'", 4],
        ["y' R U R' U R U2 R2 F' r U R U' r' F", 1],
      ],
    },
    {
      caseId: "COLL-Pi4",
      algs: [
        ["R U R' U' R' F R2 U R' U' R U R' U' F'", 15],
        ["R U2 R' U' R U R' U2 r' F R F' M'", 1],
        ["y F' R U R' U R U' R' U' R' F R U' R U' R' U R U R'", 0],
        ["y' R' U2 R U R' U R2 U' L' U R' U' L", 0],
      ],
    },
    {
      caseId: "COLL-Pi5",
      algs: [
        ["R U' L' U R' U L U L' U L", 12],
        ["y' R U2 R' U R' D' R U2 R' D R2 U' R'", 8],
        ["y' R U R' U F' R U2 R' U2 R' F R", 6],
        ["y2 L' U R U' L U' R' U' R U' R'", 5],
      ],
    },
    {
      caseId: "COLL-Pi6",
      algs: [
        ["R' F' U' F U' R U S' R' U R S", 16],
        ["y' r U R' U R' F R F' R U' R' U R U2 r'", 14],
        ["R U D' R U R' D R2 U' R' U' R2 U2 R", 8],
        ["R2 D' R U R' D R U R U' R' U R U R' U R", 8],
      ],
    },
    {
      caseId: "COLL-H1",
      algs: [
        ["R U R' U R U' R' U R U2 R'", 24],
        ["y' R U2 R' U' R U R' U' R U' R'", 15],
        ["y R U2 R' U' R U R' U' R U' R'", 1],
        ["y' R' U2 R U R' U' R U R' U R", 1],
      ],
    },
    {
      caseId: "COLL-H2",
      algs: [
        ["F R U' R' U R U2 R' U' R U R' U' F'", 21],
        ["f R2 S' U' R2 U' R2 U R2 F'", 7],
        ["y2 f R U R' U' R F' R U R' U' R' S'", 1],
        ["f R U R' U' f' R U R' U' R' F R F'", 1],
      ],
    },
    {
      caseId: "COLL-H3",
      algs: [
        ["R U R' U R U L' U R' U' L", 11],
        ["R U R' U R U r' F R' F' r", 10],
        ["R' F' R U2 R U2 R' F U' R U' R'", 5],
        ["R U R2 D' R U2 R' D R U' R U2 R'", 4],
      ],
    },
    {
      caseId: "COLL-H4",
      algs: [
        ["y F R U R' U' R U R' U' R U R' U' F'", 16],
        ["y F U R U' R' U R U' R' U R U' R' F'", 11],
        ["U F R U R' U' R U R' U' R U R' U' F'", 1],
        ["y' F R U R' U' R U R' U' R U R' U' F'", 1],
      ],
    },
  ],
};
