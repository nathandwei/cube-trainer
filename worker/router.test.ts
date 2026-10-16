import { describe, expect, it } from "vitest";
import { createRouter } from "./router";

const route = createRouter<string>([
  { method: "GET", pattern: "/api/me", handler: "me" },
  { method: "GET", pattern: "/api/solves", handler: "list" },
  { method: "POST", pattern: "/api/solves", handler: "upsert" },
  { method: "PATCH", pattern: "/api/solves/:id", handler: "patch" },
  { method: "DELETE", pattern: "/api/solves/:id", handler: "delete" },
  { method: "GET", pattern: "/api/auth/callback/google", handler: "callback" },
]);

describe("router", () => {
  it.each([
    { method: "GET", path: "/api/me", handler: "me", params: {} },
    { method: "GET", path: "/api/solves", handler: "list", params: {} },
    { method: "POST", path: "/api/solves", handler: "upsert", params: {} },
    { method: "PATCH", path: "/api/solves/mgx1-abc123", handler: "patch", params: { id: "mgx1-abc123" } },
    { method: "DELETE", path: "/api/solves/a%20b", handler: "delete", params: { id: "a b" } },
    { method: "GET", path: "/api/auth/callback/google", handler: "callback", params: {} },
  ])("$method $path → $handler", ({ method, path, handler, params }) => {
    expect(route(method, path)).toEqual({ kind: "found", handler, params });
  });

  it.each([
    { method: "GET", path: "/api/nope" },
    { method: "GET", path: "/api/me/" },
    { method: "GET", path: "/api/solves/" },
    { method: "PATCH", path: "/api/solves/a/b" },
    { method: "PATCH", path: "/api/solves/%E0%A4%A" },
    { method: "GET", path: "/api/auth/callback/googleX" },
    { method: "GET", path: "/" },
  ])("$method $path → not found", ({ method, path }) => {
    expect(route(method, path)).toEqual({ kind: "not-found" });
  });

  it.each([
    { method: "DELETE", path: "/api/me", allow: ["GET"] },
    { method: "PUT", path: "/api/solves", allow: ["GET", "POST"] },
    { method: "GET", path: "/api/solves/x", allow: ["PATCH", "DELETE"] },
  ])("$method $path → 405 allowing $allow", ({ method, path, allow }) => {
    expect(route(method, path)).toEqual({ kind: "method-not-allowed", allow });
  });

  it("escapes regex characters in literal segments", () => {
    const dotted = createRouter([{ method: "GET", pattern: "/a.b", handler: 1 }]);
    expect(dotted("GET", "/a.b").kind).toBe("found");
    expect(dotted("GET", "/axb").kind).toBe("not-found");
  });
});
