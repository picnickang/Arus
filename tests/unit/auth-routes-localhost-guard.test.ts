/**
 * SEC regression — first-run admin setup must NOT trust client-supplied
 * headers as proof of locality.
 *
 * The previous `isLocalhostOrTauri` gate accepted `Origin: tauri://localhost`
 * or a `User-Agent` containing "Tauri", both fully attacker-controlled. A
 * remote, unauthenticated caller could therefore pass the localhost-only
 * guard protecting `/api/admin/auth/setup` and seize the first-run admin
 * credential bootstrap. This test pins that those header spoofs are rejected
 * and that only the transport peer address / server-side env / setup-token
 * are trusted.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { Request } from "express";
import { isLocalSetupRequest } from "../../server/domains/system-admin/routes/auth-routes";

function fakeReq(opts: {
  remoteAddress?: string;
  headers?: Record<string, string>;
}): Request {
  return {
    socket: { remoteAddress: opts.remoteAddress } as Request["socket"],
    headers: opts.headers ?? {},
  } as unknown as Request;
}

describe("isLocalSetupRequest — header-spoofing regression", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env['REPL_ID'];
    delete process.env['SETUP_TOKEN'];
    process.env['NODE_ENV'] = "production";
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("rejects a remote caller spoofing the Tauri Origin header", () => {
    const req = fakeReq({
      remoteAddress: "203.0.113.7",
      headers: { origin: "tauri://localhost" },
    });
    expect(isLocalSetupRequest(req)).toBe(false);
  });

  it("rejects a remote caller spoofing a Tauri User-Agent", () => {
    const req = fakeReq({
      remoteAddress: "203.0.113.7",
      headers: { "user-agent": "Mozilla/5.0 Tauri/2.0" },
    });
    expect(isLocalSetupRequest(req)).toBe(false);
  });

  it("rejects a plain remote caller", () => {
    expect(isLocalSetupRequest(fakeReq({ remoteAddress: "198.51.100.4" }))).toBe(false);
  });

  it("allows a genuine loopback caller (covers the local Tauri sidecar)", () => {
    expect(isLocalSetupRequest(fakeReq({ remoteAddress: "127.0.0.1" }))).toBe(true);
    expect(isLocalSetupRequest(fakeReq({ remoteAddress: "::1" }))).toBe(true);
    expect(isLocalSetupRequest(fakeReq({ remoteAddress: "::ffff:127.0.0.1" }))).toBe(true);
  });

  it("allows a remote caller only with a valid X-Setup-Token", () => {
    process.env['SETUP_TOKEN'] = "s3cret-token-value";
    expect(
      isLocalSetupRequest(
        fakeReq({ remoteAddress: "203.0.113.7", headers: { "x-setup-token": "s3cret-token-value" } })
      )
    ).toBe(true);
    expect(
      isLocalSetupRequest(
        fakeReq({ remoteAddress: "203.0.113.7", headers: { "x-setup-token": "wrong" } })
      )
    ).toBe(false);
  });
});
