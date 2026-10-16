import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { SolveRecord } from "@/cube/types";
import { accountSchema, penaltyPatchSchema, solveRecordSchema } from "@/shared/schema";

const solve: SolveRecord = {
  id: "mgx1abc-k3j2h1",
  scramble: "R U R' U'",
  moves: [
    { move: "R", t: 120 },
    { move: "U'", t: 260 },
  ],
  rotations: [{ rotation: "y", after: 1, t: 200 }],
  totalMs: 9_870,
  penalty: "none",
  createdAt: 1_760_000_000_000,
  source: "smartcube",
  analysis: {
    stages: [
      {
        kind: "cross",
        label: "cross",
        startMove: 0,
        endMove: 2,
        recognitionMs: 120,
        executionMs: 140,
        totalMs: 260,
        moveCount: 2,
        longestPauseMs: 140,
      },
    ],
    totalMs: 9_870,
    moveCount: 2,
    solved: true,
  },
};

describe("solveRecordSchema", () => {
  it("keeps every field of a full solve, analysis included", () => {
    expect(solveRecordSchema.parse(solve)).toEqual(solve);
  });

  it("accepts a keyboard solve with no moves, rotations or analysis", () => {
    const keyboard = { id: "k1", scramble: "F", moves: [], totalMs: 12_000, penalty: "+2", createdAt: 1, source: "keyboard" };
    expect(solveRecordSchema.parse(keyboard)).toEqual(keyboard);
  });

  it.each([
    { field: "id", value: "" },
    { field: "id", value: "x".repeat(65) },
    { field: "penalty", value: "+4" },
    { field: "source", value: "phone" },
    { field: "totalMs", value: "9870" },
    { field: "moves", value: [{ move: "R" }] },
    { field: "rotations", value: [{ rotation: "w", after: 0, t: 0 }] },
    { field: "analysis", value: { stages: "none" } },
  ])("rejects $field = $value", ({ field, value }) => {
    expect(solveRecordSchema.safeParse({ ...solve, [field]: value }).success).toBe(false);
  });

  it("drops unknown top-level keys", () => {
    expect(solveRecordSchema.parse({ ...solve, extra: 1 })).not.toHaveProperty("extra");
  });

  it("describes exactly the fields of SolveRecord", () => {
    // A compile-time check: `pnpm typecheck` fails when SolveRecord and the schema drift apart.
    type Parsed = z.infer<typeof solveRecordSchema>;
    expectTypeOf<keyof Parsed>().toEqualTypeOf<keyof SolveRecord>();
    expectTypeOf<Omit<Parsed, "analysis">>().toEqualTypeOf<Omit<SolveRecord, "analysis">>();
  });
});

describe("penaltyPatchSchema", () => {
  it.each([
    { body: { penalty: "none" }, ok: true },
    { body: { penalty: "+2" }, ok: true },
    { body: { penalty: "dnf" }, ok: true },
    { body: { penalty: "DNF" }, ok: false },
    { body: {}, ok: false },
    { body: null, ok: false },
  ])("$body → $ok", ({ body, ok }) => {
    expect(penaltyPatchSchema.safeParse(body).success).toBe(ok);
  });
});

describe("accountSchema", () => {
  it.each([
    { body: { id: "u", email: "a@b.c", name: "A", picture: "https://x/y.png" }, ok: true },
    { body: { id: "u", email: "a@b.c", name: "A", picture: null }, ok: true },
    { body: { id: "u", email: "a@b.c", name: "A" }, ok: false },
    { body: { email: "a@b.c", name: "A", picture: null }, ok: false },
  ])("$body → $ok", ({ body, ok }) => {
    expect(accountSchema.safeParse(body).success).toBe(ok);
  });
});
