/**
 * Journey: Global command palette (Cmd/Ctrl-K quick-switcher).
 *
 * Route-mocked like offline-outbox.spec.ts — no backend seed. Verifies:
 *   1. Ctrl+K opens the palette for an admin-portal session; typing a
 *      query renders grouped results from the three stubbed sources.
 *   2. Selecting an equipment result navigates to /equipment/:id.
 *   3. The shell top-bar search button opens the same palette.
 *
 * Quarantined (not in CORE_RELEASE_TESTS); run with
 * PLAYWRIGHT_INCLUDE_QUARANTINE=1.
 */

import { test, expect, type Page, type Route } from "@playwright/test";

const VESSEL = { id: "V-PAL-1", name: "MV Northern Star" };
const EQUIPMENT = { id: "EQ-PAL-1", name: "Main Engine #2", vesselId: "V-PAL-1" };
const WORK_ORDER = {
  id: "WO-PAL-1",
  woNumber: "WO-2836",
  reason: "Northern Star exhaust valve",
  status: "open",
};

async function stubSearchSources(page: Page) {
  // RegExp (not glob) so /api/equipment cannot shadow other /api/equipment-* routes.
  await page.route(/\/api\/equipment(\?|$)/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([EQUIPMENT]),
    });
  });
  await page.route(/\/api\/vessels(\?|$)/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([VESSEL]),
    });
  });
  await page.route(/\/api\/work-orders(\?|$)/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([WORK_ORDER]),
    });
  });
}

async function loginAdmin(page: Page) {
  await page.goto("/portal-login", { waitUntil: "domcontentloaded" });
  await page.getByTestId("button-card-portal-admin").click();
  await page.waitForLoadState("domcontentloaded");
}

test.describe("Global command palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* private mode — fine */
      }
    });
    await stubSearchSources(page);
    await loginAdmin(page);
  });

  test("Ctrl+K opens the palette and shows grouped results", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("input-global-search")).toBeVisible();

    await page.getByTestId("input-global-search").fill("north");

    await expect(page.getByTestId(`search-vessel-${VESSEL.id}`)).toBeVisible();
    await expect(page.getByTestId(`search-wo-${WORK_ORDER.id}`)).toBeVisible();
  });

  test("selecting an equipment result navigates to the equipment hub route", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.getByTestId("input-global-search").fill("engine");

    const item = page.getByTestId(`search-equipment-${EQUIPMENT.id}`);
    await expect(item).toBeVisible();
    await item.click();

    await expect(page).toHaveURL(new RegExp(`/equipment/${EQUIPMENT.id}`));
  });

  test("the shell search button opens the palette", async ({ page }) => {
    // Any hub-shelled route renders the top bar with the search trigger.
    await page.goto("/work-orders", { waitUntil: "domcontentloaded" });
    await page.getByTestId("button-global-search").click();
    await expect(page.getByTestId("input-global-search")).toBeVisible();
  });
});
