// The scramble is written white-top (WCA); the solver holds white on the bottom, i.e. after "z2".
// A z2 turn swaps U with D and R with L and keeps the direction of every turn.
const Z2_FACE: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "F", B: "B" };

export function toSolverFrame(wcaMove: string): string {
  const face = Z2_FACE[wcaMove.charAt(0)];
  if (!face) throw new Error(`Not an outer face turn: ${wcaMove}`);
  return face + wcaMove.slice(1);
}

export function splitAlg(alg: string): string[] {
  return alg.trim().split(/\s+/).filter(Boolean);
}
