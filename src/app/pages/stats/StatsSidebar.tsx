import type { ReactNode } from "react";
import { averageOf, resultMs } from "@/app/lib/averages";
import { PARTS } from "@/app/lib/ratings";
import { useSolves } from "@/app/lib/store";
import { showTime } from "./chart";
import { isCharted } from "./data";
import { LineKey } from "./LineKey";
import {
  LINES,
  RANGES,
  setRange,
  setVirtual,
  setXAxis,
  toggleLine,
  toggleSplit,
  useStatsPrefs,
  X_AXES,
} from "./prefs";
import "./stats.css";

function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="stats-seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option} role="radio" aria-checked={option === value} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, on, onToggle, children }: { label: string; on: boolean; onToggle: () => void; children?: ReactNode }) {
  return (
    <button className="stats-toggle" role="switch" aria-checked={on} onClick={onToggle}>
      <span className="name">
        {label}
        {children}
      </span>
      <span className="track" aria-hidden="true">
        <span className="knob" />
      </span>
    </button>
  );
}

/** The stats tab's sidebar: the chart controls, then the current averages. */
export function StatsSidebar() {
  const prefs = useStatsPrefs();
  const solves = useSolves();
  const results = solves.filter((s) => isCharted(s, prefs.virtual)).map(resultMs);
  return (
    <div className="stats-controls">
      <div className="stats-group">
        <Segmented label="x axis" options={X_AXES} value={prefs.x} onChange={setXAxis} />
        <Segmented label="range" options={RANGES} value={prefs.range} onChange={setRange} />
      </div>
      <div className="stats-group toggles" role="group" aria-label="lines">
        {LINES.map((line) => (
          <Toggle key={line} label={line} on={prefs.lines[line]} onToggle={() => toggleLine(line)}>
            <LineKey line={line} />
          </Toggle>
        ))}
      </div>
      <div className="stats-group toggles" role="group" aria-label="splits">
        {PARTS.map((part) => (
          <Toggle key={part} label={part} on={prefs.splits[part]} onToggle={() => toggleSplit(part)} />
        ))}
      </div>
      <div className="stats-group toggles">
        <Toggle label="virtual" on={prefs.virtual} onToggle={() => setVirtual(!prefs.virtual)} />
      </div>
      <dl className="averages">
        <dt>ao5</dt>
        <dd>{showTime(averageOf(results, 5))}</dd>
        <dt>ao12</dt>
        <dd>{showTime(averageOf(results, 12))}</dd>
        <dt>ao100</dt>
        <dd>{showTime(averageOf(results, 100))}</dd>
      </dl>
    </div>
  );
}
