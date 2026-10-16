import { describe, expect, it } from "vitest";
import { AUFS, FrameTracker, applyAlg, caseState, getCase, invertAlg, isGoalReached, parseAlg, type CubeState } from "@/cube";
import type { RotationEvent, TimedMove } from "@/cube/types";
import { asAlg, moveCount, takeTokens, testLine, tidy, type Take } from "./notation";

const words = (alg: string) => alg.replace(/[()[\]]/g, " ").split(/\s+/).filter(Boolean);

/**
 * What a smart cube with a gyro reports for moves done in the solver's view: half turns as two quarter turns 40 ms
 * apart, slices as two opposite turns 15 ms apart, and the core's rotation (a wide move, slice or regrip) right after.
 */
function cubeTake(alg: string, gapMs = 180): Take {
  const view = new FrameTracker();
  const moves: TimedMove[] = [];
  const rotations: RotationEvent[] = [];
  let t = 0;
  for (const token of words(alg)) {
    const step = view.apply(token);
    for (const [i, turn] of step.turns.entries()) {
      const quarters = turn.endsWith("2") ? [turn.charAt(0), turn.charAt(0)] : [turn];
      for (const [k, quarter] of quarters.entries()) moves.push({ move: quarter, t: t + i * 15 + k * 40 });
    }
    const last = moves.at(-1)?.t ?? t;
    if (step.rotation) rotations.push({ rotation: step.rotation, after: moves.length, t: step.turns.length > 0 ? last + 30 : t });
    t = last + gapMs;
  }
  return { moves, rotations };
}

function solves(caseId: string, from: CubeState, line: readonly string[]): boolean {
  const view = new FrameTracker();
  return isGoalReached(getCase(caseId).set, applyAlg(from, line.flatMap((token) => view.apply(token).turns)));
}

describe("tidy", () => {
  it.each([
    ["R R", "R2"],
    ["R R'", ""],
    ["R2 R", "R'"],
    ["U R R' U", "U2"],
    ["M M", "M2"],
    ["y y", "y2"],
    ["R U R'", "R U R'"],
  ])("%s → %s", (input, expected) => {
    expect(tidy(words(input)).join(" ")).toBe(expected);
  });
});

describe("takeTokens", () => {
  it.each(["R U R' U'", "M2 U M U2 M' U M2", "r U R' U' r' F R F'", "y R U R'", "R U2 R' x' U' R U", "F R U R' U' F'", "R2 D' R U2 R' D R U2 R"])(
    "reads %s back as it was done",
    (alg) => {
      expect(takeTokens(cubeTake(alg)).join(" ")).toBe(alg);
    },
  );

  it("reads a slow double flick as a half turn", () => {
    const take: Take = {
      moves: [
        { move: "R", t: 0 },
        { move: "R", t: 220 },
        { move: "U", t: 400 },
      ],
      rotations: [],
    };
    expect(takeTokens(take)).toEqual(["R2", "U"]);
  });

  it("drops a turn that was undone", () => {
    const take: Take = {
      moves: ["R", "U", "U'", "R'", "F"].map((move, i) => ({ move, t: i * 200 })),
      rotations: [],
    };
    expect(takeTokens(take)).toEqual(["F"]);
  });

  it("names turns after a regrip in the new view", () => {
    // After y the old back face is on his right.
    const take: Take = { moves: ["B", "U", "B'"].map((move, i) => ({ move, t: i * 200 })), rotations: [{ rotation: "y", after: 0, t: 0 }] };
    expect(takeTokens(take)).toEqual(["y", "R", "U", "R'"]);
  });
});

describe("moveCount", () => {
  it.each([
    [[], 0],
    [["y", "R", "U", "R'"], 3],
    [["M2", "U", "M2"], 3],
  ])("%j has %i moves", (tokens, expected) => {
    expect(moveCount(tokens)).toBe(expected);
  });
});

