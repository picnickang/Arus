import {
  expect,
  test,
  type ConsoleMessage,
  type Page,
  type Route,
} from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { ROLE_STORAGE_KEY } from "../../client/src/config/roles";
import { listMobileReadinessAssets } from "../../client/src/features/mobile-readiness/mobile-readiness-assets";
import {
  getMobileReadinessExpectedScreen,
  isMobileReadinessReplacementPath,
} from "../../client/src/features/mobile-readiness/mobile-readiness-route-contract";
import {
  MOBILE_READINESS_VISUAL_COMPARISON_ROOT,
  MOBILE_READINESS_VISUAL_VIEWPORT,
  MOBILE_READINESS_VISUAL_VIEWPORTS,
  mobileReadinessVisualFidelityCases,
} from "./mobile-readiness-visual-fidelity-contract";

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
const BASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 895 420"><rect width="895" height="420" fill="#031225"/><path d="M42 270 L130 205 L595 198 L670 95 L756 95 L805 205 L870 226 L835 355 L72 355 Z" fill="#123e60" stroke="#70b8e8" stroke-width="3"/></svg>`;

async function installVisualFixtures(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_READINESS_VISUAL_VIEWPORT);
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
    const endpoint = url.pathname;

    if (endpoint.endsWith("/media")) {
      await route.fulfill({ status: 200, contentType: "image/svg+xml", body: BASE_SVG });
      return;
    }

    if (endpoint === "/api/portal/login" && request.method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionToken: "playwright-visual-session-token",
          expiresIn: 3600,
          mustChangePassword: false,
          user: { id: "visual-admin", name: "Visual Admin", role: "super_admin" },
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
      work_orders: { view: true, create: true, edit: true, delete: true, export: true },
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
        userId: "visual-admin",
        orgId: "org-playwright",
        roles: [{ id: "role-admin", name: "super_admin", displayName: "Super Admin" }],
        permissions,
        hubAdmin: true,
        hubAccess: null,
        isDevMode: false,
      },
      "/api/alerts": [],
      "/api/crew": [crewMember],
      "/api/crew/former": [],
      "/api/crew-roles": [
        { id: "role-captain", name: "captain", displayName: "Captain", sortOrder: 1 },
      ],
      "/api/crew-certifications/expiring": {
        certifications: [],
        summary: { total: 0, critical: 0, warning: 0, notice: 0 },
      },
      "/api/crew-documents/expiring": {
        documents: [],
        summary: { total: 0, critical: 0, warning: 0, notice: 0 },
      },
      "/api/equipment": [],
      "/api/equipment/health": [],
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
      "/api/safety-bulletins": [],
      "/api/service-requests": [],
      "/api/suppliers": [],
      "/api/vessels": [vessel],
      "/api/work-orders": [],
      "/api/work-orders/summary": {
        openCount: 0,
        overdueCount: 0,
        completionRate: 100,
      },
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

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(Object.hasOwn(responses, endpoint) ? responses[endpoint] : []),
    });
  });
}

async function loginAsVisualAdmin(page: Page): Promise<void> {
  await installVisualFixtures(page);
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.getByTestId("input-admin-username").fill("visual-admin");
  await page.getByTestId("input-admin-password").fill("playwright-password");
  await page.getByTestId("button-admin-login").click();
  await expectMobileReadinessShell(page, "/");
}

