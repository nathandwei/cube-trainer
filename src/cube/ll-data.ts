// Algorithms for every case set (this file: EO, COLL and EPLL; pll-data.ts, oll-data.ts and f2l-data.ts: the rest),
// copied verbatim from two MIT-licensed datasets:
//
// - cubingapp by Spencer Chubb, MIT License, Copyright (c) 2024 Spencer Chubb
//   https://github.com/spencerchubb/cubingapp (commit 613a49885dc618023368e5f0c2a25024b8c7e9a5)
//   tanstack/src/routes/algorithms/algs/COLL.json, PLL.json, OLL.json, F2L.json and 2-Look-OLL.json
// - Cubedex by Pau Oliva Fora, MIT License, Copyright (c) 2024 Pau Oliva Fora
//   https://github.com/poliva/cubedex (commit e5849e2c0e58df681a707a7b7c8fc30a43405d3b)
//   src/data/defaultAlgs.json: "PLL", "OLL" (algs and nicknames), "F2L" ("Front Right" algs) and "2-Look OLL"
//   ("Dot" here, which cubingapp does not list as an edges-only case, and "Hook")
//
// Their full licence texts are in ALG-DATA-LICENSES.txt.
//
// The only edit: Cubedex writes simultaneous turns with "+" ("D+U'"); those are written as two moves ("D U'").
// Algs that are the same up to a leading or trailing U turn are listed once.
//
// Case names follow the datasets with the space dropped ("T 3" → "T3"). The two COLL cases where the corners are
// already oriented and only need swapping ("O-adj", "O-diag") are not in COLL.json, so they use cubingapp's
// T perm and Y perm, which fix corner permutation while keeping edges oriented, with PLL.json's J perms and V perm
// as alternatives. src/cube/ll.test.ts and src/cube/cases.test.ts verify every alg against the case it is filed
// under.

export type AlgEntry = { name: string; alg: string; subset?: string };

/** One case of a set in the catalog data: algs[0] is the default and defines the case. */
export type CaseData = { name: string; group: string; nickname?: string; algs: readonly string[] };

export const EO_ALGS: readonly AlgEntry[] = [
  { name: "line", alg: "F (R U R' U') F'" }, // cubingapp 2-Look-OLL "Bar"
  { name: "L", alg: "F (U R U' R') F'" }, // cubingapp 2-Look-OLL "L shape"
  { name: "dot", alg: "F (R U R' U') F'  f (R U R' U') f'" }, // Cubedex 2-Look OLL "Dot"
];

