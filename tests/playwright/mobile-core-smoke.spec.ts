import { expect, test, type Page, type Route } from "@playwright/test";
import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const BASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 895 420"><rect width="895" height="420" fill="#031225"/><path d="M42 270 L130 205 L595 198 L670 95 L756 95 L805 205 L870 226 L835 355 L72 355 Z" fill="#123e60" stroke="#70b8e8" stroke-width="3"/></svg>`;

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

async function installMobileFixtures(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORT);
  const seedStorage = ({ key }: { key: string }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(key, "super_admin");
    localStorage.setItem("arus-ui-theme", "dark");
    localStorage.setItem("arus-setup-complete", "true");
  };
  await page.addInitScript(
    seedStorage,
    { key: ROLE_STORAGE_KEY },
  );

  await page.route("**/api/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/media")) {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: BASE_SVG });
      return;
    }

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
      vessels: { view: true, edit: true },
      safety_bulletins: { view: true, create: true },
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
      "/api/vessels": [vessel],
      "/api/equipment": [],
      "/api/work-orders": [],
      "/api/alerts": [],
      "/api/crew": [crewMember],
      "/api/crew/former": [],
      "/api/crew-roles": [{ id: "role-captain", name: "captain", displayName: "Captain", sortOrder: 1 }],
      "/api/permissions/roles": [],
      "/api/admin/crew/access-readiness": [],
      "/api/admin/crew/former-access-risks": [],
      "/api/crew-documents/expiring": {
        documents: [],
        summary: { total: 0, critical: 0, warning: 0, notice: 0 },
      },
      "/api/crew-certifications/expiring": {
        certifications: [],
        summary: { total: 0, critical: 0, warning: 0, notice: 0 },
      },
      "/api/parts-inventory": [inventoryPart],
      "/api/parts-inventory/low-stock-suggestions": {
        total: 0,
        suggestions: [],
        estimatedTotalCost: 0,
      },
      "/api/parts-inventory/smart-replenishment": { suggestions: [] },
      "/api/suppliers": [],
      "/api/purchase-requests": [],
      "/api/service-requests": [],
      "/api/safety-bulletins": [
        {
          id: "safety-1",
          title: "Muster drill notice",
          body: "Monthly safety drill scheduled.",
          severity: "info",
          effectiveDate: "2026-06-01",
          reference: "SAFE-001",
        },
      ],
      "/api/vessel-intelligence/vessel-1/summary": {
        diagrams: [diagram],
        activeDiagram: diagram,
        sectionMaps: [sectionMap],
        activeSectionMap: sectionMap,
        validationIssues: [],
      },
      "/api/vessel-intelligence/vessel-1/diagrams": [diagram],
      "/api/vessel-intelligence/vessel-1/section-maps": [sectionMap],
      "/api/vessel-intelligence/section-map-templates": [],
    };

    const body = Object.hasOwn(responses, path) ? responses[path] : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").fill("playwright-admin");
  await page.getByTestId("input-admin-password").fill("playwright-password");
  await page.getByTestId("button-admin-login").click();
  await expect(page.getByTestId("text-admin-hubs-title")).toBeVisible();
}

async function expectNoMobileOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.dataset.testid,
          className: element.className,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          text: element.textContent?.trim().slice(0, 80),
        };
      })
      .filter((item) => item.right > viewportWidth + 2 || item.left < -2)
      .sort((a, b) => Math.abs(b.right - viewportWidth) - Math.abs(a.right - viewportWidth))
      .slice(0, 5);
    return {
      hasOverflow: document.documentElement.scrollWidth > viewportWidth + 2,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders,
    };
  });
  expect(
    overflow.hasOverflow,
    `page should not horizontally overflow the mobile viewport: ${JSON.stringify(overflow)}`,
  ).toBe(false);
}

async function navigateWithinAuthenticatedSpa(page: Page, path: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

test.describe("mobile core operational smokes", () => {
  test("Fleet/Vessel Intelligence renders on mobile", async ({ page }) => {
    await installMobileFixtures(page);
    await navigateWithinAuthenticatedSpa(page, "/vessel-intelligence/vessel-1/overview");
    await expect(page.getByTestId("vessel-intelligence-hub")).toBeVisible();
    await expectNoMobileOverflow(page);
  });

  test("Crew renders on mobile", async ({ page }) => {
    await installMobileFixtures(page);
    await navigateWithinAuthenticatedSpa(page, "/crew-management");
    await expect(page.getByTestId("page-crew-management")).toBeVisible();
    await expectNoMobileOverflow(page);
  });

  test("Inventory/Logistics renders on mobile", async ({ page }) => {
    await installMobileFixtures(page);
    await navigateWithinAuthenticatedSpa(page, "/logistics?tab=inventory");
    await expect(page.getByTestId("inventory-management-page")).toBeVisible();
    await expectNoMobileOverflow(page);
  });

  test("Safety renders on mobile", async ({ page }) => {
    await installMobileFixtures(page);
    await navigateWithinAuthenticatedSpa(page, "/safety-bulletins");
    await expect(page.getByTestId("text-page-title")).toBeVisible();
    await expectNoMobileOverflow(page);
  });
});
