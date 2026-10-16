import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { smartCube } from "@/app/smartcube/connection";
import { solveFix } from "@/app/smartcube/fixup";
import { CubeSession, type SessionView } from "@/app/smartcube/session";

export type CubeScramble = {
  /** The timer's scramble-following view: progress band, corrections, and "ready" once the cube matches. */
  view: SessionView;
  /** When the cube reached the scramble (host ms), or null until it does. */
  readyAt: number | null;
};

/**
 * Leads the smart cube onto `scramble` with the timer's own scramble tracking (any order of turns that reaches a
 * prefix counts, and strays get correction moves). It stops listening once the cube matches, so from then on the
 * drill reads the turns itself. Mount it once per attempt: each instance follows one scramble.
 */
export function useCubeScramble(scramble: string, active: boolean): CubeScramble {
  const [session] = useState(
    () =>
      new CubeSession({
        inspection: () => false,
        orientationReference: () => null,
        solveFix,
        settleMs: 0,
        // The drill takes over at the scramble, so this session never times a solve to the end.
        onFinish: () => undefined,
      }),
  );
  const [readyAt, setReadyAt] = useState<number | null>(null);
  const subscribe = useCallback((listener: () => void) => session.subscribe(listener), [session]);
  const view = useSyncExternalStore(subscribe, () => session.view());

  useEffect(() => {
    if (!active) return;
    let following = true;
    const off = [
      session.subscribe(() => {
        if (!following || session.view().phase !== "ready") return;
        following = false;
        setReadyAt(performance.now());
      }),
      smartCube.onMove((move, hostT, cubeT) => {
        if (following) session.move(move, hostT, cubeT);
      }),
      smartCube.onFacelets((state, hostT) => {
        if (following) session.facelets(state, hostT);
      }),
      smartCube.onLost(() => session.connectionLost()),
    ];
    // The link keeps following the cube between drills; start from what it knows.
    const known = smartCube.state.cube;
    if (known) session.facelets(known, performance.now());
    session.setScramble(scramble);
    return () => off.forEach((unsubscribe) => unsubscribe());
  }, [active, scramble, session]);

  return { view, readyAt };
}
