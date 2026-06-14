import { expect, test, type Page } from "@playwright/test";

import {
  installRoleFixtures,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { createHeapSampler, HEAP_GROWTH_ABS_BYTES, HEAP_GROWTH_RATIO, mb } from "../helpers/heap";

/**
 * Interaction stress (`@stress`) — ADVISORY. Rapidly toggle filter tabs on the
 * work queue and the logistics tabs (DOM churn rather than route nav) to surface
 * listener / subscription leaks that only show under repeated mount-in-place.
 *
 * Controls are matched by accessible name (no guaranteed testids) — the labels
 * are pinned by the control-crawl documented-state-button allowlist, so this is
 * brittle-but-low-risk. Each toggle is guarded: missing controls are skipped,
 * and the leak/health assertions remain the point of the test.
 */

const WORK_QUEUE_FILTERS = ["All", "Mine", "Overdue", "Watch", "Blocked"];
const LOGISTICS_TABS = ["Inventory", "Service Orders", "Service Requests", "Overview", "Vendors"];

/** Click each named control that is currently visible, once, in order. */
async function clickAvailable(page: Page, names: string[]): Promise<number> {
  let clicks = 0;
  for (const name of names) {
    const control = page.getByRole("button", { name, exact: true }).first();
    if ((await control.count()) > 0 && (await control.isVisible().catch(() => false))) {
      await control.click({ timeout: 2_000 }).catch(() => undefined);
      clicks += 1;
      await page.waitForTimeout(15);
    }
  }
  return clicks;
}

test.describe("interaction stress @stress", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Heap sampling is chromium-only.");
    await installRoleFixtures(page, { role: "system_admin", hidePerfOverlay: true });
    await loginRole(page, "system_admin");
  });

  test("repeated filter/tab toggling does not leak or break the shell", async ({ page }) => {
    test.setTimeout(120_000);
    const sampleHeap = await createHeapSampler(page);

    await navigateWithinAuthenticatedSpa(page, "/work-orders");
    await expect(page.getByTestId("mobile-readiness-screen-work-queue")).toBeVisible({
      timeout: 15_000,
    });
    await page.waitForTimeout(400);
    const baseline = await sampleHeap();

    let totalClicks = 0;
    for (let cycle = 0; cycle < 25; cycle += 1) {
      totalClicks += await clickAvailable(page, WORK_QUEUE_FILTERS);
    }
    await navigateWithinAuthenticatedSpa(page, "/logistics");
    await page.waitForTimeout(400);
    for (let cycle = 0; cycle < 15; cycle += 1) {
      totalClicks += await clickAvailable(page, LOGISTICS_TABS);
    }

    // eslint-disable-next-line no-console -- calibration signal in the report.
    console.log(`[stress:interaction] performed ${totalClicks} control toggles`);

    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText("404 Page Not Found", { exact: false })).toHaveCount(0);

    const end = await sampleHeap();
    // eslint-disable-next-line no-console -- calibration signal in the report.
    console.log(`[stress:interaction] heap baseline ${mb(baseline)} → end ${mb(end)}`);
    expect(end, `heap grew to ${mb(end)} from ${mb(baseline)}`).toBeLessThan(
      baseline * HEAP_GROWTH_RATIO
    );
    expect(end - baseline, `heap grew +${mb(end - baseline)}`).toBeLessThan(HEAP_GROWTH_ABS_BYTES);
  });
});
