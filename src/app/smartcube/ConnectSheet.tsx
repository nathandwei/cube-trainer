import { Check, Copy, Unplug } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { IconButton } from "@/app/components/IconButton";
import { lineUp } from "./attitude";
import { BRAVE_FLAG, MAC_HINT_COMMAND, checkBluetooth, looksLikeBrave, type BluetoothSupport } from "./browser";
import { shortCubeName, smartCube, useSmartCube } from "./connection";
import { CubeNet } from "./CubeNet";
import "./smartcube.css";

type Props = { onClose: () => void };

/** The smart-cube sheet over the dimmed timer: browser check, chooser, MAC once, then the connected cube. */
export function ConnectSheet({ onClose }: Props) {
  const connection = useSmartCube();
  const [support, setSupport] = useState<BluetoothSupport | null>(null);
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    let stale = false;
    checkBluetooth()
      .then((result) => {
        if (!stale) setSupport(result);
      })
      .catch((error: unknown) => {
        console.error("Checking for Web Bluetooth failed", error);
        if (!stale) setSupport({ kind: "blocked", message: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      stale = true;
    };
  }, [checks]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const recheck = () => {
    setSupport(null);
    setChecks((n) => n + 1);
  };
  const live = connection.status === "connected";

  function body(): ReactNode {
    if (live) return <Connected onDone={onClose} />;
    if (connection.status === "need-mac" && connection.macRequest) return <MacStep request={connection.macRequest} />;
    if (connection.status === "connecting" || connection.status === "reconnecting") return <Working text={connection.progress} />;
    if (connection.status === "lost") return <Lost name={connection.deviceName} error={connection.error} />;
    if (!support) return <Working text="Checking…" />;
    if (support.kind !== "ok") return <Unsupported support={support} onRecheck={recheck} />;
    return <Choose error={connection.failure === "disabled" ? null : connection.error} />;
  }

  // Some browsers only admit Bluetooth is switched off when requestDevice fails.
  const disabled: BluetoothSupport | null =
    connection.failure === "disabled" && !live
      ? looksLikeBrave()
        ? { kind: "brave-disabled" }
        : { kind: "blocked", message: connection.error ?? "" }
      : null;

  return (
    <div className="cube-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cube-sheet" role="dialog" aria-modal="true" aria-label="Smart cube">
        {disabled ? <Unsupported support={disabled} onRecheck={recheck} /> : body()}
      </section>
    </div>
  );
}

function Working({ text }: { text: string | null }) {
  return (
    <div className="cube-step center">
      <CubeArt />
      <p className="cube-progress" aria-live="polite">
        {text ?? "Connecting…"}
      </p>
      <button className="pill" onClick={() => void smartCube.disconnect()}>
        Cancel
      </button>
    </div>
  );
}

function Choose({ error }: { error: string | null }) {
  return (
    <div className="cube-step center">
      <CubeArt />
      <p>Twist the cube to wake it</p>
      {error && (
        <p className="cube-error" role="alert">
          {error}
        </p>
      )}
      <button className="pill primary" onClick={() => void smartCube.connect()}>
        Connect
      </button>
    </div>
  );
}

const BROWSER_NAME = { safari: "Safari", firefox: "Firefox", other: "This browser" } as const;

function Unsupported({ support, onRecheck }: { support: BluetoothSupport; onRecheck: () => void }) {
  switch (support.kind) {
    case "brave-disabled":
      return (
        <div className="cube-step center">
          <CubeArt />
          <Copyable text={BRAVE_FLAG} />
          <p className="cube-muted">Set it to Enabled, then relaunch Brave</p>
          <button className="pill primary" onClick={onRecheck}>
            Retry
          </button>
        </div>
      );
    case "unsupported":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>Use Chrome or Brave</p>
          <p className="cube-muted">{BROWSER_NAME[support.browser]} has no Bluetooth</p>
        </div>
      );
    case "off":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>Turn on Bluetooth</p>
          <p className="cube-muted">System Settings › Privacy &amp; Security › Bluetooth</p>
          <button className="pill primary" onClick={onRecheck}>
            Retry
          </button>
        </div>
      );
    case "insecure":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>Bluetooth needs https</p>
        </div>
      );
    case "blocked":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>Bluetooth is off in this browser</p>
          {support.message && <p className="cube-muted">{support.message}</p>}
          <button className="pill primary" onClick={onRecheck}>
            Retry
          </button>
        </div>
      );
    case "ok":
      return null;
  }
}

