import "./settings.css";

const SECTIONS = [
  { id: "timer", label: "Timer" },
  { id: "data", label: "Data" },
  { id: "account", label: "Account" },
] as const;

/** Anchors down the one-scroll settings page. */
export function SettingsSidebar() {
  return (
    <nav className="settings-anchors" aria-label="Settings">
      {SECTIONS.map(({ id, label }) => (
        <a key={id} href={`#${id}`}>
          {label}
        </a>
      ))}
    </nav>
  );
}
