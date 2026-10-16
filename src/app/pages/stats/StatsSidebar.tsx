import type { ReactNode } from "react";
import { averageOf, resultMs } from "@/app/lib/averages";
import { PARTS } from "@/app/lib/ratings";
import { useSolves } from "@/app/lib/store";
import { showTime } from "./chart";
import { isCharted } from "./data";
import { LINE_LABEL, PART_LABEL, RANGE_LABEL, X_AXIS_LABEL } from "./labels";
import { LineKey } from "./LineKey";
import {
  LINES,
  RANGES,
  setRange,
  setXAxis,
  toggleLine,
  toggleSplit,
  useStatsPrefs,
  X_AXES,
} from "./prefs";
import "./stats.css";

type SegmentedProps<T extends string> = {
  label: string;
  options: readonly T[];
  labels: Readonly<Record<T, string>>;
  value: T;
  onChange: (value: T) => void;
};

/** The shared segmented switch (`.switch`), stretched to the sidebar's width. */
function Segmented<T extends string>({ label, options, labels, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="switch" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option} role="radio" aria-checked={option === value} className={option === value ? "on" : ""} onClick={() => onChange(option)}>
          {labels[option]}
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
  const results = solves.filter((s) => isCharted(s)).map(resultMs);
  return (
    <div className="stats-controls">
      <div className="stats-group switches">
        <Segmented label="X axis" options={X_AXES} labels={X_AXIS_LABEL} value={prefs.x} onChange={setXAxis} />
        <Segmented label="Range" options={RANGES} labels={RANGE_LABEL} value={prefs.range} onChange={setRange} />
      </div>
      <div className="stats-group" role="group" aria-label="Lines">
        {LINES.map((line) => (
          <Toggle key={line} label={LINE_LABEL[line]} on={prefs.lines[line]} onToggle={() => toggleLine(line)}>
            <LineKey line={line} />
          </Toggle>
        ))}
      </div>
      <div className="stats-group" role="group" aria-label="Splits">
        {PARTS.map((part) => (
          <Toggle key={part} label={PART_LABEL[part]} on={prefs.splits[part]} onToggle={() => toggleSplit(part)} />
        ))}
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
