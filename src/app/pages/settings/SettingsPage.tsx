import { LogOut, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/app/components/IconButton";
import { signOut, useAccount } from "@/app/lib/account";
import { updateLearnSettings, useLearnSettings } from "@/app/lib/learnStore";
import { setSetting, useSettings } from "@/app/lib/settings";
import { loadMoreSolves, useHasMoreSolves, useSolves } from "@/app/lib/store";
import { ConnectSheet } from "@/app/smartcube/ConnectSheet";
import { shortCubeName, smartCube, useSmartCube } from "@/app/smartcube/connection";
import "./settings.css";

/** New cases a session brings in when there are some left to learn (the scheduler's default is 3). */
const NEW_CASES_DEFAULT = 3;
const NEW_CASES_MAX = 10;

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

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="prefs-row">
      <span className="prefs-label">{label}</span>
      {children}
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

/** One scroll of settings in the sections the sidebar lists (round-8 18): cube, timer, learn, data, account. */
export function SettingsPage() {
  const settings = useSettings();
  const learn = useLearnSettings();
  const account = useAccount();
  const link = useSmartCube();
  const solves = useSolves();
  const hasMore = useHasMoreSolves();
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const connected = link.status === "connected";
  const newCases = learn.newPerSession ?? NEW_CASES_DEFAULT;
  const setNewCases = (n: number) => updateLearnSettings({ newPerSession: Math.max(0, Math.min(NEW_CASES_MAX, n)) });

  return (
    <div className="prefs">
      <section id="cube">
        <Row
          label={
            connected && link.deviceName ? (
              <>
                {shortCubeName(link.deviceName)}
                {link.battery !== null && <span className="prefs-detail">{link.battery}%</span>}
              </>
            ) : (
              "No cube"
            )
          }
        >
          {connected ? (
            <button className="pill" onClick={() => void smartCube.disconnect()}>
              Disconnect
            </button>
          ) : (
            <button className="pill" onClick={() => setSheetOpen(true)}>
              Connect
            </button>
          )}
        </Row>
      </section>
      <section id="timer">
        <Row label="Inspection">
          <Segmented label="Inspection" value={settings.inspection ? "15 s" : "Off"} options={["Off", "15 s"] as const} onChange={(v) => setSetting("inspection", v === "15 s")} />
        </Row>
        <Row label="Hide time while solving">
          <Segmented label="Hide time while solving" value={settings.hideTime ? "On" : "Off"} options={["Off", "On"] as const} onChange={(v) => setSetting("hideTime", v === "On")} />
        </Row>
      </section>
      <section id="learn">
        <Row label="New cases per session">
          <div className="stepper" role="group" aria-label="New cases per session">
            <IconButton icon={Minus} label="Fewer" size="sm" disabled={newCases <= 0} onClick={() => setNewCases(newCases - 1)} />
            <span className="stepper-value">{newCases}</span>
            <IconButton icon={Plus} label="More" size="sm" disabled={newCases >= NEW_CASES_MAX} onClick={() => setNewCases(newCases + 1)} />
          </div>
        </Row>
      </section>
      <section id="data">
        <div className="prefs-row">
          <button className="pill primary" onClick={runExport} disabled={exporting}>
            {failed ? "Retry" : "Export"}
          </button>
        </div>
      </section>
      <section id="account">
        <Row label={<span className="prefs-email">{account.status === "signed-in" ? account.account.email : ""}</span>}>
          <IconButton icon={LogOut} label="Sign out" variant="soft" onClick={() => void signOut().catch((error: unknown) => console.error("Sign out failed", error))} />
        </Row>
      </section>
      {sheetOpen && <ConnectSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}
