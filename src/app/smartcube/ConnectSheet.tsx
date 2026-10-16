import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
    if (!support) return <Working text="Checking this browser…" />;
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
      <section className="cube-sheet" role="dialog" aria-modal="true" aria-label="smart cube">
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
      <button className="link" onClick={() => void smartCube.disconnect()}>
        cancel
      </button>
    </div>
  );
}

function Choose({ error }: { error: string | null }) {
  return (
    <div className="cube-step center">
      <CubeArt />
      <p>Twist a face to wake the cube, then pick it in the list.</p>
      {error && (
        <p className="cube-error" role="alert">
          {error}
        </p>
      )}
      <button className="pill primary wide" onClick={() => void smartCube.connect()}>
        connect cube
      </button>
    </div>
  );
}

function Unsupported({ support, onRecheck }: { support: BluetoothSupport; onRecheck: () => void }) {
  switch (support.kind) {
    case "brave-disabled":
      return (
        <div className="cube-step center">
          <CubeArt />
          <Copyable text={BRAVE_FLAG} />
          <p className="cube-muted">Brave ships Bluetooth off. Open the flag, set it to Enabled, then relaunch Brave.</p>
          <button className="pill primary wide" onClick={onRecheck}>
            relaunched? check again
          </button>
        </div>
      );
    case "unsupported":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>
            {support.browser === "safari" ? "Safari" : support.browser === "firefox" ? "Firefox" : "This browser"} can't talk to
            Bluetooth cubes. Use Chrome (or Brave with its Bluetooth flag on).
          </p>
        </div>
      );
    case "off":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>Bluetooth is off, or the browser isn't allowed to use it.</p>
          <p className="cube-muted">Turn Bluetooth on, and allow the browser in System Settings › Privacy &amp; Security › Bluetooth.</p>
          <button className="pill primary wide" onClick={onRecheck}>
            check again
          </button>
        </div>
      );
    case "insecure":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>Bluetooth only works on https (or localhost).</p>
        </div>
      );
    case "blocked":
      return (
        <div className="cube-step center">
          <CubeArt />
          <p>Bluetooth is switched off in this browser.</p>
          {support.message && <p className="cube-muted">{support.message}</p>}
          <button className="pill primary wide" onClick={onRecheck}>
            check again
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
      <h2>{request.deviceName}'s address</h2>
      <p className="cube-muted">
        Chrome can't read a GAN cube's Bluetooth address by itself. Type it once; it is remembered for this cube.
      </p>
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
          {invalid ? "That isn't a MAC address: six pairs like AB:12:34:56:78:9A." : "The cube didn't answer with that address. Check it and try again."}
        </p>
      )}
      <div className="cube-hint">
        <p className="cube-muted">On the Mac, run this in Terminal and find {request.deviceName}'s Address:</p>
        <Copyable text={MAC_HINT_COMMAND} />
      </div>
      <div className="cube-actions">
        <button type="button" className="pill outline" onClick={() => smartCube.cancelMac()}>
          cancel
        </button>
        <button type="submit" className="pill primary">
          connect
        </button>
      </div>
    </form>
  );
}

function Connected({ onDone }: { onDone: () => void }) {
  const connection = useSmartCube();
  const [note, setNote] = useState<string | null>(null);

  function resetOrientation() {
    setNote(smartCube.resetOrientation() ? "Saved this grip as white down, green front." : "No gyro reading yet.");
  }

  return (
    <div className="cube-step">
      <header className="cube-head">
        <span className="cube-name">
          <span className="dot live" />
          {shortCubeName(connection.deviceName ?? "cube")}
        </span>
        {connection.battery !== null && <Battery level={connection.battery} />}
      </header>
      <CubeNet state={connection.cube} />
      <div className="cube-actions">
        <button className="pill outline" onClick={() => void smartCube.markSolved()}>
          mark solved
        </button>
        <button
          className="pill outline"
          onClick={resetOrientation}
          disabled={!connection.hasGyro}
          title="Hold the cube white down, green front, then press"
        >
          reset orientation
        </button>
      </div>
      {note && <p className="cube-muted center-text">{note}</p>}
      <button className="pill primary wide" onClick={onDone}>
        done
      </button>
      <button className="link" onClick={() => void smartCube.disconnect()}>
        disconnect
      </button>
    </div>
  );
}

function Lost({ name, error }: { name: string | null; error: string | null }) {
  return (
    <div className="cube-step center">
      <CubeArt />
      <p>Lost {name ? shortCubeName(name) : "the cube"}. Is it on and nearby?</p>
      {error && <p className="cube-muted">{error}</p>}
      <button className="pill primary wide" onClick={() => void smartCube.reconnect()}>
        reconnect
      </button>
      <button className="link" onClick={() => void smartCube.disconnect()}>
        forget it
      </button>
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
      <button type="button" className="copy" onClick={() => void copy()} aria-label={`copy ${text}`} title={copied ? "copied" : "copy"}>
        {copied ? (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="7" y="7" width="9" height="10" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M13 4.5V4.3A1.3 1.3 0 0 0 11.7 3H5.3A1.3 1.3 0 0 0 4 4.3v8.4A1.3 1.3 0 0 0 5.3 14H5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </button>
    </div>
  );
}

function Battery({ level }: { level: number }) {
  return (
    <span className="cube-battery" aria-label={`battery ${level}%`}>
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
