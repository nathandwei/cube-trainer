import { useEffect, useState } from "react";
import { signIn } from "@/app/lib/account";
import "@/app/signin.css";

type Point = readonly [number, number];
type Face = { name: "top" | "left" | "right"; origin: Point; u: Point; v: Point };

// Isometric cube with edge length S: each face is a parallelogram spanned by u and v from its origin.
const S = 40;
const W = S * Math.cos(Math.PI / 6);
const FACES: Face[] = [
  { name: "top", origin: [0, -S], u: [W, S / 2], v: [-W, S / 2] },
  { name: "left", origin: [-W, -S / 2], u: [W, S / 2], v: [0, S] },
  { name: "right", origin: [0, 0], u: [W, -S / 2], v: [0, S] },
];
/** Gap around each sticker, as a fraction of a sticker's side, letting the dark body show between them. */
const GAP = 0.1;

function at({ origin, u, v }: Face, a: number, b: number): string {
  const x = origin[0] + (u[0] * a) / 3 + (v[0] * b) / 3;
  const y = origin[1] + (u[1] * a) / 3 + (v[1] * b) / 3;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

const STICKERS = FACES.flatMap((face) =>
  [0, 1, 2].flatMap((i) =>
    [0, 1, 2].map((j) => ({
      key: `${face.name}-${i}-${j}`,
      face: face.name,
      points: [
        at(face, i + GAP, j + GAP),
        at(face, i + 1 - GAP, j + GAP),
        at(face, i + 1 - GAP, j + 1 - GAP),
        at(face, i + GAP, j + 1 - GAP),
      ].join(" "),
    })),
  ),
);

const BODY = (
  [
    [0, -S],
    [W, -S / 2],
    [W, S / 2],
    [0, S],
    [-W, S / 2],
    [-W, -S / 2],
  ] as const
)
  .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
  .join(" ");

function CubeMark() {
  return (
    <svg className="signin-cube" viewBox="-38 -43 76 86" aria-hidden="true">
      <polygon className="signin-cube-body" points={BODY} />
      {STICKERS.map((sticker) => (
        <polygon key={sticker.key} className={`signin-cube-${sticker.face}`} points={sticker.points} />
      ))}
    </svg>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** The Worker's OAuth callback sends a failed sign-in back here as /?auth=failed. */
function useSignInFailed(): boolean {
  const [failed] = useState(() => new URLSearchParams(window.location.search).get("auth") === "failed");
  useEffect(() => {
    if (!failed) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [failed]);
  return failed;
}

export function SignInPage() {
  const failed = useSignInFailed();
  return (
    <main className="signin">
      <div className="signin-stack">
        <CubeMark />
        <h1 className="signin-word">cube</h1>
        <button type="button" className="signin-google" onClick={signIn}>
          <GoogleG />
          <span>Sign in with Google</span>
        </button>
        {failed && (
          <p className="signin-failed" role="alert">
            Sign-in didn't finish. Try again.
          </p>
        )}
      </div>
    </main>
  );
}
