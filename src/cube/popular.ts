// What the cubing world uses for a case, for the trainer's "Recommended" and the options a case offers.
//
// Recommended, in order of trust:
// 1. Nathan's rulings (RULINGS): the alg he has said a case should use.
// 2. What top solvers use now (pro-data.ts), where it differs from J Perm's 2019 pick.
// 3. J Perm's recommended alg (jperm-data.ts): PLL, OLL and COLL, EPLL through its PLL case.
// 4. The community's most-voted alg on SpeedCubeDB (speed-votes.ts), different spellings of one alg counted together.
// 5. Otherwise the speed model's fastest option (speed.ts).

import { isSameAlg } from "./algs";
import { getCase } from "./cases";
import { simplifyMoves, toFaceTurns, tokenizeAlg } from "./cubie";
import { JPERM_ALGS } from "./jperm-data";
import { PRO_ALGS } from "./pro-data";
import { COMMUNITY_VOTES, type CommunityCase } from "./speed-votes";

/** Nathan's rulings: the alg a case should recommend, whatever the references say. */
export const RULINGS: Readonly<Record<string, string>> = {
  // The front-right insert he uses for F2L 2 (the site's most voted is the sledge, F R' F' R).
  "F2L-2": "U' F' U F",
};

export type ReferenceSource = "ruling" | "pros" | "jperm" | "votes";

/** An alg from outside the catalog: the pros' pick, J Perm's list, or one of the community's most voted. */
export type ReferenceAlg = { alg: string; source: "pro" | "jperm" | "community" };

const AMOUNTS = ["", "2", "'"] as const;

/** The alg without the U turns and y rotations it opens with (the angle it starts from), moves written plainly. */
export function withoutAuf(alg: string): string {
  const tokens = tokenizeAlg(alg);
  let first = 0;
  while (first < tokens.length && (tokens[first]!.family === "U" || tokens[first]!.family === "y")) first++;
  return tokens
    .slice(first)
    .map(({ family, amount }) => family + AMOUNTS[amount - 1])
    .join(" ");
}

/**
 * One key for the spellings of an alg: its face turns once leading and trailing U and D turns are dropped (a D moved
 * from one end to the other only shifts the alg cyclically, and the site splits its votes between such spellings),
 * with adjacent U/D pairs in one order (they commute). "x R'" and "l'" come out the same.
 */
export function spellingKey(alg: string): string {
  return turnsKey(toFaceTurns(withoutAuf(alg)).split(" ").filter(Boolean));
}

const AXIS: Readonly<Record<string, number>> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const FACE_ORDER = "URFDLB";

/**
 * Face turns in one form however they came: same-face turns merged (R R → R2), and each run of turns on one axis,
 * which commute, in a fixed order (a slice the cube reports as L' R or R L' comes out the same).
 */
function normalized(turns: readonly string[]): string[] {
  let current = simplifyMoves(turns);
  for (;;) {
    const sorted: string[] = [];
    for (let i = 0; i < current.length; ) {
      let j = i;
      while (j < current.length && AXIS[current[j]![0]!] === AXIS[current[i]![0]!]) j++;
      sorted.push(...current.slice(i, j).sort((a, b) => FACE_ORDER.indexOf(a[0]!) - FACE_ORDER.indexOf(b[0]!)));
      i = j;
    }
    const merged = simplifyMoves(sorted);
    if (merged.join(" ") === current.join(" ")) return merged;
    current = merged;
  }
}

function turnsKey(turns: readonly string[]): string {
  const t = normalized(turns);
  while (t.length > 0 && /^[UD]/.test(t[0]!)) t.shift();
  while (t.length > 0 && /^[UD]/.test(t.at(-1)!)) t.pop();
  return t.join(" ");
}

/**
 * True when turns a smart cube reported (outer face turns, centre frame) are `alg` done from some angle: the same
 * turns once each is seen from a y rotation, in one form (merged, commuting turns ordered), with AUFs and the D
 * turns at either end left out. An alg that doesn't parse matches nothing.
 */
export function turnsMatchAlg(turns: readonly string[], alg: string): boolean {
  const done = turnsKey(turns);
  if (done === "") return false;
  let body: string;
  try {
    body = withoutAuf(alg);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    // A stored alg that no longer parses matches nothing.
    return false;
  }
  return ["", "y", "y2", "y'"].some((y) => turnsKey(toFaceTurns(`${y} ${body}`).split(" ").filter(Boolean)) === done);
}

/** The same alg however it's spelled or angled (isSameAlg, or the same spellingKey). */
export function sameAlgLoose(a: string, b: string): boolean {
  return isSameAlg(withoutAuf(a), withoutAuf(b)) || spellingKey(a) === spellingKey(b);
}

/** Where a case's references are filed: EPLL cases are PLL's U, H and Z perms. */
function referenceId(caseId: string): string {
  return getCase(caseId).set === "EPLL" ? caseId.replace(/^EPLL-/, "PLL-") : caseId;
}

function communityCase(caseId: string): CommunityCase | undefined {
  const id = referenceId(caseId);
  for (const cases of Object.values(COMMUNITY_VOTES)) {
    const found = cases.find((entry) => entry.caseId === id);
    if (found) return found;
  }
  return undefined;
}

/** A case's voted algs with the spellings of one alg together, most votes first; each group's most-voted spelling first. */
export function votedAlgs(caseId: string): { algs: string[]; votes: number }[] {
  const groups: { algs: string[]; votes: number }[] = [];
  for (const [alg, votes] of communityCase(caseId)?.algs ?? []) {
    const group = groups.find((g) => g.algs.some((other) => sameAlgLoose(other, alg)));
    if (group) {
      group.algs.push(alg);
      group.votes += votes;
    } else {
      groups.push({ algs: [alg], votes });
    }
  }
  return groups.sort((a, b) => b.votes - a.votes);
}

/** J Perm's algs for a case, his recommended first; empty when he lists none. */
export function jpermAlgs(caseId: string): readonly string[] {
  return JPERM_ALGS[referenceId(caseId)] ?? [];
}

/** The alg top solvers use most for a case now, when it isn't J Perm's pick; undefined otherwise. */
export function proAlg(caseId: string): string | undefined {
  return PRO_ALGS[referenceId(caseId)];
}

/** The algs a case should offer beyond the catalog: the pros', J Perm's, then the community's most voted (one spelling each). */
export function referenceAlgs(caseId: string): ReferenceAlg[] {
  const pro = proAlg(caseId);
  return [
    ...(pro ? [{ alg: pro, source: "pro" } satisfies ReferenceAlg] : []),
    ...jpermAlgs(caseId).map((alg): ReferenceAlg => ({ alg, source: "jperm" })),
    ...votedAlgs(caseId).map(({ algs }): ReferenceAlg => ({ alg: algs[0]!, source: "community" })),
  ];
}

/** What the references recommend for a case (steps 1–4 above), or null when none of them covers it. */
export function referencePick(caseId: string): { alg: string; source: ReferenceSource } | null {
  const ruling = RULINGS[caseId];
  if (ruling) return { alg: ruling, source: "ruling" };
  const pro = proAlg(caseId);
  if (pro) return { alg: pro, source: "pros" };
  const [jperm] = jpermAlgs(caseId);
  if (jperm) return { alg: jperm, source: "jperm" };
  const [top] = votedAlgs(caseId);
  return top ? { alg: top.algs[0]!, source: "votes" } : null;
}
