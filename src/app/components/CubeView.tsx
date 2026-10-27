import { LocateFixed } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type Ref } from "react";
import type { Attitude, CubeRenderer } from "@/app/cube3d/renderer";
import { IconButton } from "@/app/components/IconButton";
import { ambientAttitude, lineUp } from "@/app/smartcube/attitude";
import { animatedTurn, reverseOf, TurnAnimator } from "@/app/lib/animation";
import { useSettings } from "@/app/lib/settings";

export type CubeHandle = {
  /** Show a still state: the given setup alg, nothing queued. */
  show(setup: string): void;
  /** Animate one more turn on top of whatever is shown. */
  turn(move: string): void;
  /** Animate the reverse of a turn, retracing exactly how `turn` spun it. */
  unturn(move: string): void;
  /** Show `setup`, then animate `alg` one turn every `stepMs`. The next show() or play() cuts it short. */
  play(setup: string, alg: string, stepMs?: number): void;
  setTempo(scale: number): void;
  /** The usual view again after he has dragged the cube round. */
  resetView(): void;
};

/** Queuing a whole alg at once makes the cube catch up within a few frames, so play() feeds turns one at a time. */
const PLAY_STEP_MS = 420;
const PLAY_LEAD_MS = 350;
const ROTATION = /^[xyz]/;
/** The tempo a cube starts at (cubing.js's tempoScale, which every caller's setTempo was tuned against). */
const DEFAULT_TEMPO = 2;
/** A rotation's share of time in play(), in steps. */
const ROTATION_STEPS = 1.8;

/** Algs are written with grouping brackets ("(R U R' U')"), which aren't moves. */
function movesOf(text: string): string[] {
  return text.replace(/[()[\]]/g, " ").trim().split(/\s+/).filter(Boolean);
}

type Props = {
  ref?: Ref<CubeHandle>;
  setup?: string;
  className?: string;
  /** Held the way the smart cube is (the default); off for a cube that shows his moves in his own view instead. */
  follow?: boolean;
};

// three.js is most of the cube's weight, so it loads after the page shows; one load serves every cube.
let rendererModule: Promise<typeof import("@/app/cube3d/renderer")> | undefined;

function loadRenderer(): Promise<typeof import("@/app/cube3d/renderer")> {
  rendererModule ??= import("@/app/cube3d/renderer").catch((error: unknown) => {
    // Not remembered: the next cube tries again (the chunk can fail once, e.g. offline or mid-deploy).
    rendererModule = undefined;
    throw error;
  });
  return rendererModule;
}

/**
 * What the cube should show once it has loaded: a state, the tempo it plays at, and its tilt (null: not following a
 * smart cube). `dead` once it never will (no WebGL), so turns stop piling up.
 */
type Waiting = { moves: string[]; tempo: number; attitude: Attitude | null; dead: boolean };

/**
 * The 3D cube. While a smart cube with a gyro is connected it's held the way that cube is, centres where its centres
 * are (smartcube/attitude.ts), and can't be dragged round; otherwise dragging turns the view. The gyro's heading drifts
 * (and is guessed until learnt), so a following cube carries its own reset: on any page he can square it up again.
 */
export function CubeView({ ref, setup = "z2", className = "cube", follow = true }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<CubeRenderer | null>(null);
  const timers = useRef<number[]>([]);
  const waiting = useRef<Waiting>({ moves: movesOf(setup), tempo: DEFAULT_TEMPO, attitude: null, dead: false });
  const { cubeLook } = useSettings();
  const look = useRef(cubeLook);
  // Which way each hand last turned since the last show(), so R2 / L2 spin the way fingers would.
  const [animator] = useState(() => new TurnAnimator());
  const following = useSyncExternalStore(ambientAttitude.subscribe, () => follow && ambientAttitude.current !== null);

  useEffect(() => {
    let cube: CubeRenderer | null = null;
    let gone = false;
    loadRenderer()
      .then(({ CubeRenderer }) => {
        const element = host.current;
        if (gone || !element) return;
        try {
          cube = new CubeRenderer(element, look.current);
        } catch (error) {
          // No WebGL (switched off, or too many cubes open at once): the page works without its cube.
          console.error("CubeView: could not start the 3D cube", error);
          waiting.current = { ...waiting.current, moves: [], dead: true };
          return;
        }
        cube.setTempo(waiting.current.tempo);
        cube.show(waiting.current.moves);
        cube.setFollowing(waiting.current.attitude !== null);
        cube.setAttitude(waiting.current.attitude, true);
        player.current = cube;
      })
      .catch((error: unknown) => console.error("CubeView: could not load the 3D cube", error));
    const pending = timers;
    return () => {
      gone = true;
      pending.current.forEach((timer) => window.clearTimeout(timer));
      cube?.dispose();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    look.current = cubeLook;
    player.current?.setLook(cubeLook);
  }, [cubeLook]);

  // Held like the smart cube while it reports where it points; dragged round otherwise.
  useEffect(() => {
    if (!follow) return;
    const hold = () => {
      const attitude = ambientAttitude.current;
      waiting.current.attitude = attitude;
      player.current?.setFollowing(attitude !== null);
      player.current?.setAttitude(attitude);
    };
    hold();
    const off = ambientAttitude.subscribe(hold);
    return () => {
      off();
      waiting.current.attitude = null;
      player.current?.setFollowing(false);
      player.current?.setAttitude(null, true);
    };
  }, [follow]);

  // Until the cube has loaded, what it's asked to do is kept as the state it should open on.
  function showMoves(moves: string[]) {
    if (player.current) player.current.show(moves);
    else if (!waiting.current.dead) waiting.current.moves = moves;
  }

  function turnOne(move: string) {
    if (player.current) player.current.turn(move);
    else if (!waiting.current.dead) waiting.current.moves.push(move);
  }

  function stopPlaying() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }

  function showStill(nextSetup: string) {
    stopPlaying();
    showMoves(movesOf(nextSetup));
    animator.reset();
  }

  useImperativeHandle(ref, () => ({
    show: showStill,
    play(nextSetup, alg, stepMs = PLAY_STEP_MS) {
      showStill(nextSetup);
      // A whole-cube rotation (the x that opens an alg learnt from another grip) gets room to turn and settle before
      // the next move, so the cube visibly comes round instead of snapping.
      let at = PLAY_LEAD_MS;
      timers.current = movesOf(alg).map((move) => {
        const timer = window.setTimeout(() => turnOne(animator.play(move)), at);
        at += ROTATION.test(move) ? stepMs * ROTATION_STEPS : stepMs;
        return timer;
      });
    },
    turn(move) {
      for (const one of movesOf(move)) turnOne(animator.play(one));
    },
    unturn(move) {
      // Retrace what turn() played; after a show() there's no history, so fall back to the plain reverse.
      for (const one of movesOf(move).reverse()) turnOne(animator.undo() ?? reverseOf(animatedTurn(one)));
    },
    setTempo(scale) {
      waiting.current.tempo = scale;
      player.current?.setTempo(scale);
    },
    resetView() {
      player.current?.resetView();
    },
  }));

  return (
    <div ref={host} className={className}>
      {following && <IconButton icon={LocateFixed} label="Reset gyro: hold white down, green in front" size="sm" className="cube-reset" onClick={lineUp} />}
    </div>
  );
}
