import { readFile } from "node:fs/promises";
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
const DATA_PATH = resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/data.ts");
const MOBILE_READINESS_SCREEN_PATH = resolve(
  REPO_ROOT,
  "client/src/features/mobile-readiness/MobileReadinessScreens.tsx"
);
const MOBILE_READINESS_MODEL_PATH = resolve(
  REPO_ROOT,
  "client/src/features/mobile-readiness/mobile-readiness-model.ts"
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
    expect(nav).toContain('hubRoute: "/fleet"');
    expect(nav.indexOf('name: "Fleet Triage"')).toBeLessThan(
      nav.indexOf('name: "Vessel Intelligence"')
    );
    expect(nav).toContain('href: "/fleet"');
    expect(nav).toContain('name: "Vessel Intelligence"');
    expect(nav).toContain("vessel-specific workflows");
    expect(nav).toContain('"/vessel-intelligence/:vesselId/performance": "predictive_maintenance"');
    expect(nav).toContain('"/vessel-intelligence/:vesselId/maintenance": "work_orders"');
    expect(nav).toContain('"/vessel-intelligence/:vesselId/alerts": "alerts"');
  });

  it("keeps /fleet as a real route instead of a legacy redirect", async () => {
    const redirectMap = new Map(legacyRedirects.map((redirect) => [redirect.from, redirect.to]));
    const fleetPage = await load(FLEET_PAGE_PATH);
    const mobileScreens = await load(MOBILE_READINESS_SCREEN_PATH);
    const mobileModel = await load(MOBILE_READINESS_MODEL_PATH);

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

  it("routes vessel detail through the mobile diagram replacement", async () => {
    const page = await load(PAGE_PATH);
    const mobileScreens = await load(MOBILE_READINESS_SCREEN_PATH);
    const mobileModel = await load(MOBILE_READINESS_MODEL_PATH);

    expect(page).toContain("MobileVesselDetailPage");
    expect(mobileScreens).toContain("VesselDiagramPanel");
    expect(mobileScreens).toContain("detail.diagramModes.map");
    expect(mobileScreens).toContain("detail.selectedZone.actions.map");
    expect(mobileScreens).toContain("data-asset-status={diagram.status}");
    expect(mobileModel).toContain("diagramModes");
    expect(mobileModel).toContain("selectedZone");
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
    const mobileScreens = await load(MOBILE_READINESS_SCREEN_PATH);
    const mobileModel = await load(MOBILE_READINESS_MODEL_PATH);

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

describe("Vessel diagram mobile replacement controls", () => {
  it("pins diagram modes, selected-zone context, and diagram asset rendering", async () => {
    const screens = await load(MOBILE_READINESS_SCREEN_PATH);
    const model = await load(MOBILE_READINESS_MODEL_PATH);

    expect(screens).toContain("VesselDiagramPanel");
    expect(screens).toContain("detail.diagramModes.map");
    expect(screens).toContain("detail.selectedZone.actions.map");
    expect(screens).toContain('title="Vessel diagram"');
    expect(screens).toContain("data-asset-status={diagram.status}");
    expect(model).toContain("Side elevation");
    expect(model).toContain("Machinery arrangement");
    expect(model).toContain("Electrical single-line");
    expect(model).toContain("selectedZone");
    expect(model).toContain("Engine room");
  });

  it("routes legacy target query links to the intended hub tab", async () => {
    const routes = await load(FLEET_ROUTES_PATH);
    const mobileScreens = await load(MOBILE_READINESS_SCREEN_PATH);

    expect(routes).toContain('"/fleet/:vesselId"');
    expect(routes).toContain('"/equipment-schematic/:vesselId"');
    expect(routes).toContain('"/reports/vessel/:vesselId"');
    expect(mobileScreens).toContain("isMobileReadinessReplacementPath");
    expect(mobileScreens).toContain("/vessel-intelligence/");
  });
});
