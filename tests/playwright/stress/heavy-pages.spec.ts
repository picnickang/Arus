import { expect, test } from "@playwright/test";

import {
  installRoleFixtures,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { DEEP_ROUTE_FIXTURES } from "../helpers/fixtures-deep";
import { createHeapSampler, HEAP_GROWTH_ABS_BYTES, HEAP_GROWTH_RATIO, mb } from "../helpers/heap";

/**
 * Heavy-page stress (`@stress`) — ADVISORY. Repeatedly mount/unmount the
 * chart-dense surfaces (digital twin + pdm telemetry) and assert the post-GC JS
 * heap plateaus rather than climbing per mount (catches chart/listener leaks).
 *
 * `/vessels/:id/3d` (three.js) is intentionally skipped — it's blocked on a GLB
 * upload + twin-state fixture. Caveat: JS heap excludes GPU/canvas memory, so a
 * WebGL leak in the 3D viewer wouldn't show here anyway.
 */

const HEAVY_ROUTES = ["/digital-twin", "/pdm/equipment/port-generator/telemetry"];
const CYCLES = 8;

test.describe("heavy-page stress @stress", () => {
  test.beforeEach(async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Heap sampling is chromium-only.");
    await installRoleFixtures(page, {
      role: "system_admin",
      hidePerfOverlay: true,
      fixtures: DEEP_ROUTE_FIXTURES,
    });
    await loginRole(page, "system_admin");
  });

  test("repeatedly mounting chart-heavy pages does not leak the JS heap", async ({ page }) => {
    test.setTimeout(180_000);
    const sampleHeap = await createHeapSampler(page);

    // Warm-up both heavy pages, then baseline.
    for (const route of HEAVY_ROUTES) {
      await navigateWithinAuthenticatedSpa(page, route);
      await page.waitForTimeout(700);
    }
    const baseline = await sampleHeap();

    const samples: number[] = [];
    for (let cycle = 0; cycle < CYCLES; cycle += 1) {
      for (const route of HEAVY_ROUTES) {
        await navigateWithinAuthenticatedSpa(page, route);
        await page.waitForTimeout(400);
      }
      samples.push(await sampleHeap());
    }

    const end = samples[samples.length - 1]!;
    // eslint-disable-next-line no-console -- calibration signal in the report.
    console.log(
      `[stress:heavy] heap per cycle: ${samples.map(mb).join(" → ")} (baseline ${mb(baseline)})`
    );

    await expect(page.locator("#root")).not.toBeEmpty();
    expect(end, `heap grew to ${mb(end)} from ${mb(baseline)}`).toBeLessThan(
      baseline * HEAP_GROWTH_RATIO
    );
    expect(end - baseline, `heap grew +${mb(end - baseline)}`).toBeLessThan(HEAP_GROWTH_ABS_BYTES);
  });
});
