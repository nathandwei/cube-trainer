import { TwistyPlayer } from "cubing/twisty";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { animatedTurn, reverseOf, TurnAnimator } from "@/app/lib/animation";

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
};

/** Queuing a whole alg at once makes cubing.js catch up within a few frames, so turns are fed one at a time. */
const PLAY_STEP_MS = 420;
const PLAY_LEAD_MS = 350;

/** Algs are written with grouping brackets ("(R U R' U')"); cubing.js throws on a bracket inside a move. */
function movesOf(text: string): string[] {
  return text.replace(/[()[\]]/g, " ").trim().split(/\s+/).filter(Boolean);
}

// cubing.js 0.63.8 has no option for sticker colours. Its Cube3D shares one three.js material per sticker colour
// (indexed U L F R B D in its own frame, white on U) and one 30%-opaque black for every cubie body, which reads as
// grey on the oat page. Recolouring those shared materials in place restyles every cube on the page at once.
const STICKER_COLOURS: readonly number[] = [
  0xf3eee5, // U white: the bottom in the solver's view
  0xe07a36, // L orange
  0x4a9461, // F green
  0xc2493c, // R red
  0x3a6fae, // B blue
  0xe8c547, // D yellow: the top in the solver's view
];
const BODY_COLOUR = 0x2b2421;
// cubing.js renders with linear output, so colours stored as linear values reach the screen as exactly these hexes.
const LINEAR = "srgb-linear";

type ColourMaterial = {
  color: { setHex(hex: number, colorSpace?: string): unknown };
  opacity: number;
  transparent: boolean;
  needsUpdate: boolean;
};
type Cube3DLike = {
  kpuzzleFaceletInfo: Record<string, { faceIdx: number; facelet: { material: unknown } }[][]>;
  experimentalFoundationMeshes: { material: unknown }[];
  scheduleRenderCallback?: () => void;
};

function isColourMaterial(value: unknown): value is ColourMaterial {
  if (typeof value !== "object" || value === null || !("color" in value)) return false;
  const { color } = value;
  return typeof color === "object" && color !== null && "setHex" in color && typeof color.setHex === "function";
}

function isCube3D(value: unknown): value is Cube3DLike {
  if (typeof value !== "object" || value === null) return false;
  if (!("kpuzzleFaceletInfo" in value) || !("experimentalFoundationMeshes" in value)) return false;
  return typeof value.kpuzzleFaceletInfo === "object" && value.kpuzzleFaceletInfo !== null && Array.isArray(value.experimentalFoundationMeshes);
}

/** Muted matte stickers (the CaseDiagram palette) on a solid dark body. */
async function applyMatteLook(twisty: TwistyPlayer): Promise<void> {
  const puzzle: unknown = await twisty.experimentalCurrentThreeJSPuzzleObject();
  if (!isCube3D(puzzle)) {
    console.warn("CubeView: cubing.js's 3D cube has an unexpected shape, so it keeps its default colours");
    return;
  }
  let skipped = 0;
  for (const pieces of Object.values(puzzle.kpuzzleFaceletInfo)) {
    for (const { faceIdx, facelet } of pieces.flat()) {
      const colour = STICKER_COLOURS[faceIdx];
      if (colour === undefined || !isColourMaterial(facelet.material)) skipped++;
      else facelet.material.color.setHex(colour, LINEAR);
    }
  }
  for (const { material } of puzzle.experimentalFoundationMeshes) {
    if (!isColourMaterial(material)) {
      skipped++;
      continue;
    }
    material.color.setHex(BODY_COLOUR, LINEAR);
    material.opacity = 1;
    material.transparent = false;
    material.needsUpdate = true;
  }
  if (skipped > 0) console.warn(`CubeView: ${skipped} cube materials could not be recoloured`);
  puzzle.scheduleRenderCallback?.();
}

type Props = { ref?: Ref<CubeHandle>; setup?: string; className?: string };

export function CubeView({ ref, setup = "z2", className = "cube" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<TwistyPlayer | null>(null);
  const timers = useRef<number[]>([]);
  // Which way each hand last turned since the last show(), so R2 / L2 spin the way fingers would.
  const [animator] = useState(() => new TurnAnimator());

  useEffect(() => {
    const twisty = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      background: "none",
      controlPanel: "none",
      hintFacelets: "none",
      experimentalSetupAlg: setup,
      cameraLatitude: 30,
      cameraLongitude: 32,
      tempoScale: 2,
    });
    host.current?.append(twisty);
    player.current = twisty;
    applyMatteLook(twisty).catch((error: unknown) => console.error("CubeView: could not recolour the cube", error));
    const pending = timers;
    return () => {
      pending.current.forEach((timer) => window.clearTimeout(timer));
      twisty.remove();
      player.current = null;
    };
    // The player is created once; later states go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopPlaying() {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }

  function showStill(nextSetup: string) {
    stopPlaying();
    const twisty = player.current;
    if (!twisty) return;
    twisty.experimentalSetupAlg = nextSetup;
    twisty.alg = "";
    animator.reset();
  }

  useImperativeHandle(ref, () => ({
    show: showStill,
    play(nextSetup, alg, stepMs = PLAY_STEP_MS) {
      showStill(nextSetup);
      timers.current = movesOf(alg).map((move, i) =>
        window.setTimeout(() => player.current?.experimentalAddMove(animator.play(move), { cancel: false }), PLAY_LEAD_MS + i * stepMs),
      );
    },
    turn(move) {
      for (const one of movesOf(move)) player.current?.experimentalAddMove(animator.play(one), { cancel: false });
    },
    unturn(move) {
      // Retrace what turn() played; after a show() there's no history, so fall back to the plain reverse.
      for (const one of movesOf(move).reverse()) player.current?.experimentalAddMove(animator.undo() ?? reverseOf(animatedTurn(one)), { cancel: false });
    },
    setTempo(scale) {
      if (player.current) player.current.tempoScale = scale;
    },
  }));

  return <div ref={host} className={className} />;
}
