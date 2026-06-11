import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sectionMap: {
  coordinateMode: string;
  diagramWidth: number;
  diagramHeight: number;
  diagramKind: string;
  sections: Array<Record<string, unknown>>;
} = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "docs/design/vessel-intelligence-v2/tokens/data/section_mapping.json"),
    "utf8"
  )
);
const equipmentSeed: { equipment: Array<Record<string, string>> } = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, "docs/design/vessel-intelligence-v2/tokens/data/equipment_mapping.json"),
    "utf8"
  )
);

const BASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 895 420"><rect width="895" height="420" fill="#031225"/><path d="M42 270 L130 205 L595 198 L670 95 L756 95 L805 205 L870 226 L835 355 L72 355 Z" fill="#123e60" stroke="#70b8e8" stroke-width="3"/><path d="M510 198 L615 134 L745 134 L760 198 Z" fill="#174e70" stroke="#70b8e8" stroke-width="2"/></svg>`;

function makeFixtures(options?: { viewer?: boolean }) {
  const viewer = options?.viewer === true;
  const equipment = equipmentSeed.equipment.map((item: Record<string, string>, index: number) => ({
    id: item["equipmentId"] || `equipment-${index + 1}`,
    equipmentId: item["equipmentId"],
    vesselId: "vessel-1",
    name: item["name"],
    equipmentName: item["name"],
    assetCode: item["assetCode"],
    tagNumber: item["assetCode"],
    system: item["system"],
    status: item["status"],
    healthStatus: item["status"],
    sectionKey: item["sectionKey"],
  }));

  const activeSectionMap = {
    id: "map-full-hub-v2",
    vesselId: "vessel-1",
    diagramId: "diagram-side-elevation",
    diagramVersionId: "version-3",
    name: "Full Hub v2 Section Map",
    status: "published",
    coordinateMode: sectionMap.coordinateMode,
    diagramWidth: sectionMap.diagramWidth,
    diagramHeight: sectionMap.diagramHeight,
    diagramKind: sectionMap.diagramKind,
    imageTransform: { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 },
    sections: sectionMap.sections.map((section: Record<string, unknown>, sectionIndex: number) => ({
      id: `section-${section["sectionKey"]}`,
      sectionKey: section["sectionKey"],
      sectionNo: section["sectionNo"],
      name: section["name"],
      color: section["color"],
      polygonNormalized: section["polygonNormalized"],
      labelNormalized: section["labelNormalized"],
      thumbnailFallback: section["thumbnailFallback"],
      equipment: (section["equipment"] as string[]).map((name, itemIndex) => ({
        id: `assignment-${sectionIndex + 1}-${itemIndex + 1}`,
        equipmentId:
          equipment.find((item) => item.name === name || item.assetCode === name)?.id ?? null,
        equipmentName: name,
        assetCode:
          equipment.find((item) => item.name === name || item.assetCode === name)?.assetCode ??
          null,
        system:
          equipment.find((item) => item.name === name || item.assetCode === name)?.system ?? null,
      })),
    })),
  };
  const draftBlankMap = {
    ...activeSectionMap,
    id: "map-draft-blank",
    name: "Blank draft map",
    status: "draft",
    sections: [],
  };
  const sideElevationDiagram = {
    id: "diagram-side-elevation",
    diagramType: "side_elevation",
    title: "Side Elevation - Full Hub v2",
    status: "active",
    activeVersionId: "version-3",
    currentSectionMapId: activeSectionMap.id,
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
  const versions = [
    {
      id: "version-3",
      vesselId: "vessel-1",
      diagramId: "diagram-side-elevation",
      versionNumber: 3,
      status: "active",
      originalFileName: "side-elevation.svg",
      mimeType: "image/svg+xml",
      fileSizeBytes: 1024,
      uploadedBy: "admin-user",
      uploadedAt: "2026-06-01T00:00:00.000Z",
      mediaUrl:
        "/api/vessel-intelligence/vessel-1/diagrams/diagram-side-elevation/versions/version-3/media",
    },
  ];

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
      roles: [
        {
          id: viewer ? "viewer" : "admin",
          name: viewer ? "viewer" : "admin",
          displayName: viewer ? "Viewer" : "Admin",
        },
      ],
      permissions,
      hubAdmin: true,
      hubAccess: null,
      isDevMode: false,
    },
    "/api/vessels": [{ id: "vessel-1", name: "MV ARUS Explorer" }],
    "/api/equipment": equipment,
    "/api/work-orders": [
      {
        id: "wo-1",
        vesselId: "vessel-1",
        title: "Inspect bow thruster bearing temperature trend",
        status: "Open",
        priority: "High",
      },
    ],
    "/api/alerts": [
      {
        id: "alert-1",
        vesselId: "vessel-1",
        title: "Generator 2 vibration deviation",
        status: "Open",
        severity: "Caution",
      },
    ],
    "/api/pdm/dashboard": { status: "connected" },
    "/api/agent/drafts": [],
    "/api/agent/suggestions": [],
    "/api/vessel-intelligence/section-map-templates": [
      { id: "osv_workboat", name: "OSV / Workboat", description: "Workboat starter" },
      { id: "ahts", name: "AHTS", description: "Anchor handler starter" },
      { id: "psv", name: "PSV", description: "Supply vessel starter" },
      { id: "tugboat", name: "Tugboat", description: "Tugboat starter" },
      { id: "pilot_vessel", name: "Pilot Vessel", description: "Pilot vessel starter" },
      { id: "crew_boat", name: "Crew Boat", description: "Crew boat starter" },
      { id: "custom_blank", name: "Custom Blank", description: "Blank map" },
    ],
    "/api/vessel-intelligence/vessel-1/diagrams": [sideElevationDiagram],
    "/api/vessel-intelligence/vessel-1/diagrams/diagram-side-elevation": sideElevationDiagram,
    "/api/vessel-intelligence/vessel-1/diagrams/diagram-side-elevation/versions": versions,
    "/api/vessel-intelligence/vessel-1/diagrams/diagram-side-elevation/versions/active":
      versions[0],
    "/api/vessel-intelligence/vessel-1/section-maps": [activeSectionMap, draftBlankMap],
    "/api/vessel-intelligence/vessel-1/section-maps/map-full-hub-v2": activeSectionMap,
    "/api/vessel-intelligence/vessel-1/section-maps/map-draft-blank": draftBlankMap,
    "/api/vessel-intelligence/vessel-1/summary": {
      diagrams: [sideElevationDiagram],
      activeDiagram: sideElevationDiagram,
      sectionMaps: [activeSectionMap],
      activeSectionMap,
      validationIssues: [],
    },
  };
}

