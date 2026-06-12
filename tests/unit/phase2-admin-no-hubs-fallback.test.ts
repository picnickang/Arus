/**
 * Mobile readiness replacement supersedes the legacy admin no-hubs overview.
 *
 * The security policy still distinguishes an empty hub allow-list from
 * unrestricted admin access, but the impacted /home UI is no longer the
 * legacy admin hub launcher. It is now the role-aware mobile command queue.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  getAdminPrimaryCategories,
  filterCategoriesByHubAccess,
} from "@/application/navigation/role-navigation-policy";

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

async function readMobileModelSrc(): Promise<string> {
  return (await Promise.all(MOBILE_MODEL_PATHS.map(readSrc))).join("\n");
}

describe("Phase 2 — mobile readiness replaces admin no-hubs fallback", () => {
  it("policy: an empty hub allow-list still yields zero admin categories", () => {
    const cats = getAdminPrimaryCategories();
    expect(cats.length).toBe(8);
    expect(filterCategoriesByHubAccess(cats, [])).toEqual([]);
    expect(filterCategoriesByHubAccess(cats, null).length).toBe(8);
  });

  it("home.tsx delegates entirely to the mobile command center", async () => {
    const homeSrc = await readSrc("client/src/pages/home.tsx");

    expect(homeSrc).toContain("MobileCommandCenterPage");
    expect(homeSrc).toContain("return <MobileCommandCenterPage />");
    expect(homeSrc).not.toMatch(/shell-admin-no-hubs|banner-no-hubs|card-hub-|allHubs\.map/);
  });

  it("the replacement command center carries the actionable status-reason-action contract", async () => {
    const screenSrc = await readSrc("client/src/features/mobile-readiness/MobileReadinessScreens.tsx");
    const modelSrc = await readMobileModelSrc();

    expect(screenSrc).toContain("MobileCommandCenterPage");
    expect(screenSrc).toContain("today-card-");
    expect(modelSrc).toContain("Command Queue");
    expect(modelSrc).toContain("Status -> Reason -> Action");
    expect(modelSrc).toContain("Engine room fire alarm");
  });
});
