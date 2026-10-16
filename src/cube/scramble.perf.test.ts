// Kept in its own file so cubing.js's solver is cold: the first timing includes loading min2phase and building its
// tables (in the browser it also includes starting the search worker, which this does not measure).
import { expect, it } from "vitest";
import { CASE_SETS } from "./cases";
import { createRng } from "./random";
import { caseScramble, crossScramble, xcrossScramble } from "./scramble";

async function timed(run: () => Promise<unknown>): Promise<number> {
  const started = performance.now();
  await run();
  return performance.now() - started;
}

function summary(times: readonly number[]): string {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, t) => sum + t, 0) / sorted.length;
  return `mean ${mean.toFixed(1)} ms, max ${sorted.at(-1)!.toFixed(0)} ms`;
}

it("generates case, cross and xcross scrambles quickly once warm", { timeout: 60_000 }, async () => {
  const rng = createRng(2026);
  const first = await timed(() => caseScramble("PLL-T", rng));
  const lines = [`first call (cold): ${first.toFixed(0)} ms`];
  const means: number[] = [];
  for (const set of CASE_SETS) {
    const times: number[] = [];
    for (let round = 0; round < 2; round++) {
      for (const { id } of set.cases) times.push(await timed(() => caseScramble(id, rng)));
    }
    lines.push(`${set.id}: ${summary(times)}`);
    means.push(times.reduce((sum, t) => sum + t, 0) / times.length);
  }
  for (const [name, scramble, max] of [
    ["cross", crossScramble, 8],
    ["xcross", xcrossScramble, 9],
  ] as const) {
    const times: number[] = [];
    for (let n = 0; n <= max; n++) for (let k = 0; k < 3; k++) times.push(await timed(() => scramble(n, rng)));
    lines.push(`${name}: ${summary(times)}`);
    means.push(times.reduce((sum, t) => sum + t, 0) / times.length);
  }
  console.info(`scramble timings\n  ${lines.join("\n  ")}`);
  expect(first).toBeLessThan(3000);
  for (const mean of means) expect(mean).toBeLessThan(150);
});
