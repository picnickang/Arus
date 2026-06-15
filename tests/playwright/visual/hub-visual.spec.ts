import { expect, test, type Locator } from "@playwright/test";

import {
  installRoleFixtures,
  loginRole,
  navigateWithinAuthenticatedSpa,
} from "../helpers/spa-auth";
import { HUBS } from "../helpers/hub-targets";

/**
 * Visual regression (`@visual`) — native `toHaveScreenshot`, ADVISORY.
 *
 * Runs under the `visual` (desktop) and `visual-mobile` (Pixel 5) projects, so
 * each hub yields a baseline per viewport. Backend is fully mocked
 * (`installRoleFixtures`) for deterministic pixels.
 *
 * Determinism controls (the high-risk area):
 *  - Engine pinned via the project `launchOptions.executablePath`
 *    (PLAYWRIGHT_CHROMIUM_PATH locally; the CI-installed chromium otherwise).
 *  - Time frozen with `page.clock` so relative-time / "x ago" text is stable.
 *  - Animations + transitions killed (CSS + the `animations:"disabled"` option).
 *  - `document.fonts.ready` awaited before each shot.
 *  - Dynamic regions masked (perf overlay, charts/canvas, avatars, timestamps).
 *
 * Baselines are platform-suffixed (`-linux`) — generate/commit them on linux
 * (this container or CI) via `npm run test:visual:update`. Advisory CI absorbs
 * the first 1–2 recalibration passes; never make this a hard PR gate before the
 * baselines are proven stable.
 */

const FROZEN_TIME = new Date("2026-06-12T00:00:00.000Z");

const KILL_MOTION_CSS = `*,*::before,*::after{
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}`;

// Hubs + a few high-signal sub-states worth pinning visually.
const VISUAL_ROUTES: ReadonlyArray<{ id: string; path: string }> = [
  ...HUBS.map((hub) => ({ id: hub.id, path: hub.hubRoute })),
  { id: "work-queue", path: "/work-orders" },
  { id: "logs-deck", path: "/logs" },
];

function dynamicMasks(page: import("@playwright/test").Page): Locator[] {
  return [
    page.getByTestId("button-show-perf-overlay"),
    page.locator("canvas"),
    page.locator('[data-testid*="chart"]'),
    page.locator('[data-testid*="avatar"]'),
    page.locator("img[alt]"),
    page.locator("time"),
    page.locator('[data-testid*="timestamp"]'),
    page.locator('[data-testid*="relative-time"]'),
  ];
}

test.describe("hub visual regression @visual", () => {
  test.beforeEach(async ({ page }) => {
    await installRoleFixtures(page, { role: "system_admin", hidePerfOverlay: true });
    await page.clock.install({ time: FROZEN_TIME });
    await loginRole(page, "system_admin");
    await page.addStyleTag({ content: KILL_MOTION_CSS });
  });

  for (const route of VISUAL_ROUTES) {
    test(`${route.id} renders pixel-stable`, async ({ page }) => {
      await navigateWithinAuthenticatedSpa(page, route.path);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
      await page.evaluate(() => document.fonts.ready);
      // Settle layout (mocked data resolves instantly; this covers post-mount paints).
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${route.id}.png`, {
        mask: dynamicMasks(page),
        animations: "disabled",
        caret: "hide",
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        threshold: 0.2,
      });
    });
  }
});
