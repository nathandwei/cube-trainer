import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";

describe("page cursors", () => {
  it.each([
    { createdAt: 1_760_000_000_000, id: "mgx1abc-k3j2h1" },
    { createdAt: 0, id: "a" },
    { createdAt: 1.5, id: "with spaces, commas and \"quotes\"" },
    { createdAt: 5, id: "ünïcödé" },
  ])("round-trips $id", (cursor) => {
    const text = encodeCursor(cursor);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(text)).toEqual(cursor);
  });

  it.each([
    "",
    "not base64!",
    "e30", // {}
    "WzEsMl0", // [1,2]
    "WyJ4IiwieSJd", // ["x","y"]
    "WzEsIiJd", // [1,""]
    "%%%",
    "x".repeat(401),
  ])("rejects %j", (text) => {
    expect(decodeCursor(text)).toBeNull();
  });
});
