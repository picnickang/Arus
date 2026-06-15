/**
 * UI Align Phase 3B — Figma mobile readiness replacement.
 *
 * The legacy dark admin hub/user-portal split has been removed from the
 * impacted mobile routes. This contract pins the new command-center entry,
 * role-specific bottom nav, and shared mobile-readiness source of truth.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function readSrc(path: string): Promise<string> {
  return readFile(resolve(process.cwd(), path), "utf8");
}

const MOBILE_MODEL_PATHS = [
  "client/src/features/mobile-readiness/mobile-readiness-model.ts",
  "client/src/features/mobile-readiness/mobile-readiness-model-types.ts",
  "client/src/features/mobile-readiness/mobile-readiness-navigation.ts",
  "client/src/features/mobile-readiness/mobile-readiness-queue-fleet.ts",
  "client/src/features/mobile-readiness/mobile-readiness-machinery-work.ts",
  "client/src/features/mobile-readiness/mobile-readiness-support-screens.ts",
];
const MOBILE_SCREEN_PATHS = [
  "client/src/features/mobile-readiness/MobileReadinessScreens.tsx",
  "client/src/features/mobile-readiness/MobileReadinessShared.tsx",
  "client/src/features/mobile-readiness/MobileReadinessFleetScreens.tsx",
  "client/src/features/mobile-readiness/MobileReadinessPdmScreens.tsx",
  "client/src/features/mobile-readiness/MobileReadinessWorkLogsScreens.tsx",
  "client/src/features/mobile-readiness/MobileReadinessAdminScreens.tsx",
];
const MOBILE_ROUTE_CONTRACT_PATH =
  "client/src/features/mobile-readiness/mobile-readiness-route-contract.ts";

async function readMobileModelSrc(): Promise<string> {
  return (await Promise.all(MOBILE_MODEL_PATHS.map(readSrc))).join("\n");
}

async function readMobileScreenSrc(): Promise<string> {
  return (await Promise.all(MOBILE_SCREEN_PATHS.map(readSrc))).join("\n");
}

describe("UI Align Phase 3B — mobile readiness replacement", () => {
  let homeSrc = "";
  let bottomNavSrc = "";
  let screenSrc = "";
  let modelSrc = "";

  beforeAll(async () => {
    [homeSrc, bottomNavSrc, screenSrc, modelSrc] = await Promise.all([
      readSrc("client/src/pages/home.tsx"),
      readSrc("client/src/components/BottomNav.tsx"),
      readMobileScreenSrc(),
      readMobileModelSrc(),
    ]);
  });

  it("replaces the home branches with the mobile command center wrapper", () => {
    expect(homeSrc).toContain("MobileCommandCenterPage");
    expect(homeSrc).not.toMatch(/function UserPortalHome|NavigationCard|WorkflowCommandCenter/);
    expect(screenSrc).toContain("export function MobileCommandCenterPage");
    expect(modelSrc).toContain("Command Queue");
    expect(modelSrc).toContain("Status -> Reason -> Action");
  });

  it("uses a role-specific mobile nav instead of the legacy hub launcher", () => {
    expect(bottomNavSrc).toContain("MobileReadinessBottomNav");
    expect(screenSrc).toContain('data-testid="mobile-readiness-bottom-nav"');
    expect(modelSrc).toContain('"Command"');
    expect(modelSrc).toContain('"Bridge"');
    expect(modelSrc).toContain('"My Tasks"');
  });

  it("keeps affected screens on the shared Figma-aligned shell", () => {
    for (const exportedPage of [
      "MobileFleetPage",
      "MobileVesselDetailPage",
      "MobilePdmPage",
      "MobileWorkOrdersPage",
      "MobileLogsPage",
      "MobileCrewPage",
      "MobileInventoryPage",
      "MobileSettingsPage",
    ]) {
      expect(screenSrc).toContain(`export function ${exportedPage}`);
    }
    expect(screenSrc).toContain("NavyHeader");
    expect(screenSrc).toContain("KpiStrip");
    expect(screenSrc).toContain("QueueCard");
  });

  it("shares the replacement route contract outside the React screen module", async () => {
    const appSrc = await readSrc("client/src/App.tsx");
    const routeContractSrc = await readSrc(MOBILE_ROUTE_CONTRACT_PATH);

    expect(appSrc).toContain("mobile-readiness-route-contract");
    expect(routeContractSrc).toContain("export function isMobileReadinessReplacementPath");
    expect(routeContractSrc).toContain('"/fleet"');
    expect(routeContractSrc).toContain('"/vessel-intelligence"');
    expect(routeContractSrc).toContain('"/work-orders"');
    expect(routeContractSrc).toContain('"/logs"');
    expect(routeContractSrc).toContain('"/crew-management"');
    expect(routeContractSrc).toContain('"/logistics"');
    expect(routeContractSrc).toContain('"/system"');
    expect(screenSrc).not.toContain("export function isMobileReadinessReplacementPath");
  });

  it("exposes stable screen markers for replacement route and link audits", () => {
    for (const testId of [
      "mobile-readiness-screen-command",
      "mobile-readiness-screen-fleet",
      "mobile-readiness-screen-vessel-detail",
      "mobile-readiness-screen-vessel-diagram",
      "mobile-readiness-screen-pdm-queue",
      "mobile-readiness-screen-pdm-asset-case",
      "mobile-readiness-screen-pdm-telemetry",
      "mobile-readiness-screen-work-queue",
      "mobile-readiness-screen-work-execution",
      "mobile-readiness-screen-logs",
      "mobile-readiness-screen-crew",
      "mobile-readiness-screen-inventory",
      "mobile-readiness-screen-settings",
    ]) {
      expect(screenSrc).toContain(`data-testid="${testId}"`);
    }
  });

  it("does not retain the legacy admin hub and user portal test ids", () => {
    expect(homeSrc + screenSrc).not.toMatch(
      /shell-admin-hubs|shell-user-portal|list-admin-hubs|card-todays-overview|card-user-feedback-cta/
    );
  });
});
