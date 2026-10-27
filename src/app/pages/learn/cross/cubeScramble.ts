import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { smartCube } from "@/app/smartcube/connection";
import { solveFix } from "@/app/smartcube/fixup";
import { CubeSession, type FinishedSolve, type SessionView } from "@/app/smartcube/session";
import { heldAtScramble } from "@/app/smartcube/attitude";
import type { Hold } from "@/app/smartcube/follower";

/** Each session's current "solve finished" callback, so the session (made once) always calls the latest one. */
const finishHandlers = new WeakMap<CubeSession, (solve: FinishedSolve) => void>();

export type CubeScramble = {
  /** The timer's scramble-following view: progress band, corrections, and "ready" once the cube matches. */
  view: SessionView;
  /** When the cube reached the scramble (host ms), or null until it does. */
  readyAt: number | null;
  /** How the cube was held then, for the cube on screen to follow from (null until then). */
  hold: Hold | null;
};

/**
 * Leads the smart cube onto `scramble` with the timer's own scramble tracking (any order of turns that reaches a
 * prefix counts, and strays get correction moves). By default it stops listening once the cube matches, so from
 * then on the drill reads the turns itself. With `onSolved` (a drill that is a whole solve, like lookahead) it keeps
 * following, gyro included, and hands over the finished solve as the timer would save it: turns, rotations,
 * analysis. Mount it once per attempt: each instance follows one scramble.
 */
export function useCubeScramble(scramble: string, active: boolean, onSolved?: (solve: FinishedSolve) => void): CubeScramble {
  const [session] = useState(() => {
    const cubeSession: CubeSession = new CubeSession({
      inspection: () => false,
      orientationReference: () => smartCube.orientationReference,
      solveFix,
      // A whole solve waits a moment after the last turn, like the timer, so a final M2's core rotation is caught.
      ...(onSolved ? {} : { settleMs: 0 }),
      onFinish: (solve) => finishHandlers.get(cubeSession)?.(solve),
    });
    return cubeSession;
  });
  useEffect(() => {
    if (onSolved) finishHandlers.set(session, onSolved);
    else finishHandlers.delete(session);
  }, [onSolved, session]);
  const [ready, setReady] = useState<{ at: number; hold: Hold } | null>(null);
  const subscribe = useCallback((listener: () => void) => session.subscribe(listener), [session]);
  const view = useSyncExternalStore(subscribe, () => session.view());

  const wholeSolve = onSolved !== undefined;
  useEffect(() => {
    if (!active) return;
    let following = true;
    let readyAtSet = false;
    let followedBand = false;
    const off = [
      session.subscribe(() => {
        const { phase } = session.view();
        if (phase === "scrambling") followedBand = true;
        if (readyAtSet || phase !== "ready") return;
        readyAtSet = true;
        if (!wholeSolve) following = false;
        // Read now, not once React renders: the cube may already be turning over.
        setReady({ at: performance.now(), hold: heldAtScramble(followedBand) });
      }),
      smartCube.onMove((move, hostT, cubeT) => {
        if (following) session.move(move, hostT, cubeT);
      }),
      smartCube.onGyro((q, hostT) => {
        if (following) session.gyro(q, hostT);
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
  }, [active, scramble, session, wholeSolve]);

  return { view, readyAt: ready?.at ?? null, hold: ready?.hold ?? null };
}
