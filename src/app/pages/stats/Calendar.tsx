import { memo, useState, type KeyboardEvent } from "react";
import { calendarLevel, type CalendarDay } from "./data";
import { formatDay } from "./scale";

const CELL = 10;
const GAP = 3;
const PITCH = CELL + GAP;
const LABELS = 14;
const DAY = 86_400_000;
const monthLabel = new Intl.DateTimeFormat("en-US", { month: "short" });

type Props = {
  columns: readonly (readonly CalendarDay[])[];
  /** The main chart's window in time, when zoomed: days outside it fade. */
  highlight: readonly [number, number] | null;
  onPick: (day: CalendarDay) => void;
};

type Cell = { day: CalendarDay; column: number; row: number };

/** The last 26 weeks, one cell per day, darker for busier days; a day with solves zooms the chart to it. */
export const Calendar = memo(function Calendar({ columns, highlight, onPick }: Props) {
  const cells: Cell[] = columns.flatMap((days, column) => days.map((day, row) => ({ day, column, row })));
  const max = Math.max(0, ...cells.map((c) => c.day.count));
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const width = Math.max(0, columns.length * PITCH - GAP);
  const height = LABELS + 7 * PITCH - GAP;
  const active = hovered ?? focused;
  const activeCell = active === null ? undefined : cells[active];

  const months: { column: number; label: string }[] = [];
  columns.forEach((days, column) => {
    const first = days[0];
    if (!first) return;
    const month = new Date(first.start).getMonth();
    const previous = columns[column - 1]?.[0];
    if (previous && new Date(previous.start).getMonth() === month) return;
    // The first column's month is only labelled when its label has room before the next one.
    if (!previous && new Date(first.start + 21 * DAY).getMonth() !== month) return;
    months.push({ column, label: monthLabel.format(first.start) });
  });

  function inWindow(day: CalendarDay): boolean {
    return !highlight || (day.start + DAY > highlight[0] && day.start <= highlight[1]);
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const current = focused ?? cells.length - 1;
    const moves: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    const move = moves[e.key];
    if (move !== undefined) {
      setFocused(Math.max(0, Math.min(cells.length - 1, current + move)));
      e.preventDefault();
      return;
    }
    if (e.key !== "Enter" && e.key !== " ") return;
    const cell = cells[current];
    if (cell && cell.day.count > 0) onPick(cell.day);
    e.preventDefault();
  }

  const tipLeft = activeCell ? activeCell.column * PITCH + CELL / 2 : 0;
  const tipAlign = activeCell && activeCell.column > columns.length - 6 ? "end" : activeCell && activeCell.column < 5 ? "start" : "middle";

  return (
    <div className="calendar" style={{ width }}>
      <svg
        width={width}
        height={height}
        tabIndex={0}
        role="group"
        aria-label="Solves per day, last 26 weeks. Arrow keys move between days, Enter zooms the chart to one."
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          // Only keyboard focus picks a day to show; a click focuses the grid too, and the pointer already shows one.
          if (e.currentTarget.matches(":focus-visible")) setFocused((f) => f ?? cells.length - 1);
        }}
        onBlur={() => setFocused(null)}
        onPointerLeave={() => setHovered(null)}
      >
        {months.map((m) => (
          <text key={m.column} className="calendar-month" x={m.column * PITCH} y={10}>
            {m.label}
          </text>
        ))}
        {cells.map((cell, i) => (
          <rect
            key={cell.day.start}
            className={[
              `level-${calendarLevel(cell.day.count, max)}`,
              inWindow(cell.day) ? "" : "out",
              cell.day.count > 0 ? "has" : "",
              i === focused ? "focus" : "",
            ].join(" ")}
            x={cell.column * PITCH}
            y={LABELS + cell.row * PITCH}
            width={CELL}
            height={CELL}
            rx={2.5}
            onPointerEnter={() => setHovered(i)}
            onClick={() => cell.day.count > 0 && onPick(cell.day)}
          />
        ))}
      </svg>
      {activeCell && (
        <div
          className={`calendar-tip align-${tipAlign}`}
          style={{ left: tipLeft, top: LABELS + activeCell.row * PITCH - 4 }}
        >
          {formatDay(activeCell.day.start)} · {activeCell.day.count} {activeCell.day.count === 1 ? "solve" : "solves"}
        </div>
      )}
    </div>
  );
});
