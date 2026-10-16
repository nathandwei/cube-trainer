const SECTIONS = ["timer", "data", "account"] as const;

/** Anchors down the one-scroll settings page. */
export function SettingsSidebar() {
  return (
    <nav className="anchors">
      {SECTIONS.map((section) => (
        <a key={section} href={`#${section}`}>
          {section}
        </a>
      ))}
    </nav>
  );
}
