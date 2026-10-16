// An alg in the chunks a solver learns it by: the alg's own brackets when it has them ("(R U R' U') R' F ..."), else
// the common triggers found in it, longest first, with the moves between them grouped (a single one joins the
// trigger after it as its setup move).

/** Triggers as written, longest first so "R U R' U'" wins over "R U R'". */
const TRIGGERS: readonly (readonly string[])[] = [
  "F R U R' U' F'",
  "f R U R' U' f'",
  "F' L' U' L U F",
  "R U R' U R U2 R'",
  "R' U' R U' R' U2 R",
  "L' U' L U' L' U2 L",
  "R U R' U'",
  "U R U' R'",
  "R' U' R U",
  "U' R' U R",
  "L' U' L U",
  "L U L' U'",
  "R' F R F'",
  "F R' F' R",
  "r U R' U'",
  "r' F R F'",
  "R U R' F'",
  "R U2 R'",
  "R' U2 R",
  "R U R'",
  "R U' R'",
  "R' U R",
  "R' U' R",
  "L U L'",
  "L' U' L",
  "L' U L",
  "L U' L'",
  "F U F'",
  "F' U' F",
  "M' U M",
  "M U M'",
]
  .map((trigger) => trigger.split(" "))
  .sort((a, b) => b.length - a.length);

/** Moves between triggers are grouped up to this many before a new chunk starts. */
const MAX_LOOSE = 4;

/** One chunk: its moves as written and the index of its first move among all the alg's moves. */
export type AlgChunk = { moves: string[]; start: number };

function bracketChunks(alg: string): string[][] | null {
  if (!/[()]/.test(alg)) return null;
  const chunks: string[][] = [];
  for (const piece of alg.split(/([()])/)) {
    if (piece === "(" || piece === ")") continue;
    const moves = piece.trim().split(/\s+/).filter(Boolean);
    if (moves.length > 0) chunks.push(moves);
  }
  return chunks;
}

function triggerChunks(moves: readonly string[]): string[][] {
  const chunks: string[][] = [];
  let loose: string[] = [];
  const flush = (): void => {
    if (loose.length > 0) chunks.push(loose);
    loose = [];
  };
  for (let i = 0; i < moves.length; ) {
    const trigger = TRIGGERS.find((t) => t.every((move, k) => moves[i + k] === move));
    if (trigger) {
      // A single move before a trigger is its setup (D2 then R U' R'): one chunk.
      const setup = loose.length === 1 ? loose : [];
      if (setup.length === 0) flush();
      loose = [];
      chunks.push([...setup, ...moves.slice(i, i + trigger.length)]);
      i += trigger.length;
      continue;
    }
    loose.push(moves[i]!);
    if (loose.length >= MAX_LOOSE) flush();
    i++;
  }
  flush();
  return chunks;
}

/** The alg's moves as written (brackets dropped, one entry per move), in chunks. */
export function algChunks(alg: string): AlgChunk[] {
  const moves = alg.replace(/[()[\]]/g, " ").trim().split(/\s+/).filter(Boolean);
  const chunks = bracketChunks(alg) ?? triggerChunks(moves);
  let start = 0;
  return chunks.map((chunk) => {
    const out = { moves: chunk, start };
    start += chunk.length;
    return out;
  });
}
