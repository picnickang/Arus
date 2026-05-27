/**
 * LR-3.5 / SEC-2 regression: the admin setup-token / legacy plaintext
 * compare must hash both sides to a fixed-size digest and use
 * `crypto.timingSafeEqual`, so an attacker cannot recover the token
 * byte-by-byte from response timing. We test the exported helper
 * directly — it is the same function called by `hasValidSetupToken`
 * and the legacy `ADMIN_TOKEN` fallback in `auth-routes.ts`.
 */
import { describe, it, expect } from "@jest/globals";
import { constantTimeEqualString } from "../../server/lib/constant-time-compare";

describe("LR-3.5 SEC-2 — constantTimeEqualString", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqualString("setup-token-abc", "setup-token-abc")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(constantTimeEqualString("setup-token-abc", "setup-token-xyz")).toBe(false);
  });

  it("returns false for different strings of different length (no length leak via throw)", () => {
    // Both sides are sha256-digested first, so timingSafeEqual sees
    // 32-byte buffers regardless of input length — the call must NOT
    // throw and must NOT short-circuit on length.
    expect(() => constantTimeEqualString("short", "this-is-much-longer-token")).not.toThrow();
    expect(constantTimeEqualString("short", "this-is-much-longer-token")).toBe(false);
  });

  it("returns true for empty equal inputs", () => {
    expect(constantTimeEqualString("", "")).toBe(true);
  });

  it("returns false when only one side is empty", () => {
    expect(constantTimeEqualString("", "non-empty")).toBe(false);
    expect(constantTimeEqualString("non-empty", "")).toBe(false);
  });
});
