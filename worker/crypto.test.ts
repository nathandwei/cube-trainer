import { describe, expect, it } from "vitest";
import { base64url, pkceChallenge, randomToken, sha256Hex, timingSafeEqual } from "./crypto";
import { hashSessionToken } from "./session";

describe("base64url", () => {
  it.each([
    { bytes: [], expected: "" },
    { bytes: [0xfb, 0xff], expected: "-_8" },
    { bytes: [0x66, 0x6f, 0x6f], expected: "Zm9v" },
    { bytes: [0x66, 0x6f], expected: "Zm8" },
  ])("encodes $bytes without padding", ({ bytes, expected }) => {
    expect(base64url(new Uint8Array(bytes))).toBe(expected);
  });
});

describe("randomToken", () => {
  it("is URL-safe and 43 characters for 32 bytes", () => {
    const token = randomToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => randomToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("pkceChallenge", () => {
  it("matches the RFC 7636 appendix B example", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("is a 43-character base64url string for a fresh verifier", async () => {
    expect(await pkceChallenge(randomToken())).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("session token hashing", () => {
  it.each([
    { input: "", expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
    { input: "abc", expected: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" },
  ])("sha256Hex($input)", async ({ input, expected }) => {
    expect(await sha256Hex(input)).toBe(expected);
  });

  it("stores a hash that differs from the token and is stable", async () => {
    const token = randomToken();
    const hash = await hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(await hashSessionToken(token)).toBe(hash);
  });
});

describe("timingSafeEqual", () => {
  it.each([
    { a: "abc", b: "abc", expected: true },
    { a: "", b: "", expected: true },
    { a: "abc", b: "abd", expected: false },
    { a: "abc", b: "ab", expected: false },
    { a: "abc", b: "ABC", expected: false },
  ])("$a vs $b", ({ a, b, expected }) => {
    expect(timingSafeEqual(a, b)).toBe(expected);
  });
});
