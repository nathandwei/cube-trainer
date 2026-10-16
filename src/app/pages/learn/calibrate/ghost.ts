// The ghost cube: a case on screen that follows his smart cube, whatever state the cube itself is in. His turns
// (named by centre colour, as the cube reports them) play on the case and his regrips turn it with him, so he can
// show how he solves a case without first scrambling his cube into it.
//
// The gyro only measures turning, so his grip needs a starting point: the grip saved by "reset orientation" if
// there is one, else the way the screen shows the case (yellow up, green in front) at his first turn. From then on
// it's followed from take to take, so a regrip before the first turn of a later take still counts.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { CubeHandle } from "@/app/components/CubeView";
import { smartCube } from "@/app/smartcube/connection";
import { startOrientation, type GridOrientation, type Quaternion } from "@/app/smartcube/gyro";
import { getCase } from "@/cube";
import type { Move } from "@/cube/types";
import { TakeStore, type TakeView } from "./take";

/** The gyro gets this long after the goal turn to report a final slice's or wide move's rotation. */
export const SETTLE_MS = 300;

export type GhostOptions = {
  /** The cube on screen: the ghost shows the case on it and plays every turn and regrip. */
  cube: RefObject<CubeHandle | null>;
  /** The case, shown as the catalog draws it (`z2 ${setup}`); a new one starts a fresh take. */
  caseId: string;
  /**
   * Off: his turns are ignored and the cube on screen is left alone (to show something else); the gyro is still
   * followed, so his grip is known when it's back on. Turning it on starts a fresh take.
   */
  active: boolean;
  /** Each of his turns, after it played on screen (centre frame, as the cube reported it). */
  onTurn?: (move: Move, take: TakeView) => void;
  /** Each regrip the gyro confirmed, as the cube on screen turned with him. */
  onRotation?: (rotations: readonly string[]) => void;
};

export type GhostCube = {
  /** The take: phase (waiting → turning → reached, or over past 30 moves), sealed, the moves so far, the alg. */
  take: TakeView;
  /** The case back on screen, the take cleared, and his grip read afresh at his next first turn. */
  reset: () => void;
  /** A move as he'd write it ("R", "M'", "y"), played as if turned on the cube (Test buttons). */
  play: (token: string) => void;
  /** He's holding the cube `grip` away from the solver's grip right now (known some other way, e.g. a scramble). */
  anchor: (grip: GridOrientation) => void;
};

function startingGrip(report: Quaternion | null): GridOrientation | null {
  return report ? startOrientation(smartCube.orientationReference, report) : null;
}

export function useGhostCube({ cube, caseId, active, onTurn, onRotation }: GhostOptions): GhostCube {
  const [store] = useState(() => new TakeStore());
  const take = useSyncExternalStore(store.subscribe, store.view);
  // Seeded with the cube's latest report, so the very first take can already use the grip saved by Reorient.
  const report = useRef<Quaternion | null>(smartCube.lastGyro);
  /** Reset asked for his grip to be read afresh. */
  const forget = useRef(false);
  const live = useRef(active);
  const callbacks = useRef({ onTurn, onRotation });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    live.current = active;
    callbacks.current = { onTurn, onRotation };
  });

  const animate = useCallback(
    (moves: readonly string[]) => {
      for (const move of moves) cube.current?.turn(move);
    },
    [cube],
  );

  // A fresh take on the case as drawn, turned to face him.
  useEffect(() => {
    if (!active) return;
    const grip = forget.current ? null : (store.grip ?? startingGrip(report.current));
    forget.current = false;
    cube.current?.setTempo(3);
    cube.current?.show(`z2 ${getCase(caseId).setup}`);
    animate(store.startAsDrawn(caseId, report.current, grip));
  }, [active, animate, caseId, cube, generation, store]);

  useEffect(() => {
    const off = [
      smartCube.onGyro((q, hostT) => {
        report.current = q;
        const shown = store.gyro(q, hostT);
        if (!live.current || shown.length === 0) return;
        animate(shown);
        callbacks.current.onRotation?.(shown);
      }),
      smartCube.onMove((move, hostT, cubeT) => {
        if (!live.current) return;
        animate(store.turn(move, hostT, cubeT));
        callbacks.current.onTurn?.(move, store.view());
      }),
    ];
    return () => off.forEach((unsubscribe) => unsubscribe());
  }, [animate, store]);

  useEffect(() => {
    if (take.phase !== "reached" || take.sealed) return;
    const timer = window.setTimeout(() => store.seal(), SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [store, take.phase, take.sealed]);

  const reset = useCallback(() => {
    forget.current = true;
    setGeneration((n) => n + 1);
  }, []);

  const play = useCallback((token: string) => animate(store.play(token, performance.now())), [animate, store]);

  const anchor = useCallback(
    (grip: GridOrientation) => {
      if (report.current) store.anchor(report.current, grip);
    },
    [store],
  );

  return { take, reset, play, anchor };
}
