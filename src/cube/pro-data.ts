// What top solvers use now: for each case where it differs from J Perm's 2019 pick (jperm.net has not changed since
// September 2019), the alg most used in reconstructed solves of top solvers in 2023–2026, per SpeedcubeQuest's
// pro-usage rankings (https://speedcube.quest/algorithms/3x3/pll and /oll, data 2026-08-15 to 2026-08-27, built on
// reco.nz and cubesolv.es reconstructions) and reco.nz's 2021-present totals (https://reco.nz/algs/pll, /algs/oll).
// Retrieved 2026-10-16. Algs are written as the sources write them; each is filed under the catalog case it solves,
// checked by popular.test.ts. Shares are the 2023–26 share of reconstructed solves of the case. Where J Perm's first
// alg is already the pros' pick (F, Ga, Gd, H, Jb, Na, Ra, T, Y, Z and most OLLs) nothing is listed. COLL is left
// out: the pros mostly do ZBLL, so the samples are too small to mean much.

/** Catalog case id → the alg top solvers use most now. */
export const PRO_ALGS: Readonly<Record<string, string>> = {
  "PLL-Ua": "R U R' U R' U' R2 U' R' U R' U R", // 58%
  "PLL-Ub": "R' U R' U' R' U' R' U R U R2", // 42% (R2' U R U R' U' R3 U' R' U R' 40%)
  "PLL-Ja": "L' U' L F L' U' L U L F' L2 U L", // 68%
  "PLL-Rb": "R' U2 R U2 R' F R U R' U' R' F' R2", // 67%
  "PLL-Gb": "F' U' F R2 u R' U R U' R u' R2", // 41%, steady
  "PLL-Gc": "R2 F2 R U2 R U2 R' F R U R' U' R' F R2", // 68%
  "PLL-E": "R' U' R' D' R U' R' D R U R' D' R U R' D R2", // rotationless; ahead on SpeedcubeQuest, x' version on reco.nz
  "PLL-Aa": "x R' U R' D2 R U' R' D2 R2 x'", // 72%
  "PLL-Ab": "x R2 D2 R U R' D2 R U' R x'", // 69%
  "PLL-Nb": "r' D' F r U' r' F' D r2 U r' U' r' F r F'", // 33%, no clear leader
  "PLL-V": "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2", // 49%
  "OLL-2": "F R U R' U' S R U R' U' f'",
  "OLL-3": "f R U R' U' f' U' F R U R' U' F'",
  "OLL-4": "f R U R' U' f' U F R U R' U' F'",
  "OLL-11": "r' R2 U R' U R U2 R' U M'",
  "OLL-13": "F U R U2 R' U' R U R' F'",
  "OLL-30": "F U R U2 R' U' R U2 R' U' F'",
  "OLL-32": "S R U R' U' R' F R f'",
  "OLL-43": "R' U' F' U F R",
  "OLL-53": "y r' U2 R U R' U' R U R' U r",
  "OLL-56": "r U r' U R U' R' U R U' R' r U' r'",
};
