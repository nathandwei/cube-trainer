import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  icon: LucideIcon;
  /** Read by screen readers and shown as the hover tooltip. Sentence case, e.g. "Show best". */
  label: string;
  variant?: "ghost" | "primary" | "soft";
  /** sm 36, md 48, lg 64, xl 96 mockup pixels (see docs/UI.md). */
  size?: "sm" | "md" | "lg" | "xl";
  /** Hide the tooltip, for buttons whose meaning is already spelled out next to them. */
  quiet?: boolean;
  /** Solid glyph (the play triangle in the mockups) instead of an outline. */
  filled?: boolean;
};

/** The one round icon button: actions that would need more than one word get an icon and a tooltip instead. */
export function IconButton({ icon: Icon, label, variant = "ghost", size = "md", quiet = false, filled = false, className = "", type = "button", ...rest }: Props) {
  return (
    <button type={type} aria-label={label} data-tip={quiet ? undefined : label} className={`icon-btn ${variant} ${size} ${className}`.trim()} {...rest}>
      <Icon strokeWidth={1.75} fill={filled ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

/** A key on the keyboard, for the few hints that say which key does what (e.g. Space, Esc). */
export function Key({ children }: { children: string }) {
  return <kbd className="key">{children}</kbd>;
}
