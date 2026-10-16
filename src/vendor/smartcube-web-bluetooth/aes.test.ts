import { describe, expect, it } from "vitest";
import { Aes128, AesCbcChunk } from "./aes";

const hex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("Aes128", () => {
  it.each([
    // FIPS-197 appendix C.1
    ["000102030405060708090a0b0c0d0e0f", "00112233445566778899aabbccddeeff", "69c4e0d86a7b0430d8cdb78070b4c55a"],
    // FIPS-197 appendix B
    ["2b7e151628aed2a6abf7158809cf4f3c", "3243f6a8885a308d313198a2e0370734", "3925841d02dc09fbdc118597196a0b32"],
  ])("key %s encrypts %s to %s and back", (key, plain, cipher) => {
    const aes = new Aes128(hex(key));
    expect(toHex(aes.encryptBlock(hex(plain)))).toBe(cipher);
    expect(toHex(aes.decryptBlock(hex(cipher)))).toBe(plain);
  });

  it.each([[15], [17]])("refuses a %i-byte block", (length) => {
    expect(() => new Aes128(new Uint8Array(16)).encryptBlock(new Uint8Array(length))).toThrow();
  });
});

describe("AesCbcChunk", () => {
  // NIST SP 800-38A F.2.1 / F.2.2, first block
  const key = hex("2b7e151628aed2a6abf7158809cf4f3c");
  const iv = hex("000102030405060708090a0b0c0d0e0f");

  it("matches the CBC-AES128 vector both ways", () => {
    const cbc = new AesCbcChunk(key, iv);
    expect(toHex(cbc.encrypt(hex("6bc1bee22e409f96e93d7e117393172a")))).toBe("7649abac8119b246cee98e9b12e9197d");
    expect(toHex(cbc.decrypt(hex("7649abac8119b246cee98e9b12e9197d")))).toBe("6bc1bee22e409f96e93d7e117393172a");
  });
});
