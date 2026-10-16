// OLL algorithms, 57 cases. Sources, licences and commits: see the header of ll-data.ts.
//
// Per case: cubingapp OLL.json's algs in dataset order, then Cubedex's "OLL" alg unless it is the same alg up to an
// AUF. The first alg is the default and defines the case. Groups are OLL.json's subsets; nicknames are Cubedex's
// (four of them, for OLL 3, 4, 29 and 30, are left out as unsuitable for the app).
// src/cube/cases.test.ts checks every alg against its case.

import type { CaseData } from "./ll-data";

export const OLL_DATA: readonly CaseData[] = [
  {
    name: "1",
    group: "Dot",
    nickname: "Blank",
    algs: [
      "R U2 R2 F R F' U2 R' F R F'", // cubingapp
      "R U' R2 D' r U' r' D R2 U R'", // cubingapp
    ],
  },
  {
    name: "2",
    group: "Dot",
    nickname: "Zamboni",
    algs: [
      "(r U r') U2 (R U2 R') U2 (r U' r')", // cubingapp
      "R U' R2 D' r U r' D R2 U R'", // cubingapp
      "F R U R' U' S R U R' U' f'", // cubingapp
    ],
  },
  {
    name: "3",
    group: "Dot",
    algs: [
      "R' F2 R2 U2 R' F R U2 R2 F2 R", // cubingapp
      "f (R U R' U') f' U' F (R U R' U') F'", // cubingapp
      "r' R2 U R' U r U2 r' U M'", // cubingapp
    ],
  },
  {
    name: "4",
    group: "Dot",
    algs: [
      "R' F2 R2 U2 R' F' R U2 R2 F2 R", // cubingapp
      "f R U R' U' f' U F R U R' U' F'", // cubingapp
      "M U' r U2 r' U' R U' R' M'", // cubingapp
    ],
  },
  {
    name: "5",
    group: "Square",
    nickname: "Lefty Square",
    algs: [
      "r' U2 R U R' U r", // cubingapp
    ],
  },
  {
    name: "6",
    group: "Square",
    nickname: "Righty Square",
    algs: [
      "r U2 R' U' R U' r'", // cubingapp
    ],
  },
  {
    name: "7",
    group: "Lightning",
    nickname: "Lightning",
    algs: [
      "r U R' U R U2 r'", // cubingapp
    ],
  },
  {
    name: "8",
    group: "Lightning",
    nickname: "Reverse Lightning",
    algs: [
      "r' U' R U' R' U2 r", // cubingapp
    ],
  },
  {
    name: "9",
    group: "Fish",
    nickname: "Kite",
    algs: [
      "(R U R' U') R' F R2 U R' U' F'", // cubingapp
      "R U2 R' U' S' R U' R' S", // cubingapp
      "F' U' F r U' r' U r U r'", // cubingapp
    ],
  },
  {
    name: "10",
    group: "Fish",
    nickname: "Anti Kite",
    algs: [
      "R U R' U R' F R F' R U2 R'", // cubingapp
      "F U F' R' F R U' R' F' R", // cubingapp
    ],
  },
  {
    name: "11",
    group: "Lightning",
    nickname: "Downstairs",
    algs: [
      "S R U R' U R U2 R' U2 S'", // cubingapp
      "r' R2 U R' U R U2 R' U M'", // cubingapp
    ],
  },
  {
    name: "12",
    group: "Lightning",
    nickname: "Upstairs",
    algs: [
      "S R' U' R U' R' U2 R U2 S'", // cubingapp
      "r R2' U' R U' R' U2 R U' M", // cubingapp
      "F (R U R' U') F' U F (R U R' U') F'", // cubingapp
    ],
  },
  {
    name: "13",
    group: "Knight",
    nickname: "Gun",
    algs: [
      "F U R U' R2 F' R U R U' R'", // cubingapp
      "F U R U2 R' U' R U R' F'", // cubingapp
    ],
  },
  {
    name: "14",
    group: "Knight",
    nickname: "Anti Gun",
    algs: [
      "(R' F R) U (R' F' R) (F U' F')", // cubingapp
    ],
  },
  {
    name: "15",
    group: "Knight",
    nickname: "Squeegee",
    algs: [
      "l' U' l L' U' L U l' U l", // cubingapp
      "(R' F' R) (L' U' L) U (R' F R)", // Cubedex
    ],
  },
  {
    name: "16",
    group: "Knight",
    nickname: "Anti Squeegee",
    algs: [
      "r U r' R U R' U' r U' r'", // cubingapp
    ],
  },
  {
    name: "17",
    group: "Dot",
    nickname: "Slash",
    algs: [
      "F R' F' R U S' R U' R' S", // cubingapp
      "F R' F' R2 r' U R U' R' U' M'", // cubingapp
      "(R U R' U) (R' F R F') U2 (R' F R F')", // cubingapp
      "F' r U r' U' S r' F r S'", // cubingapp
    ],
  },
  {
    name: "18",
    group: "Dot",
    nickname: "Crown",
    algs: [
      "R U2 R2 F R F' U2 M' U R U' r'", // cubingapp
      "r U R' U R U2 r2 U' R U' R' U2 r", // cubingapp
    ],
  },
  {
    name: "19",
    group: "Dot",
    nickname: "Bunny",
    algs: [
      "S' R U R' S U' R' F R F'", // cubingapp
      "R' U2 F R U R' U' F2 U2 F R", // cubingapp
      "r U2 R' U' R U' r2 U2 R U R' U r", // cubingapp
      "M U (R U R' U') M' (R' F R F')", // Cubedex
    ],
  },
  {
    name: "20",
    group: "Dot",
    nickname: "X",
    algs: [
      "S R' U' R U R U R U' R' S'", // cubingapp
      "r U R' U' M2 U R U' R' U' M'", // cubingapp
      "M U (R U R' U') M2' (U R U' r')", // Cubedex
    ],
  },
  {
    name: "21",
    group: "Edges oriented",
    nickname: "H / Cross",
    algs: [
      "R U R' U R U' R' U R U2 R'", // cubingapp
      "R U2 R' U' R U R' U' R U' R'", // cubingapp
      "F (R U R' U') (R U R' U') (R U R' U') F'", // cubingapp
    ],
  },
  {
    name: "22",
    group: "Edges oriented",
    nickname: "Pi / Bruno",
    algs: [
      "R U2 R2 U' R2 U' R2 U2 R", // cubingapp
    ],
  },
  {
    name: "23",
    group: "Edges oriented",
    nickname: "U / Headlights",
    algs: [
      "R2 D R' U2 R D' R' U2 R'", // cubingapp
    ],
  },
  {
    name: "24",
    group: "Edges oriented",
    nickname: "T / Chameleon",
    algs: [
      "r U R' U' r' F R F'", // cubingapp
    ],
  },
  {
    name: "25",
    group: "Edges oriented",
    nickname: "L / Bowtie",
    algs: [
      "F' r U R' U' r' F R", // cubingapp
    ],
  },
  {
    name: "26",
    group: "Edges oriented",
    nickname: "Anti Sune",
    algs: [
      "R U2 R' U' R U' R'", // cubingapp
    ],
  },
  {
    name: "27",
    group: "Edges oriented",
    nickname: "Sune",
    algs: [
      "R U R' U R U2 R'", // cubingapp
    ],
  },
  {
    name: "28",
    group: "Corners oriented",
    nickname: "Arrow",
    algs: [
      "R' F R S R' F' R S'", // cubingapp
      "M' U' M U2 M' U' M", // cubingapp
      "r U R' U' M U R U' R'", // cubingapp
    ],
  },
  {
    name: "29",
    group: "Awkward",
    algs: [
      "r2 D' r U r' D r2 U' r' U' r", // cubingapp
      "S' (R U R' U') (R' F R F') U S", // Cubedex
    ],
  },
  {
    name: "30",
    group: "Awkward",
    algs: [
      "r' D' r U' r' D r2 U' r' U r U r'", // cubingapp
      "F R' F R2 U' R' U' R U R' F2", // cubingapp
      "F U R U2 R' U' R U2 R' U' F'", // cubingapp
    ],
  },
  {
    name: "31",
    group: "P shape",
    nickname: "Couch",
    algs: [
      "R' U' F U R U' R' F' R", // cubingapp
    ],
  },
  {
    name: "32",
    group: "P shape",
    nickname: "Anti Couch",
    algs: [
      "S R U R' U' R' F R f'", // cubingapp
      "L U F' U' L' U L F L'", // cubingapp
    ],
  },
  {
    name: "33",
    group: "T shape",
    nickname: "Key / Shoelaces",
    algs: [
      "(R U R' U') (R' F R F')", // cubingapp
    ],
  },
  {
    name: "34",
    group: "C shape",
    nickname: "City",
    algs: [
      "f R f' U' r' U' R U M'", // cubingapp
      "R U R2 U' R' F R U R U' F'", // cubingapp
      "F R U R' U' R' F' r U R U' r'", // cubingapp
      "(R U R' U') B' (R' F R F') B", // Cubedex
    ],
  },
  {
    name: "35",
    group: "Fish",
    nickname: "Fish Salad",
    algs: [
      "R U2 R2 F R F' R U2 R'", // cubingapp
      "(R U2' R') (R' F R F') (R U2' R')", // Cubedex
    ],
  },
  {
    name: "36",
    group: "W shape",
    nickname: "Warrio",
    algs: [
      "R U R' F' R U R' U' R' F R U' R' F R F'", // cubingapp
      "R' F' U' F2 U R U' R' F' R", // cubingapp
      "R U R2 F' U' F U R2 U2 R'", // cubingapp
      "(L' U' L U') (L' U L U) (L F' L' F)", // Cubedex
    ],
  },
  {
    name: "37",
    group: "Fish",
    nickname: "Mounted Fish",
    algs: [
      "F R U' R' U' R U R' F'", // cubingapp
      "F R' F' R U R U' R'", // cubingapp
    ],
  },
  {
    name: "38",
    group: "W shape",
    nickname: "Mario",
    algs: [
      "R U R' U R U' R' U' R' F R F'", // cubingapp
      "F R U' R' S U' R U R' f'", // cubingapp
    ],
  },
  {
    name: "39",
    group: "Lightning",
    nickname: "Lefty Big Lightning / Fung",
    algs: [
      "f' r U r' U' r' F r S", // cubingapp
      "L F' L' U' L U F U' L'", // cubingapp
      "R U R' F' U' F U R U2 R'", // cubingapp
    ],
  },
  {
    name: "40",
    group: "Lightning",
    nickname: "Big Lightning / Anti Fung",
    algs: [
      "R' F R U R' U' F' U R", // cubingapp
      "f R' F' R U R U' R' S'", // cubingapp
    ],
  },
  {
    name: "41",
    group: "Awkward",
    nickname: "Poodle",
    algs: [
      "R U R' U R U2 R' F R U R' U' F'", // cubingapp
      "F U R2 D R' U' R D' R2 F'", // cubingapp
    ],
  },
  {
    name: "42",
    group: "Awkward",
    nickname: "Anti Poodle",
    algs: [
      "R' U' R U' R' U2 R F R U R' U' F'", // cubingapp
      "F S' (R U R' U') F' U S", // Cubedex
    ],
  },
  {
    name: "43",
    group: "P shape",
    nickname: "Anti P",
    algs: [
      "R' U' F' U F R", // cubingapp
      "F' U' L' U L F", // cubingapp
      "f' (L' U' L U) f", // Cubedex
    ],
  },
  {
    name: "44",
    group: "P shape",
    nickname: "P",
    algs: [
      "F U R U' R' F'", // cubingapp
      "f (R U R' U') f'", // Cubedex
    ],
  },
  {
    name: "45",
    group: "T shape",
    nickname: "T / Suit Up",
    algs: [
      "F R U R' U' F'", // cubingapp
    ],
  },
  {
    name: "46",
    group: "C shape",
    nickname: "Seein' Headlights",
    algs: [
      "R' U' R' F R F' U R", // cubingapp
    ],
  },
  {
    name: "47",
    group: "L shape",
    nickname: "Anti Breakneck",
    algs: [
      "F' (L' U' L U) (L' U' L U) F", // cubingapp
    ],
  },
  {
    name: "48",
    group: "L shape",
    nickname: "Breakneck",
    algs: [
      "F (R U R' U') (R U R' U') F'", // cubingapp
      "f (U R U' R') (U R U' R') f'", // Cubedex
    ],
  },
  {
    name: "49",
    group: "L shape",
    nickname: "Back Squeezy",
    algs: [
      "r U' r2 U r2 U r2 U' r", // cubingapp
    ],
  },
  {
    name: "50",
    group: "L shape",
    nickname: "Front Squeezy",
    algs: [
      "r' U r2 U' r2 U' r2 U r'", // cubingapp
    ],
  },
  {
    name: "51",
    group: "Line",
    nickname: "Ant / Bottlecap",
    algs: [
      "F (U R U' R') (U R U' R') F'", // cubingapp
    ],
  },
  {
    name: "52",
    group: "Line",
    nickname: "Rice Cooker",
    algs: [
      "R' F' U' F U' R U R' U R", // cubingapp
    ],
  },
  {
    name: "53",
    group: "L shape",
    nickname: "Frying Pan",
    algs: [
      "r' U' R U' R' U R U' R' U2 r", // cubingapp
    ],
  },
  {
    name: "54",
    group: "L shape",
    nickname: "Anti Frying Pan",
    algs: [
      "r U R' U R U' R' U R U2 r'", // cubingapp
    ],
  },
  {
    name: "55",
    group: "Line",
    nickname: "Highway",
    algs: [
      "R' F U R U' R2 F' R2 U R' U' R", // cubingapp
      "R U2 R2 U' R U' R' U2 F R F'", // cubingapp
      "R' F R U R U' R2 F' R2 U' R' U R U R'", // cubingapp
      "F U' R2 D R' U2 R D' R2 U F'", // cubingapp
    ],
  },
  {
    name: "56",
    group: "Line",
    nickname: "Street Lights",
    algs: [
      "r U r' U R U' R' U R U' R' r U' r'", // cubingapp
      "F R U R' U' R F' r U R' U' r'", // cubingapp
      "F (R U R' U') F' (r U R' U') (r' F R) F'", // Cubedex
    ],
  },
  {
    name: "57",
    group: "Corners oriented",
    nickname: "H",
    algs: [
      "S R' F R S' R' F' R", // cubingapp
      "R U R' U' M' U R U' r'", // cubingapp
    ],
  },
];
