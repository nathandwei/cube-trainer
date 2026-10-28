// The algs a solver can pick from for a case, and the angle each one expects the case to be held at.
//
// Options come from four places: the catalog's own algs; the references (J Perm's algs and the community's most
// voted, popular.ts); the left/right mirrors of the algs of the case's mirror image (Sune's algs mirrored solve
// Antisune, for a solver who learns one hand and mirrors it); and, for F2L, short solutions found by search in
// ⟨U, R, F⟩, so finger-friendly inserts the datasets leave out show up. Catalog and search options are written in
// the solver frame (yellow up, green front); reference algs as their source writes them.

import { algMoveCount, isSameAlg } from "./algs";
import { caseState, getCase, isGoalReached, recognizeCase, type CaseDef, type CaseSetId } from "./cases";
import { IDENTITY_FRAME, SOLVED, applyAlg, invertAlg, rotateFrame, toFaceTurns, toFaceTurnsDetailed, tokenizeAlg, type CubeState, type Frame } from "./cubie";
import { parseRotation } from "./frame";
import { llCornerAlignment } from "./milestones";
import { mirrorAlg } from "./mirror";
import { referenceAlgs, sameAlgLoose } from "./popular";
import { enumerateSlots, solveSlots } from "./solvers";
import type { Slot } from "./types";

export type AlgSource = "catalog" | "pro" | "jperm" | "community" | "mirror" | "search";

export type AlgOption = {
  /** As written: catalog algs keep their brackets, wide moves, slices and rotations; search results are face turns. */
  readonly alg: string;
  /** Slice-turn-metric length (algMoveCount). */
  readonly moves: number;
  readonly source: AlgSource;
};

/** F2L search: the faces it turns, how far past the shortest it looks, and the most options a case gets. */
export const F2L_SEARCH = { faces: ["U", "R", "F"], slack: 2, maxOptions: 6 } as const;

const SOURCE_ORDER: Record<AlgSource, number> = { catalog: 0, pro: 1, jperm: 2, community: 3, mirror: 4, search: 5 };

// As in cases.ts: no AUF, then quarter turns, then a half turn.
const PRE_AUFS = ["", "U", "U'", "U2"] as const;

const LL_SETS: ReadonlySet<CaseSetId> = new Set(["PLL", "OLL", "COLL", "EPLL", "EO"]);

const OTHER_SLOTS: readonly Slot[] = ["FL", "BL", "BR"];

function faceTurnList(alg: string): string[] {
  return toFaceTurns(alg).split(" ").filter(Boolean);
}

