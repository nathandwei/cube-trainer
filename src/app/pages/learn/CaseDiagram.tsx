import { useMemo } from "react";
import { facelets, type Face } from "@/app/lib/facelets";
import { caseState, type CaseDef } from "@/cube";

/** Muted sticker colours for the solver frame (yellow on top, green in front), matching the oat palette. */
const COLOR: Record<Face, string> = {
  U: "#e8c547",
  D: "#f3eee5",
  F: "#4a9461",
  B: "#3a6fae",
  R: "#e07a36",
  L: "#c2493c",
};
const MUTED = "#d3cabd";
const EDGE_INDEX = new Set([1, 3, 5, 7]);

type Stickers = Record<Face, Face[]>;

/** What a set asks you to recognise: OLL and EO only care which stickers are yellow, EO only on edges. */
function colourFor(set: CaseDef["set"], color: Face, isEdge: boolean): string {
  if (set === "OLL") return color === "U" ? COLOR.U : MUTED;
  if (set === "EO") return isEdge && color === "U" ? COLOR.U : MUTED;
  return COLOR[color];
}

/**
 * A small picture of a case, drawn from the engine's state: the last layer from above with its side stickers for
 * last-layer sets, or the top, front and right faces for F2L.
 */
export function CaseDiagram({ caseDef, size = 64 }: { caseDef: CaseDef; size?: number }) {
  const stickers = useMemo(() => facelets(caseState(caseDef.id)), [caseDef.id]);
  return caseDef.set === "F2L" ? <Iso stickers={stickers} size={size} /> : <TopView stickers={stickers} set={caseDef.set} size={size} />;
}

function TopView({ stickers, set, size }: { stickers: Stickers; set: CaseDef["set"]; size: number }) {
  const cell = 10;
  const strip = 3;
  const gap = 1.2;
  const span = strip + gap + cell * 3 + gap + strip;
  const top = (row: number, col: number) => stickers.U[row * 3 + col] ?? "U";
  const rects: { x: number; y: number; w: number; h: number; fill: string }[] = [];
  const o = strip + gap;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const index = row * 3 + col;
      rects.push({ x: o + col * cell, y: o + row * cell, w: cell, h: cell, fill: colourFor(set, top(row, col), EDGE_INDEX.has(index)) });
    }
  }
  // Side stickers of the top layer, laid around the top face as seen from above.
  for (let i = 0; i < 3; i++) {
    const isEdge = i === 1;
    rects.push({ x: o + i * cell, y: o + cell * 3 + gap, w: cell, h: strip, fill: colourFor(set, stickers.F[i] ?? "F", isEdge) });
    rects.push({ x: o + cell * 3 + gap, y: o + (2 - i) * cell, w: strip, h: cell, fill: colourFor(set, stickers.R[i] ?? "R", isEdge) });
    rects.push({ x: o + (2 - i) * cell, y: 0, w: cell, h: strip, fill: colourFor(set, stickers.B[i] ?? "B", isEdge) });
    rects.push({ x: 0, y: o + i * cell, w: strip, h: cell, fill: colourFor(set, stickers.L[i] ?? "L", isEdge) });
  }
  return (
    <svg className="case-diagram" width={size} height={size} viewBox={`-1 -1 ${span + 2} ${span + 2}`} aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} x={r.x + 0.4} y={r.y + 0.4} width={r.w - 0.8} height={r.h - 0.8} rx={1.4} fill={r.fill} stroke="#3a2e28" strokeOpacity={0.25} strokeWidth={0.5} />
      ))}
    </svg>
  );
}

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;

function project(x: number, y: number, z: number): [number, number] {
  return [(x - z) * COS30, -y + (x + z) * SIN30];
}

function quad(points: readonly [number, number, number][]): string {
  return points.map(([x, y, z]) => project(x, y, z).map((v) => v.toFixed(2)).join(",")).join(" ");
}

/** Top, front and right faces in isometric view; x runs right, y up, z towards the viewer. */
function Iso({ stickers, size }: { stickers: Stickers; size: number }) {
  const polys: { points: string; fill: string }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      polys.push({ points: quad([[c, 3, r], [c + 1, 3, r], [c + 1, 3, r + 1], [c, 3, r + 1]]), fill: COLOR[stickers.U[r * 3 + c] ?? "U"] });
      polys.push({ points: quad([[c, 3 - r, 3], [c + 1, 3 - r, 3], [c + 1, 2 - r, 3], [c, 2 - r, 3]]), fill: COLOR[stickers.F[r * 3 + c] ?? "F"] });
      polys.push({ points: quad([[3, 3 - r, 3 - c], [3, 3 - r, 2 - c], [3, 2 - r, 2 - c], [3, 2 - r, 3 - c]]), fill: COLOR[stickers.R[r * 3 + c] ?? "R"] });
    }
  }
  const w = 3 * COS30 * 2;
  return (
    <svg className="case-diagram" width={size} height={size} viewBox={`${-w / 2 - 0.2} ${-3.2} ${w + 0.4} ${6.4}`} aria-hidden="true">
      {polys.map((p, i) => (
        <polygon key={i} points={p.points} fill={p.fill} stroke="#3a2e28" strokeOpacity={0.35} strokeWidth={0.06} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
