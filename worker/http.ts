export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(status: number, message: string, headers?: HeadersInit): Response {
  return json({ error: message }, { status, headers });
}

export function noContent(headers?: HeadersInit): Response {
  return new Response(null, { status: 204, headers });
}

export function redirect(location: string, setCookies: string[] = []): Response {
  const headers = new Headers({ location, "cache-control": "no-store" });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export type BodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

/** Reads a JSON body no larger than `maxBytes`, answering 415/413/400 itself when it is not one. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<BodyResult> {
  const type = request.headers.get("content-type") ?? "";
  // Requiring JSON also means a cross-site form post can never reach these routes without a CORS preflight.
  if (!/^application\/json\b/i.test(type)) {
    return { ok: false, response: errorResponse(415, "expected an application/json body") };
  }
  const tooLarge = { ok: false, response: errorResponse(413, `body over ${maxBytes} bytes`) } as const;
  if (Number(request.headers.get("content-length") ?? "0") > maxBytes) return tooLarge;
  const bytes = await readAtMost(request.body, maxBytes);
  if (!bytes) return tooLarge;
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, response: errorResponse(400, "body is not valid JSON") };
  }
}

/** The whole stream, or null as soon as it passes `maxBytes` (a body sent without Content-Length can be any size). */
async function readAtMost(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array | null> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      try {
        await reader.cancel("body too large");
      } catch (error) {
        console.error("Could not cancel an oversized request body", error);
      }
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
