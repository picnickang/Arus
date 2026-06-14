import { test } from "@playwright/test";

import {
  installRoleFixtures,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { DEEP_ROUTES } from "../helpers/hub-targets";
import { DEEP_ROUTE_FIXTURES } from "../helpers/fixtures-deep";
import { FROZEN_TIME, KILL_MOTION_CSS, snapshotStableRoute } from "../helpers/visual-harness";

/**
 * Deep-route visual regression (`@visual`) — ADVISORY. Snapshots the
 * representative sub-routes (vessel-intelligence, pdm, work-order detail, logs,
 * logistics) under the visual / visual-mobile / visual-tablet projects, with
 * `DEEP_ROUTE_FIXTURES` so they render content rather than empty states.
 * Determinism + masking via the shared harness; baselines are linux/advisory.
 */
test.describe("deep-route visual regression @visual", () => {
  test.beforeEach(async ({ page }) => {
    await installRoleFixtures(page, {
      role: "system_admin",
      hidePerfOverlay: true,
      fixtures: DEEP_ROUTE_FIXTURES,
    });
    await page.clock.install({ time: FROZEN_TIME });
    await loginRole(page, "system_admin");
    await page.addStyleTag({ content: KILL_MOTION_CSS });
  });

  for (const route of DEEP_ROUTES) {
    test(`${route.id} renders pixel-stable`, async ({ page }) => {
      await navigateWithinAuthenticatedSpa(page, route.path);
      await snapshotStableRoute(page, route.id);
    });
  }
});
