export type CookieOptions = {
  /** Seconds; 0 deletes the cookie. Omitted means a session cookie. */
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

const NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/** Parses a Cookie request header. When a name repeats, the first value wins, as browsers list the most specific first. */
export function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name || cookies.has(name)) continue;
    cookies.set(name, decodeValue(part.slice(eq + 1).trim()));
  }
  return cookies;
}

function decodeValue(raw: string): string {
  const unquoted = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  try {
    return decodeURIComponent(unquoted);
  } catch {
    // Not percent-encoded by us; a stray "%" still has to round-trip as itself.
    return unquoted;
  }
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (!NAME.test(name)) throw new Error(`Invalid cookie name: ${name}`);
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}
