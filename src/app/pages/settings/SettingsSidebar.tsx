import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/app/components/IconButton";
import { navigate } from "@/app/lib/router";
import "./settings.css";

const SECTIONS = [
  { id: "cube", label: "Cube" },
  { id: "timer", label: "Timer" },
  { id: "learn", label: "Learn" },
  { id: "data", label: "Data" },
  { id: "account", label: "Account" },
] as const;

/** In place of the tabs: settings isn't one of them, so the way back sits where they would be. */
export function SettingsHeader() {
  return (
    <div className="settings-head">
      <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate("/")} />
      <span>Settings</span>
    </div>
  );
}

/** The sections of the one-scroll settings page (round-8 18). */
export function SettingsSidebar() {
  return (
    <nav className="settings-anchors" aria-label="Settings">
      {SECTIONS.map(({ id, label }) => (
        <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          {label}
        </button>
      ))}
    </nav>
  );
}
