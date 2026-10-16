// F2L algorithms for the front-right slot, 41 cases. Sources, licences and commits: see the header of ll-data.ts.
//
// Both datasets list one alg per slot (front-right, front-left, back-right, back-left) for each case. Only algs that
// solve the case in the front-right slot are kept: cubingapp F2L.json's first, then Cubedex's "Front Right" alg
// unless it is the same alg up to an AUF, so each case has one or two. The first alg is the default and defines
// the case. Groups are F2L.json's subsets. src/cube/cases.test.ts checks every alg against its case.

import type { CaseData } from "./ll-data";

export const F2L_DATA: readonly CaseData[] = [
  {
    name: "1",
    group: "Basic insert",
    algs: [
      "U R U' R'", // cubingapp
    ],
  },
  {
    name: "2",
    group: "Basic insert",
    algs: [
      "F R' F' R", // cubingapp
    ],
  },
  {
    name: "3",
    group: "Basic insert",
    algs: [
      "F' U' F", // cubingapp
    ],
  },
  {
    name: "4",
    group: "Basic insert",
    algs: [
      "R U R'", // cubingapp
    ],
  },
  {
    name: "5",
    group: "Split",
    algs: [
      "U' R U R' U2 R U' R'", // cubingapp
    ],
  },
  {
    name: "6",
    group: "Split",
    algs: [
      "U' r U' R' U R U r'", // cubingapp
      "y' U R' U' R U R' U2 R (y)", // Cubedex Front Right
    ],
  },
  {
    name: "7",
    group: "Split",
    algs: [
      "U' R U2 R' U' R U2 R'", // cubingapp
      "U' R U2 R' U2 R U' R'", // Cubedex Front Right
    ],
  },
  {
    name: "8",
    group: "Split",
    algs: [
      "y' R' U2 R U R' U2 R y", // cubingapp
      "y' U R' U2 R U R' U2 R (y)", // Cubedex Front Right
    ],
  },
  {
    name: "9",
    group: "Split",
    algs: [
      "U' R U' R' U F' U' F", // cubingapp
    ],
  },
  {
    name: "10",
    group: "Split",
    algs: [
      "U' R U R' U R U R'", // cubingapp
    ],
  },
  {
    name: "11",
    group: "Connected",
    algs: [
      "U' R U2 R' U F' U' F", // cubingapp
    ],
  },
  {
    name: "12",
    group: "Connected",
    algs: [
      "R U' R' U R U' R' U2 R U' R'", // cubingapp
      "R' U2 R2 U R2 U R", // Cubedex Front Right
    ],
  },
  {
    name: "13",
    group: "Connected",
    algs: [
      "y' U R' U R U' R' U' R y", // cubingapp
    ],
  },
  {
    name: "14",
    group: "Connected",
    algs: [
      "U' R U' R' U R U R'", // cubingapp
    ],
  },
  {
    name: "15",
    group: "Connected",
    algs: [
      "R U R' U2 R U' R' U R U' R'", // cubingapp
      "U R' F R F' U R U R'", // Cubedex Front Right
    ],
  },
  {
    name: "16",
    group: "Connected",
    algs: [
      "R U' R' U2 F' U' F", // cubingapp
    ],
  },
  {
    name: "17",
    group: "Connected",
    algs: [
      "R U2 R' U' R U R'", // cubingapp
    ],
  },
  {
    name: "18",
    group: "Connected",
    algs: [
      "y' R' U2 R U R' U' R y", // cubingapp
    ],
  },
  {
    name: "19",
    group: "Split",
    algs: [
      "U R U2 R' U R U' R'", // cubingapp
    ],
  },
  {
    name: "20",
    group: "Split",
    algs: [
      "U' R U' R2 F R F' R U' R'", // cubingapp
    ],
  },
  {
    name: "21",
    group: "Split",
    algs: [
      "U R U R' U R U' R'", // cubingapp
      "R U' R' U2 R U R'", // Cubedex Front Right
    ],
  },
  {
    name: "22",
    group: "Split",
    algs: [
      "r U' r' U2 r U r'", // cubingapp
      "y' U2 R' U' R U' R' U R (y)", // Cubedex Front Right
    ],
  },
  {
    name: "23",
    group: "Connected",
    algs: [
      "U R U' R' U' R U' R' U R U' R'", // cubingapp
    ],
  },
  {
    name: "24",
    group: "Connected",
    algs: [
      "U' R U R2 F R F' R U' R'", // cubingapp
      "U F' L' U L F R U R'", // Cubedex Front Right
    ],
  },
  {
    name: "25",
    group: "Corner in slot",
    algs: [
      "U' R' F R F' R U R'", // cubingapp
    ],
  },
  {
    name: "26",
    group: "Corner in slot",
    algs: [
      "U R U' R' F R' F' R", // cubingapp
    ],
  },
  {
    name: "27",
    group: "Corner in slot",
    algs: [
      "R U' R' U R U' R'", // cubingapp
    ],
  },
  {
    name: "28",
    group: "Corner in slot",
    algs: [
      "R U R' U' F R' F' R", // cubingapp
    ],
  },
  {
    name: "29",
    group: "Corner in slot",
    algs: [
      "R' F R F' U R U' R'", // cubingapp
    ],
  },
  {
    name: "30",
    group: "Corner in slot",
    algs: [
      "R U R' U' R U R'", // cubingapp
    ],
  },
  {
    name: "31",
    group: "Edge in slot",
    algs: [
      "U' R' F R F' R U' R'", // cubingapp
    ],
  },
  {
    name: "32",
    group: "Edge in slot",
    algs: [
      "U R U' R' U R U' R' U R U' R'", // cubingapp
    ],
  },
  {
    name: "33",
    group: "Edge in slot",
    algs: [
      "U' R U' R' U2 R U' R'", // cubingapp
    ],
  },
  {
    name: "34",
    group: "Edge in slot",
    algs: [
      "U R U R' U2 R U R'", // cubingapp
    ],
  },
  {
    name: "35",
    group: "Edge in slot",
    algs: [
      "U' R U R' U F' U' F", // cubingapp
    ],
  },
  {
    name: "36",
    group: "Edge in slot",
    algs: [
      "U F' U' F U' R U R'", // cubingapp
      "U2 R' F R F' U2 R U R'", // Cubedex Front Right
    ],
  },
  {
    name: "37",
    group: "Both in slot",
    algs: [
      "R2 U2 F R2 F' U2 R' U R'", // cubingapp
    ],
  },
  {
    name: "38",
    group: "Both in slot",
    algs: [
      "R U' R' U' R U R' U2 R U' R'", // cubingapp
    ],
  },
  {
    name: "39",
    group: "Both in slot",
    algs: [
      "R U' R' U R U2 R' U R U' R'", // cubingapp
    ],
  },
  {
    name: "40",
    group: "Both in slot",
    algs: [
      "r U' r' U2 r U r' R U R'", // cubingapp
      "R U R' F' L' U L F R U R'", // Cubedex Front Right
    ],
  },
  {
    name: "41",
    group: "Both in slot",
    algs: [
      "R U' R' r U' r' U2 r U r'", // cubingapp
    ],
  },
];
