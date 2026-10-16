import { z } from "zod";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleConfig = { clientId: string; clientSecret: string };

export function googleConfig(env: Env): GoogleConfig | null {
  // Secrets are typed as strings but are simply absent until someone sets them.
  const clientId: string | undefined = env.GOOGLE_CLIENT_ID;
  const clientSecret: string | undefined = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function redirectUri(origin: string): string {
  return `${origin}/api/auth/callback/google`;
}

export function authorizeUrl(config: GoogleConfig, origin: string, state: string, codeChallenge: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

const tokenResponse = z.object({ access_token: z.string().min(1) });

const profileResponse = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
  name: z.string().optional(),
  picture: z.string().optional(),
});

export type GoogleProfile = { sub: string; email: string; name: string; picture: string | null };

export class GoogleError extends Error {}

async function call(url: string, init: RequestInit, what: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    throw new GoogleError(`${what} could not reach Google: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readJson(response: Response, what: string): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw new GoogleError(`${what} response was cut off: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new GoogleError(`${what} failed: HTTP ${response.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new GoogleError(`${what} returned something other than JSON`);
  }
}

export async function exchangeCode(config: GoogleConfig, origin: string, code: string, codeVerifier: string): Promise<string> {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri(origin),
    }),
  };
  const response = await call(TOKEN_URL, init, "token exchange");
  const parsed = tokenResponse.safeParse(await readJson(response, "token exchange"));
  if (!parsed.success) throw new GoogleError("token exchange returned no access_token");
  return parsed.data.access_token;
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const init = { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } };
  const response = await call(USERINFO_URL, init, "userinfo");
  const parsed = profileResponse.safeParse(await readJson(response, "userinfo"));
  if (!parsed.success) throw new GoogleError(`userinfo has an unexpected shape: ${parsed.error.message}`);
  const { sub, email, name, picture } = parsed.data;
  return { sub, email, name: name || email, picture: picture || null };
}
