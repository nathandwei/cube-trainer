export type InputMode = "cube" | "virtual" | "keyboard";

type Props = { mode: InputMode; onChange: (mode: InputMode) => void; cubeName: string | null };

/** Where solves come from: the smart cube (with its connection state), the on-screen cube, or the spacebar. */
export function InputSwitch({ mode, onChange, cubeName }: Props) {
  const options: { id: InputMode; label: string; disabled?: boolean }[] = [
    { id: "cube", label: cubeName ?? "cube", disabled: cubeName === null },
    { id: "virtual", label: "virtual" },
    { id: "keyboard", label: "keyboard" },
  ];
  return (
    <div className="switch" role="radiogroup" aria-label="input">
      {options.map((option) => (
        <button
          key={option.id}
          role="radio"
          aria-checked={mode === option.id}
          className={mode === option.id ? "on" : ""}
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
        >
          {option.id === "cube" && <span className={`dot ${cubeName ? "live" : ""}`} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
