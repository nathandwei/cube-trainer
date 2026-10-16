import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEARN_SETTINGS,
  learnSettingsSchema,
  MAX_REPS_PER_POST,
  repBatchSchema,
  repSchema,
  settingsDocSchema,
} from "@/shared/learn";

const caseRep = {
  kind: "case",
  id: "01K742SG00ABCDEFGHJKMNPQRS",
  createdAt: 1_760_000_000_000,
  item: "COLL-T3",
  auf: "U'",
  recognitionMs: 640,
  executionMs: 1_820,
  moves: ["R", "U", "R'", "U", "R", "U2", "R'"],
  correct: false,
  source: "smartcube",
  alg: "R U R' U R U2 R'",
};

const crossRep = {
  kind: "cross",
  id: "c1",
  createdAt: 1,
  item: "xcross",
  scramble: "R U F' L2 D",
  optimalMoves: 7,
  moveCount: 10,
  inspectionMs: 9_000,
  executionMs: 2_500,
  source: "keyboard",
};

const lookaheadRep = { kind: "lookahead", id: "l1", createdAt: 1, item: "lookahead", bpm: 72, pauses: 3 };

describe("repSchema", () => {
  it.each([caseRep, crossRep, lookaheadRep])("accepts a $kind rep unchanged", (rep) => {
    expect(repSchema.parse(rep)).toEqual(rep);
  });

  it("keeps fields it does not know, for the UI to add later", () => {
    expect(repSchema.parse({ ...lookaheadRep, pauseMs: [400, 900] })).toEqual({ ...lookaheadRep, pauseMs: [400, 900] });
  });

  it.each([
    { name: "an unknown kind", rep: { ...caseRep, kind: "bld" } },
    { name: "an id with a space", rep: { ...caseRep, id: "a b" } },
    { name: "an empty id", rep: { ...caseRep, id: "" } },
    { name: "a 65-character id", rep: { ...caseRep, id: "x".repeat(65) } },
    { name: "a fractional createdAt", rep: { ...caseRep, createdAt: 1.5 } },
    { name: "a bad AUF", rep: { ...caseRep, auf: "U3" } },
    { name: "a negative time", rep: { ...caseRep, recognitionMs: -1 } },
    { name: "a missing correct", rep: { ...caseRep, correct: undefined } },
    { name: "an unknown input source", rep: { ...caseRep, source: "phone" } },
    { name: "a case field on a cross rep", rep: { ...crossRep, optimalMoves: 40 } },
    { name: "a lookahead rep with zero bpm", rep: { ...lookaheadRep, bpm: 0 } },
  ])("rejects $name", ({ rep }) => {
    expect(repSchema.safeParse(rep).success).toBe(false);
  });
});

describe("repBatchSchema", () => {
  it.each([
    { size: 0, ok: false },
    { size: 1, ok: true },
    { size: MAX_REPS_PER_POST, ok: true },
    { size: MAX_REPS_PER_POST + 1, ok: false },
  ])("a batch of $size is ok: $ok", ({ size, ok }) => {
    const reps = Array.from({ length: size }, (_, i) => ({ ...lookaheadRep, id: `l${i}` }));
    expect(repBatchSchema.safeParse({ reps }).success).toBe(ok);
  });
});

describe("learnSettingsSchema", () => {
  it("fills in defaults for an empty document", () => {
    expect(DEFAULT_LEARN_SETTINGS).toEqual({ version: 1, items: [], algs: {}, algChosenAt: {} });
  });

  it("keeps fields it does not know", () => {
    const settings = { items: ["PLL"], algs: { "PLL-Ua": "R U' R U R U R U' R' U' R2" }, theme: "warm", zbll: { subsets: ["T"] } };
    expect(learnSettingsSchema.parse(settings)).toEqual({ ...DEFAULT_LEARN_SETTINGS, ...settings });
  });

  it.each([
    { name: "items that are not a list", settings: { items: "PLL" } },
    { name: "an empty item", settings: { items: [""] } },
    { name: "an alg that is not text", settings: { algs: { "PLL-Ua": 1 } } },
    { name: "a negative newPerSession", settings: { newPerSession: -1 } },
    { name: "a fractional algChosenAt", settings: { algChosenAt: { "PLL-Ua": 1.5 } } },
  ])("rejects $name", ({ settings }) => {
    expect(learnSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it.each([
    { doc: { settings: {}, updatedAt: 0 }, ok: true },
    { doc: { settings: {}, updatedAt: -1 }, ok: false },
    { doc: { settings: {} }, ok: false },
    { doc: { updatedAt: 1 }, ok: false },
  ])("settings document $doc is ok: $ok", ({ doc, ok }) => {
    expect(settingsDocSchema.safeParse(doc).success).toBe(ok);
  });
});
