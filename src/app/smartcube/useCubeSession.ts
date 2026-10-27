import { useEffect, useSyncExternalStore } from "react";
import { ambientAttitude, heldAtScramble } from "./attitude";
import { smartCube } from "./connection";
import { solveFix } from "./fixup";
import { CubeSession, type FinishedSolve, type SessionView } from "./session";

type Options = {
  /** Cube mode is on: follow the app's cube link. */
  active: boolean;
  scramble: string;
  inspection: boolean;
  onFinish: (solve: FinishedSolve) => void;
};

// One attempt loop for the app, like the one cube link: it outlives a timer page that unmounts and comes back.
const handlers: Pick<Options, "inspection" | "onFinish"> = {
  inspection: false,
  onFinish: (solve) => console.error("A smart-cube solve finished with no timer page to save it", solve),
};

const session = new CubeSession({
  inspection: () => handlers.inspection,
  orientationReference: () => smartCube.orientationReference,
  solveFix,
  onFinish: (solve) => handlers.onFinish(solve),
});

const subscribe = (listener: () => void) => session.subscribe(listener);
const getView = () => session.view();

/** The timer's smart-cube attempt loop, fed by the app's cube link while `active`. */
export function useCubeSession({ active, scramble, inspection, onFinish }: Options): { view: SessionView; session: CubeSession } {
  useEffect(() => {
    handlers.inspection = inspection;
    handlers.onFinish = onFinish;
  }, [inspection, onFinish]);

  useEffect(() => {
    if (!active) return;
    // The link kept following the cube while cube mode was off; start from what it knows.
    const known = smartCube.state.cube;
    if (known) session.facelets(known, performance.now());
    // Reaching the scramble from the band, the cube is held as scrambled (white on top): the cubes on screen stand
    // upright from that grip.
    let phase = session.view().phase;
    const off = [
      session.subscribe(() => {
        const next = session.view().phase;
        if (phase === "scrambling" && (next === "ready" || next === "inspecting")) ambientAttitude.hold(heldAtScramble(true));
        phase = next;
      }),
      smartCube.onMove((move, hostT, cubeT) => session.move(move, hostT, cubeT)),
      smartCube.onGyro((q, hostT) => session.gyro(q, hostT)),
      smartCube.onFacelets((state, hostT) => session.facelets(state, hostT)),
      smartCube.onLost(() => session.connectionLost()),
    ];
    return () => off.forEach((unsubscribe) => unsubscribe());
  }, [active]);

  useEffect(() => {
    if (active) session.setScramble(scramble);
  }, [active, scramble]);

  return { view: useSyncExternalStore(subscribe, getView), session };
}
