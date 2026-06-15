import { expect, test, type Page, type Route } from "@playwright/test";
import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";
import {
  getMobileReadinessExpectedScreen,
  isMobileReadinessReplacementPath,
} from "../../client/src/features/mobile-readiness/mobile-readiness-route-contract";

const vessel = { id: "vessel-1", name: "MV ARUS Explorer" };
const crewMember = {
  id: "crew-1",
  name: "Ada Mariner",
  rank: "captain",
  crewCode: "CRW-001",
  active: true,
  onDuty: true,
  status: "active",
  employmentType: "permanent",
  skills: [],
  vesselId: vessel.id,
};
const inventoryPart = {
  id: "part-1",
  partNumber: "FLT-001",
  partName: "Duplex fuel filter",
  category: "filters",
  unitOfMeasure: "ea",
  standardCost: 42,
  unitCost: 42,
  minStockLevel: 2,
  maxStockLevel: 12,
  leadTimeDays: 7,
  location: "MAIN",
  stock: { quantityOnHand: 5, reservedQuantity: 0 },
};
const diagram = {
  id: "diagram-side-elevation",
  vesselId: vessel.id,
  diagramType: "side_elevation",
  title: "Side Elevation",
  status: "active",
  activeVersionId: "version-1",
  currentSectionMapId: "map-1",
  updatedAt: "2026-06-01T00:00:00.000Z",
};
const sectionMap = {
  id: "map-1",
  vesselId: vessel.id,
  diagramId: diagram.id,
  diagramVersionId: "version-1",
  name: "Main section map",
  status: "published",
  coordinateMode: "normalized",
  diagramWidth: 895,
  diagramHeight: 420,
  sections: [],
};

async function installCoreFixtures(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, "super_admin");
      localStorage.setItem("arus-ui-theme", "dark");
      localStorage.setItem("arus-setup-complete", "true");
    },
    { key: ROLE_STORAGE_KEY }
  );

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/portal/login" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionToken: "playwright-session-token",
          expiresIn: 3600,
          mustChangePassword: false,
          user: { id: "playwright-admin", name: "Playwright Admin", role: "super_admin" },
        }),
      });
      return;
    }

    const permissions = {
      crew_members: { view: true, create: true, edit: true, delete: true, export: true },
      inventory: { view: true, create: true, edit: true, delete: true, export: true },
      permission_management: { view: true, edit: true },
      safety_bulletins: { view: true, create: true },
      vessels: { view: true, edit: true },
      "vessel-intelligence": {
        view: true,
        configure: true,
        "upload-diagram": true,
        "publish-map": true,
        "rollback-diagram": true,
        "edit-section-map": true,
        "replace-section-thumbnail": true,
        "replace-equipment-thumbnail": true,
        "assign-equipment": true,
      },
    };

    const responses: Record<string, unknown> = {
      "/api/permissions/me": {
        userId: "playwright-admin",
        orgId: "org-playwright",
        roles: [{ id: "role-admin", name: "super_admin", displayName: "Super Admin" }],
        permissions,
        hubAdmin: true,
        hubAccess: null,
        isDevMode: false,
      },
      "/api/permissions/audit": [],
      "/api/permissions/registry": [],
      "/api/permissions/roles": [
        { id: "role-admin", name: "super_admin", displayName: "Super Admin" },
      ],
      "/api/admin/crew/access-readiness": [],
      "/api/admin/crew/former-access-risks": [],
      "/api/alerts": [],
      "/api/crew": [crewMember],
      "/api/crew/former": [],
      "/api/crew-roles": [
        { id: "role-captain", name: "captain", displayName: "Captain", sortOrder: 1 },
      ],
      "/api/crew-roles/document-compliance": [],
      "/api/crew-certifications/expiring": {
        certifications: [],
        summary: { total: 0, critical: 0, warning: 0, notice: 0 },
      },
      "/api/crew-documents/expiring": {
        documents: [],
        summary: { total: 0, critical: 0, warning: 0, notice: 0 },
      },
      "/api/crew-tasks": [],
      "/api/equipment": [],
      "/api/parts-inventory": [inventoryPart],
      "/api/parts-inventory/filter-options": {
        categories: [{ value: "filters", label: "Filters" }],
        locations: [{ value: "MAIN", label: "MAIN" }],
        suppliers: [],
      },
      "/api/parts-inventory/low-stock-suggestions": {
        total: 0,
        suggestions: [],
        estimatedTotalCost: 0,
      },
      "/api/parts-inventory/smart-replenishment": { suggestions: [] },
      "/api/purchase-requests": [],
      "/api/safety-bulletins": [
        {
          id: "safety-1",
          title: "Muster drill notice",
          body: "Monthly safety drill scheduled.",
          severity: "info",
          category: "fleet",
          effectiveDate: "2026-06-01",
          reference: "SAFE-001",
        },
      ],
      "/api/service-requests": [],
      "/api/suppliers": [],
      "/api/vessels": [vessel],
      "/api/work-orders": [],
      "/api/vessel-intelligence/section-map-templates": [],
      "/api/vessel-intelligence/vessel-1/diagrams": [diagram],
      "/api/vessel-intelligence/vessel-1/section-maps": [sectionMap],
      "/api/vessel-intelligence/vessel-1/summary": {
        diagrams: [diagram],
        activeDiagram: diagram,
        sectionMaps: [sectionMap],
        activeSectionMap: sectionMap,
        validationIssues: [],
      },
    };

    const body = Object.hasOwn(responses, path) ? responses[path] : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function loginAsAdmin(page: Page): Promise<void> {
  await installCoreFixtures(page);
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").fill("playwright-admin");
  await page.getByTestId("input-admin-password").fill("playwright-password");
  await page.getByTestId("button-admin-login").click();
  await expectMobileReadinessShell(page, "/");
}

