import { describe, expect, it } from "vitest";
import { getCaseSet } from "@/cube";
import { caseName, casesOf, LEARN_ITEMS, learnItem, type CaseItem } from "./items";

const ocll = learnItem("OCLL") as CaseItem;

describe("OCLL", () => {
  it("is OLL's seven cases with the edges oriented, the OLL cases themselves", () => {
    const edgesOriented = getCaseSet("OLL").cases.filter((c) => c.group === "Edges oriented");
    expect(ocll.cases.map((c) => c.id).sort()).toEqual(edgesOriented.map((c) => c.id).sort());
    expect(ocll.cases).toEqual(expect.arrayContaining(edgesOriented));
  });

  it("names its cases as cubers do, Sune first", () => {
    expect(ocll.cases.map((c) => caseName(ocll, c))).toEqual(["Sune", "Antisune", "H", "Pi", "U", "T", "L"]);
  });

  it("comes right after OLL in the list", () => {
    const ids = LEARN_ITEMS.map((item) => item.id);
    expect(ids.indexOf("OCLL")).toBe(ids.indexOf("OLL") + 1);
  });
});

describe("casesOf", () => {
  it("lists a case once when OLL and OCLL are both learnt", () => {
    const ids = casesOf(["OLL", "OCLL"]).map((c) => c.id);
    expect(ids).toHaveLength(getCaseSet("OLL").cases.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a set's own names where the item has none", () => {
    const pll = learnItem("PLL") as CaseItem;
    expect(caseName(pll, pll.cases[0]!)).toBe(pll.cases[0]!.name);
  });
});
