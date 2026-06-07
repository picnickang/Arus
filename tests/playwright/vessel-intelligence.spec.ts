import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sectionMap = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "docs/design/vessel-intelligence-v2/tokens/data/section_mapping.json"),
    "utf8"
  )
);
const equipmentSeed = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "docs/design/vessel-intelligence-v2/tokens/data/equipment_mapping.json"),
    "utf8"
  )
);

const BASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 895 420"><rect width="895" height="420" fill="#031225"/><path d="M42 270 L130 205 L595 198 L670 95 L756 95 L805 205 L870 226 L835 355 L72 355 Z" fill="#123e60" stroke="#70b8e8" stroke-width="3"/><path d="M510 198 L615 134 L745 134 L760 198 Z" fill="#174e70" stroke="#70b8e8" stroke-width="2"/></svg>`;

function makeFixtures(options?: { viewer?: boolean }) {
  const viewer = options?.viewer === true;
  const equipment = equipmentSeed.equipment.map((item: Record<string, string>, index: number) => ({
    id: item.equipmentId || `equipment-${index + 1}`,
    equipmentId: item.equipmentId,
    vesselId: "vessel-1",
    name: item.name,
    equipmentName: item.name,
    assetCode: item.assetCode,
    tagNumber: item.assetCode,
    system: item.system,
    status: item.status,
    healthStatus: item.status,
    sectionKey: item.sectionKey,
  }));

  const activeSectionMap = {
    id: "map-full-hub-v2",
    name: "Full Hub v2 Section Map",
    status: "published",
    coordinateMode: sectionMap.coordinateMode,
    diagramWidth: sectionMap.diagramWidth,
    diagramHeight: sectionMap.diagramHeight,
    diagramKind: sectionMap.diagramKind,
    sections: sectionMap.sections.map((section: Record<string, unknown>, sectionIndex: number) => ({
      id: `section-${section.sectionKey}`,
      sectionKey: section.sectionKey,
      sectionNo: section.sectionNo,
      name: section.name,
      color: section.color,
      polygonNormalized: section.polygonNormalized,
      labelNormalized: section.labelNormalized,
      thumbnailFallback: section.thumbnailFallback,
      equipment: (section.equipment as string[]).map((name, itemIndex) => ({
        id: `assignment-${sectionIndex + 1}-${itemIndex + 1}`,
        equipmentId: equipment.find((item) => item.name === name || item.assetCode === name)?.id ?? null,
        equipmentName: name,
        assetCode: equipment.find((item) => item.name === name || item.assetCode === name)?.assetCode ?? null,
        system: equipment.find((item) => item.name === name || item.assetCode === name)?.system ?? null,
      })),
    })),
  };

  const permissions = viewer
    ? { "vessel-intelligence": { view: true } }
    : {
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

  return {
    "/api/permissions/me": {
      userId: viewer ? "viewer-user" : "admin-user",
      orgId: "default-org-id",
      roles: [{ id: viewer ? "viewer" : "admin", name: viewer ? "viewer" : "admin", displayName: viewer ? "Viewer" : "Admin" }],
      permissions,
      hubAdmin: true,
      hubAccess: null,
      isDevMode: false,
    },
    "/api/vessels": [{ id: "vessel-1", name: "MV ARUS Explorer" }],
    "/api/equipment": equipment,
    "/api/work-orders": [
      { id: "wo-1", vesselId: "vessel-1", title: "Inspect bow thruster bearing temperature trend", status: "Open", priority: "High" },
    ],
    "/api/alerts": [
      { id: "alert-1", vesselId: "vessel-1", title: "Generator 2 vibration deviation", status: "Open", severity: "Caution" },
    ],
    "/api/pdm/dashboard": { status: "connected" },
    "/api/agent/drafts": [],
    "/api/agent/suggestions": [],
    "/api/vessel-intelligence/vessel-1/summary": {
      diagrams: [
        {
          id: "diagram-side-elevation",
          diagramType: "side_elevation",
          title: "Side Elevation - Full Hub v2",
          status: "active",
          activeVersionId: "version-3",
        },
      ],
      activeDiagram: {
        id: "diagram-side-elevation",
        diagramType: "side_elevation",
        title: "Side Elevation - Full Hub v2",
        status: "active",
        activeVersionId: "version-3",
      },
      sectionMaps: [activeSectionMap],
      activeSectionMap,
      validationIssues: [],
    },
  };
}

async function installVesselFixtures(page: Page, options?: { viewer?: boolean }) {
  const fixtures = makeFixtures(options);
  await page.addInitScript((role) => {
    localStorage.setItem("arus-user-role", role);
    localStorage.setItem("arus-ui-theme", "dark");
    localStorage.setItem("arus-setup-complete", "true");
  }, options?.viewer ? "admin" : "admin");
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/media")) {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: BASE_SVG });
      return;
    }
    const body = Object.hasOwn(fixtures, url.pathname)
      ? fixtures[url.pathname as keyof typeof fixtures]
      : { data: [] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

test.describe("Vessel Intelligence visual workflow", () => {
  test("desktop overview renders Figma-derived regions and uploaded schematic overlay", async ({ page }, testInfo) => {
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/vessel-1/overview", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("vessel-intelligence-hub")).toBeVisible();
    await expect(page.getByTestId("vessel-intelligence-data-sources")).toContainText("Registry");
    await expect(page.getByTestId("diagram-registry-panel")).toContainText("Side Elevation - Full Hub v2");
    await expect(page.getByTestId("equipment-mapping-panel")).toContainText("Main Engine 1");
    await expect(page.getByTestId("uploaded-schematic-base-layer")).toBeVisible();
    await expect(page.getByTestId("section-polygon-main_engine_room")).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-desktop-overview.png"),
      fullPage: false,
    });
  });

  test("mobile section map is view-first and preserves the section detail flow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/vessel-1/sections/main_engine_room", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("vessel-intelligence-section-map")).toBeVisible();
    await page.getByTestId("selected-section-detail").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("selected-section-detail")).toContainText("Main Engine Room");
    await expect(page.getByTestId("selected-section-detail")).toContainText("multiple equipment records");

    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-mobile-section-map.png"),
      fullPage: false,
    });
  });

  test("viewer permissions hide diagram and registry edit controls", async ({ page }) => {
    await installVesselFixtures(page, { viewer: true });
    await page.goto("/vessel-intelligence/vessel-1/overview", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("vessel-intelligence-hub")).toBeVisible();
    await expect(page.getByTestId("button-diagram-versions")).toHaveCount(0);
    await expect(page.getByTestId("button-thumbnail-manager")).toHaveCount(0);
    await expect(page.getByTestId("diagram-replacement-options")).toHaveCount(0);
    await expect(page.getByTestId("settings-link")).toHaveCount(0);
  });
});
