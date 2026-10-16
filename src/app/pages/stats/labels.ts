import type { Part } from "@/app/lib/ratings";
import type { Line, Range, XAxis } from "./prefs";

// What the stats tab shows for each stored option: sentence case, notation (ao12, F2L, LL, 7d) as written.

export const X_AXIS_LABEL: Readonly<Record<XAxis, string>> = { solve: "Solve", date: "Date" };
export const RANGE_LABEL: Readonly<Record<Range, string>> = { "7d": "7d", "30d": "30d", all: "All" };
export const LINE_LABEL: Readonly<Record<Line, string>> = { ao12: "ao12", ao100: "ao100", pb: "PB" };
export const PART_LABEL: Readonly<Record<Part, string>> = { cross: "Cross", f2l: "F2L", ll: "LL" };
/** One solve's own splits, named as the timer's split chips name them. */
export const SPLIT_LABEL: Readonly<Record<Part, string>> = { cross: "Cross", f2l: "F2L", ll: "Last layer" };
