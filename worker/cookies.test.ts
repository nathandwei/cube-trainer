import { describe, expect, it } from "vitest";
import { parseCookies, serializeCookie } from "./cookies";

describe("parseCookies", () => {
  it.each([
    { header: null, expected: {} },
    { header: "", expected: {} },
    { header: "session=abc", expected: { session: "abc" } },
    { header: "a=1; session=abc; b=2", expected: { a: "1", session: "abc", b: "2" } },
    { header: "  session = abc  ;b=2", expected: { session: "abc", b: "2" } },
    { header: "session=first; session=second", expected: { session: "first" } },
    { header: 'q="quoted value"', expected: { q: "quoted value" } },
    { header: "enc=a%20b%3Bc", expected: { enc: "a b;c" } },
    { header: "bad=100%", expected: { bad: "100%" } },
    { header: "noequals; session=abc", expected: { session: "abc" } },
    { header: "token=abc=def", expected: { token: "abc=def" } },
    { header: "empty=", expected: { empty: "" } },
  ])("parses $header", ({ header, expected }) => {
    expect(Object.fromEntries(parseCookies(header))).toEqual(expected);
  });
});

describe("serializeCookie", () => {
  it.each([
    { name: "a", value: "1", options: {}, expected: "a=1" },
    {
      name: "session",
      value: "tok",
      options: { maxAge: 34_560_000, path: "/", httpOnly: true, secure: true, sameSite: "Lax" as const },
      expected: "session=tok; Max-Age=34560000; Path=/; HttpOnly; Secure; SameSite=Lax",
    },
    { name: "gone", value: "", options: { maxAge: 0, path: "/" }, expected: "gone=; Max-Age=0; Path=/" },
    { name: "enc", value: "a b;c", options: {}, expected: "enc=a%20b%3Bc" },
  ])("serialises $name", ({ name, value, options, expected }) => {
    expect(serializeCookie(name, value, options)).toBe(expected);
  });

  it.each(["", "bad name", "semi;colon", "eq=uals"])("rejects the name %j", (name) => {
    expect(() => serializeCookie(name, "x")).toThrow(/Invalid cookie name/);
  });

  it("round-trips through parseCookies", () => {
    const value = "x.y-z_0~!*'()";
    const header = serializeCookie("v", value, { path: "/", httpOnly: true }).split("; ")[0] ?? "";
    expect(parseCookies(header).get("v")).toBe(value);
  });
});
