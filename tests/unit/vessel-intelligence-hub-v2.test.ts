import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { routeMigrations } from "@/config/navigationConfig";
import { legacyRedirects } from "@/routes/legacy-redirects";

const TEST_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "..", "..");
const PAGE_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/index.tsx");
const REGISTRY_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/registry.ts");
const FLEET_ROUTES_PATH = resolve(REPO_ROOT, "client/src/routes/fleet.ts");
const NAV_PATH = resolve(REPO_ROOT, "client/src/config/navigationConfig.ts");
const DATA_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/data.ts");
const REGISTRY_API_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/registry-api.ts");
const REGISTRY_SCREENS_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/registry-screens.tsx");
const DOMAIN_REGISTRY_PATH = resolve(REPO_ROOT, "server/routes/domain-router-registry.ts");

const EXPECTED_ROUTES = [
  "/vessel-intelligence",
  "/vessel-intelligence/fleet",
  "/vessel-intelligence/:vesselId/overview",
  "/vessel-intelligence/:vesselId/sections",
  "/vessel-intelligence/:vesselId/sections/:sectionId",
  "/vessel-intelligence/:vesselId/equipment/:equipmentId",
  "/vessel-intelligence/:vesselId/performance",
  "/vessel-intelligence/:vesselId/health",
  "/vessel-intelligence/:vesselId/alerts",
  "/vessel-intelligence/:vesselId/maintenance",
  "/vessel-intelligence/:vesselId/maintenance/:workOrderId",
  "/vessel-intelligence/:vesselId/expert-cases",
  "/vessel-intelligence/:vesselId/reports",
  "/vessel-intelligence/:vesselId/settings",
  "/vessel-intelligence/:vesselId/diagrams",
  "/vessel-intelligence/:vesselId/diagrams/:diagramId",
  "/vessel-intelligence/:vesselId/diagrams/:diagramId/versions",
  "/vessel-intelligence/:vesselId/section-maps/:mapId/edit",
  "/vessel-intelligence/:vesselId/section-maps/:mapId/validate",
  "/vessel-intelligence/:vesselId/thumbnails",
];

const EXPECTED_LEGACY_REDIRECTS: Record<string, string> = {
  "/fleet": "/vessel-intelligence",
  "/fleet-map": "/vessel-intelligence/fleet",
  "/predictive-maintenance": "/vessel-intelligence?target=overview",
  "/pdm": "/vessel-intelligence?target=overview",
  "/pdm-analytics": "/vessel-intelligence?target=performance",
  "/ai-analytics": "/vessel-intelligence?target=performance",
  "/equipment-schematic": "/vessel-intelligence?target=sections",
  "/vessel-alerts": "/vessel-intelligence?target=alerts",
};