async function installVesselFixtures(page: Page, options?: { viewer?: boolean }) {
  const fixtures = makeFixtures(options);
  const shellRole = "admin";
  await page.addInitScript((role) => {
    localStorage.setItem("arus-user-role", role);
    localStorage.setItem("arus-ui-theme", "dark");
    localStorage.setItem("arus-setup-complete", "true");
  }, shellRole);
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/media")) {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: BASE_SVG });
      return;
    }
    if (route.request().method() === "POST" && url.pathname.endsWith("/versions/upload")) {
      const activeVersion =
        fixtures["/api/vessel-intelligence/vessel-1/diagrams/diagram-side-elevation/versions"][0];
      const draftBlankMap =
        fixtures["/api/vessel-intelligence/vessel-1/section-maps/map-draft-blank"];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          version: { ...activeVersion, id: "version-4", versionNumber: 4, status: "draft" },
          draftMap: draftBlankMap,
          warnings: [],
        }),
      });
      return;
    }
    if (route.request().method() === "POST" && url.pathname.endsWith("/validate")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: { blockers: 0, warnings: 0, checkedAt: "2026-06-01T00:00:00.000Z" },
          issues: [],
        }),
      });
      return;
    }
    if (
      route.request().method() === "POST" &&
      /\/(publish|archive|restore-draft)$/.test(url.pathname)
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          fixtures["/api/vessel-intelligence/vessel-1/diagrams/diagram-side-elevation/versions"][0]
        ),
      });
      return;
    }
    const body = Object.hasOwn(fixtures, url.pathname)
      ? fixtures[url.pathname as keyof typeof fixtures]
      : { data: [] };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("Vessel Intelligence visual workflow", () => {
  test("fleet triage hub renders the Figma-aligned desktop structure and opens drill-downs", async ({
    page,
  }, testInfo) => {
    await installVesselFixtures(page);
    await page.goto("/fleet", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("universal-ops-shell")).toBeVisible();
    await expect(page.getByTestId("universal-ops-rail")).toBeVisible();
    await expect(page.getByTestId("universal-ops-subnav")).toBeVisible();
    await expect(page.getByTestId("universal-ops-subnav-fleet-triage")).toBeVisible();
    await expect(page.getByTestId("universal-ops-subnav-fleet-triage")).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByTestId("fleet-triage-page")).toBeVisible();
    await expect(page.getByTestId("fleet-triage-list")).toContainText("MV ARUS Explorer");
    await expect(page.getByTestId("fleet-map-status")).toBeVisible();
    await expect(page.getByTestId("fleet-status-plot")).toBeVisible();
    await expect(page.getByTestId("global-queue")).toContainText("Open technical alerts");
    await expect(page.getByTestId("fleet-vessel-diagram-preview")).toBeVisible();
    await expect(page.getByTestId("fleet-vessel-section-overlay")).toBeVisible();
    await expect(page.getByTestId("fleet-side-elevation-status")).toContainText("Active");
    await expect(page.getByTestId("fleet-registry-access")).toBeVisible();
    await expect(page.getByTestId("button-open-diagram-registry")).toBeVisible();
    await expect(page.getByTestId("section-polygon-main_engine_room")).toBeVisible();
    await expect(page.getByTestId("fleet-action-board")).toContainText(
      "Generator 2 vibration deviation"
    );

    await page.screenshot({
      path: testInfo.outputPath("fleet-triage-desktop.png"),
      fullPage: false,
    });

    await page.getByTestId("button-open-vessel-action-vessel-1").click();
    await expect(page).toHaveURL(/\/vessel-intelligence\/vessel-1\/alerts/);
  });

  test("/vessel-intelligence/fleet redirects to canonical Fleet Triage", async ({ page }) => {
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/fleet", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/fleet$/);
    await expect(page.getByTestId("fleet-triage-page")).toBeVisible();
  });

  test("fleet side elevation replacement affordance reaches the working registry flow", async ({
    page,
  }) => {
    await installVesselFixtures(page);
    await page.goto("/fleet", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("button-replace-side-elevation")).toBeVisible();
    await page.getByTestId("button-replace-side-elevation").click();
    await expect(page).toHaveURL(
      /\/vessel-intelligence\/vessel-1\/diagrams(\/diagram-side-elevation)?/
    );
    await expect(page.getByText("Side Elevation - Full Hub v2")).toBeVisible();
    await expect(page.getByTestId("button-upload-replace-diagram").first()).toBeVisible();
  });

  test("mobile fleet triage uses the universal admin drawer shell", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVesselFixtures(page);
    await page.goto("/fleet", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("fleet-triage-page")).toBeVisible();
    await expect(page.getByTestId("universal-ops-shell")).toBeVisible();
    await expect(page.getByTestId("universal-ops-mobile-menu-trigger")).toBeVisible();
    await page.getByTestId("universal-ops-mobile-menu-trigger").click();
    await expect(page.getByTestId("universal-ops-mobile-drawer")).toBeVisible();
    await expect(page.getByTestId("universal-ops-drawer-hub-fleet")).toBeVisible();
    await expect(page.getByTestId("universal-ops-drawer-child-fleet-triage")).toBeVisible();
    await expect(page.getByTestId("universal-ops-drawer-child-vessel-intelligence")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("fleet-vessel-section-overlay")).toBeVisible();
    await expect(page.getByTestId("fleet-registry-access")).toBeVisible();
    await expect(page.getByTestId("section-polygon-main_engine_room")).toBeVisible();
    await expect(page.getByTestId("bottom-nav")).toHaveCount(0);

    const diagramBox = await page.getByTestId("fleet-vessel-diagram-preview").boundingBox();
    const triageBox = await page.getByTestId("fleet-triage-list").boundingBox();
    expect(diagramBox).not.toBeNull();
    expect(triageBox).not.toBeNull();
    expect(diagramBox!.y).toBeLessThan(triageBox!.y);

    await page.screenshot({
      path: testInfo.outputPath("fleet-triage-mobile.png"),
      fullPage: false,
    });
  });

  test("desktop overview renders Figma-derived regions and uploaded schematic overlay", async ({
    page,
  }, testInfo) => {
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/vessel-1/overview", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("vessel-intelligence-hub")).toBeVisible();
    await expect(page.getByTestId("vessel-intelligence-data-sources")).toContainText("Registry");
    await expect(page.getByTestId("diagram-registry-panel")).toContainText(
      "Side Elevation - Full Hub v2"
    );
    await expect(page.getByTestId("equipment-mapping-panel")).toContainText("Main Engine 1");
    await expect(page.getByTestId("uploaded-schematic-base-layer")).toBeVisible();
    await expect(page.getByTestId("section-polygon-main_engine_room")).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-desktop-overview.png"),
      fullPage: false,
    });
  });

  test("mobile section map is view-first and preserves the section detail flow", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/vessel-1/sections/main_engine_room", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("vessel-intelligence-section-map")).toBeVisible();
    await page.getByTestId("selected-section-detail").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("selected-section-detail")).toContainText("Main Engine Room");
    await expect(page.getByTestId("selected-section-detail")).toContainText(
      "multiple equipment records"
    );
    await expect(page.getByTestId("section-equipment-list")).toBeVisible();
    await expect(page.getByTestId("section-equipment-live").first()).toBeVisible();
    await expect(page.getByTestId("button-manage-section-assignments")).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-mobile-section-map.png"),
      fullPage: false,
    });
  });

  test("section map editor saves side elevation calibration through the registry API", async ({
    page,
  }) => {
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/vessel-1/section-maps/map-full-hub-v2/edit", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByTestId("side-elevation-fit-controls")).toBeVisible();
    await expect(page.getByTestId("button-save-side-elevation-fit")).toBeDisabled();

    const lengthThumb = page.getByTestId("side-elevation-length-slider").locator('[role="slider"]');
    await lengthThumb.focus();
    await lengthThumb.press("ArrowRight");

    const panThumb = page.getByTestId("side-elevation-pan-x-slider").locator('[role="slider"]');
    await panThumb.focus();
    await panThumb.press("ArrowRight");

    await expect(page.getByTestId("button-save-side-elevation-fit")).toBeEnabled();
    const patchRequest = page.waitForRequest(
      (request) =>
        request.method() === "PATCH" &&
        request.url().includes("/api/vessel-intelligence/vessel-1/section-maps/map-full-hub-v2")
    );
    await page.getByTestId("button-save-side-elevation-fit").click();

    const body = JSON.parse((await patchRequest).postData() ?? "{}") as {
      imageTransform?: { scaleX?: number; scaleY?: number; offsetX?: number; offsetY?: number };
    };
    expect(body.imageTransform?.scaleX).toBeGreaterThan(1);
    expect(body.imageTransform?.scaleY).toBe(1);
    expect(body.imageTransform?.offsetX).toBeGreaterThan(0);
    expect(body.imageTransform?.offsetY).toBe(0);
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

  test("admin registry controls open real screens and complete start blank replacement", async ({
    page,
  }, testInfo) => {
    const uploadFile = testInfo.outputPath("replacement.svg");
    fs.writeFileSync(uploadFile, BASE_SVG);
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/vessel-1/diagrams", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("diagram-manager")).toBeVisible();
    await expect(page.getByTestId("diagram-type-card-side_elevation")).toContainText(
      "Side Elevation"
    );
    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-diagram-manager.png"),
      fullPage: false,
    });
    await page.getByTestId("button-upload-replace-diagram").first().click();
    await expect(page.getByTestId("dialog-upload-replace-diagram")).toBeVisible();
    await expect(page.getByTestId("replacement-option-keep-existing")).toBeVisible();
    await expect(page.getByTestId("replacement-option-start-blank")).toBeVisible();
    await expect(page.getByTestId("replacement-option-copy-vessel")).toBeVisible();
    await expect(page.getByTestId("replacement-option-copy-template")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-upload-replace-dialog.png"),
      fullPage: false,
    });
    await page.getByTestId("replacement-option-start-blank").click();
    await page.locator("#diagram-upload-file").setInputFiles(uploadFile);
    await page.getByTestId("button-submit-upload-replace").click();

    await expect(page).toHaveURL(/section-maps\/map-draft-blank\/edit/);
    await expect(page.getByText("No sections yet. Draw or add your first section.")).toBeVisible();
    await expect(page.getByTestId("button-validate-map")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-blank-map-editor.png"),
      fullPage: false,
    });
  });

  test("versions and thumbnails routes expose working registry actions", async ({
    page,
  }, testInfo) => {
    await installVesselFixtures(page);
    await page.goto("/vessel-intelligence/vessel-1/diagrams/diagram-side-elevation/versions", {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByText("Version History")).toBeVisible();
    await expect(page.getByText("side-elevation.svg")).toBeVisible();
    await expect(page.getByText("Archive")).toBeVisible();
    await expect(page.getByText("Restore as draft")).toBeVisible();

    await page.goto("/vessel-intelligence/vessel-1/thumbnails", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("thumbnail-manager")).toBeVisible();
    await expect(page.getByTestId("section-thumbnail-upload").first()).toBeVisible();
    await expect(page.getByTestId("equipment-thumbnail-upload").first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("vessel-intelligence-thumbnail-manager.png"),
      fullPage: false,
    });
  });

  test("viewer registry route disables mutation controls with clear reasons", async ({ page }) => {
    await installVesselFixtures(page, { viewer: true });
    await page.goto("/vessel-intelligence/vessel-1/diagrams", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("diagram-manager")).toBeVisible();
    await expect(
      page.getByText(
        "You can view this registry, but you do not have permission to configure diagrams."
      )
    ).toBeVisible();
    await expect(page.getByTestId("button-upload-replace-diagram").first()).toBeDisabled();
  });
});
