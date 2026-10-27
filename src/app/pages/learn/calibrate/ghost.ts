// The ghost cube: a case on screen that follows his smart cube, whatever state the cube itself is in. His turns
// (named by centre colour, as the cube reports them) play on the case and it's held the way his cube is, so he can
// show how he solves a case without first scrambling his cube into it.
//
// The case on screen is held the way his cube is (the app's shared attitude), centres where his are. His grip, for
// writing the take, is that same attitude once it has learnt which way round the cube faces; else the way the
// screen shows the case (yellow up, green in front) at his first turn. From then on it's followed from take to take,
// so a regrip before the first turn of a later take still counts.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { CubeHandle } from "@/app/components/CubeView";
import { ambientAttitude } from "@/app/smartcube/attitude";
import { smartCube } from "@/app/smartcube/connection";
import type { GridOrientation, Quaternion } from "@/app/smartcube/gyro";
import { getCase } from "@/cube";
import type { Move } from "@/cube/types";
import { TakeStore, type TakeView } from "./take";

/**
 * The gyro gets this long after the goal turn to report a final slice's or wide move's rotation: a wide move near
 * the end (r' F) is a tip, read once held for five reports (gyro.ts GYRO_TUNING.tipDwellReports).
 */
export const SETTLE_MS = 600;

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

/** How he holds the cube now, when it's known (the app's attitude has learnt which way round it faces). */
function startingGrip(): GridOrientation | null {
  return ambientAttitude.grip;
}

export function useGhostCube({ cube, caseId, active, onTurn }: GhostOptions): GhostCube {
  const [store] = useState(() => new TakeStore());
  const take = useSyncExternalStore(store.subscribe, store.view);
  // Seeded with the cube's latest report, so the very first take can already use the grip saved by Reorient.
  const report = useRef<Quaternion | null>(smartCube.lastGyro);
  /** Reset asked for his grip to be read afresh. */
  const forget = useRef(false);
  const live = useRef(active);
  const callbacks = useRef({ onTurn });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    live.current = active;
    callbacks.current = { onTurn };
  });

  const animate = useCallback(
    (moves: readonly string[]) => {
      for (const move of moves) cube.current?.turn(move);
    },
    [cube],
  );

  // A fresh take on the case as drawn, from the grip he holds his cube in (the cube on screen already faces that way).
  useEffect(() => {
    if (!active) return;
    const grip = startingGrip() ?? (forget.current ? null : store.grip);
    forget.current = false;
    cube.current?.setTempo(3);
    cube.current?.show(`z2 ${getCase(caseId).setup}`);
    store.startAsDrawn(caseId, report.current, grip);
  }, [active, caseId, cube, generation, store]);

  useEffect(() => {
    const off = [
      smartCube.onGyro((q, hostT) => {
        report.current = q;
        store.gyro(q, hostT);
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
