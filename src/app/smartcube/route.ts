// A route of turns the cube is led along, followed turn by turn as the cube reports them: the scramble (and the way
// back to it after a wrong turn), or the way back onto an alg while practising it. A half turn may come as two
// quarters either way round; a turn off the route reroutes it: the stray turn undone, then the rest.

import { applyMove, invertAlg, simplifyMoves, stateKey, type CubeState } from "@/cube";
import type { Move } from "@/cube/types";

export type Route = {
  /** Turns from where the route starts to its end. */
  moves: Move[];
  /** stateKey after k turns → k (the largest k when a state repeats). */
  keys: Map<string, number>;
  /** stateKey after one quarter of half turn k → k and that quarter. */
  halfKeys: Map<string, { k: number; quarter: Move }>;
  /** The last route prefix the cube was at, and the turns since. */
  anchor: number;
  sinceAnchor: Move[];
  /** One quarter of the half turn at `anchor` is done. */
  half: boolean;
};

const quarterOf = (half: Move) => [half.charAt(0), `${half.charAt(0)}'`];

export function routeFrom(start: CubeState, moves: Move[]): Route {
  const keys = new Map<string, number>();
  const halfKeys = new Map<string, { k: number; quarter: Move }>();
  let state = start;
  keys.set(stateKey(state), 0);
  moves.forEach((move, k) => {
    if (move.endsWith("2")) for (const quarter of quarterOf(move)) halfKeys.set(stateKey(applyMove(state, quarter)), { k, quarter });
    state = applyMove(state, move);
    keys.set(stateKey(state), k + 1);
  });
  return { moves, keys, halfKeys, anchor: 0, sinceAnchor: [], half: false };
}

/**
 * The cube is at `state`, `move` having just brought it there. On the route: the same route, moved along. Off it: a
 * new route from `state` (the stray turns undone, then the rest of this one).
 */
export function followRoute(route: Route, state: CubeState, move: Move): Route {
  const key = stateKey(state);
  const at = route.keys.get(key);
  if (at !== undefined) return Object.assign(route, { anchor: at, sinceAnchor: [], half: false });
  const halfway = route.halfKeys.get(key);
  if (halfway !== undefined) return Object.assign(route, { anchor: halfway.k, sinceAnchor: [halfway.quarter], half: true });
  return routeFrom(state, simplifyMoves([...invertAlg([...route.sinceAnchor, move]), ...route.moves.slice(route.anchor)]));
}
