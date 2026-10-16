import { useMemo } from "react";
import { solverPalette } from "@/app/cube3d/looks";
import { facelets, type Face } from "@/app/lib/facelets";
import { useSettings } from "@/app/lib/settings";
import { caseArrows, caseState, viewState, type CaseArrow, type CaseDef, type CubeState } from "@/cube";

/** Sticker colours by solver-frame face (yellow on top, green in front): the cube look's, so diagrams match the 3D cube. */
type Palette = Readonly<Record<Face, string>>;

const MUTED = "#d3cabd";
const EDGE_INDEX = new Set([1, 3, 5, 7]);

type Stickers = Record<Face, Face[]>;

/** What a set asks you to recognise: OLL and EO only care which stickers are yellow, EO only on edges. */
function colourFor(palette: Palette, set: CaseDef["set"], color: Face, isEdge: boolean): string {
  if (set === "OLL") return color === "U" ? palette.U : MUTED;
  if (set === "EO") return isEdge && color === "U" ? palette.U : MUTED;
  return palette[color];
}

type Props = {
  caseDef: CaseDef;
  size?: number;
  /** iso: top, front and right faces (the learn grid); top: the last layer from above (summaries). */
  view?: "auto" | "iso" | "top";
  /** A case not learned yet: only the cube's outline, like the empty cubes in the mockup's grid. */
  ghost?: boolean;
  /** His alg for the case: the picture turns to the angle he starts it from. */
  alg?: string;
  /** Draw where each piece goes (PLL / EPLL, top view), like jperm.net. */
  arrows?: boolean;
};

function arrowsFor(caseDef: CaseDef, alg: string | undefined): CaseArrow[] {
  try {
    return caseArrows(caseDef.id, alg ?? caseDef.algs[0] ?? "");
  } catch (error) {
    console.warn(`No arrows for ${caseDef.id}`, error);
    return [];
  }
}

function stateFor(caseDef: CaseDef, alg: string | undefined): CubeState {
  if (!alg) return caseState(caseDef.id);
  try {
    return viewState(caseDef.id, alg);
  } catch (error) {
    // An alg that can't be placed (typed oddly, or for another case) still shows the case, at the usual angle.
    console.warn(`Can't place ${alg} on ${caseDef.id}`, error);
    return caseState(caseDef.id);
  }
}

/**
 * A small picture of a case, drawn from the engine's state. By default the last layer from above with its side
 * stickers for last-layer sets, and the top, front and right faces for F2L.
 */
export function CaseDiagram({ caseDef, size = 64, view = "auto", ghost = false, alg, arrows = false }: Props) {
  const stickers = useMemo(() => facelets(stateFor(caseDef, alg)), [caseDef, alg]);
  const trips = useMemo(() => (arrows ? arrowsFor(caseDef, alg) : []), [arrows, caseDef, alg]);
  const { cubeLook } = useSettings();
  const palette = useMemo(() => solverPalette(cubeLook), [cubeLook]);
  const iso = view === "iso" || (view === "auto" && caseDef.set === "F2L");
  return iso ? (
    <Iso stickers={stickers} set={caseDef.set} size={size} ghost={ghost} palette={palette} />
  ) : (
    <TopView stickers={stickers} set={caseDef.set} size={size} palette={palette} arrows={trips} />
  );
}

