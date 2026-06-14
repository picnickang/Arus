import { test } from "@playwright/test";

import {
  installRoleFixtures,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { NON_ADMIN_ROLE_SCENARIOS } from "../helpers/roles";
import { FROZEN_TIME, KILL_MOTION_CSS, snapshotStableRoute } from "../helpers/visual-harness";

/**
 * Non-admin role visual regression (`@visual`) — ADVISORY. Snapshots each
 * non-admin role (deck_officer / crew_member / viewer) on its reachable routes
 * so the user-portal surface + bottom-nav variants (captain vs crew) are pinned
 * across viewports. Mocked, deterministic; baselines linux/advisory.
 */
function routeSlug(route: string): string {
  if (route === "/") {
    return "home";
  }
  return route.replace(/[^a-z]+/gi, "-").replace(/^-|-$/g, "");
}

for (const scenario of NON_ADMIN_ROLE_SCENARIOS) {
  test.describe(`${scenario.role} visual @visual`, () => {
    test.beforeEach(async ({ page }) => {
      await installRoleFixtures(page, {
        role: scenario.role,
        adminCapable: false,
        permissions: scenario.permissions,
        hidePerfOverlay: true,
      });
      await page.clock.install({ time: FROZEN_TIME });
      await loginRole(page, scenario.role, false);
      await page.addStyleTag({ content: KILL_MOTION_CSS });
    });

    for (const route of scenario.startRoutes) {
      test(`${routeSlug(route)} renders pixel-stable`, async ({ page }) => {
        await navigateWithinAuthenticatedSpa(page, route);
        await snapshotStableRoute(page, `${scenario.role}-${routeSlug(route)}`);
      });
    }
  });
}
