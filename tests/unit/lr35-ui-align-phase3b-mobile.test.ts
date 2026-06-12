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

describe("UI Align Phase 3B — mobile readiness replacement", () => {
  let homeSrc = "";
  let bottomNavSrc = "";
  let screenSrc = "";
  let modelSrc = "";

  beforeAll(async () => {
    [homeSrc, bottomNavSrc, screenSrc, modelSrc] = await Promise.all([
      readSrc("client/src/pages/home.tsx"),
      readSrc("client/src/components/BottomNav.tsx"),
      readSrc("client/src/features/mobile-readiness/MobileReadinessScreens.tsx"),
      readSrc("client/src/features/mobile-readiness/mobile-readiness-model.ts"),
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

  it("does not retain the legacy admin hub and user portal test ids", () => {
    expect(homeSrc + screenSrc).not.toMatch(
      /shell-admin-hubs|shell-user-portal|list-admin-hubs|card-todays-overview|card-user-feedback-cta/
    );
  });
});
