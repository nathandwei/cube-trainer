import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/app/components/IconButton";
import { signOut, useAccount } from "@/app/lib/account";
import { setSetting, useSettings } from "@/app/lib/settings";
import { loadMoreSolves, useHasMoreSolves, useSolves } from "@/app/lib/store";
import "./settings.css";

type SegmentedProps<T extends string> = { label: string; value: T; options: readonly T[]; onChange: (v: T) => void };

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="switch" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option} role="radio" aria-checked={value === option} className={value === option ? "on" : ""} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function download(name: string, data: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const settings = useSettings();
  const account = useAccount();
  const solves = useSolves();
  const hasMore = useHasMoreSolves();
  const [exporting, setExporting] = useState(false);
  const [failed, setFailed] = useState(false);
  // Older pages load while exporting; the loop reads the newest list and flag through this ref.
  const latest = useRef({ solves, hasMore });
  useEffect(() => {
    latest.current = { solves, hasMore };
  }, [solves, hasMore]);

  async function runExport() {
    setExporting(true);
    setFailed(false);
    try {
      while (latest.current.hasMore) {
        await loadMoreSolves();
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      download(`cube-solves-${new Date().toISOString().slice(0, 10)}.json`, latest.current.solves);
    } catch (error) {
      console.error("Export failed", error);
      setFailed(true);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="prefs">
      <section id="timer">
        <div className="prefs-row">
          <span>Inspection</span>
          <Segmented
            label="Inspection"
            value={settings.inspection ? "15 s" : "Off"}
            options={["Off", "15 s"] as const}
            onChange={(v) => setSetting("inspection", v === "15 s")}
          />
        </div>
        <div className="prefs-row">
          <span>Hide time while solving</span>
          <Segmented
            label="Hide time while solving"
            value={settings.hideTime ? "On" : "Off"}
            options={["Off", "On"] as const}
            onChange={(v) => setSetting("hideTime", v === "On")}
          />
        </div>
      </section>
      <section id="data">
        <div className="prefs-row">
          <span>Solves</span>
          <button className="pill primary" onClick={runExport} disabled={exporting}>
            {failed ? "Retry" : "Export"}
          </button>
        </div>
      </section>
      <section id="account">
        <div className="prefs-row">
          <span className="prefs-email">{account.status === "signed-in" ? account.account.email : ""}</span>
          <IconButton
            icon={LogOut}
            label="Sign out"
            variant="soft"
            onClick={() => void signOut().catch((error: unknown) => console.error("Sign out failed", error))}
          />
        </div>
      </section>
    </div>
  );
}