/** The first pre-AUF (in PRE_AUFS order) after which `alg` takes `state` to the set's goal; null when none does. */
function preAufFor(set: CaseSetId, state: CubeState, alg: string): string | null {
  const turns = faceTurnList(alg);
  return PRE_AUFS.find((auf) => isGoalReached(set, applyAlg(state, auf ? [auf, ...turns] : turns))) ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// Mirror siblings

const mirrorIds = new Map<string, string | null>();

function findMirror(caseDef: CaseDef): string | null {
  // The mirror of a front-right pair is a front-left pair, and the F2L set only has front-right cases.
  if (caseDef.set === "F2L") return null;
  const mirrored = mirrorAlg(caseDef.algs[0]!);
  const match = recognizeCase(caseDef.set, applyAlg(SOLVED, invertAlg(faceTurnList(mirrored))));
  if (!match) throw new Error(`The mirror of ${caseDef.id} ("${mirrored}") is not a ${caseDef.set} case`);
  return match.caseId === caseDef.id ? null : match.caseId;
}

/**
 * The other case of the same set that is this one's left/right mirror image (up to AUFs): found by mirroring the
 * default alg and recognising the case that mirrored alg solves. Null for F2L cases (their mirror is a front-left
 * pair) and for cases that are their own mirror image (H perm, OLL 21, ...).
 */
export function mirrorCaseId(caseId: string): string | null {
  const cached = mirrorIds.get(caseId);
  if (cached !== undefined) return cached;
  const found = findMirror(getCase(caseId));
  mirrorIds.set(caseId, found);
  return found;
}

function mirroredAlgs(caseDef: CaseDef): string[] {
  const sibling = mirrorCaseId(caseDef.id);
  if (sibling === null) return [];
  const state = caseState(caseDef.id);
  return getCase(sibling).algs.map((alg) => {
    const mirrored = mirrorAlg(alg);
    if (preAufFor(caseDef.set, state, mirrored) === null) {
      throw new Error(`"${mirrored}", the mirror of ${sibling}'s "${alg}", does not solve ${caseDef.id}`);
    }
    return mirrored;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// F2L search

type Ranked = { alg: string; faces: number; frontTurns: number; order: number };

// Within one length: two-generator first (⟨R, U⟩ or ⟨F, U⟩), then fewer F turns, then search order.
function rank(alg: string, order: number): Ranked {
  const turns = alg.split(" ");
  return {
    alg,
    faces: new Set(turns.map((turn) => turn.charAt(0))).size,
    frontTurns: turns.filter((turn) => turn.startsWith("F")).length,
    order,
  };
}

function compareRanked(a: Ranked, b: Ranked): number {
  return a.faces - b.faces || a.frontTurns - b.frontTurns || a.order - b.order;
}

/**
 * Solutions of the F2L case from its exact state (a leading U is a move like any other), from the shortest length
 * up to F2L_SEARCH.slack moves more. Each length is searched only when the consumer asks for more, and is ranked
 * whole before any of it is yielded, so stopping early never skips a better option.
 */
function* f2lSolutions(caseId: string): Generator<string, void, undefined> {
  const state = caseState(caseId);
  const faces = F2L_SEARCH.faces;
  const shortest = solveSlots(state, ["FR"], OTHER_SLOTS, { faces });
  if (!shortest) throw new Error(`No ⟨${faces.join(", ")}⟩ solution for ${caseId}`);
  for (let length = shortest.moves; length <= shortest.moves + F2L_SEARCH.slack; length++) {
    const level = enumerateSlots(state, ["FR"], OTHER_SLOTS, length, { faces }).map(rank).sort(compareRanked);
    for (const { alg } of level) yield alg;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Options

const SINGLE_ROTATIONS = ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"] as const;
/** Every way back to the starting grip, shortest first: one rotation, then two. */
const CLOSERS: readonly (readonly string[])[] = [
  ...SINGLE_ROTATIONS.map((r) => [r]),
  ...SINGLE_ROTATIONS.flatMap((a) => SINGLE_ROTATIONS.map((b) => [a, b])),
];

function rotated(frame: Frame, rotations: readonly string[]): Frame {
  return rotations.reduce((current, rotation) => rotateFrame(current, ...parseRotation(rotation)), frame);
}

function isIdentity(frame: Frame): boolean {
  return (Object.keys(IDENTITY_FRAME) as (keyof Frame)[]).every((face) => frame[face] === IDENTITY_FRAME[face]);
}

/**
 * The alg with the grip it leaves the cube in undone at its end, as the catalog writes it ("x L2 D2 ... L' x'"), so
 * playing it leaves the cube held the way it started. Only the net turn counts (an M or r turns the cube too, but
 * M2 U M2 U2 M2 U M2 ends where it began). The angle it starts from (its leading AUF) stays as written.
 */
function closeRotations(set: CaseSetId, alg: string): string {
  const end = rotated(IDENTITY_FRAME, toFaceTurnsDetailed(splitLeadingAuf(set, alg).body).rotations);
  if (isIdentity(end)) return alg;
  const closer = CLOSERS.find((candidate) => isIdentity(rotated(end, candidate)));
  if (!closer) throw new Error(`No rotation brings "${alg}" back to its starting grip`);
  return `${alg} ${closer.join(" ")}`;
}

const optionCache = new Map<string, readonly AlgOption[]>();

function buildOptions(caseDef: CaseDef): AlgOption[] {
  const options: AlgOption[] = [];
  const add = (alg: string, source: AlgSource): void => {
    if (options.some((option) => isSameAlg(option.alg, alg))) return;
    options.push(Object.freeze({ alg, moves: algMoveCount(alg), source }));
  };
  for (const alg of caseDef.algs) add(alg, "catalog");
  // A reference alg is often a catalog alg from another angle ("y x R' U ..." for "x R' U ..."): offered once.
  for (const { alg, source } of referenceAlgs(caseDef.id)) {
    if (!options.some((option) => sameAlgLoose(option.alg, alg))) add(closeRotations(caseDef.set, alg), source);
  }
  for (const alg of mirroredAlgs(caseDef)) add(alg, "mirror");
  if (caseDef.set === "F2L") {
    for (const alg of f2lSolutions(caseDef.id)) {
      if (options.length >= F2L_SEARCH.maxOptions) break;
      add(alg, "search");
    }
  }
  return options.sort((a, b) => a.moves - b.moves || SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source]);
}

/**
 * Every alg on offer for a case, sorted by move count, then catalog, pro, J Perm, community, mirror, search (each keeping
 * its own order). Two algs count as one when they are the same moves up to spelling, brackets and a leading or
 * trailing U turn (isSameAlg; reference algs also up to their starting angle, sameAlgLoose), and the earlier source
 * wins; algs that solve the case with different moves are all kept.
 * - catalog: the case's own algs.
 * - pro, jperm, community: what top solvers use now, J Perm's algs and the community's most voted (popular.ts).
 * - mirror: the left/right mirrors of the algs of mirrorCaseId(caseId), e.g. Sune's algs mirrored for Antisune.
 * - search (F2L only): solutions in ⟨U, R, F⟩ from the exact case state, up to F2L_SEARCH.slack moves longer than
 *   the shortest, ranked shortest, two-generator, fewest F turns first, until the case has F2L_SEARCH.maxOptions
 *   options (catalog algs always stay).
 * Each option reaches the set's goal from caseState(caseId) after some pre-AUF (search options need none); see
 * viewState for the angle. Results are cached; the array is a fresh copy.
 */
export function algOptions(caseId: string): AlgOption[] {
  const cached = optionCache.get(caseId);
  if (cached) return [...cached];
  const built = buildOptions(getCase(caseId));
  optionCache.set(caseId, built);
  return [...built];
}

// ---------------------------------------------------------------------------------------------------------------
// The angle an alg expects

export type AufSplit = {
  /** The leading AUF as written ("U2", "y U'"), "" for none. */
  auf: string;
  /** The rest of the alg as written: the part executed from the angle viewState shows. */
  body: string;
};

const SEPARATOR = /^(\s+|[()[\]])$/;

function leadingRole(set: CaseSetId, piece: string): "auf" | "keep" | "stop" {
  const family = tokenizeAlg(piece)[0]?.family;
  if (family === undefined) return "keep";
  if (family === "U") return "auf";
  if (family !== "y") return "stop";
  // On a last layer with F2L solved a y rotation looks exactly like a U turn. In F2L it picks another slot, so it
  // stays in the body, but it commutes with U turns, so U turns after it are still the AUF.
  return LL_SETS.has(set) ? "auf" : "keep";
}

/**
 * Splits off an alg's leading AUF: the U turns it starts with, and for last-layer sets also y rotations among them
 * (F2L keeps a leading y in the body, since it changes the slot, but still counts the U turns next to it as the
 * AUF). The body keeps the alg's spelling, with empty brackets and doubled spaces left by the split removed.
 */
export function splitLeadingAuf(set: CaseSetId, alg: string): AufSplit {
  const pieces = alg.split(/(\s+|[()[\]])/);
  const auf: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    if (piece === "" || SEPARATOR.test(piece)) continue;
    const role = leadingRole(set, piece);
    if (role === "stop") break;
    if (role === "keep") continue;
    auf.push(piece);
    pieces[i] = "";
  }
  if (auf.length === 0) return { auf: "", body: alg };
  const body = pieces
    .join("")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/([([])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return { auf: auf.join(" "), body };
}

/**
 * The case as the solver holds it to run `alg`: the angle he recognises it from, which is after the alg's leading
 * AUF (splitLeadingAuf), because that AUF only turns the dataset's angle into the one the rest of the alg is learnt
 * from. So this is caseState(caseId) after the first pre-AUF a in "", U, U', U2 from which the alg's body reaches
 * the set's goal with no further turn before it: "R U R' U R U2 R'" and "U R U R' U R U2 R'" both show Sune at the
 * catalog angle (oriented corner front left), and the mirror "L' U' L U' L' U2 L" shows Antisune with its oriented
 * corner front right, the mirror image of that hold. Animate splitLeadingAuf(set, alg).body from here. Throws when
 * the alg does not solve the case from any angle.
 */
export function viewState(caseId: string, alg: string): CubeState {
  return applyAlg(caseState(caseId), viewAuf(caseId, alg));
}

/**
 * The pre-AUF viewState applies ("", "U", "U'" or "U2"), for showing the same angle on a 3D cube. With `from`, the
 * case is first turned that way (another angle he might see it from), and this is the U turn that takes him from
 * there to an angle the alg starts from.
 */
export function viewAuf(caseId: string, alg: string, from = ""): string {
  const { set } = getCase(caseId);
  const auf = preAufFor(set, applyAlg(caseState(caseId), from), splitLeadingAuf(set, alg).body);
  if (auf === null) throw new Error(`"${alg}" does not solve ${caseId} from any angle`);
  return auf;
}

/** Sets whose algs finish "up to AUF": the last layer is done but may sit a U turn off. */
const FINISHED_UP_TO_AUF: ReadonlySet<CaseSetId> = new Set(["PLL", "EPLL", "COLL"]);

/** The U turn that lines the last layer up after such an alg, so a played alg visibly ends solved. */
export function finishingAuf(set: CaseSetId, state: CubeState): string {
  if (!FINISHED_UP_TO_AUF.has(set)) return "";
  return PRE_AUFS.find((auf) => llCornerAlignment(applyAlg(state, auf)) === 0) ?? "";
}

/**
 * How to act an alg out on a cube showing caseState(caseId): the pre-AUF that turns the case to the angle the alg
 * starts from, then the alg's body and the final U turn that leaves it looking solved.
 */
export function playback(caseId: string, alg: string): { preAuf: string; moves: string } {
  const { set } = getCase(caseId);
  const preAuf = viewAuf(caseId, alg);
  const { body } = splitLeadingAuf(set, alg);
  const end = applyAlg(applyAlg(caseState(caseId), preAuf), faceTurnList(body));
  const finish = finishingAuf(set, end);
  return { preAuf, moves: [body, finish].filter(Boolean).join(" ") };
}

/** A piece's trip in a last-layer case, as U-face sticker indices (0..8, row by row with B at the top). */
export type CaseArrow = { from: number; to: number; piece: "corner" | "edge" };

// U-layer positions as U-face sticker indices: corners URF UFL ULB UBR, edges UR UF UL UB (facelets.ts layout).
const U_CORNER_STICKER = [8, 6, 0, 2] as const;
const U_EDGE_STICKER = [5, 7, 3, 1] as const;

/**
 * Where each last-layer piece goes for a PLL or EPLL case, like the arrows on jperm.net: the alg's playback is run
 * on a solved cube and every U-layer piece that ends up somewhere else gets an arrow from where it starts to where it
 * lands. Drawn on the angle the alg starts from (viewState). Other sets have no arrows.
 */
export function caseArrows(caseId: string, alg: string): CaseArrow[] {
  const { set } = getCase(caseId);
  if (set !== "PLL" && set !== "EPLL") return [];
  const moves = faceTurnList(playback(caseId, alg).moves);
  const trips = (perm: readonly number[], stickers: readonly number[], piece: CaseArrow["piece"]): CaseArrow[] =>
    stickers.flatMap((from, start) => {
      const end = perm.indexOf(start);
      const to = stickers[end];
      return end !== start && to !== undefined ? [{ from, to, piece }] : [];
    });
  // A whole-layer turn on top of the case (an angle where every piece sits a U off) isn't part of the case: draw the
  // cycle relative to the layer, i.e. with whichever extra U turn leaves the fewest pieces moving.
  const candidates = PRE_AUFS.map((auf) => {
    const moved = applyAlg(SOLVED, auf ? [...moves, auf] : moves);
    return [...trips(moved.cp, U_CORNER_STICKER, "corner"), ...trips(moved.ep, U_EDGE_STICKER, "edge")];
  });
  return candidates.reduce((best, arrows) => (arrows.length < best.length ? arrows : best));
}
