import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { routeMigrations } from "@/config/navigationConfig";
import { legacyRedirects } from "@/routes/legacy-redirects";

const TEST_DIR = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "..", "..");
const PAGE_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/index.tsx");
const FLEET_PAGE_PATH = resolve(REPO_ROOT, "client/src/pages/fleet-hub.tsx");
const UNIVERSAL_SHELL_PATH = resolve(REPO_ROOT, "client/src/components/ops/UniversalOpsShell.tsx");
const UNIVERSAL_NAV_PATH = resolve(
  REPO_ROOT,
  "client/src/application/navigation/universal-ops-navigation.ts"
);
const REGISTRY_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/registry.ts");
const FLEET_ROUTES_PATH = resolve(REPO_ROOT, "client/src/routes/fleet.ts");
const NAV_PATH = resolve(REPO_ROOT, "client/src/config/navigationConfig.ts");
const NAV_RESOURCES_PATH = resolve(REPO_ROOT, "client/src/config/navigationResources.ts");
const DATA_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/data.ts");
const MOBILE_READINESS_SCREEN_PATH = resolve(
  REPO_ROOT,
  "client/src/features/mobile-readiness/MobileReadinessScreens.tsx"
);
const MOBILE_READINESS_SCREEN_PATHS = [
  MOBILE_READINESS_SCREEN_PATH,
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/MobileReadinessShared.tsx"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/MobileReadinessFleetScreens.tsx"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/MobileReadinessPdmScreens.tsx"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/MobileReadinessWorkLogsScreens.tsx"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/MobileReadinessAdminScreens.tsx"),
];
const MOBILE_READINESS_MODEL_PATH = resolve(
  REPO_ROOT,
  "client/src/features/mobile-readiness/mobile-readiness-model.ts"
);
const MOBILE_READINESS_MODEL_PATHS = [
  MOBILE_READINESS_MODEL_PATH,
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/mobile-readiness-model-types.ts"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/mobile-readiness-navigation.ts"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/mobile-readiness-queue-fleet.ts"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/mobile-readiness-machinery-work.ts"),
  resolve(REPO_ROOT, "client/src/features/mobile-readiness/mobile-readiness-support-screens.ts"),
];
const REGISTRY_API_PATH = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/registry-api.ts"
);
const REGISTRY_API_DIAGRAMS_PATH = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/registry-api-diagrams.ts"
);
const REGISTRY_API_HELPERS_PATH = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/registry-api-helpers.ts"
);
const REGISTRY_SCREENS_PATH = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/registry-screens.tsx"
);
const REGISTRY_SCREENS_DIR = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/registry-screens"
);
const SECTIONED_MAP_PATH = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/SectionedVesselMap.tsx"
);
const SIDE_ELEVATION_FIT_CONTROLS_PATH = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/SideElevationFitControls.tsx"
);
const SIDE_ELEVATION_CALIBRATION_PATH = resolve(
  REPO_ROOT,
  "client/src/pages/vessel-intelligence/side-elevation-calibration.ts"
);
const DOMAIN_REGISTRY_PATH = resolve(REPO_ROOT, "server/routes/domain-router-registry.ts");
const DOMAIN_REGISTRY_CONFIG_PATHS = [
  DOMAIN_REGISTRY_PATH,
  resolve(REPO_ROOT, "server/routes/domain-router-config-core.ts"),
  resolve(REPO_ROOT, "server/routes/domain-router-config-domain-routes.ts"),
  resolve(REPO_ROOT, "server/routes/domain-router-config-mounted-routes.ts"),
];

