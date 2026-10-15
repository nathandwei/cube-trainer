// Last-layer algorithms, copied verbatim (first listed alg per case unless noted) from two MIT-licensed datasets:
//
// - cubingapp by Spencer Chubb, MIT License, Copyright (c) 2024 Spencer Chubb
//   https://github.com/spencerchubb/cubingapp (commit 613a49885dc618023368e5f0c2a25024b8c7e9a5)
//   tanstack/src/routes/algorithms/algs/COLL.json, PLL.json and 2-Look-OLL.json
// - Cubedex by Pau Oliva Fora, MIT License, Copyright (c) 2024 Pau Oliva Fora
//   https://github.com/poliva/cubedex (commit e5849e2c0e58df681a707a7b7c8fc30a43405d3b)
//   src/data/defaultAlgs.json ("2-Look OLL" → "Dot", which cubingapp does not list as an edges-only case)
//
// Case names follow the datasets with the space dropped ("T 3" → "T3"). The two COLL cases where the corners are
// already oriented and only need swapping ("O-adj", "O-diag") are not in COLL.json, so they use cubingapp's
// T perm and Y perm, which fix corner permutation while keeping edges oriented.
// src/cube/ll.test.ts verifies every alg against the case it is filed under.

export type AlgEntry = { name: string; alg: string; subset?: string };

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
