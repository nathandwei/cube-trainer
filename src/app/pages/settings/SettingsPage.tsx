import { LogOut, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CubeView } from "@/app/components/CubeView";
import { IconButton } from "@/app/components/IconButton";
import { CUBE_LOOKS, type CubeLook } from "@/app/cube3d/looks";
import { signOut, useAccount } from "@/app/lib/account";
import { updateLearnSettings, useLearnSettings, useLearnStatus } from "@/app/lib/learnStore";
import { DEFAULT_METHOD } from "@/app/lib/method";
import { setSetting, useSettings } from "@/app/lib/settings";
import { LAST_LAYER_METHODS, type LastLayerMethod } from "@/cube";
import { loadMoreSolves, useHasMoreSolves, useSolves } from "@/app/lib/store";
import { ConnectSheet } from "@/app/smartcube/ConnectSheet";
import { shortCubeName, smartCube, useSmartCube } from "@/app/smartcube/connection";
import { sectionOf } from "./sections";
import "./settings.css";

/** New cases a session brings in when there are some left to learn (the scheduler's default is 3). */
const NEW_CASES_DEFAULT = 3;
const NEW_CASES_MAX = 10;

/** How each method is shown: its stages, in notation. */
const METHOD_NAMES: Readonly<Record<LastLayerMethod, string>> = { "oll-pll": "OLL · PLL", "eo-coll": "EO · COLL" };

const LOOK_NAMES: Readonly<Record<CubeLook, string>> = { stickerless: "Stickerless", matte: "Matte", classic: "Classic" };

/** A state that shows every colour on the three faces in view. */
const PREVIEW_SETUP = "z2 R U R' U' F2 L D2 B' U2 R2 F";

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  names?: Readonly<Record<T, string>>;
  disabled?: boolean;
  onChange: (v: T) => void;
};

function Segmented<T extends string>({ label, value, options, names, disabled = false, onChange }: SegmentedProps<T>) {
  return (
    <div className="switch" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          role="radio"
          aria-checked={value === option}
          className={value === option ? "on" : ""}
          disabled={disabled}
          onClick={() => onChange(option)}
        >
          {names?.[option] ?? option}
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

/** One section of settings at a time, the one picked in the sidebar (rows as in round-8 18). */
export function SettingsPage({ section }: { section?: string }) {
  switch (sectionOf(section)) {
    case "cube":
      return <CubeSection />;
    case "timer":
      return <TimerSection />;
    case "method":
      return <MethodSection />;
    case "learn":
      return <LearnSection />;
    case "appearance":
      return <AppearanceSection />;
    case "account":
      return <AccountSection />;
  }
}

function CubeSection() {
  const link = useSmartCube();
  const [sheetOpen, setSheetOpen] = useState(false);
  const connected = link.status === "connected";
  return (
    <div className="prefs">
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
      {sheetOpen && <ConnectSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

function TimerSection() {
  const settings = useSettings();
  return (
    <div className="prefs">
      <Row label="Inspection">
        <Segmented label="Inspection" value={settings.inspection ? "15 s" : "Off"} options={["Off", "15 s"] as const} onChange={(v) => setSetting("inspection", v === "15 s")} />
      </Row>
      <Row label="Hide time while solving">
        <Segmented label="Hide time while solving" value={settings.hideTime ? "On" : "Off"} options={["Off", "On"] as const} onChange={(v) => setSetting("hideTime", v === "On")} />
      </Row>
    </div>
  );
}

/** How he solves, which is how reviews split and name his last layer. */
function MethodSection() {
  const learn = useLearnSettings();
  // A change before his settings arrive would be saved over the defaults and replace what the server has.
  const { loaded } = useLearnStatus();
  return (
    <div className="prefs">
      <Row label="Last layer">
        <Segmented
          label="Last layer"
          value={learn.lastLayer ?? DEFAULT_METHOD}
          options={LAST_LAYER_METHODS}
          names={METHOD_NAMES}
          disabled={!loaded}
          onChange={(lastLayer) => updateLearnSettings({ lastLayer })}
        />
      </Row>
    </div>
  );
}

function LearnSection() {
  const learn = useLearnSettings();
  const { loaded } = useLearnStatus();
  const newCases = learn.newPerSession ?? NEW_CASES_DEFAULT;
  const setNewCases = (n: number) => updateLearnSettings({ newPerSession: Math.max(0, Math.min(NEW_CASES_MAX, n)) });
  return (
    <div className="prefs">
      <Row label="New cases per session">
        <div className="stepper" role="group" aria-label="New cases per session">
          <IconButton icon={Minus} label="Fewer" size="sm" disabled={!loaded || newCases <= 0} onClick={() => setNewCases(newCases - 1)} />
          <span className="stepper-value">{newCases}</span>
          <IconButton icon={Plus} label="More" size="sm" disabled={!loaded || newCases >= NEW_CASES_MAX} onClick={() => setNewCases(newCases + 1)} />
        </div>
      </Row>
    </div>
  );
}

function AppearanceSection() {
  const settings = useSettings();
  return (
    <div className="prefs">
      <Row label="Cube">
        <Segmented label="Cube" value={settings.cubeLook} options={CUBE_LOOKS} names={LOOK_NAMES} onChange={(look) => setSetting("cubeLook", look)} />
      </Row>
      <CubeView className="cube prefs-cube" setup={PREVIEW_SETUP} />
    </div>
  );
}

function AccountSection() {
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
      <Row label={<span className="prefs-email">{account.status === "signed-in" ? account.account.email : ""}</span>}>
        <IconButton icon={LogOut} label="Sign out" variant="soft" onClick={() => void signOut().catch((error: unknown) => console.error("Sign out failed", error))} />
      </Row>
      <Row label="Solves">
        <button className="pill primary" onClick={runExport} disabled={exporting}>
          {failed ? "Retry" : "Export"}
        </button>
      </Row>
    </div>
  );
}