async function load(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("Vessel Intelligence Hub v2 route contract", () => {
  it("registers the full route family from the design package", async () => {
    const registry = await load(REGISTRY_PATH);
    const routes = await load(FLEET_ROUTES_PATH);

    for (const path of EXPECTED_ROUTES) {
      expect(registry).toContain(path);
    }
    expect(routes).toContain("VESSEL_INTELLIGENCE_ROUTES.map");
    expect(routes).toContain('"/fleet/:vesselId"');
    expect(routes).toContain('"/equipment-schematic/:vesselId"');
    expect(routes).toContain('"/reports/vessel/:vesselId"');
  });

  it("moves broad legacy technical routes into Vessel Intelligence", () => {
    const redirectMap = new Map(legacyRedirects.map((redirect) => [redirect.from, redirect.to]));

    for (const [from, to] of Object.entries(EXPECTED_LEGACY_REDIRECTS)) {
      expect(routeMigrations[from]).toBe(to);
      expect(redirectMap.get(from)).toBe(to);
    }
  });

  it("surfaces Vessel Intelligence as the Fleet hub without weakening existing resources", async () => {
    const nav = await load(NAV_PATH);
    expect(nav).toContain('hubRoute: "/vessel-intelligence"');
    expect(nav).toContain('name: "Vessel Intelligence"');
    expect(nav).toContain('"/vessel-intelligence/:vesselId/performance": "predictive_maintenance"');
    expect(nav).toContain('"/vessel-intelligence/:vesselId/maintenance": "work_orders"');
    expect(nav).toContain('"/vessel-intelligence/:vesselId/alerts": "alerts"');
  });
});

describe("Vessel Intelligence Hub v2 design registry", () => {
  it("uses normalized coordinates and allows many equipment items per physical section", async () => {
    const registry = await load(REGISTRY_PATH);
    expect(registry).toContain('coordinateMode: "normalized_percent"');
    expect(registry).toContain("polygonNormalized");
    expect(registry).toContain('"main_engine_room"');
    expect(registry).toContain('"Main Engine 1"');
    expect(registry).toContain('"Main Engine 2"');
    expect(registry).toContain('"Sea Water Pumps"');
  });

  it("keeps the replaceable diagram and thumbnail registry explicit", async () => {
    const registry = await load(REGISTRY_PATH);
    expect(registry).toContain('"side_elevation"');
    expect(registry).toContain('"machinery_arrangement"');
    expect(registry).toContain('"electrical_single_line"');
    expect(registry).toContain("REPLACEMENT_MAPPING_OPTIONS");
    expect(registry).toContain("THUMBNAIL_FALLBACK_RULES");
    expect(registry).toContain("Copy from vessel type template");
  });
});

describe("Vessel Intelligence Hub v2 live-data binding", () => {
  it("binds to existing ARUS APIs instead of hardcoded production numbers", async () => {
    const page = await load(PAGE_PATH);
    expect(page).toContain('"/api/vessels"');
    expect(page).toContain('"/api/equipment"');
    expect(page).toContain('"/api/work-orders"');
    expect(page).toContain('"/api/alerts"');
    expect(page).toContain('"/api/pdm/dashboard"');
    expect(page).toContain('"/api/vessel-intelligence"');
    expect(page).toContain("activeSectionMap");
    expect(page).toContain('data-testid="vessel-intelligence-data-error"');
    expect(page).not.toMatch(/mockVessel|mockEquipment|fakeTelemetry|setInterval/);
  });

  it("keeps empty live-data responses renderable", async () => {
    const data = await load(DATA_PATH);
    const page = await load(PAGE_PATH);

    expect(data).toContain("vessel: VesselRecord | undefined");
    expect(data).toContain("return vessel?.id ??");
    expect(page).toContain("vessels[0]");
    expect(page).toContain("vesselIdFor(selectedVessel)");
  });
});

describe("Vessel Intelligence Hub v2 backend registry", () => {
  it("mounts the dedicated diagram registry domain", async () => {
    const registry = await load(DOMAIN_REGISTRY_PATH);

    expect(registry).toContain('name: "VesselDiagramRegistry"');
    expect(registry).toContain("../domains/vessel-diagram-registry/index.js");
    expect(registry).toContain("registerVesselDiagramRegistryRoutes");
  });
});

describe("Replaceable Diagram Registry controls", () => {
  it("provides API hooks for every visible registry mutation surface", async () => {
    const api = await load(REGISTRY_API_PATH);

    for (const hook of [
      "useVesselDiagrams",
      "useDiagramDetail",
      "useDiagramVersions",
      "useUploadDiagramVersion",
      "usePublishDiagramVersion",
      "useArchiveDiagramVersion",
      "useRestoreDiagramVersion",
      "useSectionMaps",
      "useSectionMap",
      "useCreateSectionMap",
      "useCloneSectionMap",
      "useValidateSectionMap",
      "usePublishSectionMap",
      "useSectionAssignments",
      "useAssignEquipmentToSection",
      "useUploadSectionThumbnail",
      "useUploadEquipmentThumbnail",
      "useSectionMapTemplates",
    ]) {
      expect(api).toContain(`function ${hook}`);
    }

    expect(api).toContain("/versions/upload");
    expect(api).toContain("/publish");
    expect(api).toContain("/archive");
    expect(api).toContain("/restore-draft");
    expect(api).toContain("/section-map-templates");
    expect(api).toContain("/thumbnail");
  });

  it("pins replacement options, critical test ids, and permission-denied UI", async () => {
    const screens = await load(REGISTRY_SCREENS_PATH);

    for (const testId of [
      "diagram-manager",
      "diagram-type-card-",
      "button-upload-replace-diagram",
      "dialog-upload-replace-diagram",
      "replacement-option-keep-existing",
      "replacement-option-start-blank",
      "replacement-option-copy-vessel",
      "replacement-option-copy-template",
      "button-submit-upload-replace",
      "button-view-versions",
      "button-manage-thumbnails",
      "button-validate-map",
      "button-publish-map",
      "thumbnail-manager",
      "section-thumbnail-upload",
      "equipment-thumbnail-upload",
    ]) {
      expect(screens).toContain(testId);
    }

    expect(screens).toContain("Keep existing section map as draft overlay");
    expect(screens).toContain("Start blank section map");
    expect(screens).toContain("Copy section map from another vessel");
    expect(screens).toContain("Copy section map from vessel type template");
    expect(screens).toContain("PermissionDeniedInline");
    expect(screens).toContain("Requires vessel-intelligence:upload-diagram");
    expect(screens).toContain("Requires vessel-intelligence:publish-map");
    expect(screens).toContain("No sections yet. Draw or add your first section.");
    expect(screens).toContain("No equipment assigned to this section.");
  });

  it("routes legacy target query links to the intended hub tab", async () => {
    const page = await load(PAGE_PATH);

    expect(page).toContain('new URLSearchParams(path.split("?")[1] ?? "")');
    expect(page).toContain('target === "sections"');
    expect(page).toContain('target === "performance"');
    expect(page).toContain('target === "alerts"');
    expect(page).toContain("RegistryRouteScreen");
  });
});
