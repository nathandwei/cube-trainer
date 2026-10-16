import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { applyTurn, parseTurn, type Placement } from "./moves";

type Colour = "U" | "D" | "R" | "L" | "F" | "B";

const NORMALS: readonly [Vector3, Colour][] = [
  [new Vector3(1, 0, 0), "R"],
  [new Vector3(-1, 0, 0), "L"],
  [new Vector3(0, 1, 0), "U"],
  [new Vector3(0, -1, 0), "D"],
  [new Vector3(0, 0, 1), "F"],
  [new Vector3(0, 0, -1), "B"],
];

type Cubie = Placement & { stickers: [Vector3, Colour][] };

function solved(): Cubie[] {
  const cubies: Cubie[] = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        const home = new Vector3(x, y, z);
        if (home.lengthSq() === 0) continue;
        cubies.push({ position: home, quaternion: new Quaternion(), stickers: NORMALS.filter(([n]) => n.dot(home) > 0.5) });
      }
  return cubies;
}

function play(alg: string): Cubie[] {
  const cubies = solved();
  for (const move of alg.split(" ").filter(Boolean)) {
    const turn = parseTurn(move);
    if (!turn) throw new Error(`not a move: ${move}`);
    applyTurn(cubies, turn);
  }
  return cubies;
}

/** The colour showing at `at` on the face whose outward normal is `facing`. */
function colourAt(cubies: readonly Cubie[], at: [number, number, number], facing: Colour): Colour {
  const position = new Vector3(...at);
  const normal = NORMALS.find(([, colour]) => colour === facing)![0];
  const cubie = cubies.find((c) => c.position.distanceTo(position) < 1e-6)!;
  const sticker = cubie.stickers.find(([n]) => n.clone().applyQuaternion(cubie.quaternion).distanceTo(normal) < 1e-6);
  return sticker![1];
}

function key(cubies: readonly Cubie[]): string {
  return cubies.map((c) => [c.position.toArray(), c.quaternion.toArray().map((v) => v.toFixed(3))].join()).join("|");
}

describe("3D cube turns", () => {
  // Each move's direction against what any cuber knows it does (cube held white U, green F).
  it.each([
    ["R", [1, 1, 1], "U", "F"],
    ["L", [-1, 1, 1], "F", "U"],
    ["U", [-1, 1, 1], "L", "F"],
    ["D", [1, -1, 1], "R", "F"],
    ["F", [1, 1, 1], "R", "U"],
    ["B", [-1, 1, -1], "L", "U"],
    ["M", [0, 1, 1], "F", "U"],
    ["E", [1, 0, 1], "R", "F"],
    ["S", [1, 1, 0], "R", "U"],
    ["x", [0, 1, 0], "U", "F"],
    ["y", [-1, 0, 0], "L", "F"],
    ["z", [1, 0, 0], "R", "U"],
    ["r", [0, 1, 1], "U", "F"],
    ["Rw", [0, 1, 1], "U", "F"],
    ["l", [0, 1, 1], "F", "U"],
    ["u", [-1, 0, 1], "L", "F"],
  ] as const)("%s brings the right colour round", (move, at, facing, colour) => {
    expect(colourAt(play(move), [...at], facing)).toBe(colour);
  });

  it("turns only its layers", () => {
    expect(colourAt(play("R"), [0, 1, 1], "U")).toBe("U");
    expect(colourAt(play("r"), [-1, 1, 1], "U")).toBe("U");
  });

  it.each([
    ["R R'", ""],
    ["R2", "R R"],
    ["R2'", "R2"],
    ["U3", "U'"],
    ["M2", "M' M'"],
    ["x y z", "x y z"],
    ["R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'", ""],
  ])("%s is %s", (a, b) => {
    expect(key(play(a))).toBe(key(play(b)));
  });

  it("rejects what isn't a move", () => {
    expect(parseTurn("Q")).toBeNull();
    expect(parseTurn("Mw")).toBeNull();
    expect(parseTurn("R'2x")).toBeNull();
  });
});
