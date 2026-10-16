import { SOLVED, type CubeState } from "@/cube";
import { SOLVER_FACE_COLORS, solverFacelets } from "./state";

// Faces in Kociemba order (U R F D L B, nine stickers each, as seen from outside) and where each sits in the cross:
// U above F, then L F R B in a row, D below F.
const PLACES: Record<string, { column: number; row: number }> = {
  U: { column: 1, row: 0 },
  L: { column: 0, row: 1 },
  F: { column: 1, row: 1 },
  R: { column: 2, row: 1 },
  B: { column: 3, row: 1 },
  D: { column: 1, row: 2 },
};
const ORDER = ["U", "R", "F", "D", "L", "B"];

/** A flat net of the cube in the solver's grip (white down, green front). Grey when the state is unknown. */
export function CubeNet({ state }: { state: CubeState | null }) {
  const facelets = solverFacelets(state ?? SOLVED);
  return (
    <div className={`cube-net ${state ? "" : "unknown"}`} role="img" aria-label={state ? "Cube state" : "Cube state unknown"}>
      {ORDER.map((face, f) => {
        const place = PLACES[face]!;
        return (
          <div key={face} className="face" style={{ gridColumn: place.column + 1, gridRow: place.row + 1 }}>
            {Array.from(facelets.slice(f * 9, f * 9 + 9)).map((sticker, i) => (
              <span key={i} className={`sticker ${SOLVER_FACE_COLORS[sticker] ?? ""}`} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
