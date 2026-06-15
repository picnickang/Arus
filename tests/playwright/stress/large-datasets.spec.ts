import { expect, test } from "@playwright/test";

import {
  installRoleFixtures,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { expectedScreenTestId } from "../helpers/roles";
import { createHeapSampler, HEAP_GROWTH_ABS_BYTES, HEAP_GROWTH_RATIO, mb } from "../helpers/heap";

/**
 * Large-dataset stress (`@stress`) — ADVISORY. Mock the list endpoints with
 * 1000-row arrays and render the list-heavy pages, asserting they mount and the
 * post-GC heap stays bounded. Caveat: if a list is virtualized the DOM (and
 * heap) stays small — that's still a valid "doesn't explode" signal, not a
 * coverage gap.
 */

const LARGE_LISTS: Record<string, number> = {
  "/api/work-orders": 1000,
  "/api/crew": 1000,
  "/api/crew/unified": 1000,
  "/api/parts": 1000,
  "/api/pdm/risk-queue": 1000,
  "/api/notifications": 1000,
  "/api/findings": 1000,
};

const LIST_ROUTES = ["/work-orders", "/crew-management", "/logistics", "/pdm-platform"];

test.describe("large-dataset stress @stress", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Heap sampling is chromium-only.");
    await installRoleFixtures(page, {
      role: "system_admin",
      hidePerfOverlay: true,
      largeLists: LARGE_LISTS,
    });
    await loginRole(page, "system_admin");
  });

  test("renders list-heavy pages under 1000-row payloads without exploding the heap", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const sampleHeap = await createHeapSampler(page);

    // Warm-up the first list page, then take the baseline.
    await navigateWithinAuthenticatedSpa(page, LIST_ROUTES[0]!);
    await page.waitForTimeout(800);
    const baseline = await sampleHeap();

    for (const route of LIST_ROUTES) {
      await navigateWithinAuthenticatedSpa(page, route);
      await expect(
        page.getByTestId(expectedScreenTestId(route, { fallback: "universal-ops-shell" })),
        `${route} should render under a 1000-row payload`
      ).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(400);
    }

    const end = await sampleHeap();
    // eslint-disable-next-line no-console -- calibration signal in the report.
    console.log(`[stress:large] heap baseline ${mb(baseline)} → end ${mb(end)}`);

    expect(end, `heap grew to ${mb(end)} from ${mb(baseline)}`).toBeLessThan(
      baseline * HEAP_GROWTH_RATIO
    );
    expect(end - baseline, `heap grew +${mb(end - baseline)}`).toBeLessThan(HEAP_GROWTH_ABS_BYTES);
  });
});