async function navigateWithinAuthenticatedSpa(page: Page, route: string): Promise<void> {
  await page.evaluate((target) => {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

async function expectMobileReadinessShell(page: Page, route: string): Promise<void> {
  const marker = getMobileReadinessExpectedScreen(route);
  expect(isMobileReadinessReplacementPath(route)).toBe(true);
  expect(marker).not.toBeNull();
  await expect(page.getByTestId("mobile-readiness-shell")).toBeVisible();
  await expect(page.getByTestId(`mobile-readiness-screen-${marker}`)).toBeVisible();
  await expect(page.getByTestId("universal-ops-shell")).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0
    );
    return documentWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function imageMetadata(filePath: string): Promise<{
  width: number | null;
  height: number | null;
  bytes: number;
}> {
  const [metadata, stat] = await Promise.all([sharp(filePath).metadata(), fs.stat(filePath)]);
  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    bytes: stat.size,
  };
}

async function resizeForPanel(
  filePath: string,
  width: number,
  height: number
): Promise<{ data: Buffer; width: number; height: number }> {
  const result = await sharp(filePath)
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

async function createComparisonSheet({
  currentPath,
  referenceArtifact,
  outputPath,
  title,
  viewportLabel,
}: {
  currentPath: string;
  referenceArtifact: string;
  outputPath: string;
  title: string;
  viewportLabel: string;
}): Promise<void> {
  const referencePath = path.resolve(process.cwd(), referenceArtifact);
  const panelWidth = 560;
  const panelHeight = 650;
  const canvasWidth = panelWidth * 2 + 96;
  const canvasHeight = panelHeight + 116;
  const panelTop = 82;
  const referenceLeft = 32;
  const currentLeft = referenceLeft + panelWidth + 32;

  const [reference, current] = await Promise.all([
    resizeForPanel(referencePath, panelWidth - 32, panelHeight - 48),
    resizeForPanel(currentPath, panelWidth - 32, panelHeight - 48),
  ]);

  const frame = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">
      <rect width="100%" height="100%" fill="#0f172a"/>
      <text x="32" y="34" font-family="Arial" font-size="20" font-weight="700" fill="#f8fafc">${escapeXml(title)}</text>
      <text x="32" y="58" font-family="Arial" font-size="13" fill="#cbd5e1">${escapeXml(viewportLabel)}</text>
      <rect x="${referenceLeft}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" rx="10" fill="#f8fafc"/>
      <rect x="${currentLeft}" y="${panelTop}" width="${panelWidth}" height="${panelHeight}" rx="10" fill="#f8fafc"/>
      <text x="${referenceLeft + 18}" y="${panelTop + 28}" font-family="Arial" font-size="14" font-weight="700" fill="#334155">Reference board</text>
      <text x="${currentLeft + 18}" y="${panelTop + 28}" font-family="Arial" font-size="14" font-weight="700" fill="#334155">Current UI</text>
    </svg>
  `);

  await sharp(frame)
    .composite([
      {
        input: reference.data,
        left: Math.round(referenceLeft + (panelWidth - reference.width) / 2),
        top: Math.round(panelTop + 44 + (panelHeight - 52 - reference.height) / 2),
      },
      {
        input: current.data,
        left: Math.round(currentLeft + (panelWidth - current.width) / 2),
        top: Math.round(panelTop + 44 + (panelHeight - 52 - current.height) / 2),
      },
    ])
    .png()
    .toFile(outputPath);
}

async function createAssetContactSheet(outputPath: string): Promise<{
  assetCount: number;
  outputPath: string;
}> {
  const assets = listMobileReadinessAssets();
  const tileWidth = 220;
  const tileHeight = 176;
  const columns = 3;
  const rows = Math.ceil(assets.length / columns);
  const canvasWidth = columns * tileWidth;
  const canvasHeight = rows * tileHeight;
  const composites = [];

  for (const [index, asset] of assets.entries()) {
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    const svgSource = decodeURIComponent(asset.src.replace(/^data:image\/svg\+xml;utf8,/, ""));
    const preview = await sharp(Buffer.from(svgSource))
      .resize({ width: 184, height: 112, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    const label = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}">
        <rect width="${tileWidth}" height="${tileHeight}" fill="#f8fafc"/>
        <rect x="8" y="8" width="${tileWidth - 16}" height="${tileHeight - 16}" rx="10" fill="#ffffff" stroke="#cbd5e1"/>
        <text x="16" y="136" font-family="Arial" font-size="13" font-weight="700" fill="#0f172a">${escapeXml(asset.id)}</text>
        <text x="16" y="154" font-family="Arial" font-size="11" fill="#475569">${escapeXml(`${asset.kind} / ${asset.status}`)}</text>
      </svg>
    `);
    composites.push({ input: label, left, top });
    composites.push({
      input: preview.data,
      left: left + Math.round((tileWidth - preview.info.width) / 2),
      top: top + 18 + Math.round((104 - preview.info.height) / 2),
    });
  }

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: "#f8fafc",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  return { assetCount: assets.length, outputPath };
}

async function writeVisualSummary({
  outputDir,
  runId,
  cases,
  assetContactSheet,
}: {
  outputDir: string;
  runId: string;
  cases: Array<{
    id: string;
    boardGroup: string;
    viewport: { width: number; height: number };
    screenshotPath: string;
    referenceArtifact: string;
    comparisonSheetPath: string;
    status: string;
  }>;
  assetContactSheet: { assetCount: number; outputPath: string };
}): Promise<void> {
  const rows = cases
    .map(
      (visualCase) =>
        `| ${visualCase.boardGroup} | ${visualCase.id} | ${visualCase.viewport.width}x${visualCase.viewport.height} | ${visualCase.status} | \`${visualCase.comparisonSheetPath}\` |`
    )
    .join("\n");
  const summary = `# Mobile Readiness Visual Fidelity Capture

Run: \`${runId}\`

Raw artifacts are intentionally outside git under:

\`${outputDir}\`

Asset contact sheet: \`${assetContactSheet.outputPath}\` (${assetContactSheet.assetCount} assets)

| Board group | Case | Viewport | Status | Comparison sheet |
|---|---|---:|---|---|
${rows}
`;
  await fs.writeFile(path.join(outputDir, "visual-fidelity-summary.md"), summary);
}

test.describe("mobile readiness visual fidelity gate @visual @mobile", () => {
  test("captures comparison screenshots for each Figma/reference-board group", async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const runId =
      process.env["ARUS_VISUAL_RUN_ID"] ??
      `local-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const outputDir = path.join(MOBILE_READINESS_VISUAL_COMPARISON_ROOT, runId);

    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(`${error.name}: ${error.message}`));

    await fs.mkdir(outputDir, { recursive: true });
    await loginAsVisualAdmin(page);

    const cases = [];
    for (const visualCase of mobileReadinessVisualFidelityCases) {
      for (const viewport of MOBILE_READINESS_VISUAL_VIEWPORTS) {
        await page.setViewportSize(viewport);
        await navigateWithinAuthenticatedSpa(page, visualCase.route);
        await expectMobileReadinessShell(page, visualCase.route);
        await expectNoHorizontalOverflow(page);

        const viewportLabel = `${viewport.width}x${viewport.height}`;
        const screenshotPath = path.join(outputDir, `${visualCase.id}-${viewportLabel}.png`);
        const comparisonSheetPath = path.join(
          outputDir,
          `${visualCase.id}-${viewportLabel}-comparison.png`
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });
        await createComparisonSheet({
          currentPath: screenshotPath,
          referenceArtifact: visualCase.referenceArtifact,
          outputPath: comparisonSheetPath,
          title: `${visualCase.boardGroup} / ${visualCase.id}`,
          viewportLabel,
        });
        const [screenshot, reference, comparisonSheet] = await Promise.all([
          imageMetadata(screenshotPath),
          imageMetadata(path.resolve(process.cwd(), visualCase.referenceArtifact)),
          imageMetadata(comparisonSheetPath),
        ]);

        cases.push({
          ...visualCase,
          viewport,
          routeUrl: page.url(),
          screenshotPath,
          comparisonSheetPath,
          screenshot,
          reference,
          comparisonSheet,
          status: "pending-manual-visual-review",
        });

        await testInfo.attach(`${visualCase.id}-${viewportLabel}-visual-comparison-record`, {
          contentType: "application/json",
          body: Buffer.from(
            JSON.stringify(
              {
                route: visualCase.route,
                viewport,
                referenceArtifact: visualCase.referenceArtifact,
                screenshotPath,
                comparisonSheetPath,
              },
              null,
              2
            )
          ),
        });
      }
    }

    const assetContactSheet = await createAssetContactSheet(
      path.join(outputDir, "mobile-readiness-asset-contact-sheet.png")
    );
    await writeVisualSummary({ outputDir, runId, cases, assetContactSheet });

    const reportPath = path.join(outputDir, "visual-fidelity-report.json");
    const report = {
      runId,
      outputDir,
      viewports: MOBILE_READINESS_VISUAL_VIEWPORTS,
      generatedAt: new Date().toISOString(),
      figmaFile:
        "https://www.figma.com/file/mgkd3KfOw9spGHsxuQEIzi?node-id=0:1&locale=en&type=design",
      caseCount: mobileReadinessVisualFidelityCases.length,
      captureCount: cases.length,
      assetContactSheet,
      cases,
      consoleErrors,
      pageErrors,
    };
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    expect(outputDir.startsWith(MOBILE_READINESS_VISUAL_COMPARISON_ROOT)).toBe(true);
    expect(cases).toHaveLength(
      mobileReadinessVisualFidelityCases.length * MOBILE_READINESS_VISUAL_VIEWPORTS.length
    );
    expect(cases.every((visualCase) => visualCase.screenshot.bytes > 0)).toBe(true);
    expect(cases.every((visualCase) => visualCase.comparisonSheet.bytes > 0)).toBe(true);
    expect(assetContactSheet.assetCount).toBe(listMobileReadinessAssets().length);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
