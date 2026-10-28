import { CASE_SETS, getCase, type CaseDef, type CaseSetId } from "@/cube";

/** Cases to learn: one of the engine's sets, or OCLL (OLL's seven with the edges already oriented). */
export type CaseItem = {
  id: CaseSetId | "OCLL";
  kind: "cases";
  cases: readonly CaseDef[];
  /** By case id, where cubers name a case their own way: OCLL's Sune and H rather than OLL's 27 and 21. */
  names?: Readonly<Record<string, string>>;
};

/** Something Nathan can add to what he's learning: a case set, or a skill drill. */
export type LearnItem = CaseItem | { id: "cross" | "xcross"; kind: "cross" } | { id: "lookahead"; kind: "lookahead" };

// OCLL is OLL 21–27 themselves, not copies: an alg learnt here is that OLL's alg, and its reps count there too.
const OCLL_NAMES: Readonly<Record<string, string>> = {
  "OLL-27": "Sune",
  "OLL-26": "Antisune",
  "OLL-21": "H",
  "OLL-22": "Pi",
  "OLL-23": "U",
  "OLL-24": "T",
  "OLL-25": "L",
};

const OCLL: CaseItem = { id: "OCLL", kind: "cases", cases: Object.keys(OCLL_NAMES).map((id) => getCase(id)), names: OCLL_NAMES };

export const LEARN_ITEMS: readonly LearnItem[] = [
  ...CASE_SETS.flatMap((set): CaseItem[] => {
    const item: CaseItem = { id: set.id, kind: "cases", cases: set.cases };
    return set.id === "OLL" ? [item, OCLL] : [item];
  }),
  { id: "cross", kind: "cross" },
  { id: "xcross", kind: "cross" },
  { id: "lookahead", kind: "lookahead" },
];

const LABELS: Readonly<Record<string, string>> = { cross: "Cross", xcross: "XCross", lookahead: "Lookahead" };

/** How an item is written on screen: set acronyms as they are, drills in sentence case. */
export function itemLabel(id: string): string {
  return LABELS[id] ?? id;
}

export function learnItem(id: string | undefined): LearnItem | undefined {
  return LEARN_ITEMS.find((item) => item.id === id);
}

/** A case's name in an item's grid: its own name there, else the set's ("27", "Ga"). */
export function caseName(item: CaseItem, caseDef: CaseDef): string {
  return item.names?.[caseDef.id] ?? caseDef.name;
}

/** Every case in the items, once each: OLL and OCLL share seven. */
export function casesOf(itemIds: readonly string[]): CaseDef[] {
  const cases = new Map<string, CaseDef>();
  for (const id of itemIds) {
    const item = learnItem(id);
    if (item?.kind !== "cases") continue;
    for (const caseDef of item.cases) cases.set(caseDef.id, caseDef);
  }
  return [...cases.values()];
}
