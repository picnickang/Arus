/**
 * Task #257 — Retire the legacy shared-password admin unlock.
 *
 * Pins the desktop setup wizard to a REAL account login and guards against a
 * regression back to the shared-password admin unlock:
 * - Setup authenticates via `POST /api/portal/login` and adopts the returned
 *   session token (so completion is gated behind a real sign-in).
 * - Setup never calls the removed shared-password endpoint
 *   (`/api/admin/auth/verify`) nor the removed `unlockAdmin` context method.
 * - The shared-password verify route is gone from the system-admin auth routes.
 */

import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "fs";
import { resolve } from "path";

// Jest runs from the repository root, so resolve fixtures from cwd. This keeps
// the test ESM-safe (no `__dirname`, which is undefined under "type": "module").
function read(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), "utf8");
}

describe("Task #257 — desktop setup uses real account login", () => {
  const desktopSetup = read("client/src/pages/desktop-setup.tsx");

  it("authenticates through the public portal-login endpoint", () => {
    expect(desktopSetup).toContain("/api/portal/login");
  });

  it("adopts the real account session token on successful login", () => {
    expect(desktopSetup).toContain("setApiSessionToken");
  });

  it("includes an explicit sign-in step in the wizard", () => {
    expect(desktopSetup).toMatch(/SignInStep/);
    expect(desktopSetup).toContain('"signin"');
  });

  it("does not call the removed shared-password unlock paths", () => {
    expect(desktopSetup).not.toContain("/api/admin/auth/verify");
    expect(desktopSetup).not.toContain("unlockAdmin(");
  });
});

describe("Task #257 — shared-password verify route is removed", () => {
  const authRoutes = read("server/domains/system-admin/routes/auth-routes.ts");

  it("no longer registers /admin/auth/verify", () => {
    expect(authRoutes).not.toContain("auth/verify");
  });

  it("setup route mints no session (returns success only)", () => {
    expect(authRoutes).not.toContain("createAdminSession");
  });
});
