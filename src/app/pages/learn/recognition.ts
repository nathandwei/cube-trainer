// Two-sided recognition, for the sets that rearrange a finished top (PLL, EPLL): a case as he sees it holding his cube,
// from each of the four angles it can come up at. The top is all yellow, so what tells the case is the top layer's
// three stickers on the front and three on the right, and on every angle of every case those six make a pattern no
// other case does (recognition.test.ts). Only how their colours relate counts, never which colours they are: a case
// comes up with any side in front.

import { facelets } from "@/app/lib/facelets";
import { applyAlg, caseState, getCase, getCaseSet, viewAuf, type CaseSetId, type CubeState } from "@/cube";

export const RECOGNISED_SETS: ReadonlySet<CaseSetId> = new Set(["PLL", "EPLL"]);

/** U turns by how many quarter turns clockwise they make. */
const QUARTERS: readonly string[] = ["", "U", "U2", "U'"];
/** The side colours in order round the cube, so turning the colour scheme only shifts them along. */
const RING: readonly string[] = ["F", "R", "B", "L"];
/** Angles are listed by the U turn that gets him to his alg's start: none first, then quarter turns, then a half. */
const PRE_AUF_ORDER: readonly string[] = ["", "U", "U'", "U2"];

export type SideLook = "3-bar" | "Headlights" | "Inner bar" | "Outer bar" | "No pair";

/** What one angle shows: each side's look, how many colours are in view, and whether the two outer corners match. */
export type Features = { left: SideLook; right: SideLook; colours: number; bookends: boolean };

/** Another case showing the same features from one of its angles, and the stickers (0–5, see Six) that differ. */
export type Lookalike = { caseId: string; auf: string; differ: number[] };

export type Angle = {
  /** U turns from the angle his alg starts from to this one, so a U on his cube moves to the next. */
  quarters: number;
  /** The U turn from the case's usual angle (caseState) to this one. */
  auf: string;
  /** The U turn that takes him from here to an angle his alg starts from; "" when he can start right away. */
  preAuf: string;
  features: Features;
  lookalikes: Lookalike[];
};

/** The top layer's stickers in view, left to right (the front's three, then the right's), as places on RING. */
type Six = readonly number[];

type View = { caseId: string; auf: string; six: Six; key: string };

/** How many quarter turns a U move makes, or null for any other move. */
export function quartersOf(move: string): number | null {
  const quarters = QUARTERS.indexOf(move);
  return quarters > 0 ? quarters : null;
}

function turnBy(auf: string, quarters: number): string {
  const from = QUARTERS.indexOf(auf);
  if (from < 0) throw new Error(`Not a U turn: "${auf}"`);
  return QUARTERS[(from + quarters) % 4]!;
}

function sixOf(state: CubeState): Six {
  const { F, R } = facelets(state);
  const six = [F[0], F[1], F[2], R[0], R[1], R[2]].map((face) => RING.indexOf(face ?? ""));
  if (six.some((place) => place < 0)) throw new Error("A top-layer side sticker shows the top or bottom colour");
  return six;
}

/** A side read from its outer end in to the corner it shares with the other side. */
function sideLook(outer: number, middle: number, inner: number): SideLook {
  if (outer === middle && middle === inner) return "3-bar";
  if (outer === inner) return "Headlights";
  if (middle === inner) return "Inner bar";
  if (outer === middle) return "Outer bar";
  return "No pair";
}

function featuresOf(six: Six): Features {
  const [f0, f1, f2, r0, r1, r2] = six as [number, number, number, number, number, number];
  return { left: sideLook(f0, f1, f2), right: sideLook(r2, r1, r0), colours: new Set(six).size, bookends: f0 === r2 };
}

function viewOf(caseId: string, auf: string): View {
  const six = sixOf(applyAlg(caseState(caseId), auf));
  const { left, right, colours, bookends } = featuresOf(six);
  return { caseId, auf, six, key: `${left}|${right}|${colours}|${bookends}` };
}

const viewsBySet = new Map<CaseSetId, View[]>();

function setViews(set: CaseSetId): View[] {
  let views = viewsBySet.get(set);
  if (!views) {
    views = getCaseSet(set).cases.flatMap((caseDef) => QUARTERS.map((auf) => viewOf(caseDef.id, auf)));
    viewsBySet.set(set, views);
  }
  return views;
}

/** Where `other` differs from `mine`, with its colours shifted round to match as many of mine as they can. */
function differing(mine: Six, other: Six): number[] {
  const byShift = [0, 1, 2, 3].map((shift) => mine.flatMap((colour, i) => (colour === ((other[i] ?? -1) + shift) % 4 ? [] : [i])));
  return byShift.reduce((fewest, differ) => (differ.length < fewest.length ? differ : fewest));
}

/** The other cases that show the same features, each from its angle closest to this one. */
function lookalikes(set: CaseSetId, mine: View): Lookalike[] {
  const closest = new Map<string, Lookalike>();
  for (const other of setViews(set)) {
    if (other.caseId === mine.caseId || other.key !== mine.key) continue;
    const differ = differing(mine.six, other.six);
    const kept = closest.get(other.caseId);
    if (!kept || differ.length < kept.differ.length) closest.set(other.caseId, { caseId: other.caseId, auf: other.auf, differ });
  }
  return [...closest.values()];
}

/** The case from each of its four angles, the one `alg` starts from first. Throws when `alg` doesn't solve it. */
export function recognitionAngles(caseId: string, alg: string): Angle[] {
  const { set } = getCase(caseId);
  if (!RECOGNISED_SETS.has(set)) throw new Error(`${caseId} isn't recognised from two sides`);
  const start = viewAuf(caseId, alg);
  const angles = [0, 1, 2, 3].map((quarters): Angle => {
    const auf = turnBy(start, quarters);
    const view = viewOf(caseId, auf);
    return { quarters, auf, preAuf: viewAuf(caseId, alg, auf), features: featuresOf(view.six), lookalikes: lookalikes(set, view) };
  });
  return angles.sort((a, b) => PRE_AUF_ORDER.indexOf(a.preAuf) - PRE_AUF_ORDER.indexOf(b.preAuf) || a.quarters - b.quarters);
}