const EXPECTED_ROUTES = [
  "/vessel-intelligence",
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
  "/vessel-intelligence/fleet": "/fleet",
  "/fleet-map": "/fleet",
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

async function loadDomainRouterRegistry(): Promise<string> {
  const sources = await Promise.all(DOMAIN_REGISTRY_CONFIG_PATHS.map(load));
  return sources.join("\n");
}

async function loadMobileReadinessModel(): Promise<string> {
  const sources = await Promise.all(MOBILE_READINESS_MODEL_PATHS.map(load));
  return sources.join("\n");
}

async function loadMobileReadinessScreens(): Promise<string> {
  const sources = await Promise.all(MOBILE_READINESS_SCREEN_PATHS.map(load));
  return sources.join("\n");
}

/** The registry screens are split across the dispatcher module and one file
 * per screen in registry-screens/; pin test ids against the whole family. */
async function loadRegistryScreens(): Promise<string> {
  const names = (await readdir(REGISTRY_SCREENS_DIR)).filter((name) => name.endsWith(".tsx"));
  const parts = await Promise.all(
    names.sort().map((name) => load(resolve(REGISTRY_SCREENS_DIR, name)))
  );
  return [await load(REGISTRY_SCREENS_PATH), ...parts].join("\n");
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

  it("surfaces Fleet Triage as the Fleet hub without weakening existing resources", async () => {
    const nav = await load(NAV_PATH);
    const resources = await load(NAV_RESOURCES_PATH);
    expect(nav).toContain('hubRoute: "/fleet"');
    expect(nav.indexOf('name: "Fleet Triage"')).toBeLessThan(
      nav.indexOf('name: "Vessel Intelligence"')
    );
    expect(nav).toContain('href: "/fleet"');
    expect(nav).toContain('name: "Vessel Intelligence"');
    expect(nav).toContain("vessel-specific workflows");
    expect(resources).toContain(
      '"/vessel-intelligence/:vesselId/performance": "predictive_maintenance"'
    );
    expect(resources).toContain('"/vessel-intelligence/:vesselId/maintenance": "work_orders"');
    expect(resources).toContain('"/vessel-intelligence/:vesselId/alerts": "alerts"');
  });

  it("keeps /fleet as a real route instead of a legacy redirect", async () => {
    const redirectMap = new Map(legacyRedirects.map((redirect) => [redirect.from, redirect.to]));
    const fleetPage = await load(FLEET_PAGE_PATH);
    const mobileScreens = await loadMobileReadinessScreens();
    const mobileModel = await loadMobileReadinessModel();

    expect(routeMigrations["/fleet"]).toBeUndefined();
    expect(redirectMap.has("/fleet")).toBe(false);
    expect(fleetPage).toContain("MobileFleetPage");
    expect(mobileScreens).toContain("export function MobileFleetPage");
    expect(mobileScreens).toContain("fleet-vessel-card-");
    expect(mobileScreens).toContain("VesselThumbnail");
    expect(mobileScreens).toContain("Fleet triage");
    expect(mobileModel).toContain("MV Atlas");
    expect(mobileModel).toContain("nextAction");
  });

  it("renders an explicit empty section state for blank maps", async () => {
    const sectionedMap = await load(SECTIONED_MAP_PATH);

    expect(sectionedMap).toContain("No sections yet. Draw or add your first section.");
    expect(sectionedMap).toContain('data-testid="section-map-empty-sections"');
  });

  it("keeps the universal shell available while mobile replacement routes bypass it", async () => {
    const shell = await load(UNIVERSAL_SHELL_PATH);
    const universalNav = await load(UNIVERSAL_NAV_PATH);
    const app = await load(resolve(REPO_ROOT, "client/src/App.tsx"));

    expect(shell).toContain("buildUniversalOpsNavModel");
    expect(shell).toContain('testId="universal-ops-rail"');
    expect(shell).toContain('data-testid="universal-ops-mobile-drawer"');
    expect(universalNav).toContain('["/vessel-intelligence/", "fleet"]');
    expect(app).toContain("resolveCurrentRouteHubId");
    expect(app).toContain("isMobileReadinessReplacementPath");
    expect(app).toContain("!usesMobileReadinessReplacement && resolveCurrentRouteHubId");
    expect(app).toContain("usesUniversalOpsShell");
    expect(app).toContain("!usesUniversalOpsShell && <BottomNav />");
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

describe("Vessel Intelligence Hub v2 mobile readiness binding", () => {
  it("delegates vessel detail to the shared mobile readiness replacement", async () => {
    const page = await load(PAGE_PATH);
    const mobileScreens = await loadMobileReadinessScreens();
    const mobileModel = await loadMobileReadinessModel();

    expect(page).toContain("MobileVesselDetailPage");
    expect(mobileScreens).toContain("export function MobileVesselDetailPage");
    expect(mobileScreens).toContain("VesselDiagramPanel");
    expect(mobileScreens).toContain("VesselMetricTile");
    expect(mobileScreens).toContain("VesselActionTile");
    expect(mobileScreens).toContain("DiagramModeButton");
    expect(mobileScreens).toContain("Active alarms");
    expect(mobileScreens).toContain("Crew blocker");
    expect(mobileScreens).toContain("Zones");
    expect(mobileModel).toContain("vesselDetail");
    expect(mobileModel).toContain("Telemetry");
    expect(page).not.toMatch(/mockVessel|mockEquipment|fakeTelemetry|setInterval/);
  });

  it("keeps the legacy data helpers available for deeper registry and diagnostics screens", async () => {
    const data = await load(DATA_PATH);

    expect(data).toContain("vessel: VesselRecord | undefined");
    expect(data).toContain("return vessel?.id ??");
  });
});

describe("Vessel Intelligence Hub v2 backend registry", () => {
  it("mounts the dedicated diagram registry domain", async () => {
    const registry = await loadDomainRouterRegistry();

    expect(registry).toContain('name: "VesselDiagramRegistry"');
    expect(registry).toContain("../domains/vessel-diagram-registry/index.js");
    expect(registry).toContain("registerVesselDiagramRegistryRoutes");
  });
});

describe("Replaceable Diagram Registry controls", () => {
  it("provides API hooks for every visible registry mutation surface", async () => {
    const api = await load(REGISTRY_API_PATH);
    const diagramApi = await load(REGISTRY_API_DIAGRAMS_PATH);
    const helperApi = await load(REGISTRY_API_HELPERS_PATH);
    const apiSurface = `${api}\n${diagramApi}\n${helperApi}`;

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
      "useUpdateSectionMapCalibration",
      "useValidateSectionMap",
      "usePublishSectionMap",
      "useSectionAssignments",
      "useAssignEquipmentToSection",
      "useUploadSectionThumbnail",
      "useUploadEquipmentThumbnail",
      "useSectionMapTemplates",
    ]) {
      expect(apiSurface).toContain(`function ${hook}`);
    }

    expect(api).toContain("from \"./registry-api-diagrams\"");
    expect(api).toContain("from \"./registry-api-helpers\"");
    expect(apiSurface).toContain("/versions/upload");
    expect(apiSurface).toContain("/publish");
    expect(apiSurface).toContain("/archive");
    expect(apiSurface).toContain("/restore-draft");
    expect(apiSurface).toContain("/section-map-templates");
    expect(apiSurface).toContain("/thumbnail");
  });

  it("pins replacement options, critical test ids, and permission-denied UI", async () => {
    const screens = await loadRegistryScreens();
    const sectionMap = await load(SECTIONED_MAP_PATH);
    const fitControls = await load(SIDE_ELEVATION_FIT_CONTROLS_PATH);
    const calibration = await load(SIDE_ELEVATION_CALIBRATION_PATH);

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

    for (const testId of [
      "section-equipment-list",
      "section-equipment-empty",
      "section-equipment-live",
      "section-equipment-registry-only",
      "button-manage-section-assignments",
    ]) {
      expect(sectionMap).toContain(testId);
    }

    for (const testId of [
      "side-elevation-fit-controls",
      "button-side-elevation-fit-contract",
      "button-side-elevation-fit-reset",
      "button-side-elevation-fit-expand",
      "side-elevation-scale-slider",
      "side-elevation-scale-value",
      "side-elevation-length-slider",
      "side-elevation-length-value",
      "side-elevation-height-slider",
      "side-elevation-height-value",
      "side-elevation-pan-x-slider",
      "side-elevation-pan-y-slider",
      "button-save-side-elevation-fit",
    ]) {
      expect(fitControls).toContain(testId);
    }

    expect(sectionMap).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(calibration).toContain("DEFAULT_IMAGE_TRANSFORM");
    expect(calibration).toContain("scaleX: 1");
    expect(calibration).toContain("scaleY: 1");
    expect(sectionMap).toContain("baseImageOffsetX");
    expect(sectionMap).toContain("baseImageOffsetY");
    expect(calibration).toContain("clampImageScale");
    expect(calibration).toContain("imageFrameForScale");
    expect(fitControls).toContain("useUpdateSectionMapCalibration");
    expect(fitControls).toContain("Length");
    expect(fitControls).toContain("Height");
    expect(fitControls).toContain("Position");
    expect(fitControls).toContain("Best fit");

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
    const routes = await load(FLEET_ROUTES_PATH);
    const mobileScreens = await loadMobileReadinessScreens();

    expect(routes).toContain('"/fleet/:vesselId"');
    expect(routes).toContain('"/equipment-schematic/:vesselId"');
    expect(routes).toContain('"/reports/vessel/:vesselId"');
    expect(mobileScreens).toContain("isMobileReadinessReplacementPath");
    expect(mobileScreens).toContain("/vessel-intelligence/");
  });
});