export const COLL_ALGS: readonly AlgEntry[] = [
  { name: "AS1", subset: "Antisune", alg: "R' U' R U' R' U2 R" },
  { name: "AS2", subset: "Antisune", alg: "U R' U' R U' R' U R' D' R U R' D R2" },
  { name: "AS3", subset: "Antisune", alg: "U2 R2 D R' U2 R D' R2 U' R U' R'" },
  { name: "AS4", subset: "Antisune", alg: "U2 R' U' R U' R2 D' R U2 R' D R2" },
  { name: "AS5", subset: "Antisune", alg: "U2 r' F R F' r U R'" },
  { name: "AS6", subset: "Antisune", alg: "R U R' F' R U2 R' U' R U' R' F R U' R'" },
  { name: "S1", subset: "Sune", alg: "R U R' U R U2 R'" },
  { name: "S2", subset: "Sune", alg: "U2 R U R' U R2 D R' U2 R D' R2" },
  { name: "S3", subset: "Sune", alg: "L' R U R' U' L U2 R U2 R'" },
  { name: "S4", subset: "Sune", alg: "U' R U R' U R U' R D R' U' R D' R2" },
  { name: "S5", subset: "Sune", alg: "R U' L' U R' U' L" },
  { name: "S6", subset: "Sune", alg: "U2 R U R' F' R U R' U R U2 R' F R U' R'" },
  { name: "L1", subset: "L", alg: "U' R U R' U R U' R' U R U' R' U R U2 R'" },
  { name: "L2", subset: "L", alg: "R' U2 R' D' R U2 R' D R2" },
  { name: "L3", subset: "L", alg: "U R U2 R D R' U2 R D' R2" },
  { name: "L4", subset: "L", alg: "U F R' F' r U R U' r'" },
  { name: "L5", subset: "L", alg: "U2 F' r U R' U' r' F R" },
  { name: "L6", subset: "L", alg: "U r U2 R2 F R F' R U2 r'" },
  { name: "U1", subset: "U", alg: "R' U' R U' R' U2 R2 U R' U R U2 R'" },
  { name: "U2", subset: "U", alg: "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R" },
  { name: "U3", subset: "U", alg: "U2 R2 D R' U2 R D' R' U2 R'" },
  { name: "U4", subset: "U", alg: "F R U' R' U R U R' U R U' R' F'" },
  { name: "U5", subset: "U", alg: "R2 D' R U2 R' D R U2 R" },
  { name: "U6", subset: "U", alg: "R2 D' R U R' D R U R U' R' U' R" },
  { name: "T1", subset: "T", alg: "R U2 R' U' R U' R2 U2 R U R' U R" },
  { name: "T2", subset: "T", alg: "R' U R U2 R' L' U R U' L" },
  { name: "T3", subset: "T", alg: "U R' F' r U R U' r' F" },
  { name: "T4", subset: "T", alg: "U2 F R U R' U' R U' R' U' R U R' F'" },
  { name: "T5", subset: "T", alg: "U' r U R' U' r' F R F'" },
  { name: "T6", subset: "T", alg: "R' U R2 D r' U2 r D' R2 U' R" },
  { name: "Pi1", subset: "Pi", alg: "R' U2 R2 U R2 U R2 U2 R'" },
  { name: "Pi2", subset: "Pi", alg: "U F U R U' R' U R U' R2 F' R U R U' R'" },
  { name: "Pi3", subset: "Pi", alg: "R' U' F' R U R' U' R' F R2 U2 R' U2 R" },
  { name: "Pi4", subset: "Pi", alg: "R U R' U' R' F R2 U R' U' R U R' U' F'" },
  { name: "Pi5", subset: "Pi", alg: "U' R U R' U F' R U2 R' U2 R' F R" },
  { name: "Pi6", subset: "Pi", alg: "U' r U R' U R' F R F' R U' R' U R U2 r'" },
  { name: "H1", subset: "H", alg: "R U R' U R U' R' U R U2 R'" },
  { name: "H2", subset: "H", alg: "F R U' R' U R U2 R' U' R U R' U' F'" },
  { name: "H3", subset: "H", alg: "R U R' U R U L' U R' U' L" },
  { name: "H4", subset: "H", alg: "U F R U R' U' R U R' U' R U R' U' F'" },
  { name: "O-adj", subset: "O", alg: "(R U R' U') R' F R2 U' R' U' (R U R' F')" }, // cubingapp PLL "T perm"
  { name: "O-diag", subset: "O", alg: "F (R U' R' U') (R U R' F') (R U R' U') (R' F R F')" }, // cubingapp PLL "Y perm"
];

/**
 * Further algs per COLL case, after its default in COLL_ALGS: the rest of COLL.json's list for that case in dataset
 * order (several solve it from another angle or are mirrors with L turns). O-adj and O-diag borrow PLL.json algs.
 */
