export type InputMode = "cube" | "virtual" | "keyboard";

/** off: no cube; busy: connecting or asking for its MAC; live: connected; lost: the link dropped. */
export type CubeLinkState = "off" | "busy" | "live" | "lost";

type Props = {
  mode: InputMode;
  onChange: (mode: InputMode) => void;
  cube: { name: string | null; state: CubeLinkState };
  /** The cube segment was clicked while it cannot simply be selected (or while already selected): open the cube sheet. */
  onCubeClick: () => void;
};

function cubeLabel({ name, state }: Props["cube"]): string {
  switch (state) {
    case "live":
      return name ?? "cube";
    case "busy":
      return "connecting…";
    case "lost":
      return "reconnect";
    case "off":
      return "cube";
  }
}

/** Where solves come from: the smart cube (with its connection state), the on-screen cube, or the spacebar. */
export function InputSwitch({ mode, onChange, cube, onCubeClick }: Props) {
  const options: { id: InputMode; label: string }[] = [
    { id: "cube", label: cubeLabel(cube) },
    { id: "virtual", label: "virtual" },
    { id: "keyboard", label: "keyboard" },
  ];
  function choose(id: InputMode) {
    if (id !== "cube") return onChange(id);
    if (cube.state === "live" && mode !== "cube") return onChange("cube");
    onCubeClick();
  }
  return (
    <div className="switch" role="radiogroup" aria-label="input">
      {options.map((option) => (
        <button
          key={option.id}
          role="radio"
          aria-checked={mode === option.id}
          className={mode === option.id ? "on" : ""}
          onClick={() => choose(option.id)}
          title={option.id === "cube" && cube.state === "off" ? "connect a smart cube" : undefined}
        >
          {option.id === "cube" && <span className={`dot ${cube.state === "live" ? "live" : cube.state === "lost" ? "lost" : ""}`} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
