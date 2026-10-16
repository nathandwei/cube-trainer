import { shortCubeName, useSmartCube, type CubeStatus as LinkStatus } from "@/app/smartcube/connection";

/** off: no cube; busy: connecting or asking for its MAC; live: connected; lost: the link dropped. */
export type CubeLinkState = "off" | "busy" | "live" | "lost";

export function cubeLinkState(status: LinkStatus): CubeLinkState {
  switch (status) {
    case "connected":
      return "live";
    case "connecting":
    case "need-mac":
    case "reconnecting":
      return "busy";
    case "lost":
      return "lost";
    case "idle":
      return "off";
  }
}

/** Top-left on every page that uses the cube: which cube is connected (and its battery), or a way to connect one. */
export function CubeStatus({ onClick }: { onClick: () => void }) {
  const link = useSmartCube();
  const state = cubeLinkState(link.status);
  const name = link.deviceName ? shortCubeName(link.deviceName) : "Cube";
  const label = state === "live" ? name : state === "busy" ? "Connecting…" : state === "lost" ? "Reconnect" : "No cube";
  return (
    <button className={`cube-status ${state}`} onClick={onClick} aria-label={state === "live" ? `${name}, connected` : state === "off" ? "Connect a cube" : label}>
      <span className="dot" aria-hidden="true" />
      {label}
      {state === "live" && link.battery !== null && <span className="battery">{link.battery}%</span>}
    </button>
  );
}
