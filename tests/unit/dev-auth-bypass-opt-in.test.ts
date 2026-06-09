/**
 * SEC regression — the temporary dev auth helper must be token-login scoped.
 *
 * The old DEV_AUTH_BYPASS flag granted synthetic admin identity to
 * unauthenticated callers. The helper now follows the modular dev-login
 * feature flag only; callers still need a token minted by /api/portal/dev-login
 * before they resolve as admin or user preview sessions.
 */

import { describe, it, expect, afterEach } from "@jest/globals";
import { isDevAuthBypassEnabled } from "../../server/security/dev-auth";

describe("isDevAuthBypassEnabled — dev-login scoped", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("is enabled in development by the modular dev-login gate", () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["ARUS_DEV_LOGIN"];
    expect(isDevAuthBypassEnabled()).toBe(true);
  });

  it("is disabled in development when ARUS_DEV_LOGIN=0", () => {
    process.env["NODE_ENV"] = "development";
    process.env["ARUS_DEV_LOGIN"] = "0";
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("does not honor the retired DEV_AUTH_BYPASS flag in test", () => {
    process.env["NODE_ENV"] = "test";
    process.env["DEV_AUTH_BYPASS"] = "1";
    delete process.env["ARUS_DEV_LOGIN"];
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("is enabled in test only when ARUS_DEV_LOGIN=1", () => {
    process.env["NODE_ENV"] = "test";
    process.env["ARUS_DEV_LOGIN"] = "1";
    expect(isDevAuthBypassEnabled()).toBe(true);
  });

  it("is never enabled in production, even with ARUS_DEV_LOGIN=1", () => {
    process.env["NODE_ENV"] = "production";
    process.env["ARUS_DEV_LOGIN"] = "1";
    expect(isDevAuthBypassEnabled()).toBe(false);
  });

  it("can be explicitly enabled outside production for local tooling", () => {
    delete process.env["NODE_ENV"];
    process.env["ARUS_DEV_LOGIN"] = "1";
    expect(isDevAuthBypassEnabled()).toBe(true);
  });
});
