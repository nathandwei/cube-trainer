import { TwistyPlayer } from "cubing/twisty";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export type CubeHandle = {
  /** Show a still state: the given setup alg, nothing queued. */
  show(setup: string): void;
  /** Animate one more turn on top of whatever is shown. */
  turn(move: string): void;
  setTempo(scale: number): void;
};

type Props = { ref?: Ref<CubeHandle>; setup?: string; className?: string };

export function CubeView({ ref, setup = "z2", className = "cube" }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<TwistyPlayer | null>(null);

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
    return () => {
      twisty.remove();
      player.current = null;
    };
    // The player is created once; later states go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    show(nextSetup) {
      const twisty = player.current;
      if (!twisty) return;
      twisty.experimentalSetupAlg = nextSetup;
      twisty.alg = "";
    },
    turn(move) {
      player.current?.experimentalAddMove(move, { cancel: false });
    },
    setTempo(scale) {
      if (player.current) player.current.tempoScale = scale;
    },
  }));

  return <div ref={host} className={className} />;
}
