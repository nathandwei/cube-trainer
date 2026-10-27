import { averageOf, formatAverage } from "@/app/lib/averages";

/** A drill's ao5 and ao12, as the timer has them, once there are five results (newest first; Infinity a DNF). */
export function DrillAverages({ results }: { results: readonly number[] }) {
  if (results.length < 5) return null;
  return (
    <dl className="drill-averages">
      <dt>ao5</dt>
      <dd>{formatAverage(averageOf(results, 5))}</dd>
      <dt>ao12</dt>
      <dd>{formatAverage(averageOf(results, 12))}</dd>
    </dl>
  );
}