function TopView({ stickers, set, size, palette, arrows = [] }: { stickers: Stickers; set: CaseDef["set"]; size: number; palette: Palette; arrows?: readonly CaseArrow[] }) {
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
      rects.push({ x: o + col * cell, y: o + row * cell, w: cell, h: cell, fill: colourFor(palette, set, top(row, col), EDGE_INDEX.has(index)) });
    }
  }
  // Side stickers of the top layer, laid around the top face as seen from above.
  for (let i = 0; i < 3; i++) {
    const isEdge = i === 1;
    rects.push({ x: o + i * cell, y: o + cell * 3 + gap, w: cell, h: strip, fill: colourFor(palette, set, stickers.F[i] ?? "F", isEdge) });
    rects.push({ x: o + cell * 3 + gap, y: o + (2 - i) * cell, w: strip, h: cell, fill: colourFor(palette, set, stickers.R[i] ?? "R", isEdge) });
    rects.push({ x: o + (2 - i) * cell, y: 0, w: cell, h: strip, fill: colourFor(palette, set, stickers.B[i] ?? "B", isEdge) });
    rects.push({ x: 0, y: o + i * cell, w: strip, h: cell, fill: colourFor(palette, set, stickers.L[i] ?? "L", isEdge) });
  }
  // Arrows join sticker centres; a swap (A to B and B to A) is one line with a head at each end.
  const centre = (index: number) => ({ x: o + (index % 3) * cell + cell / 2, y: o + Math.floor(index / 3) * cell + cell / 2 });
  const lines = arrows.flatMap((arrow) => {
    const swap = arrows.some((other) => other.from === arrow.to && other.to === arrow.from);
    if (swap && arrow.from > arrow.to) return [];
    return [{ ...arrow, swap }];
  });
  return (
    <svg className="case-diagram" width={size} height={size} viewBox={`-1 -1 ${span + 2} ${span + 2}`} aria-hidden="true">
      <defs>
        <marker id="case-arrow-head" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L6,3 L0,6 z" fill="#3a2e28" />
        </marker>
      </defs>
      {rects.map((r, i) => (
        <rect key={i} x={r.x + 0.4} y={r.y + 0.4} width={r.w - 0.8} height={r.h - 0.8} rx={1.4} fill={r.fill} stroke="#3a2e28" strokeOpacity={0.25} strokeWidth={0.5} />
      ))}
      {lines.map(({ from, to, swap }) => {
        const a = centre(from);
        const b = centre(to);
        // Stop short of the centres so the heads sit inside the stickers.
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy) || 1;
        const inset = cell * 0.28;
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x + (dx / length) * inset}
            y1={a.y + (dy / length) * inset}
            x2={b.x - (dx / length) * inset}
            y2={b.y - (dy / length) * inset}
            stroke="#3a2e28"
            strokeWidth={0.9}
            strokeLinecap="round"
            markerEnd="url(#case-arrow-head)"
            markerStart={swap ? "url(#case-arrow-head)" : undefined}
          />
        );
      })}
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
function Iso({ stickers, set, size, ghost, palette }: { stickers: Stickers; set: CaseDef["set"]; size: number; ghost: boolean; palette: Palette }) {
  const polys: { points: string; fill: string }[] = [];
  // Only the top layer's side stickers matter for OLL and EO; the layers below are F2L, already solved.
  const side = (face: "F" | "R", r: number, c: number) => {
    const color = stickers[face][r * 3 + c] ?? face;
    return r === 0 ? colourFor(palette, set, color, c === 1) : set === "OLL" || set === "EO" ? MUTED : palette[color];
  };
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      polys.push({ points: quad([[c, 3, r], [c + 1, 3, r], [c + 1, 3, r + 1], [c, 3, r + 1]]), fill: colourFor(palette, set, stickers.U[r * 3 + c] ?? "U", EDGE_INDEX.has(r * 3 + c)) });
      polys.push({ points: quad([[c, 3 - r, 3], [c + 1, 3 - r, 3], [c + 1, 2 - r, 3], [c, 2 - r, 3]]), fill: side("F", r, c) });
      polys.push({ points: quad([[3, 3 - r, 3 - c], [3, 3 - r, 2 - c], [3, 2 - r, 2 - c], [3, 2 - r, 3 - c]]), fill: side("R", r, c) });
    }
  }
  const w = 3 * COS30 * 2;
  return (
    <svg className={`case-diagram ${ghost ? "ghost" : ""}`} width={size} height={size} viewBox={`${-w / 2 - 0.2} ${-3.2} ${w + 0.4} ${6.4}`} aria-hidden="true">
      {polys.map((p, i) => (
        <polygon
          key={i}
          points={p.points}
          fill={ghost ? "none" : p.fill}
          stroke="#3a2e28"
          strokeOpacity={ghost ? 0.22 : 0.55}
          strokeWidth={ghost ? 0.05 : 0.08}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