export const COLL_ALTERNATIVES: Readonly<Record<string, readonly string[]>> = {
  AS1: [
    "U R U2 R' U' R U' R'", // cubingapp
    "U2 L' U' L U' L' U2 L", // cubingapp
    "U' L U2 L' U' L U' L'", // cubingapp
  ],
  AS2: [
    "U2 R2 D R' U R D' R' U R' U' R U' R'", // cubingapp
    "U2 R' F U2 F' R F R' U2 R F'", // cubingapp
  ],
  AS3: [
    "R' U' F' R U R' U' R' F R2 U' R' U R", // cubingapp
    "U2 f' L F L' U2 L' U2 L U2 S", // cubingapp
  ],
  AS4: [
    "U2 R U2 R' U2 r' F R F' M'", // cubingapp
    "R' U' R U R' F R U R' U' R' F' R2", // cubingapp
    "U2 R U2 R' U2 L' U R U' R' L", // cubingapp
  ],
  AS5: [
    "U2 L' U R U' L U R'", // cubingapp
    "R' U L U' R U L'", // cubingapp
  ],
  AS6: [
    "R U2 r' F R' F' r U' R U' R'", // cubingapp
    "R U' R' U2 R U' R' U2 R' D' R U R' D R", // cubingapp
    "U2 L U2 R' U L' U' R U' L U' L'", // cubingapp
  ],
  S1: [
    "U' R' U2 R U R' U R", // cubingapp
    "U2 L U L' U L U2 L'", // cubingapp
    "U L' U2 L U L' U L", // cubingapp
  ],
  S2: [
    "r' F2 r U2 R U' r' F M'", // cubingapp
    "L' U2 L U2 R U' L' U L R'", // cubingapp
    "L' U2 L U2 l F' L' F M'", // cubingapp
  ],
  S3: [
    "U2 R2 D' R U2 R' D R2 U R' U R", // cubingapp
    "f R' F' R U2 R U2 R' U2 S'", // cubingapp
    "M F R' F' r U2 R U2 R'", // cubingapp
  ],
  S4: [
    "U' F R' U2 R F' R' F U2 F' R", // cubingapp
    "R U R' U' R' F R F' r U R' U R U2 r'", // cubingapp
    "r U R' U' r' F R F' R U R' U R U2 R'", // cubingapp
  ],
  S5: [
    "R U' r' F R' F' r", // cubingapp
    "U2 L U' R' U L' U' R", // cubingapp
    "z D R' U' R D' R' U R z'", // cubingapp
  ],
  S6: [
    "U2 R U R' U r' F R F' r U2 R'", // cubingapp
    "F R U' R2 U2 R U R' U R2 U R' F'", // cubingapp
    "F' R U2 R' U2 R' F2 R U R U' R' F'", // cubingapp
  ],
  L1: [
    "U' R U2 R' U' R U R' U' R U R' U' R U' R'", // cubingapp
    "U2 R' U2 R U R' U' R U R' U' R U R' U R", // cubingapp
    "R' U' R U' R' U2 R U' R U R' U R U2 R'", // cubingapp
  ],
  L2: [
    "U2 L' U2 L' D' L U2 L' D L2", // cubingapp
    "U' R' U2 R U R2 D' R U R' D R2", // cubingapp
    "U' r D r' U r D' r' U y R U2 R'", // cubingapp
  ],
  L3: [
    "U2 R U2 R2 D' R U' R' D R2 U' R'", // cubingapp
    "R' F' R U R' U' R' F R2 U' R' U2 R", // cubingapp
    "R' D' r U2 r' D R U2 R U R'", // cubingapp
  ],
  L4: [
    "U2 R2 D R' U R D' R' U' R'", // cubingapp
    "R U R' U' R' F R U R U' R' F'", // cubingapp
    "x' R U' R' D R U R' D' x", // cubingapp
  ],
  L5: [
    "U x R' U R D' R' U' R D x'", // cubingapp
    "U' R2 D' R U' R' D R U R", // cubingapp
    "U' F R U' R' U' R U2 R' U' F'", // cubingapp
  ],
  L6: [
    "U' R' U' R U R' F' R U R' U' R' F R2", // cubingapp
    "U' R' U' R U' F U' R' U' R U F'", // cubingapp
    "U F R U R2 F R F' R U' R' F'", // cubingapp
  ],
  U1: [
    "U2 R U R' U R U2 R2 U' R U' R' U2 R", // cubingapp
    "U' R U R' U' R U' R' U2 R U' R' U2 R U R'", // cubingapp
    "U2 R U R' U R U2 R' U R U2 R' U' R U' R'", // cubingapp
  ],
  U2: [
    "U F U R U2 R' U R U R2 F' r U R U' r'", // cubingapp
    "U' R' U' R F R2 D' R U R' D R2 U' F'", // cubingapp
    "U' r U R' U' r' F R U R' U' R F' R' U R", // cubingapp
  ],
  U3: [
    "R' U R U R' F' R U R' U' R' F R2 U' R' U' R", // cubingapp
    "R U' R' U' R U2 R' U' R' D' R U2 R' D R", // cubingapp
    "R' U' R U' R' U2 R2 U' L' U R' U' L", // cubingapp
  ],
  U4: [
    "U2 R' F2 R U2 R U2 R' F2 R U2 R'", // cubingapp
    "U2 R U2 R' U2 L' U2 R U2 R' U2 L", // cubingapp
    "U' F U2 R' D' R U2 R' D R F'", // cubingapp
  ],
  U5: [
    "R2 F' R U R' U' R' F R' U' R2 U2 R2 U R' U R", // cubingapp
    "U2 L2 D' L U2 L' D L U2 L", // cubingapp
    "L U' R U' L' U R' U2 L U' L'", // cubingapp
  ],
  U6: [
    "R' U2 R F U' R' U' R U F'", // cubingapp
    "R U' R' U' R U R D R' U R D' R2", // cubingapp
    "R' U2 R U2 R' F' R U R' U' R' F R2", // cubingapp
  ],
  T1: [
    "U' R U R' U R U2 R' L' U' L U' L' U2 L", // cubingapp
    "U' R U R2 U' R2 U' R2 U2 R U' R U' R'", // cubingapp
    "R U2 R' r' F2 r U' R U' R' U' r' F r", // cubingapp
  ],
  T2: [
    "R' U2 R U R2 F R U R U' R' F' R", // cubingapp
    "U2 R' F R U R' U' R' F' R2 U' R' U2 R", // cubingapp
    "U2 R U' R' U2 L R U' R' U L'", // cubingapp
  ],
  T3: [
    "U l' U' L U R U' r' F", // cubingapp
    "U2 R' U' R' D' R U R' D R2", // cubingapp
    "U2 x' R U R' D R U' R' D' x", // cubingapp
  ],
  T4: [
    "U2 F R' D' R U2 R' D R U2 F'", // cubingapp
    "U R U2 R' F2 R U2 R' U2 R' F2 R", // cubingapp
    "U' L' U2 R U2 R' U2 L U2 R U2 R'", // cubingapp
  ],
  T5: [
    "R U R D R' U' R D' R2", // cubingapp
    "U' R U R' U' L' U R U' R' L", // cubingapp
    "R' F' R U R' U' R' F R U R", // cubingapp
  ],
  T6: [
    "U2 R U' R2 D' r U2 r' D R2 U R'", // cubingapp
    "U R' U' R U R2 D' R U2 R' D R2 U' R' U R", // cubingapp
    "U R U R' U' R2 D R' U2 R D' R2 U R U' R'", // cubingapp
  ],
  Pi1: [
    "U2 L' U2 L2 U L2 U L2 U2 L'", // cubingapp
    "R U2 R2 U' R2 U' R2 U2 R", // cubingapp
    "R U R' U R U2 R' U' R U R' U R U2 R'", // cubingapp
  ],
  Pi2: [
    "R' F2 R U2 R U2 R' F2 U' R U' R'", // cubingapp
    "U2 L' U' L U L F' L2 U' L U L' U' L U F", // cubingapp
    "U M F R' F' r U2 R U' R' U R U2 R'", // cubingapp
  ],
  Pi3: [
    "U F U R U' R' U R U2 R' U' R U R' F'", // cubingapp
    "U F R2 U' R2 U R2 U S R2 f'", // cubingapp
    "U' R U R' U R U2 R2 F' r U R U' r' F", // cubingapp
  ],
  Pi4: [
    "R U2 R' U' R U R' U2 r' F R F' M'", // cubingapp
    "U' R' U2 R U R' U R2 U' L' U R' U' L", // cubingapp
    "U2 L F2 L' U2 L' U2 L F2 U L' U L", // cubingapp
  ],
  Pi5: [
    "U' R U2 R' U R' D' R U2 R' D R2 U' R'", // cubingapp
    "R U' L' U R' U L U L' U L", // cubingapp
    "U2 L' U R U' L U' R' U' R U' R'", // cubingapp
  ],
  Pi6: [
    "R' F' U' F U' R U S' R' U R S", // cubingapp
    "R2 D' R U R' D R U R U' R' U R U R' U R", // cubingapp
    "R U2 R2 F R F' R' F R F' R' F R F' R U2 R'", // cubingapp
  ],
  H1: [
    "U' R U2 R' U' R U R' U' R U' R'", // cubingapp
    "U' R' U2 R U R' U' R U R' U R", // cubingapp
  ],
  H2: [
    "f R2 S' U' R2 U' R2 U R2 F'", // cubingapp
    "U2 f R U R' U' R F' R U R' U' R' S'", // cubingapp
    "f R U R' U' f' R U R' U' R' F R F'", // cubingapp
  ],
  H3: [
    "R' F' R U2 R U2 R' F U' R U' R'", // cubingapp
    "R U R' U R U r' F R' F' r", // cubingapp
    "R U R2 D' R U2 R' D R U' R U2 R'", // cubingapp
  ],
  H4: [
    "U F U R U' R' U R U' R' U R U' R' F'", // cubingapp
    "U R' F2 R2 U2 R' F2 R U2 R2 F2 R", // cubingapp
  ],
  "O-adj": [
    "x R2 F R F' R U2 r' U r U2 x'", // cubingapp PLL "Ja perm"
    "(R U R' F') (R U R' U') R' F R2 U' R' U'", // cubingapp PLL "Jb perm"
  ],
  "O-diag": [
    "(R' U R' U') (R D' R' D) R' U D' R2 U' R2 D R2", // cubingapp PLL "V perm"
  ],
};

