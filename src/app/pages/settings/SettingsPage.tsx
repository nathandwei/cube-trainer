import { useEffect, useRef, useState } from "react";
import { signOut, useAccount } from "@/app/lib/account";
import { setSetting, useSettings } from "@/app/lib/settings";
import { loadMoreSolves, useHasMoreSolves, useSolves } from "@/app/lib/store";

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="switch" role="radiogroup">
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
    <div className="settings">
      <section id="timer">
        <div className="row">
          <span>inspection</span>
          <Segmented value={settings.inspection ? "15 s" : "off"} options={["off", "15 s"] as const} onChange={(v) => setSetting("inspection", v === "15 s")} />
        </div>
        <div className="row">
          <span>hide time while solving</span>
          <Segmented value={settings.hideTime ? "on" : "off"} options={["on", "off"] as const} onChange={(v) => setSetting("hideTime", v === "on")} />
        </div>
      </section>
      <section id="data">
        <div className="row">
          <span>solves</span>
          <button className="pill" onClick={runExport} disabled={exporting}>
            {failed ? "retry export" : "export"}
          </button>
        </div>
      </section>
      <section id="account">
        <div className="row">
          <span>{account.status === "signed-in" ? account.account.email : ""}</span>
          <button className="pill" onClick={() => void signOut().catch((error: unknown) => console.error("Sign out failed", error))}>
            sign out
          </button>
        </div>
      </section>
    </div>
  );
}
