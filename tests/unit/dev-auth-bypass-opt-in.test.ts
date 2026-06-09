/**
 * SEC regression — the dev auth bypass must be OPT-IN.
 *
 * Previously the bypass was opt-out: active whenever NODE_ENV=development
 * unless DEV_AUTH_BYPASS=0. That meant any context that landed in
 * "development" (and forgot to set DEV_AUTH_BYPASS=0) silently granted an
 * admin identity to unauthenticated callers. It is now opt-in: it requires
 * BOTH NODE_ENV=development AND DEV_AUTH_BYPASS=1, so a stray/forgotten env
 * fails closed. (`npm run dev` sets both, preserving local DX.)
 */

import { describe, it, expect, afterEach } from "@jest/globals";
import { isDevAuthBypassEnabled } from "../../server/security/dev-auth";

describe("isDevAuthBypassEnabled — opt-in", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is enabled only with NODE_ENV=development AND DEV_AUTH_BYPASS=1", () => {
    process.env["NODE_ENV"] = "development";
    process.env["DEV_AUTH_BYPASS"] = "1";
    expect(isDevAuthBypassEnabled()).toBe(true);
  });

  it("is DISABLED in development when DEV_AUTH_BYPASS is unset (the hardening)", () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["DEV_AUTH_BYPASS"];
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("is disabled in development when DEV_AUTH_BYPASS=0", () => {
    process.env["NODE_ENV"] = "development";
    process.env["DEV_AUTH_BYPASS"] = "0";
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("is never enabled in production, even with DEV_AUTH_BYPASS=1", () => {
    process.env["NODE_ENV"] = "production";
    process.env["DEV_AUTH_BYPASS"] = "1";
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("is disabled when NODE_ENV is unset", () => {
    delete process.env["NODE_ENV"];
    process.env["DEV_AUTH_BYPASS"] = "1";
    expect(isDevAuthBypassEnabled()).toBe(false);
  });
});
