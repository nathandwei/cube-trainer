import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import { navigate } from "@/app/lib/router";
import { SETTINGS_SECTIONS, sectionOf } from "./sections";
import "./settings.css";

/** In place of the tabs: settings isn't one of them, so the way back sits where they would be. */
export function SettingsHeader() {
  return (
    <div className="settings-head">
      <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate("/")} />
      <span>Settings</span>
    </div>
  );
}

/** The sections, one open at a time; switching replaces the history entry, so Back still leaves settings. */
export function SettingsSidebar({ section }: { section?: string }) {
  const open = sectionOf(section);
  return (
    <nav aria-label="Settings">
      <ul className="settings-sections">
        {SETTINGS_SECTIONS.map(({ id, label }) => (
          <li key={id} className={id === open ? "selected" : ""}>
            <button aria-current={id === open ? "page" : undefined} onClick={() => navigate(`/settings/${id}`, { replace: true })}>
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
