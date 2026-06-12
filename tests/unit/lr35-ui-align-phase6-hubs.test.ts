/**
 * UI Align Phase 6 — impacted hub pages now use mobile readiness replacements.
 *
 * The old standalone maintenance/crew/logistics/system overview hubs are part
 * of the legacy UI requested for full replacement. These tests pin the new
 * wrappers, route convergence, and unchanged shared RBAC policy.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();

async function readSrc(path: string): Promise<string> {
  return readFile(resolve(REPO_ROOT, path), "utf8");
}

describe("UI Align Phase 6 — mobile readiness hub replacements", () => {
  it.each([
    ["maintenance-hub.tsx", "MobilePdmPage"],
    ["pdm-platform.tsx", "MobilePdmPage"],
    ["crew-management.tsx", "MobileCrewPage"],
    ["logistics-hub.tsx", "MobileInventoryPage"],
    ["system-hub.tsx", "MobileSettingsPage"],
    ["work-orders.tsx", "MobileWorkOrdersPage"],
    ["logs-hub.tsx", "MobileLogsPage"],
  ])("%s delegates to %s", async (file, component) => {
    const src = await readSrc(`client/src/pages/${file}`);
    expect(src).toContain(component);
    expect(src).not.toMatch(/setInterval\(|apiRequest\(|\bfetch\(/);
  });

  it("shared mobile readiness screens contain the Figma panel concepts", async () => {
    const screenSrc = await readSrc(
      "client/src/features/mobile-readiness/MobileReadinessScreens.tsx"
    );
    const modelSrc = await readSrc(
      "client/src/features/mobile-readiness/mobile-readiness-model.ts"
    );

    expect(screenSrc).toContain("MobilePdmPage");
    expect(screenSrc).toContain("MobileCrewPage");
    expect(screenSrc).toContain("MobileInventoryPage");
    expect(screenSrc).toContain("MobileSettingsPage");
    expect(screenSrc).toContain("MobileWorkExecutionPage");
    expect(screenSrc).toContain("PdM Risk Queue");
    expect(screenSrc).toContain("Work Queue");
    expect(screenSrc).toContain("Checklist");
    expect(screenSrc).toContain("Crew Readiness Overview");
    expect(screenSrc).toContain("Inventory & Logistics");
    expect(modelSrc).toContain("System Configuration");
    expect(modelSrc).toContain("Copilot + Knowledge Base Settings");
  });

  it("routes service fulfillment lanes back into the work queue", async () => {
    const routes = await readSrc("client/src/routes/logistics.ts");
    const maintenanceRoutes = await readSrc("client/src/routes/maintenance.ts");
    expect(maintenanceRoutes).toContain('path: "/work-orders/:workOrderId"');
    expect(routes).toContain('path: "/service-orders"');
    expect(routes).toContain('path: "/service-requests"');
    expect(routes).toContain("component: WorkOrders");
  });
});

describe("UI Align Phase 6 — RBAC behaviour stays in role-navigation-policy", () => {
  const HUB_IDS = ["maintenance", "crew", "logistics", "analytics", "system"] as const;
  const ADMIN_ROLES = [
    "system_admin",
    "company_admin",
    "chief_engineer",
    "fleet_manager",
    "captain",
  ] as const;
  const USER_ROLES = ["deck_officer", "viewer", "unknown_role", null] as const;

  async function loadPolicy() {
    return import("../../client/src/application/navigation/role-navigation-policy");
  }

  it.each(ADMIN_ROLES)("admin role %s sees all five hub categories", async (role) => {
    const { getPortalForRole, getPrimaryCategoriesForRole } = await loadPolicy();
    expect(getPortalForRole(role)).toBe("admin");
    const ids = getPrimaryCategoriesForRole(role).map((category: { id: string }) => category.id);
    for (const hubId of HUB_IDS) {
      expect(ids).toContain(hubId);
    }
  });

  it.each(USER_ROLES)("non-admin role %s does not receive hub categories", async (role) => {
    const { getPortalForRole, getPrimaryCategoriesForRole } = await loadPolicy();
    expect(getPortalForRole(role)).toBe("user");
    const ids = getPrimaryCategoriesForRole(role).map((category: { id: string }) => category.id);
    for (const hubId of HUB_IDS) {
      expect(ids).not.toContain(hubId);
    }
  });

  it("a tampered override cannot smuggle hub categories into a user-portal session", async () => {
    const { intersectOverrideWithPolicy, getPrimaryCategoriesForRole } = await loadPolicy();
    const result = intersectOverrideWithPolicy("viewer", [
      "maintenance",
      "system",
      "crew",
      "logistics",
      "analytics",
    ]);
    expect(result).toEqual(getPrimaryCategoriesForRole("viewer"));
    for (const category of result) {
      expect(HUB_IDS).not.toContain(category.id as (typeof HUB_IDS)[number]);
    }
  });

  it("each hub category's hubRoute points to a registered route", async () => {
    const expected: Record<(typeof HUB_IDS)[number], { file: string; path: string }> = {
      maintenance: { file: "client/src/routes/maintenance.ts", path: "/maint" },
      crew: { file: "client/src/routes/crew.ts", path: "/crew-management" },
      logistics: { file: "client/src/routes/logistics.ts", path: "/logistics" },
      analytics: { file: "client/src/routes/analytics.ts", path: "/analytics" },
      system: { file: "client/src/routes/system.ts", path: "/system" },
    };
    const { getPrimaryCategoriesForRole } = await loadPolicy();
    const cats = getPrimaryCategoriesForRole("system_admin");
    const byId = new Map(
      cats.map((category: { id: string; hubRoute: string }) => [category.id, category])
    );
    for (const hubId of HUB_IDS) {
      const category = byId.get(hubId);
      expect(category?.hubRoute).toBe(expected[hubId].path);
      const routeFile = await readSrc(expected[hubId].file);
      expect(routeFile).toContain(`"${expected[hubId].path}"`);
    }
  });
});
