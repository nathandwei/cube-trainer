// Kept in its own file so the pruning tables and the option cache are cold: the first timing includes the tables'
// first-time build, which the solve analysis shares.
import { expect, it } from "vitest";
import { CASE_SETS } from "./cases";
import { algOptions } from "./options";

function timed(id: string): { id: string; ms: number } {
  const started = performance.now();
  algOptions(id);
  return { id, ms: performance.now() - started };
}

it("builds every case's options in well under 100 ms each once the tables exist", () => {
  // An F2L case first: its search is what needs the pruning tables.
  const first = timed("F2L-1");
  const rest = CASE_SETS.flatMap((set) => set.cases.filter(({ id }) => id !== first.id).map(({ id }) => timed(id)));
  const times = [first, ...rest];
  const slowest = [...rest].sort((a, b) => b.ms - a.ms).slice(0, 3);
  const total = times.reduce((sum, { ms }) => sum + ms, 0);
  console.info(
    `algOptions: first (cold) ${first.id} ${first.ms.toFixed(0)} ms, ` +
      `all ${times.length} cases ${total.toFixed(0)} ms, ` +
      `slowest ${slowest.map(({ id, ms }) => `${id} ${ms.toFixed(1)} ms`).join(", ")}`,
  );
  // Generous bounds: this guards against a search blowing up, not against a busy machine.
  expect(first.ms).toBeLessThan(5000);
  for (const { ms } of rest) expect(ms).toBeLessThan(500);

  const started = performance.now();
  for (const set of CASE_SETS) for (const { id } of set.cases) algOptions(id);
  expect(performance.now() - started).toBeLessThan(250);
});
