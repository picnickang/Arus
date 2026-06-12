import { describe, expect, it } from "@jest/globals";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();
const PORTAL_LOGIN = resolve(REPO_ROOT, "client/src/pages/portal-login.tsx");
const HOME_PAGE = resolve(REPO_ROOT, "client/src/pages/home.tsx");
const PERMISSIONS_CONTEXT = resolve(REPO_ROOT, "client/src/contexts/PermissionsContext.tsx");
const ADMIN_ACCESS_CONTEXT = resolve(REPO_ROOT, "client/src/contexts/AdminAccessContext.tsx");
const ADMIN_API = resolve(REPO_ROOT, "client/src/lib/admin-api.ts");
const DEV_LOGIN_DIR = resolve(REPO_ROOT, "client/src/features/dev-login");
const DEV_LOGIN_SHARED = resolve(REPO_ROOT, "shared/dev-login.ts");

describe("temporary dev-login client contract", () => {
  it("keeps dev-login UI in a removable feature folder", async () => {
    const [roles, shared, api, buttons, tabs] = await Promise.all([
      readFile(resolve(DEV_LOGIN_DIR, "roles.ts"), "utf8"),
      readFile(DEV_LOGIN_SHARED, "utf8"),
      readFile(resolve(DEV_LOGIN_DIR, "api.ts"), "utf8"),
      readFile(resolve(DEV_LOGIN_DIR, "DevLoginButtons.tsx"), "utf8"),
      readFile(resolve(DEV_LOGIN_DIR, "DevUserRoleTabs.tsx"), "utf8"),
    ]);

    expect(roles).toContain("@shared/dev-login");
    expect(roles).toContain("DEV_USER_ROLES");
    expect(shared).toContain("deck_officer");
    expect(shared).toContain("maintenance_planner");
    const roleList = shared.match(/DEV_USER_ROLES = \[([\s\S]*?)\] as const/)?.[1] ?? "";
    expect(roleList).not.toContain('"admin"');
    expect(roleList).not.toContain('"super_admin"');
    expect(api).toContain("/api/portal/dev-login");
    expect(buttons).toContain("button-dev-login-admin");
    expect(buttons).toContain("button-dev-login-user");
    expect(buttons).toContain("requestDevLogin");
    expect(tabs).toContain('data-testid="dev-user-role-tabs"');
  });

  it("adds explicit dev login buttons to portal-login without raw localStorage writes", async () => {
    const src = await readFile(PORTAL_LOGIN, "utf8");
    expect(src).toContain("DevLoginButtons");
    expect(src).not.toMatch(/localStorage\.(getItem|setItem|removeItem)/);
  });

  it("routes dev user previews into the mobile readiness command center", async () => {
    const src = await readFile(HOME_PAGE, "utf8");
    expect(src).toContain("MobileCommandCenterPage");
    expect(src).not.toMatch(/DevUserRoleTabs|onRoleChanged|shell-user-portal/);
  });

  it("removes old implicit client-side dev permission bypasses", async () => {
    const [permissions, adminAccess, adminApi] = await Promise.all([
      readFile(PERMISSIONS_CONTEXT, "utf8"),
      readFile(ADMIN_ACCESS_CONTEXT, "utf8"),
      readFile(ADMIN_API, "utf8"),
    ]);

    expect(permissions).not.toContain("DevModeToggle");
    expect(permissions).not.toContain("getDevModeOverride");
    expect(adminAccess).not.toContain("DEV_AUTO_ADMIN");
    expect(adminAccess).not.toContain("effectiveIsAdminUnlocked");
    expect(adminApi).not.toContain("no-login dev identity");
    expect(adminApi).toContain("Admin session not active");
  });
});
