import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { verifySetupToken } from "../../routes/setup-token";

/**
 * P2 #2 — Pins the production verifier (`verifySetupToken`) exported
 * from server/routes/setup.ts. Importing the real function (rather
 * than reimplementing it here) guarantees this test will fail if the
 * route-level token check regresses.
 */
describe("verifySetupToken — constant-time digest compare (P2 #2)", () => {
  const ORIGINAL = process.env['SETUP_TOKEN'];
  const VALID = "correct-horse-battery-staple-32chars!!";

  beforeEach(() => {
    process.env['SETUP_TOKEN'] = VALID;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {delete process.env['SETUP_TOKEN'];}
    else {process.env['SETUP_TOKEN'] = ORIGINAL;}
  });

  it("returns true when token matches exactly", () => {
    expect(verifySetupToken(VALID, VALID)).toBe(true);
  });

  it("returns false when token is wrong but same length", () => {
    const wrongSameLen = "X".repeat(VALID.length);
    expect(wrongSameLen.length).toBe(VALID.length);
    expect(verifySetupToken(VALID, wrongSameLen)).toBe(false);
  });

  it("returns false when token is shorter than configured (no throw)", () => {
    expect(() => verifySetupToken(VALID, "short")).not.toThrow();
    expect(verifySetupToken(VALID, "short")).toBe(false);
  });

  it("returns false when token is longer than configured (no throw)", () => {
    const longer = `${VALID  }EXTRA-SUFFIX-PADDING`;
    expect(() => verifySetupToken(VALID, longer)).not.toThrow();
    expect(verifySetupToken(VALID, longer)).toBe(false);
  });

  it("returns false when provided header is missing/empty/non-string", () => {
    expect(verifySetupToken(VALID, undefined)).toBe(false);
    expect(verifySetupToken(VALID, "")).toBe(false);
    expect(verifySetupToken(VALID, 12345)).toBe(false);
    expect(verifySetupToken(VALID, ["arr"])).toBe(false);
    expect(verifySetupToken(VALID, null)).toBe(false);
  });

  it("returns false when SETUP_TOKEN is not configured (defence-in-depth)", () => {
    expect(verifySetupToken(undefined, "anything")).toBe(false);
    expect(verifySetupToken("", "anything")).toBe(false);
  });
});
