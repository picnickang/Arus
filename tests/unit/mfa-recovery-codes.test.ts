/**
 * SEC regression — MFA recovery codes must be generated with a CSPRNG.
 *
 * Recovery codes are break-glass credentials "as powerful as the TOTP
 * secret". They were previously built with `Math.random()`, which is not
 * cryptographically secure and is predictable from prior outputs. This test
 * pins the format/charset and exercises the generator heavily to assert it
 * draws from the full alphabet without obvious bias (a smoke check that a
 * real RNG is in use; it does not — and cannot — prove cryptographic
 * strength on its own).
 */

import { describe, it, expect } from "@jest/globals";
import { generateRecoveryCodes } from "../../server/lib/mfa-totp";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/;

describe("generateRecoveryCodes", () => {
  it("returns the requested count with the documented format", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(CODE_RE);
    }
  });

  it("produces unique codes across a batch", () => {
    const codes = generateRecoveryCodes(50);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("draws from the entire alphabet and is not constant", () => {
    const seen = new Set<string>();
    for (const code of generateRecoveryCodes(500)) {
      for (const ch of code.replace("-", "")) {
        seen.add(ch);
      }
    }
    // With 500 codes * 10 chars = 5000 draws over a 32-char alphabet, every
    // symbol should appear; a stuck/constant generator would fail this.
    for (const ch of ALPHABET) {
      expect(seen.has(ch)).toBe(true);
    }
  });
});