function MacStep({ request }: { request: { deviceName: string; rejected: boolean } }) {
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setInvalid(!smartCube.submitMac(value));
  }

  return (
    <form className="cube-step" onSubmit={submit}>
      <h2>{shortCubeName(request.deviceName)}</h2>
      <label className="cube-field">
        <span>MAC address</span>
        <input
          ref={input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="AB:12:34:56:78:9A"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || request.rejected}
        />
      </label>
      {(invalid || request.rejected) && (
        <p className="cube-error" role="alert">
          {invalid ? "Six pairs, like AB:12:34:56:78:9A" : "No answer at that address"}
        </p>
      )}
      <div className="cube-hint">
        <p className="cube-muted">In Terminal, find {request.deviceName}'s Address</p>
        <Copyable text={MAC_HINT_COMMAND} />
      </div>
      <div className="cube-row">
        <button type="button" className="pill" onClick={() => smartCube.cancelMac()}>
          Cancel
        </button>
        <button type="submit" className="pill primary">
          Connect
        </button>
      </div>
    </form>
  );
}

function Connected({ onDone }: { onDone: () => void }) {
  const connection = useSmartCube();
  const [note, setNote] = useState<string | null>(null);

  function resetOrientation() {
    setNote(lineUp() ? "Saved: white down, green front" : "No gyro reading yet");
  }

  return (
    <div className="cube-step">
      <header className="cube-head">
        <span className="cube-name">
          <span className="dot live" />
          {shortCubeName(connection.deviceName ?? "cube")}
        </span>
        <span className="cube-head-end">
          {connection.battery !== null && <Battery level={connection.battery} />}
          <IconButton icon={Unplug} label="Disconnect" size="sm" onClick={() => void smartCube.disconnect()} />
        </span>
      </header>
      <CubeNet state={connection.cube} />
      <div className="cube-row">
        <button className="pill" data-tip="Mark solved" onClick={() => void smartCube.markSolved()}>
          Solved
        </button>
        <button className="pill" data-tip="Hold white down, green front" onClick={resetOrientation} disabled={!connection.hasGyro}>
          Reorient
        </button>
      </div>
      {note && <p className="cube-muted cube-note">{note}</p>}
      <button className="pill primary cube-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}

function Lost({ name, error }: { name: string | null; error: string | null }) {
  return (
    <div className="cube-step center">
      <CubeArt />
      <p>Lost {name ? shortCubeName(name) : "the cube"}</p>
      {error && <p className="cube-muted">{error}</p>}
      <div className="cube-row">
        <button className="pill" onClick={() => void smartCube.disconnect()}>
          Forget
        </button>
        <button className="pill primary" onClick={() => void smartCube.reconnect()}>
          Reconnect
        </button>
      </div>
    </div>
  );
}

function Copyable({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copying to the clipboard failed", error);
    }
  }
  return (
    <div className="cube-copy">
      <code>{text}</code>
      <IconButton icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy"} size="sm" onClick={() => void copy()} />
    </div>
  );
}

function Battery({ level }: { level: number }) {
  return (
    <span className="cube-battery" aria-label={`Battery ${level}%`}>
      <svg viewBox="0 0 30 14" aria-hidden="true">
        <rect x="0.75" y="0.75" width="25.5" height="12.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="27.5" y="4.5" width="2" height="5" rx="1" fill="currentColor" />
        <rect x="3" y="3" width={Math.max(1, (21 * level) / 100)} height="8" rx="1" className={level <= 20 ? "low" : ""} fill="currentColor" />
      </svg>
      {level}%
    </span>
  );
}

/** A small matte cube in the solver's grip: yellow on top, green in front, orange on the right. */
function CubeArt() {
  const face = (points: (cell: [number, number]) => string, color: string, key: string) =>
    [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <polygon key={`${key}${r}${c}`} points={points([r, c])} className={`art ${color}`} />));
  const top = ([r, c]: [number, number]) => {
    const p = (i: number, j: number) => `${40 + (j - i) * 12},${10 + (i + j) * 7}`;
    return [p(r, c), p(r, c + 1), p(r + 1, c + 1), p(r + 1, c)].join(" ");
  };
  const left = ([r, c]: [number, number]) => {
    const p = (i: number, j: number) => `${4 + j * 12},${31 + j * 7 + i * 14}`;
    return [p(r, c), p(r, c + 1), p(r + 1, c + 1), p(r + 1, c)].join(" ");
  };
  const right = ([r, c]: [number, number]) => {
    const p = (i: number, j: number) => `${40 + j * 12},${52 - j * 7 + i * 14}`;
    return [p(r, c), p(r, c + 1), p(r + 1, c + 1), p(r + 1, c)].join(" ");
  };
  return (
    <svg className="cube-art" viewBox="0 0 80 96" aria-hidden="true">
      {face(top, "yellow", "u")}
      {face(left, "green", "f")}
      {face(right, "orange", "r")}
    </svg>
  );
}
