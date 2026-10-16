import { applyAlg, getCaseSet, isCrossSolved, isSlotSolved, recognizeCase, toFaceTurns, type CaseSetId, type CubeState } from "@/cube";
import type { Slot, Stage, StageKind } from "@/cube/types";

// The F2L cases are written for the front-right slot. Seen after this rotation, a slot sits at front right.
const ROTATION_TO_FR: Record<Slot, string> = { FR: "", FL: "y'", BL: "y2", BR: "y" };
const PRE_AUFS = ["", "U", "U'", "U2"] as const;

let tries: Map<Slot, { caseId: string; turns: string[] }[]> | undefined;

/** Every F2L case's default alg, after each pre-AUF, as centre-frame turns that solve the pair in each slot. */
function pairTries(slot: Slot): { caseId: string; turns: string[] }[] {
  tries ??= new Map();
  const cached = tries.get(slot);
  if (cached) return cached;
  const built = getCaseSet("F2L").cases.flatMap((caseDef) =>
    PRE_AUFS.map((auf) => ({
      caseId: caseDef.id,
      turns: toFaceTurns([ROTATION_TO_FR[slot], auf, caseDef.algs[0] ?? ""].filter(Boolean).join(" ")).split(" ").filter(Boolean),
    })),
  );
  tries.set(slot, built);
  return built;
}

/**
 * The F2L case the pair for `slot` shows in `state`, whatever the other slots hold: the case whose alg, done from
 * this slot's angle after some U turn, solves the pair and keeps the cross. An alg fixes every position it doesn't
 * solve into, so unsolved neighbours don't matter. Null when the cross is broken, the pair is in, or a piece of it
 * sits in another slot (no single case covers that).
 */
export function pairCase(state: CubeState, slot: Slot): string | null {
  if (!isCrossSolved(state) || isSlotSolved(state, slot)) return null;
  const found = pairTries(slot).find(({ turns }) => {
    const after = applyAlg(state, turns);
    return isCrossSolved(after) && isSlotSolved(after, slot);
  });
  return found?.caseId ?? null;
}

const LAST_LAYER_SETS: Partial<Record<StageKind, CaseSetId>> = { eo: "EO", coll: "COLL", epll: "EPLL", oll: "OLL", pll: "PLL" };

/** The case a stage started from: its pair's F2L case, or the last-layer case. Null for the cross and multislots. */
export function stageCase(stage: Stage, start: CubeState): string | null {
  if (stage.kind === "pair") {
    const [slot, ...more] = stage.slots ?? [];
    return slot && more.length === 0 ? pairCase(start, slot) : null;
  }
  const set = LAST_LAYER_SETS[stage.kind];
  return set ? (recognizeCase(set, start)?.caseId ?? null) : null;
}