describe("asAlg", () => {
  // The cube shows a case behind a random U turn: target · pre · alg = goal.
  const behind = (caseId: string, pre: string) => applyAlg(caseState(caseId), invertAlg(parseAlg(pre)));

  it.each(["PLL-T", "OLL-27", "COLL-T3", "EPLL-Ua"])("writes %s's own alg back exactly, from any U turn he lined it up with", (caseId) => {
    const alg = words(getCase(caseId).algs[0]!);
    const bare = alg[0]?.startsWith("U") ? alg.slice(1) : alg;
    for (const pre of AUFS) {
      expect(asAlg(caseId, [...(pre ? [pre] : []), ...bare]).join(" ")).toBe(tidy(alg).join(" "));
    }
  });

  it.each(["y", "y'", "y2"])("drops a last-layer %s regrip in front, keeping an alg that solves the drawn case", (y) => {
    const tokens = asAlg("OLL-27", [y, ...words("R U R' U R U2 R'")]);
    expect(tokens.filter((token) => token.startsWith("y"))).toEqual([]);
    expect(solves("OLL-27", caseState("OLL-27"), tokens)).toBe(true);
    expect(tokens.slice(-7).join(" ")).toBe("R U R' U R U2 R'");
  });

  it("keeps a regrip that isn't round the last layer", () => {
    expect(asAlg("PLL-Aa", words("x R' U R' D2 R U' R' D2 R2 x'")).join(" ")).toBe("x R' U R' D2 R U' R' D2 R2");
  });

  it("writes F2L's U turn in front against the drawn case", () => {
    for (const pre of AUFS) expect(asAlg("F2L-1", [...(pre ? [pre] : []), "R", "U'", "R'"]).join(" ")).toBe("U R U' R'");
  });

  it.each([
    ["F2L-2", "U' F' U F"],
    ["F2L-2", "y U' L' U L"],
    ["F2L-1", "R' F R F'"],
  ])("keeps his own %s alg %s, which the catalog doesn't have", (caseId, alg) => {
    const tokens = asAlg(caseId, words(alg));
    expect(tokens.join(" ")).toBe(alg);
    expect(solves(caseId, caseState(caseId), tokens)).toBe(true);
  });

  it("keeps an F2L y in front: it picks the slot", () => {
    // F2L 3 done from the other side: after y the front-right slot is front-left, so the alg is written with L.
    const view = new FrameTracker();
    view.rotate("y");
    const centre = new FrameTracker();
    const mirrored = words(getCase("F2L-3").algs[0]!).flatMap((token) => centre.apply(token).turns.map((turn) => view.name(turn)));
    const tokens = asAlg("F2L-3", ["y", ...mirrored]);
    expect(tokens[0]).toBe("y");
    expect(solves("F2L-3", caseState("F2L-3"), tokens)).toBe(true);
  });

  it("keeps a take that doesn't solve the drawn case as it was done", () => {
    expect(asAlg("PLL-T", ["R", "U", "R'"])).toEqual(["R", "U", "R'"]);
  });

  it("drops rotations after the last turn", () => {
    expect(asAlg("OLL-27", [...words("R U R' U R U2 R'"), "y"]).join(" ")).toBe("R U R' U R U2 R'");
  });

  it.each(AUFS)("turns a take on the case behind %j into an alg for the drawn case", (pre) => {
    const bare = words("R' F' r U R U' r' F");
    const shown = behind("COLL-T3", pre);
    const lineUp = AUFS.find((auf) => solves("COLL-T3", shown, auf ? [auf, ...bare] : bare));
    expect(lineUp).toBeDefined();
    const tokens = asAlg("COLL-T3", lineUp ? [lineUp, ...bare] : bare);
    expect(solves("COLL-T3", caseState("COLL-T3"), tokens)).toBe(true);
  });
});

describe("testLine", () => {
  it.each([
    ["PLL-T", ""],
    ["PLL-T", "U"],
    ["COLL-T3", "U2"],
    ["F2L-1", "U'"],
    ["EO-line", "U"],
  ])("plays %s behind %s to its goal", (caseId, pre) => {
    const from = applyAlg(caseState(caseId), invertAlg(parseAlg(pre)));
    const line = testLine(caseId, from);
    expect(line).not.toBeNull();
    expect(solves(caseId, from, line ?? [])).toBe(true);
  });
});