/** Further algs per EO case, after its default in EO_ALGS. */
export const EO_ALTERNATIVES: Readonly<Record<string, readonly string[]>> = {
  L: [
    "f (R U R' U') f'", // Cubedex 2-Look OLL Hook
  ],
};

export const EPLL_ALGS: readonly AlgEntry[] = [
  { name: "Ua", alg: "M2 U M U2 M' U M2" },
  { name: "Ub", alg: "M2 U' M U2 M' U' M2" },
  { name: "H", alg: "M2 U' M2 U2 M2 U' M2" },
  { name: "Z", alg: "M2 U' M2 U' M' U2 M2 U2 M' U2" },
];

/**
 * Reference algs used only by the tests to check case names: the corner-orientation algs from cubingapp's
 * 2-Look-OLL.json define what each COLL subset looks like, and PLL.json's second Ua/Ub algs (the R-U forms)
 * pin down which 3-cycle direction each U perm name means.
 */
export const OCLL_REFERENCE: Readonly<Record<string, string>> = {
  Sune: "R U R' U R U2 R'",
  Antisune: "R U2 R' U' R U' R'",
  H: "U R U R' U R U' R' U R U2 R'",
  Pi: "R U2 R2' U' R2 U' R2' U2' R",
  U: "R2 D' R U2 R' D R U2 R",
  T: "r U R' U' r' F R F'",
  L: "F R' F' r U R U' r'",
};

export const EPLL_REFERENCE: Readonly<Record<string, string>> = {
  Ua: "R U' R U R U R U' R' U' R2",
  Ub: "R2' U R U R' U' R3 U' R' U R'",
};
