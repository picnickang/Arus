/**
 * Post-GC JS heap sampling via CDP, shared by the stress lanes. Chromium-only
 * (the `stress` project launches with `--js-flags=--expose-gc`). Heap numbers
 * are coarse and exclude GPU/canvas memory — thresholds are advisory, calibrated
 * from real nightly runs.
 */

import type { Page } from "@playwright/test";

interface HeapUsage {
  usedSize: number;
  totalSize: number;
}

export const HEAP_GROWTH_RATIO = 1.5;
export const HEAP_GROWTH_ABS_BYTES = 50 * 1024 * 1024;

export const mb = (n: number): string => `${(n / 1024 / 1024).toFixed(1)}MB`;

/**
 * Returns a sampler that forces a GC then reports the used JS heap in bytes.
 */
export async function createHeapSampler(page: Page): Promise<() => Promise<number>> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  return async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    const usage = (await cdp.send("Runtime.getHeapUsage")) as HeapUsage;
    return usage.usedSize;
  };
}
