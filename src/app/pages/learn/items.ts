import { CASE_SETS, type CaseDef, type CaseSetId } from "@/cube";

/** Something Nathan can add to what he's learning: a case set, or a skill drill. */
export type LearnItem =
  | { id: CaseSetId; kind: "cases"; cases: readonly CaseDef[] }
  | { id: "cross" | "xcross"; kind: "cross" }
  | { id: "lookahead"; kind: "lookahead" };

export const LEARN_ITEMS: readonly LearnItem[] = [
  ...CASE_SETS.map((set) => ({ id: set.id, kind: "cases" as const, cases: set.cases })),
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

export function casesOf(itemIds: readonly string[]): CaseDef[] {
  return itemIds.flatMap((id) => {
    const item = learnItem(id);
    return item?.kind === "cases" ? [...item.cases] : [];
  });
}
