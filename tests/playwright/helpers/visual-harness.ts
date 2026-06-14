/**
 * Shared determinism harness for the visual lanes (deep-routes, roles). Mirrors
 * the inline controls in `hub-visual.spec.ts` (kept inline there so its
 * committed baselines never shift). Freeze time, kill motion, await fonts, mask
 * dynamic regions, then snapshot.
 */

import { expect, type Locator, type Page } from "@playwright/test";

export const FROZEN_TIME = new Date("2026-06-12T00:00:00.000Z");

export const KILL_MOTION_CSS = `*,*::before,*::after{
  animation: none !important;
  transition: none !important;
  caret-color: transparent !important;
  scroll-behavior: auto !important;
}`;

/** Locators for non-deterministic regions to mask out of screenshots. */
export function dynamicMasks(page: Page): Locator[] {
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

/** Snapshot the current route with the shared deterministic options. */
export async function snapshotStableRoute(page: Page, name: string): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });
  await page.evaluate(() => document.fonts.ready);
  // Settle post-mount paints (mocked data resolves instantly).
  await page.waitForTimeout(400);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    mask: dynamicMasks(page),
    animations: "disabled",
    caret: "hide",
    fullPage: true,
    maxDiffPixelRatio: 0.01,
    threshold: 0.2,
  });
}
