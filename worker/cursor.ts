import { z } from "zod";
import { base64url } from "./crypto";

/** Where the next page of solves starts: just after (older than) this solve in (created_at, id) order. */
export type Cursor = { createdAt: number; id: string };

const cursorShape = z.tuple([z.number(), z.string().min(1)]);

export function encodeCursor({ createdAt, id }: Cursor): string {
  return base64url(new TextEncoder().encode(JSON.stringify([createdAt, id])));
}

/** null for anything this Worker did not hand out. */
export function decodeCursor(text: string): Cursor | null {
  if (!/^[A-Za-z0-9_-]{1,400}$/.test(text)) return null;
  let decoded: unknown;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
  const parsed = cursorShape.safeParse(decoded);
  return parsed.success ? { createdAt: parsed.data[0], id: parsed.data[1] } : null;
}
