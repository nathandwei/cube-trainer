import { describe, expect, it, vi } from "vitest";
import { readJsonBody } from "./http";

function streamed(chunks: Uint8Array[], onCancel: () => void): Request {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks.shift();
      if (next) controller.enqueue(next);
      else controller.close();
    },
    cancel: onCancel,
  });
  return new Request("http://localhost/api/solves", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit);
}

describe("readJsonBody", () => {
  it("stops reading and cancels a body without Content-Length once it passes the cap", async () => {
    const cancel = vi.fn();
    const chunks = Array.from({ length: 100 }, () => new Uint8Array(1024).fill(32));
    const result = await readJsonBody(streamed(chunks, cancel), 4 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    // Only a few chunks past the cap were ever pulled.
    expect(chunks.length).toBeGreaterThan(90);
  });

  it("reads a chunked body under the cap", async () => {
    const text = JSON.stringify({ a: "x".repeat(3000) });
    const bytes = new TextEncoder().encode(text);
    const chunks = [bytes.slice(0, 1000), bytes.slice(1000, 2000), bytes.slice(2000)];
    const result = await readJsonBody(streamed(chunks, () => undefined), 4 * 1024);
    expect(result).toEqual({ ok: true, value: { a: "x".repeat(3000) } });
  });

  it.each<{ name: string; headers: Record<string, string>; body: string; status: number }>([
    { name: "a declared length over the cap", headers: { "content-type": "application/json", "content-length": "5000" }, body: "{}", status: 413 },
    { name: "a non-JSON type", headers: { "content-type": "text/plain" }, body: "{}", status: 415 },
    { name: "invalid JSON", headers: { "content-type": "application/json" }, body: "{", status: 400 },
    { name: "an empty body", headers: { "content-type": "application/json" }, body: "", status: 400 },
  ])("answers $name with $status", async ({ headers, body, status }) => {
    const request = new Request("http://localhost/api/solves", { method: "POST", headers, body });
    const result = await readJsonBody(request, 4 * 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(status);
  });
});
