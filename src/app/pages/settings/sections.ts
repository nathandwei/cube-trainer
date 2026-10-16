/** The settings sections, in sidebar order; each is its own page at /settings/<id>. */
export const SETTINGS_SECTIONS = [
  { id: "cube", label: "Cube" },
  { id: "timer", label: "Timer" },
  { id: "method", label: "Method" },
  { id: "learn", label: "Learn" },
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

/** The section a URL names, or the first one for /settings and anything unknown. */
export function sectionOf(id: string | undefined): SettingsSection {
  return SETTINGS_SECTIONS.find((section) => section.id === id)?.id ?? "cube";
}