async function navigateWithinAuthenticatedSpa(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function expectUniversalOpsShell(page: Page, activeHubName: string): Promise<void> {
  await expect(page.getByTestId("universal-ops-shell")).toBeVisible();
  await expect(page.getByTestId("universal-ops-rail")).toBeVisible();
  await expect(page.getByTestId("universal-ops-subnav")).toBeVisible();
  await expect(page.getByTestId("universal-ops-active-hub")).toContainText(activeHubName);
  await expect(page.getByTestId("mobile-readiness-shell")).toHaveCount(0);
}

async function expectMobileReadinessShell(page: Page, path: string): Promise<void> {
  const marker = getMobileReadinessExpectedScreen(path);
  expect(isMobileReadinessReplacementPath(path)).toBe(true);
  expect(marker).not.toBeNull();
  await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
  await expect(page.getByTestId(`mobile-readiness-screen-${marker}`)).toBeVisible();
  await expect(page.getByTestId("mobile-readiness-bottom-nav")).toHaveCount(1);
  await expect(page.getByTestId("universal-ops-shell")).toHaveCount(0);
  await expect(page.getByTestId("text-admin-hubs-title")).toHaveCount(0);
}

test.describe("core browser release smokes", () => {
  test("login and admin shell load with deterministic auth and tenant fixtures", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await expectMobileReadinessShell(page, "/");
  });

  test("replacement hubs render the mobile readiness shell", async ({ page }) => {
    await loginAsAdmin(page);

    for (const path of ["/fleet", "/maint", "/crew-management", "/logistics", "/logs", "/system"]) {
      await navigateWithinAuthenticatedSpa(page, path);
      await expectMobileReadinessShell(page, path);
    }
  });

  test("non-replacement admin hubs preserve the universal shell", async ({ page }) => {
    await loginAsAdmin(page);

    for (const [path, activeHubName] of [
      ["/operations", "Operations"],
      ["/analytics", "Analytics"],
    ] as const) {
      await navigateWithinAuthenticatedSpa(page, path);
      await expectUniversalOpsShell(page, activeHubName);
    }
  });

  test("registered admin routes outside hub child nav still receive the universal shell", async ({
    page,
  }) => {
    await loginAsAdmin(page);

    await navigateWithinAuthenticatedSpa(page, "/safety-bulletins");
    await expectUniversalOpsShell(page, "Operations");

    await navigateWithinAuthenticatedSpa(page, "/admin/access-diagnostic");
    await expectUniversalOpsShell(page, "System");
  });

  test("Vessel Intelligence registry loads", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateWithinAuthenticatedSpa(page, "/vessel-intelligence/vessel-1/diagrams");
    await expectMobileReadinessShell(page, "/vessel-intelligence/vessel-1/diagrams");
    await expect(page.getByText("Vessel diagram")).toBeVisible();
  });

  test("Crew page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateWithinAuthenticatedSpa(page, "/crew-management");
    await expectMobileReadinessShell(page, "/crew-management");
    await expect(page.getByText("Crew Readiness Overview")).toBeVisible();
  });

  test("Inventory and Logistics page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateWithinAuthenticatedSpa(page, "/logistics?tab=inventory");
    await expectMobileReadinessShell(page, "/logistics");
    await expect(page.getByText("Inventory & Logistics")).toBeVisible();
  });

  test("Safety page loads", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateWithinAuthenticatedSpa(page, "/safety-bulletins");
    await expectUniversalOpsShell(page, "Operations");
    await expect(page.getByTestId("text-page-title")).toBeVisible();
    await expect(page.getByText("Muster drill notice")).toBeVisible();
  });

  test("Admin permissions redirect lands on consolidated access management", async ({ page }) => {
    await loginAsAdmin(page);
    await navigateWithinAuthenticatedSpa(page, "/permissions-settings");
    await expect(page).toHaveURL(/\/crew-management\?view=roles$/);
    await expectMobileReadinessShell(page, "/crew-management");
  });
});
