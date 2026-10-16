// PLL algorithms, 21 cases. Sources, licences and commits: see the header of ll-data.ts.
//
// Per case: cubingapp PLL.json's algs in dataset order, then Cubedex's "PLL" alg unless it is the same alg up to an
// AUF. The first alg is the default and defines the case (case state = its inverse applied to a solved cube).
// Group names follow PLL.json's subsets ("Adj corners" → "Adjacent corners", "G perm" → "G perms", ...).
// src/cube/cases.test.ts checks every alg against its case.

import type { CaseData } from "./ll-data";

export const PLL_DATA: readonly CaseData[] = [
  {
    name: "Aa",
    group: "Adjacent corners",
    algs: [
      "x (R' U R') D2 (R U' R') D2 R2 x'", // cubingapp
      "(R U R' F') (r U R' U') r' F R2 U' R'", // Nathan's: the Jb perm's shape with a wide r (its mirror does Ab)
    ],
  },
  {
    name: "Ab",
    group: "Adjacent corners",
    algs: [
      "x R2' D2 (R U R') D2 (R U' R) x'", // cubingapp
    ],
  },
  {
    name: "E",
    group: "Diagonal corners",
    algs: [
      "x' (R U' R' D) (R U R' D') (R U R' D) (R U' R' D') x", // cubingapp
      "R' U' R' D' R U' R' D R U R' D' R U R' D R2", // cubingapp
    ],
  },
  {
    name: "F",
    group: "Adjacent corners",
    algs: [
      "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", // cubingapp
    ],
  },
  {
    name: "Ga",
    group: "G perms",
    algs: [
      "R2 U R' U R' U' R U' R2 D U' R' U R D'", // cubingapp
    ],
  },
  {
    name: "Gb",
    group: "G perms",
    algs: [
      "R' U' R U D' R2 U R' U R U' R U' R2 D", // cubingapp
    ],
  },
  {
    name: "Gc",
    group: "G perms",
    algs: [
      "R2 F2 R U2 R U2 R' F R U R' U' R' F R2", // cubingapp
      "R2 U' R U' R U R' U R2 D' U R U' R' D", // cubingapp
      "(R2' U' R U') (R U R' U) (R2 U D') (R U' R' D)", // Cubedex; "+" joins written as spaces
    ],
  },
  {
    name: "Gd",
    group: "G perms",
    algs: [
      "R U R' U' D R2 U' R U' R' U R' U R2 D'", // cubingapp
    ],
  },
  {
    name: "H",
    group: "Edge perms",
    algs: [
      "M2 U' M2 U2 M2 U' M2", // cubingapp
    ],
  },
  {
    name: "Ja",
    group: "Adjacent corners",
    algs: [
      "x R2 F R F' R U2 r' U r U2 x'", // cubingapp
      "L' U' L F L' U' L U L F' L2 U L", // cubingapp
      "R' U L' U2 R U' R' U2 R L", // cubingapp
      "R' U2 R U R' U2 L U' R U L'", // cubingapp
    ],
  },
  {
    name: "Jb",
    group: "Adjacent corners",
    algs: [
      "(R U R' F') (R U R' U') R' F R2 U' R' U'", // cubingapp
    ],
  },
  {
    name: "Na",
    group: "Diagonal corners",
    algs: [
      "(R U R' U) (R U R' F' R U R' U' R' F R2 U' R') (U2 R U' R')", // cubingapp
      "F' R U R' U' R' F R2 F U' R' U' R U F' R'", // cubingapp
      "R F U' R' U R U F' R2 F' R U R U' R' F", // cubingapp
      "r' D r U2 r' D r U2 r' D r U2 r' D r U2 r' D r", // cubingapp
    ],
  },
  {
    name: "Nb",
    group: "Diagonal corners",
    algs: [
      "r' D' F r U' r' F' D r2 U r' U' r' F r F'", // cubingapp
      "R' U R U' R' F' U' F R U R' F R' F' R U' R", // cubingapp
      "R' U L' U2 R U' L R' U L' U2 R U' L", // cubingapp
    ],
  },
  {
    name: "Ra",
    group: "Adjacent corners",
    algs: [
      "(R U' R' U') R U (R D R') U' (R D' R') U2 R' U'", // cubingapp
      "R U R' F' R U2 R' U2 R' F R U R U2 R'", // cubingapp
    ],
  },
  {
    name: "Rb",
    group: "Adjacent corners",
    algs: [
      "(R' U2 R U2) R' F (R U R' U') R' F' R2", // cubingapp
      "R2' F R (U R U' R') F' (R U2' R') U2 R", // Cubedex
    ],
  },
  {
    name: "T",
    group: "Adjacent corners",
    algs: [
      "(R U R' U') R' F R2 U' R' U' (R U R' F')", // cubingapp
    ],
  },
  {
    name: "Ua",
    group: "Edge perms",
    algs: [
      "M2 U M U2 M' U M2", // cubingapp
      "R U' R U R U R U' R' U' R2", // cubingapp
      "R U R' U R' U' R2 U' R' U R' U R", // cubingapp
    ],
  },
  {
    name: "Ub",
    group: "Edge perms",
    algs: [
      "M2 U' M U2 M' U' M2", // cubingapp
      "R2' U R U R' U' R3 U' R' U R'", // cubingapp
      "R' U R' U' R' U' R' U R U R2", // cubingapp
    ],
  },
  {
    name: "V",
    group: "Diagonal corners",
    algs: [
      "(R' U R' U') (R D' R' D) R' U D' R2 U' R2 D R2", // cubingapp
      "R' U R' U' y R' F' R2 U' R' U R' F R F", // cubingapp
      "(R' U R U' R') f' U' (R U2) (R' U' R U' R') f R", // Cubedex
    ],
  },
  {
    name: "Y",
    group: "Diagonal corners",
    algs: [
      "F (R U' R' U') (R U R' F') (R U R' U') (R' F R F')", // cubingapp
      "F R' F R2 U' R' U' R U R' F' R U R' U' F'", // cubingapp
    ],
  },
  {
    name: "Z",
    group: "Edge perms",
    algs: [
      "M2 U' M2 U' M' U2 M2 U2 M' U2", // cubingapp
      "M' U' M2 U' M2 U' M' U2 M2", // cubingapp
    ],
  },
];
